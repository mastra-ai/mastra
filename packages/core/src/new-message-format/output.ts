import type { FinishReason, MastraAction, PersistableAction, Usage } from './types';

export type ActionRunResult = {
  runId: string;
  /** Persistable actions produced by this run (what storage holds), input included. */
  actions: PersistableAction[];
  text: string;
  finishReason: FinishReason | 'aborted';
  usage: Usage;
};

export type ActionRunOutput = {
  runId: string;
  fullStream: AsyncIterable<MastraAction>;
  textStream: AsyncIterable<string>;
  result: Promise<ActionRunResult>;
};

/**
 * Drives `source` eagerly and lets any number of consumers replay it from the start,
 * so `result`, `fullStream`, and `textStream` can be used independently.
 */
export function createRunOutput(runId: string, source: AsyncIterable<MastraAction>): ActionRunOutput {
  const seen: MastraAction[] = [];
  let done = false;
  let failure: unknown;
  let wake: (() => void)[] = [];
  const notify = () => {
    const w = wake;
    wake = [];
    w.forEach(fn => fn());
  };

  const result = (async (): Promise<ActionRunResult> => {
    try {
      for await (const action of source) {
        seen.push(action);
        notify();
      }
    } catch (error) {
      failure = error;
    } finally {
      done = true;
      notify();
    }
    if (failure) throw failure;

    const actions = seen.filter((a): a is PersistableAction => !a.transient);
    const end = actions.findLast(a => a.type === 'run-end' || a.type === 'run-aborted');
    const lastTurnStart = actions.findLastIndex(a => a.type === 'turn-start');
    const text = actions
      .slice(lastTurnStart + 1)
      .filter(a => a.type === 'text' && a.role === 'assistant')
      .map(a => (a.type === 'text' ? a.text : ''))
      .join('');
    return {
      runId,
      actions,
      text,
      finishReason: end?.type === 'run-end' ? end.finishReason : 'aborted',
      usage: end?.type === 'run-end' ? end.usage : {},
    };
  })();
  // Consumers that only read the streams should not see an unhandled rejection.
  result.catch(() => {});

  async function* replay(): AsyncGenerator<MastraAction> {
    let i = 0;
    while (true) {
      if (i < seen.length) {
        yield seen[i++]!;
        continue;
      }
      if (done) {
        if (failure) throw failure;
        return;
      }
      await new Promise<void>(resolve => wake.push(resolve));
    }
  }

  return {
    runId,
    get fullStream() {
      return replay();
    },
    get textStream() {
      return (async function* () {
        for await (const a of replay()) if (a.type === 'text-delta') yield a.delta;
      })();
    },
    result,
  };
}
