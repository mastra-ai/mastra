# Task 11: Create GitHubInbox Package

## Summary

Create the @mastra/inbox-github package with webhook handling and sync support.

## Package to Create

`tasks/github/`

## Package Structure

```
tasks/github/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    index.ts
    github-inbox.ts
    types.ts
    webhook.ts
```

## package.json

```json
{
  "name": "@mastra/inbox-github",
  "version": "0.1.0",
  "description": "GitHub Issues inbox adapter for Mastra",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "dependencies": {
    "@octokit/rest": "^20.0.0"
  },
  "peerDependencies": {
    "@mastra/core": "workspace:*"
  },
  "devDependencies": {
    "@mastra/core": "workspace:*",
    "typescript": "catalog:",
    "tsup": "catalog:",
    "vitest": "catalog:"
  }
}
```

## types.ts

```typescript
import type { Task, CreateTaskInput } from '@mastra/core';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubWebhookEvent {
  action: string;
  issue?: GitHubIssue;
  repository: {
    owner: { login: string };
    name: string;
  };
  sender: { login: string };
}

export interface GitHubInboxConfig {
  id: string;

  // GitHub connection
  owner: string;
  repo: string;
  token?: string; // For API (sync) - optional if webhook-only
  secret?: string; // For webhook signature verification

  // Filtering (for sync)
  filter?: {
    labels?: string[];
    state?: 'open' | 'closed' | 'all';
    assignee?: string;
  };

  // Transform
  issueToTask?: (issue: GitHubIssue, event?: GitHubWebhookEvent) => Omit<CreateTaskInput, 'sourceId' | 'sourceUrl'>;

  // Hooks
  onComplete?: (task: Task, result: unknown) => Promise<void>;
  onError?: (task: Task, error: Error) => Promise<void>;
}

export interface SyncOptions {
  since?: Date; // Only sync issues updated after this date
  limit?: number; // Max issues to sync (default: 100)
}

export interface SyncResult {
  synced: number;
  cancelled: number;
  errors: number;
}
```

## webhook.ts

```typescript
import * as crypto from 'node:crypto';
import type { GitHubWebhookEvent } from './types';

export function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseWebhookEvent(body: string): GitHubWebhookEvent {
  return JSON.parse(body);
}
```

## github-inbox.ts

````typescript
import { Octokit } from '@octokit/rest';
import { Inbox, type Task, type CreateTaskInput, TaskStatus, TaskPriority } from '@mastra/core';
import type { GitHubInboxConfig, GitHubIssue, GitHubWebhookEvent, SyncOptions, SyncResult } from './types';
import { verifyWebhookSignature, parseWebhookEvent } from './webhook';

export class GitHubInbox extends Inbox {
  #octokit?: Octokit;
  #owner: string;
  #repo: string;
  #token?: string;
  #secret?: string;
  #filter: GitHubInboxConfig['filter'];
  #issueToTask: NonNullable<GitHubInboxConfig['issueToTask']>;

  constructor(config: GitHubInboxConfig) {
    super({
      id: config.id,
      onComplete: config.onComplete,
      onError: config.onError,
    });

    this.#owner = config.owner;
    this.#repo = config.repo;
    this.#token = config.token;
    this.#secret = config.secret;
    this.#filter = config.filter ?? { state: 'open' };
    this.#issueToTask = config.issueToTask ?? this.#defaultIssueToTask.bind(this);

    if (config.token) {
      this.#octokit = new Octokit({ auth: config.token });
    }
  }

  #defaultIssueToTask(issue: GitHubIssue): Omit<CreateTaskInput, 'sourceId' | 'sourceUrl'> {
    const labels = issue.labels.map(l => l.name);
    return {
      type: 'github-issue',
      title: issue.title,
      payload: {
        issueNumber: issue.number,
        title: issue.title,
        body: issue.body,
        author: issue.user?.login,
        labels,
      },
      priority: labels.includes('urgent') ? TaskPriority.HIGH : TaskPriority.NORMAL,
    };
  }

  // ============================================
  // WEBHOOK HANDLING (Push - Real-time)
  // ============================================

  /**
   * Handle incoming GitHub webhook.
   * Wire this up to your webhook endpoint:
   *
   * ```ts
   * // app/api/webhooks/github/route.ts
   * export async function POST(req: Request) {
   *   return githubInbox.handleWebhook(req);
   * }
   * ```
   */
  async handleWebhook(req: Request): Promise<Response> {
    // 1. Get headers and body
    const signature = req.headers.get('x-hub-signature-256');
    const eventType = req.headers.get('x-github-event');
    const body = await req.text();

    // 2. Verify signature (if secret configured)
    if (this.#secret) {
      if (!verifyWebhookSignature(body, signature, this.#secret)) {
        this.logger.warn('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    // 3. Parse event
    let event: GitHubWebhookEvent;
    try {
      event = parseWebhookEvent(body);
    } catch (err) {
      this.logger.error('Failed to parse webhook', { error: err });
      return new Response('Invalid JSON', { status: 400 });
    }

    // 4. Handle based on event type
    try {
      if (eventType === 'issues' && event.issue) {
        await this.#handleIssueEvent(event);
      }
      // Can add more event types: issue_comment, pull_request, etc.

      return new Response('OK', { status: 200 });
    } catch (err) {
      this.logger.error('Webhook handler error', { error: err });
      return new Response('Internal error', { status: 500 });
    }
  }

  async #handleIssueEvent(event: GitHubWebhookEvent): Promise<void> {
    const issue = event.issue!;
    const action = event.action;

    this.logger.debug('Handling issue event', { action, issue: issue.number });

    // Check if issue matches our filter (labels)
    if (this.#filter?.labels?.length) {
      const issueLabels = issue.labels.map(l => l.name);
      const hasMatchingLabel = this.#filter.labels.some(l => issueLabels.includes(l));
      if (!hasMatchingLabel) {
        this.logger.debug('Issue does not match label filter', { issue: issue.number });
        return;
      }
    }

    if (action === 'opened' || action === 'reopened' || action === 'labeled') {
      // Create or update task
      const taskInput = this.#issueToTask(issue, event);
      await this.getStorage().upsertTask(this.id, String(issue.number), {
        ...taskInput,
        sourceId: String(issue.number),
        sourceUrl: issue.html_url,
      });
      this.logger.info('Task created/updated from webhook', { issue: issue.number });
    }

    if (action === 'closed' || action === 'unlabeled') {
      // Cancel pending tasks for this issue
      await this.#cancelTasksForIssue(issue.number);
    }
  }

  async #cancelTasksForIssue(issueNumber: number): Promise<void> {
    const storage = this.getStorage();
    const tasks = await storage.listTasks(this.id, {
      status: [TaskStatus.PENDING, TaskStatus.CLAIMED],
    });

    for (const task of tasks) {
      if (task.sourceId === String(issueNumber)) {
        await storage.cancelTask(task.id);
        this.logger.info('Task cancelled', { taskId: task.id, issue: issueNumber });
      }
    }
  }

  // ============================================
  // SYNC (Pull - Backfill/Catch-up)
  // ============================================

  /**
   * Sync issues from GitHub API.
   * Use for initial backfill or catching up after missed webhooks.
   *
   * ```ts
   * // Initial backfill
   * await inbox.sync();
   *
   * // Incremental catch-up
   * await inbox.sync({ since: lastSyncDate });
   * ```
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    if (!this.#octokit) {
      throw new Error('GitHub token required for sync. Provide token in config.');
    }

    const storage = this.getStorage();
    const result: SyncResult = { synced: 0, cancelled: 0, errors: 0 };

    try {
      // Fetch issues from GitHub
      const { data: issues } = await this.#octokit.issues.listForRepo({
        owner: this.#owner,
        repo: this.#repo,
        state: this.#filter?.state ?? 'open',
        labels: this.#filter?.labels?.join(','),
        assignee: this.#filter?.assignee,
        since: options?.since?.toISOString(),
        per_page: options?.limit ?? 100,
        sort: 'updated',
        direction: 'desc',
      });

      this.logger.info('Fetched issues from GitHub', { count: issues.length });

      // Track which issues we see (for cancellation)
      const seenIssueNumbers = new Set<string>();

      // Upsert each issue as a task
      for (const issue of issues) {
        // Skip pull requests
        if ('pull_request' in issue) continue;

        try {
          const taskInput = this.#issueToTask(issue as GitHubIssue);
          await storage.upsertTask(this.id, String(issue.number), {
            ...taskInput,
            sourceId: String(issue.number),
            sourceUrl: issue.html_url,
          });
          seenIssueNumbers.add(String(issue.number));
          result.synced++;
        } catch (err) {
          this.logger.error('Failed to upsert task', { issue: issue.number, error: err });
          result.errors++;
        }
      }

      // Cancel tasks for issues no longer in open state (if syncing open issues)
      if (this.#filter?.state === 'open' || !this.#filter?.state) {
        const existingTasks = await storage.listTasks(this.id, {
          status: [TaskStatus.PENDING, TaskStatus.CLAIMED],
        });

        for (const task of existingTasks) {
          if (task.sourceId && !seenIssueNumbers.has(task.sourceId)) {
            await storage.cancelTask(task.id);
            result.cancelled++;
          }
        }
      }

      this.logger.info('Sync complete', result);
      return result;
    } catch (err) {
      this.logger.error('Sync failed', { error: err });
      throw err;
    }
  }
}
````

## index.ts

```typescript
export { GitHubInbox } from './github-inbox';
export type { GitHubInboxConfig, GitHubIssue, GitHubWebhookEvent, SyncOptions, SyncResult } from './types';
```

## Usage Examples

### Webhook + Sync Setup

```typescript
import { GitHubInbox } from '@mastra/inbox-github';

const inbox = new GitHubInbox({
  id: 'github',
  owner: 'acme',
  repo: 'support',
  token: process.env.GITHUB_TOKEN, // For sync
  secret: process.env.GITHUB_WEBHOOK_SECRET, // For webhooks

  filter: { labels: ['needs-agent'] },

  onComplete: async (task, result) => {
    // Comment on the issue
    await octokit.issues.createComment({
      owner: 'acme',
      repo: 'support',
      issue_number: task.payload.issueNumber,
      body: `## Agent Response\n\n${result.text}`,
    });
  },
});
```

### Webhook Endpoint

```typescript
// app/api/webhooks/github/route.ts
export async function POST(req: Request) {
  return inbox.handleWebhook(req);
}
```

### Initial Backfill

```typescript
// scripts/backfill.ts
await inbox.sync();
```

### Periodic Catch-up (optional)

```typescript
// app/api/cron/github-sync/route.ts
export async function GET() {
  const result = await inbox.sync({
    since: new Date(Date.now() - 60 * 60 * 1000),
  });
  return Response.json(result);
}
```

## Acceptance Criteria

- [ ] Package builds successfully
- [ ] GitHubInbox extends Inbox
- [ ] handleWebhook() verifies signature and creates tasks
- [ ] sync() fetches issues and upserts tasks
- [ ] Both methods use upsertTask (idempotent by sourceId)
- [ ] Closed issues cancel pending tasks
- [ ] Label filtering works in both webhook and sync
- [ ] Custom issueToTask transform supported
- [ ] Hooks (onComplete, onError) work
- [ ] Package exports all types
