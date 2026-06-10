import type {
  PermissionCheckInput,
  PermissionCheckResult,
  PermissionPolicy,
  PermissionReason,
  PermissionRule,
  PermissionRules,
  SessionGrant,
  ToolCategory,
} from './permissions.types';

interface ResolvedPolicy {
  policy: PermissionPolicy;
  matchedRule: PermissionCheckResult['metadata']['matchedRule'];
}

function normalizeRule(rule: PermissionPolicy | PermissionRule | undefined): PermissionPolicy | undefined {
  if (!rule) return undefined;
  return typeof rule === 'string' ? rule : rule.policy;
}

function isGrantActive(grant: SessionGrant, now = Date.now()): boolean {
  if (!grant.expiresAt) return true;
  const expiresAt = grant.expiresAt instanceof Date ? grant.expiresAt.getTime() : new Date(grant.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function findMatchingGrant(
  toolName: string,
  category: ToolCategory | null | undefined,
  grants: readonly SessionGrant[] | undefined,
): SessionGrant | undefined {
  return grants?.find(grant => {
    if (!isGrantActive(grant)) return false;
    if (grant.toolName && grant.toolName === toolName) return true;
    if (grant.category && grant.category === category) return true;
    return false;
  });
}

export function resolveEffectivePolicy(
  toolName: string,
  category: ToolCategory | null | undefined,
  rules?: PermissionRules,
  defaultPermissionPolicy?: PermissionPolicy,
): ResolvedPolicy {
  const toolRule = normalizeRule(rules?.tools?.[toolName]);
  if (toolRule) return { policy: toolRule, matchedRule: 'tool' };

  const categoryRule = category ? normalizeRule(rules?.categories?.[category]) : undefined;
  if (categoryRule) return { policy: categoryRule, matchedRule: 'category' };

  if (rules?.defaultPolicy) return { policy: rules.defaultPolicy, matchedRule: 'default' };
  if (defaultPermissionPolicy) return { policy: defaultPermissionPolicy, matchedRule: 'default' };

  return { policy: 'ask', matchedRule: 'fallback' };
}

export function composeReason(input: {
  policy: PermissionPolicy;
  toolConfigRequiresApproval?: boolean;
  toolFnRequiresApproval?: boolean;
  policySuppressed?: boolean;
}): PermissionReason[] {
  const reasons: PermissionReason[] = [];
  if (input.toolConfigRequiresApproval) reasons.push('tool-config');
  if (input.toolFnRequiresApproval) reasons.push('tool-fn');
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
  );
  const grant = policy === 'deny' ? undefined : findMatchingGrant(input.toolName, category, input.sessionGrants);
  const policySuppressed = policy !== 'deny' && (Boolean(grant) || Boolean(input.yolo));
  const reasons = composeReason({
    policy,
    toolConfigRequiresApproval: input.toolConfigRequiresApproval,
    toolFnRequiresApproval: input.toolFnRequiresApproval,
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
