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
};
