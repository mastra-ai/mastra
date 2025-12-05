import { SPINNER, TOOL_ICONS, WORKFLOW_ICONS } from './constants.js';
import type { StreamState } from './types.js';

/** Get animated status text for Slack message */
export function getStatusText(state: StreamState, frame: number): string {
  const spinner = SPINNER[frame % SPINNER.length];
  const toolIcon = TOOL_ICONS[frame % TOOL_ICONS.length];
  const workflowIcon = WORKFLOW_ICONS[frame % WORKFLOW_ICONS.length];

  switch (state.status) {
    case 'thinking':
      return `${spinner} Thinking...`;
    case 'routing':
      return `${spinner} Routing...`;
    case 'tool_call':
      return `${toolIcon} Using ${state.toolName}...`;
    case 'workflow_step':
      return `${workflowIcon} ${state.workflowName}: ${state.stepName}...`;
    case 'agent_call':
      return `${spinner} Calling ${state.agentName}...`;
    case 'responding':
      return `${spinner} Responding...`;
  }
}
