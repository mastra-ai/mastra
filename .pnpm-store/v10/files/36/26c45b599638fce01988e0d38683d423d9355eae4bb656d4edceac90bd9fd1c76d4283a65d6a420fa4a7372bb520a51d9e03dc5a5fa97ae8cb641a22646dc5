import { es } from 'date-fns/locale';

import { formatMonthCaption } from './formatMonthCaption';

const date = new Date(2022, 10, 21);

test('should return the formatted month caption', () => {
  expect(formatMonthCaption(date)).toEqual('November');
});

describe('when a locale is passed in', () => {
  test('should format using the locale', () => {
    expect(formatMonthCaption(date, { locale: es })).toEqual('noviembre');
  });
});
