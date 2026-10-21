import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useContext } from 'react';

import { ChatSessionContext } from '../context/ChatSessionContext';
import { ChatThreadMessagesContext } from '../context/ChatThreadMessagesContext';
import { ChatTranscriptContext } from '../context/ChatTranscriptContext';
import { describeRunError } from '../services/run-error';
import { ProviderLoginAction } from './ProviderLoginAction';
import { RunErrorContinueButton } from './RunErrorContinueButton';
import { ModelPicker } from './StatusLine/ModelPicker';

export function RunErrorNotice({ error, entryId }: { error: MastraErrorPart['error']; entryId: string }) {
  const session = useContext(ChatSessionContext);
  const transcript = useContext(ChatTranscriptContext);
  const displayedThread = useContext(ChatThreadMessagesContext);
  const { title, message, recovery } = describeRunError(error);
  const diagnostics = JSON.stringify(
    {
      ...error,
      entryId,
      resourceId: session?.resourceId,
      threadId: displayedThread?.threadId ?? session?.sessionThreadId,
    },
    undefined,
    2,
  );
  const isLatestEntry = transcript?.transcript.entries.at(-1)?.id === entryId;
  const recoveryActions = {
    credentials: <ProviderLoginAction label="Review credentials" />,
    models: <ModelPicker triggerLabel="Change model" showThinking={false} />,
    continue: session?.sessionEnabled ? <RunErrorContinueButton /> : undefined,
  };
  return (
    <Notice
      variant="destructive"
      title={title}
      action={isLatestEntry && recovery ? recoveryActions[recovery] : undefined}
    >
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
