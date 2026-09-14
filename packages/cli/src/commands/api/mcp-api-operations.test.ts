import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { test } from 'vitest';

import { MASTRA_API_OPERATIONS } from '../../../../mcp/src/server/mastra-api-operations.generated.js';
import {
  generateOperationsSource,
  isApiPrefixedCommand,
  outputPath,
} from '../../../scripts/generate-mcp-api-operations.js';
import { API_COMMANDS, registerApiCommand } from './index.js';

registerApiCommand(new Command());
const commands = Object.values(API_COMMANDS);
const operationName = (name: string) => name.replaceAll(' ', '_').replaceAll('-', '_');

test('API-prefixed routing accepts the default and explicit prefix but excludes origin routes', () => {
  assert.equal(isApiPrefixedCommand({}), true);
  assert.equal(isApiPrefixedCommand({ routePlacement: 'api-prefix' }), true);
  assert.equal(isApiPrefixedCommand({ routePlacement: 'origin' }), false);
});

test('catalog matches every API-prefixed CLI command and its routing metadata', () => {
  const serverCommands = commands.filter(isApiPrefixedCommand);
  assert.equal(serverCommands.length, 60);
  assert.deepEqual(
    MASTRA_API_OPERATIONS.map(operation => operation.name).sort(),
    serverCommands.map(command => operationName(command.name)).sort(),
  );
  assert.equal(new Set(MASTRA_API_OPERATIONS.map(operation => operation.name)).size, MASTRA_API_OPERATIONS.length);
  for (const command of serverCommands) {
    const operation = MASTRA_API_OPERATIONS.find(operation => operation.name === operationName(command.name));
    assert.ok(operation);
    assert.equal(operation.description, command.description);
    assert.equal(operation.method, command.method);
    assert.equal(operation.path, command.path);
    assert.equal('verbosePath' in operation ? operation.verbosePath : undefined, command.verbose?.path);
  }
});

test('origin-relative Factory/platform commands are excluded until requester routing supports them', () => {
  const originCommands = commands.filter(command => command.routePlacement === 'origin');
  assert.ok(originCommands.length >= 25, 'The CLI must include the Factory routes exercised by this regression test');
  const names = new Set<string>(MASTRA_API_OPERATIONS.map(operation => operation.name));
  for (const command of originCommands) {
    assert.equal(names.has(operationName(command.name)), false, command.name);
  }
});

test('generic execution is destructive and never read-only', () => {
  for (const name of [
    'agent_run',
    'workflow_run_start',
    'workflow_run_resume',
    'tool_execute',
    'mcp_tool_execute',
    'experiment_run',
  ]) {
    const operation = MASTRA_API_OPERATIONS.find(operation => operation.name === name);
    assert.ok(operation, name);
    assert.equal(operation.destructive, true, name);
    assert.equal(operation.method === 'GET', false, name);
  }
});

test('every non-GET operation is destructive and GET operations remain non-destructive', () => {
  for (const operation of MASTRA_API_OPERATIONS) {
    assert.equal(operation.destructive, operation.method !== 'GET', operation.name);
  }
});

test('checked-in catalog exactly matches formatted generator output', async () => {
  assert.equal(await readFile(outputPath, 'utf8'), await generateOperationsSource());
});
