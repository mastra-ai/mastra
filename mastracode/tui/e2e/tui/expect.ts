type VisibleLocator = {
  searchTerm: () => string | RegExp;
  resolve: (timeout: number, isNot?: boolean) => Promise<unknown | null>;
};

type Matchers = {
  not: Matchers;
  toBeGreaterThan: (expected: number) => void;
  toBeVisible: (options?: { timeout?: number }) => Promise<void>;
  toContain: (expected: unknown) => void;
  toHaveLength: (expected: number) => void;
  toMatch: (expected: RegExp | string) => void;
};

function fail(message: string): never {
  throw new Error(message);
}

function format(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createMatchers(actual: unknown, isNot = false): Matchers {
  const assert = (pass: boolean, message: string) => {
    if (isNot ? pass : !pass) fail(message);
  };

  return {
    get not() {
      return createMatchers(actual, !isNot);
    },
    toBeGreaterThan(expected: number) {
      assert(
        typeof actual === 'number' && actual > expected,
        `expected ${format(actual)} ${isNot ? 'not ' : ''}to be greater than ${expected}`,
      );
    },
    async toBeVisible(options?: { timeout?: number }) {
      const locator = actual as VisibleLocator;
      const result = await locator.resolve(options?.timeout ?? 20_000, isNot);
      assert(result != null, `expected ${locator.searchTerm().toString()} ${isNot ? 'not ' : ''}to be visible`);
    },
    toContain(expected: unknown) {
      const pass =
        typeof actual === 'string'
          ? actual.includes(String(expected))
          : Array.isArray(actual)
            ? actual.includes(expected)
            : false;
      assert(pass, `expected ${format(actual)} ${isNot ? 'not ' : ''}to contain ${format(expected)}`);
    },
    toHaveLength(expected: number) {
      const actualLength = (actual as { length?: unknown })?.length;
      assert(
        actualLength === expected,
        `expected ${format(actual)} ${isNot ? 'not ' : ''}to have length ${expected}, got ${String(actualLength)}`,
      );
    },
    toMatch(expected: RegExp | string) {
      const actualText = String(actual);
      const pass = typeof expected === 'string' ? actualText.includes(expected) : expected.test(actualText);
      assert(pass, `expected ${format(actualText)} ${isNot ? 'not ' : ''}to match ${expected.toString()}`);
    },
  };
}

export function expect(actual: unknown): Matchers {
  return createMatchers(actual);
}
