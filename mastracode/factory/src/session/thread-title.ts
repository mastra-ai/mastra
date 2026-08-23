import { generateThreadTitle } from '@mastra/code-sdk';
import type { ThinkingLevel } from '@mastra/code-sdk';
import type { AgentControllerEvent, MastraDBMessage } from '@mastra/core/agent-controller';

export interface ThreadTitleGenerationConfig {
  /**
   * Model id (`provider/model`) used to generate titles. Omitted → the default
   * for the first provider this process can authenticate: Anthropic gets
   * `claude-haiku-4-5`, OpenAI gets `gpt-5.6-luna` at low thinking.
   */
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

export interface ThreadTitleSession {
  readonly thread: {
    getId(): string | null;
    getById(input: { threadId: string }): Promise<{ title?: string | null } | null>;
    firstUserMessage(input: { threadId: string }): Promise<MastraDBMessage | null>;
    rename(input: { title: string }): Promise<void>;
  };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export function createThreadTitleGenerator({ model, thinkingLevel }: ThreadTitleGenerationConfig) {
  return (prompt: string) =>
    generateThreadTitle({
      prompt,
      ...(model ? { model } : {}),
      ...(thinkingLevel ? { thinkingLevel } : {}),
    });
}

function firstLineText(message: MastraDBMessage): string {
  return message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join(' ');
}

async function titleActiveThread(
  session: ThreadTitleSession,
  { generateTitle }: { generateTitle: (prompt: string) => Promise<string | undefined> },
): Promise<void> {
  const threadId = session.thread.getId();
  if (!threadId) return;

  const thread = await session.thread.getById({ threadId });
  if (thread?.title?.trim()) return;

  const message = await session.thread.firstUserMessage({ threadId });
  if (!message) return;
  const prompt = firstLineText(message);
  if (!prompt.trim()) return;

  const title = await generateTitle(prompt);
  if (!title) return;

  // The user may have named the thread while the request ran — keep theirs.
  const current = await session.thread.getById({ threadId });
  if (current?.title?.trim()) return;

  await session.thread.rename({ title });
}

/**
 * Name an otherwise-untitled thread after its first message reaches the agent.
 *
 * On the session's first `agent_start` the first user prompt is sent to a cheap
 * side model (fire-and-forget — never blocks or fails the answer) and the
 * resulting noun phrase becomes the thread title. Threads already carrying an
 * explicit title (work items, review sessions, `/name`) are left alone, so the
 * clients' fallback naming keeps covering everything this skips.
 */
export function observeSessionThreadTitle(
  session: ThreadTitleSession,
  dependencies: { generateTitle: (prompt: string) => Promise<string | undefined> },
): () => void {
  let seen = false;
  const unsubscribe = session.subscribe(event => {
    if (seen || event.type !== 'agent_start') return;
    seen = true;
    unsubscribe();
    void titleActiveThread(session, dependencies).catch(error =>
      console.warn('[Factory thread-title] Unable to generate a thread title.', error),
    );
  });
  return unsubscribe;
}
