import type { JSX } from 'react';
import type { BundledLanguage } from 'shiki/bundle/web';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
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
