/**
 * Renders `@pierre/diffs`' React `File` component in jsdom (via `createElement`
 * so we can live inside a .test.ts) and inspects what actually ends up in the
 * DOM. Closest thing to an automated reproduction of the "no syntax
 * highlighting + huge empty gutter" bug we can drive from a unit test.
 */
// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as PierreDiffs from '@pierre/diffs';
import { registerCustomTheme, preloadHighlighter } from '@pierre/diffs';
import { File as PierreFile } from '@pierre/diffs/react';

async function registerPierreThemes() {
  const light = (await import('@pierre/theme/pierre-light')).default;
  const dark = (await import('@pierre/theme/pierre-dark')).default;
  try {
    registerCustomTheme('pierre-light', async () => light as never);
    registerCustomTheme('pierre-dark', async () => dark as never);
  } catch {
    /* already registered in a previous suite */
  }
  await preloadHighlighter({
    themes: ['pierre-light', 'pierre-dark'] as unknown as never,
    langs: ['json'] as unknown as never,
  });
}

function renderFile(extraProps: Record<string, unknown> = {}) {
  return render(
    createElement(PierreFile as never, {
      file: { name: 'demo.json', contents: '{"foo": "bar"}' },
      options: { theme: { light: 'pierre-light', dark: 'pierre-dark' } },
      ...extraProps,
    }),
  );
}

describe('Pierre File render probe', () => {
  it('registers the diffs-container custom element on import', () => {
    // eslint-disable-next-line no-console
    console.log('[probe] DIFFS_TAG_NAME =', PierreDiffs.DIFFS_TAG_NAME);
    const registered = customElements.get(PierreDiffs.DIFFS_TAG_NAME);
    // eslint-disable-next-line no-console
    console.log('[probe] custom element defined? =', Boolean(registered));
    expect(registered).toBeDefined();
  });

  it('renders a <diffs-container> host with an adopted stylesheet', async () => {
    await registerPierreThemes();
    const { container } = renderFile();
    const host = container.querySelector(PierreDiffs.DIFFS_TAG_NAME);
    // eslint-disable-next-line no-console
    console.log('[probe] host tag =', host?.tagName?.toLowerCase(), 'exists?', Boolean(host));
    expect(host).not.toBeNull();
    const shadow = (host as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot;
    // eslint-disable-next-line no-console
    console.log('[probe] shadowRoot present? =', Boolean(shadow));
    const sheetCount = shadow?.adoptedStyleSheets?.length ?? 0;
    // eslint-disable-next-line no-console
    console.log('[probe] adoptedStyleSheets =', sheetCount);
    expect(shadow).toBeTruthy();
    expect(sheetCount).toBeGreaterThan(0);
  });

  it('paints colored <span> tokens once tokenization resolves', async () => {
    await registerPierreThemes();
    const { container } = renderFile();
    const host = container.querySelector(
      PierreDiffs.DIFFS_TAG_NAME,
    ) as HTMLElement & { shadowRoot: ShadowRoot | null };
    let lastCount = 0;
    try {
      await waitFor(
        () => {
          const spans = host.shadowRoot!.querySelectorAll('span[style*="color"]');
          lastCount = spans.length;
          expect(lastCount).toBeGreaterThan(0);
        },
        { timeout: 3000, interval: 50 },
      );
    } finally {
      // eslint-disable-next-line no-console
      console.log('[probe] final colored span count =', lastCount);
      // eslint-disable-next-line no-console
      console.log(
        '[probe] shadow innerHTML sample =',
        host.shadowRoot?.innerHTML.slice(0, 600),
      );
    }
  });

  it('does NOT reserve an annotation gutter column when lineAnnotations is empty', async () => {
    await registerPierreThemes();
    const { container } = renderFile();
    const host = container.querySelector(
      PierreDiffs.DIFFS_TAG_NAME,
    ) as HTMLElement & { shadowRoot: ShadowRoot | null };
    // Wait for a first paint of code so grid layout is stable.
    await waitFor(
      () => {
        expect(host.shadowRoot!.querySelector('[data-code]')).not.toBeNull();
      },
      { timeout: 3000, interval: 50 },
    );
    const codePane = host.shadowRoot!.querySelector('[data-code]') as HTMLElement;
    const style = codePane.getAttribute('style') ?? '';
    const gridTemplate =
      style.match(/--diffs-code-grid:\s*([^;]+)/)?.[1]?.trim() ?? '<inherited>';
    // eslint-disable-next-line no-console
    console.log('[probe] --diffs-code-grid on [data-code] =', gridTemplate);
    const annotationSlots = host.shadowRoot!.querySelectorAll('[data-annotation-content]');
    // eslint-disable-next-line no-console
    console.log('[probe] annotation slot elements =', annotationSlots.length);
    expect(annotationSlots.length).toBe(0);
  });
});
