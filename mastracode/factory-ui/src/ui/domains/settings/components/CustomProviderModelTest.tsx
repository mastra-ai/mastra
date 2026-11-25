import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconSend } from '@mastra/playground-ui/icons/central/IconSend';
import { useId } from 'react';

/** Picks one of the chosen models and sends it a short test message. The result renders below, from the parent. */
export function CustomProviderModelTest({
  models,
  model,
  onModelChange,
  onSend,
  sending,
  disabled,
}: {
  /** The models chosen in the form. The test only offers those. */
  models: string[];
  model: string;
  onModelChange: (model: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Another action of the form is running. */
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <Txt as="span" id={labelId} variant="label" tone="ink">
        Test a model
      </Txt>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger aria-labelledby={labelId} className="min-w-0 flex-1 basis-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map(id => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button icon={<IconSend />} loading={sending} disabled={disabled && !sending} onClick={onSend}>
          Send test message
        </Button>
      </div>
    </div>
  );
}
