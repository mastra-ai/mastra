import { screen } from '@testing-library/react';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { CustomComponents } from 'types/DayPickerBase';

import { Day, DayProps } from './Day';

const today = new Date(2021, 8);

freezeBeforeAll(today);

const date = today;
const displayMonth = today;
const props: DayProps = {
  date: date,
  displayMonth
};

describe('when the day to render has an hidden modifier', () => {
  const dayPickerProps: DayPickerProps = {
    modifiers: { hidden: date }
  };
  beforeEach(() => {
    customRender(<Day {...props} />, dayPickerProps);
  });
  test('should render an empty grid cell', () => {
    const cell = screen.getByRole('gridcell');
    expect(cell).toBeEmptyDOMElement();
  });
});
describe('when a no selection mode and no "onDayClick"', () => {
  const dayPickerProps: DayPickerProps = { mode: 'default' };
  beforeEach(() => {
    customRender(<Day {...props} />, dayPickerProps);
  });
  test('should render a div', () => {
    const cell = screen.getByRole('gridcell');
    expect(cell.nodeName).toBe('DIV');
  });
});

describe('when a selection mode is set', () => {
  const dayPickerProps: DayPickerProps = {
    mode: 'single'
  };
  beforeEach(() => {
    customRender(<Day {...props} />, dayPickerProps);
  });
  test('should render a button named "day"', () => {
    const cell = screen.getByRole('gridcell');
    expect(cell.nodeName).toBe('BUTTON');
    expect(cell).toHaveAttribute('name', 'day');
  });
});

describe('when "onDayClick" is present', () => {
  const dayPickerProps: DayPickerProps = {
    onDayClick: jest.fn()
  };
  beforeEach(() => {
    customRender(<Day {...props} />, dayPickerProps);
  });
  test('should render a button', () => {
    const cell = screen.getByRole('gridcell');
    expect(cell.nodeName).toBe('BUTTON');
  });
});

describe('when using a custom DayContent component', () => {
  const components: CustomComponents = {
    DayContent: () => <>Custom DayContent</>
  };
  beforeEach(() => {
    customRender(<Day {...props} />, { components });
  });
  test('it should render the custom component instead', () => {
    expect(screen.getByText('Custom DayContent')).toBeInTheDocument();
  });
});
