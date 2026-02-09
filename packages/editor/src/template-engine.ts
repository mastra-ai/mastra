/**
 * TemplateEngine: Simple variable interpolation for prompt block content.
 *
 * Supports:
 *   {{variableName}}         - Direct variable substitution
 *   {{nested.path.value}}    - Dot-notation path resolution
 *   {{variable || 'default'}} - Fallback values (single or double quotes)
 *
 * Variables that cannot be resolved (and have no fallback) are left as-is.
 */

/**
 * Resolves a dot-notation path against a context object.
 * Returns undefined if any segment is missing.
 */
function resolvePath(context: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = context;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Pattern that matches:
 *   {{variableName}}
 *   {{nested.path}}
 *   {{variable || 'fallback'}}
 *   {{variable || "fallback"}}
 *
 * Captures:
 *   Group 1: the variable path (trimmed)
 *   Group 2 (optional): the fallback value (without quotes)
 */
const TEMPLATE_PATTERN = /\{\{\s*([a-zA-Z_][\w.]*)\s*(?:\|\|\s*(?:'([^']*)'|"([^"]*)")\s*)?\}\}/g;

/**
 * Renders a template string by interpolating variables from the given context.
 *
 * @param template - The template string with {{variable}} placeholders
 * @param context - A key-value context object for variable resolution
 * @returns The rendered string with variables replaced
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(
    TEMPLATE_PATTERN,
    (match, variablePath: string, singleFallback?: string, doubleFallback?: string) => {
      const resolved = resolvePath(context, variablePath);

      if (resolved !== undefined && resolved !== null) {
        return String(resolved);
      }

      // Use fallback if provided
      const fallback = singleFallback ?? doubleFallback;
      if (fallback !== undefined) {
        return fallback;
      }

      // Leave unresolved variables as-is
      return match;
    },
  );
}
