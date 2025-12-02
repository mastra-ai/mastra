import { addDays, subDays } from 'date-fns';

import { DateRange } from 'types/Matchers';

import { addToRange } from './addToRange';

describe('when no "from" is the range', () => {
  const range = { from: undefined };
  const day = new Date();
  let result: DateRange | undefined;
  beforeAll(() => {
    result = addToRange(day, range);
  });
  test('should set "from" as the given day', () => {
    expect(result).toEqual({ from: day, to: undefined });
  });
});

describe('when no "to" is the range', () => {
  const day = new Date();
  const range = { from: day, to: undefined };
  describe('and the day is the same as the "from" day', () => {
    let result: DateRange | undefined;
    beforeAll(() => {
      result = addToRange(day, range);
    });
    test('should return it in the range', () => {
      expect(result).toEqual({ from: day, to: day });
    });
  });
  describe('and the day is before "from" day', () => {
    const day = subDays(range.from, 1);
    let result: DateRange | undefined;
    beforeAll(() => {
      result = addToRange(day, range);
    });
    test('should set the day as the "from" range', () => {
      expect(result).toEqual({ from: day, to: range.from });
    });
  });
  describe('and the day is after the "from" day', () => {
    const day = addDays(range.from, 1);
    let result: DateRange | undefined;
    beforeAll(() => {
      result = addToRange(day, range);
    });
    test('should set the day as the "to" date', () => {
      expect(result).toEqual({ from: range.from, to: day });
    });
  });
});

describe('when "from", "to" and "day" are the same', () => {
  const day = new Date();
  const range = { from: day, to: day };
  let result: DateRange | undefined;
  beforeAll(() => {
    result = addToRange(day, range);
  });
  test('should return an undefined range (reset)', () => {
    expect(result).toBeUndefined();
  });
});

describe('when "to" and "day" are the same', () => {
  const from = new Date();
  const to = addDays(from, 4);
  const day = to;
  const range = { from, to };
  let result: DateRange | undefined;
  beforeAll(() => {
    result = addToRange(day, range);
  });
  test('should set "to" to undefined', () => {
    expect(result).toEqual({ from: to, to: undefined });
  });
});

describe('when "from" and "day" are the same', () => {
  const from = new Date();
  const to = addDays(from, 4);
  const day = from;
  const range = { from, to };
  let result: DateRange | undefined;
  beforeAll(() => {
    result = addToRange(day, range);
  });
  test('should return an undefined range (reset)', () => {
    expect(result).toBeUndefined();
  });
});

describe('when "from" is after "day"', () => {
  const day = new Date();
  const from = addDays(day, 1);
  const to = addDays(from, 4);
  const range = { from, to };
  let result: DateRange | undefined;
  beforeAll(() => {
    result = addToRange(day, range);
  });
  test('should set the day as "from"', () => {
    expect(result).toEqual({ from: day, to: range.to });
  });
});

describe('when "from" is before "day"', () => {
  const day = new Date();
  const from = subDays(day, 1);
  const to = addDays(from, 4);
  const range = { from, to };
  let result: DateRange | undefined;
  beforeAll(() => {
    result = addToRange(day, range);
  });
  test('should set the day as "to"', () => {
    expect(result).toEqual({ from: range.from, to: day });
  });
});
