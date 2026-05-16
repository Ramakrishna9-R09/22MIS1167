'use strict';

const http = require('http');
const { URL } = require('url');
const { fetchDepots, fetchVehicles } = require('./fetchData');
const { scheduleDepotMaintenance } = require('./scheduler');
const { safeLog } = require('../logging_middleware/logger');

const PORT = Number(process.env.PORT || 3001);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function handleScheduleRequest(response) {
  const requestStartedAt = Date.now();

  try {
    await safeLog('backend', 'info', 'route', 'Received maintenance schedule request.');

    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);
    const schedules = depots.map((depot) => {
      const scheduleResult = scheduleDepotMaintenance(vehicles, depot.MechanicHours);

      return {
        depotId: depot.ID,
        budgetHours: depot.MechanicHours,
        selectedTaskIds: scheduleResult.selectedTaskIds,
        totalDurationHours: scheduleResult.totalDuration,
        totalImpact: scheduleResult.totalImpact
      };
    });

    await safeLog('backend', 'info', 'service', `Generated schedules for ${schedules.length} depots.`);

    sendJson(response, 200, {
      data: schedules,
      meta: {
        depotCount: schedules.length,
        taskCount: vehicles.length,
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  } catch (error) {
    await safeLog('backend', 'error', 'handler', `Maintenance schedule request failed: ${error.message}`);

    sendJson(response, 500, {
      error: {
        code: 'MAINTENANCE_SCHEDULE_FAILED',
        message: error.message
      },
      meta: {
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'vehicle-maintenance-scheduler'
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/v1/maintenance-schedules') {
    await handleScheduleRequest(response);
    return;
  }

  sendJson(response, 404, {
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found.'
    }
  });
});

server.listen(PORT, () => {
  console.log(`Vehicle maintenance scheduler API listening on http://localhost:${PORT}`);
});
