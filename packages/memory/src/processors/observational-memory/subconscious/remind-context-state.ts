/**
 * RemindContextState
 *
 * Carries what the parent thread's accumulated observations currently say about
 * the candidates a passive check is considering, as a state signal on the
 * reminder sidekick rather than as text baked into every check message.
 *
 * Why a state lane instead of prompt text. The evidence is re-read on each
 * check, but between checks it usually has not moved. Prompt text pays for it
 * every time; a state lane pays only when it changes, because an unchanged
 * cache key short-circuits and leaves the cached prefix intact. It also cannot
 * go stale the way a remembered flag can: the lane is recomputed from the
 * parent's committed record at the moment the sidekick is prompted.
 *
 * What the lane is not. It is evidence, not a verdict. An excerpt says the
 * parent's observations mention this candidate; absence of an excerpt says a
 * lexical match was not found, and nothing stronger. Whether that means a
 * reminder is redundant stays the agent's call.
 *
 * Reads are one committed record per turn, and a failed or missing read emits
 * nothing at all rather than an empty snapshot, so a read that did not happen
 * can never present itself as an absence of evidence.
 */

import crypto from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

import type { CandidateContextSource } from './candidate-context';
import { projectCandidateContext } from './candidate-context';
import { getRemindMessageMetadata } from './remind-protocol';

export const REMIND_CONTEXT_STATE_ID = 'subconscious-remind-context';
export const REMIND_CONTEXT_SNAPSHOT_TAG = 'parent-context';

const MEMO_KEY = '__subconsciousRemindContextRead';

export interface RemindContextStateDeps {
  /** Reads the parent thread's committed active observations. Undefined when unavailable. */
  readParentObservations(): Promise<string | undefined>;
}

function messageText(message: MastraDBMessage): string {
  const parts = (message.content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part): part is { type: 'text'; text: string } => {
      return (
        !!part && typeof part === 'object' && (part as { type?: unknown }).type === 'text' && 'text' in (part as object)
      );
    })
    .map(part => part.text)
    .join('\n');
}

/**
 * The candidates of the most recent passive check in the conversation.
 *
 * The check message carries its sources as JSON, which is the only place their
 * text is available; ids alone cannot be matched against observation prose.
 */
export function latestCheckSources(messages: unknown): CandidateContextSource[] | undefined {
  if (!Array.isArray(messages)) return undefined;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as MastraDBMessage | undefined;
    if (!message || typeof message !== 'object') continue;
    const isCheck =
      getRemindMessageMetadata(message)?.type === 'passive-check' ||
      messageText(message).startsWith('Passive reminder check ');
    if (!isCheck) continue;
    const serialized = messageText(message).match(/Scoped source candidates:\n([^\n]+)/)?.[1];
    if (!serialized) continue;
    try {
      const parsed = JSON.parse(serialized);
      if (Array.isArray(parsed)) return parsed as CandidateContextSource[];
    } catch {
      continue;
    }
  }
  return undefined;
}

function render(projection: string): string {
  return `\nWhat the parent's accumulated observations currently say about the candidates in play:\n${projection}\n`;
}

export class RemindContextStateProcessor implements Processor<typeof REMIND_CONTEXT_STATE_ID> {
  readonly id = REMIND_CONTEXT_STATE_ID;
  readonly stateId = REMIND_CONTEXT_STATE_ID;

  constructor(private readonly deps: RemindContextStateDeps) {}

  // One committed-record read per turn. Later steps of the same turn reuse it,
  // and a new turn always reads again, so the lane cannot serve stale evidence
  // across turns.
  private async readObservations(args: ComputeStateSignalArgs): Promise<string | undefined> {
    const stepNumber = typeof args.stepNumber === 'number' ? args.stepNumber : 0;
    const memo = args.state?.[MEMO_KEY] as { atStep: number; observations: string | undefined } | undefined;
    if (memo && stepNumber > memo.atStep) return memo.observations;
    const observations = await this.deps.readParentObservations();
    if (args.state) args.state[MEMO_KEY] = { atStep: stepNumber, observations };
    return observations;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const sources = latestCheckSources(args.messages);
    // No check in play means nothing to project. Emitting an empty snapshot here
    // would retract evidence the parent may well still hold.
    if (!sources?.length) return;

    const observations = await this.readParentObservations(args);
    if (observations === undefined) return;

    const projection = projectCandidateContext({ activeObservations: observations, sources });
    const cacheKey = crypto
      .createHash('sha256')
      .update(`${sources.map(source => source.id ?? '').join(',')}\u0000${projection}`)
      .digest('hex')
      .slice(0, 32);

    // The runtime drops a repeat of the current cache key, but returning early
    // keeps the read and the render off the hot path too.
    if (args.tracking?.currentCacheKey === cacheKey && args.contextWindow.hasSnapshot) return;

    return {
      id: REMIND_CONTEXT_STATE_ID,
      mode: 'snapshot',
      cacheKey,
      tagName: REMIND_CONTEXT_SNAPSHOT_TAG,
      contents: render(projection),
      value: { projection },
      attributes: { candidates: sources.length },
      metadata: { value: { projection } },
    };
  }

  private async readParentObservations(args: ComputeStateSignalArgs): Promise<string | undefined> {
    try {
      return await this.readObservations(args);
    } catch {
      // A failed read is not evidence of absence.
      return undefined;
    }
  }
}
