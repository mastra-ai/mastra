/**
 * Tool-name constants for the atomic per-field agent-builder client tools.
 *
 * Each constant is the wire name the server emits in `dynamic-tool` /
 * `tool-<name>` parts, and is used by the chat message renderer to dispatch
 * the right ToolCard component.
 *
 * The single source of truth for each constant lives in the per-field hook
 * file. This module re-exports them as a stable import path so the chat
 * renderer and other consumers don't have to know which hook owns which name.
 */
export { SET_AGENT_NAME_TOOL_NAME } from '../hooks/use-set-agent-name-tool';
export { SET_AGENT_DESCRIPTION_TOOL_NAME } from '../hooks/use-set-agent-description-tool';
export { SET_AGENT_INSTRUCTIONS_TOOL_NAME } from '../hooks/use-set-agent-instructions-tool';
export { SET_AGENT_MODEL_TOOL_NAME } from '../hooks/use-set-agent-model-tool';
export { SET_AGENT_TOOLS_TOOL_NAME } from '../hooks/use-set-agent-tools-tool';
export { SET_AGENT_SKILLS_TOOL_NAME } from '../hooks/use-set-agent-skills-tool';
export { SET_AGENT_WORKSPACE_ID_TOOL_NAME } from '../hooks/use-set-agent-workspace-id-tool';
export { SET_AGENT_BROWSER_ENABLED_TOOL_NAME } from '../hooks/use-set-agent-browser-enabled-tool';
