# Docker TestApp Main Runbook

This runbook documents the verified troubleshooting and working procedure for the project in this directory.

## Project directory

```powershell
Set-Location "C:\path\to\docker-testapp-main"
```

---

## 1. Validate project files

```powershell
Get-ChildItem
```

Expected files include:
- server.js
- package.json
- Dockerfile
- mongodb-healthcheck.yaml
- public/
- app-users/

---

## 2. Check Node.js and npm

```powershell
node --version
npm.cmd --version
```

If `npm` is blocked in PowerShell, use:

```powershell
npm.cmd --version
```

---

## 3. Check project dependencies

```powershell
Test-Path .\node_modules\express
Test-Path .\node_modules\mongodb
```

If missing, install dependencies:

```powershell
npm.cmd install
```

---

## 4. Validate the server syntax

```powershell
node --check .\server.js
```

Verified result:

```text
server.js syntax OK
```

---

## 5. Start the app

```powershell
node .\server.js
```

The app listens on port 5050.

Open in browser:

```text
http://localhost:5050
```

---

## 6. Handle port conflict (`EADDRINUSE`)

If this error appears:

```text
Error: listen EADDRINUSE: address already in use :::5050
```

Check which process is using port 5050:

```powershell
```

Inspect the process:

```powershell
$connection = Get-NetTCPConnection -LocalPort -State Listen
Get-Process -Id $connection.OwningProcess
```

Stop it:

```powershell
$connection = Get-NetTCPConnection -LocalPort 5050 -State Listen
Stop-Process -Id $connection.OwningProcess -Force
```

Then start the app again:

```powershell
node .\server.js
```

---

## 7. Check server health

```powershell
Invoke-WebRequest http://localhost:5050 -UseBasicParsing
```

Verified result during troubleshooting:

```text
HTTP 200
```

---

## 8. Check MongoDB availability

Without MongoDB authentication, the app default is `mongodb://localhost:27017`. The Compose files enable authentication. When using them with a separately started Node process, provide `MONGO_ROOT_USERNAME` and `MONGO_ROOT_PASSWORD` to that process or set `MONGO_URL` through a local secret manager. Compose `.env` is not automatically exported to Node.js.

Verify the port is live:

```powershell
Test-NetConnection localhost -Port 27017
```

If MongoDB is not available, the app will time out on database requests.

Docker check:

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```

If using Kubernetes manifests, check:

```powershell
kubectl apply -f .\mongodb-healthcheck.yaml
kubectl get pods
kubectl get services
```

---

## 9. Test the database endpoint

```powershell
Invoke-WebRequest http://localhost:5050/getUsers -UseBasicParsing -TimeoutSec 5
```

If MongoDB is not running, this may fail with a timeout.

---

## 10. Remove temporary Code Runner files

The editor can generate files like these:
- tempCodeRunnerFile.js
- app-users\tempCodeRunnerFile.js

Check for them:

```powershell
Get-ChildItem -Name *tempCodeRunnerFile.js,app-users\*tempCodeRunnerFile.js -ErrorAction SilentlyContinue
```

Delete them if present:

```powershell
Remove-Item .\tempCodeRunnerFile.js -Force -ErrorAction SilentlyContinue
Remove-Item .\app-users\tempCodeRunnerFile.js -Force -ErrorAction SilentlyContinue
```

Validate the cleanup:

```powershell
node --check .\server.js
if ((Test-Path .\tempCodeRunnerFile.js) -or (Test-Path .\app-users\tempCodeRunnerFile.js)) {
    throw "Temporary Code Runner file still exists"
}
Write-Output "server.js syntax OK"
Write-Output "Temporary Code Runner files removed"
```

Verified result:

```text
server.js syntax OK
Temporary Code Runner files removed
```

---

## 11. Daily quick start workflow

Use this as the fastest repeatable startup flow for daily work:

```powershell
Set-Location "C:\path\to\docker-testapp-main"
node --check .\server.js
node .\server.js
```

Then verify the app and database are available:

```powershell
Invoke-WebRequest http://localhost:5050 -UseBasicParsing
Test-NetConnection localhost -Port 27017
Invoke-WebRequest "http://localhost:5050/getUsers?db=college" -UseBasicParsing
Invoke-WebRequest "http://localhost:5050/getUsers?db=healthcheck" -UseBasicParsing
```

If port 5050 is already occupied:

```powershell
Get-NetTCPConnection -LocalPort 5050 -State Listen
$connection = Get-NetTCPConnection -LocalPort 5050 -State Listen
Stop-Process -Id $connection.OwningProcess -Force
```

If MongoDB is not running:

```powershell
kubectl apply -f .\mongodb-healthcheck.yaml
kubectl get pods
kubectl get services
```

---

## 12. Multi-database app workflow

The modified app supports multiple DB targets instead of one hardcoded database.

Example backend logic:

```javascript
const DEFAULT_DB = "healthcheck";

const DATABASES = {
    college: { db: "apnacollege-db", collection: "users" },
    healthcheck: { db: "mongodb-healthcheck", collection: "sharadafamily" },
};
```

Read route:

```javascript
app.get("/getUsers", async (req, res) => {
    const key = req.query.db || DEFAULT_DB;
    const target = DATABASES[key];

    await client.connect();
    const db = client.db(target.db);
    const data = await db.collection(target.collection).find({}).toArray();
    res.json(data);
});
```

Insert route:

```javascript
app.post("/addUser", async (req, res) => {
    const { db: key = DEFAULT_DB, ...userObj } = req.body;
    const target = DATABASES[key];

    await client.connect();
    const db = client.db(target.db);
    const data = await db.collection(target.collection).insertOne(userObj);
    res.status(201).json({ insertedId: data.insertedId });
});
```

Frontend usage:

```html
<select id="dbSelect">
  <option value="college">college</option>
  <option value="healthcheck">healthcheck</option>
</select>
```

This lets the UI send requests to the selected database/collection.

---

## 13. Root cause summary

The project had two main issues during troubleshooting:

1. Port 5050 was already occupied by a running Node process.
2. MongoDB was not running on port 27017.

A third noise factor was temporary Code Runner files, which looked like active project files but were not the real application entry point.

---

## 13. Final status

The project is working as expected once:
- the correct server instance is running on port 5050
- MongoDB is available on port 27017
- temporary editor-generated files are removed

This runbook reflects the verified steps completed in this project directory.
