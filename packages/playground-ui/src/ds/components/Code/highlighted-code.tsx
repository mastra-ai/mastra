import * as React from 'react';
import type { ThemedToken } from 'shiki/core';

function tokenStyle(token: ThemedToken): React.CSSProperties | undefined {
  if (token.htmlStyle && typeof token.htmlStyle === 'object') {
    return token.htmlStyle as React.CSSProperties;
  }

  return token.color ? { color: token.color } : undefined;
}

export function HighlightedTokenLine({ tokens }: { tokens: ThemedToken[] }) {
  let tokenOffset = 0;

  return tokens.map(token => {
    const key = tokenOffset;
    tokenOffset += token.content.length;

    return (
      <span key={key} className="shiki-token" style={tokenStyle(token)}>
        {token.content}
      </span>
    );
  });
}
