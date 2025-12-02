import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render/customRender';
import { freezeBeforeAll } from 'test/utils';

import { FooterProps } from 'components/Footer';

import { Table, TableProps } from './Table';

function setup(props: TableProps, dayPickerProps?: DayPickerProps) {
  return customRender(<Table {...props} />, dayPickerProps);
}

const today = new Date(2021, 11, 8);
freezeBeforeAll(today);

const props: TableProps = {
  displayMonth: new Date(2020, 1)
};

test('should render correctly', () => {
  const { container } = setup(props);
  expect(container.firstChild).toMatchSnapshot();
});

describe('when showing the week numbers', () => {
  const dayPickerProps = { showWeekNumber: true };
  test('should render correctly', () => {
    const { container } = setup(props, dayPickerProps);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('when using custom components', () => {
  const dayPickerProps: DayPickerProps = {
    components: {
      Head: () => (
        <thead>
          <tr>
            <td>CustomHead</td>
          </tr>
        </thead>
      ),
      Row: () => (
        <tr>
          <td>CustomRow</td>
        </tr>
      ),
      Footer: (props: FooterProps) => (
        <tfoot>
          <tr>
            <td>{props.displayMonth?.toDateString()}</td>
          </tr>
        </tfoot>
      )
    }
  };
  test('should render correctly', () => {
    const { container } = setup(props, dayPickerProps);
    expect(container.firstChild).toMatchSnapshot();
  });
});
