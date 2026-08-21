import { createHash } from 'node:crypto';

import type { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';

import { applyExtractorHooks } from '../extracted-values';
import { Subconscious } from '../subconscious';
import type { ReconstructedCycle } from './reconstruct';

/**
 * The A/B lever, and nothing else.
 *
 * Only the appended `capture` / `curate` instructions may differ between two arms —
 * everything else is asserted identical before a run starts, so a printed diff can
 * only be attributable to the prompt. See `assertArmsComparable`.
 */
export type ArmPrompts = {
  capture?: string;
  curate?: string;
};

export type ArmConfig = {
  name: string;
  prompts: ArmPrompts;
  /** Run a curation after every Nth cycle. */
  curationCadence: number;
  defaultScope: 'thread' | 'resource' | 'org';
  maxScope: 'thread' | 'resource' | 'org';
  /**
   * Step budget for the curator. Curation over a real worklist is many tool calls
   * (read node, append, supersede); too small a budget ends the turn before the
   * curator emits its completion marker, which the curator treats as failure.
   */
  curateMaxSteps: number;
};

export type CurationOutcome = 'ran' | 'no-op' | 'skipped' | 'no-model' | 'failed';

export type CurationEvent = {
  cycleIndex: number;
  outcome: CurationOutcome;
  worklistBefore: number;
  cursorAdvanced: boolean;
};

export type ReplayResult = {
  cyclesReplayed: number;
  curations: CurationEvent[];
  warnings: string[];
};

/** Everything about an arm except its prompts — the surface that must match. */
function invariantSurface(arm: ArmConfig) {
  return {
    curationCadence: arm.curationCadence,
    defaultScope: arm.defaultScope,
    maxScope: arm.maxScope,
    curateMaxSteps: arm.curateMaxSteps,
  };
}

/**
 * Refuse to run two arms that differ in anything but their prompts. A `curationCadence`
 * or scope difference would show up in the diff looking exactly like a prompt effect.
 */
export function assertArmsComparable(a: ArmConfig, b: ArmConfig): void {
  const left = invariantSurface(a) as Record<string, unknown>;
  const right = invariantSurface(b) as Record<string, unknown>;
  const differing = Object.keys(left).filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
  if (differing.length) {
    throw new Error(
      `Arms "${a.name}" and "${b.name}" differ outside their prompts (${differing.join(', ')}). ` +
        `Only capture/curate instructions may vary between arms.`,
    );
  }
}

/** Stable hash of an arm's full configuration, safe to print (no conversation content). */
export function armConfigHash(arm: ArmConfig): string {
  const canonical = JSON.stringify({
    prompts: { capture: arm.prompts.capture ?? null, curate: arm.prompts.curate ?? null },
    ...invariantSurface(arm),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/** Build the Subconscious for an arm. The prompts are appended to the built-in contracts. */
export function buildArmSubconscious(arm: ArmConfig): Subconscious {
  return new Subconscious({
    observation: [{ name: 'capture', instructions: arm.prompts.capture }],
    reflection: [{ name: 'curate', instructions: arm.prompts.curate, maxSteps: arm.curateMaxSteps }],
    defaultScope: arm.defaultScope,
    maxScope: arm.maxScope,
  });
}

type MemoryLike = {
  getMergedThreadConfig: (config: Record<string, unknown>) => { observationalMemory?: unknown };
  storage: { getStore: (domain: 'knowledge') => Promise<KnowledgeStoreLike | undefined> };
  runCuration: (options: {
    threadId: string;
    resourceId: string;
    requestContext?: RequestContext;
  }) => Promise<{ outcome: CurationOutcome }>;
};

type KnowledgeStoreLike = {
  getCurationCursor: (options: {
    sourceThreadId: string;
    agent: string;
  }) => Promise<{ lastKnowledgeId?: string } | null>;
  knowledgeBySource: (options: {
    sourceThreadId: string;
    scope: string[];
    after?: string;
    limit?: number;
    includeDeleted?: boolean;
  }) => Promise<{ records: unknown[]; nextCursor?: string }>;
};

/**
 * Fail fast when no curator is configured.
 *
 * `runCuration` returns `'no-op'` both for an empty worklist and for a Memory with no
 * Subconscious at all (`packages/memory/src/index.ts:424`), so a misconfigured arm is
 * otherwise indistinguishable from "this prompt produced nothing" — which would make
 * every A/B result a lie.
 */
export function assertCuratorConfigured(memory: MemoryLike): void {
  const omConfig = memory.getMergedThreadConfig({}).observationalMemory as
    | { experimental_subconscious?: unknown }
    | boolean
    | undefined;
  const subconscious =
    omConfig && typeof omConfig === 'object' ? (omConfig.experimental_subconscious as unknown) : undefined;
  if (!(subconscious instanceof Subconscious)) {
    throw new Error('Replay requires a Memory with an experimental_subconscious configured; refusing to run.');
  }
  const hasCurator = subconscious.resolved.reflection.some(agent => agent.name === 'curate');
  if (!hasCurator) {
    throw new Error('Replay requires a Subconscious with a "curate" reflection agent; refusing to run.');
  }
}

function requestContextWithOrg(organizationId: string): RequestContext {
  if (!organizationId.trim()) throw new Error('Replay requires a non-empty organizationId.');
  const requestContext = new RequestContext();
  requestContext.set('organizationId', organizationId);
  return requestContext;
}

async function countWorklist(
  store: KnowledgeStoreLike,
  sourceThreadId: string,
  scope: string[],
  after?: string,
): Promise<number> {
  let cursor = after;
  let total = 0;
  do {
    const page = await store.knowledgeBySource({
      sourceThreadId,
      scope,
      after: cursor,
      limit: 100,
      includeDeleted: true,
    });
    total += page.records.length;
    cursor = page.nextCursor;
  } while (cursor && total < 500);
  return total;
}

export type ReplayOptions = {
  cycles: ReconstructedCycle[];
  threadId: string;
  resourceId: string;
  organizationId: string;
  memory: MemoryLike;
  subconscious: Subconscious;
  /** Agent used for the capture extraction call; carries the arm's observer model. */
  captureAgent: Pick<Agent, 'generate'>;
  curationCadence: number;
  onEvent?: (line: string) => void;
};

/**
 * Replay an ordered list of reconstructed cycles through the real capture extractor
 * and the real curator.
 *
 * The cycle list is the interface boundary: a future re-observation mode is a different
 * cycle *source* behind this same signature, not a rewrite.
 */
export async function replayCycles(options: ReplayOptions): Promise<ReplayResult> {
  const { cycles, threadId, resourceId, organizationId, memory, subconscious, captureAgent } = options;
  assertCuratorConfigured(memory);

  const store = await memory.storage.getStore('knowledge');
  if (!store) throw new Error('Replay requires a configured knowledge storage domain.');

  const scope = [`org:${organizationId}`, `resource:${resourceId}`, `thread:${threadId}`];
  const extractors = subconscious.createObservationExtractors();
  const capture = extractors.find(extractor => extractor.slug === 'capture');
  if (!capture) throw new Error('Replay requires the built-in "capture" observation extractor.');

  const curations: CurationEvent[] = [];
  const warnings: string[] = [];
  let sinceLastCuration = 0;

  const runCurationStep = async (cycleIndex: number, requestContext: RequestContext) => {
    const cursorBefore = await store.getCurationCursor({ sourceThreadId: threadId, agent: 'curate' });
    const worklistBefore = await countWorklist(store, threadId, scope, cursorBefore?.lastKnowledgeId);
    // The curator is fail-closed: a model reply missing the completion marker throws.
    // That is a property of the model under test, not of the replay, so it is recorded
    // as a `failed` curation and counted in the summary rather than killing the arm.
    let outcome: CurationOutcome;
    try {
      ({ outcome } = await memory.runCuration({ threadId, resourceId, requestContext }));
    } catch (error) {
      outcome = 'failed';
      warnings.push(`cycle ${cycleIndex}: curation failed (${error instanceof Error ? error.message : String(error)})`);
    }

    if (outcome === 'skipped' || outcome === 'no-model') {
      throw new Error(`cycle ${cycleIndex}: curation returned "${outcome}"; aborting the arm.`);
    }
    if (outcome === 'no-op' && worklistBefore > 0) {
      throw new Error(
        `cycle ${cycleIndex}: curation returned "no-op" with ${worklistBefore} pending records; aborting the arm.`,
      );
    }

    const cursorAfter = await store.getCurationCursor({ sourceThreadId: threadId, agent: 'curate' });
    const cursorAdvanced =
      Boolean(cursorAfter?.lastKnowledgeId) && cursorAfter?.lastKnowledgeId !== cursorBefore?.lastKnowledgeId;
    if (outcome === 'ran' && !cursorAdvanced) {
      warnings.push(`cycle ${cycleIndex}: curation ran but the curation cursor did not advance`);
    }

    curations.push({ cycleIndex, outcome, worklistBefore, cursorAdvanced });
    options.onEvent?.(
      `CURATION=${cycleIndex} outcome=${outcome} worklist=${worklistBefore} advanced=${cursorAdvanced}`,
    );
  };

  for (const [cycleIndex, cycle] of cycles.entries()) {
    const requestContext = requestContextWithOrg(organizationId);
    const hookContext = { threadId, resourceId, memory, requestContext } as unknown as Parameters<
      typeof capture.resolve
    >[0];
    const resolved = await capture.resolve(hookContext);

    const result = await captureAgent.generate(`${resolved.instructions}\n\n## Observations\n\n${cycle.observations}`, {
      structuredOutput: { schema: resolved.schema },
      requestContext,
    } as never);

    const extracted = (result as { object?: unknown }).object;
    if (extracted === undefined) {
      warnings.push(`cycle ${cycleIndex}: capture returned no structured output`);
    } else {
      const hooks = await applyExtractorHooks({
        source: 'observer',
        extractors: [resolved],
        values: { [resolved.slug]: extracted },
        rawObservations: cycle.observations,
        threadId,
        resourceId,
        memory,
        requestContext,
      } as never);
      const failures = (hooks as { failures?: { slug: string; error: string }[] }).failures ?? [];
      // applyExtractorHooks swallows hook errors into `failures`; silence is not success.
      if (failures.length) {
        throw new Error(
          `cycle ${cycleIndex}: capture hook failed (${failures.map(f => `${f.slug}: ${f.error}`).join('; ')})`,
        );
      }
    }

    options.onEvent?.(`CYCLE=${cycleIndex} source=${cycle.source} captured=${extracted === undefined ? 0 : 1}`);
    sinceLastCuration += 1;

    if (sinceLastCuration >= options.curationCadence) {
      sinceLastCuration = 0;
      await runCurationStep(cycleIndex, requestContext);
    }
  }

  // Flush: a cycle count that is not a multiple of the cadence would otherwise leave the
  // tail of the run uncurated, and the arms' knowledge would be compared at different
  // stages of curation.
  if (sinceLastCuration > 0 && cycles.length) {
    await runCurationStep(cycles.length - 1, requestContextWithOrg(organizationId));
  }

  return { cyclesReplayed: cycles.length, curations, warnings };
}
