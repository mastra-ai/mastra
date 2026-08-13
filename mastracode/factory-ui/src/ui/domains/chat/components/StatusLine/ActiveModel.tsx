import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatModels } from '../../context/useChatModels';
import { useChatSessionContext } from '../../context/useChatSessionContext';

function titleCase(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function lastSegment(id: string): string {
  const parts = id.trim().split('/');
  return parts[parts.length - 1] || id;
}

function formatModelName(id: string): string {
  const slug = lastSegment(id);
  const claudeMatch = slug.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/i);
  const claudeFamily = claudeMatch?.[1];
  const claudeMajor = claudeMatch?.[2];
  const claudeMinor = claudeMatch?.[3];
  if (claudeFamily && claudeMajor && claudeMinor) {
    return `Claude ${titleCase(claudeFamily)} ${claudeMajor}.${claudeMinor}`;
  }

  const gptDetails = slug.match(/^gpt-(.+)$/i)?.[1];
  if (gptDetails) {
    const [version, ...qualifiers] = gptDetails.split('-');
    return [`GPT-${version}`, ...qualifiers.map(titleCase)].join(' ');
  }

  return slug.split(/[-_]+/).filter(Boolean).map(titleCase).join(' ');
}

export function ActiveModel() {
  const { kind, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { activeModelId, isLoading, error, setModel } = useChatModels();
  const { status } = useChatConnection();
  const modelsQuery = useAvailableModelsQuery();
  const [pendingModelId, setPendingModelId] = useState<string>();

  const selectedModelId = pendingModelId ?? activeModelId;
  if (!selectedModelId && (isLoading || status === 'connecting')) {
    return <Skeleton aria-label="Loading model" className="h-3.5 w-24" />;
  }
  if (!selectedModelId && error) {
    return (
      <span className="text-accent2" aria-label="Model unavailable" title={error.message}>
        Model unavailable
      </span>
    );
  }

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    Boolean(selectedModelId) && modelsQuery.isSuccess && !modelsQuery.data.some(model => model.id === selectedModelId);
  const switchable = Boolean(draftSessionId) || (kind === 'factory' && sessionEnabled);

  if (switchable && modelsQuery.data?.length) {
    return (
      <Select
        value={selectedModelId}
        disabled={Boolean(pendingModelId)}
        onValueChange={modelId => {
          if (pendingModelId || modelId === activeModelId) return;
          setPendingModelId(modelId);
          void setModel(modelId).then(
            () => setPendingModelId(undefined),
            (cause: unknown) => {
              setPendingModelId(undefined);
              toast.error(cause instanceof Error ? cause.message : 'Failed to switch model');
            },
          );
        }}
      >
        <SelectTrigger
          variant="ghost"
          size="xs"
          aria-label={notConfigured ? `Session model, ${label} is not configured` : 'Session model'}
          aria-busy={Boolean(pendingModelId)}
          className={notConfigured ? 'text-accent2 w-auto' : 'text-neutral3 w-auto'}
          title={selectedModelId}
        >
          <span>
            {label}
            {notConfigured ? ' · not configured' : null}
          </span>
        </SelectTrigger>
        <SelectContent>
          {modelsQuery.data.map(model => (
            <SelectItem key={model.id} value={model.id}>
              {model.provider} / {model.modelName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <span
      className={notConfigured ? 'text-accent2' : 'text-neutral3'}
      aria-label={notConfigured ? `${label} is not configured` : undefined}
      title={selectedModelId}
    >
      {label}
      {notConfigured ? ' · not configured' : null}
    </span>
  );
}
