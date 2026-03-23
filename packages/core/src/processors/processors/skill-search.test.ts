import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MessageList } from '../../agent/message-list';
import { RequestContext, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ProcessInputStepArgs } from '../index';
import { SkillSearchProcessor } from './skill-search';

// Mock workspace skills
function createMockSkills(skillData: Array<{ name: string; description: string; instructions: string }>) {
  const skills = skillData.map(s => ({
    name: s.name,
    description: s.description,
    instructions: s.instructions,
    path: `/skills/${s.name}`,
    source: { type: 'local' as const, projectPath: '/project' },
    references: [],
    scripts: [],
    assets: [],
  }));

  return {
    list: vi.fn(async () => skills.map(s => ({ name: s.name, description: s.description }))),
    get: vi.fn(async (name: string) => skills.find(s => s.name === name) ?? null),
    search: vi.fn(async (query: string, opts?: { topK?: number; minScore?: number }) => {
      const queryLower = query.toLowerCase();
      return skills
        .filter(s => s.name.includes(queryLower) || s.description.toLowerCase().includes(queryLower))
        .slice(0, opts?.topK ?? 5)
        .map(s => ({
          skillName: s.name,
          source: 'SKILL.md',
          content: s.instructions.slice(0, 100),
          score: 1.0,
        }));
    }),
    has: vi.fn(async (name: string) => skills.some(s => s.name === name)),
    maybeRefresh: vi.fn(async () => {}),
  };
}

// Mock workspace
function createMockWorkspace(skillData: Array<{ name: string; description: string; instructions: string }> = []) {
  const mockSkills = skillData.length > 0 ? createMockSkills(skillData) : undefined;
  return {
    skills: mockSkills,
    id: 'test-workspace',
    name: 'Test Workspace',
  } as any;
}

// Helper to create ProcessInputStepArgs
function createMockArgs(threadId?: string): ProcessInputStepArgs {
  const requestContext = new RequestContext();
  if (threadId) {
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
  }
  return {
    messageList: new MessageList({}),
    requestContext,
    stepNumber: 0,
    steps: [],
    systemMessages: [],
    state: {},
    retryCount: 0,
    model: {} as any,
    abort: (() => {
      throw new Error('abort');
    }) as any,
  } as ProcessInputStepArgs;
}

describe('SkillSearchProcessor', () => {
  const testSkills = [
    { name: 'api-design', description: 'Guidelines for designing REST APIs', instructions: 'Use REST conventions...' },
    {
      name: 'testing-strategy',
      description: 'Best practices for writing tests',
      instructions: 'Write unit tests first...',
    },
    {
      name: 'deployment',
      description: 'How to deploy applications to production',
      instructions: 'Use CI/CD pipelines...',
    },
    {
      name: 'code-review',
      description: 'Standards for reviewing pull requests',
      instructions: 'Check for readability...',
    },
  ];

  describe('initialization', () => {
    it('should create processor with correct id and name', () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });

      expect(processor.id).toBe('skill-search');
      expect(processor.name).toBe('Skill Search Processor');
    });

    it('should accept search configuration', () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
        search: { topK: 10, minScore: 0.5 },
      });

      expect(processor).toBeDefined();
    });
  });

  describe('meta-tool injection', () => {
    it('should return search_skills and load_skill tools', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });

      const result = await processor.processInputStep(createMockArgs('thread-1'));

      expect(result.tools).toHaveProperty('search_skills');
      expect(result.tools).toHaveProperty('load_skill');
    });

    it('should preserve existing tools', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });

      const args = createMockArgs('thread-1');
      (args as any).tools = { existing_tool: { id: 'existing', execute: async () => ({}) } };
      const result = await processor.processInputStep(args);

      expect(result.tools).toHaveProperty('search_skills');
      expect(result.tools).toHaveProperty('load_skill');
      expect(result.tools).toHaveProperty('existing_tool');
    });

    it('should not inject meta-tools when no skills configured', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(),
      });

      const result = await processor.processInputStep(createMockArgs('thread-1'));

      // When no skills, passes through without adding meta-tools
      expect(result.tools?.search_skills).toBeUndefined();
      expect(result.tools?.load_skill).toBeUndefined();
    });
  });

  describe('search_skills', () => {
    let processor: SkillSearchProcessor;

    beforeEach(() => {
      processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });
    });

    it('should find skills matching query', async () => {
      const result = await processor.processInputStep(createMockArgs('thread-1'));
      const searchTool = result.tools?.search_skills;

      const searchResult = await searchTool!.execute?.({ query: 'api' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].name).toBe('api-design');
    });

    it('should return empty results for no matches', async () => {
      const result = await processor.processInputStep(createMockArgs('thread-1'));
      const searchTool = result.tools?.search_skills;

      const searchResult = await searchTool!.execute?.({ query: 'nonexistent-topic' }, undefined);

      expect(searchResult.results).toEqual([]);
      expect(searchResult.message).toContain('No skills found');
    });

    it('should include score in results', async () => {
      const result = await processor.processInputStep(createMockArgs('thread-1'));
      const searchTool = result.tools?.search_skills;

      const searchResult = await searchTool!.execute?.({ query: 'testing' }, undefined);

      expect(searchResult.results.length).toBeGreaterThan(0);
      searchResult.results.forEach((r: any) => {
        expect(typeof r.score).toBe('number');
      });
    });
  });

  describe('load_skill', () => {
    let processor: SkillSearchProcessor;

    beforeEach(() => {
      processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });
    });

    it('should load a skill successfully', async () => {
      const result = await processor.processInputStep(createMockArgs('thread-1'));
      const loadTool = result.tools?.load_skill;

      const loadResult = await loadTool!.execute?.({ skillName: 'api-design' }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.skillName).toBe('api-design');
    });

    it('should return error for nonexistent skill', async () => {
      const result = await processor.processInputStep(createMockArgs('thread-1'));
      const loadTool = result.tools?.load_skill;

      const loadResult = await loadTool!.execute?.({ skillName: 'nonexistent' }, undefined);

      expect(loadResult.success).toBe(false);
      expect(loadResult.message).toContain('not found');
    });

    it('should report already loaded skill', async () => {
      const args = createMockArgs('thread-1');
      const result1 = await processor.processInputStep(args);
      await result1.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      // Process again to get fresh tools with updated state
      const result2 = await processor.processInputStep(args);
      const loadResult = await result2.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      expect(loadResult.success).toBe(true);
      expect(loadResult.message).toContain('already loaded');
    });

    it('should inject loaded skill instructions as system messages', async () => {
      const args = createMockArgs('thread-1');

      // First step: load a skill
      const result1 = await processor.processInputStep(args);
      await result1.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      // Second step: skill instructions should be injected via addSystem
      const args2 = createMockArgs('thread-1');
      const addSystemSpy = vi.spyOn(args2.messageList, 'addSystem');
      await processor.processInputStep(args2);

      const calls = addSystemSpy.mock.calls;
      const skillCall = calls.find(call => {
        const arg = call[0];
        if (typeof arg === 'string') {
          return arg.includes('[Skill: api-design]');
        }
        if (arg && typeof arg === 'object' && 'content' in arg) {
          const content = (arg as Record<string, unknown>).content;
          return typeof content === 'string' && content.includes('[Skill: api-design]');
        }
        return false;
      });

      expect(skillCall).toBeDefined();
    });
  });

  describe('thread isolation', () => {
    it('should not leak skills between threads', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });

      // Load skill in thread A
      const argsA = createMockArgs('thread-a');
      const resultA = await processor.processInputStep(argsA);
      await resultA.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      // Check thread B has no loaded skills
      const argsB = createMockArgs('thread-b');
      const addSystemSpyB = vi.spyOn(argsB.messageList, 'addSystem');
      await processor.processInputStep(argsB);

      const callsB = addSystemSpyB.mock.calls;
      const skillMessage = callsB.find(call => {
        const arg = call[0];
        if (typeof arg === 'string') {
          return arg.includes('[Skill: api-design]');
        }
        if (arg && typeof arg === 'object' && 'content' in arg) {
          const content = (arg as Record<string, unknown>).content;
          return typeof content === 'string' && content.includes('[Skill: api-design]');
        }
        return false;
      });

      expect(skillMessage).toBeUndefined();
    });
  });

  describe('TTL cleanup', () => {
    it('should clean up stale thread state', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
        ttl: 100, // 100ms TTL for testing
      });

      // Load skill to create thread state
      const args = createMockArgs('stale-thread');
      const result = await processor.processInputStep(args);
      await result.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      expect(processor.getStateStats().threadCount).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup
      const cleaned = processor.cleanupNow();
      expect(cleaned).toBe(1);
      expect(processor.getStateStats().threadCount).toBe(0);
    });

    it('should not clean up recently accessed threads', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
        ttl: 1000,
      });

      const args = createMockArgs('active-thread');
      const result = await processor.processInputStep(args);
      await result.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      const cleaned = processor.cleanupNow();
      expect(cleaned).toBe(0);
      expect(processor.getStateStats().threadCount).toBe(1);
    });
  });

  describe('utility methods', () => {
    it('should clear specific thread state', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });

      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      await result.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      expect(processor.getStateStats().threadCount).toBe(1);

      processor.clearState('thread-1');
      expect(processor.getStateStats().threadCount).toBe(0);
    });

    it('should clear all thread state', async () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
      });

      // Create state in two threads
      const args1 = createMockArgs('thread-1');
      const result1 = await processor.processInputStep(args1);
      await result1.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);

      const args2 = createMockArgs('thread-2');
      const result2 = await processor.processInputStep(args2);
      await result2.tools?.load_skill!.execute?.({ skillName: 'testing-strategy' }, undefined);

      expect(processor.getStateStats().threadCount).toBe(2);

      processor.clearAllState();
      expect(processor.getStateStats().threadCount).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clear the cleanup interval and all thread state', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
        ttl: 60000,
      });

      // Create some thread state
      const args = createMockArgs('thread-1');
      const result = await processor.processInputStep(args);
      await result.tools?.load_skill!.execute?.({ skillName: 'api-design' }, undefined);
      expect(processor.getStateStats().threadCount).toBe(1);

      processor.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(processor.getStateStats().threadCount).toBe(0);

      clearIntervalSpy.mockRestore();
    });

    it('should be safe to call multiple times', () => {
      const processor = new SkillSearchProcessor({
        workspace: createMockWorkspace(testSkills),
        ttl: 60000,
      });

      expect(() => {
        processor.dispose();
        processor.dispose();
      }).not.toThrow();
    });
  });
});
