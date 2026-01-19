# Task 22: Documentation

## Summary

Create comprehensive documentation for the Agent Inbox feature.

## Files to Create

### Reference Docs

```
docs/src/pages/docs/inbox/
  overview.mdx
  quick-start.mdx
  task-lifecycle.mdx
  github-inbox.mdx
  linear-inbox.mdx
  human-in-the-loop.mdx
  production.mdx
  api-reference.mdx
```

### Examples

```
examples/inbox/
  basic-worker/
    package.json
    src/index.ts
    README.md
  github-agent/
    package.json
    src/index.ts
    src/mastra.ts
    README.md
  multi-agent/
    package.json
    src/index.ts
    README.md
  human-approval/
    package.json
    src/index.ts
    README.md
```

---

## Documentation Content

### 1. overview.mdx

```mdx
# Agent Inbox

Agent Inbox is a task queue system for Mastra agents. Submit tasks, have agents work on them.

## When to Use

- GitHub issues that need AI responses
- Linear tickets for automated triage
- Background processing jobs
- Multi-step workflows with human checkpoints

## Key Concepts

- **Task**: A unit of work with payload and result
- **Inbox**: A queue that receives tasks (via webhooks or API)
- **Agent.run()**: Continuously processes tasks from inbox(es)

## Architecture

[Diagram showing: Sources → Storage → Agent → Result]
```

### 2. quick-start.mdx

```mdx
# Quick Start

Get an agent processing tasks in 5 minutes.

## Installation

\`\`\`bash
pnpm add @mastra/core
\`\`\`

## Basic Setup

\`\`\`typescript
import { Mastra, Agent, Inbox } from '@mastra/core';

const inbox = new Inbox({ id: 'tasks' });

const agent = new Agent({
id: 'worker',
instructions: 'Process tasks',
model: openai('gpt-4o'),
});

const mastra = new Mastra({
storage: new PostgresStore({ connectionString: '...' }),
agents: { worker: agent },
inboxes: { tasks: inbox },
});

// Add a task
await inbox.add({
type: 'summarize',
payload: { text: 'Long document...' },
});

// Start processing
await agent.run({ inbox });
\`\`\`
```

### 3. task-lifecycle.mdx

```mdx
# Task Lifecycle

## States

\`\`\`
pending → claimed → in_progress → completed
→ failed (retry?) → pending
→ waiting_for_input → in_progress
→ cancelled
\`\`\`

## State Descriptions

| State             | Description                    |
| ----------------- | ------------------------------ |
| pending           | Waiting to be claimed          |
| claimed           | Agent has claimed, not started |
| in_progress       | Agent is processing            |
| waiting_for_input | Paused for human input         |
| completed         | Successfully finished          |
| failed            | Failed (may retry)             |
| cancelled         | Manually cancelled             |

## Retries

Tasks retry with exponential backoff...

## Claiming

Tasks are claimed atomically...
```

### 4. github-inbox.mdx

```mdx
# GitHub Inbox

Turn GitHub issues into tasks for your agent.

## Installation

\`\`\`bash
pnpm add @mastra/inbox-github
\`\`\`

## Setup

### 1. Create GitHubInbox

\`\`\`typescript
import { GitHubInbox } from '@mastra/inbox-github';

const inbox = new GitHubInbox({
id: 'github',
owner: 'your-org',
repo: 'your-repo',
token: process.env.GITHUB_TOKEN,
secret: process.env.GITHUB_WEBHOOK_SECRET,
filter: { labels: ['needs-agent'] },
onComplete: async (task, result) => {
// Comment on issue
},
});
\`\`\`

### 2. Configure Webhook

In GitHub repo settings:

- URL: `https://your-app.com/api/webhooks/github`
- Secret: Your GITHUB_WEBHOOK_SECRET
- Events: Issues

### 3. Wire Up Endpoint

\`\`\`typescript
// app/api/webhooks/github/route.ts
export async function POST(req: Request) {
return inbox.handleWebhook(req);
}
\`\`\`

### 4. Initial Backfill

\`\`\`typescript
await inbox.sync();
\`\`\`

### 5. Start Agent

\`\`\`typescript
await agent.run({ inbox });
\`\`\`
```

### 5. human-in-the-loop.mdx

```mdx
# Human-in-the-Loop

Pause tasks to get human approval or input.

## How It Works

1. Agent encounters situation needing human input
2. Agent calls suspend tool
3. Task enters `waiting_for_input` state
4. Human provides input via UI or API
5. Task resumes processing

## Example

\`\`\`typescript
const agent = new Agent({
instructions: \`
Review code changes.
If changes are risky, request human approval.
\`,
});

// When agent calls suspend:
// Task status → waiting_for_input
// suspendPayload: { reason: "Approve DB migration?", ... }

// Human approves via API:
await inbox.resume(taskId, {
payload: { approved: true }
});

// Task continues processing
\`\`\`
```

### 6. production.mdx

```mdx
# Production Deployment

## Worker Process

\`\`\`typescript
// worker.ts
const agent = mastra.getAgent('support');

process.on('SIGTERM', () => agent.stop());

await agent.run({
inbox: mastra.getInbox('github'),
maxConcurrent: 3,
});
\`\`\`

## Serverless (Cron)

\`\`\`typescript
// app/api/cron/process/route.ts
export async function GET() {
const results = await agent.processBatch({
inbox,
limit: 5,
timeout: 25_000,
});
return Response.json({ processed: results.length });
}
\`\`\`

## Scaling

- Multiple workers can run in parallel
- Atomic claiming prevents duplicate processing
- Use maxConcurrent to control parallelism
```

### 7. api-reference.mdx

```mdx
# API Reference

## Inbox

### Constructor

\`\`\`typescript
new Inbox(config: InboxConfig)
\`\`\`

### Methods

| Method                   | Description     |
| ------------------------ | --------------- |
| add(input)               | Add a task      |
| claim(agentId, filter?)  | Claim next task |
| complete(taskId, result) | Mark complete   |
| fail(taskId, error)      | Mark failed     |
| suspend(taskId, input)   | Pause for human |
| resume(taskId, input)    | Continue task   |
| list(filter?)            | List tasks      |
| stats()                  | Get counts      |

## Task

[Full Task interface...]

## GitHubInbox

[GitHubInbox specific API...]
```

---

## Examples

### basic-worker/src/index.ts

```typescript
import { Mastra, Agent, Inbox } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

const inbox = new Inbox({ id: 'tasks' });

const agent = new Agent({
  id: 'worker',
  instructions: 'You process tasks. Return a JSON result.',
  model: openai('gpt-4o'),
});

const mastra = new Mastra({
  agents: { worker: agent },
  inboxes: { tasks: inbox },
});

// Add some tasks
await inbox.add({ type: 'greet', payload: { name: 'Alice' } });
await inbox.add({ type: 'greet', payload: { name: 'Bob' } });

// Process
await agent.run({
  inbox,
  onTaskComplete: (task, result) => {
    console.log(`Done: ${task.id}`, result);
  },
});
```

### github-agent/src/index.ts

```typescript
import { Mastra, Agent } from '@mastra/core';
import { GitHubInbox } from '@mastra/inbox-github';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const inbox = new GitHubInbox({
  id: 'github',
  owner: 'acme',
  repo: 'support',
  token: process.env.GITHUB_TOKEN!,
  secret: process.env.GITHUB_WEBHOOK_SECRET!,
  filter: { labels: ['needs-agent'] },
  onComplete: async (task, result) => {
    await octokit.issues.createComment({
      owner: 'acme',
      repo: 'support',
      issue_number: task.payload.issueNumber,
      body: result.text,
    });
  },
});

const agent = new Agent({
  id: 'support',
  instructions: 'You are a helpful support agent.',
  model: openai('gpt-4o'),
});

const mastra = new Mastra({
  agents: { support: agent },
  inboxes: { github: inbox },
});

// Backfill existing issues
await inbox.sync();

// Start processing
await agent.run({ inbox });
```

## Acceptance Criteria

- [ ] All doc pages created
- [ ] Quick start works end-to-end
- [ ] GitHub integration documented
- [ ] Human-in-the-loop documented
- [ ] Production patterns documented
- [ ] API reference complete
- [ ] All examples run successfully
- [ ] Examples have README files
