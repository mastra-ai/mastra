import { es } from 'date-fns/locale';

import { freezeBeforeAll } from 'test/utils';

import { getWeekdays } from './getWeekdays';

const today = new Date(2022, 1, 12);
const prevSunday = new Date(2022, 1, 6);
const prevMonday = new Date(2022, 1, 7);

freezeBeforeAll(today);

let result: Date[];

describe('when rendered without a locale', () => {
  beforeEach(() => {
    result = getWeekdays();
  });
  test('should return 7 days', () => {
    expect(result).toHaveLength(7);
  });
  test('should return Sunday as first day', () => {
    expect(result[0]).toEqual(prevSunday);
  });
});

describe.each<0 | 1 | 2 | 3 | 4 | 5 | 6>([0, 1, 2, 3, 4, 5, 6])(
  'when week start on %s',
  (weekStartsOn) => {
    beforeEach(() => {
      result = getWeekdays(es, weekStartsOn);
    });
    test('the first date should be weekStartsOn', () => {
      expect(result[0].getDay()).toBe(weekStartsOn);
    });
  }
);

describe('when using ISO week', () => {
  beforeEach(() => {
    result = getWeekdays(es, 3, true);
  });
  test('should return Monday as first day', () => {
    expect(result[0]).toEqual(prevMonday);
  });
});
