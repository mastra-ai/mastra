import type { PermissionPolicy, PermissionRules } from '../permissions.js';

/** Permission rule overrides merged into runtime permission rules */
export type MastraCodePermissionRules = Partial<PermissionRules>;

export function toObjectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isPermissionPolicy(value: unknown): value is PermissionPolicy {
  return value === 'allow' || value === 'ask' || value === 'deny';
}

export function normalizePermissionRules(value: unknown): PermissionRules {
  const record = toObjectRecord(value);
  const categoriesRecord = toObjectRecord(record?.categories);
  const toolsRecord = toObjectRecord(record?.tools);

  const categories: Record<string, PermissionPolicy> = {};
  if (categoriesRecord) {
    for (const [name, policy] of Object.entries(categoriesRecord)) {
      if (isPermissionPolicy(policy)) categories[name] = policy;
    }
  }

  const tools: Record<string, PermissionPolicy> = {};
  if (toolsRecord) {
    for (const [name, policy] of Object.entries(toolsRecord)) {
      if (isPermissionPolicy(policy)) tools[name] = policy;
    }
  }

  return { categories, tools };
}

export function mergePermissionRules(base: PermissionRules, overrides: PermissionRules): PermissionRules {
  return {
    categories: {
      ...base.categories,
      ...overrides.categories,
    },
    tools: {
      ...base.tools,
      ...overrides.tools,
    },
  };
}

function areStringMapsEqual<T extends string>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function arePermissionRulesEqual(a: PermissionRules, b: PermissionRules): boolean {
  return areStringMapsEqual(a.categories, b.categories) && areStringMapsEqual(a.tools, b.tools);
}

export function hasPermissionRules(rules: PermissionRules): boolean {
  return Object.keys(rules.categories).length > 0 || Object.keys(rules.tools).length > 0;
}
