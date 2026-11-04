import type { ToolKind } from './tool-phrases';
import type { AgentIndicatorState } from '@/ds/components/AgentIndicator';

export interface ToolStyle {
  pose: AgentIndicatorState;
  label: ToolKind;
  detailKeys?: string[];
  isCommand?: boolean;
}

const TOOL_STYLES: Record<string, ToolStyle> = {
  read_file: { pose: 'reading', label: 'Read', detailKeys: ['path', 'file_path'] },
  write_file: { pose: 'writing', label: 'Write', detailKeys: ['path', 'file_path'] },
  edit_file: { pose: 'editing', label: 'Edit', detailKeys: ['path', 'file_path'] },
  execute_command: { pose: 'running', label: 'Run', detailKeys: ['command'], isCommand: true },
  execute_typescript: { pose: 'inspecting', label: 'Run code' },
  get_process_output: { pose: 'output', label: 'Process output', detailKeys: ['pid'] },
  kill_process: { pose: 'stopping', label: 'Stop process', detailKeys: ['pid'] },
  find_files: { pose: 'finding', label: 'Find files', detailKeys: ['pattern', 'path'] },
  list_files: { pose: 'listing', label: 'List files', detailKeys: ['path', 'pattern'] },
  grep: { pose: 'searching', label: 'Search', detailKeys: ['pattern', 'query', 'path'] },
  web_search: { pose: 'browsing', label: 'Search the web', detailKeys: ['query'] },
  web_fetch: { pose: 'fetching', label: 'Read website', detailKeys: ['url'] },
  web_extract: { pose: 'fetching', label: 'Extract website', detailKeys: ['url'] },
  lsp_inspect: { pose: 'inspecting', label: 'Inspect code', detailKeys: ['path'] },
  file_stat: { pose: 'reading', label: 'File info', detailKeys: ['path'] },
  delete_file: { pose: 'deleting', label: 'Delete', detailKeys: ['path'] },
  mkdir: { pose: 'creating', label: 'New folder', detailKeys: ['path'] },
  index: { pose: 'knowledge', label: 'Index content', detailKeys: ['path'] },
  skill: { pose: 'skill', label: 'Skill', detailKeys: ['name'] },
  skill_search: { pose: 'skill-searching', label: 'Search skills', detailKeys: ['query'] },
  skill_read: { pose: 'skill-reading', label: 'Skill file', detailKeys: ['path'] },
  knowledge_search: { pose: 'searching', label: 'Search knowledge', detailKeys: ['query'] },
  knowledge_read: { pose: 'reading', label: 'Read page', detailKeys: ['page', 'scope'] },
  knowledge_list: { pose: 'knowledge', label: 'List knowledge', detailKeys: ['from'] },
  knowledge_page: { pose: 'knowledge', label: 'Edit page', detailKeys: ['name', 'page'] },
  knowledge_note: { pose: 'noting', label: 'Edit note', detailKeys: ['page', 'note'] },
  knowledge_pin: { pose: 'pinning', label: 'Update pin', detailKeys: ['page'] },
  ask_user: { pose: 'asking', label: 'Ask user', detailKeys: ['question'] },
  submit_plan: { pose: 'planning', label: 'Submit plan', detailKeys: ['title'] },
  request_access: { pose: 'asking', label: 'Request access', detailKeys: ['path'] },
  request_connection: { pose: 'connecting', label: 'Request connection', detailKeys: ['provider'] },
  subagent: { pose: 'delegating', label: 'Delegate', detailKeys: ['agentType'] },
  agent_connections_list: { pose: 'connecting', label: 'List connections' },
  agent_connect: { pose: 'connecting', label: 'Connect agent' },
  agent_disconnect: { pose: 'connecting', label: 'Disconnect agent' },
  agent_signal_send: { pose: 'messaging', label: 'Message agent', detailKeys: ['targetId'] },
  notification_inbox: { pose: 'inbox', label: 'Check inbox', detailKeys: ['query', 'id'] },
  schedule_create: {
    pose: 'scheduling',
    label: 'Create schedule',
    detailKeys: ['promptFile', 'script'],
  },
  schedule_list: { pose: 'scheduling', label: 'List schedules' },
  schedule_update: { pose: 'scheduling', label: 'Update schedule', detailKeys: ['id'] },
  schedule_resume: { pose: 'scheduling', label: 'Resume schedule', detailKeys: ['id'] },
  schedule_run: { pose: 'scheduling', label: 'Run schedule', detailKeys: ['id'] },
  'create-workflow': { pose: 'workflow', label: 'Create workflow' },
  'save-workflow': { pose: 'workflow', label: 'Save workflow', detailKeys: ['id'] },
  'list-workflows': { pose: 'workflow', label: 'List workflows' },
  'get-workflow': { pose: 'workflow', label: 'Read workflow', detailKeys: ['id'] },
  'run-workflow': { pose: 'workflow', label: 'Run workflow', detailKeys: ['workflowId'] },
  'delete-workflow': { pose: 'deleting', label: 'Delete workflow', detailKeys: ['id'] },
  'list-available-agents': { pose: 'delegating', label: 'List agents' },
  'list-available-classifiers': { pose: 'inspecting', label: 'List classifiers' },
  'list-available-tools': { pose: 'tool', label: 'List tools' },
  browser_goto: { pose: 'fetching', label: 'Open website', detailKeys: ['url'] },
  browser_snapshot: { pose: 'reading', label: 'Inspect page' },
  browser_click: { pose: 'clicking', label: 'Click', detailKeys: ['ref', 'selector'] },
  browser_type: { pose: 'typing', label: 'Type', detailKeys: ['ref', 'selector'] },
  browser_press: { pose: 'typing', label: 'Press key', detailKeys: ['key'] },
  browser_select: { pose: 'clicking', label: 'Select option', detailKeys: ['ref', 'selector'] },
  browser_scroll: { pose: 'clicking', label: 'Scroll', detailKeys: ['direction'] },
  browser_close: { pose: 'fetching', label: 'Close browser' },
  browser_hover: { pose: 'clicking', label: 'Hover', detailKeys: ['ref', 'selector'] },
  browser_back: { pose: 'fetching', label: 'Go back' },
  browser_dialog: { pose: 'asking', label: 'Handle dialog', detailKeys: ['action'] },
  browser_wait: { pose: 'waiting', label: 'Wait' },
  browser_tabs: { pose: 'fetching', label: 'Manage tabs', detailKeys: ['action', 'url'] },
  browser_drag: { pose: 'clicking', label: 'Drag', detailKeys: ['sourceRef', 'sourceSelector'] },
  browser_screenshot: { pose: 'screenshot', label: 'Take screenshot', detailKeys: ['path'] },
  browser_evaluate: { pose: 'inspecting', label: 'Run browser code' },
  browser_record: { pose: 'screenshot', label: 'Record browser', detailKeys: ['outputPath'] },
  browser_record_caption: { pose: 'noting', label: 'Caption recording' },
  stagehand_act: { pose: 'clicking', label: 'Interact with page', detailKeys: ['instruction'] },
  stagehand_extract: { pose: 'fetching', label: 'Extract website', detailKeys: ['instruction'] },
  stagehand_observe: { pose: 'reading', label: 'Inspect page', detailKeys: ['instruction'] },
  computer_screenshot: { pose: 'screenshot', label: 'Take screenshot' },
  computer_click: { pose: 'clicking', label: 'Click' },
  computer_double_click: { pose: 'clicking', label: 'Double-click' },
  computer_right_click: { pose: 'clicking', label: 'Right-click' },
  computer_move_mouse: { pose: 'clicking', label: 'Move pointer' },
  computer_drag: { pose: 'clicking', label: 'Drag' },
  computer_type: { pose: 'typing', label: 'Type' },
  computer_press_key: { pose: 'typing', label: 'Press key', detailKeys: ['key'] },
  computer_scroll: { pose: 'clicking', label: 'Scroll', detailKeys: ['direction'] },
  computer_get_screen_info: { pose: 'screenshot', label: 'Inspect screen' },
  factory_list_work_items: {
    pose: 'planning',
    label: 'List work items',
    detailKeys: ['query', 'stage'],
  },
  factory_inspect_work_item: {
    pose: 'inspecting',
    label: 'Inspect work item',
    detailKeys: ['workItem'],
  },
  factory_list_attention: { pose: 'inbox', label: 'Check attention' },
  factory_create_work_item: { pose: 'planning', label: 'Create work item', detailKeys: ['title'] },
  factory_transition_work_item: {
    pose: 'moving',
    label: 'Move work item',
    detailKeys: ['workItem', 'stage'],
  },
  factory_update_work_item: {
    pose: 'planning',
    label: 'Update work item',
    detailKeys: ['title', 'workItem'],
  },
  factory_retry_decision: { pose: 'workflow', label: 'Retry run', detailKeys: ['decisionId'] },
  factory_dismiss_decision: {
    pose: 'planning',
    label: 'Dismiss proposal',
    detailKeys: ['decisionId'],
  },
  factory_resolve_proposal: {
    pose: 'planning',
    label: 'Resolve proposal',
    detailKeys: ['decisionId'],
  },
  factory_subscribe_work_item: {
    pose: 'connecting',
    label: 'Follow work item',
    detailKeys: ['workItem'],
  },
  factory_unsubscribe_work_item: {
    pose: 'connecting',
    label: 'Unfollow work item',
    detailKeys: ['workItem'],
  },
  factory_start_session: {
    pose: 'delegating',
    label: 'Start session',
    detailKeys: ['title', 'workItem'],
  },
  factory_switch_session_model: {
    pose: 'delegating',
    label: 'Configure session model',
    detailKeys: ['modelId', 'sessionId'],
  },
  factory_signal_session: {
    pose: 'messaging',
    label: 'Message session',
    detailKeys: ['sessionId'],
  },
  factory_message_origin: { pose: 'messaging', label: 'Report progress', detailKeys: ['status'] },
  factory_list_side_sessions: { pose: 'delegating', label: 'List sessions', detailKeys: ['state'] },
  factory_subscribe_session: {
    pose: 'connecting',
    label: 'Follow session',
    detailKeys: ['sessionId'],
  },
  factory_unsubscribe_session: {
    pose: 'connecting',
    label: 'Unfollow session',
    detailKeys: ['sessionId'],
  },
  factory_answer_approval: { pose: 'asking', label: 'Answer approval', detailKeys: ['sessionId'] },
  factory_recreate_sandbox: { pose: 'stopping', label: 'Recreate sandbox' },
  factory_sandbox_port_url: {
    pose: 'connecting',
    label: 'Open sandbox port',
    detailKeys: ['port'],
  },
  source_control_refresh_change_request_checkout: { pose: 'branching', label: 'Refresh checkout' },
  source_control_push_branch: {
    pose: 'branching',
    label: 'Push branch',
    detailKeys: ['repository'],
  },
  source_control_get_change_request: {
    pose: 'branching',
    label: 'Read change request',
    detailKeys: ['changeRequestId'],
  },
  source_control_create_change_request: {
    pose: 'branching',
    label: 'Create change request',
    detailKeys: ['title'],
  },
  source_control_update_change_request: {
    pose: 'branching',
    label: 'Update change request',
    detailKeys: ['title', 'changeRequestId'],
  },
  source_control_merge_change_request: {
    pose: 'merging',
    label: 'Merge change request',
    detailKeys: ['changeRequestId'],
  },
  source_control_list_change_request_reviews: {
    pose: 'inspecting',
    label: 'List reviews',
    detailKeys: ['changeRequestId'],
  },
  source_control_review_change_request: {
    pose: 'inspecting',
    label: 'Review change request',
    detailKeys: ['changeRequestId'],
  },
  source_control_request_reviewers: {
    pose: 'asking',
    label: 'Request review',
    detailKeys: ['changeRequestId'],
  },
  source_control_publish_test_check: {
    pose: 'inspecting',
    label: 'Publish test result',
    detailKeys: ['title', 'changeRequestId'],
  },
  source_control_comment_change_request: {
    pose: 'messaging',
    label: 'Post comment',
    detailKeys: ['changeRequestId'],
  },
  source_control_create_diff_comment: {
    pose: 'messaging',
    label: 'Post comment',
    detailKeys: ['path', 'changeRequestId'],
  },
  source_control_list_change_request_comments: {
    pose: 'messaging',
    label: 'Read comments',
    detailKeys: ['changeRequestId'],
  },
  source_control_list_diff_comments: {
    pose: 'messaging',
    label: 'Read comments',
    detailKeys: ['changeRequestId'],
  },
  source_control_update_change_request_comment: {
    pose: 'messaging',
    label: 'Edit comment',
    detailKeys: ['commentId'],
  },
  source_control_update_diff_comment: {
    pose: 'messaging',
    label: 'Edit comment',
    detailKeys: ['commentId'],
  },
  source_control_delete_change_request_comment: {
    pose: 'deleting',
    label: 'Delete comment',
    detailKeys: ['commentId'],
  },
  source_control_delete_diff_comment: {
    pose: 'deleting',
    label: 'Delete comment',
    detailKeys: ['commentId'],
  },
  source_control_resolve_diff_thread: {
    pose: 'messaging',
    label: 'Update review thread',
    detailKeys: ['commentId'],
  },
};

const ALIASES: Record<string, string> = {
  view: 'read_file',
  Read: 'read_file',
  Bash: 'execute_command',
  create_file: 'write_file',
  string_replace: 'edit_file',
  str_replace: 'edit_file',
  ast_edit: 'edit_file',
  string_replace_lsp: 'edit_file',
  ast_smart_edit: 'edit_file',
  apply_patch: 'edit_file',
  apply_patch_call: 'edit_file',
  shell_call: 'execute_command',
  search_content: 'grep',
  search: 'grep',
  delete: 'delete_file',
  'web-search': 'web_search',
  'web-extract': 'web_extract',
  'notification-inbox': 'notification_inbox',
  'list-available-workflows': 'list-workflows',
  stagehand_navigate: 'browser_goto',
  stagehand_tabs: 'browser_tabs',
  stagehand_close: 'browser_close',
  stagehand_screenshot: 'browser_screenshot',
  computer_wait: 'browser_wait',
};

const OPERATIONS: Record<string, Record<string, ToolStyle>> = {
  knowledge_page: {
    move: { pose: 'moving', label: 'Move page', detailKeys: ['page'] },
    merge: { pose: 'merging', label: 'Merge pages', detailKeys: ['page', 'into'] },
    delete: { pose: 'deleting', label: 'Delete page', detailKeys: ['page'] },
  },
  knowledge_note: {
    add: { pose: 'noting', label: 'Add note', detailKeys: ['page'] },
    restamp: { pose: 'noting', label: 'Change note access', detailKeys: ['note'] },
    remove: { pose: 'deleting', label: 'Remove note', detailKeys: ['note', 'page'] },
  },
  knowledge_pin: {
    pin: { pose: 'pinning', label: 'Pin page', detailKeys: ['page'] },
    unpin: { pose: 'unpinning', label: 'Unpin page', detailKeys: ['page'] },
  },
  schedule_update: {
    pause: { pose: 'scheduling', label: 'Pause schedule', detailKeys: ['id'] },
    delete: { pose: 'deleting', label: 'Delete schedule', detailKeys: ['id'] },
  },
  notification_inbox: {
    list: { pose: 'inbox', label: 'Check inbox' },
    read: { pose: 'inbox', label: 'Read notification', detailKeys: ['id'] },
    search: { pose: 'inbox', label: 'Search notifications', detailKeys: ['query'] },
    markSeen: { pose: 'inbox', label: 'Mark notification read', detailKeys: ['id'] },
    dismiss: { pose: 'inbox', label: 'Dismiss notification', detailKeys: ['id'] },
    archive: { pose: 'inbox', label: 'Archive notification', detailKeys: ['id'] },
  },
  browser_record: {
    status: { pose: 'output', label: 'Check recording', detailKeys: ['id'] },
    stop: { pose: 'stopping', label: 'Stop recording', detailKeys: ['id'] },
  },
};

const AMBIGUOUS_NAMESPACE_NAMES = new Set(['search', 'view', 'delete', 'index', 'Read', 'Bash']);

function ownValue<T>(values: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(values, key) ? values[key] : undefined;
}

function unprefixedToolName(toolName: string): string {
  const name = toolName.replace(/^mastra_workspace_/, '');
  return ownValue(ALIASES, name) ?? name;
}

function nativeToolStyle(toolName: string): ToolStyle | undefined {
  if (toolName.includes('.')) return undefined;
  if (toolName.startsWith('agent-')) return { pose: 'delegating', label: 'Delegate' };
  if (toolName.startsWith('workflow-')) return { pose: 'workflow', label: 'Run workflow' };
  return undefined;
}

function namespacedLeaf(toolName: string): string | undefined {
  if (toolName.startsWith('mcp__')) {
    const separator = toolName.lastIndexOf('__');
    return separator > 'mcp__'.length ? toolName.slice(separator + 2) : undefined;
  }
  const separator = toolName.lastIndexOf('.');
  return separator > 0 ? toolName.slice(separator + 1) : undefined;
}

export function canonicalToolName(toolName: string): string {
  const direct = unprefixedToolName(toolName);
  if (Object.hasOwn(TOOL_STYLES, direct) || nativeToolStyle(direct)) return direct;
  const leaf = namespacedLeaf(toolName);
  if (!leaf || AMBIGUOUS_NAMESPACE_NAMES.has(leaf)) return toolName;
  const canonical = unprefixedToolName(leaf);
  return Object.hasOwn(TOOL_STYLES, canonical) ? canonical : toolName;
}

export function resolveToolStyle(toolName: string, operation?: string): ToolStyle | undefined {
  const canonical = canonicalToolName(toolName);
  const operations = ownValue(OPERATIONS, canonical);
  const operationStyle = operation && operations ? ownValue(operations, operation) : undefined;
  if (operationStyle) return operationStyle;
  const style = ownValue(TOOL_STYLES, canonical);
  if (style) return style;
  return nativeToolStyle(canonical);
}
