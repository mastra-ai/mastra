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
        { type: 'doc', id: 'deployment-targets/netlify', label: 'Netlify' },
        { type: 'doc', id: 'deployment-targets/temporal', label: 'Temporal' },
        { type: 'doc', id: 'deployment-targets/vercel', label: 'Vercel' },
      ],
    },
    {
      type: 'category',
      label: 'Auth providers',
      collapsed: false,
      items: [
        { type: 'doc', id: 'auth-providers/auth0', label: 'Auth0' },
        { type: 'doc', id: 'auth-providers/better-auth', label: 'Better Auth' },
        { type: 'doc', id: 'auth-providers/clerk', label: 'Clerk' },
        { type: 'doc', id: 'auth-providers/firebase', label: 'Firebase' },
        { type: 'doc', id: 'auth-providers/google', label: 'Google' },
        { type: 'doc', id: 'auth-providers/okta', label: 'Okta' },
        { type: 'doc', id: 'auth-providers/supabase', label: 'Supabase' },
        { type: 'doc', id: 'auth-providers/workos', label: 'WorkOS' },
      ],
    },
    {
      type: 'category',
      label: 'Browser vendors',
      collapsed: false,
      items: [
        { type: 'doc', id: 'browser-vendors/firecrawl', label: 'Firecrawl' },
        { type: 'doc', id: 'browser-vendors/stagehand', label: 'Stagehand' },
      ],
    },
    {
      type: 'category',
      label: 'Workspace vendors',
      collapsed: false,
      items: [
        { type: 'doc', id: 'workspace-vendors/agentcore-runtime-sandbox', label: 'AgentCore Runtime' },
        { type: 'doc', id: 'workspace-vendors/agentfs-filesystem', label: 'AgentFS' },
        { type: 'doc', id: 'workspace-vendors/apple-container-sandbox', label: 'Apple Container' },
        { type: 'doc', id: 'workspace-vendors/archil-filesystem', label: 'Archil' },
        { type: 'doc', id: 'workspace-vendors/azure-blob-filesystem', label: 'Azure Blob Storage' },
        { type: 'doc', id: 'workspace-vendors/blaxel-sandbox', label: 'Blaxel' },
        { type: 'doc', id: 'workspace-vendors/daytona-sandbox', label: 'Daytona' },
        { type: 'doc', id: 'workspace-vendors/docker-sandbox', label: 'Docker' },
        { type: 'doc', id: 'workspace-vendors/e2b-sandbox', label: 'E2B' },
        { type: 'doc', id: 'workspace-vendors/files-sdk-filesystem', label: 'Files SDK' },
        { type: 'doc', id: 'workspace-vendors/gcs-filesystem', label: 'Google Cloud Storage' },
        { type: 'doc', id: 'workspace-vendors/google-drive-filesystem', label: 'Google Drive' },
        { type: 'doc', id: 'workspace-vendors/mesa-filesystem', label: 'Mesa' },
        { type: 'doc', id: 'workspace-vendors/modal-sandbox', label: 'Modal' },
        { type: 'doc', id: 'workspace-vendors/railway-sandbox', label: 'Railway' },
        { type: 'doc', id: 'workspace-vendors/s3-filesystem', label: 'Amazon S3' },
        { type: 'doc', id: 'workspace-vendors/vercel-sandbox', label: 'Vercel Sandbox' },
        { type: 'doc', id: 'workspace-vendors/vercel-serverless', label: 'Vercel Serverless' },
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
      ],
    },
  ],
}

export default sidebars
