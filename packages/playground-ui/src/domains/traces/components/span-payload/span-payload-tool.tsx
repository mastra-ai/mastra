import { getDelegatedToolOpener, useTraceNavigation } from '../trace-navigation';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadField } from './span-payload-primitives';
import { getDelegatedTool } from './span-payload-registry';
import { BadgeWrapper } from '@/domains/chat/components/badge-wrapper';
import { ActivityHeadline } from '@/ds/components/ai/activity';
import { presentTool } from '@/ds/components/ai/tool-call/tool-presentation';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A tool name in a key/value list, opening the workflow or sub-agent behind it when the host can. */
export function SpanToolNameValue({ toolName }: { toolName: string }) {
  const open = getDelegatedToolOpener(useTraceNavigation(), toolName);
  if (!open) return <DataKeysAndValues.Value>{toolName}</DataKeysAndValues.Value>;
  return <DataKeysAndValues.ValueButton onClick={open}>{toolName}</DataKeysAndValues.ValueButton>;
}

export function SpanPayloadTool({ value }: { value: unknown }) {
  const navigation = useTraceNavigation();
  if (!isRecord(value)) return <SpanPayloadJson value={value} />;
  const call = value.type === 'tool-invocation' ? value.toolInvocation : value;
  if (!isRecord(call) || typeof call.toolName !== 'string' || !call.toolName) {
    return <SpanPayloadJson value={value} />;
  }
  const input = 'args' in call ? call.args : call.input;
  const output = 'result' in call ? call.result : call.output;
  const error = call.isError === true || call.state === 'output-error';
  const errorText = typeof call.errorText === 'string' ? call.errorText : undefined;
  const { icon: ToolIcon, label, detail, description } = presentTool(call.toolName, input);
  const delegated = getDelegatedTool(call.toolName);
  // The header toggles the body, so what opens the workflow or agent sits in the body rather than in it.
  const openDelegated = getDelegatedToolOpener(navigation, call.toolName);
  const hasBody = Boolean(openDelegated) || input !== undefined || output !== undefined || errorText !== undefined;
  return (
    <div data-slot="span-payload-tool" className="flex flex-col gap-2">
      <BadgeWrapper
        status={error ? 'error' : 'idle'}
        header={
          <ActivityHeadline icon={<ToolIcon aria-hidden />} label={label} detail={detail} description={description} />
        }
      >
        {hasBody && (
          <div className="flex flex-col gap-3">
            {delegated && openDelegated && (
              <DataKeysAndValues>
                <DataKeysAndValues.Key>{delegated.kind === 'workflow' ? 'Workflow' : 'Agent'}</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueButton onClick={openDelegated}>{delegated.key}</DataKeysAndValues.ValueButton>
              </DataKeysAndValues>
            )}
            {input !== undefined && (
              <SpanPayloadField label="Arguments">
                <SpanPayloadJson value={input} />
              </SpanPayloadField>
            )}
            {output !== undefined && (
              <SpanPayloadField label="Result">
                <SpanPayloadJson value={output} />
              </SpanPayloadField>
            )}
            {errorText !== undefined && (
              <SpanPayloadField label="Error">
                <SpanPayloadJson value={errorText} />
              </SpanPayloadField>
            )}
          </div>
        )}
      </BadgeWrapper>
    </div>
  );
}
