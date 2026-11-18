import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import {
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerBox,
} from '@mastra/playground-ui/components/Composer';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { ButtonSkeleton } from '../ui/ButtonSkeleton';
import { transcriptTopClass } from '../domains/chat/components/chatPageHeader';
import { emptyThreadClass } from '../domains/chat/components/EmptyThreadState';
import { chatColumnClass, composerColumnClass, reservedSpaceClass } from '../domains/workspace-viewer/layout';
import { cardDraftActionsClass, cardDraftHintClass, cardDraftTitleClass } from './cardDraftLayout';

export function CardDraftSkeleton() {
  return (
    <ChatShell
      role="status"
      aria-label="Loading card"
      className={cn('flex-1 [--chat-gutter:0.25rem]', chatColumnClass)}
    >
      <ChatShell.Stage aria-hidden>
        <ChatShell.Viewport className={reservedSpaceClass.viewport}>
          <div className="relative flex min-h-full min-w-0 flex-1 flex-col">
            <ChatShell.Content className={cn('relative gap-0', transcriptTopClass)}>
              <ChatShell.Transcript className="flex-1">
                <div className={emptyThreadClass}>
                  <Logo size="md" />
                  <div className={cardDraftTitleClass}>
                    <SkeletonText line="text-title" className="w-64 max-w-full motion-reduce:before:animate-none" />
                  </div>
                  <div className={cardDraftHintClass}>
                    <SkeletonText line="text-body-sm" className="w-68 max-w-full motion-reduce:before:animate-none" />
                  </div>
                  <div className={cardDraftActionsClass}>
                    <ButtonSkeleton variant="primary" size="md">
                      Investigate
                    </ButtonSkeleton>
                  </div>
                </div>
              </ChatShell.Transcript>
            </ChatShell.Content>
            <ChatShell.Dock className="pb-[calc(var(--chat-gutter)+env(safe-area-inset-bottom))]">
              <ChatShell.Column className={cn('gap-2', composerColumnClass)}>
                <div className="mx-auto w-full max-w-3xl p-px">
                  <ComposerBox>
                    <div className="text-body zoom-safe-text min-h-11 px-3 pt-2.5 pb-2">
                      <SkeletonText line="text-body" className="w-48 motion-reduce:before:animate-none" />
                    </div>
                    <ComposerActions>
                      <ComposerActionsStart>
                        <Skeleton className="size-control-sm rounded-full motion-reduce:before:animate-none" />
                      </ComposerActionsStart>
                      <ComposerActionsEnd>
                        <Skeleton className="h-control-sm w-28 rounded-full motion-reduce:before:animate-none" />
                        <Skeleton className="size-control-sm rounded-full motion-reduce:before:animate-none" />
                        <Skeleton className="size-control-sm rounded-full motion-reduce:before:animate-none" />
                      </ComposerActionsEnd>
                    </ComposerActions>
                  </ComposerBox>
                </div>
              </ChatShell.Column>
            </ChatShell.Dock>
          </div>
        </ChatShell.Viewport>
      </ChatShell.Stage>
    </ChatShell>
  );
}
