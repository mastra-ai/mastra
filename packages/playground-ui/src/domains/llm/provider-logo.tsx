import { useState } from 'react';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { cleanProviderId as cleanProviderIdUtil } from './clean-provider-id';
import { modelsDevLogoSlugs } from './models-dev-logo-slugs';
import { ProviderLogoMonogram } from './provider-logo-monogram';
import { providerMapToIcon } from './provider-map-icon';
import { ByteDanceIcon } from '@/ds/icons/ByteDanceIcon';
import { ClaudeIcon } from '@/ds/icons/ClaudeIcon';
import { CohereBrandIcon } from '@/ds/icons/CohereBrandIcon';
import { DeepSeekIcon } from '@/ds/icons/DeepSeekIcon';
import { FireworksIcon } from '@/ds/icons/FireworksIcon';
import { GeminiIcon } from '@/ds/icons/GeminiIcon';
import { Icon } from '@/ds/icons/Icon';
import type { IconSize } from '@/ds/icons/Icon';
import { LongCatIcon } from '@/ds/icons/LongCatIcon';
import { MetaIcon } from '@/ds/icons/MetaIcon';
import { MicrosoftIcon } from '@/ds/icons/MicrosoftIcon';
import { MinimaxIcon } from '@/ds/icons/MinimaxIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';
import { MoonshotIcon } from '@/ds/icons/MoonshotIcon';
import { MorphIcon } from '@/ds/icons/MorphIcon';
import { NousResearchIcon } from '@/ds/icons/NousResearchIcon';
import { NovaIcon } from '@/ds/icons/NovaIcon';
import { NvidiaIcon } from '@/ds/icons/NvidiaIcon';
import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { OpenRouterIcon } from '@/ds/icons/OpenRouterIcon';
import { PerplexityIcon } from '@/ds/icons/PerplexityIcon';
import { QwenIcon } from '@/ds/icons/QwenIcon';
import { SakanaIcon } from '@/ds/icons/SakanaIcon';
import { StepFunIcon } from '@/ds/icons/StepFunIcon';
import { TencentIcon } from '@/ds/icons/TencentIcon';
import { TypesafeIcon } from '@/ds/icons/TypesafeIcon';
import { UpstageIcon } from '@/ds/icons/UpstageIcon';
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
  ['tencent', TencentIcon],
  ['bytedance', ByteDanceIcon],
  ['bytedance-seed', ByteDanceIcon],
  ['sakana', SakanaIcon],
  ['microsoft', MicrosoftIcon],
  ['amazon', NovaIcon],
  ['cohere', CohereBrandIcon],
  ['perplexity', PerplexityIcon],
  ['fireworks', FireworksIcon],
  ['stepfun', StepFunIcon],
  ['meituan', LongCatIcon],
  ['upstage', UpstageIcon],
  ['morph', MorphIcon],
  ['nousresearch', NousResearchIcon],
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

export const ProviderLogo = ({ providerId, className = '', size = 'lg', style }: ProviderLogoProps) => {
  const [failedLogoSlug, setFailedLogoSlug] = useState<string>();

  const cleanedProviderId = cleanProviderIdUtil(providerId);
  const normalizeProviderId = (id: string) => id.replace(/^~/, '').replace(/\//g, '-').toLowerCase();
  const cleanProviderId = normalizeProviderId(cleanedProviderId);
  const exactProviderId = normalizeProviderId(providerId);
  const logoSlug = modelsDevLogoSlugs.has(exactProviderId) ? exactProviderId : cleanProviderId;

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

  if (!modelsDevLogoSlugs.has(logoSlug) || failedLogoSlug === logoSlug) {
    const fallbackIcon = fallbackProviderIcons.get(cleanedProviderId);
    const fallback = fallbackIcon ? providerMapToIcon[fallbackIcon] : undefined;
    if (fallback) {
      return (
        <Icon size={iconSize} className={cn('shrink-0', className)} style={{ ...sizeStyle, ...style }}>
          {fallback}
        </Icon>
      );
    }
    return (
      <ProviderLogoMonogram
        providerId={providerId}
        className={cn(sizeClassName, className)}
        style={{ ...sizeStyle, ...style }}
      />
    );
  }

  return (
    <img
      src={`https://models.dev/logos/${logoSlug}.svg`}
      alt={`${providerId} logo`}
      className={cn('shrink-0 dark:brightness-0 dark:invert', sizeClassName, className)}
      onError={() => setFailedLogoSlug(logoSlug)}
      loading="lazy"
      style={{
        ...sizeStyle,
        objectFit: 'contain',
        opacity: 0.9,
      }}
    />
  );
};
