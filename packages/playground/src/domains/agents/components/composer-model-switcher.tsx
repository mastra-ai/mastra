import type { UpdateModelParams } from '@mastra/client-js';
import { cn } from '@mastra/playground-ui';
import { TriangleAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAgent } from '../hooks/use-agent';
import { useUpdateAgentModel } from '../hooks/use-agents';
import { LLMProviders, LLMModels, useLLMProviders, cleanProviderId, findProviderById } from '@/domains/llm';

// Inner pills are TRANSPARENT — the outer wrapper (in thread.tsx) carries the visible
// pill shape, bg, and border. Each pill keeps per-corner radii on its OUTER edge so its
// hover/active fill is clipped to the pill outline (no overflow-hidden anywhere — keeps
// the connection-status dot on the provider icon visible).
//
// `min-w-0` resets Combobox base `min-w-32` (128px) so icon-only collapse actually shrinks.
// `!` (Tailwind v4 important) on per-corner radii guarantees the longhand wins regardless
// of CSS emit order vs. the base `rounded-lg` shorthand.
const COMPOSER_TRIGGER_CLASS = [
  'w-auto min-w-0 px-3 gap-1',
  'border-0 bg-transparent',
  'hover:bg-surface5 active:bg-surface6',
  'data-[popup-open]:bg-surface5',
  'transition-colors duration-normal',
].join(' ');

export interface ComposerModelSwitcherProps {
  agentId: string;
}

export const ComposerModelSwitcher = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();

  const defaultProvider = agent?.provider || '';
  const defaultModel = agent?.modelId || '';

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [modelOpen, setModelOpen] = useState(false);

  const providers = dataProviders?.providers || [];

  // Update local state when agent data changes
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider);
  }, [defaultModel, defaultProvider]);

  const currentModelProvider = cleanProviderId(selectedProvider);

  // Resolve the full provider ID (handles gateway prefix, e.g., 'custom' -> 'acme/custom')
  const resolvedProvider = findProviderById(providers, currentModelProvider);
  const fullProviderId = resolvedProvider?.id || currentModelProvider;

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);

    if (modelId && fullProviderId) {
      try {
        await updateModel({
          provider: fullProviderId as UpdateModelParams['provider'],
          modelId,
        });
      } catch (error) {
        console.error('Failed to update model:', error);
      }
    }
  };

  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    const cleanedId = cleanProviderId(providerId);
    setSelectedProvider(cleanedId);

    // Only clear model selection and open model combobox when switching to a different provider
    if (cleanedId !== currentModelProvider) {
      setSelectedModel('');
      setModelOpen(true);
    }
  };

  if (providersLoading) {
    return null;
  }

  return (
    // No overflow-hidden — keeps the provider's connection-status dot visible. Each pill
    // declares `rounded-none` first (tw-merge kills Combobox base `rounded-lg` cleanly,
    // since both target the all-corners shorthand group), then layers per-corner radii.
    // Provider's `border-r-0` + Model's full border = shared 1px divider at the seam.
    <div className="inline-flex items-stretch max-w-full">
      <LLMProviders
        value={currentModelProvider}
        onValueChange={handleProviderSelect}
        size="md"
        className={cn(
          COMPOSER_TRIGGER_CLASS,
          'shrink-0',
          // Left pill end. `!` modifier forces longhand wins over base `rounded-lg`.
          'rounded-none! rounded-tl-full! rounded-bl-full!',
          // Container-narrow: collapse provider to icon-only — hide value text + chevron,
          // tighten padding.
          '@max-md:px-2 @max-md:[&>span>span]:hidden @max-md:[&>svg]:hidden',
        )}
      />
      {/* Vertical divider between the two pills */}
      <div className="w-px self-stretch bg-border1" aria-hidden />
      <LLMModels
        llmId={currentModelProvider}
        value={selectedModel}
        onValueChange={handleModelSelect}
        open={modelOpen}
        onOpenChange={setModelOpen}
        size="md"
        className={cn(
          COMPOSER_TRIGGER_CLASS,
          // Right pill end. Same reset-then-layer pattern as the provider.
          'rounded-none! rounded-tr-full! rounded-br-full!',
          // Cap width — long model names truncate via the Combobox internal `truncate` span.
          'max-w-[10rem]',
        )}
      />
    </div>
  );
};

/** Renders the missing-API-key banner above the composer action row. Returns null when the
 *  provider is connected. Uses TanStack Query — calls dedupe with ComposerModelSwitcher. */
export const ComposerModelWarning = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();

  if (providersLoading || !agent) return null;

  const providers = dataProviders?.providers || [];
  const currentModelProvider = cleanProviderId(agent.provider || '');
  const currentProvider = findProviderById(providers, currentModelProvider);

  if (!currentProvider || currentProvider.connected) return null;

  const envVar = Array.isArray(currentProvider.envVar) ? currentProvider.envVar.join(', ') : currentProvider.envVar;

  return (
    <div className="flex items-start gap-1 px-3 pb-1.5 text-accent6 text-xs min-w-0 max-w-full">
      <TriangleAlert className="w-3 h-3 shrink-0 mt-0.5" />
      <span className="min-w-0 break-words">
        Set <code className="px-1 py-0.5 bg-accent6Dark rounded text-accent6 break-all">{envVar}</code> to use this
        provider
      </span>
    </div>
  );
};
