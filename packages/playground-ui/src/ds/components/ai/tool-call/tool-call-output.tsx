import { ToolCallMono } from './tool-call-mono';

export interface ToolCallOutputProps {
  text: string;
  error?: boolean;
  'data-testid'?: string;
}

export function ToolCallOutput({ text, error, 'data-testid': testId }: ToolCallOutputProps) {
  return (
    <ToolCallMono
      copyText={text}
      data-testid={testId}
      className={error ? 'text-destructive-foreground' : 'text-muted-foreground'}
    >
      {text}
    </ToolCallMono>
  );
}
