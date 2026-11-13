import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { Check, CircleDashed, Code2 } from 'lucide-react';
import { isCodeHostSource, useWorkSourceConnections, WORK_SOURCE_NAME } from '../../../hooks/useWorkSourceConnections';
import type { BoardSource } from '../../../hooks/useWorkSourceConnections';
import type { SourceControlRepository } from '../../../services/github';
import { repositoryHost } from '../../../services/sourceControlHosts';
import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import { SketchLabel } from './SketchLabel';

const SOURCES: Record<
  BoardSource,
  { Icon: typeof LinearIcon; example: string; id: string; previousId: string; previousExample: string; kind: string }
> = {
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
  github: {
    Icon: GithubIcon,
    example: 'Add team invitations',
    id: '#412',
    previousId: '#411',
    previousExample: 'Improve review notes',
    kind: 'Issue',
  },
  gitlab: {
    Icon: GitLabIcon,
    example: 'Add pipeline retries',
    id: '#87',
    previousId: '#86',
    previousExample: 'Split the deploy job',
    kind: 'Issue',
  },
};

export function OnboardingIntakePreview({
  source,
  repository,
}: {
  source: BoardSource;
  /** The codebase step's pick, which reads as Connected on its own host. */
  repository?: SourceControlRepository;
}) {
  const status = useWorkSourceConnections();
  const name = WORK_SOURCE_NAME[source];
  // A code host is not connected like a tracker; the repository picked in step one is what feeds it.
  const connected = isCodeHostSource(source)
    ? repository !== undefined && repositoryHost(repository) === source
    : status[source];
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
        <div className="text-right">
          <Txt variant="meta" tone="muted">
            {connected ? 'Connected' : 'Example'}
          </Txt>
        </div>
      </SketchLabel>
      <SketchLabel x={38} y={58} width={128}>
        <Txt variant="meta" tone="muted">
          <Metadata>
            <Metadata.Item>{id}</Metadata.Item>
            <Metadata.Item>{kind}</Metadata.Item>
          </Metadata>
        </Txt>
        <Txt variant="caption" tone="muted" className="mt-2">
          {example}
        </Txt>
      </SketchLabel>
      <SketchLabel x={115} y={133} width={98}>
        <Txt variant="meta" tone="muted">
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
            <Txt variant="meta" tone="muted">
              {card.id}
            </Txt>
          </div>
          <Txt variant="caption" tone="muted" className="mt-1.5">
            {card.title}
          </Txt>
        </div>
      ))}
      <SketchLabel x={28} y={302} width={344}>
        <Txt variant="meta" tone="muted">
          Choose what to bring in after setup.
        </Txt>
      </SketchLabel>
    </section>
  );
}
