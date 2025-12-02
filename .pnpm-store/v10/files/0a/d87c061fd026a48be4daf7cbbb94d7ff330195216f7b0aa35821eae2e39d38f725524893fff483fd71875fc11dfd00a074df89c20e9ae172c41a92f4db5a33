import { es } from 'date-fns/locale';

import { formatWeekdayName } from './formatWeekdayName';

const date = new Date(2022, 10, 21);

test('should return the formatted weekday name', () => {
  expect(formatWeekdayName(date)).toEqual('Mo');
});

describe('when a locale is passed in', () => {
  test('should format using the locale', () => {
    expect(formatWeekdayName(date, { locale: es })).toEqual('lu');
  });
});
