# Building OpenClaw with Mastra Primitives

## Overview

This document explores how the core architectural patterns of [OpenClaw](https://docs.openclaw.ai/) — an open-source autonomous AI agent platform — map onto Mastra's primitive building blocks. The goal is not to replicate OpenClaw verbatim, but to understand which Mastra primitives naturally fulfill each architectural responsibility, where Mastra's abstractions provide stronger guarantees, and what gaps would need to be filled.

OpenClaw's architecture centers around a **Gateway** process that routes messages from multiple channels (WhatsApp, Telegram, Discord, Slack, etc.) through an LLM-powered **Agent Runtime** with access to **Tools**, **Memory**, and **Plugins**. It runs as a self-hosted, long-lived process.

---

## Architecture Comparison

| OpenClaw Concept | Mastra Primitive | Notes |
|---|---|---|
| Gateway (Control Plane) + Agent Runtime | **`Harness`** | The single most important mapping. Harness is the orchestration layer for multi-mode agents with state, events, thread management, tool approvals, and display state. |
| Agent Runtime (per-mode) | `Agent` | Individual agent personalities/capabilities wrapped by Harness modes |
| Dependency injection / wiring | `Mastra` class | Registry that connects agents, tools, storage, memory |
| Tools system + tool profiles | `Tool` / `createTool()` + Harness permission system | Type-safe tools with category-based allow/deny policies |
| Plugins / Skills | MCP Servers + Toolsets | Extensible tool registration via open standard |
| Memory (persistence) | `Memory` + `Storage` | Thread-based conversations, semantic recall, working memory |
| Session management | Harness threads + Resources | Thread-per-session with resource-scoped state, thread locking |
| Queue modes (steer/followup/collect) | Harness `steer()` / `followUp()` | Built-in message queueing during active agent runs |
| User interaction (questions, approvals) | Harness built-in tools (`ask_user`, `submit_plan`) | Pause execution, wait for user response |
| Task tracking | Harness built-in tools (`task_write`, `task_check`) | Structured task lists with status tracking |
| Multi-channel messaging | Custom tools + Input/Output Processors | Channel abstraction via processors |
| Workspace / file system | `Workspace` (via Harness) | File storage and code execution |
| Multi-agent delegation | Harness subagents + Supervisor / Network patterns | Scoped subagents with constrained tools |
| Configuration files (USER.md, IDENTITY.md) | `instructions` (dynamic) | Agent instructions, dynamically resolved per-request |
| Display state / UI updates | Harness `DisplayState` + event system | Canonical state snapshot with 35+ event types |
| Model switching | Harness `switchModel()` | Runtime model changes scoped to thread, mode, or global |
| Cron / scheduling | Harness heartbeat handlers | Periodic background tasks |
| Workflow orchestration | `Workflow` / `createWorkflow()` | Step-based execution with suspend/resume |

---

## 1. The Gateway + Agent Runtime — `Harness` as the Orchestration Layer

OpenClaw's Gateway is the central process through which all operations flow: it manages channel connections, routes messages, orchestrates the agent runtime, handles message queueing (steer/followup/collect), manages sessions, and provides the control surface that UIs drive. In Mastra, the **`Harness`** primitive is the direct analog — it's the orchestration layer that wraps agents, manages threads, handles state, provides built-in interactive tools, and emits events for UI consumption.

The Harness is the single most important mapping in this exploration. Where previous sections showed individual primitives (Agent, Tool, Memory), the Harness is what composes them into a coherent application — exactly what OpenClaw's Gateway does.

### Harness as OpenClaw's Gateway

```typescript
import { Harness } from '@mastra/core/harness';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

const storage = new LibSQLStore({
  id: 'openclaw-storage',
  url: process.env.DATABASE_URL!,
});

const memory = new Memory({
  options: {
    lastMessages: 40,
    semanticRecall: { topK: 5, messageRange: { before: 2, after: 2 } },
    workingMemory: {
      enabled: true,
      template: `
## User Profile
- Name: {{name}}
- Preferences: {{preferences}}

## Active Tasks
{{tasks}}

## Context
{{context}}
      `,
    },
  },
});

const gateway = new Harness({
  id: 'openclaw',
  resourceId: 'default-workspace',
  storage,
  memory,

  // State schema — typed, validated, persisted to thread metadata.
  // Replaces OpenClaw's ad-hoc workspace state files.
  stateSchema: z.object({
    currentModelId: z.string().optional(),
    activeChannel: z.string().optional(),
    yolo: z.boolean().optional(), // auto-approve all tool calls
  }),
  initialState: { yolo: false },

  // Modes — different agent personalities for different tasks.
  // OpenClaw has a single runtime; Harness lets you switch between
  // specialized agents without restarting.
  modes: [
    {
      id: 'default',
      name: 'Assistant',
      default: true,
      agent: clawAgent,
      defaultModelId: 'anthropic/claude-sonnet-4-20250514',
    },
    {
      id: 'coding',
      name: 'Coding',
      agent: coderAgent,
      defaultModelId: 'anthropic/claude-sonnet-4-20250514',
    },
    {
      id: 'research',
      name: 'Research',
      agent: researchAgent,
      defaultModelId: 'openai/gpt-4o',
    },
  ],

  // Subagents — focused agents that the primary agent can spawn.
  // These run independently with constrained tool sets.
  subagents: [
    {
      id: 'explore',
      name: 'Explorer',
      instructions: 'You explore the workspace and gather context.',
      tools: { fileRead: fileReadTool, webSearch: webSearchTool },
    },
    {
      id: 'execute',
      name: 'Executor',
      instructions: 'You execute specific tasks with full tool access.',
      tools: { fileRead: fileReadTool, fileWrite: fileWriteTool, execBash: execBashTool },
    },
  ],

  // Shared tools available across all modes
  tools: {
    webSearch: webSearchTool,
    webFetch: webFetchTool,
    sendMessage: sendMessageTool,
    fileRead: fileReadTool,
    fileWrite: fileWriteTool,
    execBash: execBashTool,
  },

  // Tool permission policies — replaces OpenClaw's tool profiles.
  // Categories: 'read', 'edit', 'execute', 'mcp', 'other'
  toolCategoryResolver: (toolName) => {
    if (['file-read', 'web-search', 'web-fetch'].includes(toolName)) return 'read';
    if (['file-write'].includes(toolName)) return 'edit';
    if (['exec-bash'].includes(toolName)) return 'execute';
    return 'other';
  },

  // Model discovery and switching
  resolveModel: (modelId) => {
    // Return the appropriate model instance for any model ID
    return createModelInstance(modelId);
  },

  // Workspace — the agent's working directory
  workspace: { root: '/workspace', type: 'local' },

  // Heartbeat handlers — periodic background tasks (replaces OpenClaw's cron tool)
  heartbeatHandlers: [
    {
      id: 'sync-channels',
      intervalMs: 5 * 60 * 1000, // every 5 minutes
      handler: async (harness) => {
        await syncChannelConnections();
      },
    },
  ],

  // Thread locking — multi-process safety for concurrent access
  threadLock: {
    acquire: async (threadId) => acquireLock(threadId),
    release: async (threadId) => releaseLock(threadId),
  },
});

await gateway.init();
```

### How the Harness Maps to OpenClaw's Gateway Features

The Harness provides built-in primitives for several OpenClaw features that would otherwise need to be built from scratch:

**Message queueing** — OpenClaw supports queue modes (`steer`, `followup`, `collect`) for handling messages during active agent runs. The Harness has this built-in:

```typescript
// Steer — inject instruction mid-stream (like OpenClaw's "steer" mode)
await gateway.steer({ content: 'Focus on the security implications' });

// Follow-up — queue a message to run after the current turn completes
await gateway.followUp({ content: 'Also check the test coverage' });

// Abort — cancel the current operation
await gateway.abort();
```

**Interactive tools** — OpenClaw's agent can ask the user questions and wait for responses. The Harness provides `ask_user` and `submit_plan` as built-in tools:

```typescript
// These tools are automatically available to all agents in the Harness.
// The agent calls ask_user → Harness emits 'ask_question' event →
// UI presents question to user → user responds → agent continues.

// No need to build this yourself — it's a primitive.
```

**Task tracking** — OpenClaw's agents track tasks. The Harness provides `task_write` and `task_check`:

```typescript
// The agent can call task_write to create/update a structured task list.
// The Harness tracks tasks in DisplayState and emits 'task_updated' events.
// UIs can render the task list in real-time.
```

**Display state** — OpenClaw's UI needs to know what the agent is doing. The Harness provides a canonical `DisplayState` snapshot:

```typescript
// Subscribe to all events for real-time UI updates
const unsubscribe = gateway.subscribe((event) => {
  switch (event.type) {
    case 'message_update':
      // Stream text to UI
      break;
    case 'tool_start':
      // Show tool execution in UI
      break;
    case 'tool_approval_required':
      // Show approval dialog
      break;
    case 'ask_question':
      // Show question dialog
      break;
    case 'task_updated':
      // Update task list in UI
      break;
    case 'display_state_changed':
      // Full state refresh
      break;
  }
});

// Or get a snapshot
const state = gateway.getDisplayState();
// → { activeTools, messages, tokenUsage, tasks, pendingApprovals, ... }
```

**Tool approvals** — OpenClaw's device-pairing approval model maps to the Harness's permission system:

```typescript
// Category-level policies
gateway.setPermissionForCategory({ category: 'read', policy: 'allow' });
gateway.setPermissionForCategory({ category: 'execute', policy: 'ask' });

// Tool-level overrides
gateway.setPermissionForTool({ toolName: 'exec-bash', policy: 'ask' });

// Session-level grants (approve once, allow for rest of session)
gateway.grantSessionCategory({ category: 'edit' });
gateway.grantSessionTool({ toolName: 'file-write' });

// Respond to individual approval requests
gateway.respondToToolApproval({ decision: 'approve' });
```

**Model switching** — OpenClaw supports switching LLMs at runtime. The Harness provides this with scoping:

```typescript
// Switch model for current thread only
await gateway.switchModel({ modelId: 'openai/gpt-4o', scope: 'thread' });

// Switch model for a specific mode
await gateway.switchModel({ modelId: 'anthropic/claude-sonnet-4-20250514', modeId: 'coding' });

// List available models with auth status
const models = await gateway.listAvailableModels();
// → [{ id: 'openai/gpt-4o', hasAuth: true }, { id: 'anthropic/...', hasAuth: true }, ...]
```

### The `Mastra` Class as Dependency Injection Hub

While the Harness is the runtime orchestrator, the `Mastra` class still serves as the dependency injection layer that wires components together:

```typescript
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  agents: { claw: clawAgent, coder: coderAgent, researcher: researchAgent },
  tools: {
    webSearch: webSearchTool,
    fileRead: fileReadTool,
    fileWrite: fileWriteTool,
    execBash: execBashTool,
  },
  memory: { default: memory },
  storage,
  workflows: { researchAndReport: researchWorkflow },
});
```

**Key insight**: OpenClaw's Gateway is an imperative, monolithic process. Mastra splits the concern into two layers: `Mastra` (declarative DI — what components exist) and `Harness` (runtime orchestration — how they interact). This separation means you can have multiple Harness instances sharing the same Mastra infrastructure, e.g., one per user or per project.

---

## 2. Agent Runtime — `Agent` with Dynamic Instructions

OpenClaw's agent runtime uses bootstrap files (`USER.md`, `IDENTITY.md`, `SOUL.md`) injected into the workspace to configure behavior. Mastra's `Agent` supports dynamic instructions that can be resolved per-request, giving the same flexibility with stronger type safety.

```typescript
import { Agent } from '@mastra/core/agent';

const clawAgent = new Agent({
  id: 'claw',
  name: 'OpenClaw Agent',
  model: 'anthropic/claude-sonnet-4-20250514',

  // Dynamic instructions — resolved per-request, equivalent to OpenClaw's
  // USER.md + IDENTITY.md + SOUL.md bootstrap files
  instructions: async (requestContext) => {
    const channelId = requestContext?.channelId;
    const userId = requestContext?.userId;

    const identity = `You are Claw, an autonomous AI assistant.
You can execute tasks, search the web, manage files, and communicate
across messaging platforms.`;

    const channelRules = getChannelRules(channelId);
    const userProfile = await loadUserProfile(userId);

    return `${identity}

## Channel Rules
${channelRules}

## User Profile
${userProfile}

## Capabilities
- Execute shell commands and scripts
- Read, write, and edit files
- Search the web and fetch pages
- Send messages across channels
- Remember context across conversations`;
  },

  // Tools available to the agent — equivalent to OpenClaw's tool profiles
  tools: {
    webSearch: webSearchTool,
    webFetch: webFetchTool,
    sendMessage: sendMessageTool,
    execBash: execBashTool,
    fileRead: fileReadTool,
    fileWrite: fileWriteTool,
  },

  memory,
});
```

**What Mastra adds**: OpenClaw's bootstrap files are static markdown injected at startup. Mastra's `instructions` can be an async function receiving request context, meaning the agent's personality, rules, and knowledge can adapt per-channel, per-user, or per-session without restarting.

---

## 3. Tools System — `createTool()` with Type Safety

OpenClaw exposes tools across domains: file system, web, runtime, messaging, memory. Mastra's `createTool()` provides the same categorization with added benefits: Zod schema validation for inputs/outputs, suspend/resume for long-running operations, and approval workflows.

### File System Tools

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

const fileReadTool = createTool({
  id: 'file-read',
  description: 'Read a file from the workspace',
  inputSchema: z.object({
    path: z.string().describe('Relative path within the workspace'),
    encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  }),
  outputSchema: z.object({
    content: z.string(),
    size: z.number(),
  }),
  execute: async ({ path, encoding }, context) => {
    const workspace = context?.mastra?.getWorkspace();
    const fullPath = resolve(workspace?.root ?? '.', path);
    const content = await readFile(fullPath, encoding);
    return { content, size: content.length };
  },
});

const fileWriteTool = createTool({
  id: 'file-write',
  description: 'Write content to a file in the workspace',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
    createDirs: z.boolean().default(true),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    bytesWritten: z.number(),
  }),
  // Require human approval for file writes — OpenClaw's device-pairing
  // approval model mapped to Mastra's tool approval primitive
  requireApproval: true,
  execute: async ({ path, content, createDirs }) => {
    await writeFile(path, content, 'utf-8');
    return { success: true, bytesWritten: content.length };
  },
});
```

### Shell Execution Tool (with Suspend/Resume)

```typescript
const execBashTool = createTool({
  id: 'exec-bash',
  description: 'Execute a shell command',
  inputSchema: z.object({
    command: z.string(),
    cwd: z.string().optional(),
    timeout: z.number().default(30000),
  }),
  outputSchema: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number(),
  }),
  // Suspend schema for long-running commands — the agent can check back later
  suspendSchema: z.object({
    pid: z.number(),
    reason: z.string(),
  }),
  resumeSchema: z.object({
    action: z.enum(['wait', 'kill', 'signal']),
    signal: z.string().optional(),
  }),
  requireApproval: true,
  execute: async ({ command, cwd, timeout }, context) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? error.message,
        exitCode: error.code ?? 1,
      };
    }
  },
});
```

### Web Tools

```typescript
const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string(),
    numResults: z.number().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
  execute: async ({ query, numResults }) => {
    const response = await fetch(
      `https://api.search-provider.com/search?q=${encodeURIComponent(query)}&n=${numResults}`,
      { headers: { Authorization: `Bearer ${process.env.SEARCH_API_KEY}` } },
    );
    const data = await response.json();
    return { results: data.results };
  },
});

const webFetchTool = createTool({
  id: 'web-fetch',
  description: 'Fetch and extract content from a URL',
  inputSchema: z.object({
    url: z.string().url(),
    selector: z.string().optional().describe('CSS selector to extract specific content'),
  }),
  outputSchema: z.object({
    content: z.string(),
    title: z.string().optional(),
    statusCode: z.number(),
  }),
  execute: async ({ url, selector }) => {
    const response = await fetch(url);
    const html = await response.text();
    // Content extraction logic here
    return {
      content: extractText(html, selector),
      title: extractTitle(html),
      statusCode: response.status,
    };
  },
});
```

### Tool Profiles (Allow/Deny Policies)

OpenClaw supports tool profiles (`full`, `messaging`, `coding`, `minimal`) that control which tools an agent can access. In Mastra, this maps to two complementary mechanisms:

**1. Harness permission system** — Category-based policies with session grants (the primary mechanism):

```typescript
const gateway = new Harness({
  // ...
  toolCategoryResolver: (toolName) => {
    if (['file-read', 'web-search', 'web-fetch'].includes(toolName)) return 'read';
    if (['file-write'].includes(toolName)) return 'edit';
    if (['exec-bash'].includes(toolName)) return 'execute';
    if (['send-message'].includes(toolName)) return 'other';
    return 'mcp';
  },
});

// Set policies per category: 'allow', 'ask', or 'deny'
gateway.setPermissionForCategory({ category: 'read', policy: 'allow' });
gateway.setPermissionForCategory({ category: 'edit', policy: 'ask' });
gateway.setPermissionForCategory({ category: 'execute', policy: 'ask' });

// Grant broad access for a session (like OpenClaw's "yolo" mode)
gateway.grantSessionCategory({ category: 'edit' });
gateway.grantSessionCategory({ category: 'execute' });
```

**2. Dynamic tool resolution on the Agent** — For per-request tool filtering:

```typescript
type ToolProfile = 'full' | 'messaging' | 'coding' | 'minimal';

const TOOL_PROFILES: Record<ToolProfile, string[]> = {
  full: ['file-read', 'file-write', 'exec-bash', 'web-search', 'web-fetch', 'send-message'],
  messaging: ['send-message', 'web-search'],
  coding: ['file-read', 'file-write', 'exec-bash', 'web-search'],
  minimal: ['web-search'],
};

const profiledAgent = new Agent({
  id: 'profiled-claw',
  name: 'Profiled Agent',
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: 'You are an assistant with role-based tool access.',
  tools: async (requestContext) => {
    const profile = requestContext?.toolProfile ?? 'minimal';
    const allowed = TOOL_PROFILES[profile];
    const allTools = { webSearch: webSearchTool, fileRead: fileReadTool, /* ... */ };
    return Object.fromEntries(
      Object.entries(allTools).filter(([_, tool]) => allowed.includes(tool.id))
    );
  },
});
```

The Harness permission system is the more natural fit for OpenClaw's model because it operates at runtime (approve/deny individual tool calls) rather than at configuration time (filter which tools are available). This matches OpenClaw's behavior where tools are always _available_ but may require approval.
```

---

## 4. Memory System — Thread-Based Conversations with Semantic Recall

OpenClaw stores session transcripts as JSONL files and provides `memory_search` / `memory_get` tools. Mastra's memory system is significantly more structured: thread-based conversations, semantic recall via vector embeddings, and working memory for structured state that persists across turns.

```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    // Keep last 40 messages in context (OpenClaw default is similar)
    lastMessages: 40,

    // Semantic recall — when the agent needs context beyond the recent window,
    // it searches the vector store for semantically relevant past messages
    semanticRecall: {
      topK: 5,
      messageRange: { before: 2, after: 2 },
    },

    // Working memory — structured state that persists across turns.
    // This replaces OpenClaw's workspace-level state files.
    workingMemory: {
      enabled: true,
      template: `
## Current Task
- Description: {{taskDescription}}
- Status: {{taskStatus}}
- Steps completed: {{stepsCompleted}}

## User Preferences
- Language: {{language}}
- Timezone: {{timezone}}
- Notification channel: {{notificationChannel}}

## Session State
- Active channel: {{activeChannel}}
- Queue mode: {{queueMode}}
      `,
    },
  },
});
```

### Session Management via Threads

OpenClaw's session concept maps directly to Mastra's threads. Each conversation session is a thread, and threads can be associated with resources (users, channels):

```typescript
async function handleIncomingMessage(channelId: string, userId: string, message: string) {
  const agent = gateway.getAgent('claw');
  const threadId = `${channelId}:${userId}`;
  const resourceId = userId;

  const response = await agent.generate({
    prompt: message,
    threadId,
    resourceId,
    requestContext: {
      channelId,
      userId,
      toolProfile: getToolProfile(channelId),
    },
  });

  return response.text;
}
```

**What Mastra adds over OpenClaw's memory**:

1. **Semantic recall** — OpenClaw's `memory_search` is a tool the agent must explicitly call. Mastra's semantic recall is automatic: relevant past context is injected into the prompt via input processors without the agent needing to "decide" to search memory.

2. **Working memory** — Structured state (as opposed to raw conversation history) that the LLM maintains across turns. This replaces the ad-hoc state management OpenClaw does via workspace files.

3. **Resource scoping** — Memory can be scoped to a user across threads, not just per-session. A user's preferences and context carry across channels.

---

## 5. Multi-Channel Messaging — Processors and Channel Tools

OpenClaw's multi-channel gateway routes messages across WhatsApp, Telegram, Discord, Slack, and more. In Mastra, this can be modeled as a combination of:

1. **Input/Output Processors** — Transform messages between channel-specific formats and the agent's internal format
2. **Channel-specific tools** — Let the agent send messages back through specific channels
3. **A routing layer** — HTTP endpoints or webhooks that receive channel events

### Channel Abstraction

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface ChannelAdapter {
  id: string;
  sendMessage(to: string, content: string, options?: Record<string, unknown>): Promise<void>;
  formatIncoming(raw: unknown): { text: string; from: string; metadata: Record<string, unknown> };
}

// Channel registry — analogous to OpenClaw's channel configuration
const channels: Record<string, ChannelAdapter> = {};

function registerChannel(adapter: ChannelAdapter) {
  channels[adapter.id] = adapter;
}

// Telegram adapter
registerChannel({
  id: 'telegram',
  async sendMessage(chatId, content) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: content }),
    });
  },
  formatIncoming(raw: any) {
    return {
      text: raw.message?.text ?? '',
      from: String(raw.message?.chat?.id),
      metadata: { messageId: raw.message?.message_id },
    };
  },
});

// Discord adapter
registerChannel({
  id: 'discord',
  async sendMessage(channelId, content) {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
  },
  formatIncoming(raw: any) {
    return {
      text: raw.content ?? '',
      from: raw.channel_id,
      metadata: { author: raw.author?.id },
    };
  },
});

// Generic send-message tool that the agent can use to respond on any channel
const sendMessageTool = createTool({
  id: 'send-message',
  description: 'Send a message to a user on a specific channel',
  inputSchema: z.object({
    channel: z.string().describe('Channel ID (telegram, discord, slack, etc.)'),
    to: z.string().describe('Recipient identifier'),
    content: z.string().describe('Message content'),
  }),
  outputSchema: z.object({ sent: z.boolean() }),
  execute: async ({ channel, to, content }) => {
    const adapter = channels[channel];
    if (!adapter) throw new Error(`Unknown channel: ${channel}`);
    await adapter.sendMessage(to, content);
    return { sent: true };
  },
});
```

### Message Routing via Server Endpoints

```typescript
import { registerApiRoute } from '@mastra/server';

// Webhook endpoint for Telegram
const telegramWebhook = registerApiRoute('/webhooks/telegram', {
  method: 'POST',
  requiresAuth: false,
  handler: async (c) => {
    const mastra = c.get('mastra');
    const body = await c.req.json();
    const channel = channels['telegram'];
    const { text, from, metadata } = channel.formatIncoming(body);

    const agent = mastra.getAgent('claw');
    const threadId = `telegram:${from}`;

    const response = await agent.generate({
      prompt: text,
      threadId,
      resourceId: from,
      requestContext: {
        channelId: 'telegram',
        userId: from,
        toolProfile: 'messaging',
      },
    });

    await channel.sendMessage(from, response.text);
    return c.json({ ok: true });
  },
});

// Webhook endpoint for Discord
const discordWebhook = registerApiRoute('/webhooks/discord', {
  method: 'POST',
  requiresAuth: false,
  handler: async (c) => {
    const mastra = c.get('mastra');
    const body = await c.req.json();
    const channel = channels['discord'];
    const { text, from, metadata } = channel.formatIncoming(body);

    const agent = mastra.getAgent('claw');
    const threadId = `discord:${from}`;

    const response = await agent.generate({
      prompt: text,
      threadId,
      resourceId: metadata.author,
      requestContext: {
        channelId: 'discord',
        userId: metadata.author,
        toolProfile: 'full',
      },
    });

    await channel.sendMessage(from, response.text);
    return c.json({ ok: true });
  },
});
```

### Message Queueing — Harness Steer/FollowUp

OpenClaw supports queue modes (`steer`, `followup`, `collect`) for handling messages that arrive during an active agent run. The Harness provides this as a built-in primitive:

```typescript
// In the webhook handler, check if the agent is already running
async function handleIncomingMessage(channelId: string, userId: string, message: string) {
  if (gateway.isRunning()) {
    // Agent is mid-turn — use queue modes

    // "steer" — inject instruction into the current turn
    // (OpenClaw: message influences current reasoning)
    await gateway.steer({ content: message });

    // OR "followup" — queue for after current turn completes
    // (OpenClaw: message runs as a new turn after this one)
    await gateway.followUp({ content: message });

    return; // Don't start a new agent turn
  }

  // Agent is idle — start a new turn
  await gateway.sendMessage({ content: message });
}
```

For debouncing (batching rapid consecutive messages), the Harness doesn't provide a built-in mechanism, but it's straightforward to add as a thin layer:

```typescript
const messageBuffers = new Map<string, { messages: string[]; timer: NodeJS.Timeout }>();

function handleIncomingWithDebounce(channelId: string, userId: string, message: string) {
  const key = `${channelId}:${userId}`;
  const buffer = messageBuffers.get(key) ?? { messages: [], timer: null! };

  clearTimeout(buffer.timer);
  buffer.messages.push(message);

  buffer.timer = setTimeout(async () => {
    const combined = buffer.messages.join('\n');
    messageBuffers.delete(key);

    if (gateway.isRunning()) {
      await gateway.followUp({ content: combined });
    } else {
      await gateway.sendMessage({ content: combined });
    }
  }, 1500);

  messageBuffers.set(key, buffer);
}
```

---

## 6. Plugins and Skills — MCP Servers as the Extension Model

OpenClaw's plugin system lets third parties register additional tools. This maps directly to Mastra's MCP (Model Context Protocol) integration, which provides a standardized way to expose and consume tool collections.

### Consuming External Tool Providers (MCP Client)

```typescript
import { MastraMCPClient } from '@mastra/mcp';

// Equivalent to OpenClaw's plugin installation
const mcpTools = new MastraMCPClient({
  servers: {
    // A file-system plugin
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    },
    // A browser automation plugin
    browser: {
      command: 'npx',
      args: ['-y', '@anthropic/mcp-server-puppeteer'],
    },
    // A remote plugin via HTTP
    customPlugin: {
      url: new URL('https://my-plugin-server.example.com/mcp'),
    },
  },
});

const gateway = new Mastra({
  agents: {
    claw: new Agent({
      id: 'claw',
      name: 'Claw',
      model: 'anthropic/claude-sonnet-4-20250514',
      instructions: 'You are an autonomous assistant with access to plugins.',
      // MCP tools are automatically available to the agent
      tools: async () => ({
        ...await mcpTools.getTools(),
        sendMessage: sendMessageTool,
      }),
    }),
  },
});
```

### Exposing Mastra Agents as MCP Servers

The inverse is also possible — expose your Mastra agents and tools as an MCP server that other systems can consume:

```typescript
import { MCPServer } from '@mastra/mcp';

const mcpServer = new MCPServer({
  name: 'openclaw-server',
  version: '1.0.0',
  tools: {
    webSearch: webSearchTool,
    fileRead: fileReadTool,
    sendMessage: sendMessageTool,
  },
  agents: {
    claw: clawAgent,
    coder: coderAgent,
  },
});

// Expose via stdio (for local tool use) or HTTP (for remote)
await mcpServer.startHTTP({ port: 3001 });
```

**Key insight**: OpenClaw's plugin system is proprietary — plugins must be written to OpenClaw's API. Mastra's MCP integration uses an open standard, meaning any MCP-compatible tool server works without adaptation. This is a significant advantage for ecosystem compatibility.

---

## 7. Multi-Agent Delegation — Harness Subagents, Supervisor, and Network Patterns

OpenClaw supports node-based delegation where the primary agent can spawn focused sub-tasks. Mastra provides three complementary mechanisms, with the Harness subagent model being the closest analog to OpenClaw's architecture.

### Harness Subagents (Closest to OpenClaw's Model)

The Harness's built-in `subagent` tool is the most direct mapping. Subagents are focused agents with constrained tool access that run independently and return their findings as text. This matches OpenClaw's node delegation model where the primary agent spawns specialized sub-tasks:

```typescript
const gateway = new Harness({
  id: 'openclaw',
  // ...
  modes: [
    { id: 'default', name: 'Assistant', default: true, agent: clawAgent },
  ],

  // Subagents — the primary agent gets a 'subagent' tool that can spawn these
  subagents: [
    {
      id: 'explore',
      name: 'Explorer',
      instructions: 'You explore codebases and gather context. Read files, search for patterns, and summarize findings.',
      tools: { fileRead: fileReadTool, webSearch: webSearchTool },
    },
    {
      id: 'plan',
      name: 'Planner',
      instructions: 'You create implementation plans. Analyze requirements and break them into actionable steps.',
      tools: { fileRead: fileReadTool, webSearch: webSearchTool },
    },
    {
      id: 'execute',
      name: 'Executor',
      instructions: 'You execute specific implementation tasks. Write code, run tests, fix bugs.',
      tools: { fileRead: fileReadTool, fileWrite: fileWriteTool, execBash: execBashTool },
    },
  ],
});

// The primary agent can now call the 'subagent' tool:
// → subagent({ type: 'explore', prompt: 'Find all API endpoints in the codebase' })
// → subagent({ type: 'execute', prompt: 'Add input validation to the user registration endpoint' })

// Subagent lifecycle events are emitted for UI tracking:
// 'subagent_start', 'subagent_text_delta', 'subagent_tool_start',
// 'subagent_tool_end', 'subagent_end'
```

### Supervisor Pattern (Hierarchical Delegation via Agent Primitive)

For more structured delegation with context control, the Agent primitive's supervisor pattern provides delegation hooks:

```typescript
const coderAgent = new Agent({
  id: 'coder',
  name: 'Coding Agent',
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: 'You are a coding specialist. Write, debug, and refactor code.',
  tools: { fileRead: fileReadTool, fileWrite: fileWriteTool, execBash: execBashTool },
});

const researchAgent = new Agent({
  id: 'researcher',
  name: 'Research Agent',
  model: 'openai/gpt-4o',
  instructions: 'You research topics on the web and synthesize information.',
  tools: { webSearch: webSearchTool, webFetch: webFetchTool },
});

const clawAgent = new Agent({
  id: 'claw',
  name: 'Claw Supervisor',
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: `You are the primary assistant. Delegate tasks to specialists:
- Use the "coder" agent for coding tasks
- Use the "researcher" agent for web research
- Handle messaging and general queries yourself.`,
  tools: { sendMessage: sendMessageTool },
  agents: { coder: coderAgent, researcher: researchAgent },

  onDelegationStart: async ({ delegatedAgent, messages }) => {
    return { messages: messages.slice(-10) };
  },

  onDelegationComplete: async ({ delegatedAgent, result }) => {
    console.log(`${delegatedAgent.id} completed task`);
    return result;
  },
});
```

### Network Pattern (Dynamic Routing)

```typescript
const response = await clawAgent.network({
  prompt: 'Research the latest TypeScript features and create a summary file',
  agents: { coder: coderAgent, researcher: researchAgent },
  isTaskComplete: [completionScorer],
  maxIterations: 10,
});
```

### Which Pattern Fits OpenClaw Best?

The **Harness subagent model** is the closest fit for OpenClaw because:

1. **Constrained tool access** — Subagents get only the tools they need, matching OpenClaw's node permissions
2. **Independent execution** — Subagents run in their own context, not sharing the parent's conversation
3. **Text-based return** — Findings come back as text that the primary agent synthesizes, matching OpenClaw's node output model
4. **UI visibility** — Subagent lifecycle events (`subagent_start`, `subagent_tool_start`, etc.) let UIs show what's happening, matching OpenClaw's node visibility

The Supervisor and Network patterns are complementary — use them when you need richer context sharing or dynamic routing between full agents.

---

## 8. Workflow Orchestration — Step-Based Execution

OpenClaw supports multi-step automation workflows. Mastra's workflow system is significantly more capable, with type-safe step chaining, conditional branching, parallel execution, and suspend/resume:

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// A workflow that automates a common OpenClaw use case:
// research a topic, generate a report, and notify the user

const researchStep = createStep(researchAgent, {
  structuredOutput: {
    schema: z.object({
      findings: z.array(z.object({
        source: z.string(),
        summary: z.string(),
      })),
    }),
  },
});

const generateReportStep = createStep({
  id: 'generate-report',
  inputSchema: z.object({
    findings: z.array(z.object({
      source: z.string(),
      summary: z.string(),
    })),
  }),
  outputSchema: z.object({
    report: z.string(),
    filePath: z.string(),
  }),
  execute: async ({ findings }) => {
    const report = findings
      .map(f => `## ${f.source}\n${f.summary}`)
      .join('\n\n');

    const filePath = `/workspace/reports/report-${Date.now()}.md`;
    await writeFile(filePath, report, 'utf-8');

    return { report, filePath };
  },
});

const notifyStep = createStep({
  id: 'notify-user',
  inputSchema: z.object({
    report: z.string(),
    filePath: z.string(),
  }),
  outputSchema: z.object({ notified: z.boolean() }),
  execute: async ({ report, filePath }, context) => {
    const channel = context?.requestContext?.channelId ?? 'telegram';
    const userId = context?.requestContext?.userId;
    if (userId) {
      await channels[channel].sendMessage(userId, `Report ready: ${filePath}`);
    }
    return { notified: true };
  },
});

const researchWorkflow = createWorkflow({
  id: 'research-and-report',
  inputSchema: z.object({
    prompt: z.string().describe('Research topic'),
  }),
  outputSchema: z.object({ notified: z.boolean() }),
})
  .then(researchStep)
  .then(generateReportStep)
  .then(notifyStep)
  .commit();
```

### Suspend/Resume for Human-in-the-Loop

OpenClaw's approval workflows map to Mastra's suspend/resume primitive:

```typescript
const deployStep = createStep({
  id: 'deploy-code',
  inputSchema: z.object({ artifact: z.string() }),
  outputSchema: z.object({ deployed: z.boolean(), url: z.string() }),
  suspendSchema: z.object({
    artifact: z.string(),
    reason: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    notes: z.string().optional(),
  }),
  execute: async ({ artifact }, { suspend, resumeData }) => {
    if (!resumeData) {
      // First execution — suspend and wait for approval
      return suspend({
        artifact,
        reason: 'Deployment requires manual approval',
      });
    }

    if (!resumeData.approved) {
      return { deployed: false, url: '' };
    }

    const url = await performDeployment(artifact);
    return { deployed: true, url };
  },
});
```

---

## 9. Putting It All Together

Here's what the full `Mastra`-based OpenClaw looks like as a composition of primitives, with the `Harness` as the central orchestrator:

```typescript
import { Mastra } from '@mastra/core';
import { Harness } from '@mastra/core/harness';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { MastraMCPClient } from '@mastra/mcp';
import { HonoServer } from '@mastra/server/hono';
import { z } from 'zod';

// ─── Storage ───
const storage = new LibSQLStore({
  id: 'openclaw',
  url: process.env.DATABASE_URL!,
});

// ─── Memory ───
const memory = new Memory({
  options: {
    lastMessages: 40,
    semanticRecall: { topK: 5 },
    workingMemory: {
      enabled: true,
      template: `
## User Profile
- Name: {{name}}
- Preferences: {{preferences}}

## Active Context
- Channel: {{activeChannel}}
- Project: {{activeProject}}

## Notes
{{notes}}
      `,
    },
  },
});

// ─── MCP Plugins ───
const plugins = new MastraMCPClient({
  servers: {
    filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'] },
    browser: { command: 'npx', args: ['-y', '@anthropic/mcp-server-puppeteer'] },
  },
});

// ─── Agents (one per Harness mode) ───
const assistantAgent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: `You are Claw, an autonomous AI assistant.
You can search the web, manage files, execute commands, and communicate across channels.
Use subagents for focused tasks: 'explore' for research, 'execute' for implementation.`,
  tools: async () => ({
    sendMessage: sendMessageTool,
    webSearch: webSearchTool,
    webFetch: webFetchTool,
    ...await plugins.getTools(),
  }),
});

const coderAgent = new Agent({
  id: 'coder',
  name: 'Coder',
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: 'You write, debug, and refactor code. Focus on correctness and clarity.',
  tools: {
    fileRead: fileReadTool,
    fileWrite: fileWriteTool,
    execBash: execBashTool,
    webSearch: webSearchTool,
  },
});

const researchAgent = new Agent({
  id: 'researcher',
  name: 'Researcher',
  model: 'openai/gpt-4o',
  instructions: 'You research topics and synthesize findings into clear summaries.',
  tools: { webSearch: webSearchTool, webFetch: webFetchTool },
});

// ─── Harness (the Gateway) ───
const gateway = new Harness({
  id: 'openclaw',
  resourceId: process.env.WORKSPACE_ID ?? 'default',
  storage,
  memory,

  stateSchema: z.object({
    activeChannel: z.string().optional(),
    yolo: z.boolean().optional(),
  }),
  initialState: { yolo: false },

  // Agent modes — switch between personalities at runtime
  modes: [
    { id: 'assistant', name: 'Assistant', default: true, agent: assistantAgent },
    { id: 'coding', name: 'Coding', agent: coderAgent },
    { id: 'research', name: 'Research', agent: researchAgent },
  ],

  // Subagents — focused agents the primary agent can spawn
  subagents: [
    {
      id: 'explore',
      name: 'Explorer',
      instructions: 'Explore and gather context. Read files, search the web.',
      tools: { fileRead: fileReadTool, webSearch: webSearchTool },
    },
    {
      id: 'execute',
      name: 'Executor',
      instructions: 'Execute implementation tasks with full tool access.',
      tools: { fileRead: fileReadTool, fileWrite: fileWriteTool, execBash: execBashTool },
    },
  ],

  // Shared tools
  tools: {
    webSearch: webSearchTool,
    webFetch: webFetchTool,
    sendMessage: sendMessageTool,
    fileRead: fileReadTool,
    fileWrite: fileWriteTool,
    execBash: execBashTool,
  },

  // Tool permission policies
  toolCategoryResolver: (toolName) => {
    if (['file-read', 'web-search', 'web-fetch'].includes(toolName)) return 'read';
    if (['file-write'].includes(toolName)) return 'edit';
    if (['exec-bash'].includes(toolName)) return 'execute';
    return 'other';
  },

  resolveModel: (modelId) => createModelInstance(modelId),
  workspace: { root: '/workspace', type: 'local' },

  heartbeatHandlers: [
    {
      id: 'channel-sync',
      intervalMs: 5 * 60 * 1000,
      handler: async () => { await syncChannelConnections(); },
    },
  ],
});

// ─── Mastra (DI registry) ───
const mastra = new Mastra({
  agents: { assistant: assistantAgent, coder: coderAgent, researcher: researchAgent },
  workflows: { researchAndReport: researchWorkflow },
  storage,
  memory: { default: memory },
});

// ─── Initialize ───
await gateway.init();
await gateway.selectOrCreateThread();

// ─── Event-driven UI (WebSocket, TUI, or web) ───
gateway.subscribe((event) => {
  switch (event.type) {
    case 'message_update':
      streamToChannel(event.data);
      break;
    case 'tool_approval_required':
      promptForApproval(event.data);
      break;
    case 'ask_question':
      promptUser(event.data);
      break;
    case 'task_updated':
      renderTasks(event.data);
      break;
  }
});

// ─── Channel webhooks ───
// (See Section 5 for full channel adapter examples)

// ─── Handle incoming messages ───
async function handleMessage(channelId: string, userId: string, text: string) {
  gateway.setState({ activeChannel: channelId });

  if (gateway.isRunning()) {
    await gateway.followUp({ content: text });
  } else {
    await gateway.sendMessage({ content: text, images: [] });
  }
}
```

This composition uses every major Mastra primitive:

| Primitive | Role |
|---|---|
| **`Harness`** | Gateway — orchestration, state, events, thread management, approvals, subagents |
| **`Agent`** | Per-mode agent personalities with tools and instructions |
| **`Tool`** | Type-safe tools with schemas, approvals, suspend/resume |
| **`Memory`** | Semantic recall, working memory, thread-based persistence |
| **`Storage`** | Database-backed persistence for threads, messages, state |
| **`MCP Client`** | Plugin system via open standard |
| **`Mastra`** | Dependency injection hub wiring components together |
| **`Workflow`** | Multi-step automation with type-safe chaining |

---

## 10. Analysis: Strengths and Gaps

### Where Mastra Primitives Excel

| Area | Advantage |
|---|---|
| **Harness as control plane** | The Harness provides a complete orchestration layer with state management, event-driven architecture, display state for UIs, built-in interactive tools, tool permissions, and subagent spawning. OpenClaw's Gateway must be built from scratch with custom code for all of these. |
| **Type safety** | Zod schemas on every tool, workflow step, agent output, and Harness state. OpenClaw has no schema validation. |
| **Multi-mode agents** | The Harness's mode system lets you switch between agent personalities at runtime without restarting. OpenClaw has a single agent runtime. |
| **Message queueing** | Harness provides `steer()` and `followUp()` as built-in primitives, matching OpenClaw's queue modes without custom code. |
| **Tool permissions** | Harness provides category-based policies, per-tool overrides, and session grants. OpenClaw's tool profiles are static configuration. |
| **Interactive tools** | `ask_user`, `submit_plan`, `task_write`, `task_check` are built-in Harness tools. OpenClaw requires custom implementations for each. |
| **Display state** | Harness provides a canonical `DisplayState` snapshot with 35+ event types, making UI development straightforward. |
| **Memory architecture** | Semantic recall, working memory templates, observational memory, resource-scoped state. Far more structured than OpenClaw's JSONL transcripts. |
| **Multi-agent patterns** | Harness subagents + Agent supervisor/network patterns. OpenClaw's delegation is ad-hoc. |
| **Workflow engine** | Type-safe step chaining, parallel execution, suspend/resume, conditional branching. OpenClaw has basic YAML workflows. |
| **Tool extensibility** | MCP standard means any MCP-compatible server works. OpenClaw's plugin API is proprietary. |
| **Observability** | OpenTelemetry integration for tracing across agents, tools, and workflows. |
| **Model switching** | Harness provides runtime model switching scoped to thread, mode, or global, with auth status checking. |

### Gaps to Fill

There are four gaps between what Mastra primitives provide and what OpenClaw ships. Each is broken down with scope, complexity, and implementation approach.

---

### Gap 1: Channel Adapters

**What OpenClaw provides**: Built-in adapters for 15+ messaging platforms — WhatsApp (Baileys + QR pairing), Telegram (grammY), Discord (discord.js), Slack (Bolt SDK), Signal (signal-cli), iMessage, Matrix, Mattermost, Google Chat, and more. Each adapter handles connection lifecycle, message format conversion, media handling, and platform-specific quirks (rate limits, message size limits, threading models).

**What Mastra provides**: Nothing. No channel adapters exist. The Harness operates on `sendMessage({ content })` — it doesn't know or care how messages arrive or are delivered.

**Complexity**: Medium-high per channel, but well-scoped. Each adapter is independent.

**Implementation approach**: Build a `ChannelAdapter` interface and implement per-platform:

```typescript
interface ChannelAdapter {
  readonly id: string;
  readonly name: string;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Messaging
  sendMessage(to: string, content: ChannelMessage): Promise<void>;
  formatIncoming(raw: unknown): IncomingMessage;

  // Platform-specific
  getCapabilities(): ChannelCapabilities;
}

interface ChannelMessage {
  text?: string;
  media?: Array<{ type: 'image' | 'video' | 'audio' | 'file'; url: string }>;
  replyTo?: string;
}

interface IncomingMessage {
  text: string;
  from: string;
  channelId: string;
  threadId?: string;
  media?: Array<{ type: string; url: string }>;
  metadata: Record<string, unknown>;
}

interface ChannelCapabilities {
  maxMessageLength: number;
  supportsMedia: boolean;
  supportsThreading: boolean;
  supportsReactions: boolean;
  supportsEditing: boolean;
}
```

Each adapter wraps an existing SDK:

| Channel | SDK | Key Complexity |
|---|---|---|
| WhatsApp | `@whiskeysockets/baileys` | QR pairing, multi-device, media upload to WhatsApp servers |
| Telegram | `grammy` | Webhooks or polling, inline keyboards, media groups |
| Discord | `discord.js` | Gateway connection (WebSocket), slash commands, embeds |
| Slack | `@slack/bolt` | Socket Mode or HTTP events, blocks, threading |
| Signal | `signal-cli` (subprocess) | DBUS interface, group management |

The adapters themselves are not AI-related — they're standard messaging integrations. The interesting part is wiring them to the Harness:

```typescript
class ChannelGateway {
  private adapters = new Map<string, ChannelAdapter>();
  private harness: Harness;
  private debounceBuffers = new Map<string, MessageBuffer>();

  constructor(harness: Harness, adapters: ChannelAdapter[]) {
    this.harness = harness;
    for (const adapter of adapters) {
      this.adapters.set(adapter.id, adapter);
    }
  }

  async start() {
    for (const [id, adapter] of this.adapters) {
      await adapter.connect();
    }

    // Subscribe to Harness events to route responses back to channels
    this.harness.subscribe((event) => {
      if (event.type === 'message_end') {
        this.routeResponse(event.data);
      }
    });
  }

  async handleIncoming(adapterId: string, raw: unknown) {
    const adapter = this.adapters.get(adapterId)!;
    const message = adapter.formatIncoming(raw);
    const key = `${adapterId}:${message.from}`;

    // Debounce rapid messages (see Gap 2)
    this.debounce(key, message, async (combined) => {
      this.harness.setState({ activeChannel: adapterId });

      if (this.harness.isRunning()) {
        await this.harness.followUp({ content: combined.text });
      } else {
        await this.harness.sendMessage({
          content: combined.text,
          images: combined.media?.map(m => m.url) ?? [],
        });
      }
    });
  }
}
```

**Effort estimate**: ~2-3 days per channel adapter for basic messaging. Full feature parity (media, reactions, threading, presence) adds another 2-3 days per channel.

---

### Gap 2: Message Debouncing and Deduplication

**What OpenClaw provides**: Built-in per-channel debouncing with configurable timing (default 2000ms, WhatsApp 5000ms, Slack/Discord 1500ms). Text-only messages debounce; media flushes immediately. Control commands bypass debouncing. Short-lived deduplication cache prevents duplicate agent runs from channel redeliveries.

**What Mastra provides**: The Harness provides `steer()` and `followUp()` for queueing during active runs, but no debouncing (batching rapid idle-state messages) and no deduplication.

**Complexity**: Low. This is ~100 lines of stateful buffering logic.

**Implementation approach**:

```typescript
interface DebounceConfig {
  defaultMs: number;
  byChannel: Record<string, number>;
  flushOnMedia: boolean;
}

const DEFAULT_DEBOUNCE: DebounceConfig = {
  defaultMs: 2000,
  byChannel: {
    whatsapp: 5000,
    slack: 1500,
    discord: 1500,
  },
  flushOnMedia: true,
};

class MessageDebouncer {
  private buffers = new Map<string, {
    messages: IncomingMessage[];
    timer: NodeJS.Timeout;
  }>();
  private seen = new Map<string, number>(); // dedup cache: messageId → timestamp
  private config: DebounceConfig;

  constructor(config: DebounceConfig = DEFAULT_DEBOUNCE) {
    this.config = config;
    // Purge stale dedup entries every 60s
    setInterval(() => this.purgeDedup(), 60_000);
  }

  submit(
    message: IncomingMessage,
    onFlush: (combined: IncomingMessage) => void,
  ) {
    // Deduplication — reject if we've seen this message ID recently
    const dedupKey = `${message.channelId}:${message.from}:${message.metadata.messageId}`;
    if (this.seen.has(dedupKey)) return;
    this.seen.set(dedupKey, Date.now());

    const bufferKey = `${message.channelId}:${message.from}`;
    const debounceMs = this.config.byChannel[message.channelId]
      ?? this.config.defaultMs;

    // Media flushes immediately
    if (this.config.flushOnMedia && message.media?.length) {
      this.flush(bufferKey, onFlush, message);
      return;
    }

    const buffer = this.buffers.get(bufferKey) ?? { messages: [], timer: null! };
    clearTimeout(buffer.timer);
    buffer.messages.push(message);

    buffer.timer = setTimeout(() => {
      this.flush(bufferKey, onFlush);
    }, debounceMs);

    this.buffers.set(bufferKey, buffer);
  }

  private flush(
    key: string,
    onFlush: (combined: IncomingMessage) => void,
    immediate?: IncomingMessage,
  ) {
    const buffer = this.buffers.get(key);
    const messages = immediate
      ? [...(buffer?.messages ?? []), immediate]
      : (buffer?.messages ?? []);

    this.buffers.delete(key);
    if (messages.length === 0) return;

    const combined: IncomingMessage = {
      text: messages.map(m => m.text).filter(Boolean).join('\n'),
      from: messages[0].from,
      channelId: messages[0].channelId,
      media: messages.flatMap(m => m.media ?? []),
      metadata: messages[0].metadata,
    };

    onFlush(combined);
  }

  private purgeDedup() {
    const cutoff = Date.now() - 60_000;
    for (const [key, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(key);
    }
  }
}
```

**Effort estimate**: ~Half a day. The logic is straightforward.

---

### Gap 3: Harness Routes in Mastra Server

**What OpenClaw provides**: A persistent WebSocket server (default `ws://localhost:18789`) with a typed JSON protocol. Clients connect, authenticate, and receive real-time events. The protocol has three frame types: `event`, `request`, and `response`.

**What Mastra provides**: The Harness has a rich event system (35+ event types) with `subscribe(listener)`, but it's **in-process only**. However, Mastra already has a full server infrastructure (`@mastra/server`) that exposes agents, workflows, tools, memory, etc. via HTTP. The server uses `createRoute()` to define routes with Zod schemas, supports SSE streaming (`streamFormat: 'sse'`), and handles auth/context automatically. There is no reason to build a separate transport package — the Harness should be exposed through the existing server, the same way agents and workflows are.

**Complexity**: Low-medium. The route infrastructure, streaming, auth, and request context are all solved. The work is adding Harness-specific route handlers following the existing `createRoute()` pattern.

**Implementation approach**: Add `HARNESS_ROUTES` to `packages/server/src/server/` following the same pattern as `AGENTS_ROUTES`, `WORKFLOWS_ROUTES`, etc.

The Mastra server already supports:
- **SSE streaming** via `responseType: 'stream'` + `streamFormat: 'sse'` — used for agent streaming, MCP
- **Auth middleware** — per-route `requiresAuth` flag
- **Request context** — server-populated context propagated to handlers
- **Zod validation** — `pathParamSchema`, `bodySchema`, `queryParamSchema` on every route
- **Custom routes** — `registerApiRoute()` for app-specific endpoints

What needs to be added:

```typescript
// packages/server/src/server/handlers/harness.ts
// Following the exact same pattern as agents.ts, workflows.ts, etc.

import { createRoute } from '../server-adapter/routes/route-builder';
import { z } from 'zod';

const harnessIdPathParams = z.object({
  harnessId: z.string(),
});

// SSE event stream — the key route
export const HARNESS_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:harnessId/events',
  responseType: 'stream',
  streamFormat: 'sse',
  pathParamSchema: harnessIdPathParams,
  handler: async ({ harnessId, mastra }) => {
    const harness = mastra.getHarness(harnessId); // needs to be added to Mastra class
    // Return a ReadableStream that bridges harness.subscribe() to SSE
    return {
      fullStream: createHarnessEventStream(harness),
    };
  },
});

// Control commands
export const HARNESS_SEND_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:harnessId/send',
  responseType: 'json',
  pathParamSchema: harnessIdPathParams,
  bodySchema: z.object({
    content: z.string(),
    images: z.array(z.object({ data: z.string(), mimeType: z.string() })).optional(),
  }),
  handler: async ({ harnessId, mastra, content, images }) => {
    const harness = mastra.getHarness(harnessId);
    await harness.sendMessage({ content, images });
    return { ok: true };
  },
});

// ... same pattern for steer, followUp, abort, approve, switchMode, etc.
```

Then register them in the route index:

```typescript
// packages/server/src/server/server-adapter/routes/index.ts
import { HARNESS_ROUTES } from './harness';

export const SERVER_ROUTES = [
  ...AGENTS_ROUTES,
  ...WORKFLOWS_ROUTES,
  ...HARNESS_ROUTES,  // <— added
  // ...
];
```

This approach:
- Uses the existing server infrastructure (auth, context, streaming, Zod validation)
- Follows the exact same pattern as every other Mastra primitive's HTTP API
- Gets SSE streaming for free (the server adapter already handles it)
- Gets auth for free (the middleware already handles it)
- Requires adding `getHarness()` / `addHarness()` to the `Mastra` class (following the pattern of `getAgent()` / `addAgent()`)

**Effort estimate**: ~2-3 days. Most of the work is defining the route handlers and adding Harness registration to the Mastra class. The plumbing is already built.

---

### Gap 4: Device Pairing and Channel Authentication

**What OpenClaw provides**: Per-channel authentication flows:
- **WhatsApp**: QR code scanning (WhatsApp Web linked device model), session persistence across restarts
- **Signal**: signal-cli device linking
- **Telegram**: Bot token (simple)
- **Discord**: Bot token + OAuth2 for user actions (simple)
- **Slack**: OAuth2 app installation flow
- **DM pairing**: Unknown senders receive an 8-character pairing code, approved via CLI

OpenClaw stores credentials in `~/.openclaw/credentials/` with allowlists and pending pairing requests.

**What Mastra provides**: Nothing channel-specific. The Harness has no concept of channel authentication. Mastra's server supports `defineAuth()` for HTTP authentication, but that's for API consumers, not messaging platform connections.

**Complexity**: Varies wildly by channel. Telegram/Discord/Slack are trivial (API tokens). WhatsApp and Signal are complex (session management, re-authentication, multi-device).

**Implementation approach**: This is inherently per-channel. Each channel adapter handles its own auth:

```typescript
interface ChannelAuth {
  // Channel-specific credential storage
  getCredentials(): Promise<ChannelCredentials | null>;
  saveCredentials(creds: ChannelCredentials): Promise<void>;

  // Pairing flow (for channels that need it)
  initiatePairing(): Promise<PairingChallenge>;
  completePairing(response: string): Promise<boolean>;
}

// WhatsApp — most complex
class WhatsAppAuth implements ChannelAuth {
  private store: MastraCompositeStore;

  async initiatePairing(): Promise<PairingChallenge> {
    // Generate QR code using Baileys
    const { state, saveCreds } = await useMultiFileAuthState('./auth/whatsapp');
    const sock = makeWASocket({ auth: state });

    return new Promise((resolve) => {
      sock.ev.on('connection.update', (update) => {
        if (update.qr) {
          resolve({ type: 'qr', data: update.qr, expiresIn: 60 });
        }
      });
    });
  }

  // ...
}

// Telegram — trivial
class TelegramAuth implements ChannelAuth {
  async getCredentials() {
    return { token: process.env.TELEGRAM_BOT_TOKEN };
  }
  async initiatePairing() {
    throw new Error('Telegram uses bot tokens, no pairing needed');
  }
  // ...
}
```

**DM pairing** (allow unknown senders) can use the Harness's `ask_user` pattern:

```typescript
class DMPairingManager {
  private pendingCodes = new Map<string, { code: string; channelId: string; from: string; expiresAt: number }>();

  async handleUnknownSender(channelId: string, from: string): Promise<string> {
    const code = generatePairingCode(8);
    this.pendingCodes.set(code, {
      code,
      channelId,
      from,
      expiresAt: Date.now() + 3600_000, // 1 hour
    });

    // Send the code back to the unknown sender
    await channels.get(channelId)!.sendMessage(from,
      `To connect, share this code with the operator: ${code}`
    );

    return code;
  }

  async approve(code: string): Promise<boolean> {
    const pending = this.pendingCodes.get(code);
    if (!pending || pending.expiresAt < Date.now()) return false;

    // Add to allowlist in storage
    await storage.getStore('memory').then(s =>
      s?.saveResource({ resource: { id: `${pending.channelId}:${pending.from}`, approved: true } })
    );

    this.pendingCodes.delete(code);
    return true;
  }
}
```

**Effort estimate**: Telegram/Discord/Slack — 1 day each (token-based). WhatsApp — 3-5 days (QR pairing, session persistence, reconnection). Signal — 3-5 days (signal-cli integration, device linking). DM pairing system — 1 day.

---

### Gap 5: Advanced Queue Modes

**What OpenClaw provides**: Five queue modes with configuration:
- **`steer`**: Inject into current run, cancel pending tool calls after next boundary
- **`followup`**: Enqueue for next turn after current run completes
- **`collect`** (default): Coalesce all queued messages into a single followup turn
- **`steer-backlog`**: Steer now AND preserve for followup
- **`interrupt`**: Abort active run, run newest message

Plus overflow policies (`drop: 'old' | 'new' | 'summarize'`), per-session queue caps, and per-channel debounce.

**What Mastra provides**: The Harness has `steer()`, `followUp()`, and `abort()`. This covers the core mechanics but not the policy layer — there's no built-in `collect` mode (coalescing), no `steer-backlog` mode (steer + followup), no overflow caps, and no `summarize` drop policy.

**Complexity**: Low-medium. The Harness provides the building blocks; this is a policy layer on top.

**Implementation approach**:

```typescript
type QueueMode = 'steer' | 'followup' | 'collect' | 'steer-backlog' | 'interrupt';

interface QueueConfig {
  defaultMode: QueueMode;
  byChannel: Record<string, QueueMode>;
  cap: number;
  dropPolicy: 'old' | 'new' | 'summarize';
  debounceMs: number;
}

class MessageQueue {
  private pending: IncomingMessage[] = [];
  private harness: Harness;
  private config: QueueConfig;

  constructor(harness: Harness, config: QueueConfig) {
    this.harness = harness;
    this.config = config;

    // When an agent run completes, flush collected messages
    this.harness.subscribe((event) => {
      if (event.type === 'agent_end') {
        this.flushCollected();
      }
    });
  }

  async enqueue(message: IncomingMessage) {
    if (!this.harness.isRunning()) {
      await this.harness.sendMessage({ content: message.text });
      return;
    }

    const mode = this.config.byChannel[message.channelId]
      ?? this.config.defaultMode;

    switch (mode) {
      case 'steer':
        await this.harness.steer({ content: message.text });
        break;

      case 'followup':
        this.addToPending(message);
        break;

      case 'collect':
        this.addToPending(message);
        // Will be coalesced and sent as one message on agent_end
        break;

      case 'steer-backlog':
        await this.harness.steer({ content: message.text });
        this.addToPending(message);
        break;

      case 'interrupt':
        await this.harness.abort();
        await this.harness.sendMessage({ content: message.text });
        break;
    }
  }

  private addToPending(message: IncomingMessage) {
    if (this.pending.length >= this.config.cap) {
      switch (this.config.dropPolicy) {
        case 'old':
          this.pending.shift();
          break;
        case 'new':
          return; // Drop incoming
        case 'summarize':
          // Keep first and last, summarize middle
          const summary = `[${this.pending.length - 1} earlier messages summarized]`;
          this.pending = [
            { ...this.pending[0], text: summary },
            this.pending[this.pending.length - 1],
          ];
          break;
      }
    }
    this.pending.push(message);
  }

  private async flushCollected() {
    if (this.pending.length === 0) return;

    const combined = this.pending.map(m => m.text).join('\n');
    this.pending = [];

    // Small debounce to catch any trailing messages
    setTimeout(async () => {
      await this.harness.sendMessage({ content: combined });
    }, this.config.debounceMs);
  }
}
```

**Effort estimate**: ~1 day. The hard parts (steer, followup, abort) are already Harness primitives.

---

### Gap 6: Discovery and Networking (mDNS / Tailscale)

**What OpenClaw provides**: LAN discovery via mDNS/Bonjour so clients can find the Gateway without manual configuration. Tailscale integration for secure remote access. Hub-and-spoke architecture with nodes connecting back to the gateway over WebSocket.

**What Mastra provides**: Nothing. Mastra is deployed as a standard HTTP server with no discovery protocol.

**Complexity**: Low priority, low complexity for basic use. OpenClaw's discovery is a convenience feature, not core functionality.

**Implementation approach**: For most deployments this isn't needed — users know where their server is. For LAN discovery:

```typescript
import { createAdvertisement } from 'bonjour-service';

function advertiseGateway(port: number) {
  const bonjour = new Bonjour();
  bonjour.publish({
    name: 'OpenClaw Gateway',
    type: 'openclaw',
    port,
    txt: { version: '1.0.0' },
  });
}
```

For Tailscale, it's deployment configuration, not application code — run the server behind `tailscale serve`.

**Effort estimate**: ~Half a day for mDNS. Tailscale is ops configuration.

---

### Gap Summary

| Gap | Complexity | Effort | Priority |
|---|---|---|---|
| **Channel adapters** | Medium-high per channel | 2-5 days each | High — core value prop |
| **Message debouncing / dedup** | Low | 0.5 days | High — needed for any channel |
| **Harness event transport** | Medium | 2-3 days | High — needed for remote UIs |
| **Device pairing / channel auth** | Varies (trivial to complex) | 1-5 days per channel | Medium — needed for WhatsApp/Signal |
| **Advanced queue modes** | Low-medium | 1 day | Medium — `steer`/`followUp` cover 80% |
| **Discovery / networking** | Low | 0.5 days | Low — convenience feature |

**Total effort for full OpenClaw feature parity**: ~4-6 weeks, dominated by channel adapter implementations. The Harness, Agent, Tool, Memory, and Storage primitives cover the hard AI/orchestration problems. The gaps are all in the messaging infrastructure layer — standard platform integration work.

---

### Highest-Value Work Items (Prioritized)

Looking across the gaps, here's what creates the most leverage — ordered by impact, not by ease.

#### Priority 1: Harness Event Transport

**Why it's #1**: This is the bottleneck that gates everything else.

Today, the Harness is consumed exclusively in-process. Mastra Code creates a `Harness` instance and passes it directly to `MastraTUI` in the same Node.js process:

```typescript
// mastracode/src/main.ts — this is the only consumption pattern today
const tui = new MastraTUI({ harness, hookManager, authStorage, mcpManager });
tui.run();
```

The TUI calls ~30 distinct Harness methods across its codebase. That means the Harness — with its 35+ event types, display state, tool approvals, message queueing, mode switching, and thread management — can only be driven by code running in the same process. No web UI, no mobile app, no remote CLI, no multi-client access.

Building a transport layer turns the Harness from a "TUI-only primitive" into a "platform primitive" that any client can drive. Every gap that follows (channel adapters, debouncing, queue modes) benefits from this because they all produce events that need to reach remote consumers.

**Unlocks**: Web UIs, mobile apps, desktop apps, remote access, multi-client, the entire OpenClaw multi-client model. Also makes the Harness testable from integration tests without spinning up a TUI.

##### The Exact API Surface

Auditing every Harness call in mastracode's TUI reveals three categories:

**1. Event stream (server → client)** — 35+ typed events:

```
agent_start, agent_end
message_start, message_update, message_end
tool_start, tool_end, tool_update, tool_approval_required
tool_input_start, tool_input_delta, tool_input_end
shell_output
ask_question, plan_approval_required, plan_approved
subagent_start, subagent_text_delta, subagent_tool_start, subagent_tool_end, subagent_end
mode_changed, model_changed, thread_changed, thread_created, state_changed
usage_update, task_updated, display_state_changed
om_status, om_observation_start, om_observation_end, om_reflection_start, om_reflection_end
om_buffering_start, om_buffering_end, om_activation, om_model_changed
workspace_status_changed, workspace_ready, workspace_error
info, error, follow_up_queued
```

During streaming, `message_update` fires on every token — potentially hundreds per second. The transport must handle this without backpressure issues.

**2. Control methods (client → server, mutating)**:

| Method | TUI Usage | Notes |
|---|---|---|
| `sendMessage({ content, images? })` | Primary interaction | Starts an agent turn |
| `steer({ content })` | Mid-stream redirection | Aborts + resends with new instruction |
| `followUp({ content })` | Queue for next turn | Used while agent is running |
| `abort()` | Cancel operation | Immediate abort via AbortController |
| `respondToToolApproval({ decision })` | Approve/decline/always-allow | Three decision types |
| `respondToQuestion({ questionId, answer })` | Answer agent questions | Unblocks suspended agent |
| `respondToPlanApproval({ planId, response })` | Accept/reject plans | Triggers mode switch on approval |
| `switchMode({ modeId })` | Change agent personality | Preserves thread context |
| `switchModel({ modelId, scope?, modeId? })` | Change LLM | Scoped to thread/mode/global |
| `createThread({ title? })` | New conversation | Auto-selects the new thread |
| `switchThread({ threadId })` | Change conversation | Loads thread state |
| `renameThread({ title })` | Update thread title | |
| `setState(updates)` | Update harness state | yolo, thinkingLevel, notifications, etc. |
| `setThreadSetting({ key, value })` | Per-thread settings | Persisted in thread metadata |
| `setPermissionForCategory({ category, policy })` | Set category policies | allow/ask/deny |
| `setPermissionForTool({ toolName, policy })` | Set tool policies | Per-tool overrides |
| `grantSessionCategory({ category })` | Session-level grant | Lasts until session ends |
| `grantSessionTool({ toolName })` | Session-level grant | Per-tool |
| `switchObserverModel({ modelId })` | Change OM observer | |
| `switchReflectorModel({ modelId })` | Change OM reflector | |
| `setSubagentModelId({ modelId, agentType? })` | Change subagent model | Per-type or global |

**3. Query methods (client → server, read-only)**:

| Method | TUI Usage | Notes |
|---|---|---|
| `getState()` | Read harness state | yolo, projectPath, tasks, thinkingLevel, etc. |
| `getDisplayState()` | Canonical UI snapshot | isRunning, activeTools, pendingApproval, tasks, tokenUsage, OM progress |
| `isRunning()` | Check if agent is active | Guards steer vs sendMessage |
| `listModes()` | Available modes | For mode picker |
| `getCurrentModeId()` | Current mode | For status line |
| `getCurrentModelId()` | Current model ID | For status line |
| `getModelName()` | Formatted model name | Display-friendly |
| `listAvailableModels()` | All models + auth status | For model picker |
| `getCurrentModelAuthStatus()` | Auth check for current model | |
| `listThreads({ allResources? })` | All threads | For thread picker |
| `listMessages({ limit? })` | Messages for current thread | For history rendering |
| `getSession()` | Session info | threadId, modeId, threads |
| `getPermissionRules()` | Current permission config | For /permissions display |
| `getSessionGrants()` | Active session grants | |
| `getFollowUpCount()` | Pending follow-ups | |
| `getTokenUsage()` | Token stats | For /cost display |
| `loadOMProgress()` | Load OM state from storage | |

##### Where This Lives

Not a new package. Mastra already has a server (`@mastra/server`) that exposes agents, workflows, tools, and memory over HTTP using a `createRoute()` pattern with Zod schemas, SSE streaming, and auth middleware. The server has routes like `POST /api/agents/:agentId/stream` (SSE), `POST /api/agents/:agentId/generate` (JSON), etc. Harness routes should be added the same way — as `HARNESS_ROUTES` in `packages/server/src/server/server-adapter/routes/`, following the exact pattern of `AGENTS_ROUTES`.

This requires two changes:
1. **`Mastra` class** — Add `addHarness()` / `getHarness()` methods (following the `addAgent()` / `getAgent()` pattern) so the server can access registered Harness instances
2. **`@mastra/server`** — Add `packages/server/src/server/handlers/harness.ts` with route definitions, plus a `HARNESS_ROUTES` array registered in `SERVER_ROUTES`

The SSE event stream route is the interesting one — it needs to bridge `harness.subscribe()` into a `ReadableStream` that the server's existing SSE machinery can send to clients. The control and query routes are standard JSON request/response.

##### Design Decisions

**1. DisplayState serialization**: `HarnessDisplayState` contains four `Map<string, T>` fields. These need conversion to `Record<string, T>` for JSON transport — a simple serialization helper.

**2. Event stream**: SSE via the server's existing `streamFormat: 'sse'` support. This works through HTTP proxies, is easy to debug, and the server already handles it for agent streaming. WebSocket can be added later if bidirectional command-over-socket is needed, but SSE + REST covers the majority of use cases.

**3. Reconnection**: Client connects to SSE, server sends initial snapshot as first event, then live events. `GET /api/harness/:id/display-state` provides a full snapshot for any-time recovery.

##### What the Routes Look Like

Following the exact same `createRoute()` pattern used for agents and workflows:

```
GET  /api/harness/:harnessId/events          — SSE event stream (responseType: 'stream', streamFormat: 'sse')
GET  /api/harness/:harnessId/snapshot         — Full snapshot (state + displayState + session)
GET  /api/harness/:harnessId/display-state    — Canonical display state
GET  /api/harness/:harnessId/state            — Harness state
GET  /api/harness/:harnessId/modes            — Available modes
GET  /api/harness/:harnessId/models           — Available models with auth status
GET  /api/harness/:harnessId/threads          — Thread list
GET  /api/harness/:harnessId/messages         — Messages for current thread
GET  /api/harness/:harnessId/permissions      — Permission rules
POST /api/harness/:harnessId/send             — Send message (starts agent turn)
POST /api/harness/:harnessId/steer            — Steer mid-stream
POST /api/harness/:harnessId/followup         — Queue follow-up
POST /api/harness/:harnessId/abort            — Abort current operation
POST /api/harness/:harnessId/approve          — Respond to tool approval
POST /api/harness/:harnessId/answer           — Answer agent question
POST /api/harness/:harnessId/plan-response    — Respond to plan approval
POST /api/harness/:harnessId/mode             — Switch mode
POST /api/harness/:harnessId/model            — Switch model
POST /api/harness/:harnessId/state            — Update state
POST /api/harness/:harnessId/threads          — Create thread
POST /api/harness/:harnessId/threads/switch   — Switch thread
POST /api/harness/:harnessId/permissions      — Set permission policies
```

This gets auth, request context, Zod validation, and SSE streaming for free from the existing server infrastructure.

---

#### Priority 2: Channel Adapter Interface + 1 Reference Implementation

**Why it's #2**: The multi-channel messaging story is OpenClaw's core value prop. Without at least one working channel adapter, "OpenClaw on Mastra" is just a local TUI (which Mastra Code already is). A channel adapter proves the pattern and unlocks the messaging use case.

**What to build**:
1. A `ChannelAdapter` interface (connect, disconnect, sendMessage, formatIncoming, getCapabilities)
2. A `ChannelGateway` class that wires adapters to a Harness instance (incoming messages → `sendMessage`/`followUp`/`steer`, Harness events → outbound channel messages)
3. One reference implementation — **Telegram** is the best choice because:
   - Simple webhook-based API (no persistent connection to manage)
   - Well-documented, stable SDK (`grammy`)
   - No device pairing needed (bot token)
   - Supports text, media, inline keyboards, threading
   - Easy to test (BotFather setup takes 2 minutes)

**Unlocks**: Proves the full pipeline: Telegram message → ChannelGateway → Harness → Agent → Tool execution → response → Telegram reply. Once this works, adding Discord/Slack/WhatsApp is just implementing the same interface with different SDKs.

---

#### Priority 3: Message Debouncing + Queue Layer

**Why it's #3**: This is small (~0.5 days) but required for any channel integration to work well. Without debouncing, rapid messages from WhatsApp (where users send 3-4 short messages in a row) spawn separate agent turns. Without queue management, messages that arrive mid-turn are dropped.

**What to build**: The `MessageDebouncer` and `MessageQueue` classes shown in Gaps 2 and 5 above. These sit between the ChannelGateway and the Harness:

```
Channel → ChannelAdapter → MessageDebouncer → MessageQueue → Harness
```

The Harness already has `steer()`, `followUp()`, and `abort()` — the queue layer just applies policy to decide which one to call.

**Unlocks**: Production-quality message handling for any channel. Configurable per-channel (WhatsApp: 5s debounce, Discord: 1.5s). Overflow policies prevent unbounded queue growth.

---

#### Priority 4: Device Pairing for WhatsApp/Signal

**Why this is lower**: WhatsApp and Signal require complex pairing flows (QR codes, device linking, session persistence), and they're only needed when you want those specific channels. Telegram, Discord, and Slack all work with simple API tokens.

**When to do it**: After Priorities 1-3 are working with the Telegram reference implementation. WhatsApp is the most requested channel, so it should be next, but it's not gating the architecture.

---

#### Priority 5: Advanced Queue Modes

**Why this is lower**: The Harness's built-in `steer()` and `followUp()` cover the `steer` and `followup` modes. The `collect`, `steer-backlog`, and `interrupt` modes are refinements. The `summarize` overflow policy (summarize dropped messages into a bullet list) is a nice touch but not essential.

**When to do it**: When real-world usage shows that `steer`/`followUp` aren't sufficient. For most single-user deployments, they are.

---

#### Priority 6: Discovery / Networking

**Why this is lowest**: mDNS discovery is a convenience for LAN deployments. Tailscale integration is ops configuration, not application code. Neither is needed to prove the architecture.

**When to do it**: When deploying to production environments where discoverability matters.

### What the Harness Eliminated

For context, here's what would also be gaps without the Harness:

| Feature | Without Harness (custom code) | With Harness (built-in) |
|---|---|---|
| State management | Custom state store + validation | `stateSchema` + `setState()` / `getState()` |
| Message queueing | Custom queue + middleware | `steer()` / `followUp()` / `abort()` |
| Tool permissions | Custom per-tool approval logic | Category policies + session grants |
| User questions | Custom suspend/resume flow | `ask_user` built-in tool |
| Plan approval | Custom workflow | `submit_plan` built-in tool |
| Task tracking | Custom data model + storage | `task_write` / `task_check` built-in tools |
| Display state | Custom event aggregation | `getDisplayState()` canonical snapshot |
| Real-time UI events | Custom event emitter | 35+ typed events with `subscribe()` |
| Model switching | Custom configuration management | `switchModel()` with scoping |
| Mode switching | Multiple agent instances + routing | `switchMode()` with shared threads |
| Subagent spawning | Custom agent lifecycle management | Built-in `subagent` tool with scoped tools |
| Background tasks | External cron | Heartbeat handlers |
| Thread management | Custom thread CRUD | `createThread()` / `switchThread()` / `listThreads()` |

---

## Conclusion

Building OpenClaw with Mastra primitives is not just feasible — it's architecturally cleaner. The **Harness** primitive is the key: it provides the complete control plane that OpenClaw's Gateway implements from scratch, including state management, event-driven UI updates, message queueing, tool permissions, interactive tools, subagent spawning, model switching, and display state.

The remaining primitives fill in the rest:
- **Agent** — Per-mode agent personalities with dynamic instructions
- **Tool** — Type-safe tools with schemas, approvals, suspend/resume
- **Memory** — Semantic recall, working memory, observational memory
- **Storage** — Database-backed persistence
- **MCP** — Plugin system via open standard
- **Workflow** — Multi-step automation with type-safe chaining
- **Mastra** — Dependency injection wiring everything together

The gaps are all in the **messaging infrastructure layer** — channel adapters, debouncing, event transport, and device pairing. This is standard platform integration work, not AI orchestration. The hard problems (agent runtime, multi-agent coordination, memory, tool management, state, approvals) are solved by Mastra primitives.

The resulting system would be:
- **More structured** — Harness provides a coherent orchestration model vs. imperative Gateway code
- **More type-safe** — Zod schemas everywhere vs. no validation
- **More extensible** — MCP standard vs. proprietary plugins
- **Better memory** — Semantic recall + working memory + observational memory vs. JSONL files
- **Better UI integration** — 35+ event types + DisplayState vs. raw WebSocket messages
- **More observable** — OpenTelemetry tracing vs. log files
- **More flexible** — Multiple modes, subagents, and model switching vs. single agent runtime
