import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadField, SpanPayloadLabel } from './span-payload-primitives';
import { BadgeWrapper } from '@/domains/chat/components/badge-wrapper';
import { ToolCallPresentedHeader } from '@/ds/components/ai/tool-call';
import { presentTool } from '@/ds/components/ai/tool-call/tool-presentation';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function SpanPayloadTool({ value, showLabel = true }: { value: unknown; showLabel?: boolean }) {
  if (!isRecord(value)) return <SpanPayloadJson value={value} />;
  const call = value.type === 'tool-invocation' ? value.toolInvocation : value;
  if (!isRecord(call) || typeof call.toolName !== 'string' || !call.toolName) {
    return <SpanPayloadJson value={value} />;
  }
  const input = 'args' in call ? call.args : call.input;
  const output = 'result' in call ? call.result : call.output;
  const error = call.isError === true || call.state === 'output-error';
  const errorText = typeof call.errorText === 'string' ? call.errorText : undefined;
  return (
    <div data-slot="span-payload-tool" className="flex flex-col gap-2">
      {showLabel && <SpanPayloadLabel>{value.type === 'tool-result' ? 'Tool result' : 'Tool call'}</SpanPayloadLabel>}
      <BadgeWrapper
        status={error ? 'error' : 'idle'}
        header={<ToolCallPresentedHeader {...presentTool(call.toolName, input)} />}
      >
        <div className="flex flex-col gap-3">
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
      </BadgeWrapper>
    </div>
  );
}
