import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mastra/playground-ui/components/Dialog';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { describeRunError } from '@mastra/factory/run-error';
import type { RunErrorRecovery } from '@mastra/factory/run-error';
import { useContext } from 'react';
import type { ComponentType } from 'react';

import { ChatSessionContext } from '../context/ChatSessionContext';
import { ChatThreadMessagesContext } from '../context/ChatThreadMessagesContext';
import { ProviderReconnectAction } from './ProviderReconnectAction';
import { ChangeModelAction } from './StatusLine/ModelPicker';

const RECOVERY_ACTIONS: Record<RunErrorRecovery, ComponentType> = {
  credentials: ProviderReconnectAction,
  model: ChangeModelAction,
};

export function RunErrorNotice({ error, entryId }: { error: MastraErrorPart['error']; entryId: string }) {
  const session = useContext(ChatSessionContext);
  const displayedThread = useContext(ChatThreadMessagesContext);
  const { title, message, recoveries, model } = describeRunError(error);
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
    <Notice
      variant="destructive"
      className="gap-y-2"
      title={title}
      action={
        <>
          {recoveries.map(recovery => {
            const RecoveryAction = RECOVERY_ACTIONS[recovery];
            return <RecoveryAction key={recovery} />;
          })}
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="ghost" size="sm" className="ms-auto">
                  Error details
                </Button>
              }
            />
            <DialogContent size="lg">
              <DialogHeader>
                <DialogTitle>Error details</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <CodeBlock code={diagnostics} lang="json" copyTooltip="Copy error details" />
              </DialogBody>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <Notice.Message>{message}</Notice.Message>
      {model && (
        <Txt variant="body-sm" tone="muted">
          Model: {formatModelName(model)}
        </Txt>
      )}
    </Notice>
  );
}
