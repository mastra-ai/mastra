import { screen } from '@testing-library/react';
import { addMonths, differenceInYears } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import { user } from 'test/user';
import { freezeBeforeAll } from 'test/utils';

import { YearsDropdown, YearsDropdownProps } from './YearsDropdown';

const today = new Date(2020, 12, 22);

freezeBeforeAll(today);

let root: HTMLDivElement;
let options: HTMLCollectionOf<HTMLOptionElement> | undefined;
let select: HTMLSelectElement | null;

function setup(props: YearsDropdownProps, dayPickerProps?: DayPickerProps) {
  const view = customRender(<YearsDropdown {...props} />, dayPickerProps);
  root = view.container.firstChild as HTMLDivElement;
  select = screen.queryByRole('combobox', { name: 'Year:' });
  options = select?.getElementsByTagName('option');
}

const props: YearsDropdownProps = {
  displayMonth: today,
  onChange: jest.fn()
};

describe('when fromDate and toDate are passed in', () => {
  beforeEach(() => {
    setup(props, { fromDate: new Date(), toDate: addMonths(new Date(), 1) });
  });
  test('should render the dropdown element', () => {
    expect(root).toMatchSnapshot();
    expect(select).toHaveAttribute('name', 'years');
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
    expect(select).toBeInTheDocument();
    expect(options).toHaveLength(differenceInYears(toDate, fromDate) + 1);
  });
  test('the month should be the same month', () => {
    expect(options?.[0]).toHaveValue(`${fromDate.getFullYear()}`);
  });
});

describe('when "fromDate" and "toDate" are not in the same year', () => {
  const fromDate = new Date(2012, 0, 22);
  const toDate = new Date(2015, 10, 22);
  const displayMonth = new Date(2013, 7, 0);
  beforeEach(() => {
    setup({ ...props, displayMonth }, { fromDate, toDate });
  });
  test('should display the full years', () => {
    expect(options).toHaveLength(differenceInYears(toDate, fromDate) + 1);
  });
  test('the first option should be fromDates year', () => {
    expect(options?.[0]).toHaveValue(`${fromDate.getFullYear()}`);
  });
  test('the last option should be "toDate"s year', () => {
    expect(options?.[options.length - 1]).toHaveValue(
      `${toDate.getFullYear()}`
    );
  });
  test('should select the displayed year', () => {
    expect(select).toHaveValue(`${displayMonth.getFullYear()}`);
  });

  describe('when the dropdown changes', () => {
    const newYear = fromDate.getFullYear();
    beforeEach(async () => {
      if (select) await user.selectOptions(select, `${newYear}`);
    });
    test('should fire the "onChange" event handler', () => {
      const expectedYear = new Date(newYear, displayMonth.getMonth(), 1);
      expect(props.onChange).toHaveBeenCalledWith(expectedYear);
    });
  });
});
