import { Badge } from '@mastra/playground-ui/components/Badge';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { FlaskConical } from 'lucide-react';

export type StoryChoice<Value extends string> = { value: Value; title: string; detail: string };

export function PrototypeBadge() {
  return (
    <Badge size="sm" variant="purple" emphasis="subtle" icon={<FlaskConical aria-hidden />}>
      Prototype
    </Badge>
  );
}

export function StoryChoices<Value extends string>({
  label,
  value,
  choices,
  layout,
  onChange,
}: {
  label: string;
  value: Value;
  choices: readonly StoryChoice<Value>[];
  layout: 'cards' | 'list';
  onChange: (value: Value) => void;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={next => {
        const picked = choices.find(choice => choice.value === next);
        if (picked) onChange(picked.value);
      }}
      className={layout === 'cards' ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}
    >
      {choices.map(choice => (
        <label
          key={choice.value}
          className={cn(
            'flex cursor-pointer items-start gap-3',
            layout === 'cards' && cn(raisedSurfaceStyle, 'rounded-xl p-4'),
            layout === 'cards' && choice.value === value && 'ring-foreground ring-1',
          )}
        >
          <RadioGroupItem value={choice.value} className="mt-0.5" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <Txt as="span" variant="label" tone="ink">
              {choice.title}
            </Txt>
            <Txt as="span" variant="caption" tone="muted">
              {choice.detail}
            </Txt>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
