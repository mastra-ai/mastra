import { Txt } from '@/ds/components/Txt';

export interface TranscriptDividerProps {
  label: string;
  title?: string;
}

export function TranscriptDivider({ label, title }: TranscriptDividerProps) {
  if (!label) return null;

  return (
    <div className="flex items-center gap-3 py-3" role="separator" aria-label={title ? `${label} — ${title}` : label}>
      <span aria-hidden className="bg-border h-px flex-1" />
      <Txt as="span" variant="meta" tone="muted" title={title} className="shrink-0">
        {label}
      </Txt>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}
