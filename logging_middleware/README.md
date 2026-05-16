# Logging Middleware

Reusable backend logging client for the test server.

## Usage

```js
const { Log } = require('./logger');

await Log('backend', 'info', 'service', 'Maintenance schedule generated.');
```

The logger reads authentication from `AUTHORIZATION_HEADER` or `EVALUATION_API_TOKEN`.
