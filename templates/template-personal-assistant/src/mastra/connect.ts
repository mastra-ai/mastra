import { tools } from '@mastra/connect';
import type { ToolsResolverContext } from '@mastra/connect';
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import type { Processor } from '@mastra/core/processors';
import { z } from 'zod';
import type { AssistantConfig } from './config';

// Only reviewed exact keys belong here. Names and retrieved content never grant permission.
export const reviewedReadTools: ReadonlySet<string> = new Set([
  'google_mail_get_message',
  'notion_get_page_as_markdown',
]);

export function requiresApproval(key: string) {
  return !reviewedReadTools.has(key);
}

export function createConnections(config: AssistantConfig) {
  const configured = config.connect !== undefined;
  const resolver = config.connect
    ? tools({
        projectId: config.connect.projectId,
        providers: config.connect.providers,
        resourceId: config.ownerId,
        connectPrompt: false,
        requireApproval: true,
      })
    : undefined;
  type Status = { state: 'unconfigured' | 'available' | 'unavailable'; unresolvedProviders: string[]; detail: string };
  let status: Status = {
    state: configured ? 'unavailable' : 'unconfigured',
    unresolvedProviders: config.connect?.providers || [],
    detail: configured
      ? 'Connections have not been refreshed.'
      : 'Connect is not configured. Local capabilities remain available.',
  };
  async function resolve() {
    if (!resolver) return {};
    try {
      // Explicit refresh avoids the resolver's stale-while-revalidate snapshot on a new run or resume.
      const resolved = await resolver.refresh();
      const allowed = config.connect?.toolKeys;
      const selected = Object.entries(resolved).filter(([key]) => !allowed || allowed.includes(key));
      const unresolvedProviders = config.connect!.providers.filter(
        provider => !selected.some(([key]) => key.startsWith(`${provider.replaceAll('-', '_')}_`)),
      );
      status = {
        state: unresolvedProviders.length ? 'unavailable' : 'available',
        unresolvedProviders,
        detail: unresolvedProviders.length
          ? 'Some providers did not resolve usable tools. A missing connection, access problem, or tool restriction is possible; this is not an empty source result.'
          : 'Tools resolved. This confirms tool availability, not successful access to every source record.',
      };
      return Object.fromEntries(
        selected.map(([key, value]) => [
          key,
          createTool({
            ...(value as Tool),
            // A tool-level function is authoritative even when a caller sets requireToolApproval:false.
            requireApproval: () => requiresApproval(key),
          }),
        ]),
      );
    } catch {
      status = {
        state: 'unavailable',
        unresolvedProviders: config.connect!.providers,
        detail:
          'Connect refresh failed. Check the project, credentials and service availability. No source search was completed.',
      };
      return {};
    }
  }
  const connectionStatus = createTool({
    id: 'connection-status',
    description:
      'Refresh connected tool availability and report unresolved providers. An unavailable provider does not mean its source has no records.',
    inputSchema: z.object({}),
    execute: async () => {
      await resolve();
      return status;
    },
  });
  return {
    tools: async (context?: ToolsResolverContext) => ({ ...(await resolve()), connection_status: connectionStatus }),
    disconnect: async () => {
      await resolver?.disconnect();
    },
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normalizeMail(value: unknown) {
  const source = object(value);
  const result = {
    sourceMessageId: typeof source?.id === 'string' ? source.id : undefined,
    ...(typeof source?.threadId === 'string' ? { sourceThreadId: source.threadId } : {}),
    headers: [] as { name: string; value: string }[],
    text: '',
    status: 'unsupported',
    truncated: false,
    issues: [] as string[],
  };
  const metadataIssue = (issue: string) => {
    if (!result.issues.includes(issue)) result.issues.push(issue);
  };
  if (source?.threadId !== undefined && typeof source.threadId !== 'string')
    metadataIssue('Malformed source thread identity omitted.');
  const selectedNames = new Map([
    ['from', 'From'],
    ['to', 'To'],
    ['cc', 'Cc'],
    ['subject', 'Subject'],
    ['date', 'Date'],
  ]);
  const headers = object(source?.payload)?.headers;
  let headerBytes = 0;
  if (headers !== undefined && !Array.isArray(headers)) metadataIssue('Malformed source headers omitted.');
  if (Array.isArray(headers)) {
    for (const value of headers) {
      const header = object(value);
      if (typeof header?.name !== 'string') {
        metadataIssue('Malformed source headers omitted.');
        continue;
      }
      const name = selectedNames.get(header.name.toLowerCase());
      if (!name) continue;
      if (typeof header.value !== 'string') {
        metadataIssue('Malformed source headers omitted.');
        continue;
      }
      const size = Buffer.byteLength(name) + Buffer.byteLength(header.value);
      if (result.headers.length >= 64 || headerBytes + size > 16384) {
        metadataIssue('Source header limit exceeded; entries omitted.');
        continue;
      }
      result.headers.push({ name, value: header.value });
      headerBytes += size;
    }
  }
  const pending: { part: unknown; depth: number }[] = [{ part: source?.payload, depth: 0 }];
  const texts: string[] = [];
  let bytes = 0;
  let visited = 0;
  while (pending.length) {
    const { part: value, depth } = pending.pop()!;
    if (++visited > 64 || depth > 8) {
      result.issues.push('MIME structure limit exceeded.');
      result.truncated = true;
      break;
    }
    const part = object(value);
    if (!part) continue;
    const body = object(part.body);
    if (part.filename || body?.attachmentId) {
      result.issues.push('Attachments are not decoded.');
      continue;
    }
    if (Array.isArray(part.parts)) {
      if (part.parts.length > 64) {
        result.issues.push('MIME part limit exceeded.');
        result.truncated = true;
        break;
      }
      for (const nested of part.parts.toReversed()) pending.push({ part: nested, depth: depth + 1 });
    }
    if (part.mimeType !== 'text/plain') continue;
    const headers = Array.isArray(part.headers) ? part.headers : [];
    const contentType = headers
      .map(object)
      .find(header => String(header?.name).toLowerCase() === 'content-type')?.value;
    if (typeof contentType === 'string' && /charset\s*=\s*["']?(?!utf-?8\b|us-ascii\b)[a-z0-9-]+/i.test(contentType)) {
      result.issues.push('Unsupported text charset.');
      continue;
    }
    const encoded = body?.data;
    if (typeof encoded !== 'string') {
      result.issues.push('Plain-text body is unavailable.');
      continue;
    }
    if (encoded.length > 87384) {
      result.issues.push('Text exceeds the 65536-byte limit.');
      result.truncated = true;
      continue;
    }
    try {
      if (
        !/^[A-Za-z0-9_-]*={0,2}$/.test(encoded) ||
        encoded.replace(/=+$/, '').length % 4 === 1 ||
        (encoded.includes('=') && encoded.length % 4 !== 0)
      )
        throw Error();
      const decoded = Buffer.from(encoded, 'base64url');
      if (decoded.toString('base64url') !== encoded.replace(/=+$/, '')) throw Error();
      bytes += decoded.length + (texts.length ? 2 : 0);
      if (bytes > 65536) {
        result.issues.push('Text exceeds the 65536-byte limit.');
        result.truncated = true;
        continue;
      }
      texts.push(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
    } catch {
      result.issues.push('Malformed base64url or UTF-8 text.');
    }
  }
  result.text = texts.join('\n\n');
  result.status = result.truncated
    ? 'truncated'
    : result.issues.length
      ? 'partial'
      : texts.length
        ? 'complete'
        : 'unsupported';
  if (!texts.length)
    result.issues.push('No supported full plain-text body is available. A snippet is insufficient for a full review.');
  return result;
}

export const connectedContentProcessor = {
  id: 'connected-content',
  processToolResult({ toolName, toolCallId, args, result, messageList }) {
    if (toolName !== 'google_mail_get_message') return;
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId,
        toolName,
        args,
        result: normalizeMail(result),
      },
    });
    return messageList;
  },
} satisfies Processor;
