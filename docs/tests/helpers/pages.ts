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
  { path: '/docs/agents', name: 'Docs – Agents' },
  { path: '/docs/workflows', name: 'Docs – Workflows' },
  { path: '/docs/memory', name: 'Docs – Memory' },
  { path: '/docs/mcp', name: 'Docs – MCP' },
  { path: '/docs/storage', name: 'Docs – Storage' },
  { path: '/docs/observe', name: 'Docs – Observe' },
  { path: '/docs/evals', name: 'Docs – Evals' },
  { path: '/docs/deploy', name: 'Docs – Deploy' },

  // --- Models ---
  { path: '/models', name: 'Models – Index' },
  { path: '/models/providers/openai', name: 'Models – OpenAI' },

  // --- Integrations ---
  { path: '/ecosystem/agent-frameworks-and-ui/ai-sdk-ui', name: 'Integrations – AI SDK UI' },
  { path: '/ecosystem/app-frameworks/next-js', name: 'Integrations – Next.js' },

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
