import { describe, expect, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { Mastra } from '@mastra/core';
import type { SourceControlProvider } from '@mastra/core/editor';
import { MastraEditor } from '../index';

function createMockSourceProvider(): SourceControlProvider & { writes: Array<{ path: string; content: string }> } {
  const writes: Array<{ path: string; content: string }> = [];
  const files = new Map<string, string>();

  return {
    id: 'scenario-source',
    displayName: 'Scenario Source',
    writes,
    async getCapabilities() {
      return { canRead: true, canWrite: true, canListHistory: false, canOpenChangeRequest: false };
    },
    async readFile({ path }) {
      const content = files.get(path);
      return content === undefined ? null : { path, content };
    },
    async writeFile({ path, content }) {
      files.set(path, content);
      writes.push({ path, content });
      return { path, commitSha: `commit-${writes.length}` };
    },
    async listFileHistory() {
      return [];
    },
  };
}

describe('editor e2e scenario: code source routing', () => {
  it('routes code-owned agent edits through source control while leaving other editor domains storage-backed', async () => {
    // USER STORY: A Studio user edits a code-owned agent and expects the change to become a source-control patch, not a DB-only mutation.
    // ARRANGE
    const sourceProvider = createMockSourceProvider();
    const editor = new MastraEditor({ source: 'code', sourceControlProvider: sourceProvider });
    const codeAgent = new Agent({
      id: 'source-backed-agent',
      name: 'Source Backed Agent',
      instructions: 'Code-owned instructions',
      model: 'openai/gpt-4o',
      editor: { instructions: true },
    });
    const storage = new InMemoryStore();
    const mastra = new Mastra({ storage, editor, agents: { codeAgent } });

    // ACT
    const agentsStore = await mastra.getStorage()?.getStore('agents');
    await agentsStore?.createVersion({
      agentId: 'source-backed-agent',
      versionNumber: 1,
      instructions: 'Studio-edited instructions',
      model: { provider: 'openai', name: 'gpt-4o' },
      changeMessage: 'Update agent instructions',
    });

    await editor.prompt.create({
      id: 'db-backed-prompt',
      name: 'DB backed prompt',
      content: 'Prompt blocks still use the editor storage layer.',
    });

    // ASSERT
    expect(sourceProvider.writes).toEqual([
      {
        path: 'agents/source-backed-agent.json',
        content: `${JSON.stringify({ instructions: 'Studio-edited instructions' })}\n`,
      },
    ]);
    await expect(editor.prompt.getById('db-backed-prompt')).resolves.toMatchObject({
      id: 'db-backed-prompt',
      content: 'Prompt blocks still use the editor storage layer.',
    });
  });
});
