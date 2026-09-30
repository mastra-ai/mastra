import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { KeyRound, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Storyboard } from './StoryboardProvider';
import { allowOwnPlans, COMPANY_KEYS_ONLY, ownPlansAllowed } from './storyState';

type PayPolicy = 'company' | 'mixed';

const POLICIES: { value: PayPolicy; icon: LucideIcon; title: string; detail: string }[] = [
  {
    value: 'company',
    icon: KeyRound,
    title: 'One account runs everything',
    detail: 'Members connect nothing.',
  },
  {
    value: 'mixed',
    icon: Users,
    title: 'Members can bring their own plan',
    detail: 'Their subscription or key can pay for their work.',
  },
];

function isPayPolicy(value: unknown): value is PayPolicy {
  return value === 'company' || value === 'mixed';
}

export function StoryPayPolicy({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const value: PayPolicy = ownPlansAllowed(state) ? 'mixed' : 'company';
  return (
    <section aria-label="What can pay for work" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <Txt as="h3" variant="label" tone="ink">
          What can pay for work
        </Txt>
      </div>
      <RadioGroup
        aria-label="What can pay for work"
        value={value}
        onValueChange={next => {
          if (!isPayPolicy(next)) return;
          patch(next === 'company' ? COMPANY_KEYS_ONLY : allowOwnPlans(state));
        }}
        className="grid gap-2 sm:grid-cols-2"
      >
        {POLICIES.map(({ value: policy, icon: Icon, title, detail }) => (
          <label
            key={policy}
            className={cn(
              raisedSurfaceStyle,
              'flex cursor-pointer items-start gap-3 rounded-xl p-3',
              policy === value && 'ring-foreground ring-1',
            )}
          >
            <span className="bg-fill grid size-8 shrink-0 place-items-center rounded-lg">
              <Icon size={16} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Txt as="span" variant="label" tone="ink">
                {title}
              </Txt>
              <Txt as="span" variant="caption" tone="muted">
                {detail}
              </Txt>
            </span>
            <RadioGroupItem value={policy} />
          </label>
        ))}
      </RadioGroup>
    </section>
  );
}
