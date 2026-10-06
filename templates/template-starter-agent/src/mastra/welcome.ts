import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { connectTools, hasConnectEnv } from './agents/agent';
import { integrationIdForToolKey } from './workflows/activity-digest';

/** Studio scopes an agent's threads to its registered id. */
const AGENT_ID = 'agent';

/**
 * On the very first boot (no threads in storage yet), the agent opens the
 * conversation itself: it composes its own greeting from its live system
 * prompt and its actual configured tools, seeds a "Welcome" thread, and
 * writes the message as its first turn.
 */
export async function seedWelcomeThread(mastra: Mastra) {
  const agent = mastra.getAgent(AGENT_ID);
  const memory = await agent.getMemory();
  if (!memory) return;

  const { total } = await memory.listThreads({ filter: { resourceId: AGENT_ID }, perPage: 1 });
  if (total > 0) return;

  const text = await composeWelcome(mastra);
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

/**
 * Have the agent write its own first message. Its system prompt supplies the
 * voice and capabilities; a directive user turn gives the guidelines. If the
 * model call fails (no gateway key, offline, …) we fall back to a static
 * greeting so first boot still ends with a usable Welcome thread.
 *
 * The welcome generation runs on `mastra/deepseek/deepseek-flash` — fast and
 * cheap for a one-shot greeting — regardless of the agent's configured model,
 * so first-boot latency and cost stay predictable.
 */
async function composeWelcome(mastra: Mastra): Promise<string> {
  const agent = mastra.getAgent(AGENT_ID);
  const integrations = await listIntegrations(mastra);

  const integrationBlock = integrations.length
    ? `The following integrations are attached and their tools are available to you right now: ${integrations.join(', ')}.`
    : hasConnectEnv
      ? 'No integrations are currently attached to the platform project, so no third-party tools are available yet.'
      : 'Mastra Connect env is not configured in this environment, so no third-party integration tools are available.';

  const directive = `You are opening a fresh install of yourself. No user has messaged you yet — this message will be the first thing they see when they open Studio. Write it now.

Guidelines:
- Write in Markdown, warm and concise (aim for ~150-250 words).
- Speak in first person, in your own voice, based on your system prompt.
- Briefly introduce who you are and summarize what you can do, grounded in the tools you actually have (research, workspace file & shell tools with read-before-write and delete-approval guards, recurring schedules).
- Mention integrations honestly: ${integrationBlock} If none are attached, tell the user how to attach them (from their Mastra platform project, then set MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID) and that new connections are picked up live without a restart.
- Tell the user your system prompt is editable from Studio (Agents → this agent) and that edits persist as files under ./mastra/editor and version with the project.
- End with one open, inviting question that suggests a concrete first thing to try.
- Do NOT call any tools. Output plain Markdown, no code fences around the whole message, no meta commentary about being generated, no headings above H2.`;

  // Generate against a throwaway thread so processors that need a threadId
  // (observational memory, etc.) work, then persist only the agent's response
  // into the real Welcome thread — the directive prompt stays hidden.
  const memory = await agent.getMemory();
  let scratchThreadId: string | undefined;
  try {
    if (memory) {
      const scratch = await memory.createThread({
        resourceId: AGENT_ID,
        title: '__welcome-compose',
        metadata: { transient: true },
      });
      scratchThreadId = scratch.id;
    }
    const result = await agent.generate([{ role: 'user', content: directive }], {
      model: 'mastra/deepseek/deepseek-flash',
      activeTools: [],
      ...(scratchThreadId ? { memory: { thread: scratchThreadId, resource: AGENT_ID } } : {}),
    });
    const text = result.text?.trim();
    if (text) return text;
  } catch (error) {
    mastra.getLogger()?.warn('Welcome generation failed, falling back to static greeting', { error });
  } finally {
    if (scratchThreadId && memory) {
      await memory.deleteThread(scratchThreadId).catch(() => undefined);
    }
  }
  return staticWelcome(integrations);
}

async function listIntegrations(mastra: Mastra): Promise<string[]> {
  if (!connectTools) return [];
  try {
    const tools = await connectTools({ mastra });
    return [...new Set(Object.keys(tools).map(integrationIdForToolKey))].sort();
  } catch {
    return [];
  }
}

function staticWelcome(integrations: string[]): string {
  const integrationLine = integrations.length
    ? `I can currently reach these connected integrations: ${integrations.map(id => `**${id}**`).join(', ')}.`
    : 'No integrations are attached yet — attach some to your Mastra platform project and set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` to unlock their tools live.';

  return `👋 Hi, I'm your **Starter Agent**.

I can research the web, work with files and shell commands in a sandboxed workspace (reads first, deletes need your approval), set up recurring schedules, and run long tasks that survive reloads and restarts.

${integrationLine}

My system prompt lives in Studio — open **Agents → Starter Agent** to edit it. Your changes save to files under \`./mastra/editor\` and version with the project.

What should we try first?`;
}
