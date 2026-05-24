/**
 * Harness v1 — permission profiles.
 *
 * A profile is a purely declarative bundle of permission rules + session
 * grants that captures a named deployment posture: "this session is a
 * read-only PR review", "this session is an approval-gated patch", and
 * so on. Profiles compose `PermissionRules` and `SessionGrants` — they
 * are the canonical way for remote/server/A2A/channel entrypoints to
 * declare a non-YOLO baseline that the local CLI's lenient default
 * cannot bypass.
 *
 * Profile contract (anti-drift):
 *
 * - Every profile populates every {@link ToolCategory} explicitly.
 *   Falling through to the harness-level `defaultPermissionPolicy`
 *   would break a "readOnly" profile on a harness configured with
 *   `defaultPermissionPolicy: 'allow'`.
 * - The profile is the floor for the session. `applyProfile` is a
 *   replace (not a merge) of the session's `permissionRules` and
 *   `sessionGrants` — a profile-driven baseline must not carry stale
 *   rules forward when the posture changes. Callers that need to
 *   preserve their explicit denies pass `preserveCallerDenies: true`.
 * - Profiles gate on tool category and tool name only — per-call
 *   argument inspection is deferred. The session-level permission
 *   evaluation currently does not see invocation arguments, so a
 *   profile cannot distinguish `pnpm test` from `pnpm publish`.
 *   Operators who need finer-grained gating layer a custom
 *   workspace-policy rule for the specific commands their workflow
 *   uses.
 * - Workspace-policy fragments are intentionally out of this module —
 *   the harness workspace policy is currently construction-only, and
 *   exposing a session-scoped overlay is a separate slice.
 */

import type { PermissionRules, SessionGrants } from '../../storage/domains/harness/types';
import type { PermissionPolicy, ToolCategory } from './types';

export type HarnessPermissionProfileName = 'readOnlyReview' | 'approvalGatedPatch' | 'ciFixer' | 'trustedLocalYolo';

export type HarnessPermissionProfileTag = 'remote-safe' | 'local-only';

export interface HarnessPermissionProfile {
  /** Stable identifier — matches the `HARNESS_PERMISSION_PROFILES` key. */
  name: HarnessPermissionProfileName;
  /** Operator-facing description. */
  description: string;
  /**
   * Per-category baseline. Every {@link ToolCategory} must be populated
   * explicitly — see anti-drift note in the module docstring.
   */
  categories: Record<ToolCategory, PermissionPolicy>;
  /** Per-tool overrides. Win over `categories`. Empty by default. */
  tools: Readonly<Record<string, PermissionPolicy>>;
  /** Built-in session grants applied alongside the profile. */
  grants: SessionGrants;
  /**
   * Operator-visible tags. `'remote-safe'` means the profile is
   * allowlisted for non-CLI entrypoints; `'local-only'` means it must
   * never be the default for a remote route.
   */
  tags: readonly HarnessPermissionProfileTag[];
}

/**
 * Concrete preset bundles. Each preset is a frozen, fully-specified
 * profile — every `ToolCategory` is populated explicitly so the
 * profile holds regardless of the harness `defaultPermissionPolicy`.
 */
export const HARNESS_PERMISSION_PROFILES: Readonly<Record<HarnessPermissionProfileName, HarnessPermissionProfile>> =
  Object.freeze({
    readOnlyReview: Object.freeze({
      name: 'readOnlyReview',
      description:
        'Read/search only. No writes, no shell execution, no MCP, no sandbox escalation. ' +
        'Safe default for PR review, code search, and security audit workflows.',
      categories: {
        read: 'allow',
        edit: 'deny',
        execute: 'deny',
        mcp: 'deny',
        other: 'deny',
      } as Record<ToolCategory, PermissionPolicy>,
      tools: Object.freeze({}),
      grants: { categories: [], tools: [] },
      tags: Object.freeze(['remote-safe'] as const),
    }) satisfies HarnessPermissionProfile,

    approvalGatedPatch: Object.freeze({
      name: 'approvalGatedPatch',
      description:
        'Read/search auto-allowed. Writes, shell, and MCP require explicit ' +
        'human approval per call. Intended for assisted-edit workflows over ' +
        'remote routes where the user is in the loop on every mutation.',
      categories: {
        read: 'allow',
        edit: 'ask',
        execute: 'ask',
        mcp: 'ask',
        other: 'ask',
      } as Record<ToolCategory, PermissionPolicy>,
      tools: Object.freeze({}),
      grants: { categories: ['read'], tools: [] },
      tags: Object.freeze(['remote-safe'] as const),
    }) satisfies HarnessPermissionProfile,

    ciFixer: Object.freeze({
      name: 'ciFixer',
      description:
        'Read auto-allowed. Edits and shell commands require explicit ' +
        'approval per call. Intended as a CI-loop baseline where each ' +
        'mutation gates on the CI harness. Args-aware allowlisting ' +
        '(e.g. allow `pnpm test` but not `pnpm publish`) is NOT in this ' +
        'preset; a declarative allow on `execute` would over-permit. The ' +
        'CI host operator should layer a custom workspace-policy rule for ' +
        'the specific commands their CI uses.',
      categories: {
        read: 'allow',
        edit: 'ask',
        execute: 'ask',
        mcp: 'ask',
        other: 'ask',
      } as Record<ToolCategory, PermissionPolicy>,
      tools: Object.freeze({}),
      grants: { categories: ['read'], tools: [] },
      tags: Object.freeze(['remote-safe'] as const),
    }) satisfies HarnessPermissionProfile,

    trustedLocalYolo: Object.freeze({
      name: 'trustedLocalYolo',
      description:
        'Allow-by-default for every category. Only safe on a trusted local CLI ' +
        "where the operator is the agent's principal. Never default for any " +
        'remote/server/A2A/channel route. Tagged `local-only`.',
      categories: {
        read: 'allow',
        edit: 'allow',
        execute: 'allow',
        mcp: 'allow',
        other: 'allow',
      } as Record<ToolCategory, PermissionPolicy>,
      tools: Object.freeze({}),
      grants: {
        categories: ['read', 'edit', 'execute', 'mcp', 'other'],
        tools: [],
      },
      tags: Object.freeze(['local-only'] as const),
    }) satisfies HarnessPermissionProfile,
  });

/**
 * Construct a fresh `PermissionRules` shape from a profile. Caller-set
 * denies that should survive a profile reset can be passed via
 * `preserveCallerDenies` — every `policy === 'deny'` entry in the
 * provided baseline is overlaid on top of the profile's rules.
 */
export function rulesFromProfile(
  profile: HarnessPermissionProfile,
  opts?: { preserveCallerDenies?: PermissionRules },
): PermissionRules {
  const categories: Record<string, PermissionPolicy> = { ...profile.categories };
  const tools: Record<string, PermissionPolicy> = { ...profile.tools };
  if (opts?.preserveCallerDenies !== undefined) {
    for (const [category, policy] of Object.entries(opts.preserveCallerDenies.categories ?? {})) {
      if (policy === 'deny') categories[category] = 'deny';
    }
    for (const [tool, policy] of Object.entries(opts.preserveCallerDenies.tools ?? {})) {
      if (policy === 'deny') tools[tool] = 'deny';
    }
  }
  return { categories, tools };
}

/**
 * Clone the profile's grants. `applyProfile` REPLACES the session's
 * grants with this; merging in caller grants is not supported because
 * the whole point of a profile reset is to drop stale grants from a
 * stronger prior posture.
 */
export function grantsFromProfile(profile: HarnessPermissionProfile): SessionGrants {
  return {
    categories: [...profile.grants.categories],
    tools: [...profile.grants.tools],
  };
}
