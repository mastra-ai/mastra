import { Txt } from '@/ds/components/Txt';

export function ChatTimeGap({ text }: { text: string }) {
  const [phrase, timestamp] = text.split(' — ');
  if (!phrase) return null;

  return (
    <div className="flex items-center gap-3 py-3" role="separator" aria-label={text}>
      <span aria-hidden className="bg-border h-px flex-1" />
      <Txt as="span" variant="meta" className="text-icon3 shrink-0" title={timestamp}>
        {phrase}
      </Txt>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}
