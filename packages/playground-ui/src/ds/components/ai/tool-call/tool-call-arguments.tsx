import { ToolCallMono } from './tool-call';
import { ToolCallEdit } from './tool-call-edit';
import { toolEdit, visibleToolArgumentsText } from './tool-presentation';
import type { ToolArgumentsInput } from './tool-presentation';

export interface ToolCallArgumentsProps extends ToolArgumentsInput {
  'data-testid'?: string;
}

export function ToolCallArguments({ 'data-testid': testId, ...input }: ToolCallArgumentsProps) {
  const edit = toolEdit(input.toolName, input.args);
  if (edit) return <ToolCallEdit edit={edit} />;

  const text = visibleToolArgumentsText(input);
  if (!text) return null;

  return (
    <ToolCallMono copyText={text} data-testid={testId} className="text-foreground">
      {text}
    </ToolCallMono>
  );
}
