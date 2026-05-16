'use strict';

// Bottom-up 0/1 knapsack runs in O(n * W) time and O(n * W) space, where n is the number of tasks and W is the mechanic-hour budget.

function normaliseTask(rawTask) {
  const taskId = rawTask.TaskID;
  const serviceDuration = Number(rawTask.Duration);
  const operationalImpact = Number(rawTask.Impact);

  if (!taskId || !Number.isInteger(serviceDuration) || !Number.isFinite(operationalImpact)) {
    throw new Error(`Invalid maintenance task received: ${JSON.stringify(rawTask)}`);
  }

  if (serviceDuration <= 0 || operationalImpact < 0) {
    throw new Error(`Maintenance task has unsupported values: ${JSON.stringify(rawTask)}`);
  }

  return {
    taskId,
    serviceDuration,
    operationalImpact
  };
}

function scheduleDepotMaintenance(rawTasks, mechanicHourBudget) {
  const depotBudget = Number(mechanicHourBudget);

  if (!Number.isInteger(depotBudget) || depotBudget < 0) {
    throw new Error(`MechanicHours must be a non-negative integer. Received ${mechanicHourBudget}`);
  }

  const maintenanceTasks = rawTasks.map(normaliseTask);
  const taskCount = maintenanceTasks.length;
  const impactTable = Array.from({ length: taskCount + 1 }, () => Array(depotBudget + 1).fill(0));

  for (let taskIndex = 1; taskIndex <= taskCount; taskIndex += 1) {
    const currentTask = maintenanceTasks[taskIndex - 1];

    for (let availableHours = 0; availableHours <= depotBudget; availableHours += 1) {
      const impactWithoutTask = impactTable[taskIndex - 1][availableHours];

      if (currentTask.serviceDuration > availableHours) {
        impactTable[taskIndex][availableHours] = impactWithoutTask;
        continue;
      }

      const impactWithTask =
        impactTable[taskIndex - 1][availableHours - currentTask.serviceDuration] +
        currentTask.operationalImpact;

      impactTable[taskIndex][availableHours] = Math.max(impactWithoutTask, impactWithTask);
    }
  }

  const selectedTasks = recoverSelectedTasks(maintenanceTasks, impactTable, depotBudget);
  const totalDuration = selectedTasks.reduce(
    (durationSum, maintenanceTask) => durationSum + maintenanceTask.serviceDuration,
    0
  );

  return {
    selectedTaskIds: selectedTasks.map((maintenanceTask) => maintenanceTask.taskId),
    totalDuration,
    totalImpact: impactTable[taskCount][depotBudget]
  };
}

function recoverSelectedTasks(maintenanceTasks, impactTable, depotBudget) {
  const selectedTasks = [];
  let remainingHours = depotBudget;

  for (let taskIndex = maintenanceTasks.length; taskIndex > 0; taskIndex -= 1) {
    const currentImpact = impactTable[taskIndex][remainingHours];
    const previousImpact = impactTable[taskIndex - 1][remainingHours];

    if (currentImpact === previousImpact) {
      continue;
    }

    const selectedTask = maintenanceTasks[taskIndex - 1];
    selectedTasks.push(selectedTask);
    remainingHours -= selectedTask.serviceDuration;
  }

  return selectedTasks.reverse();
}

module.exports = {
  scheduleDepotMaintenance
};
