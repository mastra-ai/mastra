import { describe, expect, it } from 'vitest';
import { API_COMMANDS } from './commands.js';
import { parseInput, resolvePathParams, stripPathParamsFromInput } from './input.js';

describe('parseInput', () => {
  it('ignores input for commands without JSON input and allows omitted optional input', () => {
    expect(parseInput(API_COMMANDS.agentGet, '{"ignored":true}')).toBeUndefined();
    expect(parseInput(API_COMMANDS.agentList)).toBeUndefined();
  });

  it('requires inline JSON input when the descriptor requires it', () => {
    expect(() => parseInput(API_COMMANDS.agentRun)).toThrow(
      expect.objectContaining({
        code: 'MISSING_INPUT',
        message: 'Command requires a single inline JSON input argument',
        details: { command: 'mastra api agent run' },
      }),
    );
  });

  it('only accepts object JSON input', () => {
    expect(parseInput(API_COMMANDS.agentRun, '{"messages":"hello"}')).toEqual({ messages: 'hello' });

    for (const value of ['{', '[]', 'null']) {
      expect(() => parseInput(API_COMMANDS.agentRun, value)).toThrow(expect.objectContaining({ code: 'INVALID_JSON' }));
    }
  });
});

describe('resolvePathParams', () => {
  it('resolves path params from positionals and JSON identity input', () => {
    expect(resolvePathParams(API_COMMANDS.workflowRunGet, ['wf-1', 'run-1'])).toEqual({
      workflowId: 'wf-1',
      runId: 'run-1',
    });
    expect(resolvePathParams(API_COMMANDS.memoryCurrentGet, [], { threadId: 'thread-1', agentId: 'agent-1' })).toEqual({
      threadId: 'thread-1',
    });
  });

  it('fails when required path params are missing', () => {
    expect(() => resolvePathParams(API_COMMANDS.memoryCurrentGet, [], { agentId: 'agent-1' })).toThrow(
      expect.objectContaining({
        code: 'MISSING_ARGUMENT',
        details: { argument: 'threadId' },
      }),
    );
  });
});

describe('stripPathParamsFromInput', () => {
  it('removes resolved path params from JSON input before request encoding', () => {
    expect(stripPathParamsFromInput({ threadId: 'thread-1', agentId: 'agent-1' }, { threadId: 'thread-1' })).toEqual({
      agentId: 'agent-1',
    });
  });
});
