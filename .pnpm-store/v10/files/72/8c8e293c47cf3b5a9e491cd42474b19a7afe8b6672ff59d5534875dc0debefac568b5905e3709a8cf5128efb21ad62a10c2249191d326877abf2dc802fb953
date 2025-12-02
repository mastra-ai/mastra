import { DayModifiers } from 'index';

import { getCustomModifiers } from './getCustomModifiers';

describe('when some modifiers are not an array', () => {
  const date = new Date();
  const dayModifiers: DayModifiers = {
    foo: date
  };
  const result = getCustomModifiers(dayModifiers);
  test('should return as array', () => {
    expect(result.foo).toEqual([date]);
  });
});
