// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KNOWLEDGE_GRAPH_TRANSITION_MS, useLeavingNodes } from '../../lib/useLeavingNodes';

const node = (id: string) => ({ id, style: {} as { opacity?: number; pointerEvents?: string } });
const view = (...ids: string[]) => ids.map(node);

const css = readFileSync(resolve(import.meta.dirname, '../knowledge.css'), 'utf8');

describe('useLeavingNodes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('when a refocus drops a page from the view', () => {
    it('keeps it drawn where it was, fades it out, then lets it go', () => {
      const { result, rerender } = renderHook(({ nodes }) => useLeavingNodes(nodes, true), {
        initialProps: { nodes: view('a', 'b') },
      });
      rerender({ nodes: view('a') });
      const first = result.current.find(n => n.id === 'b');
      expect(first?.style.opacity).toBe(1);
      expect(first?.style.pointerEvents).toBe('none');

      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect(result.current.find(n => n.id === 'b')?.style.opacity).toBe(0);

      act(() => {
        vi.advanceTimersByTime(KNOWLEDGE_GRAPH_TRANSITION_MS + 60);
      });
      expect(result.current.map(n => n.id)).toEqual(['a']);
    });

    it('does not keep a page that comes straight back as a leaving one', () => {
      const { result, rerender } = renderHook(({ nodes }) => useLeavingNodes(nodes, true), {
        initialProps: { nodes: view('a', 'b') },
      });
      rerender({ nodes: view('a') });
      rerender({ nodes: view('a', 'b') });
      expect(result.current.filter(n => n.id === 'b')).toHaveLength(1);
    });
  });

  describe('when the person has asked for reduced motion', () => {
    it('drops the page at once, with nothing left to fade', () => {
      const { result, rerender } = renderHook(({ nodes }) => useLeavingNodes(nodes, false), {
        initialProps: { nodes: view('a', 'b') },
      });
      rerender({ nodes: view('a') });
      expect(result.current.map(n => n.id)).toEqual(['a']);
    });

    it('turns every transition and the fade-in off in the stylesheet', () => {
      const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(block).toContain('transition: none');
      expect(block).toContain('animation: none');
    });
  });

  it('glides, resizes and fades every node over one 700ms ease-in-out transition', () => {
    for (const property of ['transform', 'width', 'height', 'opacity']) {
      expect(css).toContain(`${property} var(--knowledge-graph-transition)`);
    }
    expect(css).toContain('--knowledge-graph-transition: 700ms cubic-bezier(0.65, 0, 0.35, 1)');
    expect(KNOWLEDGE_GRAPH_TRANSITION_MS).toBe(700);
  });
});
