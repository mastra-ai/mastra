import { Icon, cn } from '@mastra/playground-ui';
import { useState } from 'react';
import { cleanProviderId as cleanProviderIdUtil } from '../utils';
import { providerMapToIcon } from '@/domains/agents/components/provider-map-icon';

interface ProviderLogoProps {
  providerId: string;
  className?: string;
  size?: number;
}

/**
 * Component to display provider logos from models.dev
 * Falls back to local icons if the logo fails to load
 */
export const ProviderLogo = ({ providerId, className = '', size = 20 }: ProviderLogoProps) => {
  const [imageError, setImageError] = useState(false);

  // Clean provider ID (remove .chat, .x, .messages, etc. suffixes)
  const cleanedProviderId = cleanProviderIdUtil(providerId);

  // Clean up provider ID for models.dev (remove special characters like slashes)
  const cleanProviderId = cleanedProviderId.replace(/\//g, '-').toLowerCase();

  // Get fallback icon from our existing mapping
  const getFallbackProviderIcon = (id: string): string => {
    const iconMap: Record<string, string> = {
      openai: 'openai.chat',
      anthropic: 'anthropic.messages',
      google: 'GOOGLE',
      xai: 'X_GROK',
      groq: 'GROQ',
      deepseek: 'deepseek',
      together: 'together',
      mistral: 'mistral',
      perplexity: 'perplexity',
      fireworks_ai: 'fireworks',
      openrouter: 'openrouter',
      netlify: 'netlify',
      mastra: 'mastra',
    };
    return iconMap[id] || 'DEFAULT';
  };

  const fallbackIcon = getFallbackProviderIcon(cleanedProviderId);
  const isGateway = ['netlify', 'mastra'].includes(cleanProviderId);

  // If we've already had an error or don't have a provider ID or this is a special gateway case, show fallback
  if (isGateway || imageError || !providerId) {
    if (providerMapToIcon[fallbackIcon as keyof typeof providerMapToIcon]) {
      return <Icon>{providerMapToIcon[fallbackIcon as keyof typeof providerMapToIcon]}</Icon>;
    }
    return (
      <div
        className={cn('bg-surface4 rounded shrink-0', className)}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      />
    );
  }

  return (
    <img
      src={`https://models.dev/logos/${cleanProviderId}.svg`}
      alt={`${providerId} logo`}
      width={size}
      height={size}
      className={cn('shrink-0 dark:brightness-0 dark:invert', className)}
      onError={() => setImageError(true)}
      loading="lazy"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        objectFit: 'contain',
        opacity: 0.9,
      }}
    />
  );
};
