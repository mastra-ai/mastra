/**
 * Pi Agent + Mastra Observational Memory — Interactive Chat
 *
 * As you chat, OM compresses long conversations into structured observations
 * so context is never lost — even across hundreds of messages.
 *
 * Commands:
 *   /status  — Show observation/reflection progress
 *   /obs     — Show current observations
 *   /clear   — Reset conversation
 *   /quit    — Exit
 */

import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import Readline from 'readline';
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';
import { createMastraOM } from '@mastra/pi';
import { LibSQLStore } from '@mastra/libsql';

// ---------------------------------------------------------------------------
// Config — change these to match your setup
// ---------------------------------------------------------------------------

const MODEL_PROVIDER = 'anthropic';
const MODEL_ID = 'claude-sonnet-4-20250514';
const SESSION_ID = `demo-${Date.now()}`;
const SHOW_STATUS = process.argv.includes('--show-status');

const SYSTEM_PROMPT = `You are a warm, curious conversational companion.

You have a great memory (powered by observational memory) and love to learn
about the person you're talking to. Ask follow-up questions, remember details
they've shared, and weave earlier context into new responses naturally.

Keep responses concise (2-4 sentences) unless the human asks for more detail.
Use a friendly, natural tone — like chatting with a good friend.`;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n  Pi Agent + Mastra Observational Memory\n');

  // Storage: local SQLite via LibSQLStore
  await mkdir('.pi-demo', { recursive: true });
  const store = new LibSQLStore({ id: 'pi-demo', url: 'file:.pi-demo/memory.db' });
  await store.init();
  const storage = await store.getStore('memory');
  if (!storage) throw new Error('Failed to initialize storage');

  // Observational Memory integration
  const om = createMastraOM({
    storage,
    model: `${MODEL_PROVIDER}/${MODEL_ID}`,
    observation: {
      messageTokens: { min: 4_000, max: 8_000 },
    },
    reflection: {
      observationTokens: { min: 40_000, max: 60_000 },
    },
  });

  await om.initSession(SESSION_ID);

  // Pi Agent
  const agent = new Agent({
    initialState: {
      systemPrompt: await om.wrapSystemPrompt(SYSTEM_PROMPT, SESSION_ID),
      model: getModel(MODEL_PROVIDER, MODEL_ID),
    },
    transformContext: om.createTransformContext(SESSION_ID, {
      onObservationStart: () => process.stdout.write('\n  ◉ Observing conversation...'),
      onObservationEnd: () => process.stdout.write(' done\n'),
      onReflectionStart: () => process.stdout.write('\n  ◉ Reflecting on observations...'),
      onReflectionEnd: () => process.stdout.write(' done\n'),
    }),
  });

  // Stream assistant text to stdout
  agent.subscribe(event => {
    if (event.type === 'message_update') {
      const msg = event.message;
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if ('text' in part && part.text) {
            const text = part.text;
            const printed = (agent as any).__printed ?? 0;
            if (text.length > printed) {
              process.stdout.write(text.slice(printed));
              (agent as any).__printed = text.length;
            }
          }
        }
      }
    }
    if (event.type === 'message_end') {
      (agent as any).__printed = 0;
      process.stdout.write('\n\n');
    }
  });

  // ---------------------------------------------------------------------------
  // REPL
  // ---------------------------------------------------------------------------

  console.log(`  Model: ${MODEL_PROVIDER}/${MODEL_ID}`);
  console.log('  Commands: /status  /obs  /clear  /quit\n');

  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (): Promise<string> =>
    new Promise(resolve => {
      rl.question('You: ', answer => resolve(answer));
    });

  while (true) {
    const input = (await ask()).trim();
    if (!input) continue;

    if (input === '/quit' || input === '/exit') {
      console.log('\n  Goodbye!\n');
      break;
    }

    if (input === '/status') {
      const status = await om.getStatus(SESSION_ID, agent.state.messages);
      console.log(`\n${status}\n`);
      continue;
    }

    if (input === '/obs') {
      const observations = await om.getObservations(SESSION_ID);
      console.log(observations ? `\n${observations}\n` : '\n  No observations yet — keep chatting!\n');
      continue;
    }

    if (input === '/clear') {
      agent.reset();
      await om.initSession(SESSION_ID);
      agent.state.systemPrompt = await om.wrapSystemPrompt(SYSTEM_PROMPT, SESSION_ID);
      console.log('\n  Conversation cleared.\n');
      continue;
    }

    // Send to agent
    process.stdout.write('\nAgent: ');
    try {
      await agent.prompt({ role: 'user', content: input, timestamp: Date.now() });
      await agent.waitForIdle();

      // Refresh system prompt with latest observations
      agent.state.systemPrompt = await om.wrapSystemPrompt(SYSTEM_PROMPT, SESSION_ID);

      if (SHOW_STATUS) {
        const status = await om.getStatus(SESSION_ID, agent.state.messages);
        console.log(status);
      }
    } catch (err) {
      console.error(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  rl.close();
  process.exit(0);
}

main();
