#!/usr/bin/env node
import { listScenarios } from './mc-e2e/scenarios/index.js';

for (const scenario of listScenarios()) {
  process.stdout.write(`${scenario.name}\t${scenario.description}\n`);
}
