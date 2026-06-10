import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessMode as HarnessModeV1 } from '@mastra/core/harness/v1';
import { InMemoryHarness } from '@mastra/core/storage';
import { LocalFilesystem, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

const fixturePath = 'roundtrip.txt';
const originalContent = 'original-content-from-harness-v1\nplease preserve this line';
const updateMarker = 'updated-by-harness-v1';
const modelId = process.env.MASTRA_HARNESS_V1_ROUNDTRIP_MODEL ?? 'anthropic/claude-sonnet-4-20250514';

type StreamTerminalStatus = 'finish' | 'error' | 'abort' | 'tool-call-suspended' | 'done';

type ToolCallRecord = {
  phase: 'before' | 'after';
  toolName: string;
  workspaceToolName: string;
};

function terminalStatus(chunk: unknown): StreamTerminalStatus | undefined {
  if (!chunk || typeof chunk !== 'object') return undefined;
  const type = (chunk as Record<string, unknown>).type;
  if (type === 'finish' || type === 'error' || type === 'abort' || type === 'tool-call-suspended') return type;
  return undefined;
}

function writeTextDelta(chunk: unknown): void {
  if (typeof chunk === 'string') {
    process.stdout.write(chunk);
    return;
  }
  if (!chunk || typeof chunk !== 'object') return;
  const c = chunk as Record<string, unknown>;
  if (c.type === 'text-delta') {
    const text = c.textDelta ?? c.delta ?? (c.payload as Record<string, unknown> | undefined)?.text;
    if (text) process.stdout.write(String(text));
  } else if (c.text) {
    process.stdout.write(String(c.text));
  }
}

async function nextStreamChunk<T>(iterator: AsyncIterator<T>, timeoutMs: number): Promise<IteratorResult<T>> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<T>>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for stream chunk after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'mastra-harness-v1-roundtrip-'));
  const absoluteFixturePath = join(tempDir, fixturePath);
  const toolCalls: ToolCallRecord[] = [];

  console.info('Harness V1 workspace file roundtrip example');
  console.info(`Workspace: ${tempDir}`);
  console.info(`Model: ${modelId}`);

  try {
    await writeFile(absoluteFixturePath, originalContent, 'utf8');
    console.info(`Original content written to ${fixturePath}:`);
    console.info(originalContent);

    const workspace = new Workspace({
      name: 'harness-v1-file-roundtrip',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { name: 'view' },
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
          name: 'write_file',
          requireApproval: false,
          requireReadBeforeWrite: true,
        },
        [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: { name: 'find_files' },
        hooks: {
          beforeToolCall: context => {
            toolCalls.push({
              phase: 'before',
              toolName: context.toolName,
              workspaceToolName: context.workspaceToolName,
            });
          },
          afterToolCall: context => {
            toolCalls.push({
              phase: 'after',
              toolName: context.toolName,
              workspaceToolName: context.workspaceToolName,
            });
          },
        },
      },
    });

    const modes: HarnessModeV1[] = [{ id: 'build', description: 'Build', defaultModelId: modelId }];
    const agent = new Agent({
      id: 'harness-v1-roundtrip-agent',
      name: 'Harness V1 Roundtrip Agent',
      instructions:
        'You are a precise file-editing assistant. Use workspace tools when asked to inspect or change files. Always read existing file content before writing a replacement.',
      model: modelId,
      workspace,
    });

    const harness = new HarnessV1({
      ownerId: 'harness-v1-file-roundtrip-example',
      agent,
      memory: new Memory({ options: { workingMemory: { enabled: true } } }),
      modes,
      defaultModeId: 'build',
      storage: new InMemoryHarness(),
      workspace,
    });

    const session = await harness.session({
      threadId: `thread-${Date.now()}`,
      resourceId: 'harness-v1-file-roundtrip-resource',
    });

    const subscription = await session.subscribeToThread();
    let status: StreamTerminalStatus = 'done';

    try {
      console.info('\nAsking agent to read, use, and update the file...\n');
      const result = await session.queueMessage({
        messages:
          `Read ${fixturePath} with the view tool. Then write ${fixturePath} with write_file. ` +
          `The new file content must be exactly:\n${originalContent}\n${updateMarker}\n` +
          'Do not use any other final file content.',
      });

      if (!result.accepted) throw new Error('Session did not accept the roundtrip message');

      const iterator = subscription.stream[Symbol.asyncIterator]();
      while (true) {
        const { value: chunk, done } = await nextStreamChunk(iterator, 120_000);
        if (done) break;
        writeTextDelta(chunk);
        const terminal = terminalStatus(chunk);
        if (terminal) {
          status = terminal;
          break;
        }
      }
      process.stdout.write('\n');
    } finally {
      subscription.unsubscribe();
    }

    console.info(`Terminal stream status: ${status}`);
    if (status !== 'finish') throw new Error(`Expected stream to finish, received ${status}`);

    const changedContent = await readFile(absoluteFixturePath, 'utf8');
    const sawRead = toolCalls.some(call => call.phase === 'before' && call.toolName === 'view');
    const sawWrite = toolCalls.some(call => call.phase === 'before' && call.toolName === 'write_file');

    if (!sawRead) throw new Error('The agent did not invoke the view workspace tool');
    if (!sawWrite) throw new Error('The agent did not invoke the write_file workspace tool');
    if (!changedContent.includes(originalContent)) throw new Error('Changed file no longer contains the original content');
    if (!changedContent.includes(updateMarker)) throw new Error(`Changed file does not contain ${updateMarker}`);

    console.info('Changed file verification passed.');
    console.info(`Observed workspace tools: ${[...new Set(toolCalls.map(call => call.toolName))].join(', ')}`);
  } finally {
    await writeFile(absoluteFixturePath, originalContent, 'utf8').catch(() => undefined);
    const restoredContent = await readFile(absoluteFixturePath, 'utf8').catch(() => undefined);
    if (restoredContent === originalContent) console.info('Cleanup verification passed: original content restored.');
    await rm(tempDir, { recursive: true, force: true });
    console.info(`Removed temp workspace: ${tempDir}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
