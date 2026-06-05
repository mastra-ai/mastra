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
