import { ToolCallMono } from './tool-call';
import { ToolCallEdit } from './tool-call-edit';
import { stringifyToolValue, toolEdit } from './tool-presentation';

export interface ToolCallArgumentsProps {
  toolName: string;
  args: unknown;
  argsText?: string;
  hideArguments?: boolean;
  'data-testid'?: string;
}

export function ToolCallArguments({
  toolName,
  args,
  argsText,
  hideArguments,
  'data-testid': testId,
}: ToolCallArgumentsProps) {
  const edit = toolEdit(toolName, args);
  if (edit) return <ToolCallEdit edit={edit} />;
  if (hideArguments) return null;

  const text = args === undefined ? argsText : stringifyToolValue(args);
  if (!text) return null;

  return (
    <ToolCallMono copyText={text} data-testid={testId} className="text-foreground">
      {text}
    </ToolCallMono>
  );
}
