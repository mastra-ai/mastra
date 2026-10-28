import {
  Activity,
  ActivityContent,
  ActivityDetail,
  ActivityDisclosure,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
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
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';
import { TimedTrigger } from '../activity/TimedTrigger';
import { rowStyle } from '../activity/row-style';

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

export interface RowOpenState {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ToolCard({ tool, ...open }: { tool: ToolCall } & RowOpenState) {
  const { icon: ToolIcon, label, detail, description, command } = presentTool(tool.toolName, tool.args);
  const failed = tool.status === 'error';

  return (
    <Activity
      foldable={toolHasBody(tool, command)}
      status={toolCallStatus(tool.status)}
      aria-label={`Tool: ${tool.toolName}`}
      aria-busy={tool.status === 'running'}
      {...open}
    >
      <TimedTrigger at={tool.createdAt}>
        <ActivityHeader className={rowStyle.header}>
          <ActivityIcon className={cn(!failed && rowStyle.icon)}>
            <ToolIcon aria-hidden />
          </ActivityIcon>
          <ActivityLabel className={cn(rowStyle.text, 'max-w-none', (description || !detail) && 'min-w-0 shrink')}>
            {description || label}
          </ActivityLabel>
          {!description && detail && <ActivityDetail className={rowStyle.text}>{detail}</ActivityDetail>}
          {failed && <X size={13} role="img" aria-label="Failed" className="shrink-0 text-destructive-foreground" />}
          <ActivityDisclosure />
        </ActivityHeader>
      </TimedTrigger>
      <ActivityContent className={rowStyle.content}>
        <ToolBody tool={tool} command={command} />
      </ActivityContent>
    </Activity>
  );
}
