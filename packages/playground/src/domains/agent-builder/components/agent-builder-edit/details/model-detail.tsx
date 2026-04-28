import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { IconButton, Txt } from '@mastra/playground-ui';
import { CpuIcon, LockIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { useBuilderModelPolicy } from '@/domains/builder';
import { LLMModels, LLMProviders, cleanProviderId } from '@/domains/llm';

interface ModelDetailProps {
  onClose: () => void;
  editable?: boolean;
}

export const ModelDetail = ({ onClose, editable = true }: ModelDetailProps) => {
  const { setValue, watch } = useFormContext<AgentBuilderEditFormValues>();
  const policy = useBuilderModelPolicy();

  const model = watch('model');
  const provider = model?.provider ?? '';
  const modelId = model?.name ?? '';

  const locked = policy.active && policy.pickerVisible === false;
  const stale =
    Boolean(provider && modelId) &&
    policy.active &&
    policy.allowed !== undefined &&
    !isModelAllowed(policy.allowed, { provider: cleanProviderId(provider), modelId });

  const handleProviderSelect = (next: string) => {
    const cleaned = cleanProviderId(next);
    setValue('model', { provider: cleaned, name: '' }, { shouldDirty: true });
  };

  const handleModelSelect = (next: string) => {
    setValue('model', { provider: cleanProviderId(provider), name: next }, { shouldDirty: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <CpuIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Model
          </Txt>
        </div>
        <IconButton tooltip="Close" className="rounded-full" onClick={onClose} data-testid="model-detail-close">
          <XIcon />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-3">
        {locked ? (
          <LockedModelChip
            provider={policy.default?.provider ?? provider}
            modelId={policy.default?.modelId ?? modelId}
          />
        ) : (
          <div className="flex flex-col gap-2" data-testid="model-detail-picker">
            <LLMProviders
              value={provider}
              onValueChange={handleProviderSelect}
              {...(editable ? {} : { onValueChange: () => {} })}
            />
            <LLMModels llmId={provider} value={modelId} onValueChange={handleModelSelect} />
          </div>
        )}

        {stale && !locked && (
          <div
            className="flex items-start gap-2 rounded-md border border-accent6 bg-accent6Dark/40 px-3 py-2 text-accent6"
            data-testid="model-detail-stale-warning"
            role="alert"
          >
            <TriangleAlertIcon className="h-4 w-4 shrink-0 mt-0.5" />
            <Txt variant="ui-xs">
              <span className="font-medium">
                {provider}/{modelId}
              </span>{' '}
              is no longer allowed by the admin policy. Pick a different model to save changes.
            </Txt>
          </div>
        )}
      </div>
    </div>
  );
};

interface LockedModelChipProps {
  provider: string;
  modelId: string;
}

const LockedModelChip = ({ provider, modelId }: LockedModelChipProps) => (
  <div
    className="flex items-center gap-2 rounded-md border border-border1 bg-surface3 px-3 py-2"
    data-testid="model-detail-locked-chip"
  >
    <LockIcon className="h-4 w-4 shrink-0 text-neutral3" />
    <Txt variant="ui-sm" className="font-medium text-neutral6 truncate">
      {provider && modelId ? `${provider}/${modelId}` : 'Locked by admin'}
    </Txt>
    <Txt variant="ui-xs" className="ml-auto shrink-0 text-neutral3">
      Set by admin
    </Txt>
  </div>
);
