# Task 17: GitHubInbox Tests

## Summary

Unit tests for GitHubInbox with mocked Octokit and webhook handling.

## File to Create

`tasks/github/src/__tests__/github-inbox.test.ts`

## Test Cases

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitHubInbox } from '../github-inbox';
import { InMemoryInboxStorage, TaskStatus, TaskPriority } from '@mastra/core';
import * as crypto from 'node:crypto';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      listForRepo: vi.fn(),
    },
  })),
}));

import { Octokit } from '@octokit/rest';

describe('GitHubInbox', () => {
  let inbox: GitHubInbox;
  let storage: InMemoryInboxStorage;
  let mockOctokit: any;
  let mockMastra: any;

  const WEBHOOK_SECRET = 'test-secret';

  const mockIssues = [
    {
      number: 1,
      title: 'Bug: Login fails',
      body: 'Users cannot log in',
      state: 'open',
      user: { login: 'user1' },
      labels: [{ name: 'bug' }, { name: 'needs-agent' }],
      html_url: 'https://github.com/acme/app/issues/1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      number: 2,
      title: 'Feature: Add dark mode',
      body: 'Please add dark mode',
      state: 'open',
      user: { login: 'user2' },
      labels: [{ name: 'enhancement' }, { name: 'urgent' }, { name: 'needs-agent' }],
      html_url: 'https://github.com/acme/app/issues/2',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  function createWebhookRequest(event: string, payload: object, secret?: string): Request {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-github-event': event,
    };

    if (secret) {
      const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
      headers['x-hub-signature-256'] = signature;
    }

    return new Request('https://example.com/webhook', {
      method: 'POST',
      headers,
      body,
    });
  }

  beforeEach(() => {
    storage = new InMemoryInboxStorage();
    mockMastra = {
      getStorage: () => ({ stores: { inbox: storage } }),
    };

    mockOctokit = {
      issues: {
        listForRepo: vi.fn().mockResolvedValue({ data: mockIssues }),
      },
    };
    (Octokit as any).mockImplementation(() => mockOctokit);

    inbox = new GitHubInbox({
      id: 'github-issues',
      owner: 'acme',
      repo: 'app',
      token: 'test-token',
      secret: WEBHOOK_SECRET,
      filter: { labels: ['needs-agent'] },
    });
    inbox.__registerMastra(mockMastra);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // WEBHOOK TESTS
  // ============================================

  describe('handleWebhook', () => {
    describe('signature verification', () => {
      it('rejects invalid signature', async () => {
        const req = createWebhookRequest('issues', { action: 'opened' }, 'wrong-secret');

        const res = await inbox.handleWebhook(req);

        expect(res.status).toBe(401);
      });

      it('accepts valid signature', async () => {
        const req = createWebhookRequest(
          'issues',
          {
            action: 'opened',
            issue: mockIssues[0],
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        const res = await inbox.handleWebhook(req);

        expect(res.status).toBe(200);
      });

      it('allows missing signature if no secret configured', async () => {
        const inboxNoSecret = new GitHubInbox({
          id: 'github-no-secret',
          owner: 'acme',
          repo: 'app',
          token: 'test-token',
          // No secret
        });
        inboxNoSecret.__registerMastra(mockMastra);

        const req = createWebhookRequest(
          'issues',
          {
            action: 'opened',
            issue: mockIssues[0],
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          // No signature
        );

        const res = await inboxNoSecret.handleWebhook(req);

        expect(res.status).toBe(200);
      });
    });

    describe('issue opened', () => {
      it('creates task when issue opened', async () => {
        const req = createWebhookRequest(
          'issues',
          {
            action: 'opened',
            issue: mockIssues[0],
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        await inbox.handleWebhook(req);

        const tasks = await storage.listTasks('github-issues');
        expect(tasks).toHaveLength(1);
        expect(tasks[0].sourceId).toBe('1');
        expect(tasks[0].title).toBe('Bug: Login fails');
      });

      it('ignores issues without matching labels', async () => {
        const issueWithoutLabel = {
          ...mockIssues[0],
          labels: [{ name: 'bug' }], // No 'needs-agent' label
        };

        const req = createWebhookRequest(
          'issues',
          {
            action: 'opened',
            issue: issueWithoutLabel,
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        await inbox.handleWebhook(req);

        const tasks = await storage.listTasks('github-issues');
        expect(tasks).toHaveLength(0);
      });
    });

    describe('issue labeled', () => {
      it('creates task when matching label added', async () => {
        const req = createWebhookRequest(
          'issues',
          {
            action: 'labeled',
            issue: mockIssues[0],
            label: { name: 'needs-agent' },
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        await inbox.handleWebhook(req);

        const tasks = await storage.listTasks('github-issues');
        expect(tasks).toHaveLength(1);
      });
    });

    describe('issue closed', () => {
      it('cancels pending tasks when issue closed', async () => {
        // First create a task
        await storage.createTask('github-issues', {
          type: 'github-issue',
          payload: {},
          sourceId: '1',
        });

        const req = createWebhookRequest(
          'issues',
          {
            action: 'closed',
            issue: { ...mockIssues[0], state: 'closed' },
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        await inbox.handleWebhook(req);

        const tasks = await storage.listTasks('github-issues');
        expect(tasks[0].status).toBe(TaskStatus.CANCELLED);
      });

      it('does not cancel completed tasks', async () => {
        // Create and complete a task
        const task = await storage.createTask('github-issues', {
          type: 'github-issue',
          payload: {},
          sourceId: '1',
        });
        await storage.claimTask({ inboxId: 'github-issues', agentId: 'agent' });
        await storage.startTask(task.id);
        await storage.completeTask(task.id, { done: true });

        const req = createWebhookRequest(
          'issues',
          {
            action: 'closed',
            issue: { ...mockIssues[0], state: 'closed' },
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        await inbox.handleWebhook(req);

        const tasks = await storage.listTasks('github-issues');
        expect(tasks[0].status).toBe(TaskStatus.COMPLETED);
      });
    });

    describe('issue reopened', () => {
      it('creates task when issue reopened', async () => {
        const req = createWebhookRequest(
          'issues',
          {
            action: 'reopened',
            issue: mockIssues[0],
            repository: { owner: { login: 'acme' }, name: 'app' },
          },
          WEBHOOK_SECRET,
        );

        await inbox.handleWebhook(req);

        const tasks = await storage.listTasks('github-issues');
        expect(tasks).toHaveLength(1);
      });
    });

    describe('idempotency', () => {
      it('upserts task on duplicate webhook', async () => {
        const payload = {
          action: 'opened',
          issue: mockIssues[0],
          repository: { owner: { login: 'acme' }, name: 'app' },
        };

        // Send same webhook twice
        await inbox.handleWebhook(createWebhookRequest('issues', payload, WEBHOOK_SECRET));
        await inbox.handleWebhook(createWebhookRequest('issues', payload, WEBHOOK_SECRET));

        const tasks = await storage.listTasks('github-issues');
        expect(tasks).toHaveLength(1); // Still just one task
      });
    });
  });

  // ============================================
  // SYNC TESTS
  // ============================================

  describe('sync', () => {
    it('fetches issues from GitHub API', async () => {
      await inbox.sync();

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'app',
        state: 'open',
        labels: 'needs-agent',
        assignee: undefined,
        since: undefined,
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      });
    });

    it('creates tasks for each issue', async () => {
      const result = await inbox.sync();

      expect(result.synced).toBe(2);
      const tasks = await storage.listTasks('github-issues');
      expect(tasks).toHaveLength(2);
    });

    it('skips pull requests', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({
        data: [...mockIssues, { number: 3, title: 'PR', pull_request: {} }],
      });

      await inbox.sync();

      const tasks = await storage.listTasks('github-issues');
      expect(tasks).toHaveLength(2);
    });

    it('uses since option for incremental sync', async () => {
      const since = new Date('2024-01-01');
      await inbox.sync({ since });

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          since: since.toISOString(),
        }),
      );
    });

    it('respects limit option', async () => {
      await inbox.sync({ limit: 50 });

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          per_page: 50,
        }),
      );
    });

    it('cancels tasks for closed issues', async () => {
      // First sync with both issues
      await inbox.sync();

      // Second sync with only issue 2 (issue 1 closed)
      mockOctokit.issues.listForRepo.mockResolvedValue({
        data: [mockIssues[1]],
      });

      const result = await inbox.sync();

      expect(result.cancelled).toBe(1);
      const tasks = await storage.listTasks('github-issues');
      const task1 = tasks.find(t => t.sourceId === '1');
      expect(task1!.status).toBe(TaskStatus.CANCELLED);
    });

    it('throws error if no token configured', async () => {
      const inboxNoToken = new GitHubInbox({
        id: 'github-no-token',
        owner: 'acme',
        repo: 'app',
        secret: WEBHOOK_SECRET,
        // No token
      });
      inboxNoToken.__registerMastra(mockMastra);

      await expect(inboxNoToken.sync()).rejects.toThrow('GitHub token required');
    });

    it('is idempotent (upserts by sourceId)', async () => {
      await inbox.sync();
      await inbox.sync();

      const tasks = await storage.listTasks('github-issues');
      expect(tasks).toHaveLength(2); // Still just 2 tasks
    });
  });

  // ============================================
  // TRANSFORM TESTS
  // ============================================

  describe('issueToTask', () => {
    it('uses default transform', async () => {
      await inbox.sync();

      const tasks = await storage.listTasks('github-issues');
      const task = tasks.find(t => t.sourceId === '1');

      expect(task!.type).toBe('github-issue');
      expect(task!.title).toBe('Bug: Login fails');
      expect(task!.payload).toEqual({
        issueNumber: 1,
        title: 'Bug: Login fails',
        body: 'Users cannot log in',
        author: 'user1',
        labels: ['bug', 'needs-agent'],
      });
    });

    it('sets priority=high for urgent label', async () => {
      await inbox.sync();

      const tasks = await storage.listTasks('github-issues');
      const urgentTask = tasks.find(t => t.sourceId === '2');
      const normalTask = tasks.find(t => t.sourceId === '1');

      expect(urgentTask!.priority).toBe(TaskPriority.HIGH);
      expect(normalTask!.priority).toBe(TaskPriority.NORMAL);
    });

    it('uses custom transform', async () => {
      const customInbox = new GitHubInbox({
        id: 'github-custom',
        owner: 'acme',
        repo: 'app',
        token: 'test-token',
        issueToTask: issue => ({
          type: 'custom-type',
          title: `CUSTOM: ${issue.title}`,
          payload: { num: issue.number },
          priority: TaskPriority.URGENT,
        }),
      });
      customInbox.__registerMastra(mockMastra);

      await customInbox.sync();

      const tasks = await storage.listTasks('github-custom');
      expect(tasks[0].type).toBe('custom-type');
      expect(tasks[0].title).toStartWith('CUSTOM:');
      expect(tasks[0].priority).toBe(TaskPriority.URGENT);
    });
  });

  // ============================================
  // HOOKS TESTS
  // ============================================

  describe('hooks', () => {
    it('onComplete is accessible', () => {
      const onComplete = vi.fn();
      const customInbox = new GitHubInbox({
        id: 'github-hooks',
        owner: 'acme',
        repo: 'app',
        onComplete,
      });

      expect(customInbox.onComplete).toBe(onComplete);
    });

    it('onError is accessible', () => {
      const onError = vi.fn();
      const customInbox = new GitHubInbox({
        id: 'github-hooks',
        owner: 'acme',
        repo: 'app',
        onError,
      });

      expect(customInbox.onError).toBe(onError);
    });
  });
});
```

## Acceptance Criteria

- [ ] Webhook signature verification tested (valid, invalid, missing)
- [ ] Issue opened/labeled/closed/reopened events tested
- [ ] Label filtering tested
- [ ] Idempotency tested (duplicate webhooks)
- [ ] sync() API calls tested
- [ ] sync() with options (since, limit) tested
- [ ] sync() cancels closed issues
- [ ] sync() requires token
- [ ] Default issueToTask transform tested
- [ ] Custom issueToTask transform tested
- [ ] Priority mapping tested
- [ ] Hooks accessible
- [ ] Tests pass with mocked Octokit
