import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import type { JSX } from 'react';
import { Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import type { BundledLanguage } from 'shiki/bundle/web';
import { codeToHast } from 'shiki/bundle/web';

export async function highlight(code: string, lang: BundledLanguage) {
  const out = await codeToHast(code, {
    lang,
    theme: 'dracula-soft',
  });

  return toJsxRuntime(out, {
    Fragment,
    jsx,
    jsxs,
  }) as JSX.Element;
}
