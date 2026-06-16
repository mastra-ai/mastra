import type {
  PermissionCheckInput,
  PermissionCheckResult,
  PermissionPolicy,
  PermissionReason,
  PermissionRule,
  PermissionGrant,
  ToolCategory,
} from './permissions.types';

interface ResolvedPolicy {
  policy: PermissionPolicy;
  matchedRule: PermissionCheckResult['metadata']['matchedRule'];
}

function matchesArgPatterns(args: unknown, patterns?: Record<string, string>): boolean {
  if (!patterns) return true;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return false;

  const argRecord = args as Record<string, unknown>;
  return Object.entries(patterns).every(([key, pattern]) => {
    if (!Object.hasOwn(argRecord, key)) return false;

    try {
      return new RegExp(pattern).test(String(argRecord[key]));
    } catch {
      return false;
    }
  });
}

function matchesRuleArgs(rule: PermissionRule, args?: unknown): boolean {
  return matchesArgPatterns(args, rule.args);
}

function isGrantActive(grant: PermissionGrant, now = Date.now()): boolean {
  if (!grant.expiresAt) return true;
  const expiresAt = grant.expiresAt instanceof Date ? grant.expiresAt.getTime() : new Date(grant.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function findMatchingGrant(
  toolName: string,
  category: ToolCategory | null | undefined,
  grants: readonly PermissionGrant[] | undefined,
  args?: unknown,
): PermissionGrant | undefined {
  return grants?.find(grant => {
    if (!isGrantActive(grant)) return false;
    const matchesTarget = Boolean(
      (grant.toolName && grant.toolName === toolName) || (grant.category && grant.category === category),
    );
    return matchesTarget && matchesArgPatterns(args, grant.args);
  });
}

export function resolveEffectivePolicy(
  toolName: string,
  category: ToolCategory | null | undefined,
  rules?: readonly PermissionRule[],
  defaultPermissionPolicy?: PermissionPolicy,
  args?: unknown,
): ResolvedPolicy {
  const toolRule = rules?.find(rule => rule.toolName === toolName && matchesRuleArgs(rule, args));
  if (toolRule) return { policy: toolRule.policy, matchedRule: 'tool' };

  const categoryRule = category
    ? rules?.find(rule => rule.category === category && matchesRuleArgs(rule, args))
    : undefined;
  if (categoryRule) return { policy: categoryRule.policy, matchedRule: 'category' };

  const defaultRule = rules?.find(rule => !rule.toolName && !rule.category && matchesRuleArgs(rule, args));
  if (defaultRule) return { policy: defaultRule.policy, matchedRule: 'default' };
  if (defaultPermissionPolicy) return { policy: defaultPermissionPolicy, matchedRule: 'default' };

  return { policy: 'ask', matchedRule: 'fallback' };
}

export function composeReason(input: {
  policy: PermissionPolicy;
  toolConfigRequiresApproval?: boolean;
  policySuppressed?: boolean;
}): PermissionReason[] {
  const reasons: PermissionReason[] = [];
  if (input.toolConfigRequiresApproval) reasons.push('tool-config');
  if (input.policy === 'ask' && !input.policySuppressed) reasons.push('policy');
  return reasons;
}

export function evaluatePermission(input: PermissionCheckInput): PermissionCheckResult {
  const category = input.category ?? null;
  const { policy, matchedRule } = resolveEffectivePolicy(
    input.toolName,
    category,
    input.permissionRules,
    input.defaultPermissionPolicy,
    input.args,
  );
  const grant = policy === 'deny' ? undefined : findMatchingGrant(input.toolName, category, input.sessionGrants, input.args);
  const policySuppressed = policy !== 'deny' && (Boolean(grant) || Boolean(input.yolo));
  const reasons = composeReason({
    policy,
    toolConfigRequiresApproval: input.toolConfigRequiresApproval,
    policySuppressed,
  });

  const decision = policy === 'deny' ? 'deny' : reasons.length > 0 ? 'pendingApproval' : 'allow';

  return {
    decision,
    policy,
    reasons,
    metadata: {
      toolName: input.toolName,
      category,
      gate: input.gate,
      matchedRule,
      grantId: grant?.id,
      yolo: input.yolo || undefined,
    },
  };
}
