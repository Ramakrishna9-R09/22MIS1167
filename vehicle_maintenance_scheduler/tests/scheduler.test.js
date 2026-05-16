'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { scheduleDepotMaintenance } = require('../scheduler');

test('selects the highest impact task combination within depot budget', () => {
  const maintenanceTasks = [
    { TaskID: 'brake-service', Duration: 2, Impact: 6 },
    { TaskID: 'engine-overhaul', Duration: 4, Impact: 12 },
    { TaskID: 'tyre-alignment', Duration: 3, Impact: 10 },
    { TaskID: 'mirror-repair', Duration: 1, Impact: 2 }
  ];

  const schedule = scheduleDepotMaintenance(maintenanceTasks, 5);

  assert.deepEqual(schedule.selectedTaskIds, ['brake-service', 'tyre-alignment']);
  assert.equal(schedule.totalDuration, 5);
  assert.equal(schedule.totalImpact, 16);
});

test('returns an empty schedule when the mechanic budget is zero', () => {
  const maintenanceTasks = [
    { TaskID: 'battery-check', Duration: 1, Impact: 5 },
    { TaskID: 'coolant-flush', Duration: 2, Impact: 7 }
  ];

  const schedule = scheduleDepotMaintenance(maintenanceTasks, 0);

  assert.deepEqual(schedule.selectedTaskIds, []);
  assert.equal(schedule.totalDuration, 0);
  assert.equal(schedule.totalImpact, 0);
});

test('rejects invalid maintenance task values before building the DP table', () => {
  assert.throws(
    () => scheduleDepotMaintenance([{ TaskID: 'invalid-duration', Duration: 0, Impact: 5 }], 4),
    /unsupported values/
  );
});
