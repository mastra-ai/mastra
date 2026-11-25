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
  { path: '/docs/connections/mcp', name: 'Docs – MCP' },
  { path: '/docs/server/overview', name: 'Docs – Server' },
  { path: '/docs/observability/overview', name: 'Docs – Observability' },
  { path: '/docs/evals/running-in-ci', name: 'Docs – Evals CI' },
  { path: '/docs/deployment/overview', name: 'Docs – Deployment' },

  // --- Models ---
  { path: '/models', name: 'Models – Index' },
  { path: '/models/providers/openai', name: 'Models – OpenAI' },

  // --- Integrations ---
  { path: '/integrations', name: 'Integrations – Index' },
  { path: '/integrations/channels/slack', name: 'Integrations – Slack' },

  { path: '/integrations/agentic-ui/ai-sdk-ui', name: 'Integrations – AI SDK UI' },
  { path: '/integrations/frameworks/next-js', name: 'Integrations – Next.js' },

  // --- Reference ---
  { path: '/reference/voice/overview', name: 'Reference – Voice' },
  { path: '/reference/configuration', name: 'Reference – Configuration' },
  { path: '/reference/core/mastra-class', name: 'Reference – Mastra Class' },
  { path: '/reference/agents/agent', name: 'Reference – Agent' },
  { path: '/reference/tools/create-tool', name: 'Reference – Create Tool' },
  { path: '/reference/workflows/workflow', name: 'Reference – Workflow' },
]
