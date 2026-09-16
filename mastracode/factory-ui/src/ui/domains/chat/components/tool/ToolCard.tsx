import {
  ToolCall as ToolCallRoot,
  ToolCallCommand,
  ToolCallContent,
  ToolCallEdit,
  ToolCallMono,
  ToolCallPresentedHeader,
  ToolCallTrigger,
  presentTool,
  stringifyToolValue,
  stripSerializedAnsi,
  toolEdit,
} from '@mastra/playground-ui/components/ai/tool-call';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { ToolTime } from '../ToolTime';

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function ToolBody({ tool, command }: { tool: ToolCall; command?: string }) {
  const edit = toolEdit(tool.toolName, tool.args);
  const resultText =
    tool.status !== 'running' && tool.result !== undefined
      ? stripSerializedAnsi(stringifyToolValue(tool.result))
      : undefined;

  if (edit) {
    return (
      <>
        <ToolCallEdit edit={edit} />
        {tool.status === 'error' && resultText !== undefined && (
          <ToolCallMono copyText={resultText} className="text-error/90">
            {truncate(resultText, 800)}
          </ToolCallMono>
        )}
      </>
    );
  }

  if (command) {
    return (
      <>
        <ToolCallCommand command={command} />
        {tool.output ? (
          <ToolCallMono copyText={tool.output} className="text-icon3">
            {tool.output}
          </ToolCallMono>
        ) : (
          resultText !== undefined && (
            <ToolCallMono copyText={resultText} className="text-icon3">
              {truncate(resultText, 800)}
            </ToolCallMono>
          )
        )}
      </>
    );
  }

  const argsPretty = tool.args !== undefined ? stringifyToolValue(tool.args) : tool.argsText;
  return (
    <>
      {argsPretty && (
        <ToolCallMono copyText={argsPretty} className="text-icon5">
          {argsPretty}
        </ToolCallMono>
      )}
      {tool.output && (
        <ToolCallMono copyText={tool.output} className="text-icon3">
          {tool.output}
        </ToolCallMono>
      )}
      {resultText !== undefined && (
        <ToolCallMono copyText={resultText} className="text-icon3">
          {truncate(resultText, 800)}
        </ToolCallMono>
      )}
    </>
  );
}

export function ToolCard({ tool }: { tool: ToolCall }) {
  const { icon, label, detail, command } = presentTool(tool.toolName, tool.args);

  return (
    <ToolCallRoot
      status={toolCallStatus(tool.status)}
      aria-label={`Tool: ${tool.toolName}`}
      aria-busy={tool.status === 'running'}
    >
      <ToolCallTrigger>
        <ToolCallPresentedHeader leading={<ToolTime at={tool.createdAt} />} icon={icon} label={label} detail={detail} />
      </ToolCallTrigger>
      <ToolCallContent>
        <ToolBody tool={tool} command={command} />
      </ToolCallContent>
    </ToolCallRoot>
  );
}
