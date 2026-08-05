#!/usr/bin/env node
import { listScenarios } from './e2e/tui/index.js';

for (const scenario of listScenarios()) {
  process.stdout.write(`${scenario.name}\t${scenario.description}\n`);
}
