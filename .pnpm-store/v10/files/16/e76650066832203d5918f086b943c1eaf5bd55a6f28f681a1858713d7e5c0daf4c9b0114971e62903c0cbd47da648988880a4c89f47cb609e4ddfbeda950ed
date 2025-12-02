import getVersionRangeType from "./";

test.each([
  ["^1.0.0", "^"],
  ["~1.0.0", "~"],
  [">=1.0.0", ">="],
  ["<=1.0.0", "<="],
  [">1.0.0", ">"],
  ["1.0.0", ""],
])('getVersionRangeType should return "%s" if passed "%s"', (input, output) => {
  expect(getVersionRangeType(input)).toEqual(output);
});
