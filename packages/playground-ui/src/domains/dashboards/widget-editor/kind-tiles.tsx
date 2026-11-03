import type { EditorKind } from './catalogue';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type KindTile = {
  value: EditorKind;
  label: string;
  /** Why this kind can't be picked; the tile is greyed out when set. */
  disabled?: string;
};

export type KindTilesProps = {
  kinds: readonly KindTile[];
  value: EditorKind;
  onChange: (kind: EditorKind) => void;
  className?: string;
};

/** The kinds as small drawings of how each looks, so the types read at a glance. */
export function KindTiles({ kinds, value, onChange, className }: KindTilesProps) {
  return (
    <div role="group" aria-label="Widget kind" className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', className)}>
      {kinds.map(k => (
        <button
          key={k.value}
          type="button"
          aria-pressed={value === k.value}
          disabled={!!k.disabled}
          title={k.disabled}
          onClick={() => k.value !== value && onChange(k.value)}
          className={cn(
            'flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-border p-3 text-left',
            'hover:bg-fill-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            'aria-pressed:border-border-strong aria-pressed:bg-fill-subtle',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
          )}
        >
          <KindGlyph kind={k.value} />
          <Txt as="span" variant="body-sm" tone="ink">
            {k.label}
          </Txt>
        </button>
      ))}
    </div>
  );
}

const BARS = [45, 70, 55, 90];

export function KindGlyph({ kind }: { kind: EditorKind }) {
  if (kind === 'kpis') {
    return (
      <div className="flex h-7 w-12 flex-col justify-center gap-1.5" aria-hidden>
        <div className="h-2.5 w-full rounded-xs bg-foreground/80" />
        <div className="h-1 w-1/2 rounded-xs bg-fill-hover" />
      </div>
    );
  }
  if (kind === 'table') {
    return (
      <div className="flex h-7 w-12 flex-col justify-center gap-1" aria-hidden>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex gap-1">
            <div className="h-0.5 flex-3 rounded-xs bg-fill-hover" />
            <div className="h-0.5 flex-1 rounded-xs bg-foreground/80" />
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'stackedBar') {
    return (
      <div className="flex h-7 w-12 items-end gap-1" aria-hidden>
        {BARS.map(h => (
          <div key={h} className="flex flex-1 flex-col gap-px" style={{ height: `${h}%` }}>
            <div className="h-1 rounded-t-xs bg-chart-orange" />
            <div className="flex-1 rounded-b-xs bg-chart-blue" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <svg viewBox="0 0 48 28" className="h-7 w-12 overflow-visible" aria-hidden>
      <polyline
        points="0,22 9,17 16,19 25,10 32,13 41,5 48,8"
        fill="none"
        className="stroke-chart-blue"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
