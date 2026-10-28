/**
 * Ported from validation harness case T41 (working-memory), source 23f640a.
 * Real Memory + LibSQL exercise profile injection, thread/resource scope and
 * hiding updateWorkingMemory from recalled history. Restart: COR-1449.
 */
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { createRecordingModel, textOnlyTape, toolCallTape } from '../../../core/src/loop/test-utils/aimock/parity';

const PROFILE_1 = '# Profile\n- name: Ada\n- pref: WM_DARK_MODE';
const PROFILE_2 = '# Profile\n- name: Ada\n- pref: WM_LIGHT_MODE';

describe.each(['plain', 'durable', 'evented'] as const)('working-memory parity [%s]', engine => {
  it.each(['template', 'resource', 'update'] as const)(
    '%s: persisted profiles reach later prompts without visible memory tools',
    async variant => {
      const storage = new LibSQLStore({ id: `t41-${engine}-${variant}`, url: ':memory:' });
      const memory = new Memory({
        storage,
        options: {
          lastMessages: 10,
          workingMemory: {
            enabled: true,
            scope: variant === 'resource' ? 'resource' : 'thread',
            template: '# Profile\n- name:\n- pref:',
          },
        },
      });
      const tapes = [
        toolCallTape('updateWorkingMemory', { memory: PROFILE_1 }, 't41-store-1'),
        textOnlyTape('stored 1'),
      ];
      if (variant === 'update') {
        tapes.push(toolCallTape('updateWorkingMemory', { memory: PROFILE_2 }, 't41-store-2'), textOnlyTape('stored 2'));
      }
      tapes.push(textOnlyTape('recalled'));
      const { model, requests } = createRecordingModel({ tapes });
      const agent = new Agent({ id: 't41-agent', name: 'T41', instructions: 'Remember the profile.', model, memory });
      const pubsub = new EventEmitterPubSub();
      const wrapper =
        engine === 'plain'
          ? undefined
          : engine === 'durable'
            ? createDurableAgent({ agent, pubsub })
            : createEventedAgent({ agent, pubsub });
      const host = new Mastra({ agents: { agent: wrapper ?? agent }, storage, logger: false });
      const cleanups: (() => void)[] = [];
      const turn = async (prompt: string, thread = 't41-thread-a') => {
        const options = { maxSteps: 3, memory: { thread, resource: 't41-resource' } };
        const wrapped = wrapper ? await wrapper.stream(prompt, options) : undefined;
        if (wrapped) cleanups.push(wrapped.cleanup);
        const output = wrapped?.output ?? (await agent.stream(prompt, options));
        const types: string[] = [];
        const calls: string[] = [];
        for await (const chunk of output.fullStream) {
          types.push(chunk.type);
          if (chunk.type === 'tool-call') calls.push(chunk.payload.toolName);
        }
        expect(types.filter(type => type === 'finish')).toHaveLength(1);
        expect(types.filter(type => ['error', 'abort', 'tripwire'].includes(type))).toEqual([]);
        return calls;
      };
      try {
        expect(await turn('store 1')).toEqual(['updateWorkingMemory']);
        if (variant === 'update') expect(await turn('store 2')).toEqual(['updateWorkingMemory']);
        await turn('what do you know?', variant === 'resource' ? 't41-thread-b' : 't41-thread-a');
        const final = variant === 'update' ? PROFILE_2 : PROFILE_1;
        expect(await memory.getWorkingMemory({ threadId: 't41-thread-a', resourceId: 't41-resource' })).toBe(final);
        if (variant === 'resource') {
          expect(await memory.getWorkingMemory({ threadId: 't41-thread-b', resourceId: 't41-resource' })).toBe(final);
        }
        const memoryStore = await storage.getStore('memory');
        const { messages } = await memoryStore!.listMessages({
          threadId: 't41-thread-a',
          resourceId: 't41-resource',
          perPage: false,
        });
        const expectedRoles =
          variant === 'resource'
            ? ['user', 'assistant']
            : variant === 'update'
              ? ['user', 'assistant', 'user', 'assistant', 'user', 'assistant']
              : ['user', 'assistant', 'user', 'assistant'];
        expect(messages.map(message => message.role)).toEqual(expectedRoles);
        expect(
          messages
            .flatMap(message => message.content.parts ?? [])
            .filter(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'updateWorkingMemory'),
        ).toEqual([]);
        expect(requests).toHaveLength(variant === 'update' ? 5 : 3);
        expect(JSON.stringify(requests[0]!.tools)).toContain('updateWorkingMemory');
        const system = requests
          .at(-1)!
          .prompt.filter(message => message.role === 'system')
          .map(message => message.content)
          .join('\n');
        expect(system).toContain(final);
        if (variant === 'update') expect(system).not.toContain('WM_DARK_MODE');
      } finally {
        await host.shutdown({ drainTimeout: 1000 });
        for (const cleanup of cleanups) cleanup();
        await storage.close();
      }
    },
    30_000,
  );
});
