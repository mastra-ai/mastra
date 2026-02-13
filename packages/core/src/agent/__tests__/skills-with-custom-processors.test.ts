/**
 * Tests for GitHub Issue #12612
 * Verifies that skill tools are preserved when custom inputProcessors are used.
 *
 * Two scenarios:
 * 1. inputProcessors on Agent constructor - should merge with skills
 * 2. inputProcessors on generate()/stream() options - should merge with skills
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Processor, ProcessInputArgs } from '../../processors/index';
import type { Skill, SkillMetadata, WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import { Agent } from '../index';

// =============================================================================
// Mock Helpers
// =============================================================================

// Simple passthrough processor that doesn't modify messages
// This simulates a user adding a custom processor like ModerationProcessor
class PassthroughProcessor implements Processor<'passthrough'> {
  readonly id = 'passthrough' as const;
  readonly name = 'Passthrough Processor';

  async processInput(args: ProcessInputArgs) {
    // Just return messages unchanged
    return args.messages;
  }
}

// Mock skill data
const mockSkill: Skill = {
  name: 'test-skill',
  description: 'A test skill',
  instructions: '# Test Skill\n\nThis is a test skill.',
  path: '/skills/test-skill',
  source: { type: 'local', projectPath: '/skills/test-skill' },
  references: [],
  scripts: [],
  assets: [],
};

const mockSkillMetadata: SkillMetadata = {
  name: mockSkill.name,
  description: mockSkill.description,
};

// Create mock WorkspaceSkills
function createMockWorkspaceSkills(): WorkspaceSkills {
  const skills = new Map<string, Skill>([[mockSkill.name, mockSkill]]);

  return {
    list: vi.fn().mockResolvedValue([mockSkillMetadata]),
    get: vi.fn().mockImplementation((name: string) => Promise.resolve(skills.get(name) || null)),
    has: vi.fn().mockImplementation((name: string) => Promise.resolve(skills.has(name))),
    refresh: vi.fn().mockResolvedValue(undefined),
    maybeRefresh: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getReference: vi.fn().mockResolvedValue(null),
    getScript: vi.fn().mockResolvedValue(null),
    getAsset: vi.fn().mockResolvedValue(null),
    listReferences: vi.fn().mockResolvedValue([]),
    listScripts: vi.fn().mockResolvedValue([]),
    listAssets: vi.fn().mockResolvedValue([]),
  };
}

// Create mock Workspace with skills
function createMockWorkspace(): Workspace<any, any, any> {
  return {
    skills: createMockWorkspaceSkills(),
    getToolsConfig: () => undefined,
    filesystem: undefined,
    sandbox: undefined,
  } as unknown as Workspace<any, any, any>;
}

// =============================================================================
// Tests
// =============================================================================

// Helper to extract tool names from the tools passed to the model
function getToolNames(tools: unknown): string[] {
  if (!tools) return [];
  if (Array.isArray(tools)) {
    return tools.map((t: any) => t.name).filter(Boolean);
  }
  if (typeof tools === 'object') {
    return Object.keys(tools);
  }
  return [];
}

describe('Skills with Custom Processors (Issue #12612)', () => {
  let mockModel: MockLanguageModelV2;
  let mockWorkspace: Workspace<any, any, any>;
  let capturedTools: unknown;

  beforeEach(() => {
    capturedTools = undefined;

    mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt, tools }) => {
        // Capture the tools that were passed to the model
        capturedTools = tools;

        return {
          content: [{ type: 'text', text: 'response' }],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async ({ prompt, tools }) => {
        // Capture the tools that were passed to the model
        capturedTools = tools;

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
        };
      },
    });

    mockWorkspace = createMockWorkspace();
  });

  describe('Scenario 1: inputProcessors on Agent constructor', () => {
    it('should include skill tools when custom processor is on Agent constructor', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [new PassthroughProcessor()],
      });

      await agent.generate('Hello');

      // Verify that skill tools are available
      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill-activate');
      expect(toolNames).toContain('skill-search');
    });

    it('should include skill tools when using stream() with custom processor on Agent constructor', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [new PassthroughProcessor()],
      });

      const result = await agent.stream('Hello');
      // Consume the stream to trigger processing
      for await (const _ of result.fullStream) {
        // Just consume
      }

      // Verify that skill tools are available
      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill-activate');
      expect(toolNames).toContain('skill-search');
    });
  });

  describe('Scenario 2: inputProcessors on generate()/stream() options', () => {
    it('should include skill tools when custom processor is passed to generate() options', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
      });

      await agent.generate('Hello', {
        inputProcessors: [new PassthroughProcessor()],
      });

      // Verify that skill tools are available
      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill-activate');
      expect(toolNames).toContain('skill-search');
    });

    it('should include skill tools when custom processor is passed to stream() options', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
      });

      const result = await agent.stream('Hello', {
        inputProcessors: [new PassthroughProcessor()],
      });
      // Consume the stream to trigger processing
      for await (const _ of result.fullStream) {
        // Just consume
      }

      // Verify that skill tools are available
      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill-activate');
      expect(toolNames).toContain('skill-search');
    });
  });

  describe('Baseline: Agent with workspace but no custom processors', () => {
    it('should include skill tools by default', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
      });

      await agent.generate('Hello');

      // Verify that skill tools are available
      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill-activate');
      expect(toolNames).toContain('skill-search');
    });
  });
});
