import {
  ToolCallArguments,
  ToolCallCommand,
  ToolCallOutput,
  hasToolArguments,
  stringifyToolValue,
  stripSerializedAnsi,
  toolEdit,
} from '@mastra/playground-ui/components/ai/tool-call';

import type { ToolCall } from '../../services/transcript';

function toolResultText(tool: ToolCall): string | undefined {
  if (tool.status === 'running' || tool.result === undefined || tool.result === null) return undefined;
  return stripSerializedAnsi(stringifyToolValue(tool.result)) || undefined;
}

export function toolHasBody(tool: ToolCall, command: string | undefined): boolean {
  if (command !== undefined || tool.output) return true;
  return hasToolArguments(tool) || toolResultText(tool) !== undefined;
}

export function ToolBody({ tool, command }: { tool: ToolCall; command?: string }) {
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
