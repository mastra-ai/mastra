import { addMonths, isSameMonth } from 'date-fns';

import { getInitialMonth } from './getInitialMonth';

describe('when no toDate is given', () => {
  describe('when month is in context', () => {
    const month = new Date(2010, 11, 12);
    it('return that month', () => {
      const initialMonth = getInitialMonth({ month });
      expect(isSameMonth(initialMonth, month)).toBe(true);
    });
  });
  describe('when defaultMonth is in context', () => {
    const defaultMonth = new Date(2010, 11, 12);
    it('return that month', () => {
      const initialMonth = getInitialMonth({ defaultMonth });
      expect(isSameMonth(initialMonth, defaultMonth)).toBe(true);
    });
  });
  describe('when no month or defaultMonth are in context', () => {
    const today = new Date(2010, 11, 12);
    it('return the today month', () => {
      const initialMonth = getInitialMonth({ today });
      expect(isSameMonth(initialMonth, today)).toBe(true);
    });
  });
});
describe('when toDate is given', () => {
  describe('when toDate is before the default initial date', () => {
    const month = new Date(2010, 11, 12);
    const toDate = addMonths(month, -2);
    describe('when the number of month is 1', () => {
      const numberOfMonths = 1;
      it('return the toDate', () => {
        const initialMonth = getInitialMonth({
          month,
          toDate,
          numberOfMonths
        });
        expect(isSameMonth(initialMonth, toDate)).toBe(true);
      });
    });
    describe('when the number of month is 3', () => {
      const numberOfMonths = 3;
      it('return the toDate plus the number of months', () => {
        const initialMonth = getInitialMonth({
          month,
          toDate,
          numberOfMonths
        });
        const expectedMonth = addMonths(toDate, -1 * (numberOfMonths - 1));
        expect(isSameMonth(initialMonth, expectedMonth)).toBe(true);
      });
    });
  });
});
