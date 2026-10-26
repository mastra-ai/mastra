import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProviderLogo } from './provider-logo';

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
  ['groq', 'Local fallback icon'],
  ['netlify', 'Gateway icon'],
  ['unknown-provider', 'Unknown provider, models.dev default'],
  ['', 'Placeholder without a provider'],
] as const;

export const Fallbacks: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Providers without a bundled mark load from models.dev, then a local icon, then a placeholder.',
      },
    },
  },
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      {fallbacks.map(([providerId, label]) => (
        <div key={label} className="flex items-center gap-2 text-label text-foreground">
          <ProviderLogo providerId={providerId} size="md" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  ),
};

export const PixelSize: Story = {
  args: { size: 32 },
  parameters: {
    docs: { description: { story: 'A pixel size for a slot outside the icon scale, such as a 32px model tile.' } },
  },
};
