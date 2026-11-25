// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '../Toaster';
import { TooltipProvider } from '../Tooltip';
import { CopyField } from './copy-field';

const ORG_ID = 'org_01KJGEY548CS1D3VYS5YY27PGS';
const CHAR_WIDTH = 8;

/** jsdom has no layout: give every box a width, `CHAR_WIDTH` per character, and the field `room` px. */
function layoutWith(room: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.classList.contains('grid') ? room : (this.textContent ?? '').length * CHAR_WIDTH;
    return { width, height: 20, top: 0, left: 0, right: width, bottom: 20, x: 0, y: 0, toJSON() {} };
  });
}

function renderField() {
  return render(
    <TooltipProvider>
      <CopyField value={ORG_ID} label="organization ID" />
      <p>Next row</p>
      <Toaster />
    </TooltipProvider>,
  );
}

function selectContents(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CopyField', () => {
  describe('when the value fits', () => {
    it('shows it whole, named by its label', () => {
      layoutWith(400);
      renderField();

      // One match: tests and find-in-page see the value once, not once per layer.
      expect(screen.getAllByText(ORG_ID)).toHaveLength(1);
      expect(screen.queryByText(/…/)).toBeNull();
    });
  });

  describe('when the value is too long for the field', () => {
    it('keeps its start and its last six characters around an ellipsis, filling the room', () => {
      layoutWith(20 * CHAR_WIDTH);
      renderField();

      // 20 characters of room: 13 from the start, the ellipsis, and the 6-character tail.
      expect(screen.getByText('org_01KJGEY54…Y27PGS')).toBeTruthy();
    });

    it('still gives screen readers the whole value', () => {
      layoutWith(20 * CHAR_WIDTH);
      renderField();

      // The sizing copy of the value is aria-hidden; only a readable node counts.
      expect(screen.getByText(ORG_ID, { selector: 'span:not([aria-hidden])' })).toBeTruthy();
    });

    it('keeps less of the end when the field is too narrow for the whole tail', () => {
      layoutWith(5 * CHAR_WIDTH);
      renderField();

      expect(screen.getByText('…7PGS')).toBeTruthy();
    });

    it('copies the whole value, not the ellipsis, when someone selects the text and copies it', () => {
      layoutWith(20 * CHAR_WIDTH);
      renderField();
      const setData = vi.fn();
      selectContents(screen.getByText('org_01KJGEY54…Y27PGS'));

      fireEvent.copy(screen.getByText('org_01KJGEY54…Y27PGS'), { clipboardData: { setData } });

      expect(setData).toHaveBeenCalledWith('text/plain', ORG_ID);
    });
    it('leaves a selection that runs past the field alone', () => {
      layoutWith(20 * CHAR_WIDTH);
      renderField();
      const setData = vi.fn();
      const range = document.createRange();
      range.setStart(screen.getByText('org_01KJGEY54…Y27PGS'), 0);
      range.setEndAfter(screen.getByText('Next row'));
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);

      fireEvent.copy(screen.getByText('org_01KJGEY54…Y27PGS'), { clipboardData: { setData } });

      expect(setData).not.toHaveBeenCalled();
    });

    it('never splits an emoji at the end of the value', () => {
      layoutWith(12 * CHAR_WIDTH);
      render(
        <TooltipProvider>
          <CopyField value="https://mastra.dev/a/😀abcde" label="link" />
        </TooltipProvider>,
      );

      expect(screen.getByText('http…😀abcde')).toBeTruthy();
    });

    it('never splits an emoji made of several characters', () => {
      layoutWith(14 * CHAR_WIDTH);
      render(
        <TooltipProvider>
          <CopyField value="https://mastra.dev/a/👩‍💻abcde" label="link" />
        </TooltipProvider>,
      );

      expect(screen.getByText(/…👩‍💻abcde$/)).toBeTruthy();
    });
  });

  describe('when someone presses the copy button', () => {
    it('copies the whole value and shows it was copied in place, without a toast', async () => {
      layoutWith(20 * CHAR_WIDTH);
      renderField();

      await userEvent.click(screen.getByRole('button', { name: 'Copy organization ID' }));

      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ORG_ID));
      expect(await screen.findByText('organization ID copied')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Copy organization ID' })).toBeTruthy();
      expect(document.querySelector('[data-sonner-toast]')).toBeNull();
    });
  });
});
