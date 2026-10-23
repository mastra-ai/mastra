import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useLLMProviders } from '@mastra/react/hooks/llm';
import { Lock, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { RefObject } from 'react';
import { useBuilderModelPolicy } from '@/domains/agent-builder';
import { LLMModels, LLMProviders } from '@/domains/llm';

export interface AgentModelFieldProps {
  provider: string;
  modelId: string;
  canReset: boolean;
  onProviderChange: (provider: string) => void;
  onModelIdChange: (modelId: string) => void;
  onReset: () => void;
  container: RefObject<HTMLElement | null>;
}

/**
 * The model the agent runs on, starting from its own. Another pick applies to this experiment only, using the
 * same provider/model picker as the composer.
 */
export function AgentModelField({
  provider,
  modelId,
  canReset,
  onProviderChange,
  onModelIdChange,
  onReset,
  container,
}: AgentModelFieldProps) {
  const policy = useBuilderModelPolicy();
  const { isLoading: providersLoading } = useLLMProviders();
  const [modelOpen, setModelOpen] = useState(false);

  if (policy.active && policy.pickerVisible === false) {
    return (
      <Fieldset className="gap-2">
        <FieldsetLegend>Model</FieldsetLegend>
        <div>
          <Badge icon={<Lock />}>Locked by admin</Badge>
        </div>
      </Fieldset>
    );
  }

  // Picking a provider, even the current one, opens the model list straight away.
  const handleProviderChange = (nextProvider: string) => {
    onProviderChange(nextProvider);
    setModelOpen(true);
  };

  return (
    <Fieldset className="gap-2">
      <FieldsetLegend>Model</FieldsetLegend>
      {providersLoading ? (
        // Reserve the picker's footprint; the pickers' own skeletons stretch to a width they don't have here.
        <Skeleton className="h-control-md w-60 rounded-full" />
      ) : (
        <div className="flex items-center gap-1">
          <ButtonsGroup className="min-w-0">
            <LLMProviders
              value={provider}
              onValueChange={handleProviderChange}
              container={container}
              aria-label="Model provider"
              className="w-auto min-w-0 shrink-0 gap-1 px-3"
            />
            <LLMModels
              llmId={provider}
              value={modelId}
              onValueChange={onModelIdChange}
              open={modelOpen}
              onOpenChange={setModelOpen}
              container={container}
              disabled={!provider}
              aria-label="Model"
              className="w-auto min-w-0 gap-1 px-3"
            />
          </ButtonsGroup>
          {canReset && (
            <Button variant="ghost" size="icon-md" tooltip="Use the agent's model" onClick={onReset}>
              <RotateCcw />
            </Button>
          )}
        </div>
      )}
    </Fieldset>
  );
}
