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

// ─── TUI main loop ──────────────────────────────────────────────────────────
async function main() {
  console.info('Starting HarnessV1 TUI...');

  const session = await detectOrCreateSession();
  activeSessionId = session.id;
  flushPendingEventLogs();
  console.info(`Session created: ${session.id}`);
  console.info(`Event log: ${eventLogPath(session.id)}`);
  console.info(`Mode: ${session.getMode().id}, Model: ${session.getModelId()}`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => new Promise(resolve => rl.question(question, resolve));

  // ─── Prompt ─────────────────────────────────────────────────────────────
  async function handlePrompt() {
    const promptText = await ask('Enter prompt: ');
    if (!promptText.trim()) return;

    console.info('Sending prompt...');

    let isRunning = false;

    try {
      // ─── Subscribe to the session thread for streamed output ────────────
      console.info('[debug] Subscribing to thread...');
      const subscription = await session.subscribeToThread();
      console.info('[debug] Subscribed. activeRunId:', subscription.activeRunId());

      // ─── Start the run via queueMessage ─────────────────────────────────
      console.info('[debug] Queueing message...');
      const result = await session.queueMessage({ messages: promptText });
      console.info('[debug] queueMessage result:', result);
      if (result.accepted) {
        isRunning = true;
        console.info('[debug] Run accepted, isRunning = true');
      }

      // ─── Read streamed chunks ───────────────────────────────────────────
      let chunkCount = 0;
      const streamPromise = (async () => {
        console.info('[debug] Stream consumer started');
        try {
          for await (const chunk of subscription.stream) {
            chunkCount++;
            if (chunkCount === 1) {
              console.info('[debug] First chunk received');
            }
            // Handle different chunk types
            if (typeof chunk === 'string') {
              process.stdout.write(chunk);
            } else if (chunk && typeof chunk === 'object') {
              const text = (chunk as { text?: string }).text ?? '';
              if (text) process.stdout.write(text);
            }
          }
        } catch (err) {
          if ((err as Error).message !== 'AbortError') {
            console.error('Stream error:', err);
          }
        }
        console.info('[debug] Stream consumer ended, chunks received:', chunkCount);
      })();

      // ─── While the agent is running, allow follow-up prompts ────────────
      const steerPromise = (async () => {
        while (isRunning) {
          // Small delay to avoid blocking the event loop
          await new Promise<void>(resolve => setTimeout(resolve, 50));
          if (!isRunning) break;

          const steerText = await ask('\n> ');
          if (!steerText.trim()) continue;

          try {
            await session.sendMessage({ messages: steerText });
          } catch (err) {
            console.error('Steer error:', err);
          }
        }
      })();

      // ─── Poll activeRunId to detect when the run finishes ───────────────
      const pollPromise = (async () => {
        console.info('[debug] Poll started, activeRunId:', subscription.activeRunId());
        // Wait a tick for the run to register
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        while (isRunning) {
          const runId = subscription.activeRunId();
          console.info('[debug] Poll check, activeRunId:', runId);
          if (!runId) {
            // No active run — the stream should finish shortly
            console.info('[debug] No active run, breaking poll');
            break;
          }
          await new Promise<void>(resolve => setTimeout(resolve, 100));
        }
        isRunning = false;
        console.info('[debug] Poll ended');
      })();

      // ─── Wait for run completion, then unsubscribe to end the stream ─────
      await pollPromise;
      console.info('[debug] Poll done, unsubscribing...');
      subscription.unsubscribe();
      console.info('[debug] Unsubscribed, awaiting stream...');
      await streamPromise;
      console.info('[debug] Stream done, awaiting steer...');
      await steerPromise;

      console.info('[debug] Prompt handling complete');
      console.info();
    } catch (err) {
      console.error('Error:', err);
    }
  }

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

  // ─── Main loop ────────────────────────────────────────────────────────────
  const prompt = async () => {
    const answer = await ask('\n[p]rompt, [m]ode, [mo]del, [q]uit: ');
    const choice = answer.trim().toLowerCase();

    if (choice === 'q' || choice === 'quit') {
      console.info('Goodbye!');
      rl.close();
      await flushEventLogWrites();
      process.exit(0);
    } else if (choice === 'p' || choice === 'prompt') {
      await handlePrompt();
    } else if (choice === 'm' || choice === 'mode') {
      await handleMode();
    } else if (choice === 'mo' || choice === 'model') {
      await handleModel();
    } else {
      console.info('Unknown command');
    }
    await prompt();
  };

  await prompt();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
