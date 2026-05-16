'use strict';

const { fetchDepots, fetchVehicles } = require('./fetchData');
const { scheduleDepotMaintenance } = require('./scheduler');
const { safeLog } = require('../logging_middleware/logger');

function formatTaskList(selectedTaskIds) {
  return `[${selectedTaskIds.join(', ')}]`;
}

function printDepotSchedule(depot, scheduleResult) {
  console.log(`Depot ${depot.ID} (Budget: ${depot.MechanicHours}h)`);
  console.log(`  Selected tasks: ${formatTaskList(scheduleResult.selectedTaskIds)}`);
  console.log(`  Total duration: ${scheduleResult.totalDuration}h`);
  console.log(`  Total impact: ${scheduleResult.totalImpact}`);
  console.log('---');
}

async function runVehicleScheduler() {
  const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

  await safeLog('backend', 'info', 'service', 'Fetched depot and vehicle data for CLI schedule run.');

  depots.forEach((depot) => {
    const scheduleResult = scheduleDepotMaintenance(vehicles, depot.MechanicHours);
    printDepotSchedule(depot, scheduleResult);
  });

  await safeLog('backend', 'info', 'service', 'Completed CLI maintenance schedule run.');
}

runVehicleScheduler().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
