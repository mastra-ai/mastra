export const roundToTwoDecimals = (num: number) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export function isCloserTo(value: number, target1: number, target2: number): boolean {
  return Math.abs(value - target1) < Math.abs(value - target2);
}

export type TestCase = {
  input: string;
  output: string;
  expectedResult: {
    score: number;
    reason?: string;
  };
};

export type TestCaseWithContext = TestCase & {
  context: string[];
};
