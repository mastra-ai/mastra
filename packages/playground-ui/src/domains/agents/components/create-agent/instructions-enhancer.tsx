'use client';

import * as React from 'react';
import { RefreshCcwIcon, Sparkles } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { usePromptEnhancer } from '../../hooks/use-prompt-enhancer';
import { useAgent } from '../../hooks/use-agent';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { cleanProviderId } from '../agent-metadata/utils';

export interface InstructionsEnhancerProps {
  /** Current instructions value */
  value: string;
  /** Callback when instructions change */
  onChange: (value: string) => void;
  /** Agent ID - required for enhance functionality (only available in edit mode) */
  agentId?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Instructions textarea with AI-powered enhance functionality.
 * The enhance feature is only available in edit mode (when agentId is provided).
 */
export function InstructionsEnhancer({
  value,
  onChange,
  agentId,
  placeholder = 'Enter agent instructions',
  error,
  disabled = false,
}: InstructionsEnhancerProps) {
  const [enhanceComment, setEnhanceComment] = React.useState('');
  const [showEnhanceInput, setShowEnhanceInput] = React.useState(false);

  // Only fetch data if we have an agentId (edit mode)
  const { mutateAsync: enhancePrompt, isPending } = usePromptEnhancer({ agentId: agentId || '' });
  const { data: agent, isLoading: isAgentLoading, isError: isAgentError } = useAgent(agentId);
  const { data: providersData, isLoading: isProvidersLoading } = useAgentsModelProviders();

  const providers = providersData?.providers || [];

  // Check if a provider has an API key configured
  const isProviderConnected = (providerId: string) => {
    const cleanId = cleanProviderId(providerId);
    const provider = providers.find(p => cleanProviderId(p.id) === cleanId);
    return provider?.connected === true;
  };

  // Check if ANY enabled model has a connected provider
  const hasConnectedModel = () => {
    if (!agent) return false;
    if (agent.modelList && agent.modelList.length > 0) {
      return agent.modelList.some(m => m.enabled !== false && isProviderConnected(m.model.provider));
    }
    return agent.provider ? isProviderConnected(agent.provider) : false;
  };

  const isDataLoading = isAgentLoading || isProvidersLoading;
  const hasValidModel = !isDataLoading && !isAgentError && hasConnectedModel();

  // Enhance is only available in edit mode with a valid model
  const canEnhance = !!agentId && hasValidModel;
  const showEnhanceWarning = !!agentId && !isDataLoading && !hasValidModel;

  const handleEnhance = async () => {
    if (!canEnhance) return;

    try {
      const result = await enhancePrompt({ instructions: value, userComment: enhanceComment });
      onChange(result.new_prompt);
      setEnhanceComment('');
      setShowEnhanceInput(false);
    } catch {
      // Error is already handled by the hook with toast
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && showEnhanceInput) {
      e.preventDefault();
      handleEnhance();
    }
    if (e.key === 'Escape') {
      setShowEnhanceInput(false);
      setEnhanceComment('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        disabled={disabled || isPending}
        className={cn(
          'flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors',
          'border-sm border-border1 placeholder:text-icon3',
          'px-[13px] py-2 text-[calc(13_/_16_*_1rem)] resize-y min-h-[120px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-accent2',
        )}
      />

      {error && <span className="text-xs text-accent2">{error}</span>}

      {/* Enhance UI - only show in edit mode */}
      {agentId && (
        <div className="flex flex-col gap-2">
          {showEnhanceInput ? (
            <div className="flex gap-2" onKeyDown={handleKeyDown}>
              <Input
                value={enhanceComment}
                onChange={e => setEnhanceComment(e.target.value)}
                placeholder="Describe how to improve the instructions..."
                disabled={isPending || !canEnhance}
                className="flex-1"
                autoFocus
              />
              <Button type="button" variant="light" onClick={handleEnhance} disabled={isPending || !canEnhance}>
                <Icon>{isPending ? <Spinner /> : <RefreshCcwIcon />}</Icon>
                Enhance
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowEnhanceInput(false);
                  setEnhanceComment('');
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex justify-end items-center gap-2">
              {showEnhanceWarning && (
                <span className="text-xs text-yellow-200">No model with a configured API key found.</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setShowEnhanceInput(true)}
                disabled={!canEnhance}
                className="text-icon3 hover:text-icon5"
              >
                <Icon>
                  <Sparkles className="h-3 w-3" />
                </Icon>
                Enhance with AI
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
