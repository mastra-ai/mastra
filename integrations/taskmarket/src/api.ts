/**
 * Taskmarket REST client (read-only surfaces).
 *
 * All monetary values on the Taskmarket API are integer strings in base
 * units (USDC = value / 1_000_000). The API supports `minReward` (base
 * units) and `mode` as server-side filters.
 */

const DEFAULT_API_URL = 'https://api.taskmarket.dev/api';
const USDC_DECIMALS = 1_000_000;
const READ_TIMEOUT_MS = 30_000;

export type TaskmarketApiOptions = {
  /** Override the Taskmarket API base URL. Defaults to the public API. */
  apiUrl?: string;
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecordArray = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.tasks)) return value.tasks.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.submissions)) return value.submissions.filter(isRecord);
  return [];
};

const optionalString = (value: unknown): string | undefined => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : undefined;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(item => String(item)) : [];

const rewardUsdcOf = (task: JsonRecord): number => {
  const reward = Number(task.reward ?? 0);
  return Number.isFinite(reward) ? reward / USDC_DECIMALS : 0;
};

export interface TaskmarketTask {
  id: string;
  description: string;
  rewardUsdc: number;
  mode: string;
  status: string;
  submissionCount: number;
  expiryTime?: string;
  tags: string[];
  requester?: string;
  requesterAgentId?: string;
  pendingActions?: unknown;
}

const compactTask = (task: JsonRecord): TaskmarketTask => ({
  id: optionalString(task.id) ?? '',
  description: optionalString(task.description) ?? '',
  rewardUsdc: rewardUsdcOf(task),
  mode: optionalString(task.mode) ?? 'bounty',
  status: optionalString(task.status) ?? 'open',
  submissionCount: Number(task.submissionCount ?? 0),
  expiryTime: optionalString(task.expiryTime),
  tags: stringList(task.tags),
  requester: optionalString(task.requester),
  requesterAgentId: optionalString(task.requesterAgentId),
  pendingActions: task.pendingActions ?? undefined,
});

export interface TaskmarketSubmission {
  id: string;
  workerAddress?: string;
  submittedAt?: string;
  deliverableUrl?: string;
  deliverableHash?: string;
}

const compactSubmission = (submission: JsonRecord): TaskmarketSubmission => ({
  id: optionalString(submission.id) ?? '',
  workerAddress: optionalString(submission.workerAddress),
  submittedAt: optionalString(submission.submittedAt),
  deliverableUrl: optionalString(submission.fileUrl),
  deliverableHash: optionalString(submission.deliverableHash),
});

async function fetchJson(url: string, timeoutMs = READ_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Taskmarket API responded with HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

export interface ListTasksParams {
  limit?: number;
  minRewardUsdc?: number;
  maxRewardUsdc?: number;
  mode?: string;
}

export class TaskmarketClient {
  private readonly apiUrl: string;

  constructor(options: TaskmarketApiOptions = {}) {
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  }

  /**
   * List open tasks. Supported filters (mode, minRewardUsdc) are pushed to
   * the API; a superset is fetched when any filter is active so the
   * client-side post-filter never starves the results.
   */
  async listTasks(params: ListTasksParams = {}) {
    const limit = Math.min(params.limit ?? 20, 100);
    const filtering =
      params.mode !== undefined ||
      params.minRewardUsdc !== undefined ||
      params.maxRewardUsdc !== undefined;
    const query = new URLSearchParams({ status: 'open', sort: 'newest' });
    query.set('limit', String(filtering ? 100 : limit));
    if (params.mode) query.set('mode', params.mode);
    if (params.minRewardUsdc !== undefined) {
      // Round to whole base units: fractional USDC (e.g. 0.3) multiplied by
      // 1e6 loses integer precision in float and would not match the API's
      // integer base-unit string format.
      query.set('minReward', String(Math.round(params.minRewardUsdc * USDC_DECIMALS)));
    }
    const payload = await fetchJson(`${this.apiUrl}/tasks?${query.toString()}`);
    const tasks = toRecordArray(payload)
      .map(compactTask)
      .filter(task => {
        if (params.mode && task.mode !== params.mode) return false;
        if (params.minRewardUsdc !== undefined && task.rewardUsdc < params.minRewardUsdc) return false;
        if (params.maxRewardUsdc !== undefined && task.rewardUsdc > params.maxRewardUsdc) return false;
        return true;
      })
      .slice(0, limit);
    return { network: 'base', count: tasks.length, tasks };
  }

  /** Fetch the full details of a single task by ID. */
  async getTask(taskId: string) {
    const payload = await fetchJson(`${this.apiUrl}/tasks/${encodeURIComponent(taskId)}`);
    if (!isRecord(payload)) {
      throw new Error('Taskmarket returned an unexpected response for this task.');
    }
    return { network: 'base', task: compactTask(payload) };
  }

  /** List the submissions on a task, for human review only. */
  async listSubmissions(taskId: string) {
    const payload = await fetchJson(
      `${this.apiUrl}/tasks/${encodeURIComponent(taskId)}/submissions`,
    );
    const submissions = toRecordArray(payload).map(compactSubmission);
    return {
      taskId,
      count: submissions.length,
      submissions,
      reviewNote:
        'Present these submissions to a human requester for review. Do not accept or reject any submission automatically.',
    };
  }
}
