# Quick Start

Set the evaluation API token before running either backend service.

```powershell
$env:EVALUATION_API_TOKEN = "your-access-token"
```

Run the vehicle maintenance scheduler:

```powershell
cd vehicle_maintenance_scheduler
npm install
npm start
```

Call:

```text
GET http://localhost:3001/api/v1/maintenance-schedules
```

Run the notification priority inbox:

```powershell
cd notification_app_be
npm install
npm start
```

Call:

```text
GET http://localhost:3002/api/v1/priority-inbox?limit=10
```
