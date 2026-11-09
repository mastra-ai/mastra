// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDropZone } from './use-drop-zone';

const CARD_TYPE = 'application/x-card';

afterEach(() => {
  cleanup();
});

function dataTransferOf(type: string) {
  return { types: [type], dropEffect: 'none', getData: (requested: string) => (requested === type ? 'card-1' : '') };
}

function leaveZone(zone: HTMLElement, relatedTarget: EventTarget | null) {
  const event = createEvent.dragLeave(zone, { dataTransfer: dataTransferOf(CARD_TYPE) });
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  fireEvent(zone, event);
}

function Zone({ onDrop }: { onDrop: (dataTransfer: DataTransfer) => void }) {
  const { isDragOver, dropZoneProps } = useDropZone({ accept: CARD_TYPE, dropEffect: 'move', onDrop });
  return (
    <section aria-label="Stage" data-drag-over={isDragOver} {...dropZoneProps}>
      <article aria-label="Card">card</article>
    </section>
  );
}

const renderZone = () => {
  const onDrop = vi.fn<(dataTransfer: DataTransfer) => void>();
  render(<Zone onDrop={onDrop} />);
  return { onDrop, zone: screen.getByRole('region', { name: 'Stage' }), card: screen.getByRole('article') };
};

describe('useDropZone', () => {
  describe('given an accepted drag over the zone', () => {
    it('reports the drag and accepts it with the requested effect', () => {
      const { zone } = renderZone();
      const dataTransfer = dataTransferOf(CARD_TYPE);

      const allowed = fireEvent.dragOver(zone, { dataTransfer });

      expect(allowed).toBe(false);
      expect(dataTransfer.dropEffect).toBe('move');
      expect(zone.getAttribute('data-drag-over')).toBe('true');
    });

    it('keeps reporting the drag while the pointer moves onto a child', () => {
      const { zone, card } = renderZone();
      fireEvent.dragOver(zone, { dataTransfer: dataTransferOf(CARD_TYPE) });

      leaveZone(zone, card);

      expect(zone.getAttribute('data-drag-over')).toBe('true');
    });

    it('stops reporting the drag once the pointer leaves the zone', () => {
      const { zone } = renderZone();
      fireEvent.dragOver(zone, { dataTransfer: dataTransferOf(CARD_TYPE) });

      leaveZone(zone, document.body);

      expect(zone.getAttribute('data-drag-over')).toBe('false');
    });

    it('stops reporting the drag when it is cancelled without a destination', () => {
      const { zone } = renderZone();
      fireEvent.dragOver(zone, { dataTransfer: dataTransferOf(CARD_TYPE) });

      leaveZone(zone, null);

      expect(zone.getAttribute('data-drag-over')).toBe('false');
    });
  });

  describe('given an accepted drop', () => {
    it('hands the dropped data over and clears the drag', () => {
      const { zone, card, onDrop } = renderZone();
      const dataTransfer = dataTransferOf(CARD_TYPE);
      fireEvent.dragOver(zone, { dataTransfer });

      const allowed = fireEvent.drop(card, { dataTransfer });

      expect(allowed).toBe(false);
      expect(onDrop).toHaveBeenCalledTimes(1);
      expect(onDrop.mock.calls[0]?.[0].getData(CARD_TYPE)).toBe('card-1');
      expect(zone.getAttribute('data-drag-over')).toBe('false');
    });
  });

  describe('given a drag of another type', () => {
    it('lets the drag pass through without claiming it', () => {
      const { zone } = renderZone();

      const allowed = fireEvent.dragOver(zone, { dataTransfer: dataTransferOf('Files') });

      expect(allowed).toBe(true);
      expect(zone.getAttribute('data-drag-over')).toBe('false');
    });

    it('ignores the drop', () => {
      const { zone, onDrop } = renderZone();

      const allowed = fireEvent.drop(zone, { dataTransfer: dataTransferOf('Files') });

      expect(allowed).toBe(true);
      expect(onDrop).not.toHaveBeenCalled();
    });
  });
});
