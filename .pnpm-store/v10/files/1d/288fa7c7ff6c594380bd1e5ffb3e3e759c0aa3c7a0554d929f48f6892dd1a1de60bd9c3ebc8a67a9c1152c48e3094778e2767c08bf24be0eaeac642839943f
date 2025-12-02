import { Autocomplete } from '@clerk/types';

type WithPathPatternWildcard<T = string> = `${T & string}(.*)`;
type PathPattern = Autocomplete<WithPathPatternWildcard>;
type PathMatcherParam = Array<RegExp | PathPattern> | RegExp | PathPattern;
/**
 * Creates a function that matches paths against a set of patterns.
 *
 * @param patterns - A string, RegExp, or array of patterns to match against
 * @returns A function that takes a pathname and returns true if it matches any of the patterns
 */
declare const createPathMatcher: (patterns: PathMatcherParam) => (pathname: string) => boolean;

export { type PathMatcherParam, type PathPattern, type WithPathPatternWildcard, createPathMatcher };
