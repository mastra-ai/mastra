import type { CardElement } from 'chat';
import { Actions, Button, Card, CardText } from 'chat';

import type { ProcessInputArgs, ProcessInputResult } from '../processors/index';
import type { ChannelContext } from './types';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TOOL_PREFIXES = ['mastra_workspace_'];
const MAX_ARG_SUMMARY_LENGTH = 40;
const MAX_RESULT_LENGTH = 300;

/** Message content that can be posted to a channel. */
export type PostableMessage = string | CardElement;

export function stripToolPrefix(name: string): string {
  for (const prefix of TOOL_PREFIXES) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

export function formatArgsSummary(args: unknown): string {
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args;
    if (!obj || typeof obj !== 'object') return '';

    const entries = Object.entries(obj as Record<string, unknown>).filter(
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
    return Card({ children: [CardText(`${header} ⋯`)] });
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
    return Card({
      children: [CardText(headerWithStatus), CardText(resultBody, { style: isError ? 'bold' : 'plain' })],
    });
  }

  // Plain text format
  const resultBody = isError ? `Error: ${resultText}` : resultText;
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
    return Card({
      children: [
        CardText(header),
        CardText('Requires approval to run.'),
        Actions([
          Button({ id: `tool_approve:${toolCallId}`, label: 'Approve', style: 'primary' }),
          Button({ id: `tool_deny:${toolCallId}`, label: 'Deny', style: 'danger' }),
        ]),
      ],
    });
  }

  // Plain text — no buttons possible, just show the request
  return `${header}\n⏸ Requires approval to run. Reply "approve" or "deny".`;
}

/** Format an "approved" status message (shown while tool runs) */
export function formatToolApproved(toolName: string, argsSummary: string, useCards: boolean): PostableMessage {
  const header = formatToolHeader(toolName, argsSummary);

  if (useCards) {
    return Card({ children: [CardText(`${header} ⋯`), CardText('✓ Approved')] });
  }

  return `${header} ⋯\n✓ Approved`;
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
    return Card({ children: [CardText(`${header} ✗`), CardText(`✗ Denied${suffix}`)] });
  }

  return `${header} ✗\n✗ Denied${suffix}`;
}

// ---------------------------------------------------------------------------
// Legacy helper (for backwards compatibility with custom formatToolCall)
// ---------------------------------------------------------------------------

export function buildToolResultCard(
  toolName: string,
  argsSummary: string,
  resultText: string,
  isError?: boolean,
  durationMs?: number,
): CardElement {
  return formatToolResult(toolName, argsSummary, resultText, !!isError, durationMs, true) as CardElement;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Input processor that injects channel context into agent prompts.
 *
 * - `processInput`: Adds a system message with stable context (platform, isDM, userName).
 * - `processInputStep`: At step 0, prepends a `<system-reminder>` to the user's message
 *   with per-request data (messageId, eventType).
 *
 * All output rendering (tool cards, text messages, approval prompts) is handled by
 * `AgentChannels.consumeAgentStream` which iterates the outer `fullStream`.
 */
export class ChatChannelProcessor {
  readonly id = 'chat-channel-context';

  // -------------------------------------------------------------------------
  // Input processing
  // -------------------------------------------------------------------------

  processInput(args: ProcessInputArgs): ProcessInputResult {
    const ctx = args.requestContext?.get('channel') as ChannelContext | undefined;
    if (!ctx) return args.messageList;

    const lines = [`You are communicating via ${ctx.platform}.`];

    if (ctx.isDM) {
      lines.push('This is a direct message (DM) conversation.');
    } else {
      lines.push(
        'This message is in a public channel or thread.',
        'Not every message is directed at you. If users appear to be talking to each other, stay silent unless you are explicitly mentioned or your input is clearly needed. To stay silent, respond with an empty message.',
      );
    }

    // In DMs the user is always the same person, so include their identity.
    // In shared threads each message is already prefixed with [name], so skip.
    if (ctx.isDM && ctx.userName) {
      lines.push(`The user you are talking to is "${ctx.userName}".`);
    }

    // Include recent thread history when available (for mid-conversation mentions)
    if (ctx.threadHistory && ctx.threadHistory.length > 0) {
      lines.push('\n\nRecent messages in this thread (for context):');
      for (const msg of ctx.threadHistory) {
        const prefix = msg.isBot ? `${msg.author} (bot)` : msg.author;
        lines.push(`[${prefix}]: ${msg.text}`);
      }
      lines.push(''); // Empty line before the current message
    }

    const systemMessages = [...args.systemMessages, { role: 'system' as const, content: lines.join(' ') }];

    return { messages: args.messages, systemMessages };
  }
}
