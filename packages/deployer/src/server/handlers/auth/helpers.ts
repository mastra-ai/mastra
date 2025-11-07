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

export const isProtectedPath = (
  path: string,
  method: string,
  authConfig: MastraAuthConfig,
  customRouteAuthConfig?: Map<string, boolean>,
  apiRootPath?: string,
): boolean => {
  const defaultProtected = (defaultAuthConfig.protected || []).map(pattern => {
    if (typeof pattern === 'string' && pattern.startsWith('/api/')) {
      return pattern.replace('/api/', `${apiRootPath || '/api'}/`);
    }
    if (typeof pattern === 'string' && pattern === '/api') {
      return apiRootPath || '/api';
    }
    return pattern;
  });

  const protectedAccess = [...defaultProtected, ...(authConfig.protected || [])];
  return isAnyMatch(path, method, protectedAccess) || !isCustomRoutePublic(path, method, customRouteAuthConfig);
};

export const canAccessPublicly = (path: string, method: string, authConfig: MastraAuthConfig, apiRootPath?: string): boolean => {
  // Check if this path+method combination is publicly accessible
  const defaultPublic = (defaultAuthConfig.public || []).map(pattern => {
    if (typeof pattern === 'string' && pattern.startsWith('/api/')) {
      return pattern.replace('/api/', `${apiRootPath || '/api'}/`);
    }
    if (typeof pattern === 'string' && pattern === '/api') {
      return apiRootPath || '/api';
    }
    return pattern;
  });

  const publicAccess = [...defaultPublic, ...(authConfig.public || [])];

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

export const pathMatchesRule = (path: string, rulePath: string | RegExp | string[] | undefined, apiRootPath?: string): boolean => {
  if (!rulePath) return true; // No path specified means all paths

  if (typeof rulePath === 'string') {
    // Adjust default API paths to use the configured apiRootPath
    let adjustedRulePath = rulePath;
    if (rulePath.startsWith('/api/')) {
      adjustedRulePath = rulePath.replace('/api/', `${apiRootPath || '/api'}/`);
    } else if (rulePath === '/api') {
      adjustedRulePath = apiRootPath || '/api';
    }
    return pathMatchesPattern(path, adjustedRulePath);
  }

  if (rulePath instanceof RegExp) {
    return rulePath.test(path);
  }

  if (Array.isArray(rulePath)) {
    return rulePath.some(p => {
      // Adjust default API paths to use the configured apiRootPath
      let adjustedPath = p;
      if (typeof p === 'string' && p.startsWith('/api/')) {
        adjustedPath = p.replace('/api/', `${apiRootPath || '/api'}/`);
      } else if (typeof p === 'string' && p === '/api') {
        adjustedPath = apiRootPath || '/api';
      }
      return pathMatchesPattern(path, adjustedPath);
    });
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
  apiRootPath?: string,
): Promise<boolean> => {
  // Go through rules in order (first match wins)
  for (const i in rules || []) {
    const rule = rules?.[i]!;
    // Check if rule applies to this path
    if (!pathMatchesRule(path, rule.path, apiRootPath)) {
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
