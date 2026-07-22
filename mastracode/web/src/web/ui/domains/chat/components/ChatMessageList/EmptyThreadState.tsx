import { Button } from '@mastra/playground-ui/components/Button';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { ChevronDown } from 'lucide-react';
import { deriveProjectPath } from '../../../../../../shared/hooks/useWorkspaces';
import { isLocalFactory, selectedRepository, useActiveFactoryContext } from '../../../workspaces';
import { useChatCommands } from '../../context/ChatCommandsProvider';
import { FactoryMetadata } from './FactoryMetadata';

const emptyThreadClass =
  'flex w-full min-w-0 max-w-full flex-1 flex-col items-center justify-center px-6 py-12 text-center';

export function EmptyThreadState() {
  const { activeFactory } = useActiveFactoryContext();
  const { prefillComposer } = useChatCommands();
  if (!activeFactory) return null;
  const workspace = deriveProjectPath(activeFactory);
  const gitBranch = isLocalFactory(activeFactory)
    ? activeFactory.binding.gitBranch
    : selectedRepository(activeFactory)?.gitBranch;

  return (
    <section className={emptyThreadClass} aria-labelledby="empty-thread-title">
      <Logo size="md" aria-label="Mastra Code" />
      <h1 id="empty-thread-title" className="mt-7 text-balance text-header-xl font-medium tracking-tight text-icon6">
        What can I help you build?
      </h1>
      <p className="mt-2 max-w-lg text-pretty text-ui-lg leading-relaxed text-icon3">
        Ask about this codebase, plan a change, or describe something that isn&apos;t working.
      </p>

      <div className="mt-7 flex w-full max-w-2xl flex-wrap justify-center gap-2" aria-label="Suggested prompts">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => prefillComposer('Help me understand how this codebase is structured.')}
        >
          Explore this codebase
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => prefillComposer('Help me plan a new feature.')}
        >
          Plan a feature
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => prefillComposer('Review the recent changes and suggest improvements.')}
        >
          Review recent changes
        </Button>
        <Button type="button" variant="outline" size="md" onClick={() => prefillComposer('Help me debug an issue.')}>
          Debug an issue
        </Button>
      </div>

      <details className="group mt-8 w-full min-w-0 max-w-lg text-ui-sm text-icon3">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-colors hover:text-icon5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent1 [&::-webkit-details-marker]:hidden">
          <span>
            Working in <span className="font-medium text-icon5">{activeFactory.name}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            size={14}
            className="transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <dl className="mx-auto mt-3 grid w-full min-w-0 gap-1 text-left font-mono leading-relaxed">
          <FactoryMetadata label="Factory" value={activeFactory.name} />
          {activeFactory.resourceId && <FactoryMetadata label="Resource ID" value={activeFactory.resourceId} />}
          {gitBranch && <FactoryMetadata label="Branch" value={gitBranch} />}
          {workspace && <FactoryMetadata label="Workspace" value={workspace} />}
        </dl>
      </details>
    </section>
  );
}
