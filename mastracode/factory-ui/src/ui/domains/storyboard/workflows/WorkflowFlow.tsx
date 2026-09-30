import { Badge } from '@mastra/playground-ui/components/Badge';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import { cn } from '@mastra/playground-ui/utils/cn';
import { BookOpen, Bot, Pin, UserCheck, Workflow, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { RAIL_LIST, RailRow } from '../../factory/components/Timeline';
import { possessive, providerOf } from '../cast';
import { StoryWorkflowLink } from '../StoryExplain';
import type { CardFacts, StoryState } from '../storyState';
import { payerOf } from '../storyState';
import type { StorySkill } from '../storySkills';
import { stepSkills } from '../storySkills';
import type { StepPayer, StoryWorkflow, WorkflowStep, WorkflowStepKind } from './storyWorkflows';
import { WORKFLOW_SOURCE_LABELS, workflowRun } from './storyWorkflows';

export const STEP_ICONS: Record<WorkflowStepKind, LucideIcon> = { agent: Bot, tool: Wrench, approval: UserCheck };

type PayerFor = (step: WorkflowStep) => StepPayer;

type StepMarkProps = { icon: LucideIcon; current?: boolean; dashed?: boolean };

function payerLabel(payer: StepPayer): string {
  if (payer === 'card-owner') return 'Card owner’s plan';
  if (payer === 'factory') return 'Factory account';
  return `${possessive(payer)} plan`;
}

function StepDetail({ step, payer, skills }: { step: WorkflowStep; payer: StepPayer; skills: StorySkill[] }) {
  if (step.kind === 'approval')
    return (
      <Badge size="xs" variant="warning" emphasis="subtle">
        Waits for a person
      </Badge>
    );
  if (step.kind === 'tool')
    return (
      <Txt as="span" variant="meta" tone="faint">
        No model
      </Txt>
    );
  const model = step.model ?? 'Lane model';
  const provider = step.provider ?? providerOf(model);
  return (
    <>
      <Txt as="span" variant="meta" tone="muted" className="flex min-w-0 flex-wrap items-center gap-1">
        {provider && <ProviderLogo providerId={provider} size={12} />}
        <span className="text-foreground">{model}</span>
        {step.pinned && <Pin size={11} className="shrink-0" aria-label="Pinned model" />}
        <span>· {payerLabel(payer)}</span>
      </Txt>
      {skills.length > 0 && (
        <Txt as="span" variant="meta" tone="faint" className="flex min-w-0 items-center gap-1">
          <BookOpen size={11} className="shrink-0" aria-label="Skills" />
          <span className="truncate">
            {skills.map(skill => skill.name).join(', ')}
            {!step.skills && ' · from the lane'}
          </span>
        </Txt>
      )}
    </>
  );
}

export function StepMark({ icon: Icon, current = false, dashed = false }: StepMarkProps) {
  return (
    <span
      className={cn(
        'grid size-7 place-items-center rounded-full border',
        dashed && 'border-dashed',
        current
          ? 'bg-foreground text-background border-transparent'
          : 'border-border bg-fill-subtle text-muted-foreground',
      )}
    >
      <Icon size={13} aria-hidden />
    </span>
  );
}

export function RailText({ title, children, current }: { title: string; children: ReactNode; current?: boolean }) {
  return (
    <span aria-current={current ? 'step' : undefined} className="flex min-h-7 flex-col justify-center gap-0.5">
      <Txt as="span" variant="label" tone="ink">
        {title}
      </Txt>
      {children}
    </span>
  );
}

export function TriggerRow({ trigger, connected }: { trigger: string; connected: boolean }) {
  return (
    <RailRow connected={connected} mark={<StepMark icon={Zap} />}>
      <RailText title={trigger}>
        <Txt as="span" variant="meta" tone="faint">
          Trigger
        </Txt>
      </RailText>
    </RailRow>
  );
}

export function WorkflowSteps({
  trigger,
  steps,
  payerFor,
  laneId,
  currentIndex,
}: {
  trigger?: string;
  steps: WorkflowStep[];
  payerFor: PayerFor;
  laneId?: string;
  currentIndex?: number;
}) {
  return (
    <ol className={RAIL_LIST}>
      {trigger && <TriggerRow trigger={trigger} connected={steps.length > 0} />}
      {steps.map((step, index) => (
        <RailRow
          key={`${index}-${step.title}`}
          connected={index < steps.length - 1}
          mark={<StepMark icon={STEP_ICONS[step.kind]} current={index === currentIndex} />}
        >
          <RailText title={step.title} current={index === currentIndex}>
            <StepDetail step={step} payer={payerFor(step)} skills={stepSkills(step, laneId)} />
          </RailText>
        </RailRow>
      ))}
    </ol>
  );
}

export function WorkflowFlow({ workflow, payerFor }: { workflow: StoryWorkflow; payerFor: PayerFor }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <Txt as="p" variant="label" tone="ink" className="flex items-center gap-1.5">
          <Workflow size={12} className="text-muted-foreground" aria-hidden />
          {workflow.title}
        </Txt>
        <Txt as="span" variant="meta" tone="faint">
          {WORKFLOW_SOURCE_LABELS[workflow.source]}
        </Txt>
      </div>
      <WorkflowSteps trigger={workflow.trigger} steps={workflow.steps} payerFor={payerFor} laneId={workflow.lanes[0]} />
    </div>
  );
}

export function cardStepPayer(state: StoryState, facts: CardFacts, stage: string): PayerFor {
  const unpinnedPayer = payerOf(state, { ...facts, pinned: undefined, workflow: undefined }, stage);
  return step => (step.pinned ? 'factory' : unpinnedPayer);
}

export function WorkflowRow({ state, facts, stage }: { state: StoryState; facts: CardFacts; stage: string }) {
  const run = workflowRun(state, facts);
  if (!run) return null;
  const { workflow, stepIndex } = run;
  const position = `step ${stepIndex + 1}/${workflow.steps.length}`;

  return (
    <>
      <Txt as="span" variant="meta" tone="faint">
        Workflow
      </Txt>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`Workflow ${workflow.title}, ${position}`}
              className="text-muted-foreground hover:text-foreground relative z-10 flex min-w-0 items-center gap-1 text-left"
            >
              <Txt as="span" variant="meta" className="truncate">
                <span className="text-foreground">{workflow.title}</span> · {position}
              </Txt>
            </button>
          }
        />
        <PopoverContent align="start" className="flex w-80 flex-col gap-2 p-3">
          <Txt as="p" variant="label" tone="ink">
            {workflow.title}
          </Txt>
          <WorkflowSteps
            steps={workflow.steps}
            payerFor={cardStepPayer(state, facts, stage)}
            laneId={stage}
            currentIndex={stepIndex}
          />
          <StoryWorkflowLink workflowId={workflow.id}>Open in Rules & workflows</StoryWorkflowLink>
        </PopoverContent>
      </Popover>
    </>
  );
}
