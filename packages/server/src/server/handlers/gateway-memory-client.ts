/**
 * HTTP client for the Mastra Memory Gateway REST API.
 * Used to proxy memory operations from the local Mastra server to the remote gateway
 * when agents use `mastra/` model strings.
 */

interface GatewayThread {
  id: string;
  projectId: string;
  resourceId: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface GatewayMessage {
  id: string;
  threadId: string;
  role: string;
  content: unknown;
  type: string;
  createdAt: string;
}

interface GatewayOMRecord {
  id: string;
  scope: string;
  threadId: string | null;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  lastObservedAt: string | null;
  originType: string;
  generationCount: number;
  activeObservations: unknown;
  totalTokensObserved: number;
  observationTokenCount: number;
  pendingMessageTokens: number;
  isReflecting: boolean;
  isObserving: boolean;
  isBufferingObservation: boolean;
  isBufferingReflection: boolean;
  config?: Record<string, unknown>;
  bufferedObservationChunks?: unknown[];
  bufferedReflection?: string | null;
  bufferedReflectionTokens?: number | null;
  bufferedReflectionInputTokens?: number | null;
}

export class GatewayMemoryClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Strip trailing slashes and /v1 suffix so both URL forms resolve correctly
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1/memory';
    this.apiKey = apiKey;
  }

  private threadPath(threadId: string): string {
    return `/threads/${encodeURIComponent(threadId)}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal ?? controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...((options.headers as Record<string, string>) || {}),
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gateway API error ${res.status}: ${body}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Threads ──────────────────────────────────────────────────

  async listThreads(params: {
    resourceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ threads: GatewayThread[]; total: number }> {
    const query = new URLSearchParams();
    if (params.resourceId) query.set('resourceId', params.resourceId);
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request(`/threads${qs ? '?' + qs : ''}`);
  }

  async getThread(threadId: string): Promise<{ thread: GatewayThread } | null> {
    try {
      return await this.request(this.threadPath(threadId));
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('404')) return null;
      throw e;
    }
  }

  async createThread(params: {
    id?: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ thread: GatewayThread }> {
    return this.request('/threads', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateThread(
    threadId: string,
    params: { title?: string; metadata?: Record<string, unknown> },
  ): Promise<{ thread: GatewayThread } | null> {
    try {
      return await this.request(this.threadPath(threadId), {
        method: 'PATCH',
        body: JSON.stringify(params),
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('404')) return null;
      throw e;
    }
  }

  async deleteThread(threadId: string): Promise<{ ok: boolean }> {
    try {
      return await this.request(this.threadPath(threadId), { method: 'DELETE' });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('404')) return { ok: false };
      throw e;
    }
  }

  // ── Messages ─────────────────────────────────────────────────

  async listMessages(
    threadId: string,
    params: { limit?: number; offset?: number; order?: string },
  ): Promise<{ messages: GatewayMessage[]; total: number } | null> {
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    if (params.order) query.set('order', params.order);
    const qs = query.toString();
    try {
      return await this.request(`${this.threadPath(threadId)}/messages${qs ? '?' + qs : ''}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('404')) return null;
      throw e;
    }
  }

  // ── Observational Memory ─────────────────────────────────────

  async getObservations(threadId: string, resourceId?: string): Promise<{ observations: unknown }> {
    const query = new URLSearchParams();
    if (resourceId) query.set('resourceId', resourceId);
    const qs = query.toString();
    return this.request(`${this.threadPath(threadId)}/observations${qs ? '?' + qs : ''}`);
  }

  async getObservationRecord(threadId: string, resourceId?: string): Promise<{ record: GatewayOMRecord | null }> {
    const query = new URLSearchParams();
    if (resourceId) query.set('resourceId', resourceId);
    const qs = query.toString();
    try {
      return await this.request(`${this.threadPath(threadId)}/observations/record${qs ? '?' + qs : ''}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('404')) return { record: null };
      throw e;
    }
  }

  async getObservationHistory(
    threadId: string,
    params: { resourceId?: string; limit?: number; from?: Date; to?: Date; offset?: number },
  ): Promise<{ records: GatewayOMRecord[] }> {
    const query = new URLSearchParams();
    if (params.resourceId) query.set('resourceId', params.resourceId);
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.from) query.set('from', params.from.toISOString());
    if (params.to) query.set('to', params.to.toISOString());
    if (params.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    try {
      return await this.request(`${this.threadPath(threadId)}/observations/history${qs ? '?' + qs : ''}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('404')) return { records: [] };
      throw e;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Convert a gateway thread to the local server thread format.
 */
export function toLocalThread(gt: GatewayThread) {
  return {
    id: gt.id,
    resourceId: gt.resourceId,
    title: gt.title ?? '',
    metadata: gt.metadata ?? {},
    createdAt: new Date(gt.createdAt),
    updatedAt: new Date(gt.updatedAt),
  };
}

/**
 * Convert a gateway message to the local server message format.
 */
export function toLocalMessage(gm: GatewayMessage) {
  return {
    id: gm.id,
    threadId: gm.threadId,
    role: gm.role,
    content: gm.content,
    type: gm.type,
    createdAt: new Date(gm.createdAt),
  };
}

/**
 * Convert a gateway OM record to the local server OM record format.
 */
export function toLocalOMRecord(gr: GatewayOMRecord) {
  return {
    id: gr.id,
    scope: gr.scope as 'thread' | 'resource',
    threadId: gr.threadId,
    resourceId: gr.resourceId,
    createdAt: new Date(gr.createdAt),
    updatedAt: new Date(gr.updatedAt),
    lastObservedAt: gr.lastObservedAt ? new Date(gr.lastObservedAt) : undefined,
    originType: gr.originType as 'initial' | 'reflection' | 'observation',
    generationCount: gr.generationCount,
    activeObservations: (gr.activeObservations ?? '') as string,
    totalTokensObserved: gr.totalTokensObserved,
    observationTokenCount: gr.observationTokenCount,
    pendingMessageTokens: gr.pendingMessageTokens,
    isReflecting: gr.isReflecting,
    isObserving: gr.isObserving,
    isBufferingObservation: gr.isBufferingObservation,
    isBufferingReflection: gr.isBufferingReflection,
    config: gr.config ?? {},
    bufferedObservationChunks: gr.bufferedObservationChunks ?? [],
    bufferedReflection: gr.bufferedReflection ?? undefined,
    bufferedReflectionTokens: gr.bufferedReflectionTokens ?? undefined,
    bufferedReflectionInputTokens: gr.bufferedReflectionInputTokens ?? undefined,
  };
}

// Singleton-ish lazy instance
let _gatewayClient: GatewayMemoryClient | null | undefined;

/**
 * Get a GatewayMemoryClient instance, or null if gateway is not configured.
 */
export function getGatewayClient(): GatewayMemoryClient | null {
  if (_gatewayClient !== undefined) return _gatewayClient;
  const url = process.env.MASTRA_GATEWAY_URL || 'https://gateway-api.mastra.ai';
  const key = process.env.MASTRA_GATEWAY_API_KEY;
  if (!key) {
    _gatewayClient = null;
    return null;
  }
  _gatewayClient = new GatewayMemoryClient(url, key);
  return _gatewayClient;
}

/**
 * Check if an agent uses a gateway model (mastra/ prefix).
 * Sync version — can only check agent.model string directly.
 */

export function isGatewayAgent(agent: any): boolean {
  if (!agent) return false;
  try {
    const agentAny = agent as Record<string, unknown>;
    if (typeof agentAny.model === 'string' && agentAny.model.startsWith('mastra/')) {
      return true;
    }
  } catch {
    // Ignore errors during detection
  }
  return false;
}

/**
 * Async version of isGatewayAgent that can await getLLM().
 * Checks multiple paths to detect if an agent uses a mastra/ gateway model:
 * 1. agent.model as raw string (most reliable for directly configured agents)
 * 2. Resolved LLM's underlying ModelRouterLanguageModel config.routerId
 * 3. Resolved LLM's getModel() to access the router's config
 */

export async function isGatewayAgentAsync(agent: any): Promise<boolean> {
  if (!agent) return false;
  try {
    const agentAny = agent as Record<string, unknown>;

    // Check 1: agent.model is a raw string like 'mastra/openai/gpt-5-mini'
    if (typeof agentAny.model === 'string' && agentAny.model.startsWith('mastra/')) {
      return true;
    }

    // Check 2: Resolve the LLM and check the router's config.routerId
    // llm.getModelId() returns stripped ID (e.g., 'gpt-5-mini'), so we need
    // to access the underlying ModelRouterLanguageModel's config.routerId
    if (typeof agent.getLLM === 'function') {
      const llm = await Promise.resolve(agent.getLLM({}));
      if (llm) {
        // Try to access the underlying model's routerId via getModel()
        const llmAny = llm as Record<string, unknown>;
        if (typeof llmAny.getModel === 'function') {
          const underlyingModel = (llmAny as { getModel: () => unknown }).getModel();
          const modelAny = underlyingModel as Record<string, unknown>;
          // ModelRouterLanguageModel stores routerId in private config
          if (modelAny?.config && typeof modelAny.config === 'object') {
            const routerId = (modelAny.config as Record<string, unknown>).routerId;
            if (typeof routerId === 'string' && routerId.startsWith('mastra/')) {
              return true;
            }
          }
        }
      }
    }
  } catch {
    // Detection failed — not a gateway agent
  }
  return false;
}
