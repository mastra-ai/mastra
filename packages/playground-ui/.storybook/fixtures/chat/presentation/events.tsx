import type { ChatPresentation } from '../data';
import { SignalBadge } from '@/domains/chat/messages/signal-badge';
import { SystemReminderBadge } from '@/domains/chat/messages/system-reminder-badge';
import { ChatNotification, ChatSignal, ChatSkill, ChatTimeGap } from '@/ds/components/ai/chat-event';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';

export function ConversationContext({ presentation }: { presentation: ChatPresentation }) {
  if (presentation === 'studio') {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <SignalBadge
          signal={{
            type: 'state',
            metadata: { state: { id: 'workspace', mode: 'snapshot' } },
            contents: 'Branch: composer-review\nThe workspace is ready for the next step.',
          }}
        />
        <SignalBadge
          signal={{ type: 'reactive', tagName: 'files-changed', contents: 'src/chat/composer.tsx was updated.' }}
        />
        <SystemReminderBadge
          text={
            '<system-reminder type="file" path="AGENTS.md">Preserve keyboard access and attachment previews.</system-reminder>'
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <ChatTimeGap text="24 minutes later — Sep 17, 2026, 2:24 PM" />
      <ChatNotification label="factory" message="This work was moved from the planning stage to the building stage." />
      <ChatSignal
        kind="state"
        label="State snapshot: factory-phase"
        message={'Board: work\nStage: building\nRevision: 4\nWork item: Improve the chat composer'}
      />
      <ChatSkill
        name="factory-build"
        instructions={
          'Implement the approved plan.\n\n- Preserve the existing interactions.\n- Verify keyboard access and attachment previews.\n- Report the result with the relevant checks.'
        }
      />
      <ChatSignal
        kind="reactive"
        label="Work item feed"
        message="Damien: Keep the Factory and Studio behaviors intact while sharing the presentation."
      />
      <ChatSignal kind="reminder" label="System reminder" message="Preserve keyboard access and attachment previews." />
    </div>
  );
}

export function ConversationNotification({ presentation }: { presentation: ChatPresentation }) {
  if (presentation === 'studio') {
    return (
      <SignalBadge
        signal={{
          type: 'notification',
          attributes: { source: 'review', kind: 'success', priority: 'medium', status: 'completed', pending: 0 },
          contents: 'Composer review complete',
        }}
      />
    );
  }

  return (
    <ChatNotification
      state="merged"
      label="github"
      message="The composer changes were merged. The work item is ready for verification."
      icon={<PullRequestIcon status="merged" size={13} aria-hidden />}
      link={{ href: 'https://github.com/mastra-ai/mastra/pull/24263', label: 'Open on GitHub' }}
    />
  );
}
