import { useState } from 'react';
import { Icon } from '@/ds/icons';
import { providerMapToIcon } from '../provider-map-icon';
import { cleanProviderId as cleanProviderIdUtil } from './utils';

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
    };
    return iconMap[id] || 'DEFAULT';
  };

  const fallbackIcon = getFallbackProviderIcon(cleanedProviderId);
  const isGateway = ['netlify'].includes(cleanProviderId);

  // If we've already had an error or don't have a provider ID or this is a special gateway case, show fallback
  if (isGateway || imageError || !providerId) {
    if (providerMapToIcon[fallbackIcon as keyof typeof providerMapToIcon]) {
      return <Icon>{providerMapToIcon[fallbackIcon as keyof typeof providerMapToIcon]}</Icon>;
    }
    return <div className={`w-[${size}px] h-[${size}px] bg-gray-200 rounded ${className}`} />;
  }

  return (
    <img
      src={`https://models.dev/logos/${cleanProviderId}.svg`}
      alt={`${providerId} logo`}
      width={size}
      height={size}
      className={className}
      onError={() => setImageError(true)}
      loading="lazy"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        filter: 'brightness(0) invert(1)', // Make the logo white
        opacity: 0.9,
      }}
    />
  );
};
