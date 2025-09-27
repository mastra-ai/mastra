import type { MastraAuthConfig } from '@mastra/core/server';
import type { HonoRequest } from 'hono';
import { defaultAuthConfig } from './defaults';

export const isDevPlaygroundRequest = (req: HonoRequest): boolean => {
  return req.header('x-mastra-dev-playground') === 'true' && process.env.MASTRA_DEV === 'true';
};

export const isCustomRoutePublic = (
  path: string,
  method: string,
  customRouteAuthConfig?: Map<string, boolean>,
): boolean => {
  if (!customRouteAuthConfig) {
    return false;
  }

  // Check exact match first
  const routeKey = `${method}:${path}`;
  if (customRouteAuthConfig.has(routeKey)) {
    return !customRouteAuthConfig.get(routeKey); // Return true if requiresAuth is false
  }

  // Check ALL method
  const allRouteKey = `ALL:${path}`;
  if (customRouteAuthConfig.has(allRouteKey)) {
    return !customRouteAuthConfig.get(allRouteKey);
  }

  return false;
};

export const isProtectedPath = (path: string, method: string, authConfig: MastraAuthConfig): boolean => {
  const protectedAccess = [...(defaultAuthConfig.protected || []), ...(authConfig.protected || [])];
  return isAnyMatch(path, method, protectedAccess);
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
  // Simple pattern matching that supports wildcards
  // e.g., '/api/agents/*' matches '/api/agents/123'
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }
  return path === pattern;
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
