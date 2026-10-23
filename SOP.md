# Docker apna-college-db: Complete SOP

This SOP covers the project from the original application through the current
container deployment.

## 1. Version history and source locations

| Version | Location | Behavior |
| --- | --- | --- |
| Initial | `docker-testapp-main-orginalappV` | One database: `apnacollege-db.users` |
| Latest | `docker-testapp-main` | Selectable database and collection targets |

The latest application maps requests as follows:

| Request key | Database | Collection |
| --- | --- | --- |
| `college` | `apnacollege-db` | `users` |
| `healthcheck` | `mongodb-healthcheck` | `sharadafamily` |

The latest application listens on port `5050`. MongoDB listens on `27017` and
Mongo Express, when enabled, listens on `8081`.

## 2. Prerequisites

Install and start Docker Desktop for Windows. Verify the tools:

```powershell
docker --version
docker compose version
node --version
npm.cmd --version
kubectl version --client
```

All commands below assume PowerShell and this directory:

```powershell
Set-Location "C:\path\to\docker-testapp-main"
```

## 3. Inspect and install the application

```powershell
Get-ChildItem
npm.cmd install
node --check .\server.js
```

Expected source files include `server.js`, `package.json`, `Dockerfile`,
`public\`, and the MongoDB YAML files.

## 4. Start MongoDB locally with a named Docker volume

The recommended local database setup uses the compose file with the named
volume `mongodb_data`:

```powershell
Copy-Item .\.env.example .\.env
notepad .\.env
docker compose -f .\mongodb-volume.yaml up -d
docker compose -f .\mongodb-volume.yaml ps
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

Set a unique strong password in `.env` before starting MongoDB. The `.env` file
is ignored by Git; do not commit or share it.

Confirm the database port:

```powershell
Test-NetConnection localhost -Port 27017
```

The data volume survives container recreation. Inspect it with:

```powershell
docker volume ls
docker volume inspect docker-testapp-main_mongodb_data
```

The exact volume name can differ when the Compose project name changes. Use the
name returned by `docker volume ls`.

To stop MongoDB without deleting data:

```powershell
docker compose -f .\mongodb-volume.yaml stop
```

To stop and remove the container while preserving the named volume:

```powershell
docker compose -f .\mongodb-volume.yaml down
```

Do not use `down -v` unless deleting the database is intentional.

## 5. Run and test the latest app directly on Windows

When Node runs on the host, the default URL connects to unauthenticated local MongoDB. The Compose files in this project enable authentication; for those, provide `MONGO_ROOT_USERNAME` and `MONGO_ROOT_PASSWORD` to the Node process, or set `MONGO_URL` through your local secret manager. Docker Compose reads `.env` for its own configuration but does not automatically export it to Node.js.

Start the app in a separate PowerShell window:

```powershell
node .\server.js
```

Verify the home page and both database targets from another window:

```powershell
Invoke-WebRequest http://localhost:5050 -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=college" -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=healthcheck" -UseBasicParsing
```

Test an invalid target and an insert:

```powershell
Invoke-WebRequest "http://localhost:5050/getUsers?db=unknown" -UseBasicParsing -SkipHttpErrorCheck

$body = @{ db = "college"; name = "Test User"; email = "test@example.com" } | ConvertTo-Json
Invoke-WebRequest http://localhost:5050/addUser -Method Post -ContentType "application/json" -Body $body -UseBasicParsing
```

Expected results are HTTP 200 for reads, HTTP 400 for an unknown target, and
HTTP 201 for a successful insert.

## 6. Build the application image

Use a fixed image tag for a reproducible release. Replace `<dockerhub-user>`
with the Docker Hub account name when publishing:

```powershell
docker build --pull -t <dockerhub-user>/docker-testapp-main:latest .
docker image ls <dockerhub-user>/docker-testapp-main
```

The Dockerfile installs dependencies inside the image and copies only the
application runtime files. The image exposes port `5050`.

## 7. Run the app container with MongoDB on the host

Because `localhost` inside a container means the app container itself, pass
Docker Desktop's host gateway explicitly when MongoDB is running on Windows:
Set `MONGO_URL` securely in the current PowerShell environment or through a
secret manager before running the app container. Use `host.docker.internal`
for host MongoDB and the MongoDB container name for a shared Docker network.

```powershell
docker rm -f docker-testapp-main 2>$null
docker run -d `
  --name docker-testapp-main `
  --add-host=host.docker.internal:host-gateway `
  -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:latest
```

Check the container and application:

```powershell
docker ps
docker logs --tail 100 docker-testapp-main
Invoke-WebRequest http://localhost:5050 -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=college" -UseBasicParsing
```

## 8. Run app and MongoDB together on a Docker network

For a fully containerized deployment, create a shared network and use the
MongoDB container name in `MONGO_URL`:

```powershell
docker network create docker-testapp-net 2>$null
docker rm -f docker-testapp-main mongodb-main 2>$null
# Set MONGO_ROOT_PASSWORD in this PowerShell session before running this command.
docker run -d --name mongodb-main --network docker-testapp-net `
  -p 27017:27017 `
  -e MONGO_INITDB_ROOT_USERNAME=admin `
  -e "MONGO_INITDB_ROOT_PASSWORD=$env:MONGO_ROOT_PASSWORD" `
  -v mongodb_data:/data/db mongo

docker run -d --name docker-testapp-main --network docker-testapp-net `
  -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:latest
```

In this mode, do not use `localhost` in the app's MongoDB URL. Containers reach
each other by service or container name on the shared Docker network.

## 9. Docker Compose alternative

The existing `mongodb-volume.yaml` starts MongoDB only. If the app is started
separately, use the network method above. For a Compose deployment, add the app service to a Compose file and provide its
authenticated `MONGO_URL` through the environment or an ignored local `.env`
file, then run:

```powershell
docker compose up -d
docker compose ps
docker compose logs --tail 100
```

Always verify that the app service and MongoDB service share the same Compose
network and that MongoDB is healthy before testing writes.

## 10. Push the release to Docker Hub

Log in, tag, and push the tested image:

```powershell
docker login
docker tag <dockerhub-user>/docker-testapp-main:latest <dockerhub-user>/docker-testapp-main:v1
docker push <dockerhub-user>/docker-testapp-main:v1
docker push <dockerhub-user>/docker-testapp-main:latest
```

On another machine, pull and run the same release:

```powershell
docker pull <dockerhub-user>/docker-testapp-main:v1
docker run -d --name docker-testapp-main -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:v1
```

Use immutable version tags such as `v1`, `v2`, or a Git commit tag for
rollback. Keep `latest` as a convenience tag only.

## 11. Kubernetes YAML workflow

The YAML files in this project are MongoDB manifests. Apply the healthchecked
MongoDB setup when a Kubernetes cluster is available:

```powershell
kubectl apply -f .\mongodb-healthcheck.yaml
kubectl get pods -o wide
kubectl get services
kubectl describe pod -l app=mongo
```

The current application image is not defined in these MongoDB-only manifests.
For a Kubernetes app deployment, create an app Deployment and Service that use
the pushed image, set `MONGO_URL` to the MongoDB Service DNS name, and expose
container port `5050`. Then verify with:

```powershell
kubectl rollout status deployment/docker-testapp-main
kubectl logs deployment/docker-testapp-main --tail=100
kubectl port-forward service/docker-testapp-main 5050:5050
```

Do not use `localhost` for MongoDB from a Kubernetes pod; use the MongoDB
Service name.

## 12. Update and release workflow

1. Edit the source in `docker-testapp-main`.
2. Install dependencies and run `node --check .\server.js`.
3. Start MongoDB and run the app locally.
4. Test both `college` and `healthcheck` reads and a write.
5. Build a new immutable image tag.
6. Run the new image with the correct `MONGO_URL`.
7. Check logs and HTTP responses.
8. Push the tested tag to Docker Hub.
9. Pull the same tag on the target host and redeploy.
10. Keep the previous image tag for rollback.

## 13. Stop, restart, and rollback

```powershell
docker restart docker-testapp-main
docker logs -f docker-testapp-main
docker stop docker-testapp-main
docker rm docker-testapp-main
```

Rollback to a previous image:

```powershell
docker rm -f docker-testapp-main
docker run -d --name docker-testapp-main -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:v1
```

## 14. Troubleshooting

### Port 5050 is already in use

```powershell
Get-NetTCPConnection -LocalPort 5050 -State Listen
$connection = Get-NetTCPConnection -LocalPort 5050 -State Listen
Get-Process -Id $connection.OwningProcess
Stop-Process -Id $connection.OwningProcess -Force
```

Alternatively map another host port, for example `-p 5055:5050`, and browse
to `http://localhost:5055`.

### MongoDB port is unavailable

```powershell
Test-NetConnection localhost -Port 27017
docker ps --format "table {{.Names}}\t{{.Ports}}"
docker logs mongodb-main
docker compose -f .\mongodb-volume.yaml ps
```

Start the database again with `docker compose -f .\mongodb-volume.yaml up -d`.

### The app returns database errors from a container

Check the effective URL and logs:

```powershell
docker inspect docker-testapp-main --format "{{range .Config.Env}}{{println .}}{{end}}"
docker logs --tail 200 docker-testapp-main
```

Use `host.docker.internal` when MongoDB is on Windows, `mongodb-main` when the
containers share a Docker network, or the Kubernetes Service name in a pod.

### Container exits immediately

```powershell
docker ps -a
docker logs docker-testapp-main
docker image inspect <dockerhub-user>/docker-testapp-main:latest
```

Common causes are a failed dependency install, a missing `server.js`, or an
incorrect `MONGO_URL`.

### Docker Hub pull is denied

```powershell
docker login
docker pull <dockerhub-user>/docker-testapp-main:v1
```

Confirm the repository name, tag, account permissions, and whether the image
repository is public or private.

### Kubernetes pod is pending or restarting

```powershell
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
kubectl get events --sort-by=.lastTimestamp
```

## 15. Data and credential cautions

Use a unique strong local MongoDB password and do not commit it. Use Docker
Secrets, Kubernetes Secrets, or an external secret manager in real deployments,
and back up the named MongoDB volume before destructive maintenance.