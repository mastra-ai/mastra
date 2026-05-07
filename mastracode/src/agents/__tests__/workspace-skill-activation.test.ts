import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();

function toStream(chunks: any[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

afterEach(async () => {
  process.chdir(originalCwd);
  vi.resetModules();
});

describe('mastracode workspace skill activation', () => {
  it('activates a symlinked local skill by bare name through the mastracode workspace path', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-skill-'));

    try {
      const skillName = 'temp-symlink-skill';
      const agentsRoot = path.join(tempDir, '.agents', 'skills');
      const claudeRoot = path.join(tempDir, '.claude', 'skills');
      const canonicalSkillDir = path.join(agentsRoot, skillName);
      const symlinkedSkillDir = path.join(claudeRoot, skillName);
      const capturedPrompts: any[] = [];
      let callCount = 0;

      await fs.mkdir(canonicalSkillDir, { recursive: true });
      await fs.mkdir(claudeRoot, { recursive: true });
      await fs.writeFile(
        path.join(canonicalSkillDir, 'SKILL.md'),
        '---\nname: temp-symlink-skill\ndescription: canonical temp symlink skill\n---\n\n# Temp Symlink Skill\n\nUse the canonical skill.',
      );
      await fs.symlink(canonicalSkillDir, symlinkedSkillDir, 'dir');

      process.chdir(tempDir);
      const { getDynamicWorkspace } = await import('../workspace.js');

      const requestContext = new RequestContext();
      requestContext.set('harness', {
        modeId: 'build',
        getState: () => ({
          projectPath: tempDir,
          sandboxAllowedPaths: [],
        }),
      });

      const workspace = getDynamicWorkspace({ requestContext });

      const agent = new Agent({
        id: 'mc-symlink-skill-agent',
        name: 'MC Symlink Skill Agent',
        instructions: 'You are a test agent.',
        model: new MastraLanguageModelV2Mock({
          doStream: async ({ prompt }) => {
            callCount++;
            capturedPrompts.push(prompt);

            if (callCount === 1) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: toStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolCallType: 'function',
                    toolName: 'skill',
                    input: '{"name":"temp-symlink-skill"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                  },
                ]),
              };
            }

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: toStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Loaded temp symlink skill.' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        }) as any,
        workspace,
      });

      const result = await agent.stream('Activate temp-symlink-skill', { requestContext });
      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      const toolResultChunk = chunks.find(chunk => chunk.type === 'tool-result');
      expect(toolResultChunk, JSON.stringify(chunks, null, 2)).toBeDefined();
      expect(toolResultChunk.payload.toolName).toBe('skill');
      expect(toolResultChunk.payload.result).toContain('# Temp Symlink Skill');
      expect(toolResultChunk.payload.result).toContain('Use the canonical skill.');
      expect(capturedPrompts).toHaveLength(2);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
