/**
 * Sidebar for ecosystem docs.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  ecosystemSidebar: [
    'index',
    {
      type: 'category',
      label: 'App frameworks',
      collapsed: false,
      items: [
        { type: 'doc', id: 'app-frameworks/next-js', label: 'Next.js' },
        { type: 'doc', id: 'app-frameworks/vite-react', label: 'React' },
        { type: 'doc', id: 'app-frameworks/astro', label: 'Astro' },
        { type: 'doc', id: 'app-frameworks/sveltekit', label: 'SvelteKit' },
        { type: 'doc', id: 'app-frameworks/nuxt', label: 'Nuxt' },
        { type: 'doc', id: 'app-frameworks/express', label: 'Express' },
        { type: 'doc', id: 'app-frameworks/nestjs', label: 'NestJS' },
        { type: 'doc', id: 'app-frameworks/hono', label: 'Hono' },
        { type: 'doc', id: 'app-frameworks/electron', label: 'Electron' },
      ],
    },
    {
      type: 'category',
      label: 'Agent frameworks and UI',
      collapsed: false,
      items: [
        { type: 'doc', id: 'agent-frameworks-and-ui/ai-sdk', label: 'AI SDK' },
        { type: 'doc', id: 'agent-frameworks-and-ui/ai-sdk-ui', label: 'AI SDK UI' },
        { type: 'doc', id: 'agent-frameworks-and-ui/assistant-ui', label: 'Assistant UI' },
        {
          type: 'category',
          label: 'CopilotKit',
          items: [
            { type: 'doc', id: 'agent-frameworks-and-ui/copilotkit/overview', label: 'Overview' },
            { type: 'doc', id: 'agent-frameworks-and-ui/copilotkit/generative-ui', label: 'Generative UI' },
            { type: 'doc', id: 'agent-frameworks-and-ui/copilotkit/channels', label: 'Channels' },
          ],
        },
        { type: 'doc', id: 'agent-frameworks-and-ui/openui', label: 'OpenUI' },
      ],
    },
    {
      type: 'category',
      label: 'Deployment targets',
      collapsed: false,
      items: [
        { type: 'doc', id: 'deployment-targets/aws-bedrock-agentcore', label: 'Amazon Bedrock AgentCore' },
        { type: 'doc', id: 'deployment-targets/amazon-ec2', label: 'Amazon EC2' },
        { type: 'doc', id: 'deployment-targets/aws-lambda', label: 'AWS Lambda' },
        { type: 'doc', id: 'deployment-targets/azure-app-services', label: 'Azure App Services' },
        { type: 'doc', id: 'deployment-targets/cloudflare', label: 'Cloudflare' },
        { type: 'doc', id: 'deployment-targets/digital-ocean', label: 'Digital Ocean' },
        { type: 'doc', id: 'deployment-targets/inngest', label: 'Inngest' },
        { type: 'doc', id: 'deployment-targets/kubernetes', label: 'Kubernetes' },
        { type: 'link', label: 'Mastra platform', href: '/docs/mastra-platform/server' },
        {
          type: 'doc',
          id: 'deployment-targets/mastra-workers',
          label: 'Mastra Workers',
          customProps: {
            tags: ['beta'],
          },
        },
        { type: 'doc', id: 'deployment-targets/netlify', label: 'Netlify' },
        { type: 'doc', id: 'deployment-targets/temporal', label: 'Temporal' },
        { type: 'doc', id: 'deployment-targets/vercel', label: 'Vercel' },
      ],
    },
    {
      type: 'category',
      label: 'Deployment patterns',
      collapsed: false,
      items: [
        { type: 'doc', id: 'deployment-patterns/cloud-providers', label: 'Cloud providers' },
        { type: 'doc', id: 'deployment-patterns/sandbox', label: 'Sandbox' },
        { type: 'doc', id: 'deployment-patterns/web-framework', label: 'Web framework' },
        { type: 'doc', id: 'deployment-patterns/workflow-runners', label: 'Workflow runners' },
        {
          type: 'doc',
          id: 'deployment-patterns/workers',
          label: 'Workers',
          customProps: {
            tags: ['beta'],
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Auth providers',
      collapsed: false,
      items: [
        { type: 'doc', id: 'auth-providers/index', label: 'Overview' },
        { type: 'doc', id: 'auth-providers/auth0', label: 'Auth0' },
        { type: 'doc', id: 'auth-providers/better-auth', label: 'Better Auth' },
        { type: 'doc', id: 'auth-providers/clerk', label: 'Clerk' },
        { type: 'doc', id: 'auth-providers/composite-auth', label: 'Composite Auth' },
        { type: 'doc', id: 'auth-providers/custom-auth-provider', label: 'Custom Auth Provider' },
        { type: 'doc', id: 'auth-providers/firebase', label: 'Firebase' },
        { type: 'doc', id: 'auth-providers/fga', label: 'Fine-Grained Authorization' },
        { type: 'doc', id: 'auth-providers/google', label: 'Google' },
        { type: 'doc', id: 'auth-providers/jwt', label: 'JSON Web Token' },
        { type: 'doc', id: 'auth-providers/okta', label: 'Okta' },
        { type: 'doc', id: 'auth-providers/simple-auth', label: 'Simple Auth' },
        { type: 'doc', id: 'auth-providers/supabase', label: 'Supabase' },
        {
          type: 'doc',
          id: 'auth-providers/workers',
          label: 'Workers',
          customProps: {
            tags: ['beta'],
          },
        },
        { type: 'doc', id: 'auth-providers/workos', label: 'WorkOS' },
      ],
    },
    {
      type: 'category',
      label: 'Browser and workspace',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Browser',
          items: [
            { type: 'doc', id: 'browser/overview', label: 'Overview' },
            { type: 'doc', id: 'browser/agent-browser', label: 'AgentBrowser' },
            { type: 'doc', id: 'browser/stagehand', label: 'Stagehand' },
            { type: 'doc', id: 'browser/firecrawl', label: 'Firecrawl' },
            {
              type: 'doc',
              id: 'browser/recording',
              label: 'Recording',
              customProps: {
                tags: ['beta'],
              },
            },
            { type: 'doc', id: 'browser/browser-viewer', label: 'BrowserViewer' },
          ],
        },
        {
          type: 'category',
          label: 'Workspace',
          items: [
            { type: 'doc', id: 'workspace/overview', label: 'Overview' },
            { type: 'doc', id: 'workspace/filesystem', label: 'Filesystem' },
            { type: 'doc', id: 'workspace/sandbox', label: 'Sandbox' },
            { type: 'doc', id: 'workspace/lsp', label: 'LSP inspection' },
            { type: 'doc', id: 'workspace/skills', label: 'Skills' },
            { type: 'doc', id: 'workspace/search', label: 'Search and indexing' },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Observability integrations',
      collapsed: false,
      items: [
        { type: 'doc', id: 'observability-integrations/overview', label: 'Overview' },
        {
          type: 'category',
          label: 'Bridges',
          items: [
            { type: 'doc', id: 'observability-integrations/bridges/datadog', label: 'Datadog' },
            { type: 'doc', id: 'observability-integrations/bridges/otel', label: 'OpenTelemetry' },
          ],
        },
        {
          type: 'category',
          label: 'Exporters',
          items: [
            {
              type: 'doc',
              id: 'observability-integrations/exporters/mastra-storage',
              label: 'Mastra Storage',
            },
            {
              type: 'doc',
              id: 'observability-integrations/exporters/mastra-platform',
              label: 'Mastra platform',
            },
            { type: 'doc', id: 'observability-integrations/exporters/arize', label: 'Arize' },
            { type: 'doc', id: 'observability-integrations/exporters/arthur', label: 'Arthur' },
            { type: 'doc', id: 'observability-integrations/exporters/braintrust', label: 'Braintrust' },
            { type: 'doc', id: 'observability-integrations/exporters/datadog', label: 'Datadog' },
            { type: 'doc', id: 'observability-integrations/exporters/laminar', label: 'Laminar' },
            { type: 'doc', id: 'observability-integrations/exporters/langfuse', label: 'Langfuse' },
            { type: 'doc', id: 'observability-integrations/exporters/langsmith', label: 'LangSmith' },
            { type: 'doc', id: 'observability-integrations/exporters/otel', label: 'OpenTelemetry' },
            { type: 'doc', id: 'observability-integrations/exporters/posthog', label: 'PostHog' },
            { type: 'doc', id: 'observability-integrations/exporters/sentry', label: 'Sentry' },
          ],
        },
        {
          type: 'doc',
          id: 'observability-integrations/processors/sensitive-data-filter',
          label: 'SensitiveDataFilter',
        },
      ],
    },
  ],
}

export default sidebars
