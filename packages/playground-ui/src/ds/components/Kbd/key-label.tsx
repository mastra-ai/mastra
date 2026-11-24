import { Children } from 'react';
import type { ReactNode } from 'react';
import { KEY_SYMBOL_HEIGHT, keySymbols } from './key-symbols';

const symbols = Object.keys(keySymbols).join('');
const symbolPattern = new RegExp(`([${symbols}])`);
// Between a symbol and the key beside it, so "⌘K" and "⌘ K" read the same
const symbolGapPattern = new RegExp(`(?<=\\S)\\s*(?=[${symbols}])|(?<=[${symbols}])\\s*(?=\\S)`, 'g');

function KeySymbol({ symbol }: { symbol: string }) {
  const { name, width, path } = keySymbols[symbol] ?? {};

  return (
    <>
      <svg
        role="img"
        aria-label={name}
        viewBox={`0 0 ${width} ${KEY_SYMBOL_HEIGHT}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Tall as a capital and spaced like a letter. Important: menu rows, buttons and the like size their svgs.
        className="mx-[0.06em] inline-block h-[1cap]! w-auto! overflow-visible [stroke-width:var(--key-stroke,2)] align-baseline"
      >
        <path d={path} />
      </svg>
      {/* Unseen, for copying and find-in-page */}
      <span aria-hidden style={{ font: '0/0 a' }}>
        {symbol}
      </span>
    </>
  );
}

/** A shortcut with its key symbols (⌘, ↵, ↑…) drawn, and one space between a symbol and the key beside it. */
export function KeyLabel({ children }: { children?: ReactNode }) {
  // JSX like ⌘{key} is several strings: one label
  const labels = Children.toArray(children).reduce<ReactNode[]>((joined, child) => {
    const last = joined.at(-1);
    return typeof last === 'string' && typeof child === 'string'
      ? [...joined.slice(0, -1), last + child]
      : [...joined, child];
  }, []);

  return Children.map(labels, child => {
    if (typeof child !== 'string' || !symbolPattern.test(child)) return child;

    const keys = child.replace(symbolGapPattern, ' ').split(symbolPattern);

    return (
      <span className="whitespace-nowrap">
        {keys.map((key, index) => (index % 2 ? <KeySymbol key={index} symbol={key} /> : key))}
      </span>
    );
  });
}
