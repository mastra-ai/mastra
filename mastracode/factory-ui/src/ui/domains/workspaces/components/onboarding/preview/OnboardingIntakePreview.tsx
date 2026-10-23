import { Txt } from '@mastra/playground-ui/components/Txt';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { Check, CircleDashed, Code2 } from 'lucide-react';
import { useWorkSourceConnections, WORK_SOURCE_NAME } from '../../../hooks/useWorkSourceConnections';
import type { WorkSource } from '../../../hooks/useWorkSourceConnections';
import { IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import { SketchLabel } from './SketchLabel';

const SOURCES = {
  linear: {
    Icon: LinearIcon,
    example: 'Add repository search',
    id: 'ENG-124',
    previousId: 'ENG-123',
    previousExample: 'Fix keyboard focus',
    kind: 'Issue',
  },
  jira: {
    Icon: JiraIcon,
    example: 'Improve sign-in errors',
    id: 'APP-124',
    previousId: 'APP-123',
    previousExample: 'Keep sessions alive',
    kind: 'Issue',
  },
  'incident-io': {
    Icon: IncidentIoIcon,
    example: 'Add a health check',
    id: 'INC-124',
    previousId: 'INC-123',
    previousExample: 'Retry failed requests',
    kind: 'Follow-up',
  },
};

export function OnboardingIntakePreview({ source }: { source: WorkSource }) {
  const status = useWorkSourceConnections();
  const name = WORK_SOURCE_NAME[source];
  const { Icon, example, id, previousId, previousExample, kind } = SOURCES[source];
  return (
    <section aria-label="Work intake preview" className="relative h-full">
      <SketchLabel x={28} y={24} width={148}>
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0" />
          <Txt variant="meta">{name}</Txt>
        </div>
      </SketchLabel>
      <SketchLabel x={282} y={24} width={90}>
        <div className="onboarding-intake-detail text-right">
          <Txt variant="meta" tone="muted">
            {status[source] ? 'Connected' : 'Example'}
          </Txt>
        </div>
      </SketchLabel>
      <SketchLabel x={38} y={58} width={128}>
        <Txt variant="meta" tone="muted" className="onboarding-intake-detail">
          {id} · {kind}
        </Txt>
        <Txt variant="meta" tone="muted" className="min-[900px]:hidden">
          {kind}
        </Txt>
        <Txt variant="caption" tone="muted" className="onboarding-intake-detail mt-2">
          {example}
        </Txt>
        <svg aria-hidden="true" viewBox="0 0 128 12" className="onboarding-sketch mt-1 h-2 w-full min-[900px]:hidden">
          <path d="M0 2H112M0 10H80" />
        </svg>
      </SketchLabel>
      <SketchLabel x={115} y={133} width={98}>
        <Txt variant="meta" tone="muted" className="onboarding-intake-detail">
          Bring into your board
        </Txt>
      </SketchLabel>
      <SketchLabel x={28} y={162} width={104}>
        <div className="flex items-center gap-1.5">
          <CircleDashed className="text-muted-foreground size-3" />
          <Txt variant="meta" tone="muted">
            To do
          </Txt>
        </div>
      </SketchLabel>
      <SketchLabel x={148} y={162} width={104}>
        <div className="flex items-center gap-1.5">
          <Code2 className="text-muted-foreground size-3" />
          <Txt variant="meta" tone="muted">
            Build
          </Txt>
        </div>
      </SketchLabel>
      <SketchLabel x={268} y={162} width={104}>
        <div className="flex items-center gap-1.5">
          <Check className="text-muted-foreground size-3" />
          <Txt variant="meta" tone="muted">
            Review
          </Txt>
        </div>
      </SketchLabel>
      {[
        { id, title: example },
        { id: previousId, title: previousExample },
      ].map((card, index) => (
        <div key={index} className="onboarding-ticket absolute min-w-0" data-ticket={index + 1}>
          <div className="flex items-center gap-1.5">
            <Icon className="text-muted-foreground size-3 shrink-0" />
            <Txt variant="meta" tone="muted" className="onboarding-intake-detail">
              {card.id}
            </Txt>
            <svg
              aria-hidden="true"
              viewBox="0 0 56 12"
              className="onboarding-sketch h-3 min-w-0 flex-1 min-[900px]:hidden"
            >
              <path d="M0 2H48M0 10H32" />
            </svg>
          </div>
          <Txt variant="caption" tone="muted" className="onboarding-ticket-title mt-1.5">
            {card.title}
          </Txt>
        </div>
      ))}
      <SketchLabel x={28} y={302} width={344}>
        <Txt variant="meta" tone="muted" className="onboarding-intake-detail">
          Choose what to bring in after setup.
        </Txt>
        <Txt variant="meta" tone="muted" className="min-[900px]:hidden">
          Example workflow
        </Txt>
      </SketchLabel>
    </section>
  );
}
