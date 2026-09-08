import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react';
import { describe, expect, it } from 'vitest';

import { collectToolGroups } from '../tool-groups';

const call = (toolCallId: string, toolName = 'view'): ToolInvocationPart =>
  ({
    type: 'tool-invocation',
    toolInvocation: { toolName, toolCallId, state: 'result', args: {}, result: {} },
  }) as never;

const groupKeys = (parts: MessageFactoryPart[], context = {}) => {
  const { byFirstKey, memberKeys } = collectToolGroups(parts, context);
  return { firsts: [...byFirstKey.keys()], members: [...memberKeys] };
};

describe('collectToolGroups', () => {
  it('folds three plain calls under the first one', () => {
    expect(groupKeys([call('a'), call('b'), call('c')])).toEqual({ firsts: ['a'], members: ['b', 'c'] });
  });

  it('lets a step marker sit inside the run', () => {
    expect(groupKeys([call('a'), { type: 'step-start' }, call('b'), call('c')])).toEqual({
      firsts: ['a'],
      members: ['b', 'c'],
    });
  });

  it('breaks the run on a signal badge the reader sees', () => {
    const signal: MessageFactoryPart = {
      type: 'data-signal',
      data: { type: 'state', contents: 'paused' },
    } as never;
    expect(groupKeys([call('a'), call('b'), signal, call('c'), call('d')])).toEqual({ firsts: [], members: [] });
  });

  it('keeps a suspended call out of the fold', () => {
    const suspended = { metadata: { suspendedTools: { b: { suspendPayload: {} } } } };
    expect(groupKeys([call('a'), call('b'), call('c'), call('d')], suspended)).toEqual({ firsts: [], members: [] });
  });

  it('keeps a call the reader answers, or an app result, out of the fold', () => {
    expect(groupKeys([call('a'), call('b', 'ask_user'), call('c'), call('d')])).toEqual({ firsts: [], members: [] });
    expect(groupKeys([call('a'), call('b', 'app'), call('c'), call('d')], { mcpAppTools: { app: {} } })).toEqual({
      firsts: [],
      members: [],
    });
  });

  it('never folds a streamed part that has no call id to fold under', () => {
    const anonymous: MessageFactoryPart = { type: 'dynamic-tool', toolName: 'view' };
    expect(groupKeys([anonymous, anonymous, anonymous])).toEqual({ firsts: [], members: [] });
  });
});
