import type { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent, isDurableAgent, isEventedAgent } from '@mastra/core/agent/durable';
import type { Mastra } from '@mastra/core/mastra';

import {
  getExperimentalAgentSettingsError,
  type ExperimentalAgent,
  type GlobalSettings,
} from './onboarding/settings.js';

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
  settings: Pick<GlobalSettings, 'experimentalAgent'>,
  env: ExperimentalAgentEnvironment = process.env,
): ExperimentalAgent | null {
  const environmentSelection = parseExperimentalAgentEnvironment(env);
  if (environmentSelection) return environmentSelection;

  const settingsError = getExperimentalAgentSettingsError(settings);
  if (settingsError) throw settingsError;

  return settings.experimentalAgent;
}

export function wrapExperimentalAgent(agent: Agent, selection: ExperimentalAgent | null): Agent {
  if (selection === 'durable') return createDurableAgent({ agent }) as unknown as Agent;
  if (selection === 'evented') return createEventedAgent({ agent }) as unknown as Agent;
  return agent;
}

interface WorkflowBackedAgent extends Agent {
  getWorkflow(): { engineType?: string };
}

export function validateExperimentalAgent(
  agent: Agent,
  mastra: Mastra | undefined,
  report: (message: string) => void = console.info,
): void {
  const selection: ExperimentalAgent | null = isEventedAgent(agent)
    ? 'evented'
    : isDurableAgent(agent)
      ? 'durable'
      : null;
  if (!selection) return;

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

  const engineType = (agent as WorkflowBackedAgent).getWorkflow().engineType;
  const expectedEngine = selection === 'evented' ? 'evented' : 'default';
  if (engineType !== expectedEngine) {
    throw new Error(
      `Experimental agent "${selection}" resolved workflow engine ${JSON.stringify(engineType)} instead of "${expectedEngine}".`,
    );
  }

  report(`Experimental agent: ${selection} (workflow engine: ${engineType})`);
}
