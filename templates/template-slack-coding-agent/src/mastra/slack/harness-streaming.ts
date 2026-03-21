import type { WebClient } from '@slack/web-api';
import type { HarnessEvent, HarnessEventListener } from '@mastra/core/harness';
import type { Harness } from '@mastra/core/harness';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLACK_MAX_LENGTH = 3900;
const UPDATE_THROTTLE_MS = 1000;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const GIST_SYNC_INTERVAL = 10; // Sync gist every N new log entries
const GIST_FILENAME = 'activity-log.md';

const TOOL_EMOJI: Record<string, string> = {
  view: '📂',
  search_content: '🔍',
  find_files: '📁',
  execute_command: '⚡',
  string_replace_lsp: '🔧',
  write_file: '✏️',
  web_search: '🌐',
  web_extract: '🌐',
  task_write: '📋',
  task_check: '✅',
  subagent: '🤖',
  mastra_workspace_execute_command: '⚡',
  mastra_workspace_read_file: '📂',
  mastra_workspace_write_file: '✏️',
  mastra_workspace_edit_file: '🔧',
  mastra_workspace_list_files: '📁',
  mastra_workspace_grep: '🔍',
  mastra_workspace_ast_edit: '🔧',
  mastra_workspace_delete: '🗑️',
  mastra_workspace_mkdir: '📁',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StreamingState {
  messageTs: string;
  text: string;
  statusText: string;
  spinnerIdx: number;
  lastUpdateTime: number;
  updatePending: boolean;
  updateTimer: ReturnType<typeof setTimeout> | null;
  finished: boolean;
  toolActivities: string[]; // Last N lines for Slack display
  gistLog: string;           // Append-only string buffer for gist (avoids array + join overhead)
  gistLogCount: number;      // Number of entries appended to gistLog
  activeSubagents: Map<string, { agentType: string; task: string }>;
  toolCount: number;
  startTime: number;
  // Gist
  gistId: string | null;
  gistUrl: string | null;
  lastGistSyncCount: number;
  gistSyncing: boolean;       // Lock to prevent concurrent PATCH calls
  gistPendingForce: boolean;  // If a forced sync was requested while locked
}

export interface StreamHarnessOptions {
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  harness: Harness;
  onAskQuestion?: (event: {
    questionId: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
  }) => void;
  onPlanApproval?: (event: {
    planId: string;
    title?: string;
    plan: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Main streaming function
// ---------------------------------------------------------------------------

export function streamHarnessToSlack(options: StreamHarnessOptions): Promise<void> {
  const { slackClient, channel, threadTs, harness, onAskQuestion, onPlanApproval } = options;

  const state: StreamingState = {
    messageTs: '',
    text: '',
    statusText: 'Thinking...',
    spinnerIdx: 0,
    lastUpdateTime: Date.now(),
    updatePending: false,
    updateTimer: null,
    finished: false,
    toolActivities: [],
    gistLog: '',
    gistLogCount: 0,
    activeSubagents: new Map(),
    toolCount: 0,
    startTime: Date.now(),
    gistId: null,
    gistUrl: null,
    lastGistSyncCount: 0,
    gistSyncing: false,
    gistPendingForce: false,
  };

  // Subscribe to events BEFORE any async work so we don't miss early events
  const listener: HarnessEventListener = (event: HarnessEvent) => {
    if (event.type === 'ask_question' && onAskQuestion) {
      onAskQuestion(event);
      return;
    }
    if (event.type === 'plan_approval_required' && onPlanApproval) {
      onPlanApproval(event);
      return;
    }
    handleHarnessEvent(event, state, slackClient, channel);
  };
  harness.subscribe(listener);

  // Post initial "thinking" message
  const initPromise = slackClient.chat
    .postMessage({ channel, thread_ts: threadTs, text: `${SPINNER_FRAMES[0]} Thinking...` })
    .then((msg: any) => { state.messageTs = msg.ts!; })
    .catch((err: any) => { console.error('Failed to post initial Slack message:', err); });

  const spinnerInterval = setInterval(() => {
    if (state.finished || !state.messageTs) return;
    state.spinnerIdx = (state.spinnerIdx + 1) % SPINNER_FRAMES.length;
    scheduleSlackUpdate(slackClient, channel, state);
  }, 500);

  return new Promise<void>(resolve => {
    const checkFinished: HarnessEventListener = async (event: HarnessEvent) => {
      if (event.type === 'agent_end') {
        state.finished = true;
        clearInterval(spinnerInterval);
        if (state.updateTimer) clearTimeout(state.updateTimer);

        await initPromise;
        await postFinalResponse(slackClient, channel, threadTs, state);

        // Final gist update with response
        await syncGist(state, true).catch(() => {});

        if (state.messageTs) {
          const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
          const gistLink = state.gistUrl ? ` | <${state.gistUrl}|📄 Full log>` : '';
          const summary = state.toolCount > 0
            ? `✅ Done — ${state.toolCount} tool calls in ${elapsed}s${gistLink}`
            : `✅ Done (${elapsed}s)${gistLink}`;
          try {
            await slackClient.chat.update({ channel, ts: state.messageTs, text: summary });
          } catch { /* best effort */ }
        }

        resolve();
      } else if (event.type === 'error') {
        state.finished = true;
        clearInterval(spinnerInterval);
        if (state.updateTimer) clearTimeout(state.updateTimer);

        await initPromise;

        const errorMsg = event.error?.message || 'An unknown error occurred';
        const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
        const errorDetail = state.toolCount > 0
          ? `❌ Error after ${state.toolCount} tool calls (${elapsed}s):\n${truncate(errorMsg, 500)}`
          : `❌ Error: ${truncate(errorMsg, 500)}`;

        // Final gist update
        pushLog(state, `❌ Error: ${truncate(errorMsg, 300)}`);
        await syncGist(state, true).catch(() => {});

        if (state.messageTs) {
          const gistLink = state.gistUrl ? ` | <${state.gistUrl}|📄 Full log>` : '';
          await slackClient.chat.update({
            channel, ts: state.messageTs, text: `❌ Failed (${elapsed}s)${gistLink}`,
          }).catch(() => {});
        }

        await slackClient.chat.postMessage({
          channel, thread_ts: threadTs, text: errorDetail,
        }).catch(() => {});

        resolve();
      }
    };
    harness.subscribe(checkFinished);
  });
}

// ---------------------------------------------------------------------------
// Event Handling
// ---------------------------------------------------------------------------

function handleHarnessEvent(
  event: HarnessEvent,
  state: StreamingState,
  slackClient: WebClient,
  channel: string,
): void {
  switch (event.type) {
    case 'message_start':
      state.statusText = 'Writing response...';
      break;

    case 'message_update': {
      const msg = event.message;
      if (msg.content) {
        const textParts = msg.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { type: string; text?: string }) => c.text ?? '');
        state.text = textParts.join('');
      }
      state.statusText = 'Writing response...';
      break;
    }

    case 'tool_start': {
      state.toolCount++;
      const toolName = stripPrefix(event.toolName);
      const emoji = TOOL_EMOJI[event.toolName] ?? TOOL_EMOJI[toolName] ?? '🔧';
      const summary = fmtToolStart(toolName, event.args);
      // Verbose detail for gist: include full args
      const argsStr = event.args ? JSON.stringify(event.args, null, 2) : '';
      const detail = argsStr ? `**Tool:** \`${toolName}\`\n\`\`\`json\n${truncate(argsStr, 2000)}\n\`\`\`` : `**Tool:** \`${toolName}\``;
      pushActivity(state, `${emoji} ${summary}`, detail);
      state.statusText = summary;
      break;
    }

    case 'tool_end': {
      const resultStr = typeof event.result === 'string' ? event.result : JSON.stringify(event.result ?? '', null, 2);
      if (event.isError) {
        const preview = truncate(resultStr, 100);
        pushActivity(state, `❌ Tool error: ${preview}`, `**Error output:**\n\`\`\`\n${truncate(resultStr, 3000)}\n\`\`\``);
      } else {
        // Log successful tool results to gist (not to Slack)
        pushLog(state, `✅ Tool result`, `\`\`\`\n${truncate(resultStr, 3000)}\n\`\`\``);
      }
      break;
    }

    case 'shell_output': {
      const out = truncate(event.output, 200);
      if (out.trim()) pushActivity(state, `\`\`\`\n${out}\n\`\`\``, `**Full output:**\n\`\`\`\n${truncate(event.output, 5000)}\n\`\`\``);
      break;
    }

    case 'task_updated': {
      const taskSummary = fmtTasks(event.tasks);
      let lastIdx = -1;
      for (let i = state.toolActivities.length - 1; i >= 0; i--) {
        if (state.toolActivities[i]!.includes('✅') || state.toolActivities[i]!.includes('🔄') || state.toolActivities[i]!.includes('⬜')) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) state.toolActivities[lastIdx] = taskSummary;
      else pushActivity(state, taskSummary);
      state.statusText = 'Working on tasks...';
      break;
    }

    case 'subagent_start':
      state.activeSubagents.set(event.toolCallId, { agentType: event.agentType, task: event.task });
      state.statusText = `🤖 Running ${event.agentType} subagent...`;
      pushActivity(state, `🤖 *${event.agentType}* subagent: ${truncate(event.task, 120)}`, `**Full task:**\n${event.task}`);
      break;

    case 'subagent_tool_start': {
      const sub = state.activeSubagents.get(event.toolCallId);
      const subName = sub ? sub.agentType : 'subagent';
      const subTool = stripPrefix(event.subToolName);
      const subEmoji = TOOL_EMOJI[event.subToolName] ?? TOOL_EMOJI[subTool] ?? '🔧';
      const subArgsStr = event.subToolArgs ? JSON.stringify(event.subToolArgs, null, 2) : '';
      state.statusText = `🤖 ${subName} → ${fmtToolStart(subTool, event.subToolArgs)}`;
      pushActivity(
        state,
        `  ${subEmoji} _${subName}_ → ${fmtToolStart(subTool, event.subToolArgs)}`,
        subArgsStr ? `**${subName} → ${subTool}:**\n\`\`\`json\n${truncate(subArgsStr, 2000)}\n\`\`\`` : undefined,
      );
      break;
    }

    case 'subagent_tool_end': {
      const sub = state.activeSubagents.get(event.toolCallId);
      const subName = sub?.agentType ?? 'subagent';
      const subResultStr = typeof event.result === 'string' ? event.result : JSON.stringify(event.result ?? '', null, 2);
      if (event.isError) {
        pushActivity(state, `  ❌ _${subName}_ tool error`, `**${subName} error:**\n\`\`\`\n${truncate(subResultStr, 3000)}\n\`\`\``);
      } else {
        pushLog(state, `  ✅ _${subName}_ tool result`, `\`\`\`\n${truncate(subResultStr, 3000)}\n\`\`\``);
      }
      break;
    }

    case 'subagent_end': {
      state.activeSubagents.delete(event.toolCallId);
      const status = event.isError ? '❌ failed' : '✅ done';
      pushActivity(state, `🤖 *${event.agentType}* ${status} (${(event.durationMs / 1000).toFixed(1)}s)`);
      if (state.activeSubagents.size > 0) {
        const remaining = Array.from(state.activeSubagents.values()).map(s => s.agentType).join(', ');
        state.statusText = `🤖 Still running: ${remaining}`;
      } else {
        state.statusText = 'Processing...';
      }
      break;
    }

    case 'error':
      pushActivity(state, `❌ Error: ${truncate(event.error?.message || 'Unknown error', 150)}`);
      state.statusText = 'Error occurred';
      break;

    case 'info':
      pushActivity(state, `ℹ️ ${truncate(event.message, 150)}`);
      break;

    default:
      return; // Don't trigger Slack update for unhandled events
  }

  scheduleSlackUpdate(slackClient, channel, state);
}

// ---------------------------------------------------------------------------
// Slack Updates
// ---------------------------------------------------------------------------

function scheduleSlackUpdate(slackClient: WebClient, channel: string, state: StreamingState): void {
  if (state.finished) return;
  const elapsed = Date.now() - state.lastUpdateTime;
  if (elapsed >= UPDATE_THROTTLE_MS) {
    void doSlackUpdate(slackClient, channel, state);
  } else if (!state.updateTimer) {
    state.updateTimer = setTimeout(() => {
      state.updateTimer = null;
      void doSlackUpdate(slackClient, channel, state);
    }, UPDATE_THROTTLE_MS - elapsed);
  }
}

async function doSlackUpdate(slackClient: WebClient, channel: string, state: StreamingState): Promise<void> {
  if (!state.messageTs) return;
  state.lastUpdateTime = Date.now();

  const spinner = SPINNER_FRAMES[state.spinnerIdx]!;
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(0);
  const toolInfo = state.toolCount > 0 ? ` | ${state.toolCount} tool calls | ${elapsed}s` : '';
  const gistLink = state.gistUrl ? ` | <${state.gistUrl}|📄 Full log>` : '';
  const lines: string[] = [`${spinner} ${state.statusText}${toolInfo}${gistLink}`];

  if (state.toolActivities.length > 0) {
    lines.push('');
    lines.push(...state.toolActivities.slice(-5));
  }

  if (state.activeSubagents.size > 0) {
    lines.push('');
    for (const [, sub] of state.activeSubagents) {
      lines.push(`🤖 _${sub.agentType}_ running: ${truncate(sub.task, 80)}`);
    }
  }

  try {
    await slackClient.chat.update({
      channel,
      ts: state.messageTs,
      text: truncate(lines.join('\n'), SLACK_MAX_LENGTH),
    });
  } catch { /* rate limiting etc */ }
}

async function postFinalResponse(
  slackClient: WebClient, channel: string, threadTs: string, state: StreamingState,
): Promise<void> {
  const responseText = state.text.trim();
  if (!responseText) return;

  const chunks = splitMessage(responseText, SLACK_MAX_LENGTH);
  for (const chunk of chunks) {
    try {
      await slackClient.chat.postMessage({ channel, thread_ts: threadTs, text: chunk });
    } catch (err) {
      console.error('Failed to post response chunk to Slack:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

function pushActivity(state: StreamingState, activity: string, detail?: string): void {
  // Slack display (capped)
  state.toolActivities.push(activity);
  if (state.toolActivities.length > 8) state.toolActivities.shift();

  // Append to gist log buffer (pushLog triggers gist sync internally)
  pushLog(state, activity, detail);
}

function pushLog(state: StreamingState, line: string, detail?: string): void {
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
  state.gistLog += `\n---\n\n#### [${elapsed}s] ${line}\n\n`;
  if (detail) {
    state.gistLog += `${detail}\n\n`;
  }
  state.gistLogCount++;
  // Trigger gist sync (fire-and-forget)
  syncGist(state).catch((err: unknown) => console.error('[gist] Sync error:', err));
}

// ---------------------------------------------------------------------------
// Gist Helpers
// ---------------------------------------------------------------------------

function buildGistContent(state: StreamingState, final?: boolean): string {
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
  const status = final ? '✅ Complete' : '🔄 Running...';

  let content = `# Agent Activity Log

**Status:** ${status} | **Tool calls:** ${state.toolCount} | **Elapsed:** ${elapsed}s
_Started: ${new Date(state.startTime).toISOString()}_

---
${state.gistLog || '\n_No activity yet_\n'}`;

  if (final && state.text.trim()) {
    content += `\n---\n\n## Final Response\n\n${state.text.trim()}\n`;
  }

  return content;
}

async function createGistForLog(state: StreamingState): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;

  try {
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        description: `MastraCode activity — ${new Date().toISOString()}`,
        public: false,
        files: { [GIST_FILENAME]: { content: buildGistContent(state) } },
      }),
    });

    if (!res.ok) {
      console.error('[gist] Create failed:', res.status, await res.text());
      return;
    }

    const data = (await res.json()) as { id: string; html_url: string };
    state.gistId = data.id;
    state.gistUrl = data.html_url;
    state.lastGistSyncCount = state.gistLogCount;
    console.log('[gist] Created:', state.gistUrl);
  } catch (err) {
    console.error('[gist] Create error:', err);
  }
}

async function updateGistLog(state: StreamingState, final = false): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !state.gistId) return;

  try {
    const res = await fetch(`https://api.github.com/gists/${state.gistId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: buildGistContent(state, final) } },
      }),
    });

    if (!res.ok) console.error('[gist] Update failed:', res.status);
    state.lastGistSyncCount = state.gistLogCount;
  } catch (err) {
    console.error('[gist] Update error:', err);
  }
}

async function syncGist(state: StreamingState, force?: boolean): Promise<void> {
  const newEntries = state.gistLogCount - state.lastGistSyncCount;
  if (!force && newEntries < GIST_SYNC_INTERVAL) return;

  // Serialize gist updates to avoid concurrent PATCH → 409 conflicts
  if (state.gistSyncing) {
    if (force) state.gistPendingForce = true;
    return;
  }

  state.gistSyncing = true;
  try {
    if (!state.gistId) {
      await createGistForLog(state);
    } else {
      await updateGistLog(state, force);
    }
  } finally {
    state.gistSyncing = false;
    // If a forced sync was requested while we were busy, do it now
    if (state.gistPendingForce) {
      state.gistPendingForce = false;
      await syncGist(state, true);
    }
  }
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

function stripPrefix(name: string): string {
  return name.replace(/^mastra_workspace_/, '');
}

function fmtToolStart(toolName: string, args: unknown): string {
  switch (toolName) {
    case 'view':
    case 'read_file':
      return `Reading \`${getArg(args, 'path', 'file')}\``;
    case 'search_content':
    case 'grep':
      return `Searching for \`${getArg(args, 'pattern', 'pattern')}\``;
    case 'find_files':
    case 'list_files':
      return `Listing \`${getArg(args, 'path', '.')}\``;
    case 'execute_command':
      return `Running \`${truncate(getArg(args, 'command', 'command'), 80)}\``;
    case 'string_replace_lsp':
    case 'edit_file':
      return `Editing \`${getArg(args, 'path', 'file')}\``;
    case 'write_file':
      return `Writing \`${getArg(args, 'path', 'file')}\``;
    case 'ast_edit':
      return `AST editing \`${getArg(args, 'path', 'file')}\``;
    case 'web_search':
      return `Searching web for \`${getArg(args, 'query', 'query')}\``;
    case 'task_write':
      return 'Updating task list';
    case 'task_check':
      return 'Checking task status';
    case 'delete':
      return `Deleting \`${getArg(args, 'path', 'file')}\``;
    case 'mkdir':
      return `Creating directory \`${getArg(args, 'path', 'dir')}\``;
    case 'file_stat':
      return `Checking \`${getArg(args, 'path', 'file')}\``;
    default:
      return `Running ${toolName}`;
  }
}

function fmtTasks(tasks: Array<{ content: string; status: string; activeForm: string }>): string {
  return tasks
    .map(t => {
      const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜';
      return `${icon} ${t.content}`;
    })
    .join('\n');
}

function getArg(args: unknown, key: string, fallback: string): string {
  if (args && typeof args === 'object' && key in args) {
    return String((args as Record<string, unknown>)[key]);
  }
  return fallback;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) { chunks.push(remaining); break; }
    let idx = remaining.lastIndexOf('\n', maxLength);
    if (idx < maxLength / 2) idx = maxLength;
    chunks.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx).trimStart();
  }
  return chunks;
}
