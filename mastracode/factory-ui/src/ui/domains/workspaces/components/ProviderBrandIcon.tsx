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
  className: string;
}

const PROVIDER_ICON_CONFIG: Record<string, ProviderIconConfig> = {
  anthropic: { icon: AnthropicMessagesIcon, className: 'size-3.5 shrink-0' },
  openai: { icon: OpenAIIcon, className: 'size-[18px] shrink-0' },
  'openai-codex': { icon: OpenAIIcon, className: 'size-[18px] shrink-0' },
  'github-copilot': { icon: GithubIcon, className: 'size-4 shrink-0' },
  xai: { icon: XGroqIcon, className: 'size-5 shrink-0' },
  google: { icon: GoogleIcon, className: 'size-4 shrink-0' },
  groq: { icon: GroqIcon, className: 'size-4 shrink-0' },
  mistral: { icon: MistralIcon, className: 'size-4 shrink-0' },
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
      <Icon className={config.className} focusable="false" />
    </span>
  );
}
