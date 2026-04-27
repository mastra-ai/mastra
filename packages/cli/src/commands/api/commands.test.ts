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

  it('supports JSON-identity commands by omitting selected path params from positionals', () => {
    expect(API_COMMANDS.memoryCurrentGet).toMatchObject({
      path: '/memory/threads/:threadId/working-memory',
      positionals: [],
      acceptsInput: true,
      inputRequired: true,
    });
  });
});
