import type { SpanInputMessage } from '@mastra/core/observability';
import { Fragment } from 'react';
import { SpanPayloadMessages } from './span-payload-messages';
import { SpanPayloadField } from './span-payload-primitives';
import { SignalBadge } from '@/domains/chat/messages/signal-badge';
import { formatSignalValue, isUserSignalType } from '@/domains/chat/messages/signal-data';
import type { SignalData } from '@/domains/chat/messages/signal-data';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

function SignalDetails({ signal }: { signal: SignalData }) {
  const attributes = Object.entries(signal.attributes ?? {});
  return (
    <SpanPayloadField label="Signal">
      <DataKeysAndValues>
        {signal.type !== undefined && (
          <>
            <DataKeysAndValues.Key>Type</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{signal.type}</DataKeysAndValues.Value>
          </>
        )}
        {signal.tagName !== undefined && (
          <>
            <DataKeysAndValues.Key>Tag</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{signal.tagName}</DataKeysAndValues.Value>
          </>
        )}
        {attributes.map(([key, value]) => (
          <Fragment key={key}>
            <DataKeysAndValues.Key>{key}</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{formatSignalValue(value) ?? String(value)}</DataKeysAndValues.Value>
          </Fragment>
        ))}
        {signal.id !== undefined && (
          <>
            <DataKeysAndValues.Key>Id</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithCopyBtn copyValue={signal.id}>{signal.id}</DataKeysAndValues.ValueWithCopyBtn>
          </>
        )}
      </DataKeysAndValues>
    </SpanPayloadField>
  );
}

/**
 * Input of an agent run started by a signal: a user signal reads as the user message it is,
 * any other signal (a skill, a system reminder, a notification…) as the signal row the chat
 * draws for it, followed by the signal's metadata.
 */
export function SpanSignalInput({ signal }: { signal: SignalData }) {
  const userMessage = { role: 'user', content: signal.contents } as SpanInputMessage;
  return (
    <div data-slot="span-signal-input" data-signal-type={signal.type} className="flex min-w-0 flex-col gap-6">
      {isUserSignalType(signal.type) ? (
        <SpanPayloadMessages value={[userMessage]} />
      ) : (
        <SignalBadge signal={signal} defaultOpen />
      )}
      <SignalDetails signal={signal} />
    </div>
  );
}
