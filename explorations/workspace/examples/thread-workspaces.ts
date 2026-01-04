/**
 * Thread Workspaces Example
 *
 * Demonstrates how thread-level workspaces provide isolation between conversations
 * while optionally sharing agent-level resources.
 */

import { Agent, Mastra } from '@mastra/core';
import type { AgentWorkspaceConfig, Workspace } from '@mastra/workspace';

// =============================================================================
// Example 1: Thread-Only Workspace (Full Isolation)
// =============================================================================

/**
 * Each conversation thread gets its own isolated workspace.
 * Perfect for: code review, one-off tasks, security-sensitive operations.
 */
const isolatedCodeReviewer = new Agent({
  id: 'code-reviewer',
  name: 'Code Reviewer',
  model: 'anthropic/claude-sonnet',
  instructions: `
    You are a code reviewer. For each review request:
    1. Save the code to /code/main.* in your workspace
    2. Analyze the code and save findings to /review/findings.md
    3. If you need to run tests, use the executor
    4. Your workspace is private to this conversation
  `,

  // Each thread gets completely isolated workspace
  workspace: {
    scope: 'thread',
    thread: {
      enabled: true,
      // In-memory filesystem (fast, no persistence between threads)
      filesystem: {
        provider: 'memory',
        ephemeral: true,
      },
      // Each thread gets its own sandbox
      executor: {
        provider: 'e2b',
        pooled: false, // New sandbox per thread
      },
      // Auto-destroy after 30 min of inactivity
      inactivityTimeout: 1000 * 60 * 30,
      // Max 10 concurrent reviews
      maxConcurrent: 10,
    },
  },
});

// Usage:
async function reviewCode() {
  // Thread 1: Review Python code
  const review1 = await isolatedCodeReviewer.generate({
    messages: [{ role: 'user', content: 'Review this Python code: def add(a, b): return a + b' }],
    threadId: 'review-python-123',
  });

  // Thread 2: Review JavaScript code (completely isolated from Thread 1)
  const review2 = await isolatedCodeReviewer.generate({
    messages: [{ role: 'user', content: 'Review this JS code: const add = (a, b) => a + b;' }],
    threadId: 'review-js-456',
  });

  // Each thread has its own /code and /review directories
  // They cannot see each other's files
}

// =============================================================================
// Example 2: Persistent Thread Workspaces
// =============================================================================

/**
 * Thread workspaces that persist to disk, allowing resumption of work.
 * Perfect for: research projects, documentation, long-running tasks.
 */
const researchAgent = new Agent({
  id: 'researcher',
  name: 'Research Agent',
  model: 'openai/gpt-4o',
  instructions: `
    You are a research assistant. 
    - Save research notes to /research/
    - Save summaries to /summaries/
    - Track your progress in workspace state
    Your workspace persists between conversations on the same topic.
  `,

  workspace: {
    scope: 'thread',
    thread: {
      enabled: true,
      // AgentFS with thread-specific database files
      filesystem: {
        provider: 'agentfs',
        // Each thread gets: .agentfs/researcher/thread-{threadId}.db
        pathPattern: '.agentfs/researcher/thread-{threadId}.db',
        ephemeral: false, // Persist to disk
      },
      // No executor needed for research
      executor: undefined,
      // Keep workspace for 7 days of inactivity
      inactivityTimeout: 1000 * 60 * 60 * 24 * 7,
    },
  },
});

// Usage:
async function conductResearch() {
  // Day 1: Start research on quantum computing
  await researchAgent.generate({
    messages: [{ role: 'user', content: 'Research quantum computing fundamentals' }],
    threadId: 'quantum-research-2024',
  });
  // Agent saves notes to /research/quantum-fundamentals.md

  // Day 2: Continue the research (same threadId = same workspace)
  await researchAgent.generate({
    messages: [{ role: 'user', content: 'Now research quantum error correction' }],
    threadId: 'quantum-research-2024',
  });
  // Agent reads previous notes, adds new research

  // Different thread = different workspace
  await researchAgent.generate({
    messages: [{ role: 'user', content: 'Research machine learning basics' }],
    threadId: 'ml-research-2024',
  });
  // Completely separate workspace, can't see quantum research
}

// =============================================================================
// Example 3: Hybrid Workspace (Shared + Isolated)
// =============================================================================

/**
 * Agent-level workspace for shared resources + thread-level for isolation.
 * Perfect for: development environments, shared knowledge bases.
 */
const developerAgent = new Agent({
  id: 'developer',
  name: 'Full-Stack Developer',
  model: 'anthropic/claude-sonnet',
  instructions: `
    You have two workspaces:
    
    SHARED (agent workspace at /shared):
    - /shared/templates/ - Reusable code templates
    - /shared/docs/ - Documentation you've written
    - /shared/learnings.md - Things you've learned across all projects
    
    PROJECT (thread workspace at /project):
    - /project/src/ - Project source code
    - /project/tests/ - Project tests
    - This is isolated per conversation/project
    
    Use templates from /shared when starting new projects.
    Save reusable patterns back to /shared/templates.
  `,

  workspace: {
    scope: 'hybrid',

    // Shared across all threads
    agent: {
      id: 'developer-shared',
      filesystem: {
        provider: 'agentfs',
        id: 'developer-shared-fs',
        path: '.agentfs/developer-shared.db',
      },
      // No executor at agent level (execution happens in thread)
    },

    // Isolated per thread
    thread: {
      enabled: true,
      filesystem: {
        provider: 'agentfs',
        pathPattern: '.agentfs/developer/projects/{threadId}.db',
      },
      executor: {
        provider: 'e2b',
        pooled: true, // Reuse sandboxes across threads
        poolSize: 5,
      },
      inactivityTimeout: 1000 * 60 * 60, // 1 hour

      // Initialize each project from a template
      template: {
        source: '/templates/node-project',
        paths: ['package.json', 'tsconfig.json', '.gitignore'],
      },

      // Lifecycle hooks
      onCreate: async (workspace, threadId) => {
        console.log(`Created project workspace for thread: ${threadId}`);
        // Could notify, log, etc.
      },
      onDestroy: async (workspace, threadId) => {
        console.log(`Destroying project workspace for thread: ${threadId}`);
        // Could backup, archive, etc.
      },
    },
  },
});

// Usage:
async function developProject() {
  // Project A: Build a REST API
  await developerAgent.generate({
    messages: [{ role: 'user', content: 'Create a REST API with Express' }],
    threadId: 'project-rest-api',
  });
  // Agent:
  // - Copies template from /shared/templates/express-api
  // - Writes code to /project/src/
  // - Runs tests in executor
  // - Saves reusable patterns to /shared/templates/

  // Project B: Build a CLI tool (different thread = different /project)
  await developerAgent.generate({
    messages: [{ role: 'user', content: 'Create a CLI tool with Commander' }],
    threadId: 'project-cli-tool',
  });
  // Agent:
  // - Fresh /project workspace
  // - Still has access to /shared (can reuse learnings)
  // - Separate sandbox for execution
}

// =============================================================================
// Example 4: Pooled Executors for Efficiency
// =============================================================================

/**
 * Data science agent with pooled executors for efficiency.
 * Sandboxes are expensive - pooling reuses them across threads.
 */
const dataScientist = new Agent({
  id: 'data-scientist',
  name: 'Data Scientist',
  model: 'anthropic/claude-sonnet',
  instructions: `
    You analyze data and create visualizations.
    - Save data to /data/
    - Save scripts to /scripts/
    - Save outputs to /output/
    - Execute Python code for analysis
  `,

  workspace: {
    scope: 'thread',
    thread: {
      enabled: true,
      // Each thread gets isolated filesystem
      filesystem: {
        provider: 'memory',
        ephemeral: true,
      },
      // But executors are pooled and reused
      executor: {
        provider: 'e2b',
        pooled: true,
        poolSize: 3, // Max 3 warm sandboxes
      },
      maxConcurrent: 20, // Can handle 20 concurrent analyses
    },
  },
});

// =============================================================================
// Example 5: Workspace Lifecycle Management
// =============================================================================

async function workspaceLifecycle() {
  const mastra = new Mastra({
    agents: { developerAgent, researchAgent },
  });

  // List all active workspaces
  const workspaces = await mastra.listWorkspaces({
    agentId: 'developer',
    status: 'ready',
  });

  console.log(`Active workspaces: ${workspaces.length}`);

  // Get specific thread workspace
  const projectWorkspace = await mastra.getThreadWorkspace('developer', 'project-rest-api');

  if (projectWorkspace) {
    // Snapshot the project
    const snapshot = await projectWorkspace.snapshot({
      name: 'before-refactor',
      includeExecutor: false,
    });

    // Do something risky...
    try {
      await developerAgent.generate({
        messages: [{ role: 'user', content: 'Refactor everything to use async/await' }],
        threadId: 'project-rest-api',
      });
    } catch (error) {
      // Restore if something went wrong
      await projectWorkspace.restore(snapshot);
    }
  }

  // Clean up old/inactive workspaces
  const cleaned = await mastra.cleanupWorkspaces({
    maxInactive: 1000 * 60 * 60 * 24, // Inactive for 24 hours
  });
  console.log(`Cleaned up ${cleaned} workspaces`);

  // Explicitly destroy a thread workspace
  await mastra.destroyThreadWorkspace('developer', 'project-rest-api');
}

// =============================================================================
// Example 6: Accessing Workspace in Tools
// =============================================================================

import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Tools receive workspace context and can access files/executor.
 */
const analyzeFileTool = createTool({
  id: 'analyze-file',
  description: 'Analyze a file from the workspace',
  inputSchema: z.object({
    path: z.string().describe('Path to the file to analyze'),
  }),
  execute: async ({ path }, context) => {
    // Access workspace from context
    const workspace = context?.workspace;

    if (!workspace?.fs) {
      return { error: 'No workspace filesystem available' };
    }

    // Read file from workspace
    const content = await workspace.readFile(path, { encoding: 'utf-8' });

    // If executor is available, run analysis
    if (workspace.executor) {
      const result = await workspace.executeCode(
        `
        import ast
        code = '''${content}'''
        tree = ast.parse(code)
        print(f"Functions: {len([n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)])}")
        print(f"Classes: {len([n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)])}")
      `,
        { runtime: 'python' },
      );

      return {
        path,
        size: content.length,
        analysis: result.stdout,
      };
    }

    return {
      path,
      size: content.length,
      lines: content.split('\n').length,
    };
  },
});

// =============================================================================
// Example 7: Workspace in Agent Instructions (Dynamic)
// =============================================================================

/**
 * Agent instructions can be dynamic and include workspace state.
 */
const adaptiveAgent = new Agent({
  id: 'adaptive',
  name: 'Adaptive Agent',
  model: 'openai/gpt-4o',

  // Dynamic instructions that include workspace context
  instructions: async ({ requestContext }) => {
    const workspace = requestContext.get('workspace') as Workspace | undefined;

    let workspaceInfo = 'You do not have a workspace.';

    if (workspace?.fs) {
      const files = await workspace.readdir('/');
      const hasExecutor = !!workspace.executor;

      workspaceInfo = `
Your workspace contains:
${files.map((f) => `- ${f.type === 'directory' ? '📁' : '📄'} ${f.name}`).join('\n')}

${hasExecutor ? 'You can execute code using the sandbox.' : 'You cannot execute code (no sandbox available).'}
      `;
    }

    return `
You are an adaptive assistant.

WORKSPACE STATUS:
${workspaceInfo}

Help the user with their tasks using your workspace capabilities.
    `;
  },

  workspace: {
    scope: 'thread',
    thread: {
      enabled: true,
      filesystem: { provider: 'memory', ephemeral: true },
      executor: { provider: 'e2b', pooled: true, poolSize: 2 },
    },
  },
});
