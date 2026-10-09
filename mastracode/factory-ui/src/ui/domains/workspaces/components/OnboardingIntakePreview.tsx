import { Txt } from '@mastra/playground-ui/components/Txt';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { Check, CircleDashed, Code2 } from 'lucide-react';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { IncidentIoIcon, JiraIcon } from '../../../ui/icons';
import type { OnboardingSource } from './OnboardingPreview';
import { OnboardingAnnotation } from './OnboardingAnnotation';

const SOURCES = {
  linear: { name: 'Linear', Icon: LinearIcon, example: 'Add repository search', id: 'ENG-124', kind: 'Issue' },
  jira: { name: 'Jira', Icon: JiraIcon, example: 'Improve sign-in errors', id: 'APP-124', kind: 'Issue' },
  'incident-io': {
    name: 'incident.io',
    Icon: IncidentIoIcon,
    example: 'Add a health check',
    id: 'INC-124',
    kind: 'Follow-up',
  },
};

/** The same item appears at the source and on the board: connection enables later import. */
export function OnboardingIntakePreview({ source }: { source: OnboardingSource }) {
  const linear = useLinearStatusQuery();
  const jira = usePlatformConnectionsQuery('jira');
  const incident = usePlatformConnectionsQuery('incident-io');
  const status = {
    linear: linear.data?.connected === true,
    jira: jira.data?.some(item => item.status === 'active') === true,
    'incident-io': incident.data?.some(item => item.status === 'active') === true,
  };
  const { name, Icon, example, id, kind } = SOURCES[source];
  return (
    <section aria-label="Work intake preview" className="relative h-full">
      <OnboardingAnnotation x={28} y={24} width={148}>
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0" />
          <Txt variant="meta">{name}</Txt>
        </div>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={282} y={24} width={90}>
        <div className="text-right">
          <Txt variant="meta" tone="muted">
            {status[source] ? 'Connected' : 'Example'}
          </Txt>
        </div>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={38} y={58} width={128}>
        <Txt variant="meta" tone="muted">
          {id} · {kind}
        </Txt>
        <Txt variant="caption" className="mt-2">
          {example}
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={115} y={133} width={98}>
        <Txt variant="meta" tone="muted">
          Bring into your board
        </Txt>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={28} y={162} width={104}>
        <div className="flex items-center gap-1.5">
          <CircleDashed className="text-muted-foreground size-3" />
          <Txt variant="meta" tone="muted">
            To do
          </Txt>
        </div>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={148} y={162} width={104}>
        <div className="flex items-center gap-1.5">
          <Code2 className="text-muted-foreground size-3" />
          <Txt variant="meta" tone="muted">
            Build
          </Txt>
        </div>
      </OnboardingAnnotation>
      <OnboardingAnnotation x={268} y={162} width={104}>
        <div className="flex items-center gap-1.5">
          <Check className="text-muted-foreground size-3" />
          <Txt variant="meta" tone="muted">
            Review
          </Txt>
        </div>
      </OnboardingAnnotation>
      <div className="onboarding-intake-card absolute min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="text-muted-foreground size-3 shrink-0" />
          <Txt variant="meta" tone="muted">
            {id}
          </Txt>
        </div>
        <Txt variant="caption" className="mt-2">
          {example}
        </Txt>
      </div>
      <OnboardingAnnotation x={28} y={302} width={344}>
        <Txt variant="meta" tone="muted">
          Choose what to bring in after setup.
        </Txt>
      </OnboardingAnnotation>
    </section>
  );
}
