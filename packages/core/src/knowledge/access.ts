/**
 * One-hop Knowledge access: from the scopes a caller holds (its principals) to the scopes it can read
 * and the role it has on a given scope. A held scope reaches every scope whose declared rules name
 * it; scopes reached that way never act as principals themselves, so access never chains.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */
import type { KnowledgeReadScope } from '../storage/domains/knowledge/pages';
import {
  bindKnowledgePattern,
  knowledgePatternPrefix,
  matchKnowledgePattern,
  strongerKnowledgeRole,
} from './declarations';
import type {
  CompiledKnowledgeDeclaration,
  CompiledKnowledgeRule,
  CompiledKnowledgeScopes,
  KnowledgeRole,
} from './declarations';

/** Looks up materialized scope pages by address, e.g. `storage.getScopesByAddress`. */
export type KnowledgeScopeLookup = (addresses: string[]) => Promise<Array<{ id: string; address?: string }>>;

/** A declaration's address with params bound, including the `/<name>` of a template child. */
function bindDeclaration(compiled: CompiledKnowledgeDeclaration, params: Record<string, string>): string | null {
  if (compiled.child) {
    const parent = bindDeclaration(compiled.child.parent, params);
    return parent === null ? null : `${parent}/${compiled.child.name}`;
  }
  return compiled.pattern.params.length ? bindKnowledgePattern(compiled.pattern, params) : compiled.key;
}

/** Every declaration's rules, plus the extra rules of concrete addresses of declared types. */
function* ruleSources(
  compiled: CompiledKnowledgeScopes,
): Generator<{ declaration: CompiledKnowledgeDeclaration; rules: CompiledKnowledgeRule[]; address?: string }> {
  for (const declaration of compiled.declarations.values()) yield { declaration, rules: declaration.rules };
  for (const [address, entry] of compiled.concrete) {
    const match = compiled.match(address);
    if (match && match.compiled.key !== address) yield { declaration: match.compiled, rules: entry.rules, address };
  }
}

/**
 * The scopes a caller holding `principals` can read: every scope a declared rule gives one of them a
 * role on. Undeclared principals add nothing, and no principals read nothing (never `'all'`).
 * `lookupScopes` resolves `belongsTo` parents to page ids; parents not materialized yet reach nothing.
 *
 * @experimental
 */
export async function knowledgeReadScopeFor(
  compiled: CompiledKnowledgeScopes,
  principals: readonly string[],
  lookupScopes: KnowledgeScopeLookup,
): Promise<KnowledgeReadScope> {
  const addresses = new Set<string>();
  const prefixes = new Map<string, { declaration: string; prefix: string }>();
  const parents = new Map<string, Set<string>>();

  for (const principal of new Set(principals)) {
    const held = compiled.match(principal);
    for (const { declaration, rules, address } of ruleSources(compiled)) {
      for (const rule of rules) {
        if (rule.reach.kind === 'self') {
          if (held && held.compiled === declaration && (!address || address === principal)) addresses.add(principal);
          continue;
        }
        const params = matchKnowledgePattern(rule.principal!, principal);
        if (!params) continue;
        if (address) {
          if (bindKnowledgePattern(rule.principal!, compiled.match(address)!.params) === principal) {
            addresses.add(address);
          }
          continue;
        }
        if (rule.reach.kind === 'exact') {
          const target = bindDeclaration(declaration, params);
          if (target !== null) addresses.add(target);
        } else if (rule.reach.kind === 'prefix') {
          const prefix = knowledgePatternPrefix(declaration.pattern, params);
          if (prefix !== null) prefixes.set(`${declaration.key}\n${prefix}`, { declaration: declaration.key, prefix });
        } else {
          const parent = bindKnowledgePattern(declaration.belongsTo!, params);
          if (parent === null) continue;
          if (!parents.has(parent)) parents.set(parent, new Set());
          parents.get(parent)!.add(declaration.key);
        }
      }
    }
  }

  const children: Array<{ declaration: string; parentId: string }> = [];
  if (parents.size) {
    for (const scope of await lookupScopes([...parents.keys()])) {
      for (const declaration of parents.get(scope.address!) ?? []) children.push({ declaration, parentId: scope.id });
    }
  }
  return { addresses: [...addresses], prefixes: [...prefixes.values()], children };
}

/**
 * The strongest role `principals` give on one scope, or null. `parentAddress` is the address of the
 * scope page's tree parent, needed for rules that bind through `belongsTo`.
 *
 * @experimental
 */
export function knowledgeRoleOn(
  compiled: CompiledKnowledgeScopes,
  principals: readonly string[],
  scope: { address: string; parentAddress?: string | null },
): KnowledgeRole | null {
  const match = compiled.match(scope.address);
  if (!match) return null;
  const held = new Set(principals);
  const belongsToParams =
    match.compiled.belongsTo && scope.parentAddress
      ? matchKnowledgePattern(match.compiled.belongsTo, scope.parentAddress)
      : null;

  let role: KnowledgeRole | null = null;
  for (const rule of [...match.compiled.rules, ...match.concreteRules]) {
    let principal: string | null;
    if (rule.reach.kind === 'self') principal = scope.address;
    else if (rule.reach.kind === 'belongsTo') {
      principal = belongsToParams ? bindKnowledgePattern(rule.principal!, belongsToParams) : null;
    } else principal = bindKnowledgePattern(rule.principal!, match.params);
    if (principal !== null && held.has(principal)) role = strongerKnowledgeRole(role, rule.role);
  }
  return role;
}
