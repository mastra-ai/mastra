import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubInbox } from '../github-inbox';
import type { GitHubIssue } from '../types';

// Mock @mastra/core
vi.mock('@mastra/core', async () => {
  const { TaskStatus, TaskPriority } = await vi.importActual<typeof import('@mastra/core')>('@mastra/core');

  // In-memory task storage for testing
  const tasks = new Map<string, any>();
  let taskIdCounter = 0;

  const mockStorage = {
    createTask: vi.fn(async (inboxId: string, input: any) => {
      const id = `task-${++taskIdCounter}`;
      const task = {
        id,
        inboxId,
        type: input.type,
        status: TaskStatus.PENDING,
        priority: input.priority ?? TaskPriority.NORMAL,
        title: input.title,
        sourceId: input.sourceId,
        sourceUrl: input.sourceUrl,
        payload: input.payload,
        targetAgentId: input.targetAgentId,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        createdAt: new Date(),
        metadata: input.metadata,
      };
      tasks.set(id, task);
      return task;
    }),
    upsertTask: vi.fn(async (inboxId: string, sourceId: string, input: any) => {
      // Find existing task by sourceId
      let existingTask: any = null;
      for (const task of tasks.values()) {
        if (task.inboxId === inboxId && task.sourceId === sourceId) {
          existingTask = task;
          break;
        }
      }

      if (existingTask) {
        // Update existing task
        Object.assign(existingTask, {
          title: input.title,
          payload: input.payload,
          sourceUrl: input.sourceUrl,
        });
        return existingTask;
      }

      // Create new task
      return mockStorage.createTask(inboxId, { ...input, sourceId });
    }),
    listTasks: vi.fn(async (_inboxId: string, _filter: any) => {
      return Array.from(tasks.values());
    }),
    updateTask: vi.fn(async (taskId: string, updates: any) => {
      const task = tasks.get(taskId);
      if (task) {
        Object.assign(task, updates);
      }
      return task;
    }),
    getTask: vi.fn(async (taskId: string) => {
      return tasks.get(taskId) ?? null;
    }),
  };

  class MockInbox {
    id: string;
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    constructor(config: { id: string }) {
      this.id = config.id;
    }

    protected getStorage() {
      return mockStorage;
    }

    async list(_filter?: any) {
      return mockStorage.listTasks(this.id, _filter);
    }

    async cancel(taskId: string) {
      const task = tasks.get(taskId);
      if (task) {
        task.status = TaskStatus.CANCELLED;
      }
    }
  }

  return {
    Inbox: MockInbox,
    TaskStatus,
    TaskPriority,
    __mockStorage: mockStorage,
    __tasks: tasks,
    __resetTasks: () => {
      tasks.clear();
      taskIdCounter = 0;
    },
  };
});

// Mock Octokit
const createMockOctokit = () => ({
  issues: {
    listForRepo: vi.fn(),
    createComment: vi.fn(),
  },
});

describe('GitHubInbox', () => {
  let mockOctokit: ReturnType<typeof createMockOctokit>;

  beforeEach(async () => {
    mockOctokit = createMockOctokit();
    // Reset tasks before each test
    const { __resetTasks } = await import('@mastra/core');
    (__resetTasks as () => void)();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create inbox with default ID', () => {
      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
      });

      expect(inbox.id).toBe('github-acme-support');
      expect(inbox.owner).toBe('acme');
      expect(inbox.repo).toBe('support');
    });

    it('should create inbox with custom ID', () => {
      const inbox = new GitHubInbox({
        id: 'custom-inbox',
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
      });

      expect(inbox.id).toBe('custom-inbox');
    });
  });

  describe('sync', () => {
    const createMockIssue = (overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
      number: 1,
      title: 'Test Issue',
      body: 'Test body',
      state: 'open',
      html_url: 'https://github.com/acme/support/issues/1',
      user: { login: 'testuser' },
      labels: [],
      assignees: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      closed_at: null,
      ...overrides,
    });

    it('should sync open issues from GitHub', async () => {
      const mockIssues = [
        createMockIssue({ number: 1, title: 'Issue 1' }),
        createMockIssue({ number: 2, title: 'Issue 2' }),
      ];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
      });

      const result = await inbox.sync();

      expect(result).toEqual({ synced: 2, cancelled: 0, errors: 0 });
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'support',
        state: 'open',
        labels: undefined,
        assignee: undefined,
        creator: undefined,
        since: undefined,
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      });
    });

    it('should filter issues by labels', async () => {
      const mockIssues = [createMockIssue({ number: 1, labels: [{ name: 'needs-agent' }] })];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        filter: { labels: ['needs-agent'] },
      });

      const result = await inbox.sync();

      expect(result.synced).toBe(1);
      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: 'needs-agent',
        }),
      );
    });

    it('should handle closed issues during sync', async () => {
      const mockIssues = [createMockIssue({ number: 1, state: 'closed' })];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        filter: { state: 'all' },
      });

      const result = await inbox.sync();

      expect(result.cancelled).toBe(1);
      expect(result.synced).toBe(0);
    });

    it('should skip pull requests', async () => {
      const mockIssues = [createMockIssue({ number: 1 }), { ...createMockIssue({ number: 2 }), pull_request: {} }];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
      });

      const result = await inbox.sync();

      expect(result.synced).toBe(1);
    });

    it('should respect custom issueToTask function', async () => {
      const mockIssues = [createMockIssue({ number: 1 })];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const customIssueToTask = vi.fn().mockReturnValue(null);

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        issueToTask: customIssueToTask,
      });

      const result = await inbox.sync();

      expect(result.synced).toBe(0);
      expect(customIssueToTask).toHaveBeenCalled();
    });

    it('should pass sync options to API', async () => {
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
      });

      const since = new Date('2024-01-01');
      await inbox.sync({ since, limit: 50 });

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          since: since.toISOString(),
          per_page: 50,
        }),
      );
    });
  });

  describe('handleWebhook', () => {
    it('should return error if webhook secret not configured', async () => {
      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        // No webhookSecret
      });

      const mockRequest = new Request('https://example.com/webhook', {
        method: 'POST',
        headers: {
          'x-github-event': 'issues',
          'x-hub-signature-256': 'sha256=test',
          'x-github-delivery': 'test-id',
        },
        body: JSON.stringify({ action: 'opened', issue: {} }),
      });

      const response = await inbox.handleWebhook(mockRequest);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Webhook secret not configured');
    });
  });

  describe('default issueToTask', () => {
    it('should convert issue to task with correct payload', async () => {
      const mockIssue = {
        number: 42,
        title: 'Bug: Something is broken',
        body: 'Description of the bug',
        state: 'open',
        html_url: 'https://github.com/acme/support/issues/42',
        user: { login: 'reporter' },
        labels: [{ name: 'bug' }, { name: 'urgent' }],
        assignees: [{ login: 'developer' }],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        closed_at: null,
      };

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [mockIssue] });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
      });

      await inbox.sync();

      // Get the created task from storage
      const { __tasks } = await import('@mastra/core');
      const tasks = Array.from((__tasks as Map<string, any>).values());

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        type: 'github-issue',
        title: 'Bug: Something is broken',
        sourceId: '42',
        sourceUrl: 'https://github.com/acme/support/issues/42',
        payload: {
          issueNumber: 42,
          title: 'Bug: Something is broken',
          body: 'Description of the bug',
          author: 'reporter',
          labels: ['bug', 'urgent'],
          assignees: ['developer'],
          htmlUrl: 'https://github.com/acme/support/issues/42',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      });
    });
  });

  describe('filter matching', () => {
    it('should filter by assignee', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Assigned Issue',
          body: null,
          state: 'open' as const,
          html_url: 'https://github.com/acme/support/issues/1',
          user: { login: 'reporter' },
          labels: [],
          assignees: [{ login: 'developer' }],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
        {
          number: 2,
          title: 'Unassigned Issue',
          body: null,
          state: 'open' as const,
          html_url: 'https://github.com/acme/support/issues/2',
          user: { login: 'reporter' },
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
      ];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        filter: { assignee: 'developer' },
      });

      const result = await inbox.sync();

      // Only the assigned issue should be synced
      expect(result.synced).toBe(1);
    });

    it('should filter by creator', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Issue from alice',
          body: null,
          state: 'open' as const,
          html_url: 'https://github.com/acme/support/issues/1',
          user: { login: 'alice' },
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
        {
          number: 2,
          title: 'Issue from bob',
          body: null,
          state: 'open' as const,
          html_url: 'https://github.com/acme/support/issues/2',
          user: { login: 'bob' },
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
      ];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        filter: { creator: 'alice' },
      });

      const result = await inbox.sync();

      expect(result.synced).toBe(1);
    });

    it('should apply custom filter function', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'High priority',
          body: 'URGENT: Fix this',
          state: 'open' as const,
          html_url: 'https://github.com/acme/support/issues/1',
          user: { login: 'reporter' },
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
        {
          number: 2,
          title: 'Normal priority',
          body: 'Just a regular issue',
          state: 'open' as const,
          html_url: 'https://github.com/acme/support/issues/2',
          user: { login: 'reporter' },
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          closed_at: null,
        },
      ];

      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const inbox = new GitHubInbox({
        owner: 'acme',
        repo: 'support',
        octokit: mockOctokit as any,
        filter: {
          filter: issue => issue.body?.includes('URGENT') ?? false,
        },
      });

      const result = await inbox.sync();

      expect(result.synced).toBe(1);
    });
  });
});
