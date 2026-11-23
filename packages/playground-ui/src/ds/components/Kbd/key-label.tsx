import { Children } from 'react';
import type { ReactNode } from 'react';
import { KEY_SYMBOL_HEIGHT, keySymbols } from './key-symbols';

// A symbol takes the space after it, so "⌘K" and "⌘ K" get the same gap.
const symbolPattern = new RegExp(`([${Object.keys(keySymbols).join('')}]\\s*)`);

type KeySymbolProps = {
  text: string;
  strokeWidth: number;
};

function KeySymbol({ text, strokeWidth }: KeySymbolProps) {
  const symbol = keySymbols[text.trim()];
  if (!symbol) return text;

  // Paths start at 1,1. The box grows with the stroke, so a heavier one still spans exactly one cap height.
  const start = 1 - strokeWidth / 2;
  const width = symbol.width + strokeWidth;
  const height = KEY_SYMBOL_HEIGHT + strokeWidth;

  return (
    // `cap` is the capital height of whichever font the letters use. The side padding stands in for a letter's side
    // bearing, and with the top and bottom pixel keeps the clip off the drawing. What it clips is the character
    // itself, kept in the text for copying and find-in-page.
    <span
      role="img"
      aria-label={symbol.name}
      className="-my-px box-content inline-block h-[1cap] overflow-hidden px-[0.1em] py-px whitespace-nowrap"
      style={{ width: `${width / height}cap` }}
    >
      <svg
        aria-hidden
        viewBox={`${start} ${start} ${width} ${height}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Important: menu rows, buttons and the like size the svgs inside them.
        className="inline-block size-full! overflow-visible align-top"
      >
        <path d={symbol.path} />
      </svg>
      <span className="opacity-0">{text}</span>
    </span>
  );
}

export type KeyLabelProps = {
  children?: ReactNode;
  /** In the drawing's units, with 16 between the top and bottom strokes: 2 matches the body face's stems. */
  strokeWidth?: number;
};

/** A shortcut's text with its key symbols (⌘, ↵, ↑…) drawn at the height of the letters beside them. */
export function KeyLabel({ children, strokeWidth = 2 }: KeyLabelProps) {
  return Children.map(children, child => {
    if (typeof child !== 'string') return child;

    const parts = child.split(symbolPattern);
    if (parts.length === 1) return child;

    return parts.map((part, index) =>
      index % 2 ? <KeySymbol key={index} text={part} strokeWidth={strokeWidth} /> : part,
    );
  });
}
