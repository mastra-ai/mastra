import { Inbox, TaskStatus, type Task, type CreateTaskInput } from '@mastra/core';
import { Webhooks } from '@octokit/webhooks';
import type { Octokit } from '@octokit/rest';
import type {
  GitHubInboxConfig,
  GitHubIssue,
  GitHubIssuePayload,
  IssueToTaskFn,
  SyncOptions,
  SyncResult,
  GitHubIssueFilter,
} from './types';

/**
 * Default function to convert a GitHub issue to a task.
 */
const defaultIssueToTask: IssueToTaskFn = (issue: GitHubIssue): CreateTaskInput<GitHubIssuePayload> => {
  return {
    type: 'github-issue',
    title: issue.title,
    sourceId: String(issue.number),
    sourceUrl: issue.html_url,
    payload: {
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body,
      author: issue.user?.login ?? 'unknown',
      labels: issue.labels.map(l => l.name).filter((n): n is string => !!n),
      assignees: issue.assignees?.map(a => a.login) ?? [],
      htmlUrl: issue.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    },
  };
};

/**
 * GitHubInbox syncs GitHub issues into the inbox as tasks.
 *
 * Features:
 * - Real-time updates via webhooks (handleWebhook)
 * - Backfill/catch-up via sync()
 * - Automatic issue-to-task conversion
 * - Hooks for commenting on issues when tasks complete
 *
 * @example
 * ```typescript
 * import { Octokit } from '@octokit/rest';
 * import { GitHubInbox } from '@mastra/inbox-github';
 *
 * const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
 *
 * const inbox = new GitHubInbox({
 *   owner: 'acme',
 *   repo: 'support',
 *   octokit,
 *   webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
 *   filter: {
 *     labels: ['needs-agent'],
 *   },
 *   onComplete: async (task, result) => {
 *     await octokit.issues.createComment({
 *       owner: 'acme',
 *       repo: 'support',
 *       issue_number: task.payload.issueNumber,
 *       body: `## Agent Response\n\n${result.text}`,
 *     });
 *   },
 * });
 *
 * // Backfill existing issues
 * await inbox.sync();
 *
 * // Or set up webhook endpoint
 * // POST /api/webhooks/github -> inbox.handleWebhook(req)
 * ```
 */
export class GitHubInbox extends Inbox<Task<GitHubIssuePayload>> {
  readonly owner: string;
  readonly repo: string;

  #octokit: Octokit;
  #webhooks?: Webhooks;
  #filter: GitHubIssueFilter;
  #issueToTask: IssueToTaskFn;

  constructor(config: GitHubInboxConfig) {
    const inboxId = config.id ?? `github-${config.owner}-${config.repo}`;

    super({
      id: inboxId,
      claimTimeout: config.claimTimeout,
      retry: config.retry,
      onComplete: config.onComplete as any,
      onError: config.onError as any,
    });

    this.owner = config.owner;
    this.repo = config.repo;
    this.#octokit = config.octokit;
    this.#filter = config.filter ?? {};
    this.#issueToTask = config.issueToTask ?? defaultIssueToTask;

    // Set up webhook handler if secret provided
    if (config.webhookSecret) {
      this.#webhooks = new Webhooks({
        secret: config.webhookSecret,
      });

      this.#setupWebhookHandlers();
    }
  }

  /**
   * Set up webhook event handlers.
   */
  #setupWebhookHandlers(): void {
    if (!this.#webhooks) return;

    // Issue opened
    this.#webhooks.on('issues.opened', async ({ payload }) => {
      const issue = payload.issue as unknown as GitHubIssue;
      await this.#handleIssue(issue);
    });

    // Issue edited
    this.#webhooks.on('issues.edited', async ({ payload }) => {
      const issue = payload.issue as unknown as GitHubIssue;
      await this.#handleIssue(issue);
    });

    // Issue labeled (might now match our filter)
    this.#webhooks.on('issues.labeled', async ({ payload }) => {
      const issue = payload.issue as unknown as GitHubIssue;
      await this.#handleIssue(issue);
    });

    // Issue unlabeled (might no longer match our filter)
    this.#webhooks.on('issues.unlabeled', async ({ payload }) => {
      const issue = payload.issue as unknown as GitHubIssue;
      // If issue no longer matches filter, we could cancel the task
      // For now, just update it
      await this.#handleIssue(issue);
    });

    // Issue closed
    this.#webhooks.on('issues.closed', async ({ payload }) => {
      const issue = payload.issue as unknown as GitHubIssue;
      await this.#handleIssueClosed(issue);
    });

    // Issue reopened
    this.#webhooks.on('issues.reopened', async ({ payload }) => {
      const issue = payload.issue as unknown as GitHubIssue;
      await this.#handleIssue(issue);
    });
  }

  /**
   * Handle an issue (create or update task).
   * @returns true if a task was created/updated, false if skipped
   */
  async #handleIssue(issue: GitHubIssue): Promise<boolean> {
    // Check if issue matches filter
    if (!this.#matchesFilter(issue)) {
      this.logger.debug(`Issue #${issue.number} does not match filter, skipping`);
      return false;
    }

    // Convert issue to task input
    const taskInput = this.#issueToTask(issue);
    if (!taskInput) {
      this.logger.debug(`Issue #${issue.number} was filtered out by issueToTask, skipping`);
      return false;
    }

    // Upsert task (create or update)
    try {
      const storage = this['getStorage']();
      await storage.upsertTask(this.id, String(issue.number), taskInput);
      this.logger.info(`Upserted task for issue #${issue.number}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to upsert task for issue #${issue.number}:`, error);
      return false;
    }
  }

  /**
   * Handle an issue being closed (cancel task if not completed).
   */
  async #handleIssueClosed(issue: GitHubIssue): Promise<void> {
    try {
      // Find task by sourceId
      const tasks = await this.list({ type: 'github-issue' });
      const task = tasks.find(t => t.sourceId === String(issue.number));

      if (task && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED) {
        await this.cancel(task.id);
        this.logger.info(`Cancelled task for closed issue #${issue.number}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle closed issue #${issue.number}:`, error);
    }
  }

  /**
   * Check if an issue matches the configured filter.
   */
  #matchesFilter(issue: GitHubIssue): boolean {
    const { labels, state, assignee, creator, filter: customFilter } = this.#filter;

    // Check state (default: open)
    const stateFilter = state ?? 'open';
    if (stateFilter !== 'all' && issue.state !== stateFilter) {
      return false;
    }

    // Check labels (if specified, issue must have at least one matching label)
    if (labels && labels.length > 0) {
      const issueLabels = issue.labels.map(l => l.name).filter((n): n is string => !!n);
      const hasMatchingLabel = labels.some(l => issueLabels.includes(l));
      if (!hasMatchingLabel) {
        return false;
      }
    }

    // Check assignee
    if (assignee) {
      const issueAssignees = issue.assignees?.map(a => a.login) ?? [];
      if (!issueAssignees.includes(assignee)) {
        return false;
      }
    }

    // Check creator
    if (creator && issue.user?.login !== creator) {
      return false;
    }

    // Check custom filter
    if (customFilter && !customFilter(issue)) {
      return false;
    }

    return true;
  }

  /**
   * Handle incoming GitHub webhook.
   *
   * Wire this up to your webhook endpoint:
   * ```typescript
   * // Next.js App Router
   * export async function POST(req: Request) {
   *   return inbox.handleWebhook(req);
   * }
   *
   * // Express
   * app.post('/webhooks/github', async (req, res) => {
   *   const response = await inbox.handleWebhook(req);
   *   res.status(response.status).send(await response.text());
   * });
   * ```
   */
  async handleWebhook(req: Request): Promise<Response> {
    if (!this.#webhooks) {
      return new Response('Webhook secret not configured', { status: 500 });
    }

    try {
      const signature = req.headers.get('x-hub-signature-256') ?? '';
      const body = await req.text();

      // Verify signature and handle event
      await this.#webhooks.verifyAndReceive({
        id: req.headers.get('x-github-delivery') ?? '',
        name: req.headers.get('x-github-event') as any,
        signature,
        payload: body,
      });

      return new Response('OK', { status: 200 });
    } catch (error) {
      this.logger.error('Webhook error:', error);
      const message = error instanceof Error ? error.message : 'Webhook processing failed';
      return new Response(message, { status: 400 });
    }
  }

  /**
   * Sync issues from GitHub into the inbox.
   *
   * Use this for:
   * - Initial backfill of existing issues
   * - Catch-up after downtime
   * - Periodic sync as backup to webhooks
   *
   * @example
   * ```typescript
   * // Sync all open issues with 'needs-agent' label
   * await inbox.sync();
   *
   * // Incremental sync (only issues updated in last hour)
   * await inbox.sync({ since: new Date(Date.now() - 60 * 60 * 1000) });
   *
   * // Limit to 100 issues
   * await inbox.sync({ limit: 100 });
   * ```
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      cancelled: 0,
      errors: 0,
    };

    const { since, limit = 100 } = options;
    const { labels, state = 'open', assignee, creator } = this.#filter;

    try {
      // Fetch issues from GitHub
      const response = await this.#octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state,
        labels: labels?.join(','),
        assignee,
        creator,
        since: since?.toISOString(),
        per_page: Math.min(limit, 100),
        sort: 'updated',
        direction: 'desc',
      });

      const issues = response.data as unknown as GitHubIssue[];

      this.logger.info(`Syncing ${issues.length} issues from ${this.owner}/${this.repo}`);

      for (const issue of issues) {
        // Skip pull requests (they come through the issues API too)
        if ('pull_request' in issue) {
          continue;
        }

        try {
          // Check custom filter
          if (this.#filter.filter && !this.#filter.filter(issue)) {
            continue;
          }

          if (issue.state === 'closed') {
            // Handle closed issues
            await this.#handleIssueClosed(issue);
            result.cancelled++;
          } else {
            // Handle open issues
            const created = await this.#handleIssue(issue);
            if (created) {
              result.synced++;
            }
          }
        } catch (error) {
          this.logger.error(`Error syncing issue #${issue.number}:`, error);
          result.errors++;
        }
      }

      this.logger.info(
        `Sync complete: ${result.synced} synced, ${result.cancelled} cancelled, ${result.errors} errors`,
      );
    } catch (error) {
      this.logger.error('Sync failed:', error);
      throw error;
    }

    return result;
  }
}
