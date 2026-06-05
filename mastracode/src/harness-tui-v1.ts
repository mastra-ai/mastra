import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { createInterface } from 'node:readline';
import { Agent } from '@mastra/core/agent';
import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessMode as HarnessModeV1 } from '@mastra/core/harness/v1';
import { InMemoryHarness } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';

// ─── Hash helper (same as mastracode uses) ────────────────────────────────
function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ─── Modes ────────────────────────────────────────────────────────────────
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
  id: 'code-agent',
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

// ─── Create HarnessV1 ───────────────────────────────────────────────────────
const harness = new HarnessV1({
  ownerId,
  agent: codeAgent,
  memory,
  modes,
  defaultModeId,
  storage: harnessStorage,
});

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
  console.info(`Session created: ${session.id}`);
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
    try {
      const stream = await codeAgent.stream([{ role: 'user', content: promptText }], { model: session.getModelId() });
      for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
      }
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
