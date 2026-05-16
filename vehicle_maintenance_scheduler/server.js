'use strict';

const express = require('express');
const { fetchDepots, fetchVehicles } = require('./fetchData');
const { scheduleDepotMaintenance } = require('./scheduler');
const { safeLog } = require('../logging_middleware/logger');

const PORT = Number(process.env.PORT || 3001);
const app = express();

app.use(express.json({ limit: '64kb' }));

app.get('/health', (request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'vehicle-maintenance-scheduler'
  });
});

app.get('/api/v1/maintenance-schedules', async (request, response) => {
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

    response.status(200).json({
      data: schedules,
      meta: {
        depotCount: schedules.length,
        taskCount: vehicles.length,
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  } catch (error) {
    await safeLog('backend', 'error', 'handler', `Maintenance schedule request failed: ${error.message}`);

    response.status(500).json({
      error: {
        code: 'MAINTENANCE_SCHEDULE_FAILED',
        message: error.message
      },
      meta: {
        responseTimeMs: Date.now() - requestStartedAt
      }
    });
  }
});

app.use((request, response) => {
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found.'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Vehicle maintenance scheduler API listening on http://localhost:${PORT}`);
});
