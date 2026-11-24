import { describe, expect, it } from 'vitest';
import { MastraError } from '../../error';
import { deserializeToolError, getSubAgentErrorResult, serializeToolError } from './errors';

describe('getSubAgentErrorResult', () => {
  it('retains only child-thread references across tool-error serialization', () => {
    const failure = new MastraError(
      {
        id: 'AGENT_AGENT_TOOL_EXECUTION_FAILED',
        domain: 'AGENT',
        category: 'USER',
        text: 'Delegation failed',
        details: { subAgentThreadId: 'child', subAgentResourceId: 'resource', secret: 'not a result' },
      },
      new Error('private provider error'),
    );
    const wrapped = Object.assign(new Error(failure.message), { cause: failure });
    const expected = { subAgentThreadId: 'child', subAgentResourceId: 'resource' };
    expect(getSubAgentErrorResult(failure)).toEqual(expected);
    expect(getSubAgentErrorResult(wrapped)).toEqual(expected);
    const reloaded = deserializeToolError(JSON.parse(JSON.stringify(serializeToolError(wrapped))));
    expect(getSubAgentErrorResult(reloaded)).toEqual(expected);
  });

  it.each([
    undefined,
    new Error('ordinary failure'),
    { code: 'OTHER_ERROR', details: { subAgentThreadId: 'child' } },
    { code: 'AGENT_AGENT_TOOL_EXECUTION_FAILED', details: { subAgentThreadId: 42 } },
  ])('does not invent transcript references for %j', error => {
    expect(getSubAgentErrorResult(error)).toBeUndefined();
  });

  it('handles cyclic causes', () => {
    const error = new Error('cycle');
    error.cause = error;
    expect(getSubAgentErrorResult(error)).toBeUndefined();
  });
});
