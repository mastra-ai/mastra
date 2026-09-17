import { ChatNotification, ChatSignal, ChatSkill, ChatTimeGap } from '@/ds/components/ai/chat-event';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';

export function ConversationContext() {
  return (
    <div className="flex min-w-0 flex-col">
      <ChatTimeGap text="24 minutes later — Sep 17, 2026, 2:24 PM" />
      <ChatNotification label="board" message="This work was moved from the planning stage to the building stage." />
      <ChatSignal
        kind="state"
        label="State snapshot: workflow-stage"
        message={'Board: work\nStage: building\nRevision: 4\nWork item: Improve the chat composer'}
      />
      <ChatSkill
        name="implementation-review"
        instructions={
          'Implement the approved plan.\n\n- Preserve the existing interactions.\n- Verify keyboard access and attachment previews.\n- Report the result with the relevant checks.'
        }
      />
      <ChatSignal
        kind="reactive"
        label="Work item feed"
        message="Review note: Preserve keyboard access and attachment previews."
      />
      <ChatSignal kind="reminder" label="System reminder" message="Preserve keyboard access and attachment previews." />
    </div>
  );
}

export function ConversationNotification() {
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
