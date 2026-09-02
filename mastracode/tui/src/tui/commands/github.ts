import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { GITHUB_SIGNALS_METADATA_KEY } from '@mastra/github-signals';
import type { GithubPRSignalInput, GithubSubscriptionMode } from '@mastra/github-signals';
import { GithubPRPickerDialog, githubPRId } from '../components/github-pr-picker.js';
import type { GithubPRPickerItem } from '../components/github-pr-picker.js';
import { askModalQuestion } from '../modal-question.js';
import { showModalOverlay } from '../overlay.js';
import type { SlashCommandContext } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatLocalTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true,
  }).format(date);
}

function formatPollInterval(value: number): string {
  if (value % 60_000 === 0) return `${value / 60_000}m`;
  return `${Math.round(value / 1000)}s`;
}

const GITHUB_USAGE =
  'Usage: /github subscribe <PR> [--mode review|working], /github <PR> [--mode review|working], /github unsubscribe <PR>, /github sync, or /github debug. <PR> can be 123, owner/repo#123, or a GitHub pull request URL.';

function parseGithubPRReference(input: string): GithubPRSignalInput | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const numberOnly = /^#?(\d+)$/.exec(trimmed);
  if (numberOnly?.[1]) return Number(numberOnly[1]);

  const repoReference = /^(?:https:\/\/github\.com\/)?([^\s/#]+)\/([^\s/#]+)(?:\/pull\/|#)(\d+)$/.exec(trimmed);
  if (repoReference?.[1] && repoReference[2] && repoReference[3]) {
    return { owner: repoReference[1], repo: repoReference[2], number: Number(repoReference[3]) };
  }

  return undefined;
}

function extractGithubSubscriptionMode(
  args: string[],
  action: 'subscribe' | 'unsubscribe',
): { referenceArgs: string[]; mode: GithubSubscriptionMode } | { error: string } {
  if (args.some(arg => arg.startsWith('--mode='))) {
    return {
      error: `Use the spaced form --mode review or --mode working; --mode=... is not supported. ${GITHUB_USAGE}`,
    };
  }

  const modeIndexes = args.flatMap((arg, index) => (arg === '--mode' ? [index] : []));
  if (modeIndexes.length > 1) return { error: `Specify --mode only once. ${GITHUB_USAGE}` };
  if (modeIndexes.length === 0) return { referenceArgs: args, mode: 'working' };
  if (action === 'unsubscribe') return { error: `--mode applies only when subscribing. ${GITHUB_USAGE}` };

  const modeIndex = modeIndexes[0]!;
  const mode = args[modeIndex + 1];
  if (!mode) return { error: `Missing value for --mode. Use review or working. ${GITHUB_USAGE}` };
  if (mode !== 'review' && mode !== 'working') {
    return { error: `Unknown GitHub subscription mode "${mode}". Use review or working. ${GITHUB_USAGE}` };
  }

  return {
    referenceArgs: args.filter((_, index) => index !== modeIndex && index !== modeIndex + 1),
    mode,
  };
}

function normalizeGithubSubscriptionMode(value: unknown): GithubSubscriptionMode {
  return value === 'review' ? 'review' : 'working';
}

function subscriptionToPickerItem(subscription: { owner?: string; repo?: string; number: number }): GithubPRPickerItem {
  return {
    ...(subscription.owner ? { owner: subscription.owner } : {}),
    ...(subscription.repo ? { repo: subscription.repo } : {}),
    number: subscription.number,
  };
}

async function getCurrentGithubThread(ctx: SlashCommandContext): Promise<{
  threadId?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}> {
  const session = ctx.state.session as unknown as {
    identity?: {
      getResourceId?: () => string | undefined;
    };
    thread?: {
      getId?: () => string | undefined;
      list?: (input?: {
        allResources?: boolean;
      }) => Promise<Array<{ id: string; resourceId?: string; metadata?: Record<string, unknown> }>>;
    };
  };
  const threadId = session?.thread?.getId?.();
  if (!threadId) return {};

  const thread = (await session?.thread?.list?.({ allResources: true }))?.find(item => item.id === threadId);
  return {
    threadId,
    resourceId: thread?.resourceId ?? session?.identity?.getResourceId?.(),
    metadata: thread?.metadata,
  };
}

type GithubSubscriptionReference = {
  owner?: string;
  repo?: string;
  number: number;
};

function githubPRMatchesSubscription(pr: GithubPRPickerItem, subscription: GithubSubscriptionReference): boolean {
  if (pr.number !== subscription.number) return false;
  if (!subscription.owner || !subscription.repo) return true;
  return pr.owner === subscription.owner && pr.repo === subscription.repo;
}

function getGithubSubscriptionsFromThreadMetadata(
  metadata: Record<string, unknown> | undefined,
): GithubSubscriptionReference[] {
  const mastra = isPlainObject(metadata?.mastra) ? metadata.mastra : {};
  const rawGithubSignals = mastra[GITHUB_SIGNALS_METADATA_KEY];
  const githubSignals = isPlainObject(rawGithubSignals) ? rawGithubSignals : {};
  const subscriptions: unknown[] = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  return subscriptions.flatMap(subscription => {
    if (!isPlainObject(subscription) || typeof subscription.number !== 'number') return [];
    return [
      {
        ...(typeof subscription.owner === 'string' ? { owner: subscription.owner } : {}),
        ...(typeof subscription.repo === 'string' ? { repo: subscription.repo } : {}),
        number: subscription.number,
      },
    ];
  });
}

async function describeGithubSubscriptions(ctx: SlashCommandContext): Promise<string> {
  const { threadId, resourceId, metadata } = await getCurrentGithubThread(ctx);
  if (!threadId) return 'GitHub Signals debug: no current thread.';

  const thread = { resourceId, metadata };
  const mastra = isPlainObject(thread?.metadata?.mastra) ? thread.metadata.mastra : {};
  const rawGithubSignals = mastra[GITHUB_SIGNALS_METADATA_KEY];
  const githubSignals = isPlainObject(rawGithubSignals) ? rawGithubSignals : {};
  const subscriptions: unknown[] = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  if (subscriptions.length === 0) return `GitHub Signals debug for ${threadId}: no subscribed PRs.`;

  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  const pollingActive = thread?.resourceId
    ? (githubSignalsProcessor?.isPollingThread({ threadId, resourceId: thread.resourceId }) ?? false)
    : false;
  const pollIntervalMs = githubSignalsProcessor?.getPollIntervalMs?.();
  const header = `GitHub Signals debug for ${threadId}: ${subscriptions.length} subscription${subscriptions.length === 1 ? '' : 's'}, polling=${pollingActive ? 'active' : 'inactive'}${pollIntervalMs ? `, interval=${formatPollInterval(pollIntervalMs)}` : ''}`;

  const lines = subscriptions.map(subscription => {
    if (!isPlainObject(subscription)) return '- invalid subscription metadata';
    const pr = `${subscription.owner}/${subscription.repo}#${subscription.number}`;
    const mode = `mode=${normalizeGithubSubscriptionMode(subscription.mode)}`;
    const sync = subscription.lastSyncStatus ? `sync=${subscription.lastSyncStatus}` : 'sync=unknown';
    const poll = subscription.lastSyncAt
      ? `lastPoll=${formatLocalTimestamp(subscription.lastSyncAt)}`
      : 'lastPoll=never';
    const observed = [
      subscription.lastObservedGithubUpdatedAt
        ? `githubUpdated=${formatLocalTimestamp(subscription.lastObservedGithubUpdatedAt)}`
        : undefined,
      subscription.lastObservedState ? `state=${subscription.lastObservedState}` : undefined,
      subscription.lastObservedCiState ? `ci=${subscription.lastObservedCiState}` : undefined,
      subscription.lastObservedMergeableState ? `merge=${subscription.lastObservedMergeableState}` : undefined,
      subscription.lastObservedReviewStateHash ? `reviews=${subscription.lastObservedReviewStateHash}` : undefined,
    ].filter(Boolean);
    const notificationTime = formatLocalTimestamp(subscription.lastNotificationAt) ?? 'unknown time';
    const notification = subscription.lastNotificationKind
      ? `lastNotification=${subscription.lastNotificationKind}/${subscription.lastNotificationPriority ?? 'unknown'} at ${notificationTime}: ${subscription.lastNotificationSummary ?? ''}`
      : 'lastNotification=none';
    return `- ${pr} ${mode} ${sync} ${poll}${subscription.lastSyncError ? ` error=${subscription.lastSyncError}` : ''}${subscription.lastSnapshotError ? ` snapshotError=${subscription.lastSnapshotError}` : ''}${observed.length ? ` (${observed.join(', ')})` : ''}\n  ${notification}`;
  });
  return [header, ...lines].join('\n');
}

async function syncGithubSubscriptions(ctx: SlashCommandContext): Promise<void> {
  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  if (!githubSignalsProcessor?.syncThreadNow) {
    ctx.showError('GitHub signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  const { threadId, resourceId } = await getCurrentGithubThread(ctx);
  if (!threadId || !resourceId) {
    ctx.showError('GitHub sync requires a current thread.');
    return;
  }

  try {
    const count = await githubSignalsProcessor.syncThreadNow({ threadId, resourceId });
    if (count === 0) {
      ctx.showInfo('No GitHub PR subscriptions to sync.');
    }
  } catch (error) {
    ctx.showError(`Failed to sync GitHub PR subscriptions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function execGh(ctx: SlashCommandContext, args: string[]): Promise<string> {
  const { execFile } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    execFile('gh', args, { cwd: ctx.state.projectInfo.rootPath, timeout: 15_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message || error)));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function detectCurrentPullRequest(ctx: SlashCommandContext): Promise<string> {
  try {
    return await execGh(ctx, ['pr', 'view', '--json', 'url', '--jq', '.url']);
  } catch {
    return '';
  }
}

async function resolveCurrentGithubRepo(ctx: SlashCommandContext): Promise<{ owner: string; repo: string }> {
  const raw = await execGh(ctx, ['repo', 'view', '--json', 'owner,name']);
  const parsed = JSON.parse(raw) as { owner?: { login?: string } | string; name?: string };
  const owner = typeof parsed.owner === 'string' ? parsed.owner : parsed.owner?.login;
  if (!owner || !parsed.name) throw new Error('Could not resolve current GitHub repository.');
  return { owner, repo: parsed.name };
}

function parseGhPRList(raw: string, repo: { owner: string; repo: string }): GithubPRPickerItem[] {
  const items = JSON.parse(raw) as Array<Record<string, unknown>>;
  return items.flatMap(item => {
    if (typeof item.number !== 'number') return [];
    const author = isPlainObject(item.author) && typeof item.author.login === 'string' ? item.author.login : undefined;
    return [
      {
        owner: repo.owner,
        repo: repo.repo,
        number: item.number,
        ...(typeof item.title === 'string' ? { title: item.title } : {}),
        ...(author ? { author } : {}),
        ...(typeof item.updatedAt === 'string' ? { updatedAt: item.updatedAt } : {}),
        ...(typeof item.url === 'string' ? { url: item.url } : {}),
        ...(typeof item.headRefName === 'string' ? { headRefName: item.headRefName } : {}),
        ...(typeof item.baseRefName === 'string' ? { baseRefName: item.baseRefName } : {}),
      },
    ];
  });
}

async function discoverGithubPullRequests(ctx: SlashCommandContext): Promise<{
  mine: GithubPRPickerItem[];
  search: GithubPRPickerItem[];
  errorMessage?: string;
}> {
  try {
    const repo = await resolveCurrentGithubRepo(ctx);
    const jsonFields = 'number,title,author,updatedAt,url,headRefName,baseRefName';
    const [authored, assigned, search] = await Promise.allSettled([
      execGh(ctx, ['pr', 'list', '--state', 'open', '--author', '@me', '--limit', '50', '--json', jsonFields]),
      execGh(ctx, ['pr', 'list', '--state', 'open', '--assignee', '@me', '--limit', '50', '--json', jsonFields]),
      execGh(ctx, ['pr', 'list', '--state', 'open', '--limit', '50', '--json', jsonFields]),
    ]);
    const mineById = new Map<string, GithubPRPickerItem>();
    for (const result of [authored, assigned]) {
      if (result.status !== 'fulfilled') continue;
      for (const pr of parseGhPRList(result.value, repo)) mineById.set(githubPRId(pr), pr);
    }
    const errors: string[] = [];
    if (authored.status === 'rejected' && assigned.status === 'rejected') {
      errors.push(authored.reason instanceof Error ? authored.reason.message : String(authored.reason));
    }
    if (search.status === 'rejected') {
      errors.push(
        `GitHub repository search failed: ${search.reason instanceof Error ? search.reason.message : String(search.reason)}`,
      );
    }
    return {
      mine: [...mineById.values()],
      search: search.status === 'fulfilled' ? parseGhPRList(search.value, repo) : [],
      ...(errors.length > 0 ? { errorMessage: errors.join('\n') } : {}),
    };
  } catch (error) {
    return {
      mine: [],
      search: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function pickGithubPullRequests(
  ctx: SlashCommandContext,
  input: {
    pullRequests: GithubPRPickerItem[];
    searchPullRequests?: GithubPRPickerItem[];
    subscribedIds?: Set<string>;
    title: string;
    errorMessage?: string;
  },
): Promise<GithubPRPickerItem[] | null> {
  return new Promise(resolve => {
    const picker = new GithubPRPickerDialog({
      tui: ctx.state.ui,
      pullRequests: input.pullRequests,
      searchPullRequests: input.searchPullRequests,
      subscribedIds: input.subscribedIds,
      title: input.title,
      errorMessage: input.errorMessage,
      onConfirm: pullRequests => {
        ctx.state.ui.hideOverlay();
        resolve(pullRequests);
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve(null);
      },
    });
    showModalOverlay(ctx.state.ui, picker, { maxHeight: '80%' });
    picker.focused = true;
  });
}

function pickGithubPullRequestsWhileLoading(
  ctx: SlashCommandContext,
  input: {
    subscribedIds?: Set<string>;
    title: string;
    loadingMessage: string;
    loadPullRequests: Promise<{ mine: GithubPRPickerItem[]; search: GithubPRPickerItem[]; errorMessage?: string }>;
  },
): Promise<GithubPRPickerItem[] | null> {
  return new Promise(resolve => {
    let active = true;
    const picker = new GithubPRPickerDialog({
      tui: ctx.state.ui,
      pullRequests: [],
      searchPullRequests: [],
      subscribedIds: input.subscribedIds,
      title: input.title,
      loadingMessage: input.loadingMessage,
      onConfirm: pullRequests => {
        active = false;
        ctx.state.ui.hideOverlay();
        resolve(pullRequests);
      },
      onCancel: () => {
        active = false;
        ctx.state.ui.hideOverlay();
        resolve(null);
      },
    });
    showModalOverlay(ctx.state.ui, picker, { maxHeight: '80%' });
    picker.focused = true;

    input.loadPullRequests
      .then(discovered => {
        if (!active) return;
        if (discovered.errorMessage) ctx.showError(`GitHub PR discovery failed: ${discovered.errorMessage}`);
        picker.setPullRequests({
          mine: discovered.mine,
          search: discovered.search,
          errorMessage: discovered.errorMessage,
        });
      })
      .catch(error => {
        if (!active) return;
        const errorMessage = error instanceof Error ? error.message : String(error);
        ctx.showError(`GitHub PR discovery failed: ${errorMessage}`);
        picker.setPullRequests({ mine: [], search: [], errorMessage });
      });
  });
}

async function runGithubPROperations(
  ctx: SlashCommandContext,
  action: 'subscribe' | 'unsubscribe',
  pullRequests: GithubPRPickerItem[],
  mode: GithubSubscriptionMode = 'working',
): Promise<void> {
  const currentThread = await getCurrentGithubThread(ctx);
  if (!currentThread.threadId || !currentThread.resourceId) {
    ctx.showError(`GitHub ${action} requires a current thread.`);
    return;
  }

  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  if (!githubSignalsProcessor) {
    ctx.showError('GitHub signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  const results = [] as Array<{
    owner: string;
    repo: string;
    number: number;
    mode?: GithubSubscriptionMode;
    removed?: boolean;
    terminalState?: 'closed' | 'merged';
    error?: string;
  }>;
  for (const pr of pullRequests) {
    try {
      const result =
        action === 'unsubscribe'
          ? await githubSignalsProcessor.unsubscribeThreadFromPR({
              threadId: currentThread.threadId,
              resourceId: currentThread.resourceId,
              pr: { owner: pr.owner, repo: pr.repo, number: pr.number },
            })
          : await githubSignalsProcessor.subscribeThreadToPR({
              threadId: currentThread.threadId,
              resourceId: currentThread.resourceId,
              pr: { owner: pr.owner, repo: pr.repo, number: pr.number },
              mode,
            });
      results.push(result);
    } catch (error) {
      results.push({
        owner: pr.owner ?? '',
        repo: pr.repo ?? '',
        number: pr.number,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (results.length === 1) {
    const result = results[0]!;
    const label = githubPRId(result);
    if (result.error) {
      ctx.showError(`Failed to ${action} GitHub PR ${label}: ${result.error}`);
      return;
    }
    if (action === 'subscribe' && result.terminalState) {
      ctx.showInfo(
        `Not subscribed to ${label} in ${normalizeGithubSubscriptionMode(result.mode)} mode because it is already ${result.terminalState}.`,
      );
      return;
    }
    const prefix =
      action === 'unsubscribe' ? (result.removed ? 'Unsubscribed from' : 'No subscription found for') : 'Subscribed to';
    const suffix = action === 'subscribe' ? ` in ${normalizeGithubSubscriptionMode(result.mode)} mode` : '';
    ctx.showInfo(`${prefix} ${label}${suffix}.`);
    return;
  }

  const details = results.map(result => {
    const label = githubPRId(result);
    if (result.error) return `${label}: failed (${result.error})`;
    if (action === 'subscribe' && result.terminalState) return `${label}: skipped (${result.terminalState})`;
    if (action === 'unsubscribe') return `${label}: ${result.removed ? 'unsubscribed' : 'not subscribed'}`;
    return `${label}: subscribed`;
  });
  ctx.showInfo(`GitHub PR batch complete: ${details.join('; ')}.`);
}

async function subscribeWithPicker(ctx: SlashCommandContext): Promise<void> {
  const currentThread = await getCurrentGithubThread(ctx);
  const subscriptions = getGithubSubscriptionsFromThreadMetadata(currentThread.metadata);
  const selected = await pickGithubPullRequestsWhileLoading(ctx, {
    title: 'Subscribe to GitHub PRs',
    subscribedIds: new Set(subscriptions.map(githubPRId)),
    loadingMessage: 'Loading GitHub PRs…',
    loadPullRequests: discoverGithubPullRequests(ctx),
  });
  if (!selected || selected.length === 0) return;

  const newSelections = selected.filter(
    pr => !subscriptions.some(subscription => githubPRMatchesSubscription(pr, subscription)),
  );
  if (newSelections.length === 0) {
    ctx.showInfo('No new GitHub PR subscriptions selected.');
    return;
  }
  await runGithubPROperations(ctx, 'subscribe', newSelections);
}

async function unsubscribeWithPicker(ctx: SlashCommandContext): Promise<void> {
  const currentThread = await getCurrentGithubThread(ctx);
  const subscriptions = getGithubSubscriptionsFromThreadMetadata(currentThread.metadata);
  const items = subscriptions.map(subscriptionToPickerItem);
  if (items.length === 0) {
    ctx.showInfo('No GitHub PR subscriptions to unsubscribe.');
    return;
  }
  const selected = await pickGithubPullRequests(ctx, {
    title: 'Unsubscribe from GitHub PRs',
    pullRequests: items,
    subscribedIds: new Set(),
  });
  if (!selected || selected.length === 0) return;
  await runGithubPROperations(ctx, 'unsubscribe', selected);
}

async function unsubscribeAll(ctx: SlashCommandContext): Promise<void> {
  const currentThread = await getCurrentGithubThread(ctx);
  const subscriptions = getGithubSubscriptionsFromThreadMetadata(currentThread.metadata);
  const items = subscriptions.map(subscriptionToPickerItem);
  if (items.length === 0) {
    ctx.showInfo('No GitHub PR subscriptions to unsubscribe.');
    return;
  }
  const confirmation = await askModalQuestion(ctx.state.ui, {
    question: `Unsubscribe from all ${items.length} GitHub PR subscriptions?`,
    options: [{ label: 'Unsubscribe all' }, { label: 'Cancel' }],
    allowCustomResponse: false,
  });
  if (confirmation !== 'Unsubscribe all') return;
  await runGithubPROperations(ctx, 'unsubscribe', items);
}

async function manageGithubPollInterval(ctx: SlashCommandContext): Promise<void> {
  const currentInterval = loadSettings().signals.githubPollIntervalMs ?? 300_000;
  const currentLabel = formatPollInterval(currentInterval);
  const markCurrent = (label: string, description: string) =>
    label === currentLabel ? `${description} (current)` : description;
  const answer = await askModalQuestion(ctx.state.ui, {
    question: `GitHub polling interval (current: ${currentLabel})`,
    options: [
      { label: '30s', description: markCurrent('30s', 'Check every 30 seconds') },
      { label: '1m', description: markCurrent('1m', 'Check every minute') },
      { label: '2m', description: markCurrent('2m', 'Check every two minutes') },
      { label: '5m', description: markCurrent('5m', 'Check every five minutes') },
      {
        label: 'Custom',
        description: `Enter seconds${['30s', '1m', '2m', '5m'].includes(currentLabel) ? '' : ' (current)'}`,
      },
    ],
    allowCustomResponse: false,
    selectedOptionLabel: ['30s', '1m', '2m', '5m'].includes(currentLabel) ? currentLabel : 'Custom',
  });
  if (!answer) return;

  const intervalMap: Record<string, number> = { '30s': 30_000, '1m': 60_000, '2m': 120_000, '5m': 300_000 };
  let interval = intervalMap[answer];
  if (answer === 'Custom') {
    const custom = await askModalQuestion(ctx.state.ui, {
      question: `GitHub polling interval in seconds (minimum 10, current: ${currentLabel})`,
      defaultValue: String(Math.round(currentInterval / 1000)),
    });
    if (custom === null) return;
    const seconds = Number(custom.trim());
    if (!Number.isFinite(seconds) || seconds < 10) {
      ctx.showError('GitHub polling interval must be at least 10 seconds.');
      return;
    }
    interval = Math.round(seconds * 1000);
  }
  if (!interval) return;

  const settings = loadSettings();
  settings.signals.githubPollIntervalMs = interval;
  saveSettings(settings);
  ctx.showInfo(
    `GitHub polling interval set to ${formatPollInterval(interval)}. Restart MastraCode for this to take effect.`,
  );
}

async function showGithubActionMenu(ctx: SlashCommandContext): Promise<void> {
  const action = await askModalQuestion(ctx.state.ui, {
    question: 'GitHub Signals',
    options: [
      { label: 'Subscribe', description: 'Select one or more open PRs' },
      { label: 'Unsubscribe', description: 'Remove one or more current subscriptions' },
      { label: 'Unsubscribe all', description: 'Remove every current PR subscription' },
      { label: 'List subscriptions', description: 'Show current PR subscriptions' },
      { label: 'Token', description: 'GitHub authentication help' },
      { label: 'Poll interval', description: 'Set polling duration' },
      { label: 'Sync now', description: 'Fetch current PR updates' },
      { label: 'Debug', description: 'Show GitHub signal diagnostics' },
    ],
    allowCustomResponse: false,
  });
  switch (action) {
    case 'Subscribe':
      await subscribeWithPicker(ctx);
      break;
    case 'Unsubscribe':
      await unsubscribeWithPicker(ctx);
      break;
    case 'Unsubscribe all':
      await unsubscribeAll(ctx);
      break;
    case 'List subscriptions':
      ctx.showInfo(await describeGithubSubscriptions(ctx));
      break;
    case 'Token':
      ctx.showInfo('GitHub PR discovery uses the gh CLI. Run `gh auth login` or set GITHUB_TOKEN for gitcrawl access.');
      break;
    case 'Poll interval':
      await manageGithubPollInterval(ctx);
      break;
    case 'Sync now':
      await syncGithubSubscriptions(ctx);
      break;
    case 'Debug':
      ctx.showInfo(await describeGithubSubscriptions(ctx));
      break;
  }
}

async function handleInlineGithubOperation(
  ctx: SlashCommandContext,
  input: { action: 'subscribe' | 'unsubscribe'; referenceArgs: string[]; mode: GithubSubscriptionMode },
): Promise<void> {
  const currentThread = await getCurrentGithubThread(ctx);
  const existingSubscriptions = getGithubSubscriptionsFromThreadMetadata(currentThread.metadata);
  const inlineReference = input.referenceArgs.join(' ').trim();
  const reference = inlineReference
    ? inlineReference
    : input.action === 'unsubscribe' && existingSubscriptions.length === 1
      ? existingSubscriptions[0]!
      : await askModalQuestion(ctx.state.ui, {
          question: `GitHub PR to ${input.action} ${input.action === 'subscribe' ? 'to' : 'from'}`,
          defaultValue: await detectCurrentPullRequest(ctx),
        });
  if (reference === null) return;

  const parsed = typeof reference === 'string' ? parseGithubPRReference(reference) : reference;
  if (!parsed) {
    ctx.showError(GITHUB_USAGE);
    return;
  }
  if (!currentThread.threadId || !currentThread.resourceId) {
    ctx.showError(`GitHub ${input.action} requires a current thread.`);
    return;
  }

  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  if (!githubSignalsProcessor) {
    ctx.showError('GitHub signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  try {
    if (input.action === 'unsubscribe') {
      const result = await githubSignalsProcessor.unsubscribeThreadFromPR({
        threadId: currentThread.threadId,
        resourceId: currentThread.resourceId,
        pr: parsed,
      });
      const prefix = result.removed ? 'Unsubscribed from' : 'No subscription found for';
      ctx.showInfo(`${prefix} ${result.owner}/${result.repo}#${result.number}.`);
      return;
    }

    const result = await githubSignalsProcessor.subscribeThreadToPR({
      threadId: currentThread.threadId,
      resourceId: currentThread.resourceId,
      pr: parsed,
      mode: input.mode,
    });
    if (result.terminalState) {
      ctx.showInfo(
        `Not subscribed to ${result.owner}/${result.repo}#${result.number} in ${normalizeGithubSubscriptionMode(result.mode)} mode because it is already ${result.terminalState}.`,
      );
      return;
    }
    ctx.showInfo(
      `Subscribed to ${result.owner}/${result.repo}#${result.number} in ${normalizeGithubSubscriptionMode(result.mode)} mode.`,
    );
  } catch (error) {
    ctx.showError(`Failed to ${input.action} GitHub PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function handleGithubCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  if (!loadSettings().signals.experimentalGithubSignals) {
    ctx.showError('Experimental GitHub signals are disabled. Enable them in /settings and restart MastraCode.');
    return;
  }

  const [maybeAction, ...restArgs] = args;
  if (!maybeAction) {
    await showGithubActionMenu(ctx);
    return;
  }
  if (maybeAction === 'debug') {
    ctx.showInfo(await describeGithubSubscriptions(ctx));
    return;
  }
  if (maybeAction === 'sync') {
    await syncGithubSubscriptions(ctx);
    return;
  }
  const explicitSubscribe = maybeAction === 'subscribe' || maybeAction === 'sub';
  const action = maybeAction === 'unsubscribe' || maybeAction === 'unsub' ? 'unsubscribe' : 'subscribe';
  const rawReferenceArgs = action === 'unsubscribe' || explicitSubscribe ? restArgs : args;
  const parsedMode = extractGithubSubscriptionMode(rawReferenceArgs, action);
  if ('error' in parsedMode) {
    ctx.showError(parsedMode.error);
    return;
  }
  await handleInlineGithubOperation(ctx, { action, referenceArgs: parsedMode.referenceArgs, mode: parsedMode.mode });
}
