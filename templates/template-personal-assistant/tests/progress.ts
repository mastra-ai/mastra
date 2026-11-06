import { LibSQLStore } from '@mastra/libsql';
import type { GoalObjectiveRecord, TaskRecord } from '@mastra/core/storage';
import { join } from 'node:path';
import { connectedFixture } from './connections';
import { json, startAssistant } from './helpers';

export type Call = { name: string; args: unknown };
export type ProgressCommand = { calls?: Call[][]; missing?: string; complete?: boolean };

export async function progressFixture() {
  const judges: Record<string, unknown>[] = [];
  let callSequence = 0;
  const state = { failJudge: false, continueGoal: false };
  const fixture = await connectedFixture((body, judge) => {
    const messages = body.messages as { role: string; content: unknown }[];
    if (judge) {
      judges.push(body);
      if (state.failJudge) return { text: 'Judge unavailable.', status: 400 };
      const evidence = JSON.stringify(messages);
      const complete = evidence.includes('Verified document content and completed task results:');
      return {
        text: JSON.stringify({
          decision: complete ? 'done' : state.continueGoal ? 'continue' : 'waiting',
          reason: complete
            ? 'All requested steps have concrete results.'
            : state.continueGoal
              ? 'Continue the remaining work.'
              : 'Required information or owner approval is still outstanding.',
        }),
      };
    }
    const latest = messages.findLastIndex(message => {
      if (message.role !== 'user') return false;
      const text =
        typeof message.content === 'string'
          ? message.content
          : Array.isArray(message.content)
            ? message.content.map(part => part.text ?? '').join('')
            : '';
      try {
        const value = JSON.parse(text);
        return value && typeof value === 'object';
      } catch {
        return false;
      }
    });
    const content = messages[latest]?.content;
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map(part => part.text ?? '').join('')
          : '';
    let command: ProgressCommand = {};
    try {
      command = JSON.parse(text);
    } catch {}
    const results = messages.slice(latest + 1).filter(message => message.role === 'tool');
    const batches = command.calls ?? [];
    let consumed = 0;
    for (const batch of batches) {
      if (results.length < consumed + batch.length)
        return { text: '', calls: batch.map(call => ({ ...call, id: `progress-${++callSequence}` })) };
      consumed += batch.length;
    }
    // The response exposes actual native results; assertions inspect both them and persisted state.
    const parsed = results.flatMap(result => {
      try {
        return [JSON.parse(String(result.content))];
      } catch {
        return [];
      }
    });
    const inserted = parsed.find(result => typeof result.documentId === 'string' && Array.isArray(result.replies));
    const checked = parsed.findLast(result => result.summary && result.summary.allCompleted === true);
    const complete = command.complete && inserted && checked;
    return {
      text: complete
        ? `Verified document content and completed task results: ${JSON.stringify({ inserted, checked })}`
        : command.missing
          ? `Please provide ${command.missing}. Work remains unfinished. ${JSON.stringify(results)}`
          : `Native progress: ${JSON.stringify(results)}`,
    };
  });
  return { ...fixture, providerState: fixture.state, judges, state };
}

export async function progressState(dataDir: string, threadId: string) {
  const storage = new LibSQLStore({ id: 'progress-reader', url: `file:${join(dataDir, 'assistant.db')}` });
  await storage.init();
  try {
    const domain = await storage.getStore('threadState');
    return {
      objective: await domain!.getState<GoalObjectiveRecord>({ threadId, type: 'goal' }),
      tasks: (await domain!.getState<TaskRecord[]>({ threadId, type: 'task' })) ?? [],
    };
  } finally {
    await storage.close();
  }
}

export async function progressTurn(
  app: Awaited<ReturnType<typeof startAssistant>>,
  threadId: string,
  command: ProgressCommand,
  options: Record<string, unknown> = {},
) {
  return json(
    await app.request('/agents/personalAssistant/generate', 'POST', {
      messages: [{ role: 'user', content: JSON.stringify(command) }],
      memory: { thread: threadId, resource: 'local-owner' },
      ...options,
    }),
  );
}

export const taskPlan = [
  {
    id: 'research',
    content: 'Research the meeting topic',
    activeForm: 'Researching the meeting topic',
    status: 'in_progress',
  },
  { id: 'draft', content: 'Draft the agenda', activeForm: 'Drafting the agenda', status: 'pending' },
  { id: 'review', content: 'Review with the owner', activeForm: 'Reviewing with the owner', status: 'pending' },
];
