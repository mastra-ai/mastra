import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { describeRunError } from '@mastra/factory/run-error';
import type { RunErrorRecovery } from '@mastra/factory/run-error';
import { useContext } from 'react';

import { ChatSessionContext } from '../context/ChatSessionContext';
import { ChatThreadMessagesContext } from '../context/ChatThreadMessagesContext';
import { ProviderReconnectAction } from './ProviderReconnectAction';
import { ModelPicker } from './StatusLine/ModelPicker';

export function RunErrorNotice({ error, entryId }: { error: MastraErrorPart['error']; entryId: string }) {
  const session = useContext(ChatSessionContext);
  const displayedThread = useContext(ChatThreadMessagesContext);
  const { title, message, recovery } = describeRunError(error);
  const diagnostics = JSON.stringify(
    {
      ...error,
      entryId,
      sessionId: session?.sessionId,
      resourceId: session?.resourceId,
      threadId: displayedThread?.threadId ?? session?.sessionThreadId,
    },
    undefined,
    2,
  );
  return (
    <Notice variant="destructive" title={title} action={recovery && <RecoveryAction recovery={recovery} />}>
      <Notice.Message>{message}</Notice.Message>
      <Collapsible>
        <CollapsibleTrigger render={<Notice.Button>Error details</Notice.Button>} />
        <CollapsibleContent>
          <CodeBlock code={diagnostics} lang="json" copyTooltip="Copy error details" />
        </CollapsibleContent>
      </Collapsible>
    </Notice>
  );
}

function RecoveryAction({ recovery }: { recovery: RunErrorRecovery }) {
  return recovery === 'credentials' ? (
    <ProviderReconnectAction label="Review credentials" />
  ) : (
    <ModelPicker triggerLabel="Change model" />
  );
}
