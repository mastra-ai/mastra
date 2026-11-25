import { hasAnsi, parseAnsi, stripAnsi } from './ansi';
import { cn } from '@/lib/utils';

const COLLAPSED_LINE_COUNT = 3;

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function parseJsonObject(message: string): Record<string, unknown> | undefined {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : undefined;
  } catch {
    return undefined;
  }
}

export function LogStreamFields({ entries }: { entries: Array<[string, unknown]> }) {
  return entries.map(([key, value]) => (
    <span key={key} className="ml-3 first:ml-0">
      <span className="text-muted-foreground">{key}:</span> {formatFieldValue(value)}
    </span>
  ));
}

function AnsiText({ text }: { text: string }) {
  if (!hasAnsi(text)) return <>{text}</>;
  return parseAnsi(text).map((segment, index) => (
    <span key={index} className={cn(segment.color, segment.bold && 'font-medium')}>
      {segment.text}
    </span>
  ));
}

export function LogStreamMessage({ message, collapse }: { message: string; collapse: boolean }) {
  const json = parseJsonObject(stripAnsi(message));
  if (json) return <LogStreamFields entries={Object.entries(json)} />;

  const lines = message.split('\n');
  const hidden = lines.length - COLLAPSED_LINE_COUNT;
  if (!collapse || hidden < 2) return <AnsiText text={message} />;

  return (
    <>
      <AnsiText text={lines.slice(0, COLLAPSED_LINE_COUNT).join('\n')} />
      {'\n'}
      <span className="text-muted-foreground">+{hidden} more lines</span>
    </>
  );
}
