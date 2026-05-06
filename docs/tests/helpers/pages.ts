export interface PageConfig {
  /** URL path relative to baseURL */
  path: string
  /** Human-readable name for test output */
  name: string
  /** Extra wait time (ms) after navigation for heavy pages */
  extraWait?: number
  /** Only flag critical JS errors (network failures, runtime errors) */
  criticalErrorsOnly?: boolean
  /** Optional CSS selector to wait for before proceeding */
  waitForSelector?: string
}

export const pages: PageConfig[] = [
  // --- Docs ---
  { path: '/docs', name: 'Docs – Get Started' },
  { path: '/docs/agents/overview', name: 'Docs – Agents' },
  { path: '/docs/workflows/overview', name: 'Docs – Workflows' },
  { path: '/docs/memory/overview', name: 'Docs – Memory' },
  { path: '/docs/rag/overview', name: 'Docs – RAG' },
  { path: '/docs/mcp/overview', name: 'Docs – MCP' },
  { path: '/docs/server/mastra-server', name: 'Docs – Server' },
  { path: '/docs/observability/overview', name: 'Docs – Observability' },
  { path: '/docs/evals/running-in-ci', name: 'Docs – Evals CI' },
  { path: '/docs/voice/overview', name: 'Docs – Voice' },
  { path: '/docs/streaming/overview', name: 'Docs – Streaming' },
  { path: '/docs/deployment/overview', name: 'Docs – Deployment' },

  // --- Models ---
  { path: '/models', name: 'Models – Index' },
  { path: '/models/providers/openai', name: 'Models – OpenAI' },

  // --- Guides ---
  { path: '/guides/getting-started/quickstart', name: 'Guides – Quickstart' },
  { path: '/guides/build-your-ui/ai-sdk-ui', name: 'Guides – AI SDK UI' },
  { path: '/guides/getting-started/next-js', name: 'Guides – Next.js' },

  // --- Reference ---
  { path: '/reference/configuration', name: 'Reference – Configuration' },
  { path: '/reference/core/mastra-class', name: 'Reference – Mastra Class' },
  { path: '/reference/agents/agent', name: 'Reference – Agent' },
  { path: '/reference/tools/create-tool', name: 'Reference – Create Tool' },
  { path: '/reference/workflows/workflow', name: 'Reference – Workflow' },

  // --- Learn ---
  { path: '/learn', name: 'Learn – Landing Page' },
  { path: '/learn/what-is-an-agent', name: 'Learn – What is an Agent?' },
  { path: '/learn/run-your-first-agent', name: 'Learn – Run Your First Agent' },
  { path: '/learn/project-structure', name: 'Learn – Project Structure' },
  { path: '/learn/create-an-agent', name: 'Learn – Create an Agent' },
  { path: '/learn/create-a-tool', name: 'Learn – Create a Tool' },
  { path: '/learn/build-with-ai', name: 'Learn – Build with AI' },
  { path: '/learn/fetch-live-data', name: 'Learn – Fetch Live Data' },
  { path: '/learn/connect-to-mcp', name: 'Learn – Connect to MCP' },
]
