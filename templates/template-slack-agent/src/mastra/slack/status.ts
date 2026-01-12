import { SPINNER, TOOL_ICONS, WORKFLOW_ICONS } from './constants.js';
import type { StreamState } from './types.js';

/** Format chunk type for display: "tool-call" → "Tool Call" */
function formatChunkType(type: string): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Get animated status text for Slack message */
export function getStatusText(state: StreamState, frame: number): string {
  const spinner = SPINNER[frame % SPINNER.length];
  const toolIcon = TOOL_ICONS[frame % TOOL_ICONS.length];
  const workflowIcon = WORKFLOW_ICONS[frame % WORKFLOW_ICONS.length];

  const type = state.chunkType;
  const label = formatChunkType(type);

  // Add context for specific chunk types
  if (type.startsWith('tool-') && state.toolName) {
    return `${toolIcon} ${label}: ${state.toolName}...`;
  }
  if (type.startsWith('workflow-') && state.stepName) {
    return `${workflowIcon} ${label}: ${state.stepName}...`;
  }
  if (type.includes('agent') && state.agentName) {
    return `${spinner} ${label}: ${state.agentName}...`;
  }

  return `${spinner} ${label}...`;
}
