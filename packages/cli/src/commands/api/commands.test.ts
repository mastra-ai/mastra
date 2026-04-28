import { describe, expect, it } from 'vitest';

import { API_COMMANDS } from './commands.js';

describe('API_COMMANDS', () => {
  it('derives HTTP route facts from generated route metadata', () => {
    expect(API_COMMANDS.agentList).toMatchObject({
      method: 'GET',
      path: '/agents',
      responseShape: { kind: 'record' },
      list: true,
    });

    expect(API_COMMANDS.agentRun).toMatchObject({
      method: 'POST',
      path: '/agents/:agentId/generate',
      positionals: ['agentId'],
      acceptsInput: true,
      inputRequired: true,
    });
  });

  it('keeps CLI-only positional overrides that cannot be inferred from server routes', () => {
    expect(API_COMMANDS.workflowRunResume).toMatchObject({
      path: '/workflows/:workflowId/resume-async',
      positionals: ['workflowId', 'runId'],
      inputRequired: true,
    });
  });

  it('uses route path params directly for MCP server details', () => {
    expect(API_COMMANDS.mcpGet).toMatchObject({
      path: '/mcp/v0/servers/:id',
      positionals: ['id'],
    });
  });

  it('supports JSON-identity commands by omitting selected path params from positionals', () => {
    expect(API_COMMANDS.memoryCurrentGet).toMatchObject({
      path: '/memory/threads/:threadId/working-memory',
      positionals: [],
      acceptsInput: true,
      inputRequired: true,
    });
  });

  it('requires JSON input for memory status because agentId is a required query parameter', () => {
    expect(API_COMMANDS.memoryStatus).toMatchObject({
      path: '/memory/status',
      acceptsInput: true,
      inputRequired: true,
    });
  });

  it('uses the observability logs route for log list', () => {
    expect(API_COMMANDS.logList).toMatchObject({
      path: '/observability/logs',
      acceptsInput: true,
      inputRequired: false,
      list: true,
      responseShape: { kind: 'object-property', listProperty: 'logs', paginationProperty: 'pagination' },
    });
  });

  it('uses observability score routes for score commands', () => {
    expect(API_COMMANDS.scoreCreate).toMatchObject({ path: '/observability/scores', method: 'POST' });
    expect(API_COMMANDS.scoreList).toMatchObject({
      path: '/observability/scores',
      method: 'GET',
      list: true,
      responseShape: { kind: 'object-property', listProperty: 'scores', paginationProperty: 'pagination' },
    });
    expect(API_COMMANDS.scoreGet).toMatchObject({ path: '/observability/scores/:scoreId', method: 'GET' });
  });
});
