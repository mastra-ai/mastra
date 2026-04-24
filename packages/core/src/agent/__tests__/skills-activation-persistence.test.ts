/**
 * Tests for stateless skill tool behavior across turns.
 *
 * The `skill` tool (formerly `skill-activate`) is now stateless:
 * - It returns full skill instructions in the tool result
 * - No activation state is tracked between turns
 * - Skill tools are wired via Agent.listSkillTools() / convertTools()
 * - <available_skills> is always injected into system messages
 * - skill-read-* tools are always available (no activation gate)
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import type { Skill, SkillMetadata, WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import { Agent } from '../index';

// =============================================================================
// Mock Helpers
// =============================================================================

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

const mockSkillMetadata: SkillMetadata = {
  name: mockSkill.name,
  description: mockSkill.description,
  path: mockSkill.path,
};

function createMockWorkspaceSkills(): WorkspaceSkills {
  const skills = new Map<string, Skill>([[mockSkill.path, mockSkill]]);

  return {
    list: vi.fn().mockResolvedValue([mockSkillMetadata]),
    get: vi
      .fn()
      .mockImplementation((identifier: string) =>
        Promise.resolve(skills.get(identifier) || [...skills.values()].find(s => s.name === identifier) || null),
      ),
    has: vi
      .fn()
      .mockImplementation((identifier: string) =>
        Promise.resolve(skills.has(identifier) || [...skills.values()].some(s => s.name === identifier)),
      ),
    refresh: vi.fn().mockResolvedValue(undefined),
    maybeRefresh: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),

    getReference: vi.fn().mockResolvedValue(null),
    getScript: vi.fn().mockResolvedValue(null),
    getAsset: vi.fn().mockResolvedValue(null),
    listReferences: vi.fn().mockResolvedValue([]),
    listScripts: vi.fn().mockResolvedValue([]),
    listAssets: vi.fn().mockResolvedValue([]),
  };
}

function createMockWorkspace(): Workspace {
  return {
    skills: createMockWorkspaceSkills(),
    getToolsConfig: () => undefined,
    filesystem: undefined,
    sandbox: undefined,
  } as unknown as Workspace;
}

function getSystemMessageContent(prompt: any[]): string {
  const systemMessages = prompt.filter((msg: any) => msg.role === 'system');
  return systemMessages
    .map((msg: any) => (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)))
    .join('\n');
}

function getToolNames(tools: any): string[] {
  if (!tools) return [];
  if (Array.isArray(tools)) return tools.map((t: any) => t.name || t.toolName || '');
  return Object.keys(tools);
}

// =============================================================================
// Tests
// =============================================================================

describe('stateless skill tool behavior', () => {
  describe('skill tool returns instructions in result', () => {
    it('should return full skill instructions when the skill tool is called', async () => {
      const capturedPrompts: any[] = [];
      let callCount = 0;

      const mockModel = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          callCount++;
          capturedPrompts.push(prompt);

          if (callCount === 1) {
            // Step 0: model calls the `skill` tool
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolCallType: 'function',
                  toolName: 'skill',
                  input: '{"name":"find-skills"}',
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          } else {
            // Step 1: model responds with text
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Got the skill instructions!' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          }
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: createMockWorkspace(),
      });

      const result = await agent.stream('Activate find-skills');
      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // The skill tool result should contain the full instructions
      const toolResultChunk = chunks.find(c => c.type === 'tool-result');
      expect(toolResultChunk).toBeDefined();
      expect(toolResultChunk.payload.toolName).toBe('skill');
      expect(toolResultChunk.payload.result).toContain(mockSkill.instructions);

      // System messages should have <available_skills> but never <activated_skills>
      expect(capturedPrompts.length).toBeGreaterThanOrEqual(2);
      const step0System = getSystemMessageContent(capturedPrompts[0]);
      expect(step0System).toContain('available_skills');
      expect(step0System).not.toContain('activated_skills');

      const step1System = getSystemMessageContent(capturedPrompts[1]);
      expect(step1System).not.toContain('activated_skills');
    });
  });

  describe('skill tools available across turns', () => {
    it('should provide the skill tool on every turn', async () => {
      const capturedToolSets: any[] = [];
      let totalCallCount = 0;

      const mockModel = new MockLanguageModelV2({
        doStream: async ({ tools }) => {
          totalCallCount++;
          capturedToolSets.push(tools);

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${totalCallCount}`,
                modelId: 'mock',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: `text-${totalCallCount}` },
              { type: 'text-delta', id: `text-${totalCallCount}`, delta: 'Done' },
              { type: 'text-end', id: `text-${totalCallCount}` },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: createMockWorkspace(),
      });

      // Turn 1
      const result1 = await agent.stream('Hello');
      for await (const _ of result1.fullStream) {
        // consume
      }

      // Turn 2
      const result2 = await agent.stream('Hello again');
      for await (const _ of result2.fullStream) {
        // consume
      }

      expect(capturedToolSets.length).toBeGreaterThanOrEqual(2);

      // Both turns should have the `skill` tool
      const turn1ToolNames = getToolNames(capturedToolSets[0]);
      const turn2ToolNames = getToolNames(capturedToolSets[1]);

      expect(turn1ToolNames).toContain('skill');
      expect(turn2ToolNames).toContain('skill');

      // Both turns should have skill_search
      expect(turn1ToolNames).toContain('skill_search');
      expect(turn2ToolNames).toContain('skill_search');

      // Both turns should have skill_read
      expect(turn1ToolNames).toContain('skill_read');
      expect(turn2ToolNames).toContain('skill_read');
    });

    it('should have <available_skills> in system messages on every turn', async () => {
      const capturedPrompts: any[] = [];
      let totalCallCount = 0;

      const mockModel = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          totalCallCount++;
          capturedPrompts.push(prompt);

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${totalCallCount}`,
                modelId: 'mock',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: `text-${totalCallCount}` },
              { type: 'text-delta', id: `text-${totalCallCount}`, delta: 'Done' },
              { type: 'text-end', id: `text-${totalCallCount}` },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: createMockWorkspace(),
      });

      // Turn 1
      const result1 = await agent.stream('Hello');
      for await (const _ of result1.fullStream) {
        // consume
      }

      // Turn 2
      const result2 = await agent.stream('Hello again');
      for await (const _ of result2.fullStream) {
        // consume
      }

      expect(capturedPrompts.length).toBeGreaterThanOrEqual(2);

      // Both turns should have <available_skills> in system messages
      const turn1System = getSystemMessageContent(capturedPrompts[0]);
      const turn2System = getSystemMessageContent(capturedPrompts[1]);

      expect(turn1System).toContain('available_skills');
      expect(turn1System).toContain('find-skills');
      expect(turn2System).toContain('available_skills');
      expect(turn2System).toContain('find-skills');

      // Neither turn should have <activated_skills> (stateless design)
      expect(turn1System).not.toContain('activated_skills');
      expect(turn2System).not.toContain('activated_skills');
    });
  });
});
