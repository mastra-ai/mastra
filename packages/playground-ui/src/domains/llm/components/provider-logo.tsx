import { useState } from 'react';
import { Icon } from '@/ds/icons';
import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { AnthropicMessagesIcon } from '@/ds/icons/AnthropicMessagesIcon';
import { GoogleIcon } from '@/ds/icons';
import { XGroqIcon } from '@/ds/icons/XGroqIcon';
import { GroqIcon } from '@/ds/icons/GroqIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';
import { NetlifyIcon } from '@/ds/icons/NetlifyIcon';
import { cleanProviderId } from '../utils/provider-utils';

export interface ProviderLogoProps {
  /** Provider ID (e.g., 'openai', 'anthropic.messages') */
  providerId: string;
  /** CSS class name */
  className?: string;
  /** Logo size in pixels */
  size?: number;
}

/**
 * Provider icon mapping for fallback display
 */
const PROVIDER_ICON_MAP: Record<string, React.ReactNode> = {
  openai: <OpenaiChatIcon />,
  anthropic: <AnthropicMessagesIcon />,
  google: <GoogleIcon />,
  xai: <XGroqIcon />,
  groq: <GroqIcon />,
  mistral: <MistralIcon />,
  netlify: <NetlifyIcon fill="white" />,
};

/**
 * Provider ID to fallback icon key mapping
 */
const PROVIDER_FALLBACK_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  xai: 'xai',
  groq: 'groq',
  deepseek: 'deepseek',
  together: 'together',
  mistral: 'mistral',
  perplexity: 'perplexity',
  fireworks_ai: 'fireworks',
  openrouter: 'openrouter',
  netlify: 'netlify',
};

/** Providers that should use local icons instead of models.dev */
const GATEWAY_PROVIDERS = ['netlify'];

/**
 * Component to display provider logos from models.dev
 * Falls back to local icons if the logo fails to load
 */
export const ProviderLogo = ({ providerId, className = '', size = 20 }: ProviderLogoProps) => {
  const [imageError, setImageError] = useState(false);

  // Clean provider ID (remove .chat, .x, .messages, etc. suffixes)
  const cleanedProviderId = cleanProviderId(providerId);

  // Clean up provider ID for models.dev (remove special characters like slashes)
  const cleanProviderIdForUrl = cleanedProviderId.replace(/\//g, '-').toLowerCase();

  // Get fallback icon from our existing mapping
  const getFallbackIcon = (id: string): React.ReactNode | null => {
    const fallbackKey = PROVIDER_FALLBACK_MAP[id];
    if (fallbackKey && PROVIDER_ICON_MAP[fallbackKey]) {
      return PROVIDER_ICON_MAP[fallbackKey];
    }
    // Try direct lookup
    if (PROVIDER_ICON_MAP[id]) {
      return PROVIDER_ICON_MAP[id];
    }
    return null;
  };

  const fallbackIcon = getFallbackIcon(cleanedProviderId);
  const isGateway = GATEWAY_PROVIDERS.includes(cleanProviderIdForUrl);

  // If we've already had an error or don't have a provider ID or this is a special gateway case, show fallback
  if (isGateway || imageError || !providerId) {
    if (fallbackIcon) {
      return <Icon>{fallbackIcon}</Icon>;
    }
    return (
      <div
        className={`bg-gray-200 rounded ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  return (
    <img
      src={`https://models.dev/logos/${cleanProviderIdForUrl}.svg`}
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
