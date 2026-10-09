import { Button } from '@mastra/playground-ui/components/Button';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useParams } from 'react-router';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { Txt } from '@mastra/playground-ui/components/Txt';

const emptyThreadClass =
  'flex w-full min-w-0 max-w-full flex-1 flex-col items-center justify-center px-6 py-12 text-center';

function FactoryMetadata({ label, value, font = 'mono' }: { label: string; value: string; font?: 'body' | 'mono' }) {
  return (
    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>{label}</dt>
      <dd className={cn(textStyle({ variant: 'caption', tone: 'ink', font }), 'min-w-0 truncate')}>{value}</dd>
    </div>
  );
}

export function EmptyThreadState() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { data: activeFactory } = useFactoryQuery(factoryId);
  const { projectPath, resourceId, factorySessionState } = useChatSessionContext();
  const { prefillComposer } = useChatCommands();
  if (!activeFactory) return null;

  const repository = activeFactory.repositories.find(
    repo => repo.projectRepositoryId === factorySessionState?.projectRepositoryId,
  );
  const gitBranch = repository?.gitBranch;

  return (
    <section className={emptyThreadClass} aria-labelledby="empty-thread-title">
      <Logo size="md" aria-label="Mastra Code" />
      <Txt as="h1" variant="display" tone="ink" id="empty-thread-title" className="mt-7 text-balance">
        What can I help you build?
      </Txt>
      <Txt variant="body-sm" tone="muted" className="mt-2 max-w-lg text-pretty">
        Ask about this codebase, plan a change, or describe something that isn&apos;t working.
      </Txt>

      <div className="mt-7 flex w-full max-w-2xl flex-wrap justify-center gap-2" aria-label="Suggested prompts">
        <Button
          type="button"
          size="md"
          onClick={() => prefillComposer('Help me understand how this codebase is structured.')}
        >
          Explore this codebase
        </Button>
        <Button type="button" size="md" onClick={() => prefillComposer('Help me plan a new feature.')}>
          Plan a feature
        </Button>
        <Button
          type="button"
          size="md"
          onClick={() => prefillComposer('Review the recent changes and suggest improvements.')}
        >
          Review recent changes
        </Button>
        <Button type="button" size="md" onClick={() => prefillComposer('Help me debug an issue.')}>
          Debug an issue
        </Button>
      </div>

      <details className="text-muted-foreground group mt-8 w-full max-w-lg min-w-0">
        <summary
          className={`hover:text-foreground flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-colors [&::-webkit-details-marker]:hidden ${focusRing}`}
        >
          <Txt as="span" variant="caption">
            Working in{' '}
            <Txt as="span" variant="column" tone="ink">
              {activeFactory.name}
            </Txt>
          </Txt>
          <DisclosureChevron className="size-3.5 group-open:rotate-180" />
        </summary>
        <dl className="mx-auto mt-3 grid w-full min-w-0 gap-1 text-left">
          <FactoryMetadata label="Factory" value={activeFactory.name} font="body" />
          {resourceId && <FactoryMetadata label="Resource ID" value={resourceId} />}
          {gitBranch && <FactoryMetadata label="Branch" value={gitBranch} />}
          {projectPath && <FactoryMetadata label="Workspace" value={projectPath} />}
        </dl>
      </details>
    </section>
  );
}
