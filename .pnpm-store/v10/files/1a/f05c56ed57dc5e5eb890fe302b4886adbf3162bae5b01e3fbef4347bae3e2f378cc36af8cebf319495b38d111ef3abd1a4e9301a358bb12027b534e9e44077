import { screen } from '@testing-library/react';
import { addMonths, differenceInMonths } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import { user } from 'test/user';
import { freezeBeforeAll } from 'test/utils';

import { MonthsDropdown, MonthsDropdownProps } from './MonthsDropdown';

const today = new Date(2020, 12, 22);

freezeBeforeAll(today);

let root: HTMLDivElement;
let options: HTMLCollectionOf<HTMLOptionElement> | undefined;
let select: HTMLSelectElement | null;

function setup(props: MonthsDropdownProps, dayPickerProps?: DayPickerProps) {
  const view = customRender(<MonthsDropdown {...props} />, dayPickerProps);
  root = view.container.firstChild as HTMLDivElement;
  select = screen.queryByRole('combobox', { name: 'Month:' });
  options = select?.getElementsByTagName('option');
}

const props: MonthsDropdownProps = {
  displayMonth: today,
  onChange: jest.fn()
};

describe('when fromDate and toDate are passed in', () => {
  beforeEach(() => {
    setup(props, { fromDate: new Date(), toDate: addMonths(new Date(), 1) });
  });
  test('should render the dropdown element', () => {
    expect(root).toMatchSnapshot();
    expect(select).toHaveAttribute('name', 'months');
  });
});

describe('when "fromDate" is not set', () => {
  beforeEach(() => {
    setup(props, { fromDate: undefined });
  });
  test('should return nothing', () => {
    expect(root).toBeNull();
  });
});

describe('when "toDate" is not set', () => {
  beforeEach(() => {
    setup(props, { toDate: undefined });
  });
  test('should return nothing', () => {
    expect(root).toBeNull();
  });
});

describe('when "fromDate" and "toDate" are in the same year', () => {
  const fromDate = new Date(2012, 0, 22);
  const toDate = new Date(2012, 10, 22);
  beforeEach(() => {
    setup(props, { fromDate, toDate });
  });
  test('should display the months included between the two dates', () => {
    expect(options).toHaveLength(differenceInMonths(toDate, fromDate) + 1);
  });
  test('the first month should be the fromDate month', () => {
    expect(options?.[0]).toHaveValue(String(fromDate.getMonth()));
  });
  test('the last month should be the toMonth month', () => {
    expect(options?.[options.length - 1]).toHaveValue(
      String(toDate.getMonth())
    );
  });
});

describe('when "fromDate" and "toDate" are not in the same year', () => {
  const fromDate = new Date(2012, 0, 22);
  const toDate = new Date(2015, 10, 22);
  const displayMonth = new Date(2015, 7, 0);
  beforeEach(() => {
    setup({ ...props, displayMonth }, { fromDate, toDate });
  });
  test('should display the 12 months', () => {
    expect(options).toHaveLength(12);
  });
  test('the first month should be January', () => {
    expect(options?.[0]).toHaveValue('0');
  });
  test('the last month should be December', () => {
    expect(options?.[options.length - 1]).toHaveValue('11');
  });
  test('should select the displayed month', () => {
    expect(select).toHaveValue(`${displayMonth.getMonth()}`);
  });

  describe('when the dropdown changes', () => {
    beforeEach(async () => {
      if (select) await user.selectOptions(select, 'February');
    });
    test('should fire the "onChange" event handler', () => {
      const expectedMonth = new Date(2015, 1, 1);
      expect(props.onChange).toHaveBeenCalledWith(expectedMonth);
    });
  });
});
