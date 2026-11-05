import { z } from 'zod';

const method = z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
/** Exact path segments may contain one named object parameter, never a wildcard or encoded separator. */
export const routeTemplateSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(value => {
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('//') || value.includes('..')) return false;
    if (value === '/') return true;
    return value
      .slice(1)
      .split('/')
      .every(
        segment =>
          (/^[A-Za-z0-9_~.-]+$/.test(segment) && !segment.startsWith('.') && !segment.endsWith('.')) ||
          /^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(segment),
      );
  }, 'Use an exact canonical route template.');
const base = {
  version: z.literal(1),
  method,
  pathTemplate: routeTemplateSchema,
  source: z.enum(['operator', 'openapi_suggestion']),
  operatorRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  expectedUnauthorizedStatus: z.array(z.number().int().min(400).max(499)).max(4),
};
const rule = <T extends 'public' | 'admin'>(audience: T) =>
  z.object({ ...base, audience: z.literal(audience) }).strict();

/** Route intent is operator policy; an OpenAPI suggestion cannot authorize a check. */
export const routeAccessRuleSchema = z
  .discriminatedUnion('audience', [
    rule('public'),
    z.object({ ...base, audience: z.literal('user'), objectPolicy: z.enum(['owner', 'shared']) }).strict(),
    rule('admin'),
  ])
  .superRefine((value, context) => {
    if ((value.source === 'operator') !== (value.operatorRevision !== undefined))
      context.addIssue({ code: 'custom', message: 'Operator rules require an operator revision.' });
    if ((value.audience === 'public') !== (value.expectedUnauthorizedStatus.length === 0))
      context.addIssue({ code: 'custom', message: 'Only protected routes have unauthorized responses.' });
    if (new Set(value.expectedUnauthorizedStatus).size !== value.expectedUnauthorizedStatus.length)
      context.addIssue({ code: 'custom', message: 'Expected statuses must be unique.' });
  });
export type RouteAccessRule = z.infer<typeof routeAccessRuleSchema>;
export const routeAccessRulesSchema = z
  .array(routeAccessRuleSchema)
  .max(64)
  .refine(value => {
    const keys = value.map(rule => `${rule.method} ${rule.pathTemplate}`);
    return new Set(keys).size === keys.length;
  }, 'Each method and path template may have one access rule.');

/** Split a route path into segments after normalizing its trailing slash. */
const segments = (path: string) => (path === '/' ? [] : path.replace(/\/$/, '').slice(1).split('/'));
/** Recognize a route-template segment enclosed by parameter braces. */
const parameter = (segment: string) => segment.startsWith('{') && segment.endsWith('}');

/** Every path matched by the template must fit one allowed prefix and no excluded prefix. */
export function routeTemplateWithinScope(
  template: string,
  scope: { allowedPaths: string[]; excludedPaths: string[] },
): boolean {
  const route = segments(template);
  const allowed = scope.allowedPaths.some(path => {
    const prefix = segments(path);
    return prefix.length <= route.length && prefix.every((segment, index) => segment === route[index]);
  });
  if (!allowed) return false;
  return !scope.excludedPaths.some(path => {
    const prefix = segments(path);
    return (
      prefix.length <= route.length &&
      prefix.every((segment, index) => parameter(route[index]!) || segment === route[index])
    );
  });
}

/** BOLA eligibility requires operator-confirmed owner intent, not HTTP status or schema security metadata. */
export function ownerOnlyReadRule(rule: RouteAccessRule): boolean {
  return (
    rule.source === 'operator' && rule.method === 'GET' && rule.audience === 'user' && rule.objectPolicy === 'owner'
  );
}
