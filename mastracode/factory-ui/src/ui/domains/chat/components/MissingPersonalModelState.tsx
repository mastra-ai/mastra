import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState, EmptyStateIllustration } from '@mastra/playground-ui/components/EmptyState';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { traySurface } from '../../../ui/tray';
import { PersonalModelForm } from '../../join/components/PersonalModelForm';
import { settingsSectionPath } from '../../settings/settingsSections';
import type { ModelDefaultsAnchor } from '../../settings/settingsSections';

/**
 * A chat that runs on the member's own account, and they have no model there: the same connect step as member
 * setup, right where they wanted to start. Connecting a provider usually unblocks the composer by itself (the
 * server then has a personal fallback model); when it doesn't, saving the picked model as the default does.
 */
export function MissingPersonalModelState({ factoryId, anchor }: { factoryId: string; anchor: ModelDefaultsAnchor }) {
  const project = useFactoryProjectQuery(factoryId);
  const modelScope = project.data?.modelScope ?? 'user';
  return (
    <div className="flex flex-col items-center gap-5">
      <EmptyState
        as="h2"
        className="py-0"
        iconSlot={<EmptyStateIllustration name="api-keys" />}
        titleSlot="Connect your model to start chatting"
        descriptionSlot={
          modelScope === 'hybrid'
            ? 'Board work here runs on the company account. Your own chats run on yours: connect it once and every session, here or in Slack, is ready.'
            : 'Chats in this Factory run on your own account. Connect it once and every session, here or in Slack, is ready.'
        }
      />
      <div className={cn(traySurface, 'w-full max-w-lg p-1.5 text-start')}>
        <PersonalModelForm modelScope={modelScope} submitLabel="Start chatting" />
      </div>
      <Link
        to={settingsSectionPath(factoryId, 'models', anchor)}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        More options in Models settings
      </Link>
    </div>
  );
}
