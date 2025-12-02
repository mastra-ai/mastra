import { addMonths, isSameMonth } from 'date-fns';

import { getPreviousMonth } from './getPreviousMonth';

const startingMonth = new Date(2020, 4, 31);

describe('when number of months is 1', () => {
  describe('when the navigation is disabled', () => {
    const disableNavigation = true;
    it('the previous month is undefined', () => {
      const result = getPreviousMonth(startingMonth, { disableNavigation });
      expect(result).toBe(undefined);
    });
  });
  describe('when in the navigable range', () => {
    const fromDate = addMonths(startingMonth, -3);
    it('the previous month is not undefined', () => {
      const result = getPreviousMonth(startingMonth, { fromDate });
      const expectedPrevMonth = addMonths(startingMonth, -1);
      expect(result && isSameMonth(result, expectedPrevMonth)).toBeTruthy();
    });
  });
  describe('when not in the navigable range', () => {
    const fromDate = startingMonth;
    it('the previous month is undefined', () => {
      const result = getPreviousMonth(startingMonth, { fromDate });
      expect(result).toBe(undefined);
    });
  });
});
describe('when displaying 3 months', () => {
  const numberOfMonths = 3;
  describe('when the navigation is paged', () => {
    const pagedNavigation = true;
    it('the previous month is 3 months back', () => {
      const result = getPreviousMonth(startingMonth, {
        numberOfMonths,
        pagedNavigation
      });
      const expectedPrevMonth = addMonths(startingMonth, -numberOfMonths);
      expect(result && isSameMonth(result, expectedPrevMonth)).toBeTruthy();
    });
  });
  describe('when the navigation is not paged', () => {
    const pagedNavigation = false;
    it('the previous month is 1 months back', () => {
      const result = getPreviousMonth(startingMonth, {
        numberOfMonths,
        pagedNavigation
      });
      const expectedPrevMonth = addMonths(startingMonth, -1);
      expect(result && isSameMonth(result, expectedPrevMonth)).toBeTruthy();
    });
  });
});
