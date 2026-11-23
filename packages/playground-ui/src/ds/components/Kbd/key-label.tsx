import { Children, Fragment } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { keyBearings } from './key-bearings';
import { KEY_SYMBOL_HEIGHT, keySymbols } from './key-symbols';
import { cn } from '@/lib/utils';

export type KeyFace = keyof typeof keyBearings;

// Match the letters' stems.
const strokeWidths: Record<KeyFace, number> = { mono: 2.2, monoBold: 2.8, body: 2 };

// From one key's ink to the next one's, in em. Any less and "Ctrl K" reads as one word.
const gap = 0.45;

// Takes no room, but copying and find-in-page still see it.
const textOnly: CSSProperties = { fontSize: 0, fontSizeAdjust: 'none', lineHeight: 0, letterSpacing: 0 };

// A key is one symbol or a run of other characters, with the space after it.
const symbols = Object.keys(keySymbols).join('');
const keyPattern = new RegExp(`([${symbols}]|[^\\s${symbols}]+)(\\s*)`, 'g');

const bearing = (side: readonly number[], character: string) => side[character.charCodeAt(0) - 0x21] ?? 0;

type KeyProps = {
  text: string;
  face: KeyFace;
  first: boolean;
};

function SymbolKey({ text, face, first }: KeyProps) {
  const symbol = keySymbols[text];
  if (!symbol) return text;

  // Paths start at 1,1. The box grows with the stroke, so a heavier one still spans exactly one cap height.
  const strokeWidth = strokeWidths[face];
  const start = 1 - strokeWidth / 2;
  const width = symbol.width + strokeWidth;
  const height = KEY_SYMBOL_HEIGHT + strokeWidth;

  return (
    <>
      <svg
        role="img"
        aria-label={symbol.name}
        viewBox={`${start} ${start} ${width} ${height}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // `cap` is the capital height of whichever font the letters use. Important: menu rows, buttons and the like
        // size the svgs inside them.
        className="inline-block h-[1cap]! overflow-visible align-baseline"
        style={{ width: `${width / height}cap`, marginLeft: first ? 0 : `${gap}em` }}
      >
        <path d={symbol.path} />
      </svg>
      <span aria-hidden style={textOnly}>
        {text}
      </span>
    </>
  );
}

function TextKey({ text, face, first }: KeyProps) {
  const { left, right } = keyBearings[face];
  const before = first ? 0 : gap;

  return (
    <span
      style={{
        marginLeft: `${before - bearing(left, text.charAt(0))}em`,
        marginRight: `${-bearing(right, text.charAt(text.length - 1))}em`,
      }}
    >
      {text}
    </span>
  );
}

// Strings split by JSX expressions, as in {modifier} {key}, are one label.
const joinText = (children: ReactNode) =>
  Children.toArray(children).reduce<ReactNode[]>((joined, child) => {
    const last = joined.at(-1);
    return typeof child === 'string' && typeof last === 'string'
      ? [...joined.slice(0, -1), last + child]
      : [...joined, child];
  }, []);

export type KeyLabelProps = {
  children?: ReactNode;
  face: KeyFace;
};

/**
 * A shortcut's keys: symbols (⌘, ↵, ↑…) drawn at the height of the letters beside them, every key trimmed to its ink,
 * and one gap between any two.
 */
export function KeyLabel({ children, face }: KeyLabelProps) {
  return joinText(children).map((child, childIndex) => {
    if (typeof child !== 'string') return child;

    const keys = Array.from(child.matchAll(keyPattern));
    const label = keys.map(([, text = '', space], index) => {
      const Key = Object.hasOwn(keySymbols, text) ? SymbolKey : TextKey;

      return (
        <Fragment key={index}>
          <Key text={text} face={face} first={index === 0} />
          {space && <span style={textOnly}>{space}</span>}
        </Fragment>
      );
    });

    // Letter spacing adds to the gap after a letter; a lone key has none.
    return (
      <span key={childIndex} className={cn('whitespace-nowrap', keys.length > 1 && 'tracking-normal')}>
        {label}
      </span>
    );
  });
}
