import type { SerializedSandboxTemplate } from '@mastra/core/workspace';
import type { PlatformClientOptions } from './client.js';
import { PlatformClient } from './client.js';

export type PlatformTemplateStatus = 'queued' | 'building' | 'ready' | 'failed';

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_WAIT_TIMEOUT_MS = 15 * 60_000;
const MIN_POLL_INTERVAL_MS = 100;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export interface PlatformTemplateBuild {
  templateId: string;
  status: PlatformTemplateStatus;
  error?: string | null;
}

export interface BuildPlatformTemplateInput {
  environmentId: string;
  definition: SerializedSandboxTemplate;
}

export interface GetPlatformTemplateInput {
  environmentId: string;
  templateId: string;
  signal?: AbortSignal;
}

export interface WaitForPlatformTemplateInput extends GetPlatformTemplateInput {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class PlatformTemplateBuildError extends Error {
  readonly template: PlatformTemplateBuild;

  constructor(template: PlatformTemplateBuild) {
    super(template.error ? `Sandbox template build failed: ${template.error}` : 'Sandbox template build failed');
    this.name = 'PlatformTemplateBuildError';
    this.template = template;
  }
}

export class PlatformTemplateBuildTimeoutError extends Error {
  readonly templateId: string;
  readonly timeoutMs: number;

  constructor(templateId: string, timeoutMs: number) {
    super(`Sandbox template ${templateId} was not ready within ${timeoutMs}ms`);
    this.name = 'PlatformTemplateBuildTimeoutError';
    this.templateId = templateId;
    this.timeoutMs = timeoutMs;
  }
}

export class PlatformTemplateClient {
  private readonly client: PlatformClient;

  constructor(options: PlatformClientOptions = {}) {
    this.client = new PlatformClient(options);
  }

  async build(input: BuildPlatformTemplateInput): Promise<PlatformTemplateBuild> {
    const response = await this.client.requestProvider('/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        environmentId: input.environmentId,
        definition: input.definition,
      }),
    });
    return readTemplateBuild(response);
  }

  async get(input: GetPlatformTemplateInput): Promise<PlatformTemplateBuild> {
    const response = await this.client.requestProvider(`/templates/${encodeURIComponent(input.templateId)}`, {
      query: { environmentId: input.environmentId },
      signal: input.signal,
    });
    return readTemplateBuild(response);
  }

  async waitUntilReady(input: WaitForPlatformTemplateInput): Promise<PlatformTemplateBuild> {
    const intervalMs = validateDuration(
      input.intervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      'intervalMs',
      MIN_POLL_INTERVAL_MS,
    );
    const timeoutMs = validateDuration(input.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS, 'timeoutMs', 1);
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = input.signal ? AbortSignal.any([input.signal, timeoutSignal]) : timeoutSignal;

    try {
      while (true) {
        throwIfAborted(signal);
        const template = await this.get({
          environmentId: input.environmentId,
          templateId: input.templateId,
          signal,
        });
        throwIfAborted(signal);
        if (template.status === 'ready') return template;
        if (template.status === 'failed') throw new PlatformTemplateBuildError(template);

        await sleep(intervalMs, signal);
      }
    } catch (error) {
      if (input.signal?.aborted) throw abortReason(input.signal);
      if (timeoutSignal.aborted) throw new PlatformTemplateBuildTimeoutError(input.templateId, timeoutMs);
      throw error;
    }
  }
}

async function readTemplateBuild(response: Response): Promise<PlatformTemplateBuild> {
  const value = (await response.json()) as unknown;
  if (typeof value !== 'object' || value === null) throw new TypeError('Invalid sandbox template response');

  const { templateId, status, error } = value as Record<string, unknown>;
  if (typeof templateId !== 'string' || !isTemplateStatus(status)) {
    throw new TypeError('Invalid sandbox template response');
  }
  if (error !== undefined && error !== null && typeof error !== 'string') {
    throw new TypeError('Invalid sandbox template response');
  }
  return { templateId, status, ...(error !== undefined && { error: error as string | null }) };
}

function isTemplateStatus(value: unknown): value is PlatformTemplateStatus {
  return value === 'queued' || value === 'building' || value === 'ready' || value === 'failed';
}

function validateDuration(value: number, name: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_TIMER_DELAY_MS) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${MAX_TIMER_DELAY_MS}`);
  }
  return value;
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('The operation was aborted', 'AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(
        signal?.reason instanceof Error ? signal.reason : new DOMException('The operation was aborted', 'AbortError'),
      );
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
