import type { Agent } from '@mastra/core/agent';
import { isDurableAgent } from '@mastra/core/agent/durable';
import type { Mastra } from '@mastra/core/mastra';

import { parseExperimentalAgentSetting } from './onboarding/settings.js';
import type { ExperimentalAgent, GlobalSettings } from './onboarding/settings.js';

export interface ExperimentalAgentEnvironment {
  MASTRACODE_EXPERIMENTAL_AGENT?: string;
}

const ACCEPTED_VALUES = '"durable", "evented", or unset';

export function parseExperimentalAgentEnvironment(
  env: ExperimentalAgentEnvironment = process.env,
): ExperimentalAgent | null {
  const value = env.MASTRACODE_EXPERIMENTAL_AGENT;
  if (value === undefined || value === '') return null;
  if (value === 'durable' || value === 'evented') return value;
  throw new Error(`Invalid MASTRACODE_EXPERIMENTAL_AGENT value ${JSON.stringify(value)}. Expected ${ACCEPTED_VALUES}.`);
}

export function resolveExperimentalAgent(
  settings: Pick<GlobalSettings, 'experimentalAgent' | '_experimentalAgentSettingsPath'>,
  env: ExperimentalAgentEnvironment = process.env,
): ExperimentalAgent | null {
  const environmentSelection = parseExperimentalAgentEnvironment(env);
  if (environmentSelection) return environmentSelection;

  return parseExperimentalAgentSetting(settings.experimentalAgent, settings._experimentalAgentSettingsPath);
}

/**
 * Reads `MASTRACODE_AGENT_STREAMS`. `off` stops the plain coding agent publishing
 * its runs on a resumable stream; `on` or unset keeps the core default. Any other
 * value, including an empty string, throws so a typo can't silently leave streams on.
 */
export function resolveAgentStreamsOff(env: { MASTRACODE_AGENT_STREAMS?: string } = process.env): boolean {
  const value = env.MASTRACODE_AGENT_STREAMS;
  if (value === undefined || value === 'on') return false;
  if (value === 'off') return true;
  throw new Error(`Invalid MASTRACODE_AGENT_STREAMS value ${JSON.stringify(value)}. Expected "on", "off", or unset.`);
}

export function validateExperimentalAgent(
  agent: Agent,
  mastra: Mastra | undefined,
  report: (message: string) => void = console.info,
): void {
  const durable = agent.durable;
  const evented = typeof durable === 'object' && durable.executionEngine === 'evented';
  if (!evented && !isDurableAgent(agent)) return;
  const selection: ExperimentalAgent = evented ? 'evented' : 'durable';

  if (selection === 'evented' && (!mastra || agent.getMastraInstance() !== mastra)) {
    throw new Error(
      'Experimental agent "evented" requires the coding agent to be registered on a Mastra host before startup.',
    );
  }

  const workflowsStore = mastra?.getStorage()?.stores?.workflows;
  if (!workflowsStore) {
    throw new Error(`Experimental agent "${selection}" requires a configured workflow storage domain.`);
  }
  if (selection === 'evented' && workflowsStore.supportsConcurrentUpdates?.() !== true) {
    throw new Error(
      'Experimental agent "evented" requires workflow storage with atomic concurrent updates (supportsConcurrentUpdates() must return true).',
    );
  }

  if (evented) {
    report('Experimental agent: native evented (workflow engine policy: evented)');
  } else if (isDurableAgent(agent)) {
    const engineType = agent.getWorkflow().engineType;
    if (engineType !== 'default') {
      throw new Error(
        `Experimental agent "durable" resolved workflow engine ${JSON.stringify(engineType)} instead of "default".`,
      );
    }
    report(`Experimental agent: durable (workflow engine: ${engineType})`);
  }
}
