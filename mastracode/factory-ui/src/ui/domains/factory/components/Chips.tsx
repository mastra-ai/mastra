import type { ReactNode } from 'react';

/** A row of chips is one control: the group carries the question, each chip an answer. */
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {children}
    </div>
  );
}

/** A filter that reads as text until it is on — no border, no box, no shout. */
export function Chip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-ui-xs focus-visible:outline-accent1 cursor-pointer rounded-full px-2.5 py-1 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${
        active ? 'bg-surface4 text-icon6' : 'text-icon3 hover:text-icon5 hover:bg-surface4/60'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
