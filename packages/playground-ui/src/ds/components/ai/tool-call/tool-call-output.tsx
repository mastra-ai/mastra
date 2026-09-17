import { ToolCallMono } from './tool-call';

export interface ToolCallOutputProps {
  text: string;
  error?: boolean;
  maxLength?: number;
  'data-testid'?: string;
}

export function ToolCallOutput({ text, error, maxLength, 'data-testid': testId }: ToolCallOutputProps) {
  const preview = maxLength !== undefined && text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;

  return (
    <ToolCallMono copyText={text} data-testid={testId} className={error ? 'text-error/90' : 'text-icon3'}>
      {preview}
    </ToolCallMono>
  );
}
