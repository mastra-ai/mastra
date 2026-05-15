/**
 * Harness v1 — `session.skills.use()` (§4.6).
 *
 * Programmatic skill execution against the code-registered and
 * workspace-discovered catalogues. Code skills resolve by name first.
 * Workspace skills resolve by frontmatter name or workspace-relative path
 * unless a code skill owns the same name.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Workspace } from '../../workspace';

import { extractSignalContents, MockAgent, setupHarness } from './__test-utils__';
import {
  HarnessSessionClosedError,
  HarnessSkillArgsValidationError,
  HarnessSkillNotFoundError,
  HarnessValidationError,
} from './errors';
import { Harness } from './harness';
import type { HarnessConfig, HarnessRequestContext } from './types';
import type { WorkspaceProvider } from './workspace-provider';

// ---------------------------------------------------------------------------
// Workspace skill source mock (mirrors session.skills.test.ts but exposes
// the full Skill body — including `instructions` — that `use()` needs.)
// ---------------------------------------------------------------------------

type FakeSkillEntry = {
  name: string;
  description: string;
  path?: string;
  instructions: string;
  metadata?: Record<string, unknown>;
};

class FakeWorkspaceSkills {
  public listCallCount = 0;
  public getCalls: string[] = [];

  constructor(public entries: FakeSkillEntry[]) {}

  async list() {
    this.listCallCount++;
    return this.entries.map(e => ({
      name: e.name,
      description: e.description,
      path: e.path ?? `skills/${e.name}`,
      ...(e.metadata ? { metadata: e.metadata } : {}),
    }));
  }

  async get(ref: string) {
    this.getCalls.push(ref);
    // Resolution mirrors Flue's behaviour: either frontmatter name or the
    // workspace-relative path. The fake matches on both.
    const e = this.entries.find(x => x.name === ref || (x.path ?? `skills/${x.name}`) === ref);
    if (!e) return null;
    return {
      name: e.name,
      description: e.description,
      path: e.path ?? `skills/${e.name}`,
      instructions: e.instructions,
      source: { type: 'local' as const, projectPath: '/fake' },
      references: [],
      scripts: [],
      assets: [],
      ...(e.metadata ? { metadata: e.metadata } : {}),
    };
  }
  async has(ref: string) {
    return (await this.get(ref)) !== null;
  }
  async refresh() {}
  async maybeRefresh() {}
  async search() {
    return [];
  }
  async getReference() {
    return null;
  }
  async getScript() {
    return null;
  }
  async getAsset() {
    return null;
  }
  async listReferences() {
    return [];
  }
  async listScripts() {
    return [];
  }
  async listAssets() {
    return [];
  }
}

function makeWorkspaceWithSkills(skills: FakeWorkspaceSkills | null): Workspace {
  return {
    id: `ws-${Math.random().toString(36).slice(2, 8)}`,
    name: 'fake-ws',
    status: 'ready' as const,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    skills: skills ?? undefined,
    async init() {},
    async destroy() {},
  } as unknown as Workspace;
}

function resumableProviderFor(skills: FakeWorkspaceSkills | null): WorkspaceProvider {
  const ws = makeWorkspaceWithSkills(skills);
  return {
    providerId: 'p-skills-use',
    resumable: true,
    create: async () => ws,
    resume: async () => ws,
  };
}

function makeHarnessWithSkills(
  skills: FakeWorkspaceSkills,
  codeSkills?: HarnessConfig['skills'],
): {
  harness: Harness;
  agent: MockAgent;
} {
  const provider = resumableProviderFor(skills);
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const agent = new MockAgent({ id: 'default' });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'm', agentId: 'default' }],
    defaultModeId: 'm',
    sessions: { storage },
    workspace: { kind: 'per-session', provider },
    ...(codeSkills ? { skills: codeSkills } : {}),
  });
  return { harness, agent };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Session.skills.use() (§4.6)', () => {
  it('resolves a skill by frontmatter name and dispatches its instructions through message()', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'reproduce-bug', description: 'Repro', instructions: 'Reproduce the bug step by step.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const result = await session.skills.use('reproduce-bug');

    expect(result).toBeDefined();
    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Reproduce the bug step by step.');
    expect(fakeSkills.getCalls).toEqual(['reproduce-bug']);
  });

  it('runs a code-registered skill without a workspace', async () => {
    const { harness, agent } = setupHarness({
      skills: [{ name: 'code-only', description: 'Code only', instructions: 'Run the code skill.' }],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('code-only');

    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Run the code skill.');
  });

  it('prefers a code-registered skill when a workspace skill has the same name', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'shared',
        description: 'Workspace shared',
        path: 'skills/shared/SKILL.md',
        instructions: 'Workspace body.',
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills, [
      { name: 'shared', description: 'Code shared', instructions: 'Code body.' },
    ]);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('shared');

    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Code body.');
    expect(fakeSkills.getCalls).toEqual([]);
  });

  it('does not allow a shadowed workspace skill to bypass code precedence by path', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'shared',
        description: 'Workspace shared',
        path: 'skills/shared/SKILL.md',
        instructions: 'Workspace body.',
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills, [
      { name: 'shared', description: 'Code shared', instructions: 'Code body.' },
    ]);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('skills/shared/SKILL.md')).rejects.toMatchObject({
      searchedSources: ['code-registered', 'workspace'],
    });

    expect(agent.streamCalls).toHaveLength(0);
    expect(fakeSkills.getCalls).toEqual(['skills/shared/SKILL.md']);
  });

  it('does not treat a code skill filePath as a use() alias', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'deploy',
        description: 'Workspace deploy',
        path: 'skills/deploy/SKILL.md',
        instructions: 'Workspace deploy body.',
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills, [
      {
        name: 'code-deploy',
        description: 'Code deploy',
        filePath: 'deploy',
        instructions: 'Code deploy body.',
      },
    ]);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('deploy');

    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Workspace deploy body.');
    expect(fakeSkills.getCalls).toEqual(['deploy']);
  });

  it('resolves a skill by workspace-relative path', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'format',
        description: 'Format files',
        path: 'tools/format/SKILL.md',
        instructions: 'Format every file.',
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('tools/format/SKILL.md');

    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Format every file.');
    expect(fakeSkills.getCalls).toEqual(['tools/format/SKILL.md']);
  });

  it('appends provided args as a JSON code block to the skill instructions', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'lookup-ticket', description: 'Look up ticket', instructions: 'Look up ticket details.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('lookup-ticket', { args: { ticketId: 'ABC-123', urgent: true } });

    const expanded = extractSignalContents(agent.streamCalls[0]!.messages) as string;
    expect(expanded).toContain('Look up ticket details.');
    expect(expanded).toContain('```json');
    expect(expanded).toMatch(/"ticketId":\s*"ABC-123"/);
    expect(expanded).toMatch(/"urgent":\s*true/);
    expect(expanded).toContain('```');
  });

  it('omits the JSON block entirely when no args are provided', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'plain', description: 'Plain', instructions: 'Plain body.' }]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('plain');

    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Plain body.');
  });

  it('omits the JSON block when args is an empty object', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'plain', description: 'Plain', instructions: 'Plain body.' }]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('plain', { args: {} });

    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('Plain body.');
  });

  it('throws HarnessSkillNotFoundError when no skill matches the ref', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'exists', description: 'X', instructions: 'X.' }]);
    const { harness } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('does-not-exist')).rejects.toBeInstanceOf(HarnessSkillNotFoundError);
    await expect(session.skills.use('does-not-exist')).rejects.toMatchObject({
      searchedSources: ['code-registered', 'workspace'],
    });
  });

  it('throws HarnessSkillNotFoundError when the session has no workspace configured', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('whatever')).rejects.toBeInstanceOf(HarnessSkillNotFoundError);
    await expect(session.skills.use('whatever')).rejects.toMatchObject({ searchedSources: ['code-registered'] });
  });

  it('throws HarnessSkillArgsValidationError when required args are missing', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'needs-args',
        description: 'Needs args',
        instructions: 'Use the args.',
        metadata: { args: { required: ['ticketId', 'reason'] } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('needs-args', { args: { ticketId: 'X' } })).rejects.toBeInstanceOf(
      HarnessSkillArgsValidationError,
    );

    // No turn started.
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects non-object args before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'object-args', description: 'Object args', instructions: 'Object args body.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.skills.use('object-args', { args: [] as unknown as Record<string, unknown> }),
    ).rejects.toMatchObject({
      issues: ['args must be an object'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('validates type, enum, and additionalProperties before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'typed',
        description: 'Typed',
        instructions: 'Typed body.',
        metadata: {
          args: {
            required: ['ticketId'],
            additionalProperties: false,
            properties: {
              ticketId: { type: 'string' },
              priority: { enum: ['low', 'high'] },
              count: { type: 'integer' },
            },
          },
        },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.skills.use('typed', { args: { ticketId: 123, priority: 'urgent', extra: true } }),
    ).rejects.toMatchObject({
      issues: ['ticketId must be string', 'priority must be one of ["low","high"]', 'unsupported arg: "extra"'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('accepts object enum values by structural equality', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'object-enum',
        description: 'Object enum',
        instructions: 'Object enum body.',
        metadata: {
          args: {
            properties: {
              target: { type: 'object', enum: [{ env: 'prod', flags: ['fast'] }] },
            },
          },
        },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('object-enum', { args: { target: { env: 'prod', flags: ['fast'] } } });

    expect(agent.streamCalls).toHaveLength(1);
  });

  it('rejects undefined required and declared args', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'needs-defined',
        description: 'Needs defined',
        instructions: 'Defined body.',
        metadata: { args: { required: ['ticketId'], properties: { ticketId: { type: 'string' } } } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('needs-defined', { args: { ticketId: undefined } })).rejects.toMatchObject({
      issues: ['ticketId must be JSON-serializable', 'missing required arg: "ticketId"', 'ticketId must be string'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('does not let returned code skill descriptor mutation weaken validation', async () => {
    const { harness, agent } = setupHarness({
      skills: [
        {
          name: 'immutable',
          description: 'Immutable',
          instructions: 'Immutable body.',
          metadata: { args: { required: ['ticketId'] } },
        },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const descriptor = await session.skills.get('immutable');
    (descriptor!.metadata!.args as { required: string[] }).required = [];

    await expect(session.skills.use('immutable', { args: {} })).rejects.toMatchObject({
      issues: ['missing required arg: "ticketId"'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('enforces additionalProperties false even without declared properties', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'closed',
        description: 'Closed',
        instructions: 'Closed body.',
        metadata: { args: { additionalProperties: false } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('closed', { args: { extra: true } })).rejects.toMatchObject({
      issues: ['unsupported arg: "extra"'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects unsupported schema types before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'unsupported-type',
        description: 'Unsupported type',
        instructions: 'Unsupported type body.',
        metadata: { args: { type: 'date' } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('unsupported-type')).rejects.toMatchObject({
      issues: ['$.type must be a supported JSON schema type'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects non-plain args schema objects before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'non-plain-schema',
        description: 'Non-plain schema',
        instructions: 'Non-plain schema body.',
        metadata: { args: new Date() },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('non-plain-schema')).rejects.toMatchObject({
      issues: ['unsupported args schema: expected object'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects circular args schemas before dispatch', async () => {
    const argsSchema: Record<string, unknown> = { properties: {} };
    (argsSchema.properties as Record<string, unknown>).self = argsSchema;
    const { harness, agent } = setupHarness({
      skills: [
        {
          name: 'circular-schema',
          description: 'Circular schema',
          instructions: 'Circular schema body.',
          metadata: { args: argsSchema },
        },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('circular-schema', { args: {} })).rejects.toMatchObject({
      issues: ['self must not contain circular args schema references'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects unsupported top-level args schema fields before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'minimum',
        description: 'Minimum',
        instructions: 'Minimum body.',
        metadata: { args: { minimum: 1 } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('minimum')).rejects.toMatchObject({
      issues: ['$.minimum is not a supported args schema field'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects unsupported nested args schema fields even when args omit those properties', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'nested-shape',
        description: 'Nested shape',
        instructions: 'Nested shape body.',
        metadata: {
          args: {
            properties: {
              query: { type: 'string', pattern: '^PF-' },
              tags: { type: 'array', items: { type: 'string', minLength: 1 } },
            },
          },
        },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('nested-shape', { args: {} })).rejects.toMatchObject({
      issues: [
        'query.pattern is not a supported args schema field',
        'tags[].minLength is not a supported args schema field',
      ],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects non-JSON enum schema values before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'bad-enum',
        description: 'Bad enum',
        instructions: 'Bad enum body.',
        metadata: { args: { properties: { value: { enum: [1n] } } } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('bad-enum', { args: {} })).rejects.toMatchObject({
      issues: ['value.enum[0] must be JSON-serializable'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects non-JSON args before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'json-only', description: 'JSON only', instructions: 'JSON only body.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('json-only', { args: { bad: 1n } })).rejects.toMatchObject({
      issues: ['bad must be JSON-serializable'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('rejects own toJSON args before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'no-to-json', description: 'No toJSON', instructions: 'No toJSON body.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.skills.use('no-to-json', { args: { value: { toJSON: () => 'hidden' } } }),
    ).rejects.toMatchObject({
      issues: ['value.toJSON is not supported in skill args'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('accepts JSON data fields named toJSON', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'json-field', description: 'JSON field', instructions: 'JSON field body.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('json-field', { args: { value: { toJSON: 'literal' } } });

    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toContain('"toJSON": "literal"');
  });

  it('rejects circular args before dispatch', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'no-cycles', description: 'No cycles', instructions: 'No cycles body.' },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const args: Record<string, unknown> = {};
    args.self = args;

    await expect(session.skills.use('no-cycles', { args })).rejects.toMatchObject({
      issues: ['self must not contain circular references'],
    });
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('accepts the call when every required arg is supplied', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'needs-args',
        description: 'Needs args',
        instructions: 'Body.',
        metadata: { args: { required: ['ticketId'] } },
      },
    ]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('needs-args', { args: { ticketId: 'OK' } });
    expect(agent.streamCalls).toHaveLength(1);
  });

  it('rejects empty / non-string refs', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'x', description: 'x', instructions: 'x' }]);
    const { harness } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.skills.use('')).rejects.toBeInstanceOf(HarnessValidationError);
    // @ts-expect-error — runtime validation guards against bad inputs
    await expect(session.skills.use(undefined)).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('throws HarnessSessionClosedError after the session is closed', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'x', description: 'x', instructions: 'x' }]);
    const { harness } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();

    await expect(session.skills.use('x')).rejects.toBeInstanceOf(HarnessSessionClosedError);
  });

  it('accepts modelOverride and still dispatches a single turn', async () => {
    // `message()` itself owns the model-override plumbing through to the
    // underlying agent.stream() call. This test pins the skills layer
    // contract: passing `modelOverride` must not break dispatch or
    // duplicate the turn.
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'x', description: 'x', instructions: 'body' }]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.skills.use('x', { modelOverride: 'openai/gpt-4o-mini' });

    expect(agent.streamCalls).toHaveLength(1);
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('body');
  });

  it('exposes ctx.useSkill through the per-turn request context', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'callme', description: 'd', instructions: 'CALLED' }]);
    const { harness, agent } = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'prime context' });
    const harnessContext = agent.streamCalls[0]!.options.requestContext.get('harness') as HarnessRequestContext;
    await harnessContext.useSkill('callme');

    expect(agent.streamCalls).toHaveLength(2);
    expect(extractSignalContents(agent.streamCalls[1]!.messages)).toBe('CALLED');
  });
});
