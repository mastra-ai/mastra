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
    'fireworks-ai': 'Fireworks AI',
    openrouter: 'OpenRouter',
    togetherai: 'Together AI',
    huggingface: 'Hugging Face',
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    xai: 'xAI',
    'github-copilot': 'GitHub Copilot',
    'github-models': 'GitHub Models',
    deepinfra: 'Deep Infra',
    fastrouter: 'FastRouter',
    baseten: 'Baseten',
    lmstudio: 'LMStudio',
    modelscope: 'ModelScope',
    moonshotai: 'Moonshot AI',
    'moonshotai-cn': 'Moonshot AI (China)',
    zhipuai: 'Zhipu AI',
    opencode: 'OpenCode',
  };

  const lower = name.toLowerCase();
  if (specialCases[lower]) {
    return specialCases[lower];
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
const GATEWAY_PROVIDERS = ['vercel', 'openrouter', 'fireworks-ai', 'groq', 'huggingface', 'togetherai'];

interface ProviderInfo {
  id: string;
  name: string;
  url?: string;
  apiKeyEnvVar: string | string[];
  apiKeyHeader: string;
  models: readonly string[];
  isGateway: boolean;
  isPopular: boolean;
  baseProvider?: string; // For gateway providers like netlify/openai -> openai
  packageName?: string; // Vercel AI SDK package name from models.dev
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
    // Also treat the gateway prefix itself as a gateway (e.g., standalone "netlify")
    const isGatewayPrefix = GATEWAY_PREFIXES.includes(id);
    const isGateway = isPrefixedGateway || isStandaloneGateway || isGatewayPrefix;

    let gatewayName: string | undefined;
    let baseProvider: string | undefined;

    if (isPrefixedGateway) {
      const parts = id.split('/');
      gatewayName = parts[0];
      baseProvider = parts.slice(1).join('/');
    } else if (isStandaloneGateway || isGatewayPrefix) {
      gatewayName = id;
      baseProvider = undefined; // Standalone gateways don't have a base provider
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

async function fetchProviderInfo(providerId: string): Promise<{ models: any[]; packageName?: string }> {
  try {
    const response = await fetch('https://models.dev/api.json');
    const data = await response.json();
    const provider = data[providerId];

    if (!provider?.models) return { models: [] };

    const models = Object.entries(provider.models).map(([modelId, model]: [string, any]) => ({
      model: `${providerId}/${modelId}`,
      imageInput: model.modalities?.input?.includes('image') || false,
      audioInput: model.modalities?.input?.includes('audio') || false,
      videoInput: model.modalities?.input?.includes('video') || false,
      toolUsage: model.tool_call !== false,
      reasoning: model.reasoning === true,
      contextWindow: model.limit?.context || null,
      maxOutput: model.limit?.output || null,
      inputCost: model.cost?.input || null,
      outputCost: model.cost?.output || null,
    }));

    return {
      models,
      packageName: provider.npm || undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch models for ${providerId}:`, error);
    return { models: [] };
  }
}

async function generateProviderPage(provider: ProviderInfo): Promise<string> {
  const modelCount = provider.models.length;

  // Get documentation URL if available
  const rawDocUrl = (PROVIDER_REGISTRY[provider.id] as any).docUrl;
  const docUrl = cleanDocumentationUrl(rawDocUrl);

  // Create intro with optional documentation link
  const introText = docUrl
    ? `Access ${modelCount} ${provider.name} model${modelCount !== 1 ? 's' : ''} through Mastra's model router. Authentication is handled automatically using the \`${provider.apiKeyEnvVar}\` environment variable.\n\nLearn more in the [${provider.name} documentation](${docUrl}).`
    : `Access ${modelCount} ${provider.name} model${modelCount !== 1 ? 's' : ''} through Mastra's model router. Authentication is handled automatically using the \`${provider.apiKeyEnvVar}\` environment variable.`;

  // Fetch model capabilities from models.dev
  const { models: modelsWithCapabilities, packageName } = await fetchProviderInfo(provider.id);
  provider.packageName = packageName;

  // Generate static model data as JSON for the component (show all models)
  const modelDataJson = JSON.stringify(modelsWithCapabilities, null, 2);

  return `---
title: "${provider.name} | Models | Mastra"
description: "Use ${provider.name} models with Mastra. ${modelCount} model${modelCount !== 1 ? 's' : ''} available."
---

import { ProviderModelsTable } from "@/components/provider-models-table";
import { Callout } from "nextra/components";
${provider.packageName && provider.packageName !== '@ai-sdk/openai-compatible' ? 'import { Tabs, Tab } from "@/components/tabs";' : ''}

# <img src="${getLogoUrl(provider.id)}" alt="${provider.name} logo" className="${getLogoClass(provider.id)}" />${provider.name}

${introText}

\`\`\`bash
${provider.apiKeyEnvVar}=your-api-key
\`\`\`

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
${
  provider.id === 'openai'
    ? `
<Callout type="info">
Mastra uses the OpenAI-compatible \`/chat/completions\` endpoint. Some provider-specific features may not be available. Check the [OpenAI documentation](https://platform.openai.com/docs/api-reference/chat) for details.
</Callout>
`
    : `
<Callout type="info">
Mastra uses the OpenAI-compatible \`/chat/completions\` endpoint. Some provider-specific features may not be available. Check the [${provider.name} documentation](${docUrl || '#'}) for details.
</Callout>
`
}
## Models

<ProviderModelsTable 
  models={${modelDataJson}}
/>

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
${
  provider.packageName && provider.packageName !== '@ai-sdk/openai-compatible'
    ? `
## Direct Provider Installation

This provider can also be installed directly as a standalone package, which can be used instead of the Mastra model router string. View the [package documentation](https://www.npmjs.com/package/${provider.packageName}) for more details.

<Tabs items={["npm", "yarn", "pnpm", "bun"]}>
  <Tab>
    \`\`\`bash copy
    npm install ${provider.packageName}
    \`\`\`
  </Tab>
  <Tab>
    \`\`\`bash copy
    yarn add ${provider.packageName}
    \`\`\`
  </Tab>
  <Tab>
    \`\`\`bash copy
    pnpm add ${provider.packageName}
    \`\`\`
  </Tab>
  <Tab>
    \`\`\`bash copy
    bun add ${provider.packageName}
    \`\`\`
  </Tab>
</Tabs>
`
    : ''
}`;
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

/**
 * Check if a provider has a React logo component
 */
function hasLogoComponent(providerId: string): boolean {
  const providersWithComponents = ['netlify'];
  return providersWithComponents.includes(providerId);
}

/**
 * Get the logo component import statement for a provider
 */
function getLogoComponentImport(providerId: string): string {
  const componentName = providerId.charAt(0).toUpperCase() + providerId.slice(1) + 'Logo';
  return `import { ${componentName} } from '@/components/logos/${componentName}';`;
}

/**
 * Get the logo component JSX for a provider
 */
function getLogoComponentJSX(providerId: string): string {
  const componentName = providerId.charAt(0).toUpperCase() + providerId.slice(1) + 'Logo';
  return `<${componentName} className="inline w-8 h-8 mr-2 align-middle" />`;
}

function generateGatewayPage(gatewayName: string, providers: ProviderInfo[]): string {
  const displayName = formatProviderName(gatewayName);
  const totalModels = providers.reduce((sum, p) => sum + p.models.length, 0);
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

  // Generate logo markup - use component if available, otherwise use img tag
  const logoImport = hasLogoComponent(gatewayName) ? `${getLogoComponentImport(gatewayName)}\n` : '';
  const logoMarkup = hasLogoComponent(gatewayName)
    ? getLogoComponentJSX(gatewayName)
    : `<img src="${getLogoUrl(gatewayName)}" alt="${displayName} logo" className="${getLogoClass(gatewayName)}" />`;

  return `---
title: "${displayName} | Models | Mastra"  
description: "Use AI models through ${displayName}."
---

${logoImport}import { Callout } from "nextra/components";

# ${logoMarkup}${displayName}

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

<Callout type="info">
Mastra uses the OpenAI-compatible \`/chat/completions\` endpoint. Some provider-specific features may not be available. ${docUrl ? `Check the [${displayName} documentation](${docUrl}) for details.` : `Check the ${displayName} documentation for details.`}
</Callout>

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
            <img src="${getLogoUrl('fireworks-ai')}" alt="Fireworks AI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>Fireworks AI</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <img src="${getLogoUrl('togetherai')}" alt="Together AI" className="w-4 h-4 object-contain dark:invert dark:brightness-0 dark:contrast-200" />
            <span>Together AI</span>
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
  const orderedGateways = ['netlify', 'openrouter', 'fireworks-ai', 'groq', 'huggingface', 'togetherai', 'vercel'];
  const gatewaysList = orderedGateways.filter(g => grouped.gateways.has(g));

  const hasNetlify = gatewaysList.includes('netlify');
  const logoImport = hasNetlify ? '\nimport { NetlifyLogo } from "@/components/logos/NetlifyLogo";' : '';

  return `---
title: "Gateways"
description: "Access AI models through gateway providers with caching, rate limiting, and analytics."
---

import { CardGrid, CardGridItem } from "@/components/cards/card-grid";${logoImport}

# Gateway Providers

Gateway providers aggregate multiple model providers and add features like caching, rate limiting, analytics, and automatic failover. Use gateways when you need observability, cost management, or simplified multi-provider access.

<CardGrid>
${gatewaysList
  .map(g => {
    if (g === 'netlify') {
      return `    <CardGridItem
      title="${formatProviderName(g).replace(/&/g, '&amp;')}"
      description="${grouped.gateways.get(g)?.reduce((sum, p) => sum + p.models.length, 0) || 0} models"
      href="./gateways/${g}"
      logo={<NetlifyLogo />}
    />`;
    }
    return `    <CardGridItem
      title="${formatProviderName(g).replace(/&/g, '&amp;')}"
      description="${grouped.gateways.get(g)?.reduce((sum, p) => sum + p.models.length, 0) || 0} models"
      href="./gateways/${g}"
      logo="${getLogoUrl(g)}"
      
    />`;
  })
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

function generateProvidersMeta(grouped: GroupedProviders): string {
  const allProviders = [...grouped.popular, ...grouped.other];

  // Build the meta object with index first, then all providers in order
  const metaEntries = ['  index: "Overview"'];

  for (const provider of allProviders) {
    // Quote keys that contain dashes or other special characters
    const key = provider.id.includes('-') ? `"${provider.id}"` : provider.id;
    metaEntries.push(`  ${key}: "${provider.name}"`);
  }

  return `const meta = {
${metaEntries.join(',\n')},
};

export default meta;
`;
}

function generateGatewaysMeta(grouped: GroupedProviders): string {
  const orderedGateways = ['netlify', 'openrouter', 'fireworks-ai', 'groq', 'huggingface', 'togetherai', 'vercel'];
  const gatewaysList = orderedGateways.filter(g => grouped.gateways.has(g));

  // Build the meta object with index first, then all gateways in order
  const metaEntries = ['  index: \"Overview\"'];

  for (const gatewayId of gatewaysList) {
    const providers = grouped.gateways.get(gatewayId);
    if (providers && providers.length > 0) {
      const name = formatProviderName(gatewayId);
      // Quote keys that contain dashes or other special characters
      const key = gatewayId.includes('-') ? `\"${gatewayId}\"` : gatewayId;
      metaEntries.push(`  ${key}: \"${name}\"`);
    }
  }

  return `const meta = {
${metaEntries.join(',\n')},
};

export default meta;
`;
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
  console.info('✅ Generated models/index.mdx');

  // Generate gateways overview page
  const gatewaysIndexContent = generateGatewaysIndexPage(grouped);
  await fs.writeFile(path.join(gatewaysDir, 'index.mdx'), gatewaysIndexContent);
  console.info('✅ Generated gateways/index.mdx');

  // Generate gateways _meta.ts
  const gatewaysMetaContent = generateGatewaysMeta(grouped);
  await fs.writeFile(path.join(gatewaysDir, '_meta.ts'), gatewaysMetaContent);
  console.info('✅ Generated gateways/_meta.ts');

  // Generate providers overview page
  const providersIndexContent = generateProvidersIndexPage(grouped);
  await fs.writeFile(path.join(providersDir, 'index.mdx'), providersIndexContent);
  console.info('✅ Generated providers/index.mdx');

  // Generate providers _meta.ts
  const providersMetaContent = generateProvidersMeta(grouped);
  await fs.writeFile(path.join(providersDir, '_meta.ts'), providersMetaContent);
  console.info('✅ Generated providers/_meta.ts');

  // Generate individual provider pages
  for (const provider of [...grouped.popular, ...grouped.other]) {
    const content = await generateProviderPage(provider);
    await fs.writeFile(path.join(providersDir, `${provider.id}.mdx`), content);
    console.info(`✅ Generated providers/${provider.id}.mdx`);
  }

  // Generate individual gateway pages
  for (const [gatewayName, providers] of grouped.gateways) {
    const content = generateGatewayPage(gatewayName, providers);
    await fs.writeFile(path.join(gatewaysDir, `${gatewayName}.mdx`), content);
    console.info(`✅ Generated gateways/${gatewayName}.mdx`);
  }

  console.info(`
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

export {
  generateDocs,
  parseProviders,
  generateProviderPage,
  generateGatewayPage,
  generateIndexPage,
  generateProvidersMeta,
};
