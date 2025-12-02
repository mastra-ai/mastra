import { es } from 'date-fns/locale';

import { labelWeekday } from './labelWeekday';

const weekDay = new Date(2022, 10, 21);

test('should return the formatted weekday name', () => {
  expect(labelWeekday(weekDay)).toEqual('Monday');
});

describe('when a locale is passed in', () => {
  test('should format using the locale', () => {
    expect(labelWeekday(weekDay, { locale: es })).toEqual('lunes');
  });
});
