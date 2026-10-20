import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useContext } from 'react';

import { ChatSessionContext } from '../context/ChatSessionContext';
import { ChatThreadMessagesContext } from '../context/ChatThreadMessagesContext';
import { describeRunError } from '../services/run-error';
import { ProviderLoginAction } from './ProviderLoginAction';
import { RunErrorContinueAction } from './RunErrorContinueAction';
import { RunErrorModelAction } from './RunErrorModelAction';

export function RunErrorNotice({ error, entryId }: { error: MastraErrorPart['error']; entryId: string }) {
  const session = useContext(ChatSessionContext);
  const displayedThread = useContext(ChatThreadMessagesContext);
  const description = describeRunError(error);
  const details = JSON.stringify(
    {
      name: error.name,
      message: error.message,
      entryId,
      resourceId: session?.resourceId,
      threadId: displayedThread?.threadId ?? session?.sessionThreadId,
    },
    undefined,
    2,
  );
  return (
    <Notice
      variant="destructive"
      title={description.title}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {description.recovery === 'credentials' && <ProviderLoginAction label="Review credentials" />}
          {description.recovery === 'models' && <RunErrorModelAction />}
          {description.recovery === 'continue' && <RunErrorContinueAction entryId={entryId} />}
          <CopyButton content={details} tooltip="Copy error details" showToast={false} variant="ghost" size="icon-sm" />
        </div>
      }
    >
      <Notice.Message>{description.message}</Notice.Message>
      <Collapsible>
        <CollapsibleTrigger render={<Notice.Button>Error details</Notice.Button>} />
        <CollapsibleContent>
          <CodeBlock code={details} lang="json" copyTooltip="Copy diagnostic JSON" />
        </CollapsibleContent>
      </Collapsible>
    </Notice>
  );
}
