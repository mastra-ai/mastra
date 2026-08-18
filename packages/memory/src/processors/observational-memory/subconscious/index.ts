import { Extractor } from '../extractor';
import { SubconsciousCaptureExtractor } from './capture';
import { DEFAULT_MAX_PINS, DEFAULT_PINNED_MAX_CHARACTERS, MAX_PINNED_MAX_CHARACTERS } from './pinned';
import { SubconsciousRemindExtractor } from './remind';
import type {
  ResolvedSubconsciousAgent,
  ResolvedSubconsciousConfig,
  SubconsciousCaptureConfig,
  SubconsciousConfig,
  SubconsciousCustomObservationConfig,
  SubconsciousObservationEntry,
  SubconsciousReflectionEntry,
} from './types';

const BUILT_IN_OBSERVATION = new Set(['capture', 'remind']);
const BUILT_IN_REFLECTION = new Set(['curate', 'learn']);
const DEFAULT_MAX_STEPS = 5;
const DEFAULT_RECENT_UPDATES = 10;
const MAX_RECENT_UPDATES = 100;

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
  if (!Number.isInteger(steps) || steps < 1 || steps > 25) {
    throw new Error('Subconscious maxSteps must be an integer between 1 and 25.');
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
  globalMaxSteps: number,
): ResolvedSubconsciousAgent {
  const config = typeof entry === 'string' ? undefined : entry;
  const name = entryName(entry);
  return {
    name,
    instructions: config?.instructions,
    model: config?.model ?? globalModel,
    agent: config?.agent,
    maxSteps: boundedSteps(config, globalMaxSteps),
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

    const maxSteps = boundedSteps(config, DEFAULT_MAX_STEPS);
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

    this.config = Object.freeze({ ...config, observation: [...observation], reflection: [...reflection] });
    this.resolved = Object.freeze({
      observation: observation.map(entry =>
        entryName(entry) === 'remind'
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
    });
  }

  createObservationExtractors(): Extractor<any>[] {
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
          }),
        );
      } else if (name === 'remind') {
        const resolved = this.resolved.observation.find(agent => agent.name === name);
        if (resolved) extractors.push(new SubconsciousRemindExtractor(resolved));
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

  #validateObservationEntry(entry: SubconsciousObservationEntry): void {
    const name = entryName(entry);
    if (typeof entry === 'string') {
      if (!BUILT_IN_OBSERVATION.has(name)) throw new Error(`Unknown Subconscious observation agent: ${name}`);
      return;
    }
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
export { createKnowledgeWriteTools } from './knowledge-write-tools';
export type { KnowledgeWriteToolsOptions } from './knowledge-write-tools';
export { KnowledgeSemanticIndexCoordinator, StaleKnowledgeSemanticIndexError } from './semantic-index';
export type { KnowledgeSemanticIndexCoordinatorConfig } from './semantic-index';
export type { CaptureExtractorOptions } from './capture';
export type {
  ResolvedSubconsciousAgent,
  ResolvedSubconsciousConfig,
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
