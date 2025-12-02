import { screen } from '@testing-library/react';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render/customRender';

import { CustomComponents } from 'types/DayPickerBase';

import { Row, RowProps } from './Row';

function setup(props: RowProps, dayPickerProps?: DayPickerProps) {
  customRender(<Row {...props} />, dayPickerProps);
}

const props: RowProps = {
  displayMonth: new Date(2020, 1),
  weekNumber: 4,
  dates: [new Date(2020, 1, 1), new Date(2020, 1, 2), new Date(2020, 1, 3)]
};

describe('when "showWeekNumber" is set', () => {
  const dayPickerProps = {
    showWeekNumber: true,
    classNames: { cell: 'cell' },
    styles: { cell: { background: 'red' } }
  };
  beforeEach(() => {
    setup(props, dayPickerProps);
  });
  test('should display the cell with the week number', () => {
    const cell = screen.getByRole('cell', { name: `${props.weekNumber}` });
    expect(cell).toBeInTheDocument();
  });
  test('the cell should have the "cell" class name', () => {
    const cell = screen.getByRole('cell', { name: `${props.weekNumber}` });
    expect(cell).toHaveClass(dayPickerProps.classNames.cell);
  });
  test('the cell should have the "cell" style', () => {
    const cell = screen.getByRole('cell', { name: `${props.weekNumber}` });
    expect(cell).toHaveStyle(dayPickerProps.styles.cell);
  });
});

describe('when using a custom Day component', () => {
  const components: CustomComponents = {
    Day: () => <div>CustomDay</div>
  };
  const dayPickerProps = { components };
  beforeEach(() => {
    setup(props, dayPickerProps);
  });
  test('it should render the custom component instead', () => {
    expect(screen.getAllByText('CustomDay')).toHaveLength(props.dates.length);
  });
});

describe('when using a custom WeekNumber component', () => {
  const components: CustomComponents = {
    WeekNumber: () => <div>WeekNumber</div>
  };
  const dayPickerProps: DayPickerProps = { components, showWeekNumber: true };
  beforeEach(() => {
    setup(props, dayPickerProps);
  });
  test('it should render the custom component instead', () => {
    expect(screen.getByText('WeekNumber')).toBeInTheDocument();
  });
});
