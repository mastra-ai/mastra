import * as React from 'react';
import type { ThemedToken } from 'shiki/core';

import { highlight } from '../CodeEditor/highlight';

export interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  code: string;
  lang?: string;
}

function tokenStyle(token: ThemedToken): React.CSSProperties | undefined {
  if (token.htmlStyle && typeof token.htmlStyle === 'object') {
    return token.htmlStyle as React.CSSProperties;
  }

  return token.color ? { color: token.color } : undefined;
}

/**
 * Low-level shiki token renderer shared by `CodeBlock` and `MarkdownRenderer`.
 * Dual-theme colors stay as `--shiki-light` / `--shiki-dark` CSS variables on
 * each token span; the `.shiki-token` class (index.css) picks the variant from
 * the `.dark` root class, so theme switching is pure CSS — no ThemeProvider
 * required. Renders plain text while highlighting is pending or when the
 * language is missing/unknown.
 */
export const Code = React.memo(function Code({ code, lang, ...props }: CodeProps) {
  const [tokens, setTokens] = React.useState<ThemedToken[][] | null>(null);

  React.useEffect(() => {
    setTokens(null);
    if (!lang) return;

    let cancelled = false;

    void highlight(code, lang)
      .then(result => {
        if (!cancelled) setTokens(result);
      })
      .catch(() => {
        if (!cancelled) setTokens(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!tokens?.length) {
    return <pre {...props}>{code}</pre>;
  }

  let codeOffset = 0;

  return (
    <pre {...props}>
      <code>
        {tokens.map((line, lineIndex) => {
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
              <span>{tokenSpans}</span>
              {lineIndex !== tokens.length - 1 && '\n'}
            </React.Fragment>
          );
        })}
      </code>
    </pre>
  );
});
