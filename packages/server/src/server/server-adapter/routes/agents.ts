import {
  // Agent route objects
  LIST_AGENTS_ROUTE,
  GET_AGENT_BY_ID_ROUTE,
  CLONE_AGENT_ROUTE,
  GENERATE_AGENT_ROUTE,
  GENERATE_AGENT_VNEXT_ROUTE,
  STREAM_GENERATE_ROUTE,
  STREAM_GENERATE_VNEXT_DEPRECATED_ROUTE,
  GET_PROVIDERS_ROUTE,
  APPROVE_TOOL_CALL_ROUTE,
  DECLINE_TOOL_CALL_ROUTE,
  RESUME_STREAM_ROUTE,
  APPROVE_TOOL_CALL_GENERATE_ROUTE,
  DECLINE_TOOL_CALL_GENERATE_ROUTE,
  STREAM_NETWORK_ROUTE,
  UPDATE_AGENT_MODEL_ROUTE,
  RESET_AGENT_MODEL_ROUTE,
  REORDER_AGENT_MODEL_LIST_ROUTE,
  UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE,
  ENHANCE_INSTRUCTIONS_ROUTE,
  STREAM_VNEXT_DEPRECATED_ROUTE,
  STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE,
  STREAM_UI_MESSAGE_DEPRECATED_ROUTE,
  APPROVE_NETWORK_TOOL_CALL_ROUTE,
  DECLINE_NETWORK_TOOL_CALL_ROUTE,
  GET_AGENT_SKILL_ROUTE,
} from '../../handlers/agents';
import { GET_AGENT_TOOL_ROUTE, EXECUTE_AGENT_TOOL_ROUTE } from '../../handlers/tools';
import {
  GET_SPEAKERS_ROUTE,
  GET_SPEAKERS_DEPRECATED_ROUTE,
  GENERATE_SPEECH_ROUTE,
  GENERATE_SPEECH_DEPRECATED_ROUTE,
  TRANSCRIBE_SPEECH_ROUTE,
  TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  GET_LISTENER_ROUTE,
} from '../../handlers/voice';
import { applyBuilderPolicySeeding } from '../../utils/with-builder-policy-seeding';
import type { ServerRoute } from '.';

/**
 * Agent execution + tool-call/network/instructions routes that resolve a model at runtime.
 * Each gets `withBuilderPolicySeeding` applied so the Agent Builder model policy is seeded
 * onto the request context BEFORE client-supplied entries merge in. This is the runtime-defense
 * counterpart to Phase 6 static enforcement and catches `DynamicArgument` model selectors.
 *
 * Drift-guard test in `with-builder-policy-seeding.test.ts` enumerates these to ensure new
 * agent execution routes don't ship without seeding.
 */
const AGENT_RUNTIME_DEFENSE_ROUTES: readonly ServerRoute[] = [
  GENERATE_AGENT_ROUTE,
  GENERATE_AGENT_VNEXT_ROUTE,
  STREAM_GENERATE_ROUTE,
  STREAM_GENERATE_VNEXT_DEPRECATED_ROUTE,
  APPROVE_TOOL_CALL_ROUTE,
  DECLINE_TOOL_CALL_ROUTE,
  RESUME_STREAM_ROUTE,
  APPROVE_TOOL_CALL_GENERATE_ROUTE,
  DECLINE_TOOL_CALL_GENERATE_ROUTE,
  STREAM_NETWORK_ROUTE,
  APPROVE_NETWORK_TOOL_CALL_ROUTE,
  DECLINE_NETWORK_TOOL_CALL_ROUTE,
  ENHANCE_INSTRUCTIONS_ROUTE,
  GET_AGENT_SKILL_ROUTE,
  STREAM_VNEXT_DEPRECATED_ROUTE,
  STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE,
  STREAM_UI_MESSAGE_DEPRECATED_ROUTE,
];

for (const route of AGENT_RUNTIME_DEFENSE_ROUTES) {
  applyBuilderPolicySeeding(route);
}

export const AGENTS_ROUTES: readonly ServerRoute[] = [
  // ============================================================================
  // Agent Core Routes
  // ============================================================================
  LIST_AGENTS_ROUTE,
  GET_PROVIDERS_ROUTE,
  GET_AGENT_BY_ID_ROUTE,
  CLONE_AGENT_ROUTE,

  // ============================================================================
  // Voice Routes
  // ============================================================================
  GET_SPEAKERS_ROUTE,
  GET_SPEAKERS_DEPRECATED_ROUTE,

  // ============================================================================
  // Agent Execution Routes
  // ============================================================================
  GENERATE_AGENT_ROUTE,
  GENERATE_AGENT_VNEXT_ROUTE,
  STREAM_GENERATE_ROUTE,
  STREAM_GENERATE_VNEXT_DEPRECATED_ROUTE,

  // ============================================================================
  // Tool Routes
  // ============================================================================
  EXECUTE_AGENT_TOOL_ROUTE,
  APPROVE_TOOL_CALL_ROUTE,
  DECLINE_TOOL_CALL_ROUTE,
  RESUME_STREAM_ROUTE,
  APPROVE_TOOL_CALL_GENERATE_ROUTE,
  DECLINE_TOOL_CALL_GENERATE_ROUTE,
  APPROVE_NETWORK_TOOL_CALL_ROUTE,
  DECLINE_NETWORK_TOOL_CALL_ROUTE,

  // ============================================================================
  // Network Routes
  // ============================================================================
  STREAM_NETWORK_ROUTE,

  // ============================================================================
  // Model Management Routes
  // ============================================================================
  UPDATE_AGENT_MODEL_ROUTE,
  RESET_AGENT_MODEL_ROUTE,
  REORDER_AGENT_MODEL_LIST_ROUTE,
  UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE,

  // ============================================================================
  // Instruction Enhancement Routes
  // ============================================================================
  ENHANCE_INSTRUCTIONS_ROUTE,

  // ============================================================================
  // Agent Tool Routes
  // ============================================================================
  GET_AGENT_TOOL_ROUTE,

  // ============================================================================
  // Agent Skill Routes
  // ============================================================================
  GET_AGENT_SKILL_ROUTE,

  // ============================================================================
  // Voice/Speech Routes
  // ============================================================================
  GENERATE_SPEECH_ROUTE,
  GENERATE_SPEECH_DEPRECATED_ROUTE,
  TRANSCRIBE_SPEECH_ROUTE,
  TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  GET_LISTENER_ROUTE,

  // ============================================================================
  // Deprecated Routes
  // ============================================================================
  STREAM_VNEXT_DEPRECATED_ROUTE,
  STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE,
  STREAM_UI_MESSAGE_DEPRECATED_ROUTE,
];

/**
 * Type-level tuple preserving each agent route's specific schema types.
 * Used by ServerRoutes to build the type-level route map.
 */
export type AgentRoutes = readonly [
  typeof LIST_AGENTS_ROUTE,
  typeof GET_PROVIDERS_ROUTE,
  typeof GET_AGENT_BY_ID_ROUTE,
  typeof CLONE_AGENT_ROUTE,
  typeof GET_SPEAKERS_ROUTE,
  typeof GET_SPEAKERS_DEPRECATED_ROUTE,
  typeof GENERATE_AGENT_ROUTE,
  typeof GENERATE_AGENT_VNEXT_ROUTE,
  typeof STREAM_GENERATE_ROUTE,
  typeof STREAM_GENERATE_VNEXT_DEPRECATED_ROUTE,
  typeof EXECUTE_AGENT_TOOL_ROUTE,
  typeof APPROVE_TOOL_CALL_ROUTE,
  typeof DECLINE_TOOL_CALL_ROUTE,
  typeof RESUME_STREAM_ROUTE,
  typeof APPROVE_TOOL_CALL_GENERATE_ROUTE,
  typeof DECLINE_TOOL_CALL_GENERATE_ROUTE,
  typeof APPROVE_NETWORK_TOOL_CALL_ROUTE,
  typeof DECLINE_NETWORK_TOOL_CALL_ROUTE,
  typeof STREAM_NETWORK_ROUTE,
  typeof UPDATE_AGENT_MODEL_ROUTE,
  typeof RESET_AGENT_MODEL_ROUTE,
  typeof REORDER_AGENT_MODEL_LIST_ROUTE,
  typeof UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE,
  typeof ENHANCE_INSTRUCTIONS_ROUTE,
  typeof GET_AGENT_TOOL_ROUTE,
  typeof GET_AGENT_SKILL_ROUTE,
  typeof GENERATE_SPEECH_ROUTE,
  typeof GENERATE_SPEECH_DEPRECATED_ROUTE,
  typeof TRANSCRIBE_SPEECH_ROUTE,
  typeof TRANSCRIBE_SPEECH_DEPRECATED_ROUTE,
  typeof GET_LISTENER_ROUTE,
  typeof STREAM_VNEXT_DEPRECATED_ROUTE,
  typeof STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE,
  typeof STREAM_UI_MESSAGE_DEPRECATED_ROUTE,
];
