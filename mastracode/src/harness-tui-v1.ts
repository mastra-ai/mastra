import { createHash } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Agent } from '@mastra/core/agent';
import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessEvent, HarnessMode as HarnessModeV1 } from '@mastra/core/harness/v1';
import { InMemoryHarness } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import z from 'zod';
import { getDynamicWorkspace } from './agents/workspace';
import { loadCustomCommands } from './utils/slash-command-loader.js';
import { processSlashCommand } from './utils/slash-command-processor.js';

// ─── Hash helper (same as mastracode uses) ────────────────────────────────
function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ─── Modes ────────────────────────────────────────────────────────────────
const codeAgentId = 'code-agent';

const modes: HarnessModeV1[] = [
  {
    id: 'build',
    description: 'Build',
    defaultModelId: 'anthropic/claude-sonnet-4-20250514',
    metadata: { default: true },
  },
  {
    id: 'plan',
    description: 'Plan',
    transitionsTo: 'build',
    defaultModelId: 'openai/gpt-4o',
  },
  {
    id: 'fast',
    description: 'Fast',
    defaultModelId: 'anthropic/claude-3-5-haiku-20241022',
  },
];

const defaultModeId = 'build';

// ─── Create minimal agent ─────────────────────────────────────────────────
const codeAgent = new Agent({
  id: codeAgentId,
  name: 'Code Agent',
  instructions: 'You are a helpful coding assistant.',
  model: modes.find(m => m.id === defaultModeId)!.defaultModelId,
  workspace: getDynamicWorkspace,
});

// ─── Storage ────────────────────────────────────────────────────────────
const harnessStorage = new InMemoryHarness();

// ─── Memory (simple in-memory, no vector for now) ──────────────────────────
const memory = new Memory({
  options: {
    workingMemory: { enabled: true },
  },
});

// ─── ownerId / resourceId ─────────────────────────────────────────────────
const cwd = process.cwd();
const ownerId = `harness-tui-${hash(`${hostname()}\0${cwd}`)}`;
const resourceId = `resource-${hash(cwd)}`;

// ─── Event log ──────────────────────────────────────────────────────────────
let activeSessionId: string | undefined;
const pendingEventLogs: HarnessEvent[] = [];
const eventLogWrites = new Map<string, Promise<void>>();

function eventLogPath(sessionId: string): string {
  return join(cwd, `events-${sessionId}.log`);
}

function queueEventLog(event: HarnessEvent): void {
  const sessionId = event.sessionId ?? activeSessionId;
  if (!sessionId) {
    pendingEventLogs.push(event);
    return;
  }

  const path = eventLogPath(sessionId);
  const line = `${JSON.stringify(event)}\n`;
  const previousWrite = eventLogWrites.get(path) ?? Promise.resolve();
  const nextWrite = previousWrite.catch(() => undefined).then(() => appendFile(path, line, 'utf8'));
  eventLogWrites.set(path, nextWrite);
  nextWrite.catch(err => console.error(`Failed to write event log ${path}:`, err));
}

function flushPendingEventLogs(): void {
  while (pendingEventLogs.length > 0) {
    const event = pendingEventLogs.shift()!;
    queueEventLog(event);
  }
}

async function flushEventLogWrites(): Promise<void> {
  await Promise.all([...eventLogWrites.values()].map(write => write.catch(() => undefined)));
}

// ─── Create HarnessV1 ───────────────────────────────────────────────────────
const harness = new HarnessV1({
  ownerId,
  agent: codeAgent,
  memory,
  modes,
  defaultModeId,
  storage: harnessStorage,
  workspace: getDynamicWorkspace,

  stateSchema: z.object({
    projectPath: z.string(),
  }),
  initialState: {
    projectPath: process.cwd(),
  },
});

harness.subscribe(queueEventLog);

// ─── Session detection ────────────────────────────────────────────────────
async function detectOrCreateSession() {
  // List existing sessions for this owner
  const sessions = await harnessStorage.listSessions();

  // Filter by resourceId
  const matchingSessions = sessions.filter(s => s.resourceId === resourceId && s.ownerId === ownerId);

  if (matchingSessions.length > 0) {
    console.info(`Found ${matchingSessions.length} existing session(s) for this resource.`);
    const lastMatchingSession = matchingSessions
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
      .at(0)!;
    return await harness.session({ sessionId: lastMatchingSession.id });
  }

  // No existing session, create first one
  const threadId = `thread-${hash(`${Date.now()}`)}`;
  return await harness.session({ threadId, resourceId });
}

// ─── Write a single text-delta chunk to stdout ─────────────────────────────
function writeTextDelta(chunk: unknown) {
  if (typeof chunk === 'string') {
    process.stdout.write(chunk);
    return;
  }
  if (!chunk || typeof chunk !== 'object') return;
  const c = chunk as Record<string, unknown>;
  if (c.type === 'text-delta') {
    const text = c.textDelta ?? c.delta ?? (c.payload as Record<string, unknown>)?.text;
    if (text) process.stdout.write(String(text));
  } else if (c.text) {
    process.stdout.write(String(c.text));
  }
}



// ─── TUI main loop ──────────────────────────────────────────────────────────
async function main() {
  console.info('Starting HarnessV1 TUI...');

  const session = await detectOrCreateSession();
  activeSessionId = session.id;
  flushPendingEventLogs();
  console.info(`Session created: ${session.id}`);
  console.info(`Event log: ${eventLogPath(session.id)}`);
  console.info(`Mode: ${session.getMode().id}, Model: ${session.getModelId()}`);

  // Load custom slash commands from .mastracode/commands, .claude/commands, etc.
  const customCommands = await loadCustomCommands(process.cwd());
  if (customCommands.length > 0) {
    console.info(`Loaded ${customCommands.length} custom command(s): ${customCommands.map(c => `//${c.name}`).join(', ')}`);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => new Promise(resolve => rl.question(question, resolve));

  // ─── Mode ───────────────────────────────────────────────────────────────
  async function handleMode() {
    console.info('Available modes:');
    modes.forEach(m => console.info(`  ${m.id}: ${m.description}`));
    const modeId = await ask('Switch to mode: ');
    const mode = modes.find(m => m.id === modeId.trim());
    if (mode) {
      session.setMode(mode);
      console.info(`Switched to mode: ${mode.id}`);
    } else {
      console.info('Invalid mode');
    }
  }

  // ─── Model ──────────────────────────────────────────────────────────────
  async function handleModel() {
    const modelId = await ask('Enter model ID (e.g. anthropic/claude-sonnet-4-20250514): ');
    if (modelId.trim()) {
      session.setModelId(modelId.trim());
      console.info(`Model set to: ${modelId.trim()}`);
    }
  }

  async function sendAndStream(text: string) {
    const subscription = await session.subscribeToThread();

    try {
      const result = await session.queueMessage({ messages: text });

      if (!result.accepted) {
        console.info('  → message not accepted');
        return;
      }

      const iterator = subscription.stream[Symbol.asyncIterator]();
      while (true) {
        const { value: chunk, done } = await iterator.next();
        if (done) break;
        writeTextDelta(chunk);
        if (
          chunk &&
          typeof chunk === 'object' &&
          ((chunk as any).type === 'finish' ||
            (chunk as any).type === 'error' ||
            (chunk as any).type === 'abort' ||
            (chunk as any).type === 'tool-call-suspended')
        ) {
          break;
        }
      }

      process.stdout.write('\n');
    } finally {
      subscription.unsubscribe();
    }
  }

  // ─── Custom command execution ─────────────────────────────────────────────
  async function handleCustomCommand(cmdName: string, cmdArgs: string[]) {
    const cmd = customCommands.find(c => c.name === cmdName);
    if (!cmd) {
      console.info(`Unknown custom command: ${cmdName}. Available: ${customCommands.map(c => `//${c.name}`).join(', ')}`);
      return;
    }
    try {
      const processed = await processSlashCommand(cmd, cmdArgs, process.cwd());
      if (processed.trim()) {
        console.info(`\n--- //${cmd.name} ---`);
        await sendAndStream(processed.trim());
      } else {
        console.info(`Executed //${cmd.name} (no output)`);
      }
    } catch (err) {
      console.error(`Error executing //${cmd.name}:`, err instanceof Error ? err.message : err);
    }
  }

  // ─── Main loop ────────────────────────────────────────────────────────────
  const cmdHint = customCommands.length > 0 ? ', [c]ommands' : '';
  const prompt = async () => {
    const answer = await ask(`\n[p]rompt, [m]ode, [mo]del${cmdHint}, [q]uit: `);
    const choice = answer.trim();
    const lower = choice.toLowerCase();

    if (lower === 'q' || lower === 'quit') {
      console.info('Goodbye!');
      rl.close();
      await flushEventLogWrites();
      process.exit(0);
    } else if (lower === 'p' || lower === 'prompt') {
      const promptText = await ask('Enter prompt: ');
      if (promptText.trim()) {
        await sendAndStream(promptText).catch((err: unknown) => console.error('Error:', err));
      }
    } else if (lower === 'm' || lower === 'mode') {
      await handleMode();
    } else if (lower === 'mo' || lower === 'model') {
      await handleModel();
    } else if (lower === 'c' || lower === 'commands') {
      if (customCommands.length === 0) {
        console.info('No custom commands found.');
      } else {
        console.info('Available custom commands:');
        for (const cmd of customCommands) {
          const desc = cmd.description ? ` — ${cmd.description}` : '';
          console.info(`  //${cmd.name}${desc}`);
        }
        const cmdInput = await ask('Enter command (e.g. //critique-pr): ');
        const trimmed = cmdInput.trim();
        if (trimmed.startsWith('//')) {
          const parts = trimmed.slice(2).split(/\s+/);
          const cmdName = parts[0]!;
          const cmdArgs = parts.slice(1);
          await handleCustomCommand(cmdName, cmdArgs);
        }
      }
    } else if (choice.startsWith('//')) {
      const parts = choice.slice(2).split(/\s+/);
      const cmdName = parts[0]!;
      const cmdArgs = parts.slice(1);
      await handleCustomCommand(cmdName, cmdArgs);
    } else {
      // Treat any other input as a direct prompt
      if (choice.trim()) {
        await sendAndStream(choice).catch((err: unknown) => console.error('Error:', err));
      }
    }
    await prompt();
  };

  await prompt();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
