import {
  Activity,
  ActivityContent,
  ActivityHeadline,
  ActivityTrigger,
} from '@mastra/playground-ui/components/ai/activity';
import {
  ToolCallArguments,
  ToolCallCommand,
  ToolCallOutput,
  hasToolArguments,
  presentTool,
  stringifyToolValue,
  stripSerializedAnsi,
  toolEdit,
} from '@mastra/playground-ui/components/ai/tool-call';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { ToolTime } from '../ToolTime';

function toolResultText(tool: ToolCall): string | undefined {
  if (tool.status === 'running' || tool.result === undefined || tool.result === null) return undefined;
  return stripSerializedAnsi(stringifyToolValue(tool.result));
}

function toolHasBody(tool: ToolCall, command: string | undefined): boolean {
  if (command !== undefined || tool.output) return true;
  return hasToolArguments(tool) || toolResultText(tool) !== undefined;
}

function ToolBody({ tool, command }: { tool: ToolCall; command?: string }) {
  const edit = toolEdit(tool.toolName, tool.args);
  const resultText = toolResultText(tool);

  if (edit) {
    return (
      <>
        <ToolCallArguments toolName={tool.toolName} args={tool.args} />
        {tool.status === 'error' && resultText !== undefined && (
          <ToolCallOutput text={resultText} maxLength={800} error />
        )}
      </>
    );
  }

  if (command) {
    return (
      <>
        <ToolCallCommand command={command} />
        {tool.output ? (
          <ToolCallOutput text={tool.output} />
        ) : (
          resultText !== undefined && <ToolCallOutput text={resultText} maxLength={800} />
        )}
      </>
    );
  }

  return (
    <>
      <ToolCallArguments toolName={tool.toolName} args={tool.args} argsText={tool.argsText} />
      {tool.output && <ToolCallOutput text={tool.output} />}
      {resultText !== undefined && <ToolCallOutput text={resultText} maxLength={800} />}
    </>
  );
}

export function ToolCard({ tool }: { tool: ToolCall }) {
  const { icon: ToolIcon, label, detail, command } = presentTool(tool.toolName, tool.args);

  return (
    <Activity
      foldable={toolHasBody(tool, command)}
      status={toolCallStatus(tool.status)}
      aria-label={`Tool: ${tool.toolName}`}
      aria-busy={tool.status === 'running'}
    >
      <ActivityTrigger>
        <ActivityHeadline
          leading={<ToolTime at={tool.createdAt} />}
          icon={<ToolIcon aria-hidden />}
          label={label}
          detail={detail}
        />
      </ActivityTrigger>
      <ActivityContent>
        <ToolBody tool={tool} command={command} />
      </ActivityContent>
    </Activity>
  );
}
