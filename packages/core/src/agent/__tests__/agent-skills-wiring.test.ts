/**
 * Integration test: agent-level skills wiring.
 *
 * Verifies the full path from Agent config → getSkillsProcessors → SkillsProcessor
 * construction → skill tool registration for:
 *   1. Inline-only agents (no workspace)
 *   2. Agents with both inline skills and workspace skills (merge path)
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defineSkill } from '../../skills/define-skill';
import type { Skill, SkillMetadata, WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import { Agent } from '../index';

// =============================================================================
// Helpers
// =============================================================================

const mockWorkspaceSkill: Skill = {
  name: 'ws-skill',
  description: 'A workspace skill',
  instructions: '# Workspace Skill\n\nDo workspace things.',
  path: '/skills/ws-skill',
  source: { type: 'local', projectPath: '/skills/ws-skill' },
  references: [],
  scripts: [],
  assets: [],
};

const mockWorkspaceSkillMeta: SkillMetadata = {
  name: mockWorkspaceSkill.name,
  path: mockWorkspaceSkill.path,
  description: mockWorkspaceSkill.description,
};

function createMockWorkspaceSkills(): WorkspaceSkills {
  const skills = new Map<string, Skill>([[mockWorkspaceSkill.path, mockWorkspaceSkill]]);

  return {
    list: vi.fn().mockResolvedValue([mockWorkspaceSkillMeta]),
    get: vi.fn().mockImplementation((path: string) => Promise.resolve(skills.get(path) || null)),
    has: vi.fn().mockImplementation((path: string) => Promise.resolve(skills.has(path))),
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

function getToolNames(tools: unknown): string[] {
  if (!tools) return [];
  if (Array.isArray(tools)) return tools.map((t: any) => t.name).filter(Boolean);
  if (typeof tools === 'object') return Object.keys(tools);
  return [];
}

function getSystemMessages(prompt: unknown): string[] {
  if (!Array.isArray(prompt)) return [];
  return prompt
    .filter((m: any) => m.role === 'system')
    .map((m: any) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)));
}

// =============================================================================
// Tests
// =============================================================================

describe('Agent-level skills wiring', () => {
  let mockModel: MockLanguageModelV2;
  let capturedTools: unknown;
  let capturedPrompt: unknown;

  beforeEach(() => {
    capturedTools = undefined;
    capturedPrompt = undefined;

    mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt, tools }) => {
        capturedTools = tools;
        capturedPrompt = prompt;
        return {
          content: [{ type: 'text', text: 'ok' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async ({ prompt, tools }) => {
        capturedTools = tools;
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't1' },
            { type: 'text-delta', id: 't1', delta: 'ok' },
            { type: 'text-end', id: 't1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
    });
  });

  describe('inline-only agent (no workspace)', () => {
    it('should register skill tools and inject skill metadata into prompt', async () => {
      const agent = new Agent({
        id: 'inline-only',
        instructions: 'You are an agent with inline skills.',
        model: mockModel,
        skills: [
          defineSkill({
            name: 'code-review',
            description: 'Reviews code for quality.',
            instructions: '# Code Review\n\nCheck for bugs.',
          }),
        ],
      });

      await agent.generate('Hello');

      // Skill tools should be registered
      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill');

      // Skill metadata should be injected into system messages
      const systemMsgs = getSystemMessages(capturedPrompt);
      const allSystem = systemMsgs.join('\n');
      expect(allSystem).toContain('code-review');
      expect(allSystem).toContain('available_skills');
    });

    it('should work with stream() as well', async () => {
      const agent = new Agent({
        id: 'inline-only-stream',
        instructions: 'You are an agent.',
        model: mockModel,
        skills: [
          defineSkill({
            name: 'testing',
            description: 'Runs tests.',
            instructions: 'Run the test suite.',
          }),
        ],
      });

      const result = await agent.stream('Run tests');
      // Consume the stream
      for await (const _chunk of result.textStream) {
        // drain
      }

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill');

      const systemMsgs = getSystemMessages(capturedPrompt);
      const allSystem = systemMsgs.join('\n');
      expect(allSystem).toContain('testing');
    });
  });

  describe('agent with both inline skills and workspace', () => {
    it('should merge skills and register tools from both sources', async () => {
      const agent = new Agent({
        id: 'merged-skills',
        instructions: 'You have both inline and workspace skills.',
        model: mockModel,
        workspace: createMockWorkspace(),
        skills: [
          defineSkill({
            name: 'deploy',
            description: 'Deploys the app.',
            instructions: 'Run the deploy script.',
          }),
        ],
      });

      await agent.generate('Deploy the app');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill');

      // Both inline and workspace skill metadata should appear
      const systemMsgs = getSystemMessages(capturedPrompt);
      const allSystem = systemMsgs.join('\n');
      expect(allSystem).toContain('deploy');
      expect(allSystem).toContain('ws-skill');
    });

    it('agent-level skill wins on name conflict', async () => {
      // Create workspace skill with same name as inline skill
      const conflictSkill: Skill = {
        name: 'shared-name',
        description: 'workspace version',
        instructions: 'workspace instructions',
        path: '/skills/shared-name',
        source: { type: 'local', projectPath: '/skills/shared-name' },
        references: [],
        scripts: [],
        assets: [],
      };
      const conflictMeta: SkillMetadata = {
        name: 'shared-name',
        path: conflictSkill.path,
        description: 'workspace version',
      };
      const wsSkills: WorkspaceSkills = {
        list: vi.fn().mockResolvedValue([conflictMeta]),
        get: vi
          .fn()
          .mockImplementation((p: string) => Promise.resolve(p === conflictSkill.path ? conflictSkill : null)),
        has: vi.fn().mockResolvedValue(true),
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

      const agent = new Agent({
        id: 'conflict-agent',
        instructions: 'Test conflict resolution.',
        model: mockModel,
        workspace: {
          skills: wsSkills,
          getToolsConfig: () => undefined,
          filesystem: undefined,
          sandbox: undefined,
        } as unknown as Workspace,
        skills: [
          defineSkill({
            name: 'shared-name',
            description: 'inline version wins',
            instructions: 'inline instructions',
          }),
        ],
      });

      // Use listSkills to check merge result
      const skillsList = await agent.listSkills();
      const sharedSkill = skillsList.find(s => s.name === 'shared-name');
      expect(sharedSkill).toBeDefined();
      expect(sharedSkill!.description).toBe('inline version wins');
    });
  });
});
