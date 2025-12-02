import { matcherToArray } from 'contexts/Modifiers/utils/matcherToArray';
import { Matcher } from 'types/Matchers';

const matcher: Matcher = jest.fn();

describe('when a Matcher is passed in', () => {
  test('should return an array with the Matcher', () => {
    expect(matcherToArray(matcher)).toStrictEqual([matcher]);
  });
});

describe('when an array of Matchers is passed in', () => {
  test('should return a copy of the array', () => {
    const value = [matcher, matcher];
    const result = matcherToArray(value);
    expect(result).toStrictEqual(value);
    expect(result).not.toBe(value);
  });
});

describe('when undefined is passed in', () => {
  test('should return an empty array', () => {
    expect(matcherToArray(undefined)).toStrictEqual([]);
  });
});
