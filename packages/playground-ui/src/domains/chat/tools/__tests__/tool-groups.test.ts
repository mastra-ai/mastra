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
  describe('when consecutive plain calls only draw', () => {
    it('folds three plain calls under the first one', () => {
      expect(groupKeys([call('a'), call('b'), call('c')])).toEqual({ firsts: ['a'], members: ['b', 'c'] });
    });

    it('lets a step marker sit inside the run', () => {
      expect(groupKeys([call('a'), { type: 'step-start' }, call('b'), call('c')])).toEqual({
        firsts: ['a'],
        members: ['b', 'c'],
      });
    });
  });

  describe('when a part the reader sees sits inside the run', () => {
    it('breaks the run on a signal badge', () => {
      const signal: MessageFactoryPart = {
        type: 'data-signal',
        data: { type: 'state', contents: 'paused' },
      } as never;
      expect(groupKeys([call('a'), call('b'), signal, call('c'), call('d')])).toEqual({ firsts: [], members: [] });
    });
  });

  describe('when a call waits on the reader', () => {
    it('keeps a suspended call out of the fold', () => {
      const suspended = { metadata: { suspendedTools: { b: { suspendPayload: {} } } } };
      expect(groupKeys([call('a'), call('b'), call('c'), call('d')], suspended)).toEqual({ firsts: [], members: [] });
    });

    it('keeps a question out of the fold', () => {
      expect(groupKeys([call('a'), call('b', 'ask_user'), call('c'), call('d')])).toEqual({ firsts: [], members: [] });
    });

    it('keeps an app result out of the fold', () => {
      expect(groupKeys([call('a'), call('b', 'app'), call('c'), call('d')], { mcpAppTools: { app: {} } })).toEqual({
        firsts: [],
        members: [],
      });
    });
  });

  describe('when a streamed part has no call id', () => {
    it('never folds it', () => {
      const anonymous: MessageFactoryPart = { type: 'dynamic-tool', toolName: 'view' };
      expect(groupKeys([anonymous, anonymous, anonymous])).toEqual({ firsts: [], members: [] });
    });
  });
});
