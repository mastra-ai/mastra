import { RenderResult, screen } from '@testing-library/react';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';

import { Head } from './Head';

let container: HTMLElement;
let view: RenderResult;

function setup(dayPickerProps: DayPickerProps = {}) {
  view = customRender(
    <table>
      <Head />
    </table>,
    dayPickerProps
  );
  container = view.container.firstChild as HTMLTableCellElement;
}

const dayPickerProps = {
  styles: {
    head: { color: 'red' },
    head_row: { color: 'blue' },
    head_cell: { color: 'green' }
  },
  classNames: {
    head: 'foo',
    head_row: 'foo_row',
    head_cell: 'foo_head-cell'
  }
};

describe('when rendered', () => {
  beforeEach(() => {
    setup(dayPickerProps);
  });

  test('thead should have the `head` style', () => {
    expect(container.firstChild).toHaveStyle(dayPickerProps.styles.head);
  });

  test('thead should have the `head` class', () => {
    expect(container.firstChild).toHaveClass(dayPickerProps.classNames.head);
  });
});

describe('when using a custom HeadRow component', () => {
  beforeEach(() => {
    setup({
      ...dayPickerProps,
      components: {
        HeadRow: () => (
          <tr>
            <td>custom head</td>
          </tr>
        )
      }
    });
  });

  test('should render the custom component', () => {
    expect(screen.getByText('custom head')).toBeInTheDocument();
  });
});
