import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Skill, SkillMetadata, SkillSearchResult, WorkspaceSkills } from '../../workspace/skills';
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
  source: { type: 'local', path: '/skills/code-review' },
  license: 'MIT',
  allowedTools: ['read-file', 'write-file'],
};

const mockSkill2: Skill = {
  name: 'testing',
  description: 'A skill for writing tests',
  instructions: '# Testing\n\nHelp write comprehensive tests.',
  path: '/skills/testing',
  source: { type: 'external', url: 'https://example.com/testing' },
};

const mockSkillMetadata1: SkillMetadata = {
  name: mockSkill1.name,
  description: mockSkill1.description,
  license: mockSkill1.license,
  allowedTools: mockSkill1.allowedTools,
};

const mockSkillMetadata2: SkillMetadata = {
  name: mockSkill2.name,
  description: mockSkill2.description,
};

// Create mock WorkspaceSkills
function createMockWorkspaceSkills(): WorkspaceSkills {
  const skills = new Map<string, Skill>([
    [mockSkill1.name, mockSkill1],
    [mockSkill2.name, mockSkill2],
  ]);

  const references = new Map<string, Map<string, string>>([
    [mockSkill1.name, new Map([['api.md', '# API Reference\nSome API docs.']])],
    [mockSkill2.name, new Map([['guide.md', '# Testing Guide\nHow to write tests.']])],
  ]);

  const scripts = new Map<string, Map<string, string>>([
    [mockSkill1.name, new Map([['lint.sh', '#!/bin/bash\neslint .']])],
  ]);

  const assets = new Map<string, Map<string, Buffer>>([
    [mockSkill1.name, new Map([['template.json', Buffer.from('{"type": "template"}')]])],
  ]);

  return {
    list: vi.fn().mockResolvedValue([mockSkillMetadata1, mockSkillMetadata2]),
    get: vi.fn().mockImplementation((name: string) => Promise.resolve(skills.get(name) || null)),
    has: vi.fn().mockImplementation((name: string) => Promise.resolve(skills.has(name))),
    refresh: vi.fn().mockResolvedValue(undefined),
    maybeRefresh: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getReference: vi
      .fn()
      .mockImplementation((skillName: string, path: string) =>
        Promise.resolve(references.get(skillName)?.get(path) ?? null),
      ),
    getScript: vi
      .fn()
      .mockImplementation((skillName: string, path: string) =>
        Promise.resolve(scripts.get(skillName)?.get(path) ?? null),
      ),
    getAsset: vi
      .fn()
      .mockImplementation((skillName: string, path: string) =>
        Promise.resolve(assets.get(skillName)?.get(path) ?? null),
      ),
    listReferences: vi
      .fn()
      .mockImplementation((skillName: string) => Promise.resolve(Array.from(references.get(skillName)?.keys() || []))),
    listScripts: vi
      .fn()
      .mockImplementation((skillName: string) => Promise.resolve(Array.from(scripts.get(skillName)?.keys() || []))),
    listAssets: vi
      .fn()
      .mockImplementation((skillName: string) => Promise.resolve(Array.from(assets.get(skillName)?.keys() || []))),
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
        allowedTools: ['read-file', 'write-file'],
      });
      expect(skills[1]).toEqual({
        name: 'testing',
        description: 'A skill for writing tests',
        license: undefined,
        allowedTools: undefined,
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
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      // Should add available skills XML
      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('<available_skills>'),
        }),
      );

      // Should add activation instruction
      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('skill-activate'),
        }),
      );

      // Should return skill tools
      expect(result.tools).toHaveProperty('skill-activate');
      expect(result.tools).toHaveProperty('skill-search');
    });

    it('should inject available skills in JSON format', async () => {
      const jsonProcessor = new SkillsProcessor({
        workspace: mockWorkspace,
        format: 'json',
      });

      await jsonProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

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
      });

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

      const result = await emptyProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      // Should not add available skills when empty
      expect(mockMessageList.addSystem).not.toHaveBeenCalled();

      // Should not return skill tools when no skills
      expect(result.tools).not.toHaveProperty('skill-activate');
    });

    it('should preserve existing tools', async () => {
      const existingTools = {
        'my-tool': { execute: vi.fn() },
      };

      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: existingTools,
      });

      expect(result.tools).toHaveProperty('my-tool');
      expect(result.tools).toHaveProperty('skill-activate');
    });
  });

  describe('skill-activate tool', () => {
    it('should activate a skill successfully', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const activateTool = result.tools['skill-activate'] as any;
      const activateResult = await activateTool.execute({ name: 'code-review' });

      expect(activateResult.success).toBe(true);
      expect(activateResult.message).toContain('activated successfully');
      expect(activateResult.allowedTools).toEqual(['read-file', 'write-file']);
    });

    it('should fail when activating non-existent skill', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const activateTool = result.tools['skill-activate'] as any;
      const activateResult = await activateTool.execute({ name: 'non-existent' });

      expect(activateResult.success).toBe(false);
      expect(activateResult.message).toContain('not found');
      expect(activateResult.message).toContain('code-review');
    });

    it('should handle already activated skill', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const activateTool = result.tools['skill-activate'] as any;

      // Activate twice
      await activateTool.execute({ name: 'code-review' });
      const secondResult = await activateTool.execute({ name: 'code-review' });

      expect(secondResult.success).toBe(true);
      expect(secondResult.message).toContain('already activated');
    });

    it('should make read tools available after activation', async () => {
      // First call - no read tools
      const result1 = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      expect(result1.tools).not.toHaveProperty('skill-read-reference');

      // Activate a skill
      const activateTool = result1.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });

      // Second call - should have read tools
      mockMessageList.addSystem.mockClear();
      const result2 = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      expect(result2.tools).toHaveProperty('skill-read-reference');
      expect(result2.tools).toHaveProperty('skill-read-script');
      expect(result2.tools).toHaveProperty('skill-read-asset');
    });
  });

  describe('skill-search tool', () => {
    it('should search skills', async () => {
      const searchResults: SkillSearchResult[] = [
        {
          skillName: 'code-review',
          content: 'Help the user review code effectively.',
          source: 'instructions',
          score: 0.9,
        },
      ];
      (mockSkills.search as ReturnType<typeof vi.fn>).mockResolvedValue(searchResults);

      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const searchTool = result.tools['skill-search'] as any;
      const searchResult = await searchTool.execute({ query: 'code review' });

      expect(searchResult.success).toBe(true);
      expect(searchResult.results).toHaveLength(1);
      expect(searchResult.results[0].skillName).toBe('code-review');
    });

    it('should return empty results when no matches', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const searchTool = result.tools['skill-search'] as any;
      const searchResult = await searchTool.execute({ query: 'no match' });

      expect(searchResult.success).toBe(true);
      expect(searchResult.results).toHaveLength(0);
      expect(searchResult.message).toBe('No results found');
    });
  });

  describe('skill-read-reference tool', () => {
    beforeEach(async () => {
      // Activate a skill first
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });
      const activateTool = result.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });
    });

    it('should read reference file from activated skill', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readRefTool = result.tools['skill-read-reference'] as any;
      const readResult = await readRefTool.execute({
        skillName: 'code-review',
        referencePath: 'api.md',
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('API Reference');
    });

    it('should fail when skill is not activated', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readRefTool = result.tools['skill-read-reference'] as any;
      const readResult = await readRefTool.execute({
        skillName: 'testing',
        referencePath: 'guide.md',
      });

      expect(readResult.success).toBe(false);
      expect(readResult.message).toContain('not activated');
    });

    it('should fail when reference file does not exist', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readRefTool = result.tools['skill-read-reference'] as any;
      const readResult = await readRefTool.execute({
        skillName: 'code-review',
        referencePath: 'non-existent.md',
      });

      expect(readResult.success).toBe(false);
      expect(readResult.message).toContain('not found');
      expect(readResult.message).toContain('api.md'); // lists available refs
    });

    it('should support line range extraction', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readRefTool = result.tools['skill-read-reference'] as any;
      const readResult = await readRefTool.execute({
        skillName: 'code-review',
        referencePath: 'api.md',
        startLine: 1,
        endLine: 1,
      });

      expect(readResult.success).toBe(true);
      expect(readResult.lines).toBeDefined();
    });
  });

  describe('skill-read-script tool', () => {
    beforeEach(async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });
      const activateTool = result.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });
    });

    it('should read script file from activated skill', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readScriptTool = result.tools['skill-read-script'] as any;
      const readResult = await readScriptTool.execute({
        skillName: 'code-review',
        scriptPath: 'lint.sh',
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('eslint');
    });

    it('should fail when script file does not exist', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readScriptTool = result.tools['skill-read-script'] as any;
      const readResult = await readScriptTool.execute({
        skillName: 'code-review',
        scriptPath: 'non-existent.sh',
      });

      expect(readResult.success).toBe(false);
      expect(readResult.message).toContain('not found');
    });
  });

  describe('skill-read-asset tool', () => {
    beforeEach(async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });
      const activateTool = result.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });
    });

    it('should read text asset file as utf-8', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readAssetTool = result.tools['skill-read-asset'] as any;
      const readResult = await readAssetTool.execute({
        skillName: 'code-review',
        assetPath: 'template.json',
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toContain('template');
      expect(readResult.encoding).toBe('utf-8');
    });

    it('should read binary asset as base64', async () => {
      // Set up a binary asset
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      (mockSkills.getAsset as ReturnType<typeof vi.fn>).mockImplementation((skillName: string, assetPath: string) => {
        if (skillName === 'code-review' && assetPath === 'binary.bin') {
          return Promise.resolve(binaryBuffer);
        }
        return Promise.resolve(null);
      });

      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readAssetTool = result.tools['skill-read-asset'] as any;
      const readResult = await readAssetTool.execute({
        skillName: 'code-review',
        assetPath: 'binary.bin',
      });

      expect(readResult.success).toBe(true);
      expect(readResult.encoding).toBe('base64');
    });

    it('should fail when asset file does not exist', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const readAssetTool = result.tools['skill-read-asset'] as any;
      const readResult = await readAssetTool.execute({
        skillName: 'code-review',
        assetPath: 'non-existent.json',
      });

      expect(readResult.success).toBe(false);
      expect(readResult.message).toContain('not found');
    });
  });

  describe('getAllowedTools', () => {
    it('should return undefined when no skills have allowed tools', async () => {
      expect(processor.getAllowedTools()).toBeUndefined();
    });

    it('should return allowed tools after activating skill with allowedTools', async () => {
      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const activateTool = result.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });

      const allowedTools = processor.getAllowedTools();
      expect(allowedTools).toContain('read-file');
      expect(allowedTools).toContain('write-file');
    });

    it('should return union of all allowed tools from multiple skills', async () => {
      // Add another skill with different allowed tools
      const skill3: Skill = {
        name: 'deploy',
        description: 'Deployment skill',
        instructions: 'Deploy things',
        path: '/skills/deploy',
        source: { type: 'local', path: '/skills/deploy' },
        allowedTools: ['execute-command', 'read-file'],
      };
      (mockSkills.get as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'deploy') return Promise.resolve(skill3);
        if (name === 'code-review') return Promise.resolve(mockSkill1);
        if (name === 'testing') return Promise.resolve(mockSkill2);
        return Promise.resolve(null);
      });
      (mockSkills.has as ReturnType<typeof vi.fn>).mockImplementation((name: string) =>
        Promise.resolve(['code-review', 'testing', 'deploy'].includes(name)),
      );

      const result = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      const activateTool = result.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });
      await activateTool.execute({ name: 'deploy' });

      const allowedTools = processor.getAllowedTools();
      expect(allowedTools).toContain('read-file');
      expect(allowedTools).toContain('write-file');
      expect(allowedTools).toContain('execute-command');
      // read-file should only appear once
      expect(allowedTools?.filter(t => t === 'read-file')).toHaveLength(1);
    });
  });

  describe('activated skills injection', () => {
    it('should inject activated skill instructions into system message', async () => {
      // Activate a skill
      const result1 = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });
      const activateTool = result1.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });

      // Process again - should include activated skill
      mockMessageList.addSystem.mockClear();
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      // Should have activated skills content
      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('<activated_skills>'),
        }),
      );

      // Should have skill instructions
      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Code Review'),
        }),
      );
    });

    it('should inject allowed tools notice when activated skills have allowedTools', async () => {
      // Activate a skill with allowed tools
      const result1 = await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });
      const activateTool = result1.tools['skill-activate'] as any;
      await activateTool.execute({ name: 'code-review' });

      mockMessageList.addSystem.mockClear();
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      });

      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('<skill_allowed_tools>'),
        }),
      );
    });
  });

  describe('no skills configured', () => {
    it('should handle workspace without skills gracefully', async () => {
      const noSkillsWorkspace = createMockWorkspace(undefined);
      const noSkillsProcessor = new SkillsProcessor({ workspace: noSkillsWorkspace });

      const result = await noSkillsProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: { existingTool: {} as any },
      });

      // Should not add any system messages
      expect(mockMessageList.addSystem).not.toHaveBeenCalled();

      // Should preserve existing tools and not add skill tools
      expect(result.tools).toHaveProperty('existingTool');
      expect(result.tools).not.toHaveProperty('skill-activate');
    });
  });
});
