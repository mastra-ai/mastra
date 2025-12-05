export const config = {
  agent: {
    src: [
      './docs/src/content/en/docs/agents/overview.mdx',
      './docs/src/content/en/docs/agents/structured-output.mdx',
      './docs/src/content/en/docs/agents/guardrails.mdx',
      './docs/src/content/en/docs/agents/agent-memory.mdx',
      './docs/src/content/en/docs/agents/agent-approval.mdx',
      './docs/src/content/en/docs/agents/using-tools.mdx',
    ],
    dest: './packages/core/dist/agent/agent.md',
  },
  workflows: {
    src: [
      './docs/src/content/en/docs/worfklows/overview.mdx',
      './docs/src/content/en/docs/worfklows/control-flow.mdx',
      './docs/src/content/en/docs/worfklows/human-in-the-loop.mdx',
      './docs/src/content/en/docs/worfklows/error-handling.mdx',
      './docs/src/content/en/docs/worfklows/workflow-state.mdx',
      './docs/src/content/en/docs/streaming/workflow-streaming.mdx',
    ],
    dest: './packages/core/dist/workflows/workflow.md',
  },
  memory: {
    src: [
      './docs/src/content/en/docs/memory/overview.mdx',
      './docs/src/content/en/docs/memory/threads-and-resources.mdx',
      './docs/src/content/en/docs/memory/working-memory.mdx',
      './docs/src/content/en/docs/memory/conversation-history.mdx',
      './docs/src/content/en/docs/memory/semantic-recall.mdx',
    ],
    dest: './packages/core/dist/memory/memory.md',
  },
  tools: {
    src: [
      './docs/src/content/en/docs/agents/using-tools.mdx',
      './docs/src/content/en/docs/workflows/agents-and-tools.mdx',
      './docs/src/content/en/docs/streaming/tool-streaming.mdx',
    ],
    dest: './packages/core/dist/tools/tools.md',
  },
  storage: {
    src: [
      './docs/src/content/en/docs/server-db/storage.mdx',
      './docs/src/content/en/reference/storage/libsql.mdx',
      './docs/src/content/en/reference/storage/postgresql.mdx',
      './docs/src/content/en/reference/storage/mssql.mdx',
    ],
    dest: './packages/core/dist/storage/storage.md',
  },
  evals: {
    src: [
      './docs/src/content/en/docs/evals/overview.mdx',
      './docs/src/content/en/docs/evals/custom-scorers.mdx',
      './docs/src/content/en/docs/evals/built-in-scorers.mdx',
    ],
    dest: './packages/core/dist/evals/evals.md',
  },
};
