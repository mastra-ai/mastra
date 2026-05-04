// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import type { ToasterProps } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sonnerMock, ToasterMock } = vi.hoisted(() => {
  const ToasterMock = vi.fn<(props: ToasterProps) => null>(() => null);
  return {
    sonnerMock: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      promise: vi.fn(),
    },
    ToasterMock,
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign((..._args: unknown[]) => undefined, sonnerMock),
  Toaster: ToasterMock,
}));

import { Toaster, toast } from './toast';

beforeEach(() => {
  Object.values(sonnerMock).forEach(fn => fn.mockClear());
  ToasterMock.mockClear();
});

const lastToasterProps = (): ToasterProps => {
  const call = ToasterMock.mock.calls[0];
  if (!call) throw new Error('Toaster not rendered');
  return call[0];
};

describe('Toaster wrapper', () => {
  it('enables sonner native closeButton + richColors', () => {
    render(createElement(Toaster));
    const props = lastToasterProps();
    expect(props.closeButton).toBe(true);
    expect(props.richColors).toBe(true);
  });

  it('applies the mastra-toaster theme class so sonner picks up our CSS variables', () => {
    render(createElement(Toaster));
    expect(lastToasterProps().className).toContain('mastra-toaster');
  });

  it('preserves caller className alongside the theme class', () => {
    render(createElement(Toaster, { className: 'my-extra' }));
    const className = lastToasterProps().className ?? '';
    expect(className).toContain('mastra-toaster');
    expect(className).toContain('my-extra');
  });

  it('forwards caller props (position) and merges toastOptions over defaults', () => {
    render(createElement(Toaster, { position: 'top-right', toastOptions: { duration: 9000 } }));
    const props = lastToasterProps();
    expect(props.position).toBe('top-right');
    expect(props.toastOptions?.duration).toBe(9000);
  });
});

describe('toast variant helpers', () => {
  const variants = ['success', 'error', 'warning', 'info'] as const;

  it.each(variants)('%s forwards a single message to sonnerToast.%s', method => {
    toast[method]('hello');
    expect(sonnerMock[method]).toHaveBeenCalledTimes(1);
    expect(sonnerMock[method].mock.calls[0][0]).toBe('hello');
  });

  it.each(variants)('%s emits one sonner call per array item', method => {
    toast[method](['one', 'two', 'three']);
    expect(sonnerMock[method]).toHaveBeenCalledTimes(3);
  });
});

describe('mastra-toaster CSS theming', () => {
  // Lock-in: sonner's richColors mode reads --{type}-{slot} for bg/text/border per variant.
  // These mappings must remain wired to our notice tokens, otherwise toasts fall back to sonner's
  // built-in palette and lose visual parity with the Notice component.
  const css = readFileSync(resolve(__dirname, './toast.css'), 'utf8');
  const rule = css.match(/\[data-sonner-toaster\]\[data-sonner-theme\]\.mastra-toaster\s*\{[^}]+\}/)?.[0];

  it('declares a .mastra-toaster rule with selector specificity that beats sonner defaults', () => {
    // Sonner's own per-theme block sits at (0,2,0). Our selector adds the .mastra-toaster
    // class for (0,3,0) — this regex breaks if anyone weakens the selector back to .mastra-toaster.
    expect(rule).toBeDefined();
  });

  const expectedMappings: Array<[string, string]> = [
    ['--normal-bg', 'var(--surface3)'],
    ['--normal-text', 'var(--neutral5)'],
    ['--normal-border', 'var(--border1)'],
    ['--success-bg', 'var(--toast-success-bg)'],
    ['--success-text', 'var(--notice-success-fg)'],
    ['--success-border', 'var(--toast-success-border)'],
    ['--error-bg', 'var(--toast-destructive-bg)'],
    ['--error-text', 'var(--notice-destructive-fg)'],
    ['--error-border', 'var(--toast-destructive-border)'],
    ['--warning-bg', 'var(--toast-warning-bg)'],
    ['--warning-text', 'var(--notice-warning-fg)'],
    ['--warning-border', 'var(--toast-warning-border)'],
    ['--info-bg', 'var(--toast-info-bg)'],
    ['--info-text', 'var(--notice-info-fg)'],
    ['--info-border', 'var(--toast-info-border)'],
  ];

  // Full regex escape — `expected` is a known CSS literal (`var(--…)`) but using a complete escape
  // keeps the helper safe if anyone widens the mapping list later.
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it.each(expectedMappings)('maps %s to %s', (cssVar, expected) => {
    expect(rule).toMatch(new RegExp(`${escapeRegex(cssVar)}:\\s*${escapeRegex(expected)}`));
  });

  it('applies our toast shadow to each rendered toast', () => {
    expect(css).toMatch(
      /\[data-sonner-toaster\]\.mastra-toaster\s+\[data-sonner-toast\]\s*\{[^}]*box-shadow:\s*var\(--toast-shadow\)/,
    );
  });
});

describe('toast.promise wrapper', () => {
  it('translates loadingMessage / successMessage / errorMessage to sonner shape', () => {
    const promise = Promise.resolve({ id: 1 });
    toast.promise({
      myPromise: promise,
      loadingMessage: 'Saving…',
      successMessage: 'Saved',
      errorMessage: 'Failed',
    });

    expect(sonnerMock.promise).toHaveBeenCalledTimes(1);
    const [passedPromise, opts] = sonnerMock.promise.mock.calls[0];
    expect(passedPromise).toBe(promise);
    expect(opts.loading).toBe('Saving…');
    expect(opts.success({ id: 1 })).toBe('Saved');
    expect(opts.error(new Error('boom'))).toBe('Failed');
  });

  it('falls back to err.message when no errorMessage is provided', () => {
    toast.promise({
      myPromise: Promise.resolve(null),
      successMessage: 'ok',
    });
    const opts = sonnerMock.promise.mock.calls[0][1];
    expect(opts.error(new Error('boom'))).toBe('boom');
  });
});
