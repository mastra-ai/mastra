import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { AgentSignalInput } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs } from '@mastra/core/processors';

const execFileAsync = promisify(execFile);

export const GITHUB_SUBSCRIBE_PR_TAG = 'github-subscribe-pr';
export const GITHUB_SYNC_STATUS_TAG = 'github-sync-status';
export const GITHUB_SIGNALS_METADATA_KEY = 'githubSignals';

export type GithubPRSubscription = {
  owner: string;
  repo: string;
  number: number;
  subscribedAt: string;
  updatedAt: string;
  lastSubscribeSignalId: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
};

export type GithubSignalsThreadMetadata = {
  subscriptions: GithubPRSubscription[];
};

export type GithubSubscribePRSignalInput = number | { owner?: string; repo?: string; number: number };

export type GithubSignalsSyncInput = {
  owner: string;
  repo: string;
  number: number;
  cwd?: string;
  abortSignal?: AbortSignal;
};

export type GithubSignalsSyncResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export type GithubSignalsSyncClient = {
  syncPullRequest(input: GithubSignalsSyncInput): Promise<GithubSignalsSyncResult>;
};

export type GithubRepository = {
  owner: string;
  repo: string;
};

export type GithubRepositoryResolver = {
  resolveRepository(input: { cwd?: string; abortSignal?: AbortSignal }): Promise<GithubRepository | undefined>;
};

export type GithubSignalsThreadStore = {
  getThreadById(input: { threadId: string; resourceId?: string }): Promise<StorageThreadType | null>;
  saveThread(input: { thread: StorageThreadType }): Promise<StorageThreadType>;
};

export type GithubSignalsOptions = {
  owner?: string;
  repo?: string;
  cwd?: string;
  syncOnSubscribe?: boolean;
  gitcrawlCommand?: string;
  syncClient?: GithubSignalsSyncClient;
  repositoryResolver?: GithubRepositoryResolver;
  threadStore?: GithubSignalsThreadStore;
};

type GithubSubscribeSignal = {
  id: string;
  owner?: string;
  repo?: string;
  number: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function getSignalMetadata(message: MastraDBMessage): Record<string, unknown> | undefined {
  if (message.role !== 'signal') return undefined;
  const signal = message.content.metadata?.signal;
  return isPlainObject(signal) ? signal : undefined;
}

function getGithubMetadata(threadMetadata: Record<string, unknown> | undefined): GithubSignalsThreadMetadata {
  const mastra = isPlainObject(threadMetadata?.mastra) ? threadMetadata.mastra : {};
  const githubSignals = isPlainObject(mastra[GITHUB_SIGNALS_METADATA_KEY]) ? mastra[GITHUB_SIGNALS_METADATA_KEY] : {};
  const rawSubscriptions = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  const subscriptions: GithubPRSubscription[] = [];

  for (const rawSubscription of rawSubscriptions) {
    if (!isPlainObject(rawSubscription)) continue;
    const owner = readString(rawSubscription.owner);
    const repo = readString(rawSubscription.repo);
    const number = readNumber(rawSubscription.number);
    const subscribedAt = readString(rawSubscription.subscribedAt);
    const updatedAt = readString(rawSubscription.updatedAt);
    const lastSubscribeSignalId = readString(rawSubscription.lastSubscribeSignalId);
    if (!owner || !repo || !number || !subscribedAt || !updatedAt || !lastSubscribeSignalId) continue;
    subscriptions.push({
      owner,
      repo,
      number,
      subscribedAt,
      updatedAt,
      lastSubscribeSignalId,
      ...(readString(rawSubscription.lastSyncAt) ? { lastSyncAt: readString(rawSubscription.lastSyncAt)! } : {}),
      ...(rawSubscription.lastSyncStatus === 'success' ||
      rawSubscription.lastSyncStatus === 'error' ||
      rawSubscription.lastSyncStatus === 'skipped'
        ? { lastSyncStatus: rawSubscription.lastSyncStatus }
        : {}),
      ...(readString(rawSubscription.lastSyncError)
        ? { lastSyncError: readString(rawSubscription.lastSyncError)! }
        : {}),
    });
  }

  return { subscriptions };
}

function setGithubMetadata(
  threadMetadata: Record<string, unknown> | undefined,
  githubSignals: GithubSignalsThreadMetadata,
): Record<string, unknown> {
  const existing = threadMetadata ?? {};
  const mastra = isPlainObject(existing.mastra) ? existing.mastra : {};

  return {
    ...existing,
    mastra: {
      ...mastra,
      [GITHUB_SIGNALS_METADATA_KEY]: githubSignals,
    },
  };
}

function parseGitHubRemoteUrl(remoteUrl: string): GithubRepository | undefined {
  const trimmed = remoteUrl.trim().replace(/\.git$/, '');
  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(trimmed);
  if (httpsMatch?.[1] && httpsMatch[2]) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+)$/.exec(trimmed);
  if (sshMatch?.[1] && sshMatch[2]) return { owner: sshMatch[1], repo: sshMatch[2] };
  return undefined;
}

export class GitRemoteRepositoryResolver implements GithubRepositoryResolver {
  async resolveRepository(input: { cwd?: string; abortSignal?: AbortSignal }): Promise<GithubRepository | undefined> {
    try {
      const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
        cwd: input.cwd,
        signal: input.abortSignal,
      });
      return parseGitHubRemoteUrl(stdout);
    } catch {
      return undefined;
    }
  }
}

export class GitcrawlSyncClient implements GithubSignalsSyncClient {
  readonly #command: string;

  constructor(options: { command?: string } = {}) {
    this.#command = options.command ?? 'gitcrawl';
  }

  async syncPullRequest(input: GithubSignalsSyncInput): Promise<GithubSignalsSyncResult> {
    try {
      const { stdout, stderr } = await execFileAsync(
        this.#command,
        [
          'sync',
          `${input.owner}/${input.repo}`,
          '--numbers',
          String(input.number),
          '--include-comments',
          '--with',
          'pr-details',
          '--json',
        ],
        {
          cwd: input.cwd,
          signal: input.abortSignal,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      return { ok: true, stdout, stderr };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class GithubSignals implements Processor<'github-signals'> {
  readonly id = 'github-signals' as const;
  readonly name = 'GitHub Signals';
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  static signals = {
    subscribeToPR(input: GithubSubscribePRSignalInput): AgentSignalInput {
      const normalized = typeof input === 'number' ? { number: input } : input;
      return {
        type: 'user',
        tagName: GITHUB_SUBSCRIBE_PR_TAG,
        contents: `Subscribe to GitHub PR #${normalized.number}`,
        attributes: {
          ...(normalized.owner ? { owner: normalized.owner } : {}),
          ...(normalized.repo ? { repo: normalized.repo } : {}),
          number: normalized.number,
        },
        metadata: {
          github: {
            action: 'subscribeToPR',
            ...normalized,
          },
        },
      };
    },
  };

  readonly #options: GithubSignalsOptions;
  readonly #syncClient: GithubSignalsSyncClient;
  readonly #repositoryResolver: GithubRepositoryResolver;

  constructor(options: GithubSignalsOptions = {}) {
    this.#options = options;
    this.#syncClient = options.syncClient ?? new GitcrawlSyncClient({ command: options.gitcrawlCommand });
    this.#repositoryResolver = options.repositoryResolver ?? new GitRemoteRepositoryResolver();
  }

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }

  async processInputStep(args: ProcessInputStepArgs) {
    if (args.stepNumber !== 0) return;

    const subscribeSignal = this.#findLatestSubscribeSignal(args.messages);
    if (!subscribeSignal) return;

    const resolvedRepository =
      subscribeSignal.owner && subscribeSignal.repo
        ? { owner: subscribeSignal.owner, repo: subscribeSignal.repo }
        : this.#options.owner && this.#options.repo
          ? { owner: this.#options.owner, repo: this.#options.repo }
          : await this.#repositoryResolver.resolveRepository({ cwd: this.#options.cwd, abortSignal: args.abortSignal });
    const owner = resolvedRepository?.owner;
    const repo = resolvedRepository?.repo;
    if (!owner || !repo) {
      await this.#sendStatus(args, subscribeSignal, {
        status: 'error',
        message: 'GitHub PR subscription requires owner and repo.',
      });
      return;
    }

    const threadStore = await this.#resolveThreadStore();
    if (!threadStore) {
      await this.#sendStatus(
        args,
        { ...subscribeSignal, owner, repo },
        {
          status: 'error',
          message: 'GitHub PR subscription requires memory-backed thread storage.',
        },
      );
      return;
    }

    const memoryContext = args.requestContext?.get('MastraMemory') as
      | { thread?: { id?: string }; resourceId?: string }
      | undefined;
    const threadId = memoryContext?.thread?.id;
    const resourceId = memoryContext?.resourceId;
    if (!threadId || !resourceId) {
      await this.#sendStatus(
        args,
        { ...subscribeSignal, owner, repo },
        {
          status: 'error',
          message: 'GitHub PR subscription requires threadId and resourceId.',
        },
      );
      return;
    }

    const loadedThread = (await threadStore.getThreadById({ threadId, resourceId })) ?? undefined;
    if (!loadedThread) {
      await this.#sendStatus(
        args,
        { ...subscribeSignal, owner, repo },
        {
          status: 'error',
          message: `Could not load thread ${threadId}.`,
        },
      );
      return;
    }

    const githubMetadata = getGithubMetadata(loadedThread.metadata);
    const existingIndex = githubMetadata.subscriptions.findIndex(
      subscription =>
        subscription.owner === owner && subscription.repo === repo && subscription.number === subscribeSignal.number,
    );
    const existing = existingIndex >= 0 ? githubMetadata.subscriptions[existingIndex] : undefined;
    if (existing?.lastSubscribeSignalId === subscribeSignal.id) return;

    const now = new Date().toISOString();
    const subscription: GithubPRSubscription = {
      owner,
      repo,
      number: subscribeSignal.number,
      subscribedAt: existing?.subscribedAt ?? now,
      updatedAt: now,
      lastSubscribeSignalId: subscribeSignal.id,
      ...(existing?.lastSyncAt ? { lastSyncAt: existing.lastSyncAt } : {}),
      ...(existing?.lastSyncStatus ? { lastSyncStatus: existing.lastSyncStatus } : {}),
      ...(existing?.lastSyncError ? { lastSyncError: existing.lastSyncError } : {}),
    };

    let syncResult: GithubSignalsSyncResult | undefined;
    if (this.#options.syncOnSubscribe !== false) {
      syncResult = await this.#syncClient.syncPullRequest({
        owner,
        repo,
        number: subscribeSignal.number,
        cwd: this.#options.cwd,
        abortSignal: args.abortSignal,
      });
      subscription.lastSyncAt = new Date().toISOString();
      subscription.lastSyncStatus = syncResult.ok ? 'success' : 'error';
      if (syncResult.error) subscription.lastSyncError = syncResult.error;
      else delete subscription.lastSyncError;
    } else {
      subscription.lastSyncStatus = 'skipped';
    }

    const subscriptions = [...githubMetadata.subscriptions];
    if (existingIndex >= 0) subscriptions[existingIndex] = subscription;
    else subscriptions.push(subscription);

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        id: threadId,
        resourceId,
        createdAt: loadedThread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setGithubMetadata(loadedThread.metadata, { subscriptions }),
      },
    });

    await this.#sendStatus(
      args,
      { ...subscribeSignal, owner, repo },
      {
        status: syncResult?.ok === false ? 'sync_error' : 'subscribed',
        message:
          syncResult?.ok === false
            ? `Subscribed to ${owner}/${repo}#${subscribeSignal.number}, but gitcrawl sync failed: ${syncResult.error}`
            : `Subscribed to ${owner}/${repo}#${subscribeSignal.number}.`,
      },
    );
  }

  async #resolveThreadStore(): Promise<GithubSignalsThreadStore | undefined> {
    if (this.#options.threadStore) return this.#options.threadStore;
    const memoryStore = await this.mastra?.getStorage()?.getStore('memory');
    return memoryStore as GithubSignalsThreadStore | undefined;
  }

  #findLatestSubscribeSignal(messages: MastraDBMessage[]): GithubSubscribeSignal | undefined {
    for (const message of [...messages].reverse()) {
      const signal = getSignalMetadata(message);
      if (!signal || signal.tagName !== GITHUB_SUBSCRIBE_PR_TAG) continue;
      const attributes = isPlainObject(signal.attributes) ? signal.attributes : {};
      const metadata = isPlainObject(signal.metadata) ? signal.metadata : {};
      const github = isPlainObject(metadata.github) ? metadata.github : {};
      const number = readNumber(attributes.number) ?? readNumber(github.number);
      if (!number) continue;
      return {
        id: readString(signal.id) ?? message.id,
        owner: readString(attributes.owner) ?? readString(github.owner),
        repo: readString(attributes.repo) ?? readString(github.repo),
        number,
      };
    }
    return undefined;
  }

  async #sendStatus(
    args: ProcessInputStepArgs,
    signal: GithubSubscribeSignal & { owner?: string; repo?: string },
    status: { status: 'subscribed' | 'sync_error' | 'error'; message: string },
  ) {
    await args.sendSignal?.({
      type: 'reactive',
      tagName: GITHUB_SYNC_STATUS_TAG,
      contents: status.message,
      attributes: {
        status: status.status,
        ...(signal.owner ? { owner: signal.owner } : {}),
        ...(signal.repo ? { repo: signal.repo } : {}),
        number: signal.number,
      },
      metadata: {
        github: {
          action: 'subscribeToPR',
          status: status.status,
          owner: signal.owner,
          repo: signal.repo,
          number: signal.number,
        },
      },
    });
  }
}
