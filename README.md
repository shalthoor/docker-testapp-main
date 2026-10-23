# Docker apna-college-db

Dockerized Node.js and MongoDB application for the Apna College database
example. This README documents the complete workflow from the original app
through the current multi-database version, including build, test, deployment,
Docker volume usage, Docker Hub publishing, update, rollback, and
troubleshooting.

## 1. Application versions

### Initial version

The original single-database application is in a separate local project folder
and is not included in this repository.

It uses one target:

```text
Database:  apnacollege-db
Collection: users
```

### Latest version

It supports these database and collection targets:

| Request key | Database | Collection |
| --- | --- | --- |
| `college` | `apnacollege-db` | `users` |
| `healthcheck` | `mongodb-healthcheck` | `sharadafamily` |

The latest application listens on port `5050`.

## 2. Project structure

```text
docker-testapp-main/
  server.js                 Node.js application
  package.json              Node.js dependencies
  Dockerfile                Application image definition
  public/                   Browser UI files
  mongodb-volume.yaml       MongoDB with named volume
  mongodb-healthcheck.yaml MongoDB with health check and Mongo Express
  mongodb-basic.yaml        Basic MongoDB service
  SOP.md                    Extended operations runbook
```

## 3. Prerequisites

Install and start Docker Desktop for Windows. Node.js is required for local
development and testing. `kubectl` is required only for Kubernetes deployment.

Verify the tools:

```powershell
docker --version
docker compose version
node --version
npm.cmd --version
kubectl version --client
```

Move to the latest project directory:

```powershell
Set-Location "C:\path\to\docker-testapp-main"
```

## 4. Install and validate the application

Install dependencies and check the source:

```powershell
npm.cmd install
node --check .\server.js
```

Check that required dependencies are available:

```powershell
Test-Path .\node_modules\express
Test-Path .\node_modules\mongodb
```

## 5. Start MongoDB with a persistent Docker volume

The recommended local database configuration uses the named volume defined in
`mongodb-volume.yaml`:

```powershell
Copy-Item .\.env.example .\.env
notepad .\.env
docker compose -f .\mongodb-volume.yaml up -d
docker compose -f .\mongodb-volume.yaml ps
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
Test-NetConnection localhost -Port 27017
```

Set a unique strong password in the local `.env` file before starting MongoDB.
The `.env` file is ignored by Git; do not commit or share it.
MongoDB uses port `27017`.

Inspect the named volume:

```powershell
docker volume ls
docker volume inspect docker-testapp-main_mongodb_data
```

Stop the database while preserving its data:

```powershell
docker compose -f .\mongodb-volume.yaml stop
```

Remove the MongoDB container while preserving its volume:

```powershell
docker compose -f .\mongodb-volume.yaml down
```

Do not use `docker compose down -v` unless deleting all MongoDB data is
intentional.

## 6. Run and test the latest app locally

Start the Node.js server in a separate PowerShell window:

```powershell
node .\server.js
```

Open `http://localhost:5050`, then test the home page and both database targets:

```powershell
Invoke-WebRequest http://localhost:5050 -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=college" -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=healthcheck" -UseBasicParsing
```

Test invalid input and a database insert:

```powershell
Invoke-WebRequest "http://localhost:5050/getUsers?db=unknown" `
  -UseBasicParsing -SkipHttpErrorCheck

$body = @{ db = "college"; name = "Test User"; email = "test@example.com" } | ConvertTo-Json
Invoke-WebRequest http://localhost:5050/addUser `
  -Method Post -ContentType "application/json" -Body $body -UseBasicParsing
```

Expected results are HTTP 200 for reads, HTTP 400 for an unknown database, and
HTTP 201 for a successful insert.

## 7. Build the Docker image

Replace `<dockerhub-user>` with the Docker Hub account or organization name:

```powershell
docker build --pull -t <dockerhub-user>/docker-testapp-main:latest .
docker image ls <dockerhub-user>/docker-testapp-main
```

The Dockerfile uses `node:22-alpine`, installs dependencies inside the image,
copies the application files, exposes port `5050`, and starts `node server.js`.

Create an immutable release tag:

```powershell
docker tag <dockerhub-user>/docker-testapp-main:latest `
  <dockerhub-user>/docker-testapp-main:v1
```

## 8. Run the app container with host MongoDB

When MongoDB runs on Windows and the app runs in a container, use
`host.docker.internal`. `localhost` inside a container refers to that container.
Before running the app container, set `MONGO_URL` securely in the current
PowerShell environment or through a secret manager. Use `host.docker.internal`
for the host-MongoDB examples and the MongoDB container name for shared-network
examples; do not put credentials in this README or a command literal.

```powershell
docker rm -f docker-testapp-main 2>$null

docker run -d `
  --name docker-testapp-main `
  --add-host=host.docker.internal:host-gateway `
  -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:v1
```

Verify the deployment:

```powershell
docker ps
docker logs --tail 100 docker-testapp-main
Invoke-WebRequest http://localhost:5050 -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=college" -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=healthcheck" -UseBasicParsing
```

## 9. Run app and MongoDB as containers

For a fully containerized setup, put both containers on the same Docker network.
The app must use the MongoDB container name, not `localhost`.

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
  <dockerhub-user>/docker-testapp-main:v1
```

Verify both containers:

```powershell
docker ps
docker network inspect docker-testapp-net
docker logs --tail 100 mongodb-main
docker logs --tail 100 docker-testapp-main
```

## 10. Docker Compose workflow

Validate and start the included MongoDB Compose configuration:

```powershell
docker compose -f .\mongodb-volume.yaml config
docker compose -f .\mongodb-volume.yaml up -d
docker compose -f .\mongodb-volume.yaml ps
```

If the app is added as a Compose service, provide its authenticated `MONGO_URL`
through the environment or an ignored local `.env` file.

Compose services communicate using service names on the Compose network.

## 11. Publish the image to Docker Hub

Log in, then push the tested release:

```powershell
docker login
docker push <dockerhub-user>/docker-testapp-main:v1
docker push <dockerhub-user>/docker-testapp-main:latest
```

On another machine, download and run the release:

```powershell
docker pull <dockerhub-user>/docker-testapp-main:v1
docker run -d --name docker-testapp-main -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:v1
```

Use immutable tags such as `v1`, `v2`, or a commit tag for rollback. Keep
`latest` as a convenience tag only.

## 12. Update and release workflow

1. Edit the source in `docker-testapp-main`.
2. Run `npm.cmd install` if dependencies changed.
3. Run `node --check .\server.js`.
4. Start MongoDB and test the app locally.
5. Test both database targets and one successful insert.
6. Build a new immutable image tag, such as `v2`.
7. Run the new image and inspect its logs.
8. Push the tested tag to Docker Hub.
9. Deploy the same tag to the target environment.
10. Update `latest` only after verification.
11. Keep the previous tag for rollback.

Example:

```powershell
docker build --pull -t <dockerhub-user>/docker-testapp-main:v2 .
docker run -d --name docker-testapp-main-v2 -p 5055:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:v2

Invoke-WebRequest http://localhost:5055 -UseBasicParsing
docker logs --tail 100 docker-testapp-main-v2
docker push <dockerhub-user>/docker-testapp-main:v2
docker tag <dockerhub-user>/docker-testapp-main:v2 <dockerhub-user>/docker-testapp-main:latest
docker push <dockerhub-user>/docker-testapp-main:latest
```

## 13. Restart and rollback

```powershell
docker restart docker-testapp-main
docker logs -f docker-testapp-main
```

Rollback to `v1`:

```powershell
docker rm -f docker-testapp-main
docker run -d --name docker-testapp-main -p 5050:5050 `
  -e MONGO_URL="$env:MONGO_URL" `
  <dockerhub-user>/docker-testapp-main:v1
```

## 14. Optional Kubernetes workflow

The included YAML files define MongoDB and Mongo Express. Apply the healthcheck
configuration when a Kubernetes cluster is available:

```powershell
kubectl apply -f .\mongodb-healthcheck.yaml
kubectl get pods -o wide
kubectl get services
kubectl describe pod -l app=mongo
```

The current YAML files do not define an application Deployment. A Kubernetes
app Deployment should use the pushed image, expose port `5050`, and set
`MONGO_URL` to the MongoDB Service DNS name. Do not use `localhost` for MongoDB
from a Kubernetes pod.

After an app Deployment and Service exist:

```powershell
kubectl rollout status deployment/docker-testapp-main
kubectl logs deployment/docker-testapp-main --tail=100
kubectl port-forward service/docker-testapp-main 5050:5050
```

## 15. Troubleshooting

### Port 5050 is already in use

```powershell
Get-NetTCPConnection -LocalPort 5050 -State Listen
$connection = Get-NetTCPConnection -LocalPort 5050 -State Listen
Get-Process -Id $connection.OwningProcess
Stop-Process -Id $connection.OwningProcess -Force
```

Alternatively map another host port, such as `-p 5055:5050`, and use
`http://localhost:5055`.

### MongoDB is unavailable

```powershell
Test-NetConnection localhost -Port 27017
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker logs mongodb-main
docker compose -f .\mongodb-volume.yaml ps
```

Start it again with:

```powershell
docker compose -f .\mongodb-volume.yaml up -d
```

### The container cannot connect to MongoDB

```powershell
docker inspect docker-testapp-main --format "{{range .Config.Env}}{{println .}}{{end}}"
docker logs --tail 200 docker-testapp-main
```

Use `localhost` for Node.js on Windows, `host.docker.internal` for an app
container connecting to host MongoDB, the MongoDB container/service name for
Docker networks, or the MongoDB Service name in Kubernetes.

### Container exits immediately

```powershell
docker ps -a
docker logs docker-testapp-main
docker image inspect <dockerhub-user>/docker-testapp-main:v1
```

Check for a missing source file, failed dependency installation, invalid image
tag, or incorrect `MONGO_URL`.

### Docker Hub pull is denied

```powershell
docker login
docker pull <dockerhub-user>/docker-testapp-main:v1
```

Check the repository name, tag, account permissions, and repository visibility.

### Kubernetes pod is pending or restarting

```powershell
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
kubectl get events --sort-by=.lastTimestamp
```

## 16. Cleanup and security

Stop and remove the application container:

```powershell
docker stop docker-testapp-main
docker rm docker-testapp-main
```

The following command deletes MongoDB data and should only be used when data
loss is intentional:

```powershell
docker compose -f .\mongodb-volume.yaml down -v
```

Use a unique strong local MongoDB password and do not commit it. Use Docker
Secrets, Kubernetes Secrets, or an external secret manager in real deployments,
and back up the MongoDB volume before destructive maintenance.

## 17. Extended runbook

See [SOP.md](SOP.md) for the longer operational procedure and additional
deployment notes.