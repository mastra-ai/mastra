import { parseFromToProps } from 'contexts/DayPicker/utils';

describe('when "fromMonth" is passed in', () => {
  const fromMonth = new Date(2021, 4, 3);
  const expectedFromDate = new Date(2021, 4, 1);
  const { fromDate } = parseFromToProps({ fromMonth });
  test('"fromDate" should be the start of that month', () => {
    expect(fromDate).toEqual(expectedFromDate);
  });
  describe('when "fromYear" is passed in', () => {
    test('"fromDate" should be the start of that month', () => {
      expect(fromDate).toEqual(expectedFromDate);
    });
  });
});

describe('when "fromYear" is passed in', () => {
  const fromYear = 2021;
  const expectedFromDate = new Date(2021, 0, 1);
  const { fromDate } = parseFromToProps({ fromYear });
  test('"fromDate" should be the start of that year', () => {
    expect(fromDate).toEqual(expectedFromDate);
  });
});

describe('when "toMonth" is passed in', () => {
  const toMonth = new Date(2021, 4, 3);
  const expectedToDate = new Date(2021, 4, 31);
  const { toDate } = parseFromToProps({ toMonth });
  test('"toDate" should be the end of that month', () => {
    expect(toDate).toEqual(expectedToDate);
  });
  describe('when "fromYear" is passed in', () => {
    test('"toDate" should be the end of that month', () => {
      expect(toDate).toEqual(expectedToDate);
    });
  });
});

describe('when "toYear" is passed in', () => {
  const toYear = 2021;
  const expectedToDate = new Date(2021, 11, 31);
  const { toDate } = parseFromToProps({ toYear });
  test('"toDate" should be the end of that year', () => {
    expect(toDate).toEqual(expectedToDate);
  });
});
