/**
 * DurableAgent: skill tools under a global requireToolApproval (#27248)
 *
 * Skill tools (`skill`, `skill_read`, `skill_search`) never require approval, even when
 * approval is enabled globally. Other tools in the same run must still be gated.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import type { Workspace } from '../../../workspace';
import type { Skill, WorkspaceSkills } from '../../../workspace/skills';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { AgentStreamEvent } from '../types';

const mockSkill: Skill = {
  name: 'find-skills',
  description: 'Helps users discover and install agent skills',
  instructions: '# Find Skills\n\nUse `npx skills find <query>` to search for skills.',
  path: '/skills/find-skills',
  source: { type: 'local', projectPath: '/skills/find-skills' },
  references: [],
  scripts: [],
  assets: [],
};

function createMockWorkspace(): Workspace {
  const skills: WorkspaceSkills = {
    list: vi
      .fn()
      .mockResolvedValue([{ name: mockSkill.name, description: mockSkill.description, path: mockSkill.path }]),
    get: vi
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(id === mockSkill.path || id === mockSkill.name ? mockSkill : null),
      ),
    has: vi.fn().mockImplementation((id: string) => Promise.resolve(id === mockSkill.path || id === mockSkill.name)),
    refresh: vi.fn().mockResolvedValue(undefined),
    maybeRefresh: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    getReference: vi.fn().mockResolvedValue(null),
    getScript: vi.fn().mockResolvedValue(null),
    getAsset: vi.fn().mockResolvedValue(null),
    listReferences: vi.fn().mockResolvedValue([]),
    listScripts: vi.fn().mockResolvedValue([]),
    listAssets: vi.fn().mockResolvedValue([]),
  } as unknown as WorkspaceSkills;

  return { skills, getToolsConfig: () => undefined, filesystem: undefined, sandbox: undefined } as unknown as Workspace;
}

/** Model that calls `skill` then `findUser` in one step. */
function createSkillThenToolModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-skill',
          toolName: 'skill',
          input: JSON.stringify({ name: mockSkill.name }),
          providerExecuted: false,
        },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-find',
          toolName: 'findUser',
          input: JSON.stringify({ name: 'Alice' }),
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

describe('DurableAgent skill tools under global requireToolApproval', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it.each([
    ['boolean', () => true as const],
    ['function', () => vi.fn().mockReturnValue(true)],
  ])('runs skill without approval while other tools are still gated (%s policy)', async (_label, makePolicy) => {
    const findUserExecute = vi.fn().mockResolvedValue({ name: 'Alice' });
    const findUser = createTool({
      id: 'findUser',
      description: 'Find a user by name',
      inputSchema: z.object({ name: z.string() }),
      execute: findUserExecute,
    });

    const baseAgent = new Agent({
      id: 'skill-approval-agent',
      name: 'Skill Approval Agent',
      instructions: 'test',
      model: createSkillThenToolModel() as LanguageModelV2,
      tools: { findUser },
      workspace: createMockWorkspace(),
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const policy = makePolicy();
    const prep = await durableAgent.prepare('Activate find-skills and find Alice', { requireToolApproval: policy });
    const events: AgentStreamEvent[] = [];
    pubsub.subscribe(AGENT_STREAM_TOPIC(prep.runId), event => {
      events.push(event as unknown as AgentStreamEvent);
    });

    const { cleanup } = await durableAgent.stream('Activate find-skills and find Alice', {
      runId: prep.runId,
      requireToolApproval: policy,
    });
    await vi.waitFor(
      () => {
        const data = events.filter(e => e.type === AgentStreamEventTypes.CHUNK).map(e => (e as any).data);
        expect(data.some(c => c?.type === 'tool-call-approval')).toBe(true);
        expect(data.some(c => c?.type === 'tool-result' && c.payload.toolName === 'skill')).toBe(true);
      },
      { timeout: 5000 },
    );

    const chunks = events.filter(e => e.type === AgentStreamEventTypes.CHUNK).map(e => (e as any).data);
    const approvals = chunks.filter(c => c?.type === 'tool-call-approval');
    expect(approvals.map(c => c.payload.toolName)).toEqual(['findUser']);

    const skillResult = chunks.find(c => c?.type === 'tool-result' && c.payload.toolName === 'skill');
    expect(skillResult?.payload.result).toContain(mockSkill.instructions);
    expect(findUserExecute).not.toHaveBeenCalled();

    if (typeof policy === 'function') {
      expect(policy.mock.calls.map(([ctx]: any[]) => ctx.toolName)).not.toContain('skill');
    }

    cleanup();
  });
});
