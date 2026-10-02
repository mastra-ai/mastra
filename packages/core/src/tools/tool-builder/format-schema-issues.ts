/**
 * Format Standard Schema validation issues into a single human-readable string that preserves
 * the field path of every issue.
 *
 * The previous implementation joined only `issue.message` with ", ", which collapsed messages
 * like `expected array, received string` into an unordered blob and dropped the path. For MCP
 * tool calls that reach a nested schema, that made self-correction by tool-calling agents
 * essentially impossible — the agent could see what was wrong but not where. This helper
 * renders each issue as `path: message` so the result reads like:
 *
 *   Tool validation failed:
 *   - items[0].tags: expected array, received string
 *   - options.destination: expected string, received undefined
 */

type PathSegment = PropertyKey | { readonly key: PropertyKey };

export type StandardSchemaIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PathSegment> | undefined;
};

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function segmentKey(segment: PathSegment): PropertyKey {
  if (typeof segment === 'object' && segment !== null && 'key' in segment) {
    return segment.key;
  }
  return segment;
}

function formatSegment(segment: PathSegment, isFirst: boolean): string {
  const key = segmentKey(segment);
  if (typeof key === 'number') {
    return `[${key}]`;
  }
  if (typeof key === 'symbol') {
    return `[${String(key)}]`;
  }
  if (IDENTIFIER_PATTERN.test(key)) {
    return isFirst ? key : `.${key}`;
  }
  return `[${JSON.stringify(key)}]`;
}

export function formatStandardSchemaPath(path: ReadonlyArray<PathSegment> | undefined): string {
  if (!path || path.length === 0) {
    return '';
  }
  return path.map((segment, index) => formatSegment(segment, index === 0)).join('');
}

export function formatStandardSchemaIssues(issues: ReadonlyArray<StandardSchemaIssue>): string {
  const lines = issues.map(issue => {
    const path = formatStandardSchemaPath(issue.path);
    const message = issue.message || 'invalid input';
    return path ? `- ${path}: ${message}` : `- ${message}`;
  });
  return ['Tool validation failed:', ...lines].join('\n');
}
