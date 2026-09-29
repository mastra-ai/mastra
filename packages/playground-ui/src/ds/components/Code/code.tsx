import * as React from 'react';

import { tokenStyle, useHighlight } from './use-highlight';
import type { Highlighted } from './use-highlight';

export interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  code: string;
  lang?: string;
  /** Per-line class, e.g. for diff or search highlighting. When set, every line is wrapped in a `[data-line]` span. */
  lineClassName?: (lineIndex: number, lineText: string) => string | undefined;
}

/** Colors from an earlier pass still hold when the new code only appends to the old. */
function usableHighlight(highlighted: Highlighted | null, code: string, lang?: string): Highlighted | null {
  if (!highlighted || highlighted.lang !== lang) return null;
  return code.startsWith(highlighted.code) ? highlighted : null;
}

/**
 * Low-level shiki token renderer shared by `CodeBlock` and `MarkdownRenderer`.
 * Dual-theme colors stay as `--shiki-light` / `--shiki-dark` CSS variables on
 * each token span; the `.shiki-token` class (index.css) picks the variant from
 * the `.dark` root class, so theme switching is pure CSS — no ThemeProvider
 * required. Renders plain text while highlighting is pending or when the
 * language is missing/unknown.
 *
 * A streaming fence re-renders on every delta while highlighting stays a frame
 * behind. Dropping the previous tokens each time would strobe the whole block
 * between colored and plain, so the settled prefix keeps its colors and only
 * the newly arrived tail waits, uncolored, for the next pass.
 */
export const Code = React.memo(function Code({ code, lang, lineClassName, ...props }: CodeProps) {
  const highlighted = useHighlight(code, lang);

  const usable = usableHighlight(highlighted, code, lang);
  if (!usable) {
    if (!lineClassName) return <pre {...props}>{code}</pre>;
    const lines = code.split('\n');
    return (
      <pre {...props}>
        {lines.map((text, i) => (
          <React.Fragment key={i}>
            <span data-line={i} className={lineClassName(i, text)}>
              {text}
            </span>
            {i !== lines.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </pre>
    );
  }

  const tail = code.slice(usable.code.length);
  let codeOffset = 0;

  return (
    <pre {...props}>
      <code>
        {usable.tokens.map((line, lineIndex) => {
          const lineOffset = codeOffset;
          let tokenOffset = lineOffset;
          const tokenSpans = line.map(token => {
            const key = tokenOffset;
            tokenOffset += token.content.length;

            return (
              <span key={key} className="shiki-token" style={tokenStyle(token)}>
                {token.content}
              </span>
            );
          });

          codeOffset = tokenOffset + 1;

          return (
            <React.Fragment key={lineOffset}>
              {lineClassName ? (
                <span
                  data-line={lineIndex}
                  className={lineClassName(lineIndex, line.map(token => token.content).join(''))}
                >
                  {tokenSpans}
                </span>
              ) : (
                <span>{tokenSpans}</span>
              )}
              {lineIndex !== usable.tokens.length - 1 && '\n'}
            </React.Fragment>
          );
        })}
        {tail}
      </code>
    </pre>
  );
});
