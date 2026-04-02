import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { Actions, Button, Card, CardText } from 'chat';

import type { ProcessInputStepArgs, ProcessInputStepResult } from '../processors/index';
import type { PostableMessage } from './agent-channels';
import type { ChannelContext } from './types';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TOOL_PREFIXES = ['mastra_workspace_'];
const MAX_ARG_SUMMARY_LENGTH = 40;
const MAX_RESULT_LENGTH = 300;

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
// Processor
// ---------------------------------------------------------------------------

/**
 * Input processor that injects channel context into agent prompts.
 *
 * Uses `processInputStep` to add a system message on every step of the agentic loop.
 * Since system messages are reset between steps, injecting on every step ensures the
 * context is stable and prompt-cacheable.
 *
 * All output rendering (tool cards, text messages, approval prompts) is handled by
 * `AgentChannels.consumeAgentStream` which iterates the outer `fullStream`.
 */
export class ChatChannelProcessor {
  readonly id = 'chat-channel-context';

  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const ctx = args.requestContext?.get('channel') as ChannelContext | undefined;
    if (!ctx) return undefined;

    const lines = [`You are communicating via ${ctx.platform}.`];

    if (ctx.isDM) {
      lines.push('This is a direct message (DM) conversation.');
      if (ctx.userName || ctx.userId) {
        const identity: string[] = [];
        if (ctx.userName) identity.push(`name: "${ctx.userName}"`);
        if (ctx.userId) identity.push(`ID: ${ctx.userId}`);
        lines.push(`You are talking to a user (${identity.join(', ')}).`);
      }
    } else {
      lines.push(
        'This message is in a public channel or thread.',
        'Not every message is directed at you. If users appear to be talking to each other, stay silent unless you are explicitly mentioned or your input is clearly needed. To stay silent, respond with an empty message.',
      );
    }

    const systemMessage: CoreMessageV4 = { role: 'system', content: lines.join('\n') };
    return { systemMessages: [...args.systemMessages, systemMessage] };
  }
}
