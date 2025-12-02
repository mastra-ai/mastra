export function header(oneLineDescription: string) {
  return `/* eslint-disable */
  /**
   * ${oneLineDescription}
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run \`npx convex dev\`.
   * @module
   */
  `;
}

export function apiComment(
  apiName: string,
  type: "public" | "internal" | undefined,
) {
  return `
  /**
     * A utility for referencing Convex functions in your app's${type ? ` ${type}` : ""} API.
     *
     * Usage:
     * \`\`\`js
     * const myFunctionReference = ${apiName}.myModule.myFunction;
     * \`\`\`
     */`;
}

/**
 * Comparison function for sorting strings alphabetically.
 * Uses localeCompare for consistent, locale-aware sorting.
 *
 * Usage: array.sort(compareStrings)
 * or with entries: Object.entries(obj).sort(([a], [b]) => compareStrings(a, b))
 */
export function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}
