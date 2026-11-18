export const APPROVE_ON_ITS_OWN = 'Approve on its own';
export const GOAL_PLACEHOLDER = 'Describe what done looks like';

export function phaseLabels(name: string) {
  return {
    runs: `How ${name} runs`,
    autoStart: `${name}: start on its own`,
    goal: `${name} goal`,
    session: `${name} session`,
    tool: (toolLabel: string) => `${name}: ${toolLabel}`,
    exitTool: `${name} exit tool`,
    approve: (toolId: string) => `${name}: approve ${toolId} on its own`,
  };
}
