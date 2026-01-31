import type { MastraAuthConfig } from '@mastra/core/server';

import { defaultAuthConfig } from './defaults';
import { parse } from './path-pattern';

/**
 * Check if request is from dev playground
 * @param getHeader - Function to get header value from request
 */
export const isDevPlaygroundRequest = (
  path: string,
  method: string,
  getHeader: (name: string) => string | undefined,
  authConfig: MastraAuthConfig,
): boolean => {
  const protectedAccess = [...(defaultAuthConfig.protected || []), ...(authConfig.protected || [])];
  return (
    process.env.MASTRA_DEV === 'true' &&
    (!isAnyMatch(path, method, protectedAccess) || getHeader('x-mastra-dev-playground') === 'true')
  );
};

export const isCustomRoutePublic = (
  path: string,
  method: string,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  if (!customRouteAuthConfig) {
    return false;
  }

  // Check exact match first (fast path for static routes)
  const exactRouteKey = `${method}:${path}`;
  if (customRouteAuthConfig.has(exactRouteKey)) {
    return !customRouteAuthConfig.get(exactRouteKey); // True when route opts out of auth
  }

  // Check exact match for ALL method
  const allRouteKey = `ALL:${path}`;
  if (customRouteAuthConfig.has(allRouteKey)) {
    return !customRouteAuthConfig.get(allRouteKey);
  }

  // Check pattern matches for dynamic routes (e.g., '/users/:id')
  for (const [routeKey, requiresAuth] of customRouteAuthConfig.entries()) {
    const colonIndex = routeKey.indexOf(':');
    if (colonIndex === -1) {
      continue; // Skip malformed keys
    }

    const routeMethod = routeKey.substring(0, colonIndex);
    const routePattern = routeKey.substring(colonIndex + 1);

    // Check if method matches (exact match or ALL)
    if (routeMethod !== method && routeMethod !== 'ALL') {
      continue;
    }

    // Check if path matches the pattern
    if (pathMatchesPattern(path, routePattern)) {
      return !requiresAuth; // True when route opts out of auth
    }
  }

  return false;
};

export const isProtectedPath = (
  path: string,
  method: string,
  authConfig: MastraAuthConfig,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  const protectedAccess = [...(defaultAuthConfig.protected || []), ...(authConfig.protected || [])];
  return isAnyMatch(path, method, protectedAccess) || !isCustomRoutePublic(path, method, customRouteAuthConfig);
};

export const canAccessPublicly = (path: string, method: string, authConfig: MastraAuthConfig): boolean => {
  // Check if this path+method combination is publicly accessible
  const publicAccess = [...(defaultAuthConfig.public || []), ...(authConfig.public || [])];

  return isAnyMatch(path, method, publicAccess);
};

const isAnyMatch = (
  path: string,
  method: string,
  patterns: MastraAuthConfig['protected'] | MastraAuthConfig['public'],
): boolean => {
  if (!patterns) {
    return false;
  }

  for (const patternPathOrMethod of patterns) {
    if (patternPathOrMethod instanceof RegExp) {
      if (patternPathOrMethod.test(path)) {
        return true;
      }
    }

    if (typeof patternPathOrMethod === 'string' && pathMatchesPattern(path, patternPathOrMethod)) {
      return true;
    }

    if (Array.isArray(patternPathOrMethod) && patternPathOrMethod.length === 2) {
      const [pattern, methodOrMethods] = patternPathOrMethod;
      if (pathMatchesPattern(path, pattern) && matchesOrIncludes(methodOrMethods, method)) {
        return true;
      }
    }
  }

  return false;
};

export const pathMatchesPattern = (path: string, pattern: string): boolean => {
  // Use regexparam for battle-tested path matching
  // Supports:
  // - Exact paths: '/api/users'
  // - Wildcards: '/api/agents/*' matches '/api/agents/123'
  // - Path parameters: '/users/:id' matches '/users/123'
  // - Optional parameters: '/users/:id?' matches '/users' and '/users/123'
  // - Mixed patterns: '/api/:version/users/:id/profile'
  const { pattern: regex } = parse(pattern);
  return regex.test(path);
};

export const pathMatchesRule = (path: string, rulePath: string | RegExp | string[] | undefined): boolean => {
  if (!rulePath) return true; // No path specified means all paths

  if (typeof rulePath === 'string') {
    return pathMatchesPattern(path, rulePath);
  }

  if (rulePath instanceof RegExp) {
    return rulePath.test(path);
  }

  if (Array.isArray(rulePath)) {
    return rulePath.some(p => pathMatchesPattern(path, p));
  }

  return false;
};

export const matchesOrIncludes = (values: string | string[], value: string): boolean => {
  if (typeof values === 'string') {
    return values === value;
  }

  if (Array.isArray(values)) {
    return values.includes(value);
  }

  return false;
};

// Check authorization rules
export const checkRules = async (
  rules: MastraAuthConfig['rules'],
  path: string,
  method: string,
  user: unknown,
): Promise<boolean> => {
  // Go through rules in order (first match wins)
  for (const i in rules || []) {
    const rule = rules?.[i]!;
    // Check if rule applies to this path
    if (!pathMatchesRule(path, rule.path)) {
      continue;
    }

    // Check if rule applies to this method
    if (rule.methods && !matchesOrIncludes(rule.methods, method)) {
      continue;
    }

    // Rule matches, check conditions
    const condition = rule.condition;
    if (typeof condition === 'function') {
      const allowed = await Promise.resolve()
        .then(() => condition(user))
        .catch(() => false);

      if (allowed) {
        return true;
      }
    } else if (rule.allow) {
      return true;
    }
  }

  // No matching rules, deny by default
  return false;
};
