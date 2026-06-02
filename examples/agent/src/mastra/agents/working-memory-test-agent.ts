import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

/**
 * A simple weather tool used as a control for tool-call persistence.
 *
 * If `update-working-memory` tool invocations disappear from the persisted
 * assistant message after refresh but `getWeather` invocations DO get
 * persisted, the bug is specific to the working memory tool flow (e.g. the
 * tool result being swallowed because the WM tool intentionally returns no
 * model-visible content). If neither tool gets persisted, the bug is in the
 * signal-subscription persistence path generally.
 */
const getWeatherTool = createTool({
  id: 'get-weather',
  description: 'Get a fake weather report for a given city. Use this when the user asks about weather.',
  inputSchema: z.object({
    city: z.string().describe('City to get weather for'),
  }),
  outputSchema: z.object({
    location: z.string(),
    temperatureF: z.number(),
    conditions: z.string(),
    humidityPct: z.number(),
  }),
  execute: async ({ city }) => {
    return {
      location: city,
      temperatureF: 68,
      conditions: 'sunny with light clouds',
      humidityPct: 42,
    };
  },
});

/**
 * Two agents that share the same working memory template and storage, but
 * differ in delivery path. Use them side-by-side in Studio to verify the
 * `useStateSignals` opt-in:
 *
 * - `working-memory-classic`  → working memory is folded into the system
 *   prompt (default behavior on main).
 * - `working-memory-signals`  → working memory is emitted as a `data-signal`
 *   chunk via the new `WorkingMemoryStateProcessor` (opt-in path added in
 *   `feat/working-memory-state-signal-opt-in`).
 *
 * Both agents read/write the same `workingMemory` field on the resource, so
 * the tool round-trip is identical — only the delivery to the model changes.
 *
 * Manual test script:
 *   1. Pick either agent in Studio. Start a new thread.
 *   2. Say: "Hi, I'm Caleb and my favorite color is orange. I'm allergic to peanuts."
 *   3. The agent should call `update-working-memory`.
 *   4. Say: "What's my name, favorite color, and what am I allergic to?"
 *   5. Both agents should answer correctly.
 *   6. Open the request trace:
 *      - classic: the system prompt contains `<working_memory_data>...`
 *      - signals: no working-memory block in the system prompt; a
 *        `data-signal` part with `tagName: 'working-memory'` appears in
 *        the message stream instead.
 *   7. Send an idle message ("say hi"). The signals agent should NOT emit
 *      a new working-memory `data-signal` (cacheKey dedup).
 */

const wmTemplate = `# User Profile
- Name:
- Favorite color:
- Allergies:
- Notes:
`;

const storage = new LibSQLStore({
  id: 'wm-test-storage',
  url: 'file:./wm-test.db',
});

const sharedInstructions = `You are a profile-tracking assistant. You MUST keep the user's profile up to date in working memory.

RULES:
- On the FIRST user message of every thread, call \`update-working-memory\` to initialize the profile (even if mostly empty).
- Whenever the user tells you ANYTHING about themselves (name, preferences, allergies, anything that fills a profile field), you MUST call \`update-working-memory\` BEFORE replying to them.
- When asked "what do you remember" or "what's my name", answer using the working memory profile data.
- If the user asks about weather, call the \`get-weather\` tool.
- Never invent values. Only write what the user actually told you.
- Keep replies short.`;

export const workingMemoryClassicAgent = new Agent({
  id: 'working-memory-classic',
  name: 'Working Memory (Classic)',
  description:
    'Working memory delivered via system prompt (default path). Pair with `working-memory-signals` to compare.',
  instructions: sharedInstructions,
  model: 'openai/gpt-5.4-mini',
  tools: { getWeatherTool },
  memory: new Memory({
    storage,
    options: {
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: wmTemplate,
        // useStateSignals defaults to false — classic behavior
      },
      lastMessages: 10,
    },
  }),
});

export const workingMemorySignalsAgent = new Agent({
  id: 'working-memory-signals',
  name: 'Working Memory (State Signals)',
  description:
    'Working memory delivered via state signals (opt-in). Same template/storage as `working-memory-classic`, but emits a `data-signal` instead of a system prompt block.',
  instructions: sharedInstructions,
  model: 'openai/gpt-5.4-mini',
  tools: { getWeatherTool },
  memory: new Memory({
    storage,
    options: {
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: wmTemplate,
        useStateSignals: true,
      },
      lastMessages: 10,
    },
  }),
});
