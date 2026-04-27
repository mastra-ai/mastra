import { describe, expect, it } from 'vitest';

import { API_COMMANDS } from './commands.js';
import { parseInput, resolvePathParams, stripPathParamsFromInput } from './input.js';

describe('parseInput', () => {
  it('returns undefined for commands that do not accept JSON input', () => {
    expect(parseInput(API_COMMANDS.agentGet, '{"ignored":true}')).toBeUndefined();
  });

  it('allows optional input to be omitted', () => {
    expect(parseInput(API_COMMANDS.agentList)).toBeUndefined();
  });

  it('requires input for mutating commands', () => {
    expect(catchError(() => parseInput(API_COMMANDS.agentRun))).toMatchObject({
      code: 'MISSING_INPUT',
      message: 'Command requires a single inline JSON input argument',
    });
  });

  it('rejects invalid and non-object JSON input', () => {
    expect(catchError(() => parseInput(API_COMMANDS.agentRun, '{'))).toMatchObject({ code: 'INVALID_JSON' });
    expect(catchError(() => parseInput(API_COMMANDS.agentRun, '[]'))).toMatchObject({ code: 'INVALID_JSON' });
    expect(catchError(() => parseInput(API_COMMANDS.agentRun, 'null'))).toMatchObject({ code: 'INVALID_JSON' });
  });

  it('parses object JSON input', () => {
    expect(parseInput(API_COMMANDS.agentRun, '{"messages":"hello"}')).toEqual({ messages: 'hello' });
  });
});

describe('resolvePathParams', () => {
  it('uses positional values for path parameters', () => {
    expect(resolvePathParams(API_COMMANDS.workflowRunGet, ['wf-1', 'run-1'])).toEqual({
      workflowId: 'wf-1',
      runId: 'run-1',
    });
  });

  it('uses JSON input for path params intentionally omitted from positionals', () => {
    expect(resolvePathParams(API_COMMANDS.memoryCurrentGet, [], { threadId: 'thread-1', agentId: 'agent-1' })).toEqual({
      threadId: 'thread-1',
    });
  });

  it('fails when required path params are missing', () => {
    expect(
      catchError(() => resolvePathParams(API_COMMANDS.memoryCurrentGet, [], { agentId: 'agent-1' })),
    ).toMatchObject({
      code: 'MISSING_ARGUMENT',
      details: { argument: 'threadId' },
    });
  });
});

describe('stripPathParamsFromInput', () => {
  it('removes path params from JSON input before sending the request body or query', () => {
    expect(stripPathParamsFromInput({ threadId: 'thread-1', agentId: 'agent-1' }, { threadId: 'thread-1' })).toEqual({
      agentId: 'agent-1',
    });
  });
});

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}
