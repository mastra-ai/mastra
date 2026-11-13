import type { GoalObjectiveRecord, TaskRecord } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { join } from 'node:path';
import { connectedFixture } from './connections';
import { json, startAssistant } from './helpers';

export type Call = { name: string; args: unknown };
export type ProgressCommand = {
  calls?: Call[][];
  missing?: string;
  complete?: boolean;
  scheduledResult?: boolean;
  reuseCompleted?: boolean;
};

export async function progressFixture() {
  const judges: Record<string, unknown>[] = [];
  let callSequence = 0;
  const state = {
    failJudge: false,
    continueGoal: false,
    responseGate: undefined as Promise<void> | undefined,
  };
  const fixture = await connectedFixture(async (body, judge) => {
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
        const value = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
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
      command = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {}
    const results = messages.slice(latest + 1).filter(message => message.role === 'tool');
    // The response exposes actual native results; assertions inspect both them and persisted state.
    const parsed = results.flatMap(result => {
      try {
        return [JSON.parse(String(result.content))];
      } catch {
        return [];
      }
    });
    // The paid-model fixture only reuses completion that actually crossed the native memory boundary.
    if (
      command.reuseCompleted &&
      JSON.stringify(messages.slice(0, latest)).includes('Verified scheduled document content:')
    )
      return {
        text: 'The recorded document existing-document already has verified content. No external action was repeated.',
      };
    if (command.reuseCompleted && JSON.stringify(messages.slice(0, latest)).includes('Content insertion failed'))
      return {
        text: 'Document existing-document exists but its content is incomplete. An owner decision is required before repeating an uncertain external action.',
      };
    const batches = command.calls ?? [];
    let consumed = 0;
    for (const batch of batches) {
      if (results.length < consumed + batch.length) {
        if (
          command.scheduledResult &&
          batch.some(call => call.name === 'google_docs_insert_text') &&
          !parsed.some(result => typeof result.documentId === 'string')
        )
          return {
            text: 'Document creation is unconfirmed. The responsibility remains unfinished.',
          };
        return {
          text: '',
          calls: batch.map(call => ({ ...call, id: `progress-${++callSequence}` })),
        };
      }
      consumed += batch.length;
    }
    const inserted = parsed.find(result => typeof result.documentId === 'string' && Array.isArray(result.replies));
    const checked = parsed.findLast(result => result.summary && result.summary.allCompleted === true);
    const complete = command.complete && inserted && checked;
    await state.responseGate;
    return {
      text:
        command.scheduledResult && inserted
          ? `Verified scheduled document content: ${JSON.stringify(inserted)}`
          : complete
            ? `Verified document content and completed task results: ${JSON.stringify({ inserted, checked })}`
            : command.missing
              ? `Please provide ${command.missing}. Work remains unfinished. ${JSON.stringify(results)}`
              : `Native progress: ${JSON.stringify(results)}`,
    };
  });
  return { ...fixture, providerState: fixture.state, judges, state };
}

/** Read native objective usage and task state from the physical database without dispatching work. */
export async function progressState(dataDir: string, threadId: string) {
  const storage = new LibSQLStore({
    id: 'progress-reader',
    url: `file:${join(dataDir, 'assistant.db')}`,
  });
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
  {
    id: 'draft',
    content: 'Draft the agenda',
    activeForm: 'Drafting the agenda',
    status: 'pending',
  },
  {
    id: 'review',
    content: 'Review with the owner',
    activeForm: 'Reviewing with the owner',
    status: 'pending',
  },
];
