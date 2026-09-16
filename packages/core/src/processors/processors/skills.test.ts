import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Skill, SkillMetadata, WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import { formatSkillsCatalog, SkillsProcessor, type SkillCatalogEntry } from './skills';

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

    it('should render default location as skill path + SKILL.md', async () => {
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('<location>/skills/code-review/SKILL.md</location>'),
        }),
      );
    });

    it('should render location via formatLocation override', async () => {
      const remappedProcessor = new SkillsProcessor({
        workspace: mockWorkspace,
        formatLocation: skill => `/mnt/bundle/${skill.name}/SKILL.md`,
      });

      await remappedProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      expect(mockMessageList.addSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('<location>/mnt/bundle/code-review/SKILL.md</location>'),
        }),
      );
      const contents = mockMessageList.addSystem.mock.calls.map(c => c[0].content).join('\n');
      expect(contents).not.toContain('/skills/code-review/SKILL.md');
    });

    it('should instruct that the default location identifies a skill and files are read via skill_read', async () => {
      await processor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      const contents = mockMessageList.addSystem.mock.calls.map(c => c[0].content).join('\n');
      expect(contents).toContain('The location field identifies a skill for the `skill` and `skill_read` tools');
      expect(contents).toContain('read skill files with `skill_read` rather than with filesystem tools');
      expect(contents).toContain('use the exact location (shown in the location field)');
    });

    it('should register remapped locations as aliases and keep the location a skill identifier', async () => {
      const registerLocationAlias = vi.fn();
      const aliasSkills: WorkspaceSkills = { ...createMockWorkspaceSkills(), registerLocationAlias };
      const remappedProcessor = new SkillsProcessor({
        skills: aliasSkills,
        formatLocation: skill => `/mnt/bundle/${skill.name}/SKILL.md`,
      });

      await remappedProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      // Every rendered location is registered so tools can resolve it back to the skill.
      expect(registerLocationAlias).toHaveBeenCalledWith('/mnt/bundle/code-review/SKILL.md', '/skills/code-review');
      expect(registerLocationAlias).toHaveBeenCalledWith('/mnt/bundle/testing/SKILL.md', '/skills/testing');

      const contents = mockMessageList.addSystem.mock.calls.map(c => c[0].content).join('\n');
      expect(contents).toContain('The location field identifies a skill for the `skill` and `skill_read` tools');
      expect(contents).not.toContain('refer to skills by name and read skill files');
    });

    it('should fall back to by-name guidance when the skills registry cannot register aliases', async () => {
      // createMockWorkspaceSkills() does not implement registerLocationAlias,
      // so remapped locations cannot round-trip through get()/has().
      const remappedProcessor = new SkillsProcessor({
        workspace: mockWorkspace,
        formatLocation: skill => `/mnt/bundle/${skill.name}/SKILL.md`,
      });

      await remappedProcessor.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
      } as any);

      const contents = mockMessageList.addSystem.mock.calls.map(c => c[0].content).join('\n');
      expect(contents).not.toContain('The location field identifies a skill');
      expect(contents).not.toContain('use the exact location (shown in the location field)');
      expect(contents).toContain('refer to skills by name');
      expect(contents).toContain('read skill files with `skill_read` rather than with filesystem tools');
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

    it('resolves without awaiting a slow maybeRefresh (fire-and-forget revalidation)', async () => {
      // maybeRefresh never resolves - the step must still complete and serve the cache
      const slowSkills = {
        ...createMockWorkspaceSkills(),
        maybeRefresh: vi.fn().mockReturnValue(new Promise<void>(() => {})),
      };
      const workspace = createMockWorkspace(slowSkills);
      const proc = new SkillsProcessor({ workspace });

      await proc.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 0,
        requestContext: {},
      } as any);

      // Revalidation was fired...
      expect(slowSkills.maybeRefresh).toHaveBeenCalledTimes(1);
      // ...and the cached catalog was injected without waiting on it
      const allSystemContent = mockMessageList.addSystem.mock.calls
        .map((call: any) => call[0]?.content || call[0])
        .join('\n');
      expect(allSystemContent).toContain('code-review');
    });

    it('does not fail the step when maybeRefresh rejects, and warns via console fallback', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const rejectingSkills = {
          ...createMockWorkspaceSkills(),
          maybeRefresh: vi.fn().mockRejectedValue(new Error('sandbox unreachable')),
        };
        const workspace = createMockWorkspace(rejectingSkills);
        const proc = new SkillsProcessor({ workspace });

        await expect(
          proc.processInputStep({
            messageList: mockMessageList as any,
            tools: {},
            stepNumber: 0,
            requestContext: {},
          } as any),
        ).resolves.not.toThrow();

        // Fire-and-forget: the catch handler runs after the step resolves
        await vi.waitFor(() => {
          expect(warnSpy).toHaveBeenCalledWith(
            'SkillsProcessor: skills refresh failed',
            expect.objectContaining({ error: expect.any(Error) }),
          );
        });
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('warns through the Mastra logger when registered and maybeRefresh rejects', async () => {
      const rejectingSkills = {
        ...createMockWorkspaceSkills(),
        maybeRefresh: vi.fn().mockRejectedValue(new Error('sandbox unreachable')),
      };
      const workspace = createMockWorkspace(rejectingSkills);
      const proc = new SkillsProcessor({ workspace });
      const loggerWarn = vi.fn();
      proc.__registerMastra({ getLogger: () => ({ warn: loggerWarn }) } as any);

      await proc.processInputStep({
        messageList: mockMessageList as any,
        tools: {},
        stepNumber: 0,
        requestContext: {},
      } as any);

      await vi.waitFor(() => {
        expect(loggerWarn).toHaveBeenCalledWith(
          'SkillsProcessor: skills refresh failed',
          expect.objectContaining({ error: expect.any(Error) }),
        );
      });
    });

    it('awaits maybeRefresh before step 0 when blockingRefresh is enabled', async () => {
      // Gated maybeRefresh: the step must not complete until it resolves
      let releaseRefresh!: () => void;
      let refreshResolved = false;
      const gatedSkills = {
        ...createMockWorkspaceSkills(),
        maybeRefresh: vi.fn().mockReturnValue(
          new Promise<void>(resolve => {
            releaseRefresh = () => {
              refreshResolved = true;
              resolve();
            };
          }),
        ),
      };
      const workspace = createMockWorkspace(gatedSkills);
      const proc = new SkillsProcessor({ workspace, blockingRefresh: true });

      let stepDone = false;
      const stepP = proc
        .processInputStep({
          messageList: mockMessageList as any,
          tools: {},
          stepNumber: 0,
          requestContext: {},
        } as any)
        .then(() => {
          stepDone = true;
        });

      // Give the step a chance to (incorrectly) complete without the refresh
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(stepDone).toBe(false);

      releaseRefresh();
      await stepP;
      expect(refreshResolved).toBe(true);
      expect(stepDone).toBe(true);
    });

    it('does not fail the step when maybeRefresh rejects under blockingRefresh', async () => {
      const rejectingSkills = {
        ...createMockWorkspaceSkills(),
        maybeRefresh: vi.fn().mockRejectedValue(new Error('sandbox unreachable')),
      };
      const workspace = createMockWorkspace(rejectingSkills);
      const proc = new SkillsProcessor({ workspace, blockingRefresh: true });

      await expect(
        proc.processInputStep({
          messageList: mockMessageList as any,
          tools: {},
          stepNumber: 0,
          requestContext: {},
        } as any),
      ).resolves.not.toThrow();
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

describe('formatSkillsCatalog', () => {
  const entries: SkillCatalogEntry[] = [
    {
      name: 'testing',
      description: 'A skill for writing tests',
      location: '/skills/testing/SKILL.md',
      source: 'external',
    },
    {
      name: 'code-review',
      description: 'A skill for code review assistance',
      location: '/skills/code-review/SKILL.md',
      source: 'local',
    },
  ];

  // Skills that are listed but fail to resolve still produce a block, matching
  // what the processor injected before the formatter was extracted.
  it('renders an empty block rather than an empty string for an empty catalog', () => {
    expect(formatSkillsCatalog([])).toBe('<available_skills>\n\n</available_skills>');
    expect(formatSkillsCatalog([], 'json')).toBe('Available Skills:\n\n[]');
    expect(formatSkillsCatalog([], 'markdown')).toBe('# Available Skills\n\n');
  });

  it('renders XML by default, sorted by name for prompt cache stability', () => {
    expect(formatSkillsCatalog(entries)).toBe(`<available_skills>
  <skill>
    <name>code-review</name>
    <description>A skill for code review assistance</description>
    <location>/skills/code-review/SKILL.md</location>
    <source>local</source>
  </skill>
  <skill>
    <name>testing</name>
    <description>A skill for writing tests</description>
    <location>/skills/testing/SKILL.md</location>
    <source>external</source>
  </skill>
</available_skills>`);
  });

  it('does not mutate the caller\u2019s array while sorting', () => {
    const input = [...entries];
    formatSkillsCatalog(input);
    expect(input.map(entry => entry.name)).toEqual(['testing', 'code-review']);
  });

  it('escapes XML special characters', () => {
    const output = formatSkillsCatalog([
      { name: 'a&b', description: '<script>"x"</script>', location: "it's/here", source: 'local' },
    ]);

    expect(output).toContain('<name>a&amp;b</name>');
    expect(output).toContain('<description>&lt;script&gt;&quot;x&quot;&lt;/script&gt;</description>');
    expect(output).toContain('<location>it&apos;s/here</location>');
  });

  it('renders json and markdown formats', () => {
    expect(formatSkillsCatalog(entries, 'json')).toBe(`Available Skills:

${JSON.stringify(
  [
    {
      name: 'code-review',
      description: 'A skill for code review assistance',
      location: '/skills/code-review/SKILL.md',
      source: 'local',
    },
    {
      name: 'testing',
      description: 'A skill for writing tests',
      location: '/skills/testing/SKILL.md',
      source: 'external',
    },
  ],
  null,
  2,
)}`);

    expect(formatSkillsCatalog(entries, 'markdown')).toBe(`# Available Skills

- **code-review** [local] (/skills/code-review/SKILL.md): A skill for code review assistance
- **testing** [external] (/skills/testing/SKILL.md): A skill for writing tests`);
  });

  it('renders exactly what the processor injects, so audits cannot drift from the prompt', async () => {
    const messageList = createMockMessageList();
    await new SkillsProcessor({ workspace: createMockWorkspace(createMockWorkspaceSkills()) }).processInputStep({
      messageList: messageList as any,
      tools: {},
    } as any);

    const injected = messageList.addSystem.mock.calls[0]![0].content;
    expect(injected).toBe(formatSkillsCatalog(entries));
  });
});
