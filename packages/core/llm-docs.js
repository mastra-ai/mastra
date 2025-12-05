export const config = {
  agent: {
    src: [
      './docs/src/content/en/docs/agents/overview.mdx',
      './docs/src/content/en/docs/agents/structured-output.mdx',
      './docs/src/content/en/docs/agents/guardrails.mdx',
      './docs/src/content/en/docs/agents/agent-memory.mdx',
      './docs/src/content/en/docs/agents/agent-approval.mdx',
    ],
    dest: './packages/core/dist/agent/agent.md',
  },
  workflow: {
    src: [],
    dest: './packages/core/dist/workflow/workflow.md',
  },
  memory: {
    src: [],
    dest: './packages/core/dist/memory/memory.md',
  },
  tools: {
    src: [],
    dest: './packages/core/dist/tool/tool.md',
  },
  storage: {
    src: [],
    dest: './packages/core/dist/storage/storage.md',
  },
  evals: {
    src: [],
    dest: './packages/core/dist/evals/evals.md',
  },
};
