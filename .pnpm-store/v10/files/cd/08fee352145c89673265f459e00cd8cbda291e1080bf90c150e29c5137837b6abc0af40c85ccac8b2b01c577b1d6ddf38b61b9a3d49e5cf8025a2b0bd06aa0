import { addMonths } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { customRender } from 'test/render';
import {
  getNextButton,
  getPrevButton,
  queryNextButton,
  queryPrevButton
} from 'test/selectors';
import { user } from 'test/user';
import { freezeBeforeAll } from 'test/utils';

import { CaptionNavigation } from './CaptionNavigation';

const today = new Date(2021, 8);

freezeBeforeAll(today);

describe('when rendered', () => {
  const dayPickerProps: DayPickerProps = {
    captionLayout: 'buttons'
  };
  test('should render the next month button', () => {
    customRender(<CaptionNavigation displayMonth={today} />, dayPickerProps);
    expect(getNextButton()).toBeInTheDocument();
  });
  test('should render the previous month button', () => {
    customRender(<CaptionNavigation displayMonth={today} />, dayPickerProps);
    expect(getPrevButton()).toBeInTheDocument();
  });

  describe('when displaying the first of multiple months', () => {
    const numberOfMonths = 3;
    beforeEach(() => {
      customRender(<CaptionNavigation displayMonth={today} />, {
        ...dayPickerProps,
        numberOfMonths
      });
    });
    test('should not display the next month button', () => {
      expect(queryNextButton()).toBeNull();
    });
    test('should show the previous month button', () => {
      expect(getPrevButton()).toBeInTheDocument();
    });
  });

  describe('when displaying the last of multiple months', () => {
    const numberOfMonths = 3;
    beforeEach(() => {
      const lastMonth = addMonths(today, numberOfMonths - 1);
      customRender(<CaptionNavigation displayMonth={lastMonth} />, {
        ...dayPickerProps,
        numberOfMonths
      });
    });
    test('should hide the previous month button', () => {
      expect(queryPrevButton()).toBeNull();
    });
    test('should show the next month button', () => {
      expect(getNextButton()).toBeInTheDocument();
    });
  });

  describe('when displaying a month in the middle of multiple months', () => {
    const numberOfMonths = 3;
    beforeEach(() => {
      const lastMonth = addMonths(today, numberOfMonths - 2);
      customRender(<CaptionNavigation displayMonth={lastMonth} />, {
        ...dayPickerProps,
        numberOfMonths
      });
    });
    test('should not render the previous month button', () => {
      expect(queryPrevButton()).toBeNull();
    });
    test('should not render the next month button', () => {
      expect(queryNextButton()).toBeNull();
    });
  });

  describe('when clicking the previous button', () => {
    describe('and a previous month is defined', () => {
      const testContext = {
        ...dayPickerProps,
        onMonthChange: jest.fn()
      };
      const previousMonth = addMonths(today, -1);
      beforeEach(async () => {
        customRender(<CaptionNavigation displayMonth={today} />, testContext);
        await user.click(getPrevButton());
      });
      test('should call the `onMonthChange` callback', () => {
        expect(testContext.onMonthChange).toHaveBeenCalledWith(previousMonth);
      });
    });
    describe('and the previous month is not defined', () => {
      const testContext = {
        ...dayPickerProps,
        fromDate: today,
        onMonthChange: jest.fn()
      };
      beforeEach(async () => {
        customRender(<CaptionNavigation displayMonth={today} />, testContext);
        await user.click(getPrevButton());
      });
      test('should call the `onMonthChange` callback', () => {
        expect(testContext.onMonthChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('when clicking the next month button', () => {
    describe('and the next month is defined', () => {
      const testContext = {
        ...dayPickerProps,
        onMonthChange: jest.fn()
      };
      const nextMonth = addMonths(today, 1);
      beforeEach(async () => {
        customRender(<CaptionNavigation displayMonth={today} />, testContext);
        await user.click(getNextButton());
      });
      test('should call the `onMonthChange` callback', () => {
        expect(testContext.onMonthChange).toHaveBeenCalledWith(nextMonth);
      });
    });
    describe('and the next month is not defined', () => {
      const testContext = {
        ...dayPickerProps,
        toDate: today,
        onMonthChange: jest.fn()
      };
      beforeEach(async () => {
        customRender(<CaptionNavigation displayMonth={today} />, testContext);
        await user.click(getNextButton());
      });
      test('should call the `onMonthChange` callback', () => {
        expect(testContext.onMonthChange).not.toHaveBeenCalled();
      });
    });
  });
});
