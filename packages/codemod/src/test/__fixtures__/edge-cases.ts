/**
 * This file contains code snippets that triggered codemod errors and that should not be transformed.
 */

const toStringOne = `
const providers = {
  cursor: {
    title: "Open in Cursor",
    createUrl: (text: string) => {
      const url = new URL("https://cursor.com/link/prompt");
      url.searchParams.set("text", text);
      return url.toString();
    },
  },
};
`.trim()

const toStringTwo = `
function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}
`.trim()

export const EDGE_CASES_FIXTURES: { name: string; code: string }[] = [
  { name: 'to-string-one', code: toStringOne },
  { name: 'to-string-two', code: toStringTwo },
];