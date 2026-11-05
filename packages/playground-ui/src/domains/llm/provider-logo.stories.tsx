import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProviderLogo } from './provider-logo';
import { Txt } from '@/ds/components/Txt';

const meta = {
  title: 'Domains/LLM/ProviderLogo',
  component: ProviderLogo,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Pass an icon size token (`xs`, `sm`, `md`, `lg`) so the logo matches the icons around it. A pixel number still works for sizes outside the icon scale, such as an avatar tile.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
      description: 'Prefer an icon size token. A pixel number is also accepted.',
    },
  },
  args: {
    providerId: 'anthropic',
    size: 'md',
  },
} satisfies Meta<typeof ProviderLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

const providers = [
  ['anthropic', 'Claude Sonnet 4.5'],
  ['google', 'Gemini 2.5 Flash'],
  ['deepseek', 'DeepSeek Chat'],
  ['openai', 'GPT-5 Mini'],
  ['openrouter', 'Claude Haiku 4.5'],
  ['qwen', 'Qwen3 Coder'],
  ['mistralai', 'Mistral Large'],
  ['z-ai', 'GLM 4.6'],
  ['nvidia', 'Nemotron Nano 9B'],
  ['minimax', 'MiniMax M2'],
  ['meta-llama', 'Llama 4 Maverick'],
  ['moonshotai', 'Kimi K2'],
  ['x-ai', 'Grok 4'],
  ['typesafe', 'Jev Router'],
  ['tencent', 'Hunyuan A13B'],
  ['bytedance-seed', 'Seed 2.0 Lite'],
  ['sakana', 'Fugu Max'],
  ['microsoft', 'Phi 4'],
] as const;

export const Default: Story = {};

export const ModelRows: Story = {
  parameters: {
    docs: { description: { story: 'Bundled marks at 16px beside a model name and 12px in a muted caption.' } },
  },
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      {providers.map(([providerId, model]) => (
        <div key={providerId} className="flex items-center gap-2 text-label text-foreground">
          <ProviderLogo providerId={providerId} size="md" />
          <span>{model}</span>
          <span className="flex items-center gap-1 text-caption text-muted-foreground">
            <ProviderLogo providerId={providerId} size="xs" />
            {providerId}
          </span>
        </div>
      ))}
    </div>
  ),
};

const iconSizes = ['xs', 'sm', 'md', 'lg'] as const;

export const Sizes: Story = {
  parameters: {
    docs: { description: { story: 'Every bundled mark at each icon size token.' } },
  },
  render: () => (
    <div className="flex flex-col gap-4">
      {iconSizes.map(size => (
        <div key={size} className="flex items-center gap-3 text-foreground">
          <span className="w-16 text-caption text-muted-foreground">{size}</span>
          {providers.map(([providerId]) => (
            <ProviderLogo key={providerId} providerId={providerId} size={size} />
          ))}
        </div>
      ))}
    </div>
  ),
};

const fallbacks = [
  ['cerebras', 'Loaded from models.dev'],
  ['groq', 'Loaded from models.dev'],
  ['netlify', 'Gateway icon'],
  ['aion-labs', 'No logo, monogram'],
  ['~stealth', 'Leading tilde, monogram'],
  ['', 'No provider'],
] as const;

export const Fallbacks: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A bundled mark wins first. Then a logo on the verified models.dev list. Everything else gets a neutral monogram, so a vendor without a logo never shows the generic models.dev placeholder.',
      },
    },
  },
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      {fallbacks.map(([providerId, label]) => (
        <div key={label + providerId} className="flex items-center gap-2 text-label text-foreground">
          <ProviderLogo providerId={providerId} size="md" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  ),
};

const bundledVendors = [
  'amazon',
  'anthropic',
  'bytedance',
  'bytedance-seed',
  'cohere',
  'deepseek',
  'fireworks',
  'google',
  'meituan',
  'meta',
  'meta-llama',
  'microsoft',
  'minimax',
  'mistralai',
  'moonshotai',
  'morph',
  'nousresearch',
  'nvidia',
  'openai',
  'openrouter',
  'perplexity',
  'qwen',
  'sakana',
  'stepfun',
  'tencent',
  'typesafe',
  'upstage',
  'x-ai',
  'z-ai',
];

const modelsDevVendors = ['inception', 'liquid', 'reflection', 'thinkingmachines', 'xiaomi'];

const monogramVendors = [
  'aion-labs',
  'anthracite-org',
  'cognitivecomputations',
  'dots-studio',
  'elorian',
  'gryphe',
  'ibm-granite',
  'inclusionai',
  'inference-net',
  'mancer',
  'moondream',
  'nex-agi',
  'particle-ai',
  'perceptron',
  'prism-ml',
  'recursive',
  'rekaai',
  'relace',
  'ricursiveai',
  'sao10k',
  'scaledown',
  'stealth',
  'thedrummer',
  'unbiased',
  'undi95',
  'writer',
  'xingchen-agi',
];

const catalogSections = [
  ['Bundled marks', bundledVendors],
  ['models.dev logos', modelsDevVendors],
  ['Monogram fallback', monogramVendors],
] as const;

const GatewayCatalog = () => (
  <div className="flex w-200 flex-col gap-6">
    {catalogSections.map(([title, vendors]) => (
      <section key={title} className="flex flex-col gap-3">
        <Txt as="h3" variant="label" tone="muted">
          {title} ({vendors.length})
        </Txt>
        <div className="grid grid-cols-4 gap-3">
          {vendors.map(vendor => (
            <div key={vendor} className="flex items-center gap-2">
              <ProviderLogo providerId={vendor} size="lg" />
              <Txt as="span" variant="label" tone="ink" className="truncate">
                {vendor}
              </Txt>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export const GatewayCatalogDark: Story = {
  globals: { theme: 'dark' },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Every vendor prefix in the Gateway catalog on the dark theme, grouped by how its logo is drawn.',
      },
    },
  },
  render: () => <GatewayCatalog />,
};

export const GatewayCatalogLight: Story = {
  globals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Every vendor prefix in the Gateway catalog on the light theme, grouped by how its logo is drawn.',
      },
    },
  },
  render: () => <GatewayCatalog />,
};

export const PixelSize: Story = {
  args: { size: 32 },
  parameters: {
    docs: { description: { story: 'A pixel size for a slot outside the icon scale, such as a 32px model tile.' } },
  },
};
