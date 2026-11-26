import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { IconChatBubble7Off } from '@mastra/playground-ui/icons/central/IconChatBubble7Off';
import { useNavigate } from 'react-router';

import { newUserSessionPath } from '../../workspaces/services/factoryPaths';
import { ChatPageLayout } from './ChatPageLayout';

export function SessionNotFound({ factoryId }: { factoryId: string | undefined }) {
  const navigate = useNavigate();
  return (
    <ChatPageLayout>
      <div className="grid min-h-0 place-items-center">
        <EmptyState
          as="h1"
          iconSlot={<IconChatBubble7Off />}
          titleSlot="Session not found"
          descriptionSlot="This session does not exist, or it is private to another user."
          actionSlot={
            factoryId && (
              <Button variant="primary" onClick={() => void navigate(newUserSessionPath(factoryId))}>
                Start a new session
              </Button>
            )
          }
        />
      </div>
    </ChatPageLayout>
  );
}
