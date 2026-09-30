import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { Plan } from './cast';
import type { MemberLine, RouteTarget } from './modelRouting';
import { memberLine } from './modelRouting';
import { PERSONA_IDS } from './cast';
import type { StoryState } from './storyState';

const CHIP = 'inline-flex h-7 max-w-full min-w-0 items-center gap-1.5';

export function PlanChip({ plan, missing }: { plan: Plan | null; missing: string }) {
  if (!plan)
    return (
      <span className={CHIP}>
        <Txt as="span" variant="meta" tone="muted" className="truncate">
          {missing}
        </Txt>
      </span>
    );
  const disconnected = plan.disconnected === true;
  return (
    <span className={CHIP}>
      <ProviderLogo providerId={plan.provider} size={14} />
      <Txt
        as="span"
        variant="meta"
        tone={disconnected ? undefined : 'ink'}
        className={cn('truncate', disconnected && 'text-destructive-indicator')}
      >
        {plan.label}
      </Txt>
    </span>
  );
}

export function MemberStack({ members }: { members: MemberLine[] }) {
  return (
    <span className="flex items-center">
      {members.map((member, index) => (
        <span
          key={member.persona}
          className={cn('relative', index > 0 && '-ml-1')}
          title={`${member.name} · ${member.detail}`}
        >
          <Avatar name={member.name} size="sm" />
          {!member.ok && (
            <span
              aria-hidden
              className="bg-destructive-indicator ring-card absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
            />
          )}
        </span>
      ))}
    </span>
  );
}

export function MembersChip({ state, label }: { state: StoryState; label: string }) {
  return (
    <span className={CHIP}>
      <MemberStack members={PERSONA_IDS.map(persona => memberLine(state, persona))} />
      <Txt as="span" variant="meta" tone="ink" className="truncate">
        {label}
      </Txt>
    </span>
  );
}

const PAYER_WHY: Record<RouteTarget, string> = {
  factory: 'Billed to the Factory account. Decided in Factory settings.',
  mine: 'Billed to your own plan.',
  members: 'Whoever starts it pays on their own plan.',
};

export function ExplainedPayee({
  state,
  target,
  why,
}: {
  state: StoryState;
  target: RouteTarget | null;
  why?: string;
}) {
  if (target === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} className="inline-flex min-w-0 cursor-help rounded-md outline-none" />}
      >
        <PayeeChip state={state} target={target} />
      </TooltipTrigger>
      <TooltipContent>{why ?? PAYER_WHY[target]}</TooltipContent>
    </Tooltip>
  );
}

export function PayeeChip({ state, target }: { state: StoryState; target: RouteTarget | null }) {
  if (target === 'factory') return <PlanChip plan={state.sharedAccount} missing="No Factory account" />;
  if (target === 'mine') return <PlanChip plan={state.memberPlans[state.viewer]} missing="No plan" />;
  if (target === 'members') return <MembersChip state={state} label="Each person's plan" />;
  return null;
}
