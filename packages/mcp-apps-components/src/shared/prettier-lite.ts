/**
 * Stands in for prettier in MCP Apps (see `scripts/build-apps.ts`): Studio's code editor only pretty-prints JSON
 * there, which doesn't need prettier's ~700 KB parser. Other code is shown as it is.
 */
export async function format(code: string, options: { parser?: string }): Promise<string> {
  if (options.parser !== 'json') return code;
  return JSON.stringify(JSON.parse(code), null, 2);
}

export default {};
