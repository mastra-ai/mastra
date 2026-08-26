/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  integrationsSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Channels',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'channels/discord',
          label: 'Discord',
          customProps: { icon: 'https://cdn.simpleicons.org/discord?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'channels/github',
          label: 'GitHub',
          customProps: {
            icon: 'https://cdn.simpleicons.org/github/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/github/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'channels/imessage',
          label: 'iMessage',
          customProps: { icon: 'https://cdn.simpleicons.org/imessage?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'channels/teams',
          label: 'Microsoft Teams',
          customProps: { icon: 'https://svgl.app/library/microsoft-teams.svg' },
        },
        {
          type: 'doc',
          id: 'channels/slack',
          label: 'Slack',
          customProps: { icon: 'https://svgl.app/library/slack.svg' },
        },
        {
          type: 'doc',
          id: 'channels/telegram',
          label: 'Telegram',
          customProps: { icon: 'https://cdn.simpleicons.org/telegram?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'channels/whatsapp',
          label: 'WhatsApp',
          customProps: { icon: 'https://cdn.simpleicons.org/whatsapp?viewbox=auto&size=28' },
        },
      ],
    },
    {
      type: 'category',
      label: 'Frameworks',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'frameworks/astro',
          label: 'Astro',
          customProps: { icon: 'https://cdn.simpleicons.org/astro?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'frameworks/electron',
          label: 'Electron',
          customProps: { icon: 'https://cdn.simpleicons.org/electron?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'frameworks/express',
          label: 'Express',
          customProps: {
            icon: 'https://cdn.simpleicons.org/express/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/express/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'frameworks/hono',
          label: 'Hono',
          customProps: { icon: 'https://cdn.simpleicons.org/hono?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'frameworks/nestjs',
          label: 'NestJS',
          customProps: { icon: 'https://cdn.simpleicons.org/nestjs?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'frameworks/next-js',
          label: 'Next.js',
          customProps: {
            icon: 'https://cdn.simpleicons.org/nextdotjs/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/nextdotjs/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'frameworks/nuxt',
          label: 'Nuxt',
          customProps: { icon: 'https://cdn.simpleicons.org/nuxt?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'frameworks/vite-react',
          label: 'React + Vite',
          customProps: { icon: 'https://cdn.simpleicons.org/vite?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'frameworks/sveltekit',
          label: 'SvelteKit',
          customProps: { icon: 'https://cdn.simpleicons.org/svelte?viewbox=auto&size=28' },
        },
      ],
    },
    {
      type: 'category',
      label: 'Agentic UI',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'agentic-ui/ai-sdk-ui',
          label: 'AI SDK UI',
          customProps: {
            icon: 'https://cdn.simpleicons.org/vercel/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/vercel/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'agentic-ui/assistant-ui',
          label: 'Assistant UI',
          customProps: { icon: '/img/integrations/assistant-ui.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'agentic-ui/copilotkit',
          label: 'CopilotKit',
          customProps: { icon: '/img/integrations/copilotkit.svg' },
        },
        {
          type: 'doc',
          id: 'agentic-ui/openui',
          label: 'OpenUI',
          customProps: { icon: '/img/integrations/openui.svg', customCSS: 'dark:invert' },
        },
      ],
    },
    {
      type: 'category',
      label: 'Sandboxes',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'sandboxes/agentcore',
          label: 'AgentCore',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'sandboxes/apple-container',
          label: 'Apple Container',
          customProps: {
            icon: 'https://cdn.simpleicons.org/apple/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/apple/white?viewbox=auto&size=28',
          },
        },
        { type: 'doc', id: 'sandboxes/blaxel', label: 'Blaxel', customProps: { icon: '/img/integrations/blaxel.svg' } },
        {
          type: 'doc',
          id: 'sandboxes/cloudflare-sandbox',
          label: 'Cloudflare Sandbox',
          customProps: { icon: 'https://cdn.simpleicons.org/cloudflare?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'sandboxes/daytona',
          label: 'Daytona',
          customProps: { icon: '/img/integrations/daytona.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'sandboxes/docker',
          label: 'Docker',
          customProps: { icon: 'https://cdn.simpleicons.org/docker?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'sandboxes/e2b',
          label: 'E2B',
          customProps: { icon: '/img/integrations/e2b.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'sandboxes/e2b-desktop',
          label: 'E2B Desktop',
          customProps: { icon: '/img/integrations/e2b.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'link',
          label: 'Mastra',
          href: '/reference/workspace/platform-sandbox',
          customProps: { icon: '/img/integrations/mastra.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'sandboxes/modal',
          label: 'Modal',
          customProps: { icon: 'https://cdn.simpleicons.org/modal?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'sandboxes/railway',
          label: 'Railway',
          customProps: {
            icon: 'https://cdn.simpleicons.org/railway/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/railway/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'sandboxes/vercel',
          label: 'Vercel',
          customProps: {
            icon: 'https://cdn.simpleicons.org/vercel/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/vercel/white?viewbox=auto&size=28',
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Observability',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'observability/arize',
          label: 'Arize',
          customProps: { icon: '/img/integrations/arize.svg' },
        },
        {
          type: 'doc',
          id: 'observability/arthur',
          label: 'Arthur',
          customProps: { icon: '/img/integrations/arthur.svg' },
        },
        {
          type: 'doc',
          id: 'observability/braintrust',
          label: 'Braintrust',
          customProps: {
            icon: 'https://cdn.simpleicons.org/braintrust/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/braintrust/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'observability/confident-ai',
          label: 'Confident AI',
          customProps: { icon: '/img/integrations/confident-ai.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'observability/datadog',
          label: 'Datadog',
          customProps: { icon: 'https://cdn.simpleicons.org/datadog?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'observability/laminar',
          label: 'Laminar',
          customProps: { icon: '/img/integrations/laminar.svg' },
        },
        {
          type: 'doc',
          id: 'observability/langfuse',
          label: 'Langfuse',
          customProps: { icon: '/img/integrations/langfuse.svg' },
        },
        {
          type: 'doc',
          id: 'observability/langsmith',
          label: 'LangSmith',
          customProps: {
            icon: 'https://cdn.simpleicons.org/langchaincorporate/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/langchaincorporate/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'link',
          label: 'Mastra',
          href: '/docs/mastra-platform/observability',
          customProps: { icon: '/img/integrations/mastra.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'observability/opentelemetry',
          label: 'OpenTelemetry',
          customProps: {
            icon: 'https://cdn.simpleicons.org/opentelemetry/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/opentelemetry/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'observability/posthog',
          label: 'PostHog',
          customProps: {
            icon: 'https://cdn.simpleicons.org/posthog/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/posthog/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'observability/sentry',
          label: 'Sentry',
          customProps: {
            icon: '/img/integrations/sentry.svg',
            iconDark: '/img/integrations/sentry-dark.svg',
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Databases',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'databases/aurora-dsql',
          label: 'Aurora DSQL',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'databases/clickhouse',
          label: 'ClickHouse',
          customProps: { icon: 'https://cdn.simpleicons.org/clickhouse?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/cloudflare-d1',
          label: 'Cloudflare D1',
          customProps: { icon: 'https://cdn.simpleicons.org/cloudflare?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/cloudflare-kv',
          label: 'Cloudflare KV',
          customProps: { icon: 'https://cdn.simpleicons.org/cloudflare?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/convex',
          label: 'Convex',
          customProps: { icon: 'https://cdn.simpleicons.org/convex?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/duckdb',
          label: 'DuckDB',
          customProps: { icon: 'https://cdn.simpleicons.org/duckdb?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/dynamodb',
          label: 'DynamoDB',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'databases/elasticsearch',
          label: 'Elasticsearch',
          customProps: { icon: 'https://cdn.simpleicons.org/elasticsearch?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/spanner',
          label: 'Google Cloud Spanner',
          customProps: { icon: 'https://cdn.simpleicons.org/googlecloudspanner?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/lancedb',
          label: 'LanceDB',
          customProps: { icon: '/img/integrations/lancedb.svg', customCSS: 'dark:invert' },
        },
        { type: 'doc', id: 'databases/libsql', label: 'libSQL', customProps: { icon: '/img/integrations/libsql.svg' } },
        {
          type: 'link',
          label: 'Mastra',
          href: '/docs/mastra-platform/database',
          customProps: { icon: '/img/integrations/mastra.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'databases/mongodb',
          label: 'MongoDB',
          customProps: { icon: 'https://cdn.simpleicons.org/mongodb?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/mssql',
          label: 'MSSQL',
          customProps: { icon: 'https://svgl.app/library/microsoft.svg' },
        },
        {
          type: 'doc',
          id: 'databases/neon',
          label: 'Neon Postgres',
          customProps: { icon: 'https://cdn.simpleicons.org/neon?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/oracledb',
          label: 'OracleDB',
          customProps: { icon: '/img/integrations/oracle.svg' },
        },
        {
          type: 'doc',
          id: 'databases/postgresql',
          label: 'PostgreSQL',
          customProps: { icon: 'https://cdn.simpleicons.org/postgresql?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/redis',
          label: 'Redis',
          customProps: { icon: 'https://cdn.simpleicons.org/redis?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'databases/valkey',
          label: 'Valkey',
          customProps: { icon: '/img/integrations/valkey.svg' },
        },
        {
          type: 'doc',
          id: 'databases/upstash',
          label: 'Upstash',
          customProps: { icon: 'https://cdn.simpleicons.org/upstash?viewbox=auto&size=28' },
        },
      ],
    },
    {
      type: 'category',
      label: 'Deploy',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'deploy/aws-bedrock-agentcore',
          label: 'Amazon Bedrock AgentCore',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'deploy/amazon-ec2',
          label: 'Amazon EC2',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'deploy/aws-lambda',
          label: 'AWS Lambda',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'deploy/azure-app-services',
          label: 'Azure App Services',
          customProps: { icon: 'https://svgl.app/library/azure.svg' },
        },
        {
          type: 'doc',
          id: 'deploy/cloudflare',
          label: 'Cloudflare',
          customProps: { icon: 'https://cdn.simpleicons.org/cloudflare?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'deploy/digital-ocean',
          label: 'Digital Ocean',
          customProps: { icon: 'https://cdn.simpleicons.org/digitalocean?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'deploy/inngest',
          label: 'Inngest',
          customProps: { icon: '/img/integrations/inngest.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'deploy/kubernetes',
          label: 'Kubernetes',
          customProps: { icon: 'https://cdn.simpleicons.org/kubernetes?viewbox=auto&size=28' },
        },
        {
          type: 'link',
          label: 'Mastra',
          href: '/docs/mastra-platform/deploy',
          customProps: { icon: '/img/integrations/mastra.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'deploy/netlify',
          label: 'Netlify',
          customProps: { icon: 'https://cdn.simpleicons.org/netlify?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'deploy/render',
          label: 'Render',
          customProps: {
            icon: 'https://cdn.simpleicons.org/render/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/render/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'deploy/temporal',
          label: 'Temporal',
          customProps: {
            icon: 'https://cdn.simpleicons.org/temporal/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/temporal/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'deploy/vercel',
          label: 'Vercel',
          customProps: {
            icon: 'https://cdn.simpleicons.org/vercel/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/vercel/white?viewbox=auto&size=28',
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Tools',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'tools/brightdata',
          label: 'Bright Data',
          customProps: { icon: '/img/integrations/bright-data.svg' },
        },
        {
          type: 'doc',
          id: 'tools/firecrawl',
          label: 'Firecrawl',
          customProps: { icon: '/img/integrations/firecrawl.svg' },
        },
        {
          type: 'doc',
          id: 'tools/parallel',
          label: 'Parallel',
          customProps: { icon: '/img/integrations/parallel.svg' },
        },
        {
          type: 'doc',
          id: 'tools/perplexity',
          label: 'Perplexity',
          customProps: { icon: 'https://cdn.simpleicons.org/perplexity?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'tools/tavily',
          label: 'Tavily',
          customProps: { icon: '/img/integrations/tavily.svg', customCSS: 'dark:invert' },
        },
      ],
    },
    {
      type: 'category',
      label: 'Voice',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'voice/aws-nova-sonic',
          label: 'AWS Nova Sonic',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        { type: 'doc', id: 'voice/azure', label: 'Azure', customProps: { icon: 'https://svgl.app/library/azure.svg' } },
        {
          type: 'doc',
          id: 'voice/cloudflare',
          label: 'Cloudflare',
          customProps: { icon: 'https://cdn.simpleicons.org/cloudflare?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'voice/deepgram',
          label: 'Deepgram',
          customProps: { icon: 'https://cdn.simpleicons.org/deepgram?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'voice/elevenlabs',
          label: 'ElevenLabs',
          customProps: {
            icon: 'https://cdn.simpleicons.org/elevenlabs/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/elevenlabs/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'voice/google',
          label: 'Google',
          customProps: { icon: 'https://svgl.app/library/google.svg' },
        },
        {
          type: 'doc',
          id: 'voice/inworld',
          label: 'Inworld',
          customProps: { icon: '/img/integrations/inworld.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'voice/livekit',
          label: 'LiveKit',
          customProps: {
            icon: 'https://cdn.simpleicons.org/livekit/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/livekit/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'voice/mistral',
          label: 'Mistral',
          customProps: { icon: 'https://cdn.simpleicons.org/mistralai?viewbox=auto&size=28' },
        },
        { type: 'doc', id: 'voice/murf', label: 'Murf', customProps: { icon: '/img/integrations/murf.svg' } },
        {
          type: 'doc',
          id: 'voice/openai',
          label: 'OpenAI',
          customProps: { icon: 'https://svgl.app/library/openai.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'voice/sarvam',
          label: 'Sarvam',
          customProps: { icon: '/img/integrations/sarvam.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'voice/speechify',
          label: 'Speechify',
          customProps: { icon: '/img/integrations/speechify.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'voice/xai',
          label: 'xAI',
          customProps: {
            icon: 'https://svgl.app/library/xai_light.svg',
            iconDark: 'https://svgl.app/library/xai_dark.svg',
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Auth',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'auth/auth0',
          label: 'Auth0',
          customProps: { icon: 'https://cdn.simpleicons.org/auth0?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'auth/better-auth',
          label: 'Better Auth',
          customProps: {
            icon: 'https://cdn.simpleicons.org/betterauth/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/betterauth/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'auth/clerk',
          label: 'Clerk',
          customProps: { icon: 'https://cdn.simpleicons.org/clerk?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'auth/firebase',
          label: 'Firebase',
          customProps: { icon: 'https://cdn.simpleicons.org/firebase?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'auth/google',
          label: 'Google',
          customProps: { icon: 'https://svgl.app/library/google.svg' },
        },
        {
          type: 'doc',
          id: 'auth/okta',
          label: 'Okta',
          customProps: { icon: 'https://cdn.simpleicons.org/okta?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'auth/supabase',
          label: 'Supabase',
          customProps: { icon: 'https://cdn.simpleicons.org/supabase?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'auth/workos',
          label: 'WorkOS',
          customProps: { icon: 'https://svgl.app/library/workos.svg' },
        },
      ],
    },
    {
      type: 'category',
      label: 'Browsers',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'browsers/agent-browser',
          label: 'AgentBrowser',
          customProps: {
            icon: 'https://cdn.simpleicons.org/vercel/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/vercel/white?viewbox=auto&size=28',
          },
        },
        {
          type: 'doc',
          id: 'browsers/browser-viewer',
          label: 'BrowserViewer',
          customProps: { icon: '/img/integrations/mastra.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'browsers/firecrawl',
          label: 'Firecrawl',
          customProps: { icon: '/img/integrations/firecrawl.svg' },
        },
        {
          type: 'doc',
          id: 'browsers/stagehand',
          label: 'Stagehand',
          customProps: { icon: '/img/integrations/stagehand.svg' },
        },
      ],
    },
    {
      type: 'category',
      label: 'File storage',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'file-storage/agentfs',
          label: 'AgentFS',
          customProps: { icon: 'https://cdn.simpleicons.org/turso?viewbox=auto&size=28' },
        },
        {
          type: 'doc',
          id: 'file-storage/amazon-s3',
          label: 'Amazon S3',
          customProps: {
            icon: 'https://svgl.app/library/aws_light.svg',
            iconDark: 'https://svgl.app/library/aws_dark.svg',
          },
        },
        {
          type: 'doc',
          id: 'file-storage/archil',
          label: 'Archil',
          customProps: { icon: '/img/integrations/archil.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'file-storage/azure-blob',
          label: 'Azure Blob',
          customProps: { icon: 'https://svgl.app/library/azure.svg' },
        },
        {
          type: 'doc',
          id: 'file-storage/google-cloud-storage',
          label: 'Google Cloud Storage',
          customProps: { icon: 'https://svgl.app/library/google-cloud.svg' },
        },
        {
          type: 'doc',
          id: 'file-storage/google-drive',
          label: 'Google Drive',
          customProps: { icon: 'https://svgl.app/library/drive.svg' },
        },
        {
          type: 'doc',
          id: 'file-storage/mesa',
          label: 'Mesa',
          customProps: { icon: '/img/integrations/mesa.svg', customCSS: 'dark:invert' },
        },
        {
          type: 'doc',
          id: 'file-storage/vercel-files',
          label: 'Vercel Files',
          customProps: {
            icon: 'https://cdn.simpleicons.org/vercel/black?viewbox=auto&size=28',
            iconDark: 'https://cdn.simpleicons.org/vercel/white?viewbox=auto&size=28',
          },
        },
      ],
    },
  ],
}

export default sidebars
