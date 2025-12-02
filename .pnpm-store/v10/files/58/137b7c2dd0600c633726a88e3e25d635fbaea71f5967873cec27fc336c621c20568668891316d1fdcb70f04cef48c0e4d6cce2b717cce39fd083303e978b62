import { Matcher } from 'types/Matchers';

/** Normalize to array a matcher input. */
export function matcherToArray(
  matcher: Matcher | Matcher[] | undefined
): Matcher[] {
  if (Array.isArray(matcher)) {
    return [...matcher];
  } else if (matcher !== undefined) {
    return [matcher];
  } else {
    return [];
  }
}
