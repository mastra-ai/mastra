import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROVIDER_REGISTRY } from '../src/llm/model/provider-registry.generated.js';

/**
 * Format provider name for display (handles underscores and capitalization)
 */
function formatProviderName(name: string): string {
  // Special cases
  const specialCases: Record<string, string> = {
    fireworks_ai: 'Fireworks AI',
    openrouter: 'OpenRouter',
    togetherai: 'Together AI',
    huggingface: 'Hugging Face',
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    xai: 'xAI',
    github_copilot: 'GitHub Copilot',
    github_models: 'GitHub Models',
    deepinfra: 'DeepInfra',
    fastrouter: 'FastRouter',
    baseten: 'BaseTen',
    lmstudio: 'LM Studio',
    modelscope: 'ModelScope',
    moonshotai: 'MoonshotAI',
    moonshotai_cn: 'MoonshotAI CN',
    zhipuai: 'ZhipuAI',
    opencode: 'OpenCode',
  };

  if (specialCases[name.toLowerCase()]) {
    return specialCases[name.toLowerCase()];
  }

  // Default: capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Clean API URLs to documentation URLs
 * Removes API paths like /v1 and subdomains like api.
 */
function cleanDocumentationUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

    // If it contains API paths, convert to homepage
    if (parsed.pathname.includes('/v1') || parsed.pathname.includes('/api') || parsed.pathname.includes('/inference')) {
      // Remove subdomain if it's an API subdomain
      if (parsed.hostname.startsWith('api.') || parsed.hostname.startsWith('router.')) {
        const domain = parsed.hostname.replace(/^(api|router)\./, '');
        return `https://${domain}`;
      }

      // Just remove the path
      return `${parsed.protocol}//${parsed.host}`;
    }

    return url;
  } catch {
    return url; // Return as-is if parsing fails
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Popular providers to show at the top of the sidebar
const POPULAR_PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral', 'xai'];

// Gateway prefixes - these are treated as gateways even if not prefixed
const GATEWAY_PREFIXES = ['netlify'];
// Providers that are actually gateways (aggregate multiple model providers)
const GATEWAY_PROVIDERS = ['vercel', 'openrouter', 'fireworks_ai', 'groq', 'huggingface', 'togetherai'];

interface ProviderInfo {
  id: string;
  name: string;
  url: string;
  apiKeyEnvVar: string;
  apiKeyHeader: string;
  models: readonly string[];
  isGateway: boolean;
  isPopular: boolean;
  baseProvider?: string; // For gateway providers like netlify/openai -> openai
}

interface GroupedProviders {
  gateways: Map<string, ProviderInfo[]>; // gateway -> providers
  popular: ProviderInfo[];
  other: ProviderInfo[];
}

function parseProviders(): GroupedProviders {
  const gateways = new Map<string, ProviderInfo[]>();
  const popular: ProviderInfo[] = [];
  const other: ProviderInfo[] = [];

  for (const [id, config] of Object.entries(PROVIDER_REGISTRY)) {
    // Check if it's a prefixed gateway (like netlify/openai) or a standalone gateway (like vercel)
    const isPrefixedGateway = GATEWAY_PREFIXES.some(prefix => id.startsWith(`${prefix}/`));
    const isStandaloneGateway = GATEWAY_PROVIDERS.includes(id);
    const isGateway = isPrefixedGateway || isStandaloneGateway;

    let gatewayName: string | undefined;
    let baseProvider: string | undefined;

    if (isPrefixedGateway) {
      const parts = id.split('/');
      gatewayName = parts[0];
      baseProvider = parts.slice(1).join('/');
    } else if (isStandaloneGateway) {
      gatewayName = id;
      baseProvider = undefined; // Vercel doesn't have a base provider, it routes to many
    }

    const providerInfo: ProviderInfo = {
      id,
      name: config.name,
      url: config.url,
      apiKeyEnvVar: config.apiKeyEnvVar,
      apiKeyHeader: config.apiKeyHeader || 'Authorization',
      models: config.models,
      isGateway,
      isPopular: !isGateway && POPULAR_PROVIDERS.includes(id),
      baseProvider,
    };

    if (isGateway && gatewayName) {
      if (!gateways.has(gatewayName)) {
        gateways.set(gatewayName, []);
      }
      gateways.get(gatewayName)!.push(providerInfo);
    } else if (!isGateway && providerInfo.isPopular) {
      popular.push(providerInfo);
    } else if (!isGateway) {
      other.push(providerInfo);
    }
  }

  // Sort popular providers by the POPULAR_PROVIDERS order
  popular.sort((a, b) => {
    const aIndex = POPULAR_PROVIDERS.indexOf(a.id);
    const bIndex = POPULAR_PROVIDERS.indexOf(b.id);
    return aIndex - bIndex;
  });

  // Sort other providers alphabetically
  other.sort((a, b) => a.name.localeCompare(b.name));

  return { gateways, popular, other };
}

function generateProviderPage(provider: ProviderInfo): string {
  const modelCount = provider.models.length;

  // Get documentation URL if available
  const rawDocUrl = (PROVIDER_REGISTRY[provider.id] as any).docUrl;
  const docUrl = cleanDocumentationUrl(rawDocUrl);

  // Create intro with optional documentation link
  const introText = docUrl
    ? `Access ${modelCount} ${provider.name} model${modelCount !== 1 ? 's' : ''} through Mastra's model router. Authentication is handled automatically using the \`${provider.apiKeyEnvVar}\` environment variable.\n\nLearn more in the [${provider.name} documentation](${docUrl}).`
    : `Access ${modelCount} ${provider.name} model${modelCount !== 1 ? 's' : ''} through Mastra's model router. Authentication is handled automatically using the \`${provider.apiKeyEnvVar}\` environment variable.`;

  // Generate model table
  const modelTable = `| Model |
|-------|
${provider.models.map(m => `| \`${provider.id}/${m}\` |`).join('\n')}`;

  return `---
title: "${provider.name} | Models | Mastra"
description: "Use ${provider.name} models with Mastra. ${modelCount} model${modelCount !== 1 ? 's' : ''} available."
---

import { ProviderCapabilitiesTable } from "@/components/provider-capabilities-table";

# <img src="${getLogoUrl(provider.id)}" alt="${provider.name} logo" className="${getLogoClass(provider.id)}" />${provider.name}

${introText}

## Usage

\`\`\`typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "${provider.id}/${provider.models[0]}"
});

// Generate a response
const response = await agent.generate("Hello!");

// Stream a response
const stream = await agent.stream("Tell me a story");
for await (const chunk of stream) {
  console.log(chunk);
}
\`\`\`

## Configuration

\`\`\`bash
${provider.apiKeyEnvVar}=your-api-key
\`\`\`

## Advanced Configuration

### Custom Headers

\`\`\`typescript
const agent = new Agent({
  name: "custom-agent",
  model: {
    url: "${provider.url}",
    modelId: "${provider.models[0]}",
    apiKey: process.env.${provider.apiKeyEnvVar},
    headers: {
      "X-Custom-Header": "value"
    }
  }
});
\`\`\`

### Dynamic Model Selection

\`\`\`typescript
const agent = new Agent({
  name: "dynamic-agent",
  model: ({ runtimeContext }) => {
    const useAdvanced = runtimeContext.task === "complex";
    return useAdvanced 
      ? "${provider.id}/${provider.models[0]}"
      : "${provider.id}/${provider.models[Math.min(1, provider.models.length - 1)]}";
  }
});
\`\`\`

## Model Capabilities

<ProviderCapabilitiesTable providerId="${provider.id}" limit={10} />

## Available Models

${modelTable}
`;
}

function getLogoUrl(providerId: string): string {
  // Custom logos for specific providers
  const customLogos: Record<string, string> = {
    netlify: '/logos/netlify.svg',
  };

  return customLogos[providerId] || `https://models.dev/logos/${providerId}.svg`;
}

function getLogoClass(providerId: string): string {
  // Providers with colored logos that shouldn't be inverted
  const coloredLogos = ['netlify'];

  const baseClass = 'inline w-8 h-8 mr-2 align-middle';

  if (coloredLogos.includes(providerId)) {
    return baseClass;
  }

  return `${baseClass} dark:invert dark:brightness-0 dark:contrast-200`;
}

function generateGatewayPage(gatewayName: string, providers: ProviderInfo[]): string {
  const displayName = formatProviderName(gatewayName);
  const totalModels = providers.reduce((sum, p) => sum + p.models.length, 0);

  let sections: string;

  // Special handling for Vercel (standalone gateway without base providers)
  if (gatewayName === 'vercel' && providers.length === 1 && !providers[0].baseProvider) {
    const provider = providers[0];
    const modelList = provider.models
      .slice(0, 10)
      .map(m => `  - \`${m}\``)
      .join('\n');
    const hasMore = provider.models.length > 10;

    sections = `
## Available Models

Vercel AI Gateway provides access to ${provider.models.length} models from various providers:

${modelList}${hasMore ? `\n  - ... and ${provider.models.length - 10} more models` : ''}

Use any model with the \`vercel/\` prefix followed by the provider and model name:

\`\`\`typescript
// Examples
model: "vercel/deepseek/deepseek-r1"
model: "vercel/meta/llama-4-scout"  
model: "vercel/openai/gpt-4o"
\`\`\`
`;
  } else {
    // Regular handling for other gateways (Netlify)
    sections = providers
      .map(provider => {
        const baseProviderName = provider.baseProvider || 'unknown';
        const modelList = provider.models
          .slice(0, 5)
          .map(m => `    - \`${m}\``)
          .join('\n');
        const hasMore = provider.models.length > 5;

        return `
## ${provider.name}

Use ${baseProviderName} models through ${gatewayName} gateway:

\`\`\`typescript
model: "${provider.id}/${provider.models[0]}"
\`\`\`

### Available Models (${provider.models.length})

${modelList}${hasMore ? `\n    - ... and ${provider.models.length - 5} more` : ''}
`;
      })
      .join('\n');
  }

  const benefits =
    gatewayName === 'netlify'
      ? `- **Caching**: Automatic response caching for repeated queries
- **Analytics**: Track usage across all models  
- **Rate Limiting**: Built-in rate limiting and quotas
- **Fallbacks**: Automatic fallback to other providers`
      : gatewayName === 'vercel'
        ? `- **Observability**: Built-in request tracking
- **Edge Runtime**: Optimized for edge deployments
- **Model Routing**: Automatic model selection based on availability
- **Multiple Providers**: Access models from many providers through one gateway`
        : `- **Observability**: Built-in request tracking
- **Edge Runtime**: Optimized for edge deployments
- **Model Routing**: Automatic model selection based on availability`;

  // Adjust provider count for Vercel (it's one gateway serving many providers)
  const providerCount =
    gatewayName === 'vercel' && providers.length === 1 && !providers[0].baseProvider
      ? 'multiple'
      : providers.length.toString();
  // Get documentation URL if available
  // Special override for Vercel to use the AI SDK documentation
  let rawDocUrl: string | undefined;

  if (gatewayName === 'vercel') {
    rawDocUrl = 'https://ai-sdk.dev/providers/ai-sdk-providers';
  } else if (providers[0] && !providers[0].baseProvider) {
    // For standalone gateways like groq, openrouter, etc.
    rawDocUrl = (PROVIDER_REGISTRY[providers[0].id] as any).docUrl;
  } else if (providers[0]) {
    // For prefixed gateways like netlify/openai
    rawDocUrl = (PROVIDER_REGISTRY[providers[0].id] as any).docUrl;
  }

  const docUrl = cleanDocumentationUrl(rawDocUrl);

  // Create intro with optional documentation link
  const gatewayDescription =
    gatewayName === 'netlify'
      ? 'Netlify AI Gateway provides unified access to multiple providers with built-in caching and observability.'
      : `${displayName} aggregates models from multiple providers with enhanced features like rate limiting and failover.`;

  const introText = docUrl
    ? `${gatewayDescription} Access ${totalModels} models through Mastra's model router.\n\nLearn more in the [${displayName} documentation](${docUrl}).`
    : `${gatewayDescription} Access ${totalModels} models through Mastra's model router.`;

  // Create model table for all models
  const allModels = providers.flatMap(p => p.models);
  const modelTable =
    allModels.length > 0
      ? `
## Available Models

| Model |
|-------|
${allModels.map(m => `| \`${m}\` |`).join('\n')}
`
      : '';

  return `---
title: "${displayName} | Models | Mastra"  
description: "Use AI models through ${displayName}."
---

# <img src="${getLogoUrl(gatewayName)}" alt="${displayName} logo" className="${getLogoClass(gatewayName)}" />${displayName}

${introText}

## Usage

\`\`\`typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "${gatewayName}/${providers[0]?.models[0] || 'model-name'}"
});
\`\`\`

## Configuration

\`\`\`bash
# Use gateway API key
${gatewayName.toUpperCase()}_API_KEY=your-gateway-key

# Or use provider API keys directly  
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
\`\`\`

${modelTable}
`;
}

function generateIndexPage(grouped: GroupedProviders): string {
  const totalProviders = grouped.popular.length + grouped.other.length + grouped.gateways.size;
  const totalModels =
    [...grouped.popular, ...grouped.other].reduce((sum, p) => sum + p.models.length, 0) +
    Array.from(grouped.gateways.values())
      .flat()
      .reduce((sum, p) => sum + p.models.length, 0);

  return `---
title: "Models"
description: "Explore ${totalProviders}+ AI providers and ${totalModels}+ models available in Mastra."
---

import { CardGrid, CardGridItem } from "@/components/cards/card-grid";

# Model Providers

Mastra's unified model router gives you access to **${totalModels}+ models** from **${totalProviders} providers** with a single API. Switch between models and providers without installing packages.

\`\`\`typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "openai/gpt-4o"  // Works with any provider/model
});
\`\`\`

Comes with environment variable detection to handle authentication, and full TypeScript support to autocomplete models directly in your editor.

<CardGrid>
    <CardGridItem
      title="Gateways"
      href="./models/gateways"
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('openrouter')}" alt="OpenRouter" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>OpenRouter</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('fireworks_ai')}" alt="Fireworks AI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>Fireworks AI</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('huggingface')}" alt="Hugging Face" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>Hugging Face</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">+ ${grouped.gateways.size - 3} more</div>
      </div>
    </CardGridItem>
    <CardGridItem
      title="Providers"
      href="./models/providers"
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('openai')}" alt="OpenAI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>OpenAI</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('anthropic')}" alt="Anthropic" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>Anthropic</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('google')}" alt="Google" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>Google</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">+ ${grouped.popular.length + grouped.other.length - 3} more</div>
      </div>
    </CardGridItem>
</CardGrid>

---

[Full unified model router docs →](/docs/getting-started/model-providers)`;
}

function generateGatewaysIndexPage(grouped: GroupedProviders): string {
  const orderedGateways = ['netlify', 'openrouter', 'fireworks_ai', 'groq', 'huggingface', 'togetherai', 'vercel'];
  const gatewaysList = orderedGateways.filter(g => grouped.gateways.has(g));

  return `---
title: "Gateways"
description: "Access AI models through gateway providers with caching, rate limiting, and analytics."
---

import { CardGrid, CardGridItem } from "@/components/cards/card-grid";

# Gateway Providers

Gateway providers aggregate multiple model providers and add features like caching, rate limiting, analytics, and automatic failover. Use gateways when you need observability, cost management, or simplified multi-provider access.

<CardGrid>
${gatewaysList
  .map(
    g => `    <CardGridItem
      title="${formatProviderName(g).replace(/&/g, '&amp;')}"
      description="${grouped.gateways.get(g)?.reduce((sum, p) => sum + p.models.length, 0) || 0} models"
      href="./gateways/${g}"
      logo="${getLogoUrl(g)}"
      ${g === 'netlify' ? 'preserveLogoColor={true}' : ''}
    />`,
  )
  .join('\n')}
</CardGrid>`;
}

function generateProvidersIndexPage(grouped: GroupedProviders): string {
  const allProviders = [...grouped.popular, ...grouped.other];

  return `---
title: "Providers"
description: "Direct access to AI model providers."
---

import { CardGrid, CardGridItem } from "@/components/cards/card-grid";

# Model Providers

Direct access to individual AI model providers. Each provider offers unique models with specific capabilities and pricing.

<CardGrid>
${allProviders
  .map(
    p => `    <CardGridItem
      title="${p.name.replace(/&/g, '&amp;')}"
      description="${p.models.length} models"
      href="./providers/${p.id}"
      logo="${getLogoUrl(p.id)}"
    />`,
  )
  .join('\n')}
</CardGrid>`;
}

async function generateDocs() {
  const docsDir = path.join(__dirname, '..', '..', '..', 'docs', 'src', 'content', 'en', 'models');
  const providersDir = path.join(docsDir, 'providers');
  const gatewaysDir = path.join(docsDir, 'gateways');

  // Create directories
  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(providersDir, { recursive: true });
  await fs.mkdir(gatewaysDir, { recursive: true });

  const grouped = parseProviders();

  // Generate index page
  const indexContent = generateIndexPage(grouped);
  await fs.writeFile(path.join(docsDir, 'index.mdx'), indexContent);
  console.log('✅ Generated models/index.mdx');

  // Generate gateways overview page
  const gatewaysIndexContent = generateGatewaysIndexPage(grouped);
  await fs.writeFile(path.join(gatewaysDir, 'index.mdx'), gatewaysIndexContent);
  console.log('✅ Generated gateways/index.mdx');

  // Generate providers overview page
  const providersIndexContent = generateProvidersIndexPage(grouped);
  await fs.writeFile(path.join(providersDir, 'index.mdx'), providersIndexContent);
  console.log('✅ Generated providers/index.mdx');

  // Generate individual provider pages
  for (const provider of [...grouped.popular, ...grouped.other]) {
    const content = generateProviderPage(provider);
    await fs.writeFile(path.join(providersDir, `${provider.id}.mdx`), content);
    console.log(`✅ Generated providers/${provider.id}.mdx`);
  }

  // Generate individual gateway pages
  for (const [gatewayName, providers] of grouped.gateways) {
    const content = generateGatewayPage(gatewayName, providers);
    await fs.writeFile(path.join(gatewaysDir, `${gatewayName}.mdx`), content);
    console.log(`✅ Generated gateways/${gatewayName}.mdx`);
  }

  console.log(`
📚 Documentation generated successfully!
   - ${grouped.popular.length + grouped.other.length} provider pages + 1 overview
   - ${grouped.gateways.size} gateway pages + 1 overview
   - 1 main index page
   
   Total: ${grouped.popular.length + grouped.other.length + grouped.gateways.size + 3} pages generated
  `);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDocs().catch(error => {
    console.error('Failed to generate documentation:', error);
    process.exit(1);
  });
}

export { generateDocs, parseProviders, generateProviderPage, generateGatewayPage, generateIndexPage };
