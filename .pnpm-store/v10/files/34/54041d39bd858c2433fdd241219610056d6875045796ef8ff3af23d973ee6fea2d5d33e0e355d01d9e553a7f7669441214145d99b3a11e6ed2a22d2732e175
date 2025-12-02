import { addDays } from 'date-fns';
import { DateRange } from 'index';

import { isDateInRange } from './isDateInRange';

const date = new Date();

describe('when range is missing the "from" date', () => {
  const range: DateRange = { from: undefined };
  const result = isDateInRange(date, range);
  test('should return false', () => {
    expect(result).toBe(false);
  });
});

describe('when range is missing the "to" date', () => {
  const result = isDateInRange(date, { from: date, to: undefined });
  test('should return true', () => {
    expect(result).toBe(true);
  });
});

describe('when the range dates are the same as date', () => {
  const range: DateRange = { from: date, to: date };
  const result = isDateInRange(date, range);
  test('should return true', () => {
    expect(result).toBe(true);
  });
});

describe('when the range dates are the same but not as date', () => {
  const range: DateRange = { from: date, to: date };
  const result = isDateInRange(addDays(date, 1), range);
  test('should return false', () => {
    expect(result).toBe(false);
  });
});

describe('when the range is inverted', () => {
  const range: DateRange = { from: addDays(date, 1), to: date };
  const result = isDateInRange(date, range);
  test('should return true', () => {
    expect(result).toBe(true);
  });
});
