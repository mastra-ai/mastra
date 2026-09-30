// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpanPayloadSection } from '../span-payload-section';

describe('SpanPayloadSection', () => {
  afterEach(cleanup);
  describe('when the content fits the collapsed height', () => {
    it('shows no expand control', () => {
      render(
        <SpanPayloadSection title="Input" raw={{ a: 1 }}>
          <p>Short</p>
        </SpanPayloadSection>,
      );
      expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
    });
  });
  describe('when the content is taller than the collapsed height', () => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });
    it('clips the whole box and lets the user expand and collapse it, in both views', () => {
      const { container } = render(
        <SpanPayloadSection title="Input" raw={{ a: 1 }}>
          <p>Long content</p>
        </SpanPayloadSection>,
      );
      const clip = () => container.querySelector<HTMLElement>('[data-slot="span-payload-section"] [style]');
      expect(clip()?.style.maxHeight).toBe('220px');
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
      expect(clip()?.style.maxHeight).toBe('');
      fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(clip()?.style.maxHeight).toBe('220px');
      fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
      expect(clip()?.style.maxHeight).toBe('220px');
      expect(container.querySelector('[data-slot="span-payload-json"]')).toBeTruthy();
    });
  });
});
