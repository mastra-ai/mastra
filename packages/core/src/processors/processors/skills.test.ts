import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Skill, SkillMetadata, WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import { SkillsProcessor } from './skills';

// =============================================================================
// Mock Types and Helpers
// =============================================================================

interface MockMessageList {
  addSystem: ReturnType<typeof vi.fn>;
}

function createMockMessageList(): MockMessageList {
  return {
    addSystem: vi.fn(),
  };
}

// Mock skills data
const mockSkill1: Skill = {
  name: 'code-review',
  description: 'A skill for code review assistance',
  instructions: '# Code Review\n\nHelp the user review code effectively.',
  path: '/skills/code-review',
  source: { type: 'local', projectPath: '/skills/code-review' },
  license: 'MIT',
  references: [],
  scripts: [],
  assets: [],
};

const mockSkill2: Skill = {
  name: 'testing',
  description: 'A skill for writing tests',
  instructions: '# Testing\n\nHelp write comprehensive tests.',
  path: '/skills/testing',
  source: { type: 'external', packagePath: '/node_modules/@example/testing' },
  references: [],
  scripts: [],
  assets: [],
};

const mockSkillMetadata1: SkillMetadata = {
  name: mockSkill1.name,
  description: mockSkill1.description,
  license: mockSkill1.license,
  path: mockSkill1.path,
};

const mockSkillMetadata2: SkillMetadata = {
  name: mockSkill2.name,
  description: mockSkill2.description,
  path: mockSkill2.path,
};

// Create mock WorkspaceSkills
function createMockWorkspaceSkills(): WorkspaceSkills {
  const skills = new Map<string, Skill>([
    [mockSkill1.path, mockSkill1],
    [mockSkill2.path, mockSkill2],
  ]);

  const references = new Map<string, Map<string, string>>([
    [mockSkill1.path, new Map([['api.md', '# API Reference\nSome API docs.']])],
    [mockSkill2.path, new Map([['guide.md', '# Testing Guide\nHow to write tests.']])],
  ]);

  const scripts = new Map<string, Map<string, string>>([
    [mockSkill1.path, new Map([['lint.sh', '#!/bin/bash\neslint .']])],
  ]);

  const assets = new Map<string, Map<string, Buffer>>([
    [mockSkill1.path, new Map([['template.json', Buffer.from('{"type": "template"}')]])],
  ]);

  return {
    list: vi.fn().mockResolvedValue([mockSkillMetadata1, mockSkillMetadata2]),
    get: vi.fn().mockImplementation((skillPath: string) => Promise.resolve(skills.get(skillPath) || null)),
    has: vi.fn().mockImplementation((skillPath: string) => Promise.resolve(skills.has(skillPath))),
    refresh: vi.fn().mockResolvedValue(undefined),
    maybeRefresh: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    getReference: vi
      .fn()
      .mockImplementation((skillPath: string, path: string) =>
        Promise.resolve(references.get(skillPath)?.get(path) ?? null),
      ),
    getScript: vi
      .fn()
      .mockImplementation((skillPath: string, path: string) =>
        Promise.resolve(scripts.get(skillPath)?.get(path) ?? null),
      ),
    getAsset: vi
      .fn()
      .mockImplementation((skillPath: string, path: string) =>
        Promise.resolve(assets.get(skillPath)?.get(path) ?? null),
      ),
    listReferences: vi
      .fn()
      .mockImplementation((skillPath: string) => Promise.resolve(Array.from(references.get(skillPath)?.keys() || []))),
    listScripts: vi
      .fn()
      .mockImplementation((skillPath: string) => Promise.resolve(Array.from(scripts.get(skillPath)?.keys() || []))),
    listAssets: vi
      .fn()
      .mockImplementation((skillPath: string) => Promise.resolve(Array.from(assets.get(skillPath)?.keys() || []))),
  };
}

// Create mock Workspace
function createMockWorkspace(skills?: WorkspaceSkills): Workspace {
  return {
    skills,
  } as unknown as Workspace;
}

// =============================================================================
// Tests
// =============================================================================

describe('SkillsProcessor', () => {
  let processor: SkillsProcessor;
  let mockSkills: WorkspaceSkills;
  let mockWorkspace: Workspace;
  let mockMessageList: MockMessageList;

  beforeEach(() => {
    mockSkills = createMockWorkspaceSkills();
    mockWorkspace = createMockWorkspace(mockSkills);
    processor = new SkillsProcessor({ workspace: mockWorkspace });
    mockMessageList = createMockMessageList();
  });

  describe('constructor', () => {
    it('should create processor with default XML format', () => {
      expect(processor.id).toBe('skills-processor');
      expect(processor.name).toBe('Skills Processor');
    });

    it('should accept custom format option', () => {
      const jsonProcessor = new SkillsProcessor({
        workspace: mockWorkspace,
        format: 'json',
      });
      expect(jsonProcessor.id).toBe('skills-processor');
    });
  });

  describe('listSkills', () => {
    it('should list all available skills', async () => {
      const skills = await processor.listSkills();

      expect(skills).toHaveLength(2);
      expect(skills[0]).toEqual({
        name: 'code-review',
        description: 'A skill for code review assistance',
        license: 'MIT',
      });
      expect(skills[1]).toEqual({
        name: 'testing',
        description: 'A skill for writing tests',
        license: undefined,
      });
    });

    it('should return empty array when no skills configured', async () => {
      const emptyWorkspace = createMockWorkspace(undefined);
      const emptyProcessor = new SkillsProcessor({ workspace: emptyWorkspace });

      const skills = await emptyProcessor.listSkills();
      expect(skills).toEqual([]);
    });
  });

  describe('processInputStep', () => {
    it('should inject available skills into system message (XML format)', async () => {
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      // Should add available skills XML
      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('<available_skills>'),
        }),
      );

      // Should add instruction about the `skill` tool
      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('`skill` tool'),
        }),
      );
    });

    it('should inject available skills in JSON format', async () => {
      const jsonProcessor = new SkillsProcessor({
        workspace: mockWorkspace,
        format: 'json',
      });

      await jsonProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Available Skills:'),
        }),
      );
    });

    it('should inject available skills in markdown format', async () => {
      const mdProcessor = new SkillsProcessor({
        workspace: mockWorkspace,
        format: 'markdown',
      });

      await mdProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('# Available Skills'),
        }),
      );
    });

    it('should not inject skills when none are configured', async () => {
      const emptyMockSkills = {
        ...createMockWorkspaceSkills(),
        list: vi.fn().mockResolvedValue([]),
      };
      const emptyWorkspace = createMockWorkspace(emptyMockSkills);
      const emptyProcessor = new SkillsProcessor({ workspace: emptyWorkspace });

      await emptyProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      // Should not add available skills when empty
      expect(mockMessageList.addSystem).not.toHaveBeenCalled();
    });

    it('should load skills based on request context', async () => {
      const requestContext = { userId: 'test-user', sessionId: '123' };

      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 0,
        requestContext,
      } as any);

      expect(mockSkills.maybeRefresh).toHaveBeenCalledTimes(1);
      expect(mockSkills.maybeRefresh).toHaveBeenCalledWith({ requestContext });
    });

    it('should sort skills by name for deterministic output', async () => {
      // Mock skills in reverse alphabetical order
      const reverseSkills = {
        ...createMockWorkspaceSkills(),
        list: vi.fn().mockResolvedValue([mockSkillMetadata2, mockSkillMetadata1]), // testing, code-review
      };
      const workspace = createMockWorkspace(reverseSkills);
      const proc = new SkillsProcessor({ workspace });

      await proc.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      const systemCalls = mockMessageList.addSystem.mock.calls;
      const allSystemContent = systemCalls.map((call: any) => call[0]?.content || call[0]).join('\n');

      // code-review should appear before testing regardless of list order
      const codeReviewIdx = allSystemContent.indexOf('code-review');
      const testingIdx = allSystemContent.indexOf('testing');
      expect(codeReviewIdx).toBeLessThan(testingIdx);
    });

    it('should de-duplicate symlinked skill aliases in available skills output', async () => {
      const canonicalSkill = {
        ...mockSkill1,
        path: '/Users/tylerbarnes/.agents/skills/mastra',
        name: 'mastra',
        description: 'Mastra development guide',
      };
      const duplicateSkillMetadata = [
        {
          name: 'mastra',
          description: 'Mastra development guide',
          path: '/Users/tylerbarnes/.claude/skills/mastra',
        },
        {
          name: 'mastra',
          description: 'Mastra development guide',
          path: '/Users/tylerbarnes/.agents/skills/mastra',
        },
      ];

      const duplicateSkills = {
        ...createMockWorkspaceSkills(),
        list: vi.fn().mockResolvedValue(duplicateSkillMetadata),
        get: vi.fn().mockResolvedValue(canonicalSkill),
      };
      const workspace = createMockWorkspace(duplicateSkills);
      const proc = new SkillsProcessor({ workspace });

      await proc.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      const systemCalls = mockMessageList.addSystem.mock.calls;
      const availableSkillsMessage = systemCalls.find((call: any) =>
        call[0]?.content?.includes('<available_skills>'),
      )?.[0]?.content;

      expect(availableSkillsMessage).toBeDefined();
      expect(availableSkillsMessage.match(/<name>mastra<\/name>/g)).toHaveLength(1);
      expect(availableSkillsMessage).toContain('/Users/tylerbarnes/.agents/skills/mastra/SKILL.md');
      expect(availableSkillsMessage).not.toContain('/Users/tylerbarnes/.claude/skills/mastra/SKILL.md');
    });

    it('should inject on every step (system messages are reset between steps)', async () => {
      // Step 0 — should inject
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 0,
      } as any);
      expect(mockMessageList.addSystem).toHaveBeenCalled();
      const step0Calls = mockMessageList.addSystem.mock.calls.length;

      mockMessageList.addSystem.mockClear();

      // Step 1 — should also inject (system messages are reset each step)
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 1,
      } as any);
      expect(mockMessageList.addSystem).toHaveBeenCalledTimes(step0Calls);
    });

    it('should only call maybeRefresh on step 0', async () => {
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 0,
      } as any);
      expect(mockSkills.maybeRefresh).toHaveBeenCalledTimes(1);

      (mockSkills.maybeRefresh as any).mockClear();

      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 1,
      } as any);
      expect(mockSkills.maybeRefresh).not.toHaveBeenCalled();
    });
  });

  describe('no skills configured', () => {
    it('should handle workspace without skills gracefully', async () => {
      const noSkillsWorkspace = createMockWorkspace(undefined);
      const noSkillsProcessor = new SkillsProcessor({ workspace: noSkillsWorkspace });

      await noSkillsProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: { existingTool: {} as any },
      } as any);

      // Should not add any system messages
      expect(mockMessageList.addSystem).not.toHaveBeenCalled();
    });
  });

  describe('model calls skill name directly as tool (issue #12654)', () => {
    it('should provide clear instructions about how to use skills', async () => {
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      const systemCalls = mockMessageList.addSystem.mock.calls;
      const allSystemContent = systemCalls.map((call: any) => call[0]?.content || call[0]).join('\n');

      // Check that the instruction mentions the skill tool
      expect(allSystemContent).toContain('`skill` tool');

      // The instruction should be clear enough that the model knows NOT to call skill names directly
      expect(allSystemContent).toMatch(/do not.*call.*skill.*directly|skill.*not.*tool|call the skill tool/i);
    });
  });
});
