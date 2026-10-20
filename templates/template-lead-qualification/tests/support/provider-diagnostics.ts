import { createHash } from 'node:crypto';

const statusValues = new Set(['queued', 'in_progress', 'searching', 'completed', 'failed', 'incomplete', 'cancelled']);
function status(value: unknown) {
  return typeof value === 'string' && statusValues.has(value) ? value : null;
}
function code(value: unknown) {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value) ? value : null;
}
function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function callId(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value) ? value : null;
}

/** Bounded test diagnostics: never stores response text, prompts, headers or URL paths. */
export class ProviderDiagnostics {
  readonly completed = new Set<string>();
  readonly statuses = new Map<string, Set<string>>();
  private readonly sourceHashes = new Set<string>();
  private readonly domains = new Set<string>();
  httpStatus: number | null = null;
  responseStatus: string | null = null;
  finishReason: string | null = null;
  incompleteReason: string | null = null;
  errorCode: string | null = null;
  inputTokens: number | null = null;
  outputTokens: number | null = null;
  reasoningTokens: number | null = null;
  captureFailure: string | null = null;
  constructor(
    readonly maxToolCalls: number,
    readonly maxOutputTokens: number,
    readonly sourceMetadataRequested: boolean,
    readonly structuredOutput: boolean,
  ) {}
  private source(value: unknown) {
    if (typeof value !== 'string') return;
    try {
      const url = new URL(value);
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        !/^[a-z0-9.-]+$/.test(url.hostname)
      )
        return;
      if (this.sourceHashes.size < 1000) this.sourceHashes.add(createHash('sha256').update(url.href).digest('hex'));
      if (this.domains.size < 100) this.domains.add(url.hostname);
    } catch {
      /* Invalid URL metadata is not logged. */
    }
  }
  private tool(idValue: unknown, statusValue: unknown) {
    const id = callId(idValue);
    const value = status(statusValue);
    if (!id || !value || (this.statuses.size >= 100 && !this.statuses.has(id))) return;
    const statuses = this.statuses.get(id) ?? new Set<string>();
    statuses.add(value);
    this.statuses.set(id, statuses);
    if (value === 'completed') this.completed.add(id);
  }
  private item(value: unknown) {
    const item = value as
      | {
          type?: string;
          id?: unknown;
          status?: unknown;
          action?: { url?: unknown; sources?: Array<{ type?: string; url?: unknown }> };
          content?: Array<{ annotations?: Array<{ type?: string; url?: unknown }> }>;
        }
      | undefined;
    if (item?.type === 'web_search_call') {
      this.tool(item.id, item.status);
      this.source(item.action?.url);
      for (const source of item.action?.sources ?? []) if (source.type === 'url') this.source(source.url);
    } else if (item?.type === 'message') {
      for (const content of item.content ?? [])
        for (const annotation of content.annotations ?? [])
          if (annotation.type === 'url_citation') this.source(annotation.url);
    }
  }
  observe(event: unknown) {
    const value = event as {
      type?: string;
      item?: unknown;
      item_id?: unknown;
      annotation?: { type?: string; url?: unknown };
      error?: { code?: unknown };
      response?: {
        status?: unknown;
        output?: unknown[];
        incomplete_details?: { reason?: unknown };
        error?: { code?: unknown };
        usage?: {
          input_tokens?: unknown;
          output_tokens?: unknown;
          output_tokens_details?: { reasoning_tokens?: unknown };
        };
      };
    };
    if (!value || typeof value !== 'object') return;
    this.item(value.item);
    for (const item of value.response?.output ?? []) this.item(item);
    if (value.type?.startsWith('response.web_search_call.')) this.tool(value.item_id, value.type.split('.').at(-1));
    if (value.annotation?.type === 'url_citation') this.source(value.annotation.url);
    if (value.type && ['response.completed', 'response.incomplete', 'response.failed'].includes(value.type)) {
      this.responseStatus = status(value.response?.status);
      this.finishReason = value.type.slice('response.'.length);
      this.incompleteReason = code(value.response?.incomplete_details?.reason);
    }
    this.errorCode = code(value.response?.error?.code) ?? code(value.error?.code) ?? this.errorCode;
    if (value.response?.usage) {
      this.inputTokens = count(value.response.usage.input_tokens);
      this.outputTokens = count(value.response.usage.output_tokens);
      this.reasoningTokens = count(value.response.usage.output_tokens_details?.reasoning_tokens);
    }
  }
  async capture(response: Response) {
    this.httpStatus = response.status;
    const reader = response.body?.getReader();
    if (!reader) {
      this.captureFailure = 'missing_response_body';
      return;
    }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let pending = '';
    let received = 0;
    const json = response.headers.get('content-type')?.includes('application/json');
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.byteLength;
        if (received > 1_048_576) throw new Error();
        pending += decoder.decode(chunk.value, { stream: true });
        if (json) {
          if (pending.length > 65_536) throw new Error();
          continue;
        }
        const events = pending.replaceAll('\r\n', '\n').split('\n\n');
        pending = events.pop()!;
        // A delimiter may arrive in pieces; its recognized prefix is framing, not event content.
        const framingSuffix = pending.endsWith('\n\r') ? 2 : /[\n\r]$/.test(pending) ? 1 : 0;
        if (pending.length - framingSuffix > 65_536 || events.some(event => event.length > 65_536)) throw new Error();
        for (const event of events)
          for (const line of event.split('\n')) {
            if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') this.observe(JSON.parse(line.slice(6)));
          }
      }
      pending += decoder.decode();
      if (json && pending) this.observe(JSON.parse(pending));
      else if (pending.trim()) throw new Error();
    } catch {
      this.captureFailure = 'provider_metadata_capture_failed';
    } finally {
      try {
        await reader.cancel();
      } catch {
        this.captureFailure ??= 'provider_metadata_capture_failed';
      }
      reader.releaseLock();
    }
  }
  summary() {
    return {
      httpStatus: this.httpStatus,
      maxToolCalls: this.maxToolCalls,
      maxOutputTokens: this.maxOutputTokens,
      sourceMetadataRequested: this.sourceMetadataRequested,
      structuredOutput: this.structuredOutput,
      completedCount: this.completed.size,
      calls: [...this.statuses].map(([id, statuses]) => ({ id, statuses: [...statuses] })),
      responseStatus: this.responseStatus,
      finishReason: this.finishReason,
      incompleteReason: this.incompleteReason,
      errorCode: this.errorCode,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      reasoningTokens: this.reasoningTokens,
      urlCount: this.sourceHashes.size,
      sourceDomains: [...this.domains].sort(),
      captureFailure: this.captureFailure,
    };
  }
}
