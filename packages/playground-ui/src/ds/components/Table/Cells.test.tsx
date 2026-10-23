// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DateTimeCell } from './Cells';

afterEach(cleanup);

describe('DateTimeCell', () => {
  describe('when timestamps differ only by seconds', () => {
    it('keeps both timestamps distinguishable without hovering', () => {
      const { container } = render(
        <table>
          <tbody>
            <tr>
              <DateTimeCell dateTime={new Date(2020, 7, 31, 13, 7, 5)} />
              <DateTimeCell dateTime={new Date(2020, 7, 31, 13, 7, 58)} />
            </tr>
          </tbody>
        </table>,
      );
      const cells = container.querySelectorAll('td');
      expect(cells[0].textContent).toBe('Aug 31, 2020, 1:07:05 PM');
      expect(cells[1].textContent).toBe('Aug 31, 2020, 1:07:58 PM');
    });
  });
});
