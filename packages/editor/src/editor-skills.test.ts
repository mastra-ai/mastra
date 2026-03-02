import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import type { SkillSource, SkillSourceStat, SkillSourceEntry } from '@mastra/core/workspace';
import { MastraModelGateway, ProviderConfig } from '@mastra/core/llm';
import { convertArrayToReadableStream, LanguageModelV2, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MastraEditor } from './index';

// =============================================================================
// Helpers
// =============================================================================

const mockLogger = () => ({
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
  trackException: vi.fn(),
});

let testStorageCount = 0;
const createSetup = async () => {
  const storage = new LibSQLStore({ id: `skill-test-${testStorageCount++}`, url: ':memory:' });
  const editor = new MastraEditor({ logger: mockLogger() as any });
  const mastra = new Mastra({ storage, editor });
  await storage.init();
  return { storage, editor, mastra };
};

// =============================================================================
// Mock SkillSource helper
// =============================================================================

function createMockSkillSource(files: Record<string, string>): SkillSource {
  // files keyed by relative path, e.g. 'my-skill/SKILL.md', 'my-skill/references/api.md'
  // Build a directory set from the file paths
  const dirs = new Set<string>(['']);
  for (const p of Object.keys(files)) {
    const parts = p.split('/');
    for (let i = 1; i <= parts.length - 1; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }

  return {
    exists: async (p: string) => {
      const normalized = p.replace(/^\.\//, '').replace(/^\//, '');
      return files.hasOwnProperty(normalized) || dirs.has(normalized);
    },
    stat: async (p: string): Promise<SkillSourceStat> => {
      const normalized = p.replace(/^\.\//, '').replace(/^\//, '');
      if (files.hasOwnProperty(normalized)) {
        const name = normalized.split('/').pop()!;
        return {
          name,
          type: 'file' as const,
          size: Buffer.byteLength(files[normalized]!, 'utf-8'),
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      if (dirs.has(normalized)) {
        const name = normalized.split('/').pop() || normalized;
        return {
          name,
          type: 'directory' as const,
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      throw new Error(`Not found: ${p}`);
    },
    readFile: async (p: string): Promise<string> => {
      const normalized = p.replace(/^\.\//, '').replace(/^\//, '');
      if (!files.hasOwnProperty(normalized)) throw new Error(`Not found: ${p}`);
      return files[normalized]!;
    },
    readdir: async (p: string): Promise<SkillSourceEntry[]> => {
      const normalized = p.replace(/^\.\//, '').replace(/^\//, '');
      const prefix = normalized === '' ? '' : normalized + '/';
      const entries = new Map<string, 'file' | 'directory'>();

      for (const filePath of Object.keys(files)) {
        if (!filePath.startsWith(prefix)) continue;
        const rest = filePath.substring(prefix.length);
        const slashIdx = rest.indexOf('/');
        if (slashIdx === -1) {
          entries.set(rest, 'file');
        } else {
          entries.set(rest.substring(0, slashIdx), 'directory');
        }
      }

      return Array.from(entries).map(([name, type]) => ({ name, type }));
    },
  };
}

function buildSkillMd(meta: { name: string; description: string; license?: string }, body: string): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  lines.push('', body);
  return lines.join('\n');
}

// =============================================================================
// Mock LLM helpers for agent resolution tests
// =============================================================================

const createMockLLM = (
  responses: Array<{ text?: string; toolCall?: { name: string; args: Record<string, unknown> } }>,
): MockLanguageModelV2 => {
  let responseIndex = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const response = responses[responseIndex] || { text: 'Default response' };
      if (responseIndex < responses.length - 1) responseIndex++;
      const content: any[] = [];
      if (response.text) content.push({ type: 'text', text: response.text });
      if (response.toolCall) {
        content.push({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: `call_${Date.now()}`,
          toolName: response.toolCall.name,
          input: JSON.stringify(response.toolCall.args),
          providerExecuted: false,
        });
      }
      return {
        content,
        finishReason: response.toolCall ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 10, outputTokens: 10 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
    doStream: async () => {
      const response = responses[responseIndex] || { text: 'Default response' };
      if (responseIndex < responses.length - 1) responseIndex++;
      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'mock-id', modelId: 'mock', timestamp: new Date() },
      ];
      if (response.text) {
        chunks.push(
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: response.text },
          { type: 'text-end', id: 'text-1' },
        );
      }
      if (response.toolCall) {
        chunks.push({
          type: 'tool-call',
          toolCallId: `call_${Date.now()}`,
          toolName: response.toolCall.name,
          input: JSON.stringify(response.toolCall.args),
          providerExecuted: false,
        });
      }
      chunks.push({
        type: 'finish',
        finishReason: response.toolCall ? 'tool-calls' : 'stop',
        usage: { inputTokens: 10, outputTokens: 10 },
      });
      return {
        stream: convertArrayToReadableStream(chunks),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
};

class MockGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Mock Gateway';
  private llmOverrides: Record<string, MockLanguageModelV2> = {};
  setLLM(modelId: string, llm: MockLanguageModelV2) {
    this.llmOverrides[modelId] = llm;
  }
  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      mock: { name: 'Mock Provider', models: ['mock-model'], apiKeyEnvVar: 'MOCK_API_KEY', gateway: 'models.dev' },
    };
  }
  buildUrl(): string {
    return 'https://api.mock-gateway.com/v1';
  }
  getApiKey(): Promise<string> {
    return Promise.resolve(process.env.MOCK_API_KEY || 'MOCK_API_KEY');
  }
  async resolveEmbeddingModel(): Promise<any> {
    return {
      specificationVersion: 'v2',
      modelId: 'mock-embedding',
      provider: 'mock',
      maxEmbeddingsPerCall: 2048,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: any[] }) => ({
        embeddings: values.map(() => new Array(1536).fill(0).map(() => Math.random())),
      }),
    };
  }
  async resolveLanguageModel({
    modelId,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const key = modelId.replace('mock/', '');
    if (this.llmOverrides[key]) return this.llmOverrides[key];
    return createMockLLM([{ text: 'Default mock response' }]);
  }
}

// =============================================================================
// Skill CRUD Tests
// =============================================================================

describe('editor.skill — CRUD', () => {
  it('should create and retrieve a skill', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-1',
        name: 'code-review',
        description: 'Reviews code for common issues',
        instructions: 'Review the provided code for bugs, style issues, and potential improvements.',
        license: 'MIT',
        compatibility: '>=1.0.0',
      },
    });

    const resolved = await editor.skill.getById('skill-1');
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe('code-review');
    expect(resolved!.description).toBe('Reviews code for common issues');
    expect(resolved!.instructions).toBe('Review the provided code for bugs, style issues, and potential improvements.');
    expect(resolved!.license).toBe('MIT');
  });

  it('should list skills', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-list-1',
        name: 'skill-a',
        description: 'Skill A',
        instructions: 'A instructions',
      },
    });
    await skillStore!.create({
      skill: {
        id: 'skill-list-2',
        name: 'skill-b',
        description: 'Skill B',
        instructions: 'B instructions',
      },
    });

    const result = await editor.skill.list({});
    expect(result.skills).toHaveLength(2);
  });

  it('should update a skill', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-upd',
        name: 'before-update',
        description: 'Before',
        instructions: 'Original instructions',
      },
    });

    await editor.skill.update({
      id: 'skill-upd',
      name: 'after-update',
      description: 'After',
      instructions: 'Updated instructions',
    });

    const resolved = await editor.skill.getById('skill-upd');
    expect(resolved!.name).toBe('after-update');
    expect(resolved!.description).toBe('After');
    expect(resolved!.instructions).toBe('Updated instructions');
  });

  it('should delete a skill', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-del',
        name: 'to-delete',
        description: 'Delete me',
        instructions: 'Some instructions',
      },
    });

    const before = await editor.skill.getById('skill-del');
    expect(before).toBeDefined();

    await editor.skill.delete('skill-del');

    const after = await editor.skill.getById('skill-del');
    expect(after).toBeNull();
  });

  it('should list resolved skills with active version data', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-resolved',
        name: 'resolved-skill',
        description: 'Fully resolved',
        instructions: 'Test instructions for resolved skill',
        source: { type: 'local', projectPath: '/home/user/skills/my-skill' },
        references: ['ref1.md', 'ref2.md'],
        scripts: ['build.sh'],
        assets: ['logo.png'],
      },
    });

    const result = await editor.skill.listResolved({});
    expect(result.skills).toHaveLength(1);

    const skill = result.skills[0]!;
    expect(skill.name).toBe('resolved-skill');
    expect(skill.instructions).toBe('Test instructions for resolved skill');
    expect(skill.source).toEqual({ type: 'local', projectPath: '/home/user/skills/my-skill' });
    expect(skill.references).toEqual(['ref1.md', 'ref2.md']);
    expect(skill.scripts).toEqual(['build.sh']);
    expect(skill.assets).toEqual(['logo.png']);
  });

  it('should create a skill via editor.skill.create()', async () => {
    const { editor } = await createSetup();

    const resolved = await editor.skill.create({
      id: 'skill-created',
      name: 'created-skill',
      description: 'A skill created via editor',
      instructions: 'These are the instructions for the created skill.',
      metadata: { category: 'testing' },
    });

    expect(resolved).toBeDefined();
    expect(resolved.id).toBe('skill-created');
    expect(resolved.name).toBe('created-skill');

    // Retrieve to verify it persisted
    const fetched = await editor.skill.getById('skill-created');
    expect(fetched!.instructions).toBe('These are the instructions for the created skill.');
  });

  it('should handle skills with source types', async () => {
    const { editor } = await createSetup();

    // External source
    const externalSkill = await editor.skill.create({
      id: 'skill-external',
      name: 'external-skill',
      description: 'From npm',
      instructions: 'External package instructions',
      source: { type: 'external', packagePath: 'node_modules/@skills/code-review' },
    });
    expect(externalSkill.source!.type).toBe('external');

    // Managed source
    const managedSkill = await editor.skill.create({
      id: 'skill-managed',
      name: 'managed-skill',
      description: 'Managed by Mastra',
      instructions: 'Managed skill instructions',
      source: { type: 'managed', mastraPath: '.mastra/skills/my-skill' },
    });
    expect(managedSkill.source!.type).toBe('managed');

    // Local source
    const localSkill = await editor.skill.create({
      id: 'skill-local',
      name: 'local-skill',
      description: 'Local project skill',
      instructions: 'Local skill instructions',
      source: { type: 'local', projectPath: 'skills/my-local-skill' },
    });
    expect(localSkill.source!.type).toBe('local');
  });
});

// =============================================================================
// Skill Cache Tests
// =============================================================================

describe('editor.skill — cache', () => {
  it('should cache skill on getById and return from cache on second call', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-cache',
        name: 'cached-skill',
        description: 'Test caching',
        instructions: 'Cache me',
      },
    });

    const first = await editor.skill.getById('skill-cache');
    const second = await editor.skill.getById('skill-cache');

    // Same reference = served from cache
    expect(first).toBe(second);
  });

  it('should invalidate cache on update', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-cache-inv',
        name: 'cached-skill',
        description: 'Before',
        instructions: 'Old instructions',
      },
    });

    const first = await editor.skill.getById('skill-cache-inv');
    expect(first!.description).toBe('Before');

    await editor.skill.update({
      id: 'skill-cache-inv',
      description: 'After',
    });

    const second = await editor.skill.getById('skill-cache-inv');
    expect(second!.description).toBe('After');
    expect(first).not.toBe(second);
  });

  it('should clear all cache entries', async () => {
    const { editor, storage } = await createSetup();

    const skillStore = await storage.getStore('skills');
    await skillStore!.create({
      skill: {
        id: 'skill-clear-1',
        name: 'clear-1',
        description: 'Clear 1',
        instructions: 'Instructions 1',
      },
    });
    await skillStore!.create({
      skill: {
        id: 'skill-clear-2',
        name: 'clear-2',
        description: 'Clear 2',
        instructions: 'Instructions 2',
      },
    });

    // Populate cache
    await editor.skill.getById('skill-clear-1');
    await editor.skill.getById('skill-clear-2');

    // Clear all
    editor.skill.clearCache();

    // Subsequent calls should re-fetch from storage
    const after1 = await editor.skill.getById('skill-clear-1');
    const after2 = await editor.skill.getById('skill-clear-2');
    expect(after1).toBeDefined();
    expect(after2).toBeDefined();
  });
});

// =============================================================================
// Skill Publish Flow Tests
// =============================================================================

describe('editor.skill — publish flow', () => {
  it('should publish a skill from a mock source', async () => {
    const { editor } = await createSetup();

    // Create a skill via CRUD
    await editor.skill.create({
      id: 'pub-skill-1',
      name: 'pub-skill',
      description: 'A publishable skill',
      instructions: 'Initial instructions',
    });

    // Build a mock source with SKILL.md
    const skillMd = buildSkillMd(
      { name: 'pub-skill', description: 'A publishable skill' },
      'These are the published instructions.',
    );
    const source = createMockSkillSource({
      'my-skill/SKILL.md': skillMd,
    });

    // Publish
    const published = await editor.skill.publish('pub-skill-1', source, 'my-skill');

    expect(published).toBeDefined();
    expect(published.status).toBe('published');
    expect(published.tree).toBeDefined();
    expect(published.tree!.entries).toHaveProperty('SKILL.md');
    expect(published.instructions).toBe('These are the published instructions.');
  });

  it('should store blobs in blob storage', async () => {
    const { editor, storage } = await createSetup();

    await editor.skill.create({
      id: 'pub-blob-1',
      name: 'blob-skill',
      description: 'Blob test skill',
      instructions: 'Initial',
    });

    const skillMd = buildSkillMd({ name: 'blob-skill', description: 'Blob test skill' }, 'Blob instructions body.');
    const source = createMockSkillSource({
      'my-skill/SKILL.md': skillMd,
    });

    const published = await editor.skill.publish('pub-blob-1', source, 'my-skill');

    // Verify blobs are stored
    const blobStore = await storage.getStore('blobs');
    expect(blobStore).toBeDefined();

    const treeEntry = published.tree!.entries['SKILL.md']!;
    const blob = await blobStore!.get(treeEntry.blobHash);
    expect(blob).toBeDefined();
    expect(blob!.content).toBe(skillMd);
  });

  it('should publish skill with references and assets', async () => {
    const { editor } = await createSetup();

    await editor.skill.create({
      id: 'pub-refs-1',
      name: 'refs-skill',
      description: 'Skill with refs',
      instructions: 'Initial',
    });

    const skillMd = buildSkillMd(
      { name: 'refs-skill', description: 'Skill with refs' },
      'Instructions with references.',
    );
    const source = createMockSkillSource({
      'my-skill/SKILL.md': skillMd,
      'my-skill/references/api.md': '# API Reference\nSome API docs.',
      'my-skill/assets/logo.txt': 'LOGO_PLACEHOLDER',
    });

    const published = await editor.skill.publish('pub-refs-1', source, 'my-skill');

    // Verify tree has all 3 files
    expect(published.tree!.entries).toHaveProperty('SKILL.md');
    expect(published.tree!.entries).toHaveProperty('references/api.md');
    expect(published.tree!.entries).toHaveProperty('assets/logo.txt');

    // Verify snapshot references and assets
    expect(published.references).toContain('api.md');
    expect(published.assets).toContain('logo.txt');
  });

  it('should deduplicate blobs across publishes', async () => {
    const { editor, storage } = await createSetup();

    await editor.skill.create({
      id: 'pub-dedup-1',
      name: 'dedup-skill',
      description: 'Dedup test',
      instructions: 'Initial',
    });

    const skillMd = buildSkillMd({ name: 'dedup-skill', description: 'Dedup test' }, 'Same instructions both times.');
    const source = createMockSkillSource({
      'my-skill/SKILL.md': skillMd,
    });

    // Publish twice with the same content
    const pub1 = await editor.skill.publish('pub-dedup-1', source, 'my-skill');
    const pub2 = await editor.skill.publish('pub-dedup-1', source, 'my-skill');

    // Both should have the same blob hash for SKILL.md
    const hash1 = pub1.tree!.entries['SKILL.md']!.blobHash;
    const hash2 = pub2.tree!.entries['SKILL.md']!.blobHash;
    expect(hash1).toBe(hash2);

    // Blob store should have only one blob for this hash (not duplicated)
    const blobStore = await storage.getStore('blobs');
    const blob = await blobStore!.get(hash1);
    expect(blob).toBeDefined();
    expect(blob!.content).toBe(skillMd);
  });

  it('should update activeVersionId on publish', async () => {
    const { editor } = await createSetup();

    await editor.skill.create({
      id: 'pub-version-1',
      name: 'version-skill',
      description: 'Version test',
      instructions: 'Initial',
    });

    const skillMd = buildSkillMd({ name: 'version-skill', description: 'Version test' }, 'Published instructions.');
    const source = createMockSkillSource({
      'my-skill/SKILL.md': skillMd,
    });

    await editor.skill.publish('pub-version-1', source, 'my-skill');

    // Get the resolved skill and verify it has the published data
    const resolved = await editor.skill.getById('pub-version-1');
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('published');
    // The publish flow sets status to 'published' and the tree is present
    expect(resolved!.tree).toBeDefined();
  });
});

// =============================================================================
// Agent Resolution Strategies Tests
// =============================================================================

describe('editor.skill — agent resolution strategies', () => {
  let gateway: MockGateway;

  beforeEach(() => {
    gateway = new MockGateway();
    process.env.MOCK_API_KEY = `test-key-${Date.now()}-${Math.random()}`;
  });

  afterEach(() => {
    delete process.env.MOCK_API_KEY;
  });

  const createAgentSetup = async () => {
    const storage = new LibSQLStore({ id: `skill-agent-${testStorageCount++}`, url: ':memory:' });
    const editor = new MastraEditor({ logger: mockLogger() as any });
    const mastra = new Mastra({
      storage,
      editor,
      gateways: { 'models.dev': gateway },
    });
    await storage.init();
    return { storage, editor, mastra };
  };

  it('should resolve agent with strategy: latest skill', async () => {
    const { editor, storage } = await createAgentSetup();

    // 1. Create a skill
    await editor.skill.create({
      id: 'agent-skill-1',
      name: 'agent-skill',
      description: 'Skill for agent',
      instructions: 'Initial instructions',
    });

    // 2. Publish it (populates tree + blobs)
    const skillMd = buildSkillMd(
      { name: 'agent-skill', description: 'Skill for agent' },
      'Published agent skill instructions.',
    );
    const source = createMockSkillSource({
      'agent-skill/SKILL.md': skillMd,
    });
    await editor.skill.publish('agent-skill-1', source, 'agent-skill');

    // 3. Create agent with skills: { 'agent-skill-1': { strategy: 'latest' } }
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-latest-1',
        name: 'Agent With Latest Skill',
        instructions: 'You are a test agent',
        model: { provider: 'mock', name: 'mock-model' },
        skills: { 'agent-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Skills WS',
            skills: ['agent-skill-1'],
          },
        },
      },
    });

    // 4. Get agent via editor.agent.getById
    const agent = await editor.agent.getById('agent-latest-1');
    expect(agent).toBeInstanceOf(Agent);

    // 5. The agent should have a workspace
    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);

    // 6. Workspace skills should discover the skill from the versioned source
    const skills = await workspace!.skills!.list();
    expect(skills.length).toBeGreaterThanOrEqual(1);
    expect(skills.some(s => s.name === 'agent-skill')).toBe(true);
  });

  it('should resolve agent with pin strategy', async () => {
    const { editor, storage } = await createAgentSetup();

    // 1. Create and publish a skill
    await editor.skill.create({
      id: 'pin-skill-1',
      name: 'pin-skill',
      description: 'Pinned skill',
      instructions: 'Initial',
    });

    const skillMd = buildSkillMd({ name: 'pin-skill', description: 'Pinned skill' }, 'Pinned skill instructions.');
    const source = createMockSkillSource({
      'pin-skill/SKILL.md': skillMd,
    });
    await editor.skill.publish('pin-skill-1', source, 'pin-skill');

    // 2. Get the version ID from the skill's latest version
    const skillStore = await storage.getStore('skills');
    const latestVersion = await skillStore!.getLatestVersion('pin-skill-1');
    expect(latestVersion).toBeDefined();
    const versionId = latestVersion!.id;

    // 3. Create agent with pin strategy
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-pin-1',
        name: 'Agent With Pinned Skill',
        instructions: 'You are a test agent',
        model: { provider: 'mock', name: 'mock-model' },
        skills: { 'pin-skill-1': { pin: versionId } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Pin WS',
            skills: ['pin-skill-1'],
          },
        },
      },
    });

    // 4. Get agent, verify workspace has skills
    const agent = await editor.agent.getById('agent-pin-1');
    expect(agent).toBeInstanceOf(Agent);

    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);

    const skills = await workspace!.skills!.list();
    expect(skills.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip skills with strategy: live', async () => {
    const { editor, storage } = await createAgentSetup();

    // Create agent with live strategy — no versioned source should be created
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-live-1',
        name: 'Agent With Live Skill',
        instructions: 'You are a test agent',
        model: { provider: 'mock', name: 'mock-model' },
        skills: { 'some-skill': { strategy: 'live' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Live WS',
            skills: ['some-skill'],
          },
        },
      },
    });

    // Agent should still be created successfully
    const agent = await editor.agent.getById('agent-live-1');
    expect(agent).toBeInstanceOf(Agent);

    // Workspace should exist but skills won't have versioned source
    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);
  });

  it('should handle missing skill version gracefully', async () => {
    const { editor, storage } = await createAgentSetup();

    // Create agent referencing a nonexistent skill with latest strategy
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-missing-1',
        name: 'Agent With Missing Skill',
        instructions: 'You are a test agent',
        model: { provider: 'mock', name: 'mock-model' },
        skills: { nonexistent: { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Missing WS',
            skills: ['nonexistent'],
          },
        },
      },
    });

    // Agent should still be created (graceful degradation)
    const agent = await editor.agent.getById('agent-missing-1');
    expect(agent).toBeInstanceOf(Agent);
  });
});

// =============================================================================
// End-to-End: publish → agent → skill discovery
// =============================================================================

describe('editor.skill — end-to-end: publish → agent → skill discovery', () => {
  let gateway: MockGateway;

  beforeEach(() => {
    gateway = new MockGateway();
    process.env.MOCK_API_KEY = `test-key-${Date.now()}-${Math.random()}`;
  });

  afterEach(() => {
    delete process.env.MOCK_API_KEY;
  });

  const createE2ESetup = async () => {
    const storage = new LibSQLStore({ id: `skill-e2e-${testStorageCount++}`, url: ':memory:' });
    const editor = new MastraEditor({ logger: mockLogger() as any });
    const mastra = new Mastra({
      storage,
      editor,
      gateways: { 'models.dev': gateway },
    });
    await storage.init();
    return { storage, editor, mastra };
  };

  it('should discover published skills through agent workspace', async () => {
    const { editor, storage } = await createE2ESetup();

    // 1. Create a skill in the DB
    await editor.skill.create({
      id: 'e2e-skill-1',
      name: 'e2e-skill',
      description: 'End-to-end test skill',
      instructions: 'Initial instructions',
    });

    // 2. Publish it from a mock source (creates blobs + tree)
    const skillBody = 'These are the end-to-end published instructions.\n\nThey span multiple lines.';
    const skillMd = buildSkillMd({ name: 'e2e-skill', description: 'End-to-end test skill' }, skillBody);
    const source = createMockSkillSource({
      'e2e-skill/SKILL.md': skillMd,
      'e2e-skill/references/guide.md': '# Guide\nThis is a reference guide.',
    });
    await editor.skill.publish('e2e-skill-1', source, 'e2e-skill');

    // 3. Create an agent that references the skill with strategy: 'latest'
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'e2e-agent-1',
        name: 'E2E Agent',
        instructions: 'You are an end-to-end test agent',
        model: { provider: 'mock', name: 'mock-model' },
        skills: { 'e2e-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'E2E Workspace',
            skills: ['e2e-skill-1'],
          },
        },
      },
    });

    // 4. Hydrate the agent via editor.agent.getById
    const agent = await editor.agent.getById('e2e-agent-1');
    expect(agent).toBeInstanceOf(Agent);

    // 5. Access workspace
    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace!.skills).toBeDefined();

    // 6. Verify the skill was discovered from the blob store
    const skills = await workspace!.skills!.list();
    expect(skills.length).toBeGreaterThanOrEqual(1);
    const discoveredSkill = skills.find(s => s.name === 'e2e-skill');
    expect(discoveredSkill).toBeDefined();
    expect(discoveredSkill!.description).toBe('End-to-end test skill');

    // 7. Get full skill details
    const fullSkill = await workspace!.skills!.get('e2e-skill');
    expect(fullSkill).toBeDefined();
    expect(fullSkill!.instructions).toBe(skillBody);

    // 8. Verify references are discovered (they come from the blob store via VersionedSkillSource)
    expect(fullSkill!.references).toBeDefined();
    expect(fullSkill!.references!.length).toBeGreaterThanOrEqual(1);
    expect(fullSkill!.references).toContain('guide.md');

    // 9. Verify reference content can be read from the blob store
    const guideContent = await workspace!.skills!.getReference('e2e-skill', 'references/guide.md');
    expect(guideContent).toBeDefined();
    expect(guideContent).toContain('This is a reference guide.');
  });

  it('should serve correct content from blob store for multi-file skills', async () => {
    const { editor, storage } = await createE2ESetup();

    await editor.skill.create({
      id: 'e2e-multi-1',
      name: 'multi-file-skill',
      description: 'Multi-file skill',
      instructions: 'Initial',
    });

    const skillMd = buildSkillMd(
      { name: 'multi-file-skill', description: 'Multi-file skill' },
      'Multi-file instructions.',
    );
    const source = createMockSkillSource({
      'multi-file-skill/SKILL.md': skillMd,
      'multi-file-skill/references/api.md': '# API\nAPI documentation.',
      'multi-file-skill/references/faq.md': '# FAQ\nFrequently asked questions.',
      'multi-file-skill/assets/config.txt': 'key=value',
    });
    await editor.skill.publish('e2e-multi-1', source, 'multi-file-skill');

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'e2e-multi-agent',
        name: 'Multi-File Agent',
        instructions: 'Test agent',
        model: { provider: 'mock', name: 'mock-model' },
        skills: { 'e2e-multi-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Multi WS',
            skills: ['e2e-multi-1'],
          },
        },
      },
    });

    const agent = await editor.agent.getById('e2e-multi-agent');
    const workspace = await agent!.getWorkspace({});
    const fullSkill = await workspace!.skills!.get('multi-file-skill');

    expect(fullSkill).toBeDefined();
    expect(fullSkill!.instructions).toBe('Multi-file instructions.');
    expect(fullSkill!.references!.length).toBe(2);
  });
});

// =============================================================================
// Version Switching via Update Tests
// =============================================================================

describe('editor.skill — version switching via update', () => {
  it('should switch active version by updating activeVersionId', async () => {
    const { editor, storage } = await createSetup();

    // 1. Create a skill and publish it (version 1)
    await editor.skill.create({
      id: 'switch-skill-1',
      name: 'switch-skill',
      description: 'Version switch test',
      instructions: 'Version 1 instructions',
    });

    const skillMdV1 = buildSkillMd(
      { name: 'switch-skill', description: 'Version switch test' },
      'Version 1 published instructions.',
    );
    const sourceV1 = createMockSkillSource({
      'switch-skill/SKILL.md': skillMdV1,
    });
    await editor.skill.publish('switch-skill-1', sourceV1, 'switch-skill');

    // 2. Update the skill content (creates version 2 in the version table)
    await editor.skill.update({
      id: 'switch-skill-1',
      instructions: 'Version 2 instructions',
    });

    // 3. Publish again with new content (creates version 3 with new tree)
    const skillMdV3 = buildSkillMd(
      { name: 'switch-skill', description: 'Version switch test' },
      'Version 3 published instructions.',
    );
    const sourceV3 = createMockSkillSource({
      'switch-skill/SKILL.md': skillMdV3,
    });
    await editor.skill.publish('switch-skill-1', sourceV3, 'switch-skill');

    // 4. Get version IDs
    const skillStore = await storage.getStore('skills');
    const versions = await skillStore!.listVersions({ skillId: 'switch-skill-1' });
    expect(versions.versions.length).toBeGreaterThanOrEqual(2);

    // Find version 1 (the first version)
    const version1 = versions.versions.find(v => v.versionNumber === 1);
    expect(version1).toBeDefined();

    // 5. Switch back to version 1
    await editor.skill.update({
      id: 'switch-skill-1',
      activeVersionId: version1!.id,
    });

    // 6. Verify resolved skill now has version 1's content
    const resolved = await editor.skill.getById('switch-skill-1');
    expect(resolved).toBeDefined();
    expect(resolved!.instructions).toBe('Version 1 instructions');
  });

  it('should maintain published status after version switch', async () => {
    const { editor, storage } = await createSetup();

    await editor.skill.create({
      id: 'status-skill-1',
      name: 'status-skill',
      description: 'Status test',
      instructions: 'Initial instructions',
    });

    const skillMd = buildSkillMd({ name: 'status-skill', description: 'Status test' }, 'Published instructions.');
    const source = createMockSkillSource({
      'status-skill/SKILL.md': skillMd,
    });
    await editor.skill.publish('status-skill-1', source, 'status-skill');

    // Get version 1 ID
    const skillStore = await storage.getStore('skills');
    const version1 = await skillStore!.getVersionByNumber('status-skill-1', 1);
    expect(version1).toBeDefined();

    // Switch to version 1 — status should become 'published' (auto-set when activeVersionId is set)
    await editor.skill.update({
      id: 'status-skill-1',
      activeVersionId: version1!.id,
    });

    const resolved = await editor.skill.getById('status-skill-1');
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('published');
  });
});

// =============================================================================
// Agent Execution Integration Tests — Skills in LLM System Prompt
// =============================================================================
// These tests verify the full E2E flow: publish skill → create agent with
// workspace + skills → agent.generate() → verify SkillsProcessor injected
// skill metadata into the LLM system prompt. They also test draft vs. published
// visibility, pin vs. latest serving different content, version rollback, and
// skill tool execution with versioned sources.

describe('editor.skill — agent execution integration', () => {
  let gateway: MockGateway;

  beforeEach(() => {
    gateway = new MockGateway();
    process.env.MOCK_API_KEY = `test-key-${Date.now()}-${Math.random()}`;
  });

  afterEach(() => {
    delete process.env.MOCK_API_KEY;
  });

  const createExecSetup = async (extraTools?: Record<string, any>) => {
    const storage = new LibSQLStore({ id: `skill-exec-${testStorageCount++}`, url: ':memory:' });
    const editor = new MastraEditor({ logger: mockLogger() as any });
    const mastra = new Mastra({
      storage,
      editor,
      gateways: { 'models.dev': gateway },
      tools: extraTools ?? {},
    });
    await storage.init();
    return { storage, editor, mastra };
  };

  // Helper: create a mock LLM that captures the full prompt sent to it
  const createCapturingLLM = (capturedPrompts: Array<any[]>) => {
    return new MockLanguageModelV2({
      doGenerate: async (params: any) => {
        capturedPrompts.push(params.prompt);
        return {
          content: [{ type: 'text', text: 'Agent response.' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async (params: any) => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'mock-id', modelId: 'mock', timestamp: new Date() },
          { type: 'text-start' as const, sourceType: 'generated' },
          { type: 'text-delta' as const, textDelta: 'ok' },
          { type: 'text-end' as const },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: { inputTokens: 10, outputTokens: 10 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
  };

  // Helper: extract all system message content from a captured prompt
  const extractSystemContent = (prompt: any[]): string => {
    return prompt
      .filter((msg: any) => msg.role === 'system')
      .map((msg: any) => {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
          return msg.content.map((p: any) => p.text || '').join('');
        }
        return '';
      })
      .join('\n');
  };

  // ---------------------------------------------------------------------------
  // Test 1: E2E publish → agent.generate() → skill metadata in system prompt
  // ---------------------------------------------------------------------------
  it('should inject published skill metadata into LLM system prompt during agent.generate()', async () => {
    const capturedPrompts: Array<any[]> = [];
    gateway.setLLM('skill-prompt-mock', createCapturingLLM(capturedPrompts));

    const { editor, storage } = await createExecSetup();

    // 1. Create and publish a skill
    await editor.skill.create({
      id: 'exec-skill-1',
      name: 'code-review',
      description: 'Reviews code for bugs and style issues',
      instructions: 'Analyze code carefully for potential bugs.',
    });

    const skillMd = buildSkillMd(
      { name: 'code-review', description: 'Reviews code for bugs and style issues' },
      'Analyze code carefully for potential bugs.',
    );
    const source = createMockSkillSource({
      'code-review/SKILL.md': skillMd,
    });
    await editor.skill.publish('exec-skill-1', source, 'code-review');

    // 2. Create agent with workspace + published skill (strategy: latest)
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'exec-agent-1',
        name: 'Code Review Agent',
        instructions: 'You are a code review agent.',
        model: { provider: 'mock', name: 'skill-prompt-mock' },
        skills: { 'exec-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Skills Workspace',
            skills: ['exec-skill-1'],
          },
        },
      },
    });

    // 3. Execute the agent
    const agent = await editor.agent.getById('exec-agent-1');
    expect(agent).toBeInstanceOf(Agent);

    const response = await agent!.generate('Review this code: function foo() {}');
    expect(response.text).toBe('Agent response.');

    // 4. Verify SkillsProcessor injected skill metadata into the system prompt
    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    const systemContent = extractSystemContent(capturedPrompts[0]!);

    // Should contain the skill name and description in XML format (default)
    expect(systemContent).toContain('code-review');
    expect(systemContent).toContain('Reviews code for bugs and style issues');
    // Should contain the skills activation instruction
    expect(systemContent).toContain('Skills are NOT tools');
  });

  // ---------------------------------------------------------------------------
  // Test 2: Unpublished (draft) skills are invisible to agent execution
  // ---------------------------------------------------------------------------
  it('should not inject unpublished (draft) skills into LLM system prompt', async () => {
    const capturedPrompts: Array<any[]> = [];
    gateway.setLLM('draft-mock', createCapturingLLM(capturedPrompts));

    const { editor, storage } = await createExecSetup();

    // 1. Create a skill but do NOT publish it (it stays draft, no tree/blobs)
    await editor.skill.create({
      id: 'draft-skill-1',
      name: 'draft-skill',
      description: 'This skill is still a draft',
      instructions: 'Draft instructions should not appear.',
    });

    // 2. Create agent referencing the draft skill with strategy: 'latest'
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'draft-agent-1',
        name: 'Draft Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'draft-mock' },
        skills: { 'draft-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Draft WS',
            skills: ['draft-skill-1'],
          },
        },
      },
    });

    // 3. Execute the agent
    const agent = await editor.agent.getById('draft-agent-1');
    expect(agent).toBeInstanceOf(Agent);

    const response = await agent!.generate('Hello');
    expect(response.text).toBe('Agent response.');

    // 4. Verify the draft skill was NOT injected into the system prompt
    // (it has no tree, so the versioned source has nothing to discover)
    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    const systemContent = extractSystemContent(capturedPrompts[0]!);

    // Should NOT contain the draft skill's name or the skills activation instruction
    expect(systemContent).not.toContain('draft-skill');
    expect(systemContent).not.toContain('Skills are NOT tools');
  });

  // ---------------------------------------------------------------------------
  // Test 3: Pin vs Latest strategies serve different content
  // ---------------------------------------------------------------------------
  it('should serve different content for pin vs latest strategies', async () => {
    const capturedPromptsPin: Array<any[]> = [];
    const capturedPromptsLatest: Array<any[]> = [];
    gateway.setLLM('pin-mock', createCapturingLLM(capturedPromptsPin));
    gateway.setLLM('latest-mock', createCapturingLLM(capturedPromptsLatest));

    const { editor, storage } = await createExecSetup();

    // 1. Create skill, publish v1
    await editor.skill.create({
      id: 'versioned-skill-1',
      name: 'versioned-skill',
      description: 'A versioned skill',
      instructions: 'Version 1',
    });

    const skillMdV1 = buildSkillMd(
      { name: 'versioned-skill', description: 'Skill version one' },
      'You are running version 1 of this skill.',
    );
    const sourceV1 = createMockSkillSource({
      'versioned-skill/SKILL.md': skillMdV1,
    });
    await editor.skill.publish('versioned-skill-1', sourceV1, 'versioned-skill');

    // Get v1 version ID
    const skillStore = await storage.getStore('skills');
    const v1Version = await skillStore!.getLatestVersion('versioned-skill-1');
    const v1Id = v1Version!.id;

    // 2. Publish v2 with different content
    const skillMdV2 = buildSkillMd(
      { name: 'versioned-skill', description: 'Skill version two' },
      'You are running version 2 of this skill.',
    );
    const sourceV2 = createMockSkillSource({
      'versioned-skill/SKILL.md': skillMdV2,
    });
    await editor.skill.publish('versioned-skill-1', sourceV2, 'versioned-skill');

    // 3. Create agent pinned to v1
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'pin-agent',
        name: 'Pinned Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'pin-mock' },
        skills: { 'versioned-skill-1': { pin: v1Id } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Pin WS',
            skills: ['versioned-skill-1'],
          },
        },
      },
    });

    // 4. Create agent with strategy: latest (gets v2)
    await agentsStore!.create({
      agent: {
        id: 'latest-agent',
        name: 'Latest Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'latest-mock' },
        skills: { 'versioned-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Latest WS',
            skills: ['versioned-skill-1'],
          },
        },
      },
    });

    // 5. Execute both agents
    const pinnedAgent = await editor.agent.getById('pin-agent');
    const latestAgent = await editor.agent.getById('latest-agent');

    await pinnedAgent!.generate('Hello');
    await latestAgent!.generate('Hello');

    // 6. Verify pinned agent got v1 content
    const pinnedSystemContent = extractSystemContent(capturedPromptsPin[0]!);
    expect(pinnedSystemContent).toContain('Skill version one');

    // 7. Verify latest agent got v2 content
    const latestSystemContent = extractSystemContent(capturedPromptsLatest[0]!);
    expect(latestSystemContent).toContain('Skill version two');
  });

  // ---------------------------------------------------------------------------
  // Test 4: Version rollback changes content served to agent
  // ---------------------------------------------------------------------------
  it('should serve rolled-back version content after activeVersionId switch', async () => {
    const capturedPrompts: Array<any[]> = [];
    gateway.setLLM('rollback-mock', createCapturingLLM(capturedPrompts));

    const { editor, storage } = await createExecSetup();

    // 1. Create skill, publish v1
    await editor.skill.create({
      id: 'rollback-skill-1',
      name: 'rollback-skill',
      description: 'Rollback test skill',
      instructions: 'Initial',
    });

    const skillMdV1 = buildSkillMd(
      { name: 'rollback-skill', description: 'Version one description' },
      'Rollback version 1 instructions.',
    );
    const sourceV1 = createMockSkillSource({
      'rollback-skill/SKILL.md': skillMdV1,
    });
    await editor.skill.publish('rollback-skill-1', sourceV1, 'rollback-skill');

    // Get v1 version ID
    const skillStore = await storage.getStore('skills');
    const v1Version = await skillStore!.getLatestVersion('rollback-skill-1');
    const v1Id = v1Version!.id;

    // 2. Publish v2
    const skillMdV2 = buildSkillMd(
      { name: 'rollback-skill', description: 'Version two description' },
      'Rollback version 2 instructions.',
    );
    const sourceV2 = createMockSkillSource({
      'rollback-skill/SKILL.md': skillMdV2,
    });
    await editor.skill.publish('rollback-skill-1', sourceV2, 'rollback-skill');

    // 3. Roll back: switch activeVersionId to v1
    await editor.skill.update({
      id: 'rollback-skill-1',
      activeVersionId: v1Id,
    });

    // 4. Create agent with strategy: latest (should pick the active version = v1)
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'rollback-agent',
        name: 'Rollback Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'rollback-mock' },
        skills: { 'rollback-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Rollback WS',
            skills: ['rollback-skill-1'],
          },
        },
      },
    });

    // 5. Execute the agent
    const agent = await editor.agent.getById('rollback-agent');
    const response = await agent!.generate('Hello');
    expect(response.text).toBe('Agent response.');

    // 6. Verify the agent got v1 content (rolled back)
    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    const systemContent = extractSystemContent(capturedPrompts[0]!);
    expect(systemContent).toContain('Version one description');
    expect(systemContent).not.toContain('Version two description');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Published skills are immutable — editing source without publish
  // does NOT change what the agent sees. Only after re-publishing does the
  // agent see the updated content.
  // ---------------------------------------------------------------------------
  it('should not update agent skill content until the skill is re-published', async () => {
    const capturedPrompts: Array<any[]> = [];
    gateway.setLLM('immutable-mock', createCapturingLLM(capturedPrompts));

    const { editor, storage } = await createExecSetup();

    // 1. Create and publish v1
    await editor.skill.create({
      id: 'immutable-skill-1',
      name: 'immutable-skill',
      description: 'Immutable test skill',
      instructions: 'Initial',
    });

    const skillMdV1 = buildSkillMd(
      { name: 'immutable-skill', description: 'Original skill description' },
      'Original instructions for v1.',
    );
    const sourceV1 = createMockSkillSource({
      'immutable-skill/SKILL.md': skillMdV1,
    });
    await editor.skill.publish('immutable-skill-1', sourceV1, 'immutable-skill');

    // 2. Create agent with strategy: latest
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'immutable-agent',
        name: 'Immutable Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'immutable-mock' },
        skills: { 'immutable-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Immutable WS',
            skills: ['immutable-skill-1'],
          },
        },
      },
    });

    // 3. First generate — should see v1 content
    const agent1 = await editor.agent.getById('immutable-agent');
    await agent1!.generate('Hello');

    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    const system1 = extractSystemContent(capturedPrompts[0]!);
    expect(system1).toContain('Original skill description');

    // 4. "Edit" the source files (create a new source with updated content)
    //    but do NOT call editor.skill.publish()
    //    The source is just data sitting somewhere — it's NOT the blob store.
    //    The agent should still see the OLD published content.
    capturedPrompts.length = 0;

    const agent2 = await editor.agent.getById('immutable-agent');
    await agent2!.generate('Hello again');

    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    const system2 = extractSystemContent(capturedPrompts[0]!);
    // Still sees v1 — no publish happened
    expect(system2).toContain('Original skill description');
    expect(system2).not.toContain('Updated skill description');

    // 5. Now publish v2 with updated content
    const skillMdV2 = buildSkillMd(
      { name: 'immutable-skill', description: 'Updated skill description' },
      'Brand new instructions for v2.',
    );
    const sourceV2 = createMockSkillSource({
      'immutable-skill/SKILL.md': skillMdV2,
    });
    await editor.skill.publish('immutable-skill-1', sourceV2, 'immutable-skill');

    // 6. Third generate — should NOW see v2 content.
    //    The skill.publish() call above automatically invalidated the agent cache
    //    for agents referencing 'immutable-skill-1', so re-hydration happens
    //    on the next getById() call.
    capturedPrompts.length = 0;

    const agent3 = await editor.agent.getById('immutable-agent');
    await agent3!.generate('Hello once more');

    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    const system3 = extractSystemContent(capturedPrompts[0]!);
    expect(system3).toContain('Updated skill description');
    expect(system3).not.toContain('Original skill description');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Skill tools (skill-activate, skill-search) are injected into the
  // model when using versioned blob-backed skill sources
  // ---------------------------------------------------------------------------
  it('should inject skill-activate and skill-search tools into model for versioned sources', async () => {
    let capturedTools: unknown;

    // Use a custom mock that captures tools
    gateway.setLLM(
      'skill-tool-mock',
      new MockLanguageModelV2({
        doGenerate: async ({ tools }) => {
          capturedTools = tools;
          return {
            content: [{ type: 'text', text: 'Done.' }],
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 5 },
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'mock-id', modelId: 'mock', timestamp: new Date() },
            { type: 'text-start' as const, id: 'text-1' },
            { type: 'text-delta' as const, id: 'text-1', delta: 'ok' },
            { type: 'text-end' as const, id: 'text-1' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage: { inputTokens: 10, outputTokens: 5 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      }),
    );

    const { editor, storage } = await createExecSetup();

    // 1. Create and publish a skill with references
    await editor.skill.create({
      id: 'tool-skill-1',
      name: 'tool-skill',
      description: 'Skill for tool testing',
      instructions: 'Tool skill instructions.',
    });

    const skillMd = buildSkillMd(
      { name: 'tool-skill', description: 'Skill for tool testing' },
      'Tool skill instructions.',
    );
    const source = createMockSkillSource({
      'tool-skill/SKILL.md': skillMd,
      'tool-skill/references/api-guide.md': '# API Guide\nThis is the API reference.',
    });
    await editor.skill.publish('tool-skill-1', source, 'tool-skill');

    // 2. Create agent with versioned skill
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'tool-agent',
        name: 'Tool Agent',
        instructions: 'Use skills as instructed.',
        model: { provider: 'mock', name: 'skill-tool-mock' },
        skills: { 'tool-skill-1': { strategy: 'latest' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Tool WS',
            skills: ['tool-skill-1'],
          },
        },
      },
    });

    // 3. Execute — model captures tools
    const agent = await editor.agent.getById('tool-agent');
    expect(agent).toBeInstanceOf(Agent);
    await agent!.generate('Hello');

    // 4. Verify skill tools were injected
    expect(capturedTools).toBeDefined();
    const toolNames = Array.isArray(capturedTools)
      ? (capturedTools as any[]).map((t: any) => t.name)
      : Object.keys(capturedTools as any);
    expect(toolNames).toContain('skill-activate');
    expect(toolNames).toContain('skill-search');
  });
});

// =============================================================================
// Live Strategy Tests — Skills served from real filesystem
// =============================================================================
// These tests verify that agents with `strategy: 'live'` discover skills
// from the workspace's filesystem (not blob storage), and that editing
// files on disk is reflected without a publish step.

describe('editor.skill — live strategy execution', () => {
  let tempDir: string;
  let gateway: MockGateway;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'editor-live-skill-'));
    gateway = new MockGateway();
    process.env.MOCK_API_KEY = `test-key-${Date.now()}-${Math.random()}`;
  });

  afterEach(async () => {
    delete process.env.MOCK_API_KEY;
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createLiveSetup = async () => {
    const storage = new LibSQLStore({ id: `live-skill-${testStorageCount++}`, url: ':memory:' });
    const editor = new MastraEditor({ logger: mockLogger() as any });
    const mastra = new Mastra({
      storage,
      editor,
      gateways: { 'models.dev': gateway },
    });
    await storage.init();
    return { storage, editor, mastra };
  };

  /** Write a skill directory on disk inside tempDir */
  const writeSkillToDisk = async (
    skillsDir: string,
    skillDirName: string,
    frontmatter: Record<string, string>,
    body: string,
    extras?: Record<string, string>,
  ) => {
    const skillPath = path.join(skillsDir, skillDirName);
    await fs.mkdir(skillPath, { recursive: true });

    const fm = Object.entries(frontmatter)
      .map(([k, v]) => `${k}: "${v}"`)
      .join('\n');
    const skillMd = `---\n${fm}\n---\n\n${body}`;
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillMd, 'utf-8');

    if (extras) {
      for (const [relPath, content] of Object.entries(extras)) {
        const fullPath = path.join(skillPath, relPath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
      }
    }
  };

  it('should discover live skills from the filesystem and inject them into LLM system prompt', async () => {
    // 1. Create skill files on disk
    const skillsDir = path.join(tempDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await writeSkillToDisk(
      skillsDir,
      'code-style',
      {
        name: 'code-style',
        description: 'Code style guidelines',
      },
      'Always use consistent indentation and naming conventions.',
    );

    // 2. Set up agent with live strategy
    const capturedPrompts: Array<any[]> = [];
    const capturingLLM = new MockLanguageModelV2({
      doGenerate: async (params: any) => {
        capturedPrompts.push(params.prompt);
        return {
          content: [{ type: 'text', text: 'OK' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: { inputTokens: 10, outputTokens: 10 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
    gateway.setLLM('live-model', capturingLLM);

    const { editor, storage } = await createLiveSetup();

    // Create agent with live skill — workspace filesystem points to tempDir,
    // skills array points to 'skills' (relative to basePath)
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'live-agent-1',
        name: 'Live Skill Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'live-model' },
        skills: { 'code-style': { strategy: 'live' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Live WS',
            filesystem: { provider: 'local', config: { basePath: tempDir } },
            skills: ['skills'],
          },
        },
      },
    });

    // 3. Execute agent
    const agent = await editor.agent.getById('live-agent-1');
    expect(agent).toBeInstanceOf(Agent);

    await agent!.generate([{ role: 'user', content: 'Help me with code style.' }]);

    // 4. Verify skill metadata was injected into the system prompt
    expect(capturedPrompts.length).toBeGreaterThan(0);
    const systemContent = capturedPrompts[0]!
      .filter((msg: any) => msg.role === 'system')
      .map((msg: any) => {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) return msg.content.map((p: any) => p.text || '').join('');
        return '';
      })
      .join('\n');

    expect(systemContent).toContain('code-style');
    expect(systemContent).toContain('Code style guidelines');
  });

  it('should pick up real-time edits to skill files without a publish step', async () => {
    // 1. Create initial skill on disk
    const skillsDir = path.join(tempDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await writeSkillToDisk(
      skillsDir,
      'my-guide',
      {
        name: 'my-guide',
        description: 'Original description',
      },
      'Original instructions here.',
    );

    const capturedPrompts: Array<any[]> = [];
    const capturingLLM = new MockLanguageModelV2({
      doGenerate: async (params: any) => {
        capturedPrompts.push(params.prompt);
        return {
          content: [{ type: 'text', text: 'OK' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: { inputTokens: 10, outputTokens: 10 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
    gateway.setLLM('live-edit-model', capturingLLM);

    const { editor, storage } = await createLiveSetup();

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'live-edit-agent',
        name: 'Live Edit Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'live-edit-model' },
        skills: { 'my-guide': { strategy: 'live' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Live Edit WS',
            filesystem: { provider: 'local', config: { basePath: tempDir } },
            skills: ['skills'],
          },
        },
      },
    });

    // 2. First generate — should see original skill
    const agent = await editor.agent.getById('live-edit-agent');
    expect(agent).toBeInstanceOf(Agent);

    await agent!.generate([{ role: 'user', content: 'What is my guide?' }]);
    expect(capturedPrompts.length).toBe(1);

    const firstSystem = capturedPrompts[0]!
      .filter((msg: any) => msg.role === 'system')
      .map((msg: any) => {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) return msg.content.map((p: any) => p.text || '').join('');
        return '';
      })
      .join('\n');
    expect(firstSystem).toContain('Original description');

    // 3. Edit the skill file on disk (no publish!)
    // Touch the parent directory to trigger staleness
    const skillDir = path.join(skillsDir, 'my-guide');
    const updatedMd = `---\nname: "my-guide"\ndescription: "Updated description"\n---\n\nBrand new instructions after edit.`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), updatedMd, 'utf-8');
    // Touch the skills directory to change its mtime
    const now = new Date();
    await fs.utimes(skillsDir, now, now);

    // Clear the cached agent so getById re-fetches from storage and re-hydrates
    editor.agent.clearCache('live-edit-agent');

    // 4. Get a fresh agent instance (new Workspace -> new WorkspaceSkillsImpl)
    const agent2 = await editor.agent.getById('live-edit-agent');
    expect(agent2).toBeInstanceOf(Agent);

    capturedPrompts.length = 0;
    await agent2!.generate([{ role: 'user', content: 'Updated guide?' }]);
    expect(capturedPrompts.length).toBe(1);

    const secondSystem = capturedPrompts[0]!
      .filter((msg: any) => msg.role === 'system')
      .map((msg: any) => {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) return msg.content.map((p: any) => p.text || '').join('');
        return '';
      })
      .join('\n');
    expect(secondSystem).toContain('Updated description');
  });

  it('should discover live skill references from the filesystem', async () => {
    // 1. Create skill with a reference file on disk
    const skillsDir = path.join(tempDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await writeSkillToDisk(
      skillsDir,
      'api-docs',
      { name: 'api-docs', description: 'API documentation skill' },
      'Use references for detailed API docs.',
      { 'references/endpoints.md': '# Endpoints\n\nGET /users - List all users' },
    );

    // 2. Set up agent and capture tools + prompts
    let capturedTools: Record<string, any> = {};
    const capturingLLM = new MockLanguageModelV2({
      doGenerate: async (params: any) => {
        capturedTools = params.tools ?? {};
        return {
          content: [{ type: 'text', text: 'Done' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'finish' as const, finishReason: 'stop' as const, usage: { inputTokens: 10, outputTokens: 10 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
    gateway.setLLM('live-ref-model', capturingLLM);

    const { editor, storage } = await createLiveSetup();

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'live-ref-agent',
        name: 'Live Ref Agent',
        instructions: 'You are a test agent.',
        model: { provider: 'mock', name: 'live-ref-model' },
        skills: { 'api-docs': { strategy: 'live' } },
        workspace: {
          type: 'inline',
          config: {
            name: 'Live Ref WS',
            filesystem: { provider: 'local', config: { basePath: tempDir } },
            skills: ['skills'],
          },
        },
      },
    });

    // 3. Execute agent — skills with references should inject skill-activate tool
    const agent = await editor.agent.getById('live-ref-agent');
    expect(agent).toBeInstanceOf(Agent);

    await agent!.generate([{ role: 'user', content: 'Show me the API docs.' }]);

    // 4. Verify skill tools are available
    const toolNames = Array.isArray(capturedTools)
      ? (capturedTools as any[]).map((t: any) => t.name)
      : Object.keys(capturedTools as any);
    expect(toolNames).toContain('skill-activate');
    expect(toolNames).toContain('skill-search');

    // 5. Verify we can read the reference through the workspace
    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);

    const skills = workspace!.skills!;
    const refContent = await skills.getReference('api-docs', 'references/endpoints.md');
    expect(refContent).toContain('GET /users - List all users');
  });
});
