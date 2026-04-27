/**
 * E2E test: OpenAI strict mode with workspace tools and structured output.
 *
 * Verifies that schemas with optional fields work correctly when using
 * workspace tools + structured output + web search with real OpenAI calls.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { openai as openai_v6 } from '@ai-sdk/openai-v6';
import { createGatewayMock } from '@internal/test-utils';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { z } from 'zod/v4';
import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';
import { Agent } from '../agent';

const mock = createGatewayMock();

let tempDir: string;

beforeAll(async () => {
  mock.start();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-openai-test-'));
  await fs.writeFile(path.join(tempDir, 'hello.txt'), 'Hello, world!\nThis is a test file.\n');
  await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'subdir', 'nested.ts'), 'export const x = 1;\n');
});

afterAll(async () => {
  await mock.saveAndStop();
  await fs.rm(tempDir, { recursive: true, force: true });
});

function createWorkspaceAgent(model: any, extraTools?: Record<string, any>) {
  const filesystem = new LocalFilesystem({ basePath: tempDir });
  const workspace = new Workspace({
    id: 'test-workspace',
    name: 'Test Workspace',
    filesystem,
  });

  return new Agent({
    id: 'workspace-test-agent',
    name: 'Workspace Test Agent',
    instructions: 'You are a helpful assistant with workspace tools. Use the tools as instructed.',
    model,
    workspace,
    ...(extraTools ? { tools: extraTools } : {}),
  });
}

// Schema with .optional() field — the pattern that breaks in strict mode
const structuredOutputSchema = z.object({
  summary: z.string().describe('A brief summary of what was done'),
  filesFound: z.number().describe('Number of files found'),
  details: z.string().optional().describe('Optional additional details'),
});

describe('Workspace tools with OpenAI strict mode', { timeout: 300_000 }, () => {
  const models = [
    { name: 'gpt-5.2 (v5)', model: openai_v5('gpt-5.2'), sdk: openai_v5 },
    { name: 'gpt-4o (v5)', model: openai_v5('gpt-4o'), sdk: openai_v5 },
    { name: 'gpt-4o (v6)', model: openai_v6('gpt-4o'), sdk: openai_v6 },
  ];

  for (const { name, model, sdk } of models) {
    describe(`Model: ${name}`, () => {
      // ---- Workspace tools only (no structured output) ----

      it('list_files: tools only', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model);
        const result = await agent.generate('Use the list_files tool to list files. Use defaults.');
        expect(result.text).toBeDefined();
      });

      it('execute_command: tools only', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model);
        const result = await agent.generate('Use the execute_command tool to run: echo "test"');
        expect(result.text).toBeDefined();
      });

      // ---- Structured output only (no tools/workspace) ----

      it('structured output only (no workspace)', { timeout: 60_000 }, async () => {
        const agent = new Agent({
          id: 'no-workspace-agent',
          name: 'No Workspace Agent',
          instructions: 'You are a helpful assistant.',
          model,
        });
        const result = await agent.generate('Summarize: there are 3 files in the directory.', {
          structuredOutput: { schema: structuredOutputSchema },
        });
        expect(result.object).toBeDefined();
        expect(result.object.summary).toBeDefined();
      });

      // ---- Structured output + workspace tools (the reported combination) ----

      it('structured output + workspace tools: list_files', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model);
        const result = await agent.generate('Use list_files to list files, then summarize what you found.', {
          structuredOutput: { schema: structuredOutputSchema },
        });
        expect(result.object).toBeDefined();
        expect(result.object.summary).toBeDefined();
      });

      it('structured output + workspace tools: grep', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model);
        const result = await agent.generate('Use grep to search for "Hello" in all files, then summarize.', {
          structuredOutput: { schema: structuredOutputSchema },
        });
        expect(result.object).toBeDefined();
      });

      it('structured output + workspace tools: execute_command', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model);
        const result = await agent.generate('Use execute_command to run "ls" then summarize the output.', {
          structuredOutput: { schema: structuredOutputSchema },
        });
        expect(result.object).toBeDefined();
      });

      it('structured output + workspace tools: file_stat (control)', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model);
        const result = await agent.generate('Use file_stat on "hello.txt" then summarize what you found.', {
          structuredOutput: { schema: structuredOutputSchema },
        });
        expect(result.object).toBeDefined();
      });

      // ---- Web search + workspace tools + structured output ----

      it('web search + workspace tools (no structured output)', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model, { search: sdk.tools.webSearch({}) });
        const result = await agent.generate('Use list_files to list the files in the workspace.');
        expect(result.text).toBeDefined();
      });

      it('web search + workspace tools + structured output', { timeout: 60_000 }, async () => {
        const agent = createWorkspaceAgent(model, { search: sdk.tools.webSearch({}) });
        const result = await agent.generate('Use list_files to list files, then summarize what you found.', {
          structuredOutput: { schema: structuredOutputSchema },
        });
        expect(result.object).toBeDefined();
      });
    });
  }
});
