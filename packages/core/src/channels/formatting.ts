import { chatModule } from './chat-lazy';
import type { PostableMessage } from './types';

// ---------------------------------------------------------------------------
// Lazy accessors for Chat SDK card primitives (loaded after initialize())
// ---------------------------------------------------------------------------

const ui = () => chatModule();

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TOOL_PREFIXES = ['mastra_workspace_'];
const MAX_ARG_SUMMARY_LENGTH = 35;
const MAX_TASK_TITLE_LENGTH = 80;
const MAX_RESULT_LENGTH = 300;

export function stripToolPrefix(name: string): string {
  for (const prefix of TOOL_PREFIXES) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

/** Tool args arrive either as an object or as the raw JSON string the model emitted. */
function parseArgs(args: unknown): Record<string, unknown> | undefined {
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args;
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export function formatArgsSummary(args: unknown): string {
  try {
    const obj = parseArgs(args);
    if (!obj) return '';

    const entries = Object.entries(obj).filter(
      ([key, val]) => key !== '__mastraMetadata' && val != null && val !== false && val !== '',
    );
    if (entries.length === 0) return '';

    const [, first] = entries[0]!;
    let display = typeof first === 'string' ? first : JSON.stringify(first);
    if (display.length > MAX_ARG_SUMMARY_LENGTH) {
      display = display.slice(0, MAX_ARG_SUMMARY_LENGTH) + '…';
    }
    return display;
  } catch {
    return '';
  }
}

/**
 * One-line title for a tool's row in a plan/task widget. A tool that
 * describes itself (e.g. `execute_command`'s `description`) gets that line
 * verbatim — "Listing files in /workspace" reads better than
 * "execute_command ls -la". Otherwise fall back to `name args`.
 *
 * Not every `description` is a one-liner — issue/PR creators and MCP tools
 * take multi-paragraph bodies under that name — so only the first non-blank
 * line is used, with runs of whitespace collapsed.
 */
export function formatTaskTitle(displayName: string, argsSummary: string, args: unknown): string {
  const description = parseArgs(args)?.description;
  if (typeof description === 'string') {
    const line = description
      .split('\n')
      .map(l => l.replace(/\s+/g, ' ').trim())
      .find(Boolean);
    if (line) return line.length > MAX_TASK_TITLE_LENGTH ? line.slice(0, MAX_TASK_TITLE_LENGTH) + '…' : line;
  }
  return argsSummary ? `${displayName} ${argsSummary}` : displayName;
}

export function formatResult(result: unknown, isError?: boolean): string {
  const prefix = isError ? 'Error: ' : '';
  if (result == null) return `${prefix}(no output)`;
  let text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  text = text.trim();
  if (text.length > MAX_RESULT_LENGTH) {
    text = text.slice(0, MAX_RESULT_LENGTH) + '…';
  }
  return `${prefix}${text}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Tool header formatting
// ---------------------------------------------------------------------------

/** Format the tool header line: **toolName** `args` */
export function formatToolHeader(toolName: string, argsSummary: string): string {
  return argsSummary ? `*${toolName}* \`${argsSummary}\`` : `*${toolName}*`;
}

// ---------------------------------------------------------------------------
// Tool message formatting (cards vs plain text)
// ---------------------------------------------------------------------------

/** Format a "running" tool call message */
export function formatToolRunning(toolName: string, argsSummary: string, useCards: boolean): PostableMessage {
  const header = formatToolHeader(toolName, argsSummary);
  if (useCards) {
    return ui().Card({ children: [ui().CardText(`${header} ⋯`)] });
  }
  return `${header} ⋯`;
}

/** Format a tool result message */
export function formatToolResult(
  toolName: string,
  argsSummary: string,
  resultText: string,
  isError: boolean,
  durationMs: number | undefined,
  useCards: boolean,
): PostableMessage {
  const status = durationMs != null ? `${formatDuration(durationMs)} ${isError ? '✗' : '✓'}` : isError ? '✗' : '✓';
  const header = formatToolHeader(toolName, argsSummary);

  if (useCards) {
    const headerWithStatus = `${header} · ${status}`;
    const resultBody = isError ? resultText : `\`\`\`\n${resultText}\n\`\`\``;
    return ui().Card({
      children: [ui().CardText(headerWithStatus), ui().CardText(resultBody, { style: isError ? 'bold' : 'plain' })],
    });
  }

  // Plain text format
  const resultBody = isError && !resultText.startsWith('Error: ') ? `Error: ${resultText}` : resultText;
  return `${header} · ${status}\n${resultBody}`;
}

/** Format a tool approval request message */
export function formatToolApproval(
  toolName: string,
  argsSummary: string,
  toolCallId: string,
  useCards: boolean,
): PostableMessage {
  const header = formatToolHeader(toolName, argsSummary);

  if (useCards) {
    return ui().Card({
      children: [
        ui().CardText(header),
        ui().CardText('Requires approval to run.'),
        ui().Actions([
          ui().Button({ id: `tool_approve:${toolCallId}`, label: 'Approve', style: 'primary' }),
          ui().Button({ id: `tool_deny:${toolCallId}`, label: 'Deny', style: 'danger' }),
        ]),
      ],
    });
  }

  // Plain text — no buttons possible, just show the request
  return `${header}\n⏸ Requires approval to run. Reply "approve" or "deny".`;
}

/** Format an "approved" status message (shown while tool runs) */
export function formatToolApproved(
  toolName: string,
  argsSummary: string,
  useCards: boolean,
  byUser?: string,
): PostableMessage {
  const header = formatToolHeader(toolName, argsSummary);
  const suffix = byUser ? ` by ${byUser}` : '';

  if (useCards) {
    return ui().Card({ children: [ui().CardText(`${header} ⋯`), ui().CardText(`✓ Approved${suffix}`)] });
  }

  return `${header} ⋯\n✓ Approved${suffix}`;
}

/** Format a "denied" status message */
export function formatToolDenied(
  toolName: string,
  argsSummary: string,
  byUser: string | undefined,
  useCards: boolean,
): PostableMessage {
  const header = formatToolHeader(toolName, argsSummary);
  const suffix = byUser ? ` by ${byUser}` : '';

  if (useCards) {
    return ui().Card({ children: [ui().CardText(`${header} ✗`), ui().CardText(`✗ Denied${suffix}`)] });
  }

  return `${header} ✗\n✗ Denied${suffix}`;
}
