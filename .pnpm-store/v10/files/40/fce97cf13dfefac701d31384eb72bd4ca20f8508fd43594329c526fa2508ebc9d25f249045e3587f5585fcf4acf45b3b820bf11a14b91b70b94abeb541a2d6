"use strict";
export function header(oneLineDescription) {
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
export function apiComment(apiName, type) {
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
export function compareStrings(a, b) {
  return a.localeCompare(b);
}
//# sourceMappingURL=common.js.map
