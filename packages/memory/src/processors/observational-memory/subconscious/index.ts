import { Extractor } from '../extractor';
import type { ObservationalMemoryModel } from '../types';
import { SubconsciousCaptureExtractor } from './capture';
import { DEFAULT_MAX_PINS, DEFAULT_PINNED_MAX_CHARACTERS, MAX_PINNED_MAX_CHARACTERS } from './pinned';
import { SubconsciousRemindExtractor } from './remind';
import type {
  ResolvedSubconsciousAgent,
  ResolvedSubconsciousConfig,
  ResolvedSubconsciousCuration,
  SubconsciousCaptureConfig,
  SubconsciousConfig,
  SubconsciousCurateConfig,
  SubconsciousCurationTrigger,
  SubconsciousCustomObservationConfig,
  SubconsciousObservationEntry,
  SubconsciousReflectionEntry,
} from './types';

const BUILT_IN_OBSERVATION = new Set(['capture', 'remind', 'curate']);
const BUILT_IN_REFLECTION = new Set(['curate', 'learn']);

/**
 * Default trigger for a curate entry in the observation array with no explicit `trigger`:
 * evaluate after each completed observation and run whenever any uncurated record exists.
 * This preserves the curator handler's own gating (`curate.ts` no-ops on an empty worklist),
 * so an omitted trigger is the default policy — never "run unconditionally" and never
 * "skip the trigger query".
 */
const DEFAULT_OBSERVATION_TRIGGER = Object.freeze({ uncuratedRecords: 1 as const, maxAgeMs: false as const });
const DEFAULT_MAX_STEPS = 50;
/**
 * Curation walks a worklist that can reach hundreds of records, and its completion marker is
 * fail-closed: a curator that runs out of steps advances no cursor at all. It gets a much larger
 * default budget than the other agents, which each handle a single bounded prompt.
 */
const DEFAULT_MAX_STEPS_BY_AGENT: Record<string, number> = { curate: 200 };
const MAX_MAX_STEPS = 500;
const DEFAULT_RECENT_UPDATES = 10;
const MAX_RECENT_UPDATES = 100;

let warnedCurationCadence = false;

/**
 * Warn once per process that `curationCadence` is the old spelling of the volume trigger.
 *
 * Once, not per construction: an app that builds a `Subconscious` per request would otherwise
 * emit this on every turn.
 */
function warnCurationCadenceDeprecated(thresholdAlsoSet: boolean): void {
  if (warnedCurationCadence) return;
  warnedCurationCadence = true;
  console.warn(
    '[mastra:memory] `curationCadence` is deprecated; use `curationThreshold`. Note the meaning changed: ' +
      '`curationCadence` counted committed observation runs, while `curationThreshold` counts uncurated ' +
      'knowledge records since the last curation. Curation now also runs from activation and end-of-turn, ' +
      'not only the synchronous observe path.' +
      (thresholdAlsoSet ? ' `curationThreshold` is set, so `curationCadence` is ignored.' : ''),
  );
}

/** @internal Test hook: re-arms the once-per-process deprecation warning. */
export function __resetCurationCadenceWarning(): void {
  warnedCurationCadence = false;
}

function entryName(entry: string | { name: string }): string {
  return typeof entry === 'string' ? entry : entry.name.trim();
}

function assertUniqueNames(entries: Array<string | { name: string }>, phase: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const name = entryName(entry);
    if (!name) throw new Error(`Subconscious ${phase} agent name is required.`);
    if (seen.has(name)) throw new Error(`Duplicate Subconscious ${phase} agent: ${name}`);
    seen.add(name);
  }
}

function boundedSteps(entry: { maxSteps?: number } | undefined, fallback: number): number {
  const steps = entry?.maxSteps ?? fallback;
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_MAX_STEPS) {
    throw new Error(`Subconscious maxSteps must be an integer between 1 and ${MAX_MAX_STEPS}.`);
  }
  return steps;
}

function resolveExtractor(entry: SubconsciousObservationEntry): ResolvedSubconsciousAgent {
  const config = typeof entry === 'string' ? undefined : entry;
  const name = entryName(entry);
  return {
    name,
    instructions: config?.instructions,
    builtIn: name === 'capture',
  };
}

function resolveAgent(
  entry: string | { name: string; instructions?: string; model?: any; agent?: any; maxSteps?: number },
  builtIns: Set<string>,
  globalModel: SubconsciousConfig['model'],
  globalMaxSteps: number | undefined,
): ResolvedSubconsciousAgent {
  const config = typeof entry === 'string' ? undefined : entry;
  const name = entryName(entry);
  const fallbackMaxSteps = globalMaxSteps ?? DEFAULT_MAX_STEPS_BY_AGENT[name] ?? DEFAULT_MAX_STEPS;
  return {
    name,
    instructions: config?.instructions,
    model: config?.model ?? globalModel,
    agent: config?.agent,
    maxSteps: boundedSteps(config, fallbackMaxSteps),
    builtIn: builtIns.has(name),
  };
}

/**
 * Configures experimental autonomous knowledge extraction and reflection.
 *
 * @experimental This API may change without notice.
 */
export class Subconscious {
  readonly config: Readonly<SubconsciousConfig>;
  readonly resolved: Readonly<ResolvedSubconsciousConfig>;

  constructor(config: SubconsciousConfig = {}) {
    const observation = config.observation ?? ['capture', 'remind'];
    const reflection = config.reflection ?? ['curate', 'learn'];
    assertUniqueNames(observation, 'observation');
    assertUniqueNames(reflection, 'reflection');

    const maxSteps = config.maxSteps === undefined ? undefined : boundedSteps(config, DEFAULT_MAX_STEPS);
    for (const entry of observation) this.#validateObservationEntry(entry);
    for (const entry of reflection) this.#validateReflectionEntry(entry);

    const recentUpdates =
      config.activity === false ? false : (config.activity?.recentUpdates ?? DEFAULT_RECENT_UPDATES);
    if (
      recentUpdates !== false &&
      (!Number.isInteger(recentUpdates) || recentUpdates < 1 || recentUpdates > MAX_RECENT_UPDATES)
    ) {
      throw new Error(`Subconscious activity.recentUpdates must be an integer between 1 and ${MAX_RECENT_UPDATES}.`);
    }

    const pins =
      config.pins === undefined || config.pins === false
        ? false
        : {
            maxPins: (config.pins === true ? undefined : config.pins.maxPins) ?? DEFAULT_MAX_PINS,
            maxCharacters:
              (config.pins === true ? undefined : config.pins.maxCharacters) ?? DEFAULT_PINNED_MAX_CHARACTERS,
            capturePinning: (config.pins === true ? undefined : config.pins.capturePinning) ?? false,
          };
    if (pins !== false) {
      if (!Number.isInteger(pins.maxPins) || pins.maxPins < 1) {
        throw new Error('Subconscious pins.maxPins must be a positive integer.');
      }
      if (
        !Number.isInteger(pins.maxCharacters) ||
        pins.maxCharacters < 1 ||
        pins.maxCharacters > MAX_PINNED_MAX_CHARACTERS
      ) {
        throw new Error(
          `Subconscious pins.maxCharacters must be an integer between 1 and ${MAX_PINNED_MAX_CHARACTERS}.`,
        );
      }
    }

    if (
      config.curationCadence !== undefined &&
      (!Number.isInteger(config.curationCadence) || config.curationCadence < 1)
    ) {
      throw new Error('Subconscious curationCadence must be a positive integer.');
    }

    if (config.curationCadence !== undefined) {
      warnCurationCadenceDeprecated(config.curationThreshold !== undefined);
    }

    if (
      typeof config.curationThreshold === 'number' &&
      (!Number.isInteger(config.curationThreshold) || config.curationThreshold < 1)
    ) {
      throw new Error('Subconscious curationThreshold must be a positive integer or false.');
    }

    if (
      typeof config.curationMaxAgeMs === 'number' &&
      (!Number.isInteger(config.curationMaxAgeMs) || config.curationMaxAgeMs < 1)
    ) {
      throw new Error('Subconscious curationMaxAgeMs must be a positive integer of milliseconds or false.');
    }

    const observationHasCurate = observation.some(entry => entryName(entry) === 'curate');
    const reflectionHasCurate = reflection.some(entry => entryName(entry) === 'curate');
    if (observationHasCurate && reflectionHasCurate) {
      throw new Error('Subconscious curate can be placed in observation or reflection, not both.');
    }

    this.config = Object.freeze({ ...config, observation: [...observation], reflection: [...reflection] });
    this.resolved = Object.freeze({
      observation: observation.map(entry =>
        entryName(entry) === 'remind' || entryName(entry) === 'curate'
          ? resolveAgent(entry, BUILT_IN_OBSERVATION, config.model, maxSteps)
          : resolveExtractor(entry),
      ),
      reflection: reflection.map(entry => resolveAgent(entry, BUILT_IN_REFLECTION, config.model, maxSteps)),
      defaultScope: config.defaultScope ?? 'resource',
      maxScope: config.maxScope,
      learnedGuidance: config.learnedGuidance !== false,
      tools: config.tools !== false,
      activity: recentUpdates === false ? false : { recentUpdates },
      pins,
      curation: this.#resolveCuration(config, observation, reflection),
      curationCadence: config.curationCadence,
      curationThreshold:
        config.curationThreshold !== undefined ? config.curationThreshold : (config.curationCadence ?? false),
      curationMaxAgeMs: config.curationMaxAgeMs ?? false,
    });
  }

  /**
   * Resolve curation placement + trigger. Placement sets cadence: a curate entry in the
   * observation array is evaluated after each successfully completed observation; in the
   * reflection array, at reflection commit; absent, `null` — zero curation work.
   *
   * Precedence: an explicit `trigger` on the curate entry always wins and the deprecated
   * top-level `curationThreshold`/`curationCadence`/`curationMaxAgeMs` are ignored. Without an
   * explicit trigger, the legacy fields (threshold — including explicit `false` = disabled —
   * beating cadence, as before) translate onto the curate entry's placement. With neither,
   * the placement default applies: reflection keeps today's commit-time behavior
   * (`trigger: null`); observation normalizes to {@link DEFAULT_OBSERVATION_TRIGGER}.
   */
  #resolveCuration(
    config: SubconsciousConfig,
    observation: SubconsciousObservationEntry[],
    reflection: SubconsciousReflectionEntry[],
  ): ResolvedSubconsciousCuration | null {
    const observationEntry = observation.find(entry => entryName(entry) === 'curate');
    const reflectionEntry = reflection.find(entry => entryName(entry) === 'curate');
    const entry = observationEntry ?? reflectionEntry;
    if (!entry) return null;
    const placement: 'observation' | 'reflection' = observationEntry ? 'observation' : 'reflection';

    const explicit = typeof entry === 'string' ? undefined : (entry as SubconsciousCurateConfig).trigger;
    if (explicit) {
      return {
        placement,
        trigger: { uncuratedRecords: explicit.uncuratedRecords ?? false, maxAgeMs: explicit.maxAgeMs ?? false },
      };
    }

    // Legacy translation: threshold (including explicit `false` = disabled) wins over cadence.
    const legacyThreshold =
      config.curationThreshold !== undefined ? config.curationThreshold : (config.curationCadence ?? undefined);
    const legacyMaxAgeMs = config.curationMaxAgeMs === undefined ? false : config.curationMaxAgeMs;
    if (legacyThreshold !== undefined || legacyMaxAgeMs !== false) {
      if (legacyThreshold === false && legacyMaxAgeMs === false) {
        // Explicitly disabled: no trigger evaluator; reflection commit behavior is unchanged.
        return { placement, trigger: null };
      }
      return { placement, trigger: { uncuratedRecords: legacyThreshold ?? false, maxAgeMs: legacyMaxAgeMs } };
    }

    return placement === 'observation'
      ? { placement, trigger: { ...DEFAULT_OBSERVATION_TRIGGER } }
      : { placement, trigger: null };
  }

  createObservationExtractors(omModel?: ObservationalMemoryModel): Extractor<any>[] {
    const extractors: Extractor<any>[] = [];
    for (const entry of this.config.observation ?? []) {
      const name = entryName(entry);
      if (name === 'capture') {
        extractors.push(
          new SubconsciousCaptureExtractor({
            config: typeof entry === 'string' ? undefined : (entry as SubconsciousCaptureConfig),
            defaultScope: this.resolved.defaultScope,
            maxScope: this.resolved.maxScope,
            learnedGuidance: this.resolved.learnedGuidance,
            activityRecentUpdates: this.resolved.activity === false ? undefined : this.resolved.activity.recentUpdates,
            pins: this.resolved.pins,
          }),
        );
      } else if (name === 'remind') {
        const resolved = this.resolved.observation.find(agent => agent.name === name);
        if (resolved) extractors.push(new SubconsciousRemindExtractor(resolved, omModel));
      } else if (!BUILT_IN_OBSERVATION.has(name)) {
        const custom = entry as SubconsciousCustomObservationConfig;
        extractors.push(
          new Extractor({
            name: custom.name,
            instructions: custom.instructions?.trim() || `Extract ${custom.name} from the current observations.`,
            schema: custom.schema,
            metadataKeyPath: false,
            includePreviousExtraction: false,
            onExtracted: custom.onExtracted,
          }),
        );
      }
    }
    return extractors;
  }

  #validateTrigger(entry: { name?: string; trigger?: SubconsciousCurationTrigger } | string): void {
    if (typeof entry === 'string' || !('trigger' in entry) || entry.trigger === undefined) return;
    if (entryName(entry as { name: string }) !== 'curate') {
      throw new Error('Subconscious trigger config is only valid on the curate agent entry.');
    }
    const { uncuratedRecords, maxAgeMs } = entry.trigger;
    if (uncuratedRecords !== undefined && uncuratedRecords !== false) {
      if (!Number.isInteger(uncuratedRecords) || uncuratedRecords < 1) {
        throw new Error('Subconscious curate trigger.uncuratedRecords must be a positive integer or false.');
      }
    }
    if (maxAgeMs !== undefined && maxAgeMs !== false) {
      if (!Number.isInteger(maxAgeMs) || maxAgeMs < 1) {
        throw new Error('Subconscious curate trigger.maxAgeMs must be a positive integer of milliseconds or false.');
      }
    }
  }

  #validateObservationEntry(entry: SubconsciousObservationEntry): void {
    const name = entryName(entry);
    this.#validateTrigger(entry);
    if (typeof entry === 'string') {
      if (!BUILT_IN_OBSERVATION.has(name)) throw new Error(`Unknown Subconscious observation agent: ${name}`);
      return;
    }
    if (name === 'curate') return;
    if (BUILT_IN_OBSERVATION.has(name)) {
      if (name === 'capture') {
        if ('model' in entry || 'maxSteps' in entry) {
          throw new Error('Subconscious capture shares the Observer model and does not accept model or maxSteps.');
        }
        if (
          'schema' in entry &&
          entry.schema &&
          (!('onExtracted' in entry) || typeof entry.onExtracted !== 'function')
        ) {
          throw new Error('A custom capture schema requires an onExtracted hook that handles its output.');
        }
      }
      return;
    }
    if ('model' in entry || 'maxSteps' in entry) {
      throw new Error(
        `Subconscious observation extractor "${name}" shares the Observer model and does not accept model or maxSteps.`,
      );
    }
    if (!('schema' in entry) || !entry.schema || !('onExtracted' in entry) || typeof entry.onExtracted !== 'function') {
      throw new Error(`Custom Subconscious observation agent "${name}" requires schema and onExtracted.`);
    }
  }

  #validateReflectionEntry(entry: SubconsciousReflectionEntry): void {
    const name = entryName(entry);
    this.#validateTrigger(entry);
    if (typeof entry === 'string') {
      if (!BUILT_IN_REFLECTION.has(name)) throw new Error(`Unknown Subconscious reflection agent: ${name}`);
      return;
    }
    if (BUILT_IN_REFLECTION.has(name) && 'agent' in entry && entry.agent) {
      throw new Error(`Built-in Subconscious reflection agent "${name}" cannot be replaced with a custom agent.`);
    }
    if (!BUILT_IN_REFLECTION.has(name) && !entry.instructions?.trim() && !('agent' in entry && entry.agent)) {
      throw new Error(`Custom Subconscious reflection agent "${name}" requires instructions or agent.`);
    }
  }
}

export {
  buildSubconsciousActivitySnapshot,
  publishSubconsciousActivity,
  publishSubconsciousError,
  renderSubconsciousActivity,
  SUBCONSCIOUS_ACTIVITY_STATE_ID,
} from './activity';
export type { SubconsciousActivitySnapshot, SubconsciousActivityUpdate } from './activity';
export { SubconsciousCaptureExtractor, subconsciousCaptureSchema } from './capture';
export { SubconsciousRemindExtractor } from './remind';
export {
  createPinnedTools,
  listPinnedKnowledge,
  DEFAULT_MAX_PINS,
  DEFAULT_PINNED_MAX_CHARACTERS,
  MAX_PINNED_MAX_CHARACTERS,
  PINNED_NODE_NAME,
  PINNED_NODE_KIND,
  PINNED_NODE_SCOPE_LEVEL,
  PINNED_SNAPSHOT_TAG,
  PINNED_DELTA_TAG,
  SUBCONSCIOUS_PINS_STATE_ID,
} from './pinned';
export type { PinnedKnowledgeSet, PinnedToolsOptions } from './pinned';
export {
  PinnedStateProcessor,
  applyPinOps,
  diffPins,
  effectivePriorPins,
  stablePinsCacheKey,
} from './pinned-state-processor';
export type { PinDeltaOp, PinEntry, PinnedStateProcessorDeps } from './pinned-state-processor';
export { createCurationEvaluator } from './curation-runtime';
export type { CurationEvaluator, CurationEvaluatorDeps, CurationEvaluateOptions } from './curation-runtime';
export { createKnowledgeWriteTools } from './knowledge-write-tools';
export type { KnowledgeWriteToolsOptions } from './knowledge-write-tools';
export { KnowledgeSemanticIndexCoordinator, StaleKnowledgeSemanticIndexError } from './semantic-index';
export type { KnowledgeSemanticIndexCoordinatorConfig } from './semantic-index';
export type { CaptureExtractorOptions } from './capture';
export type {
  ResolvedSubconsciousAgent,
  ResolvedSubconsciousConfig,
  ResolvedSubconsciousCuration,
  SubconsciousCurateConfig,
  SubconsciousCurationTrigger,
  SubconsciousBuiltInObservationAgent,
  SubconsciousBuiltInObservationConfig,
  SubconsciousBuiltInReflectionAgent,
  SubconsciousBuiltInReflectionConfig,
  SubconsciousCaptureHook,
  SubconsciousCaptureOutput,
  SubconsciousConfig,
  SubconsciousCustomObservationConfig,
  SubconsciousCustomReflectionConfig,
  SubconsciousObservationEntry,
  SubconsciousReflectionEntry,
} from './types';
