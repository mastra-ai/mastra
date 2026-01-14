import type { BuilderNodeType } from '../types';

/**
 * Centralized node color definitions for the workflow builder.
 * Each node type has an associated accent color used for icons, badges, and highlights.
 */
export const NODE_COLORS = {
  trigger: '#22c55e', // green-500
  agent: '#3b82f6', // blue-500
  tool: '#a855f7', // purple-500
  condition: '#eab308', // yellow-500
  parallel: '#06b6d4', // cyan-500
  loop: '#f97316', // orange-500
  foreach: '#ec4899', // pink-500
  transform: '#14b8a6', // teal-500
  suspend: '#ef4444', // red-500
  workflow: '#6366f1', // indigo-500
  sleep: '#6b7280', // gray-500
  'agent-network': '#8b5cf6', // violet-500
} as const satisfies Record<BuilderNodeType, string>;

/**
 * Get the color for a specific node type.
 * Returns a fallback gray if the type is not found.
 */
export function getNodeColor(nodeType: BuilderNodeType): string {
  return NODE_COLORS[nodeType] ?? '#6b7280';
}

/**
 * Get a semi-transparent background version of a node color (20% opacity).
 * Useful for icon backgrounds.
 */
export function getNodeBackgroundColor(nodeType: BuilderNodeType): string {
  return `${getNodeColor(nodeType)}20`;
}

// Re-export individual colors for backward compatibility
export const TRIGGER_COLOR = NODE_COLORS.trigger;
export const AGENT_COLOR = NODE_COLORS.agent;
export const TOOL_COLOR = NODE_COLORS.tool;
export const CONDITION_COLOR = NODE_COLORS.condition;
export const PARALLEL_COLOR = NODE_COLORS.parallel;
export const LOOP_COLOR = NODE_COLORS.loop;
export const FOREACH_COLOR = NODE_COLORS.foreach;
export const TRANSFORM_COLOR = NODE_COLORS.transform;
export const SUSPEND_COLOR = NODE_COLORS.suspend;
export const WORKFLOW_COLOR = NODE_COLORS.workflow;
export const SLEEP_COLOR = NODE_COLORS.sleep;
export const NETWORK_COLOR = NODE_COLORS['agent-network'];
