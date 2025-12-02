import { screen } from '@testing-library/react';
import { setMonth, setYear } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import {
  getMonthDropdown,
  getYearDropdown,
  queryMonthDropdown,
  queryYearDropdown
} from 'test/selectors';
import { user } from 'test/user';
import { freezeBeforeAll } from 'test/utils';

import { CaptionProps } from 'components/Caption';
import { CustomComponents } from 'types/DayPickerBase';

import { CaptionDropdowns } from './CaptionDropdowns';

const today = new Date(2021, 8);
const fromYear = 2020;
const toYear = 2025;

freezeBeforeAll(today);

function setup(props: CaptionProps, dayPickerProps?: DayPickerProps) {
  customRender(<CaptionDropdowns {...props} />, dayPickerProps);
}

describe('when using a custom CaptionLabel component', () => {
  const components: CustomComponents = {
    CaptionLabel: () => <>custom label foo</>
  };
  const props = { displayMonth: today };
  beforeEach(() => {
    setup(props, { components });
  });
  test('it should render the custom component instead', () => {
    expect(screen.getByText('custom label foo')).toBeInTheDocument();
  });
});

describe('when rendered with custom styles or classnames', () => {
  let container: HTMLElement;

  beforeEach(() => {
    const dayPickerProps: DayPickerProps = {
      captionLayout: 'dropdown',
      fromYear,
      toYear,
      classNames: { caption_dropdowns: 'foo_dropdowns' },
      styles: { caption_dropdowns: { color: 'red' } }
    };
    const view = customRender(
      <CaptionDropdowns displayMonth={today} />,
      dayPickerProps
    );
    container = view.container;
  });
  test('should use the `caption_dropdowns` class name', () => {
    expect(container.firstChild).toHaveClass('foo_dropdowns');
  });
  test('should use the `caption_dropdowns` style', () => {
    expect(container.firstChild).toHaveStyle({ color: 'red' });
  });
  test('should render the month drop-down', () => {
    expect(getMonthDropdown()).toBeInTheDocument();
  });
  test('should render the year drop-down', () => {
    expect(getYearDropdown()).toBeInTheDocument();
  });
});

describe('when a month is selected', () => {
  const dayPickerProps: DayPickerProps = {
    captionLayout: 'dropdown',
    fromYear,
    toYear,
    onMonthChange: jest.fn()
  };
  beforeEach(() => {
    customRender(<CaptionDropdowns displayMonth={today} />, dayPickerProps);
  });
  describe('from the months drop-down', () => {
    const newMonth = setMonth(today, 0);
    beforeEach(async () => {
      await user.selectOptions(
        getMonthDropdown(),
        newMonth.getMonth().toString()
      );
    });
    test('should call the `onMonthChange` callback', () => {
      expect(dayPickerProps.onMonthChange).toHaveBeenCalledWith(newMonth);
    });
  });
  describe('from the years drop-down', () => {
    const newYear = setYear(today, 2022);
    beforeEach(async () => {
      await user.selectOptions(
        getYearDropdown(),
        newYear.getFullYear().toString()
      );
    });
    test('should call the `onMonthChange` callback', () => {
      expect(dayPickerProps.onMonthChange).toHaveBeenCalledWith(newYear);
    });
  });
});

describe('when no date limits are set', () => {
  const dayPickerProps: DayPickerProps = {
    captionLayout: 'dropdown'
  };
  beforeEach(() => {
    customRender(<CaptionDropdowns displayMonth={today} />, dayPickerProps);
  });
  test('should not render the drop-downs', () => {
    expect(queryMonthDropdown()).toBeNull();
    expect(queryYearDropdown()).toBeNull();
  });
});
