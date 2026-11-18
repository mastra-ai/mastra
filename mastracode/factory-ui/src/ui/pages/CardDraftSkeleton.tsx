import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { ComposerPanelLoading } from '../domains/chat/components/ComposerPanel';
import { ChatSurfaceLayout } from '../domains/chat/components/SessionChatSurface';
import { CardDraftIntro } from './CardDraftIntro';

export function CardDraftSkeleton() {
  return (
    <ChatSurfaceLayout
      role="status"
      aria-label="Loading card"
      busy
      transcript={
        <CardDraftIntro
          title={
            <div aria-hidden>
              <SkeletonText line="text-title" className="w-64 max-w-full motion-reduce:before:animate-none" />
            </div>
          }
          actions={
            <Skeleton aria-hidden className="h-control-md w-28 rounded-full motion-reduce:before:animate-none" />
          }
        />
      }
      dock={<ComposerPanelLoading />}
    />
  );
}
