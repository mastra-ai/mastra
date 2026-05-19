/**
 * Tool-name constants for the atomic per-field agent-builder client tools.
 *
 * Each constant is the wire name the server emits in `dynamic-tool` /
 * `tool-<name>` parts, and is used by the chat message renderer to dispatch
 * the right ToolCard component.
 */
export const SET_AGENT_NAME_TOOL_NAME = 'set-agent-name';
export const SET_AGENT_DESCRIPTION_TOOL_NAME = 'set-agent-description';
export const SET_AGENT_INSTRUCTIONS_TOOL_NAME = 'set-agent-instructions';
export const SET_AGENT_MODEL_TOOL_NAME = 'set-agent-model';
export const SET_AGENT_TOOLS_TOOL_NAME = 'set-agent-tools';
export const SET_AGENT_SKILLS_TOOL_NAME = 'set-agent-skills';
export const SET_AGENT_WORKSPACE_ID_TOOL_NAME = 'set-agent-workspace-id';
export const SET_AGENT_BROWSER_ENABLED_TOOL_NAME = 'set-agent-browser-enabled';
