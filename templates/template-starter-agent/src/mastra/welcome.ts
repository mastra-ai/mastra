import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { connectTools, hasConnectEnv } from './agents/agent';
import { integrationIdForToolKey } from './workflows/activity-digest';

/** Studio scopes an agent's threads to its registered id. */
const AGENT_ID = 'agent';

/**
 * On the very first boot (no threads in storage yet), the agent opens the
 * conversation: a seeded "Welcome" thread whose first message is from the
 * agent, introducing its capabilities, the integrations it can reach, and how
 * to reshape its system prompt from Studio.
 */
export async function seedWelcomeThread(mastra: Mastra) {
  const agent = mastra.getAgent(AGENT_ID);
  const memory = await agent.getMemory();
  if (!memory) return;

  const { total } = await memory.listThreads({ filter: { resourceId: AGENT_ID }, perPage: 1 });
  if (total > 0) return;

  const text = await welcomeMessage(mastra);
  const thread = await memory.createThread({ resourceId: AGENT_ID, title: '👋 Welcome' });
  await memory.saveMessages({
    messages: [
      {
        id: randomUUID(),
        threadId: thread.id,
        resourceId: AGENT_ID,
        role: 'assistant',
        type: 'text',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text }], content: text },
      },
    ],
  });
  mastra.getLogger()?.info('Seeded welcome thread with the agent’s first message');
}

async function welcomeMessage(mastra: Mastra): Promise<string> {
  return `👋 Hi, I'm your **Starter Agent** — since this is your first visit, let me introduce myself.

## What I can do

- **Research** — I search the web and fetch pages, so I can answer questions about current events, docs, prices, weather, anything live.
- **Workspace** — I read, write, and edit files and run commands in a sandbox. I'm careful by default: I must read a file before changing it, and deletes need your explicit approval.
- **Schedules** — ask for recurring work ("every weekday at 9am, digest my Linear activity") and I'll set it up; ask again to stop it.
- **Durable runs** — long tasks survive page reloads and server restarts. If we get disconnected, reopen the thread and the stream picks up where it left off.

## Integrations

${await integrationsSection(mastra)}

## Make me yours

My system prompt isn't fixed — open **Agents → Starter Agent** in this Studio and edit my instructions. The editor runs in \`source: 'code'\` mode, so your changes are saved as files under \`./mastra/editor\` and version with the project.

What should we try first?`;
}

async function integrationsSection(mastra: Mastra): Promise<string> {
  if (!connectTools) {
    return `No integrations are connected yet. Attach integrations (Linear, Notion, Slack, …) to your Mastra platform project at https://cloud.mastra.ai and set \`MASTRA_PLATFORM_ACCESS_TOKEN\` and \`MASTRA_PROJECT_ID\` — their tools show up here automatically, no restart needed.${hasConnectEnv ? '' : ' (Platform env is not configured in this environment.)'}`;
  }
  try {
    const tools = await connectTools({ mastra });
    const integrations = [...new Set(Object.keys(tools).map(integrationIdForToolKey))].sort();
    if (integrations.length === 0) {
      return 'Your platform project is configured, but no integrations are attached yet. Attach some at https://cloud.mastra.ai and their tools show up here automatically — no restart needed.';
    }
    return `I can currently use tools from these connected integrations:\n\n${integrations.map(id => `- **${id}**`).join('\n')}\n\nAttach or detach connections at https://cloud.mastra.ai and I pick the change up live.`;
  } catch {
    return 'Your platform project is configured, but I could not list its integrations just now — check the server logs, then ask me "what integrations can you use?" to retry.';
  }
}
