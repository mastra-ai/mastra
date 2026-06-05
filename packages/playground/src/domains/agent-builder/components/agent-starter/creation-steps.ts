/**
 * Static manifest of the `agent-builder-creation` workflow steps, in execution
 * order. This is the source of truth for the running-state timeline: steps that
 * haven't started yet never appear in `streamResult.steps`, so we list them all
 * up front and overlay live status on top.
 */
export type CreationStep = {
  id: string;
  label: string;
};

export const CREATION_STEPS: CreationStep[] = [
  { id: 'understand-user-outcome', label: 'Understand the desired outcome' },
  { id: 'feature-capability', label: 'Resolve enabled capabilities' },
  { id: 'set-agent-description', label: 'Set the agent description' },
  { id: 'set-agent-name', label: 'Set the agent name' },
  { id: 'set-agent-instructions', label: 'Set the agent instructions' },
  { id: 'set-agent-workspace-id', label: 'Set the agent workspace' },
  { id: 'set-agent-tools', label: 'Set the agent tools' },
  { id: 'set-agent-skills', label: 'Set the agent skills' },
  { id: 'set-agent-model', label: 'Set the agent model' },
  { id: 'set-agent-browser-enabled', label: 'Set browser access' },
  { id: 'persist-agent', label: 'Persist the agent' },
];

/**
 * The shape of a creation step's `output`. Every config-setting step emits the
 * cumulative `configSchema` (see the editor's agent-builder-creation-workflow),
 * and the terminal `persist-agent` step emits `createResultSchema` ({ id,
 * config }). This is network-driven data, so every field is optional and is
 * narrowed defensively in `getStepDetail` before use.
 */
type CreationStepOutput = {
  userOutcome?: { goal?: unknown };
  featureCapabilities?: Record<string, unknown>;
  name?: unknown;
  description?: unknown;
  instructions?: unknown;
  workspaceId?: unknown;
  tools?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  workflows?: Record<string, unknown>;
  skills?: Record<string, unknown>;
  model?: { provider?: unknown; name?: unknown };
  browserEnabled?: unknown;
  id?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

/** Comma-separated keys whose value is `true` in a `Record<string, boolean>`. */
const enabledKeys = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).filter(key => value[key] === true);
  return keys.length > 0 ? keys.join(', ') : undefined;
};

/**
 * Derive the dimmer secondary line shown under a step's label, summarizing the
 * value that step resolved. Reads from the step's accumulated config output and
 * returns `undefined` when there is nothing meaningful to show yet (the row then
 * renders the label only).
 */
export const getStepDetail = (stepId: string, output: unknown): string | undefined => {
  if (!isRecord(output)) return undefined;
  const config = output as CreationStepOutput;

  switch (stepId) {
    case 'understand-user-outcome':
      return isRecord(config.userOutcome) ? asString(config.userOutcome.goal) : undefined;
    case 'feature-capability':
      return enabledKeys(config.featureCapabilities);
    case 'set-agent-name':
      return asString(config.name);
    case 'set-agent-description':
      return asString(config.description);
    case 'set-agent-instructions':
      return asString(config.instructions);
    case 'set-agent-workspace-id':
      return asString(config.workspaceId);
    case 'set-agent-tools': {
      const tools = enabledKeys(config.tools);
      const agents = enabledKeys(config.agents);
      const workflows = enabledKeys(config.workflows);
      const all = [tools, agents, workflows].filter((value): value is string => Boolean(value));
      return all.length > 0 ? all.join(', ') : undefined;
    }
    case 'set-agent-skills':
      return enabledKeys(config.skills);
    case 'set-agent-model': {
      if (!isRecord(config.model)) return undefined;
      const provider = asString(config.model.provider);
      const name = asString(config.model.name);
      if (provider && name) return `${provider}/${name}`;
      return name ?? provider;
    }
    case 'set-agent-browser-enabled':
      if (typeof config.browserEnabled !== 'boolean') return undefined;
      return config.browserEnabled ? 'Browser access enabled' : 'Browser access disabled';
    case 'persist-agent':
      return asString(config.id);
    default:
      return undefined;
  }
};
