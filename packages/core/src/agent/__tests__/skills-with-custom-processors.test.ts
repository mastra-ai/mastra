/**
 * Tests for GitHub Issue #12612
 * Verifies that skill tools are preserved when custom inputProcessors are used.
 *
 * Two scenarios:
 * 1. inputProcessors on Agent constructor - should merge with skills
 * 2. inputProcessors on generate()/stream() options - should merge with skills
 */
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { ProcessorStepSchema } from '../../processors/index';
import type { Processor, ProcessInputArgs } from '../../processors/index';
import { SkillSearchProcessor } from '../../processors/processors/skill-search';
import { SkillsProcessor } from '../../processors/processors/skills';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows/workflow';
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

class CustomOnDemandSkillDiscoveryProcessor implements Processor<'custom-skill-discovery'> {
  readonly id = 'custom-skill-discovery' as const;
  readonly name = 'Custom Skill Discovery Processor';
  readonly providesSkillDiscovery: Processor['providesSkillDiscovery'] = 'on-demand';

  async processInput(args: ProcessInputArgs) {
    return args.messages;
  }
}

class CustomOnDemandProcessorWithStepsField implements Processor<'custom-skill-discovery-with-steps'> {
  readonly id = 'custom-skill-discovery-with-steps' as const;
  readonly name = 'Custom Skill Discovery Processor With Steps';
  readonly providesSkillDiscovery: Processor['providesSkillDiscovery'] = 'on-demand';
  readonly steps = {};

  async processInput(args: ProcessInputArgs) {
    return args.messages;
  }
}

class CollidingSkillSearchIdProcessor implements Processor<'skill-search'> {
  readonly id = 'skill-search' as const;
  readonly name = 'User Processor Named Skill Search';

  async processInput(args: ProcessInputArgs) {
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
    getReference: vi.fn().mockResolvedValue(null),
    getScript: vi.fn().mockResolvedValue(null),
    getAsset: vi.fn().mockResolvedValue(null),
    listReferences: vi.fn().mockResolvedValue([]),
    listScripts: vi.fn().mockResolvedValue([]),
    listAssets: vi.fn().mockResolvedValue([]),
  };
}

// Create mock Workspace with skills
function createMockWorkspace(): Workspace {
  return {
    skills: createMockWorkspaceSkills(),
    getToolsConfig: () => undefined,
    filesystem: undefined,
    sandbox: undefined,
  } as unknown as Workspace;
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
  let mockWorkspace: Workspace;
  let capturedTools: unknown;
  let capturedPrompt: unknown;

  beforeEach(() => {
    capturedTools = undefined;
    capturedPrompt = undefined;

    mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt, tools }) => {
        // Capture the tools that were passed to the model
        capturedTools = tools;
        capturedPrompt = prompt;

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
        capturedPrompt = prompt;

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
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
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
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
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
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
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
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
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
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
    });
  });

  describe('SkillSearchProcessor on-demand mode', () => {
    it('should avoid eager skill context and overlapping skill tools', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 })],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('To discover available skills, call search_skills');
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });

    it('should apply on-demand mode when SkillSearchProcessor is passed to generate options', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
      });

      await agent.generate('Hello', {
        inputProcessors: [new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 })],
      });

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('To discover available skills, call search_skills');
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });

    it('should apply on-demand mode when SkillSearchProcessor is passed to stream options', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
      });

      const result = await agent.stream('Hello', {
        inputProcessors: [new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 })],
      });
      for await (const _ of result.fullStream) {
        // consume the stream
      }

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('To discover available skills, call search_skills');
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });

    it('should not treat a processor-owned steps field as a workflow', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [new CustomOnDemandProcessorWithStepsField()],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });

    it('should not infer on-demand mode from a user processor id collision', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [new CollidingSkillSearchIdProcessor()],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
      expect(toolNames).toContain('skill_read');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('Skills are NOT tools');
    });

    it('should preserve skill activation tools when SkillsProcessor is explicitly configured', async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [
          new SkillsProcessor({ workspace: mockWorkspace }),
          new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 }),
        ],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('Skills are NOT tools');
      expect(prompt).toContain('To discover available skills, call search_skills');
    });

    it('should apply on-demand mode when SkillSearchProcessor is wrapped in a processor workflow', async () => {
      const skillSearchWorkflow = createWorkflow({
        id: 'skill-search-workflow',
        inputSchema: ProcessorStepSchema,
        outputSchema: ProcessorStepSchema,
        type: 'processor',
        options: { validateInputs: false },
      })
        .then(createStep(new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 })))
        .commit();

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [skillSearchWorkflow],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('To discover available skills, call search_skills');
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });

    it('should preserve on-demand discovery metadata for workflow-wrapped custom processors', async () => {
      const skillSearchWorkflow = createWorkflow({
        id: 'custom-skill-discovery-workflow',
        inputSchema: ProcessorStepSchema,
        outputSchema: ProcessorStepSchema,
        type: 'processor',
        options: { validateInputs: false },
      })
        .then(createStep(new CustomOnDemandSkillDiscoveryProcessor()))
        .commit();

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [skillSearchWorkflow],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });

    it('should preserve skill activation tools when SkillsProcessor is explicitly configured in a processor workflow', async () => {
      const skillWorkflow = createWorkflow({
        id: 'skill-workflow',
        inputSchema: ProcessorStepSchema,
        outputSchema: ProcessorStepSchema,
        type: 'processor',
        options: { validateInputs: false },
      })
        .then(createStep(new SkillsProcessor({ workspace: mockWorkspace })))
        .then(createStep(new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 })))
        .commit();

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [skillWorkflow],
      });

      await agent.generate('Hello');

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('skill');
      expect(toolNames).toContain('skill_search');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('Skills are NOT tools');
      expect(prompt).toContain('To discover available skills, call search_skills');
    });

    it('should apply on-demand mode in legacy generate options', async () => {
      const legacyModel = new MockLanguageModelV1({
        doGenerate: async ({ prompt, mode }) => {
          capturedPrompt = prompt;
          capturedTools = mode.type === 'regular' ? mode.tools : undefined;

          return {
            text: 'response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 5 },
            rawCall: { rawPrompt: prompt, rawSettings: {} },
          };
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: legacyModel,
        workspace: mockWorkspace,
        tools: {
          custom_lookup: createTool({
            id: 'custom_lookup',
            description: 'Custom lookup tool',
            inputSchema: z.object({ query: z.string() }),
            execute: async () => 'ok',
          }),
        },
      });

      await agent.generateLegacy('Hello', {
        inputProcessors: [new SkillSearchProcessor({ workspace: mockWorkspace, ttl: 0 })],
      });

      const toolNames = getToolNames(capturedTools);
      expect(toolNames).toContain('custom_lookup');
      expect(toolNames).toContain('search_skills');
      expect(toolNames).toContain('load_skill');
      expect(toolNames).toContain('skill_read');
      expect(toolNames).not.toContain('skill');
      expect(toolNames).not.toContain('skill_search');

      const prompt = JSON.stringify(capturedPrompt);
      expect(prompt).toContain('To discover available skills, call search_skills');
      expect(prompt).not.toContain('<available_skills>');
      expect(prompt).not.toContain('Skills are NOT tools');
    });
  });
});
