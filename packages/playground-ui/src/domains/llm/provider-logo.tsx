import { useState } from 'react';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { cleanProviderId as cleanProviderIdUtil } from './clean-provider-id';
import { providerMapToIcon } from './provider-map-icon';
import { ClaudeIcon } from '@/ds/icons/ClaudeIcon';
import { DeepSeekIcon } from '@/ds/icons/DeepSeekIcon';
import { GeminiIcon } from '@/ds/icons/GeminiIcon';
import { Icon } from '@/ds/icons/Icon';
import type { IconSize } from '@/ds/icons/Icon';
import { MetaIcon } from '@/ds/icons/MetaIcon';
import { MinimaxIcon } from '@/ds/icons/MinimaxIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';
import { MoonshotIcon } from '@/ds/icons/MoonshotIcon';
import { NvidiaIcon } from '@/ds/icons/NvidiaIcon';
import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { OpenRouterIcon } from '@/ds/icons/OpenRouterIcon';
import { QwenIcon } from '@/ds/icons/QwenIcon';
import { TypesafeIcon } from '@/ds/icons/TypesafeIcon';
import { XaiIcon } from '@/ds/icons/XaiIcon';
import { ZaiIcon } from '@/ds/icons/ZaiIcon';
import { cn } from '@/utils/cn';

interface ProviderLogoProps {
  providerId: string;
  className?: string;
  size?: IconSize | number;
  style?: CSSProperties;
}

const brandMarks = new Map<string, ComponentType<SVGProps<SVGSVGElement>>>([
  ['anthropic', ClaudeIcon],
  ['google', GeminiIcon],
  ['deepseek', DeepSeekIcon],
  ['openai', OpenaiChatIcon],
  ['openrouter', OpenRouterIcon],
  ['qwen', QwenIcon],
  ['mistral', MistralIcon],
  ['mistralai', MistralIcon],
  ['zai', ZaiIcon],
  ['z-ai', ZaiIcon],
  ['nvidia', NvidiaIcon],
  ['minimax', MinimaxIcon],
  ['meta', MetaIcon],
  ['meta-llama', MetaIcon],
  ['llama', MetaIcon],
  ['moonshotai', MoonshotIcon],
  ['xai', XaiIcon],
  ['x-ai', XaiIcon],
  ['typesafe', TypesafeIcon],
]);

const iconSizes: IconSize[] = ['xs', 'sm', 'md', 'lg'];

const iconSizeClassNames = {
  xs: 'size-icon-xs',
  sm: 'size-icon-sm',
  md: 'size-icon-md',
  lg: 'size-icon-lg',
} satisfies Record<IconSize, string>;

const fallbackProviderIcons = new Map<string, keyof typeof providerMapToIcon>([
  ['groq', 'GROQ'],
  ['netlify', 'netlify'],
  ['mastra', 'mastra'],
]);

/**
 * Component to display provider logos from models.dev
 * Falls back to local icons if the logo fails to load
 */
export const ProviderLogo = ({ providerId, className = '', size = 'lg', style }: ProviderLogoProps) => {
  const [imageError, setImageError] = useState(false);

  // Clean provider ID (remove .chat, .x, .messages, etc. suffixes)
  const cleanedProviderId = cleanProviderIdUtil(providerId);

  // Clean up provider ID for models.dev (remove special characters like slashes)
  const cleanProviderId = cleanedProviderId.replace(/^~/, '').replace(/\//g, '-').toLowerCase();

  const iconSize = iconSizes.find(name => name === size);
  const sizeClassName = iconSize && iconSizeClassNames[iconSize];
  const sizeStyle = iconSize ? undefined : { width: size, height: size, minWidth: size, minHeight: size };

  const BrandMark = brandMarks.get(cleanProviderId);
  if (BrandMark) {
    return (
      <BrandMark
        role="img"
        aria-label={`${providerId} logo`}
        className={cn('shrink-0', sizeClassName, className)}
        style={{ ...sizeStyle, ...style }}
      />
    );
  }

  const fallbackIcon = fallbackProviderIcons.get(cleanedProviderId);
  const isGateway = ['netlify', 'mastra'].includes(cleanProviderId);

  // If we've already had an error or don't have a provider ID or this is a special gateway case, show fallback
  if (isGateway || imageError || !providerId) {
    const fallback = fallbackIcon ? providerMapToIcon[fallbackIcon] : undefined;
    if (fallback) {
      return (
        <Icon size={iconSize} className={cn('shrink-0', className)} style={{ ...sizeStyle, ...style }}>
          {fallback}
        </Icon>
      );
    }
    return (
      <div className={cn('shrink-0 rounded bg-muted', sizeClassName, className)} style={{ ...sizeStyle, ...style }} />
    );
  }

  return (
    <img
      src={`https://models.dev/logos/${cleanProviderId}.svg`}
      alt={`${providerId} logo`}
      className={cn('shrink-0 dark:brightness-0 dark:invert', sizeClassName, className)}
      onError={() => setImageError(true)}
      loading="lazy"
      style={{
        ...sizeStyle,
        objectFit: 'contain',
        opacity: 0.9,
      }}
    />
  );
};
