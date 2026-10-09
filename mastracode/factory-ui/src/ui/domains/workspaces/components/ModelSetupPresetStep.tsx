import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Building2, Users } from 'lucide-react';
import type { ModelSetupPreset } from '../services/modelSetupPreset';

const choices = [
  {
    value: 'company',
    title: 'Company account',
    description: 'One shared account. No setup for teammates.',
    icon: Building2,
  },
  {
    value: 'individual',
    title: 'Everyone brings their own',
    description: 'Each person chooses their account and model.',
    icon: Users,
  },
] as const;

export function ModelSetupPresetStep({
  value,
  onChange,
  onContinue,
}: {
  value: ModelSetupPreset;
  onChange: (preset: ModelSetupPreset) => void;
  onContinue: () => void;
}) {
  return (
    <section aria-label="Model setup preset" className="flex flex-col gap-5">
      <RadioGroup
        aria-label="How your team uses models"
        value={value.kind}
        onValueChange={kind => {
          if (kind === 'company') onChange({ kind, allowPersonal: false });
          if (kind === 'individual') onChange({ kind });
        }}
        className="gap-2"
      >
        {choices.map(({ value: kind, title, description, icon: Icon }) => (
          <label
            key={kind}
            className={cn(
              'hover:bg-fill focus-within:bg-fill flex min-h-20 cursor-pointer items-start gap-3 rounded-lg px-3 py-4 transition-colors',
              value.kind === kind && 'bg-fill',
            )}
          >
            <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <Txt as="span" variant="caption" className="block">
                {title}
              </Txt>
              <Txt as="span" variant="meta" tone="muted" className="mt-1 block">
                {description}
              </Txt>
            </span>
            <RadioGroupItem value={kind} aria-label={title} className="mt-0.5 shrink-0" />
          </label>
        ))}
      </RadioGroup>
      <div className="flex h-12 items-start px-3">
        {value.kind === 'company' ? (
          <label className="flex w-full cursor-pointer items-center justify-between gap-4">
            <Txt variant="caption" tone="muted">
              Allow personal connections
            </Txt>
            <Switch
              aria-label="Allow personal connections"
              checked={value.allowPersonal}
              onCheckedChange={allowPersonal => onChange({ kind: 'company', allowPersonal })}
            />
          </label>
        ) : (
          <Txt variant="meta" tone="muted">
            Automatic work needs a shared account.
          </Txt>
        )}
      </div>
      <div>
        <Button variant="primary" onClick={onContinue}>
          Continue <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
