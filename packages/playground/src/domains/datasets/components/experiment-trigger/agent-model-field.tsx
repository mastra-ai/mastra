import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Lock } from 'lucide-react';
import { useId, useState } from 'react';
import type { RefObject } from 'react';
import { useBuilderModelPolicy } from '@/domains/agent-builder';
import { LLMModels, LLMProviders } from '@/domains/llm';

export interface AgentModelFieldProps {
  provider: string;
  modelId: string;
  onProviderChange: (provider: string) => void;
  onModelIdChange: (modelId: string) => void;
  onReset: () => void;
  container: RefObject<HTMLElement | null>;
}

/** Runs the agent on another model for this experiment only, using the same provider/model picker as the composer. */
export function AgentModelField({
  provider,
  modelId,
  onProviderChange,
  onModelIdChange,
  onReset,
  container,
}: AgentModelFieldProps) {
  const policy = useBuilderModelPolicy();
  const [modelOpen, setModelOpen] = useState(false);
  const hintId = useId();

  if (policy.active && policy.pickerVisible === false) {
    return (
      <Fieldset>
        <FieldsetLegend>Model</FieldsetLegend>
        <div>
          <Badge icon={<Lock />}>Locked by admin</Badge>
        </div>
      </Fieldset>
    );
  }

  const handleProviderChange = (nextProvider: string) => {
    if (nextProvider === provider) return;
    onProviderChange(nextProvider);
    setModelOpen(true);
  };

  return (
    <Fieldset aria-describedby={hintId}>
      <FieldsetLegend>Model</FieldsetLegend>
      <div className="flex items-center gap-2">
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
        {provider && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Use the agent&apos;s model
          </Button>
        )}
      </div>
      <Txt id={hintId} variant="caption" tone="muted">
        Leave empty to run the agent on its own model.
      </Txt>
    </Fieldset>
  );
}
