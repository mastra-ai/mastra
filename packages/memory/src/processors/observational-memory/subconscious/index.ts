import { Extractor } from '../extractor';
import { SubconsciousCaptureExtractor } from './capture';
import type {
  ResolvedSubconsciousAgent,
  ResolvedSubconsciousConfig,
  SubconsciousBuiltInObservationConfig,
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

function resolveAgent(
  entry: string | { name: string; instructions?: string; model?: any; maxSteps?: number },
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
    maxSteps: boundedSteps(config, globalMaxSteps),
    builtIn: builtIns.has(name),
  };
}

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

    this.config = Object.freeze({ ...config, observation: [...observation], reflection: [...reflection] });
    this.resolved = Object.freeze({
      observation: observation.map(entry => resolveAgent(entry, BUILT_IN_OBSERVATION, config.model, maxSteps)),
      reflection: reflection.map(entry => resolveAgent(entry, BUILT_IN_REFLECTION, config.model, maxSteps)),
      defaultScope: config.defaultScope ?? 'resource',
      maxScope: config.maxScope,
      learnedGuidance: config.learnedGuidance !== false,
      tools: config.tools !== false,
      activity: recentUpdates === false ? false : { recentUpdates },
    });
  }

  createObservationExtractors(): Extractor<any>[] {
    const extractors: Extractor<any>[] = [];
    for (const entry of this.config.observation ?? []) {
      const name = entryName(entry);
      if (name === 'capture') {
        extractors.push(
          new SubconsciousCaptureExtractor({
            config: typeof entry === 'string' ? undefined : (entry as SubconsciousBuiltInObservationConfig),
            defaultScope: this.resolved.defaultScope,
            maxScope: this.resolved.maxScope,
            learnedGuidance: this.resolved.learnedGuidance,
          }),
        );
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
    if (BUILT_IN_OBSERVATION.has(name)) return;
    if (!entry.schema || typeof entry.onExtracted !== 'function') {
      throw new Error(`Custom Subconscious observation agent "${name}" requires schema and onExtracted.`);
    }
  }

  #validateReflectionEntry(entry: SubconsciousReflectionEntry): void {
    const name = entryName(entry);
    if (typeof entry === 'string') {
      if (!BUILT_IN_REFLECTION.has(name)) throw new Error(`Unknown Subconscious reflection agent: ${name}`);
      return;
    }
    if (!BUILT_IN_REFLECTION.has(name) && !entry.instructions?.trim() && !('agent' in entry && entry.agent)) {
      throw new Error(`Custom Subconscious reflection agent "${name}" requires instructions or agent.`);
    }
  }
}

export { SubconsciousCaptureExtractor, subconsciousCaptureSchema } from './capture';
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
