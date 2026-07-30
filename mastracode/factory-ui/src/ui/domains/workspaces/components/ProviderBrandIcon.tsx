import { AnthropicMessagesIcon } from '@mastra/playground-ui/icons/AnthropicMessagesIcon';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { GoogleIcon } from '@mastra/playground-ui/icons/GoogleIcon';
import { GroqIcon } from '@mastra/playground-ui/icons/GroqIcon';
import { MistralIcon } from '@mastra/playground-ui/icons/MistralIcon';
import { OpenAIIcon } from '@mastra/playground-ui/icons/OpenAIIcon';
import { XGroqIcon } from '@mastra/playground-ui/icons/XGroqIcon';
import type { ComponentType, SVGProps } from 'react';

interface ProviderIconConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  sizeClassName: string;
}

const PROVIDER_ICON_CONFIG: Record<string, ProviderIconConfig> = {
  anthropic: { icon: AnthropicMessagesIcon, sizeClassName: 'size-4' },
  openai: { icon: OpenAIIcon, sizeClassName: 'size-4' },
  'openai-codex': { icon: OpenAIIcon, sizeClassName: 'size-4' },
  'github-copilot': { icon: GithubIcon, sizeClassName: 'size-4' },
  xai: { icon: XGroqIcon, sizeClassName: 'size-5' },
  google: { icon: GoogleIcon, sizeClassName: 'size-4' },
  groq: { icon: GroqIcon, sizeClassName: 'size-4' },
  mistral: { icon: MistralIcon, sizeClassName: 'size-4' },
};

export interface ProviderBrandIconProps {
  provider: string;
}

export function ProviderBrandIcon({ provider }: ProviderBrandIconProps) {
  const config = PROVIDER_ICON_CONFIG[provider];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
      <Icon className={config.sizeClassName} focusable="false" />
    </span>
  );
}
