import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadField } from './span-payload-primitives';
import { getWorkflowToolId } from './span-payload-registry';
import { BadgeWrapper } from '@/domains/chat/components/badge-wrapper';
import { ActivityHeadline } from '@/ds/components/ai/activity';
import { presentTool } from '@/ds/components/ai/tool-call/tool-presentation';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { useLinkComponent } from '@/lib/framework';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A tool name in a key/value list, linked to its workflow page when the tool is a workflow. */
export function SpanToolNameValue({ toolName }: { toolName: string }) {
  const { Link, paths } = useLinkComponent();
  const workflowId = getWorkflowToolId(toolName);
  const href = workflowId ? paths.workflowLink(workflowId) : '';
  if (!href) return <DataKeysAndValues.Value>{toolName}</DataKeysAndValues.Value>;
  return (
    <DataKeysAndValues.ValueLink href={href} as={Link}>
      {toolName}
    </DataKeysAndValues.ValueLink>
  );
}

export function SpanPayloadTool({ value }: { value: unknown }) {
  const { Link, paths } = useLinkComponent();
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
  const workflowId = getWorkflowToolId(call.toolName);
  // The header toggles the body, so the workflow link sits in the body rather than in it.
  const workflowHref = workflowId ? paths.workflowLink(workflowId) : '';
  const hasBody = Boolean(workflowHref) || input !== undefined || output !== undefined || errorText !== undefined;
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
            {workflowHref && (
              <DataKeysAndValues>
                <DataKeysAndValues.Key>Workflow</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueLink href={workflowHref} as={Link}>
                  {workflowId}
                </DataKeysAndValues.ValueLink>
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
