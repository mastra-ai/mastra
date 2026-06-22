import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { LocalFilesystem } from '../../../../workspace/filesystem';
import { Workspace } from '../../../../workspace/workspace';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: workspace is threaded into tool execution context.
 *
 * The agent is configured with a workspace backed by a real filesystem. A tool
 * reads a file via `ctx.workspace.filesystem` mid-loop. We assert the file
 * content (a) becomes the tool result plumbed into the next request and (b)
 * appears in the final output. A regression where the workspace is not passed to
 * tool execution is caught (the tool would throw / get no workspace).
 */
describe('AIMock loop scenario: workspace in tool execution', () => {
  const getMock = useLoopScenarioAimock();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aimock-workspace-scenario-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('passes the workspace to a tool so it can read a file mid-loop', async () => {
    await fs.writeFile(path.join(tempDir, 'note.txt'), 'WORKSPACE_FILE_CONTENT');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });

    const readNote = createTool({
      id: 'read_note',
      description: 'Read note.txt from the workspace.',
      inputSchema: z.object({}),
      outputSchema: z.object({ content: z.string() }),
      execute: async (_input, ctx) => {
        if (!ctx?.workspace?.filesystem) {
          throw new Error('workspace was not provided to tool execution context');
        }
        const content = await ctx.workspace.filesystem.readFile('note.txt');
        return { content: content.toString() };
      },
    });

    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Read the note and tell me what it says.',
      tools: { read_note: readNote },
      workspace,
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_read', name: 'read_note', arguments: {} }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The note says WORKSPACE_FILE_CONTENT.' });
      },
    });

    expect(requests).toHaveLength(2);

    // The file content the tool read from the workspace must round-trip into the
    // turn-2 request as the tool result.
    const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
    expect(turn2).toContain('WORKSPACE_FILE_CONTENT');

    const text = await output.text;
    expect(text).toContain('WORKSPACE_FILE_CONTENT');
  });
});
