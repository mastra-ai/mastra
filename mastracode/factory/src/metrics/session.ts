import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import { factoryMetrics } from './metrics.js';

/** The slice of a session the first-output timer needs. */
export interface FirstOutputSession {
  readonly run: { isRunning(): boolean };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
  sendSignal(...args: never[]): { accepted: Promise<{ action?: string }> };
}

type FirstOutput = 'text' | 'reasoning' | 'tool_call';

// What a signal did when it did not start a run: nothing to wait for.
const NO_RUN = new Set(['persist', 'discard', 'blocked']);

/** The kind of model output an event carries, or nothing when it carries none. */
function outputKind(event: AgentControllerEvent): FirstOutput | undefined {
  if (event.type === 'tool_input_start' || event.type === 'tool_start') return 'tool_call';
  if (event.type === 'message_update') {
    if (event.event.type === 'text-delta') return 'text';
    if (event.event.type === 'reasoning-delta') return 'reasoning';
    return partKind(event.event.part.type);
  }
  // A person's message and a notice start a message too; only the model's counts.
  if (event.type === 'message_start' && event.message.role === 'assistant') {
    return partKind(event.message.content.parts.at(-1)?.type);
  }
  return undefined;
}

function partKind(type: string | undefined): FirstOutput | undefined {
  if (type === 'text' || type === 'reasoning') return type;
  if (type === 'tool-invocation') return 'tool_call';
  return undefined;
}

/**
 * Times how long a message waits for the model's first output
 * (`mastra_factory_session_first_output_ms`): from the message reaching an idle session to the
 * first text, reasoning or tool call of the run it starts. Everything in between counts: waiting
 * for the thread, building tools, memory, and the model's own time to first token.
 *
 * `turn` is `first` for the first run since this process loaded the session and `later` after
 * that; `first` says what the output was. A run that ends without any output is recorded with
 * `outcome=no_output`, so a start that fails still counts. A message sent while a run is in
 * flight joins that run and is not timed.
 *
 * Patches `sendSignal` in place: every message, notice and board-started run goes through it.
 */
export function instrumentSessionFirstOutput(session: FirstOutputSession): void {
  if (!factoryMetrics().enabled('session')) return;
  let waitingSince: number | undefined;
  let turn: 'first' | 'later' = 'first';

  const record = (labels: { outcome: 'ok'; first: FirstOutput } | { outcome: 'no_output' }) => {
    if (waitingSince === undefined) return;
    factoryMetrics().observe('session', 'mastra_factory_session_first_output_ms', performance.now() - waitingSince, {
      turn,
      ...labels,
    });
    waitingSince = undefined;
    turn = 'later';
  };

  const original = session.sendSignal;
  session.sendSignal = (...args: never[]) => {
    const idle = !session.run.isRunning();
    const result = original.apply(session, args);
    if (idle && waitingSince === undefined) {
      const sentAt = performance.now();
      waitingSince = sentAt;
      const drop = () => {
        if (waitingSince === sentAt) waitingSince = undefined;
      };
      result.accepted.then(settled => {
        if (settled.action && NO_RUN.has(settled.action)) drop();
      }, drop);
    }
    return result;
  };

  session.subscribe(event => {
    if (waitingSince === undefined) return;
    if (event.type === 'agent_end') return record({ outcome: 'no_output' });
    const first = outputKind(event);
    if (first) record({ outcome: 'ok', first });
  });
}
