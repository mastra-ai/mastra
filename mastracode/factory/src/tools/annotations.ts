import type { ToolAnnotations } from '@mastra/core/tools';

const read: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const additive: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const toggle: ToolAnnotations = { ...additive, idempotentHint: true };
const changes: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

/**
 * MCP hints for each Factory tool, so clients like ChatGPT can tell lookups
 * from writes and ask before a tool changes or discards state.
 */
export const FACTORY_TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  factory_list_work_items: { ...read, title: 'List work items' },
  factory_inspect_work_item: { ...read, title: 'Inspect a work item' },
  factory_list_attention: { ...read, title: 'List items that need attention' },
  factory_create_work_item: { ...additive, title: 'Create a work item' },
  factory_update_work_item: { ...changes, title: 'Update a work item' },
  factory_transition_work_item: { ...changes, title: 'Move a work item to another stage' },
  factory_retry_decision: { ...additive, title: 'Retry a failed decision' },
  factory_dismiss_decision: { ...changes, title: 'Dismiss a decision' },
  factory_resolve_proposal: { ...changes, title: 'Approve or reject a proposal' },
  factory_subscribe_work_item: { ...toggle, title: 'Follow a work item' },
  factory_unsubscribe_work_item: { ...toggle, title: 'Stop following a work item' },
  factory_start_session: { ...additive, openWorldHint: true, title: 'Start an agent session' },
  factory_signal_session: { ...additive, openWorldHint: true, title: 'Message a running session' },
  factory_message_origin: { ...additive, title: 'Reply to the session that started this one' },
  factory_answer_approval: { ...changes, openWorldHint: true, title: 'Answer a session approval request' },
  search: { ...read, title: 'Search work items' },
  fetch: { ...read, title: 'Fetch a work item' },
};
