import type {
  KnowledgePage,
  KnowledgeProvenance,
  KnowledgeReadScope,
  KnowledgeStorage,
} from '../storage/domains/knowledge';
import { parseKnowledgePageRef } from '../storage/domains/knowledge';
import { knowledgeAccessGrants, knowledgeReadScopeFor, knowledgeRoleOn } from './access';
import type { KnowledgeAccessGrant } from './access';
import {
  compileKnowledgeScopes,
  KnowledgeDeclarationError,
  knowledgeRunScopes,
  strongerKnowledgeRole,
} from './declarations';
import type { CompiledKnowledgeScopes, KnowledgeRole, KnowledgeScopeDeclarations } from './declarations';

/** Why a run can or can't reach a scope or page. See {@link Knowledge.explainAccess}. @experimental */
export interface KnowledgeAccessExplanation {
  /** The run's strongest role on the target's scope; null when it can't read it. */
  role: KnowledgeRole | null;
  /** Every rule that gives one of the run's principals a role there. */
  reasons: KnowledgeAccessGrant[];
  /** The resolved page and its home scope address, for page targets that exist. */
  page?: { id: string; scope: string };
  /** `missing`: no such page. `hidden`: the page exists but the run can't read its scope. `no-rule`: a scope no rule gives the run. */
  reason?: 'missing' | 'hidden' | 'no-rule';
}

/** Declaration-backed access and lazy scope creation shared by the Knowledge lifecycle and tools. @internal */
export class KnowledgeScopeRuntime {
  readonly compiled: CompiledKnowledgeScopes;

  constructor(
    declarations: KnowledgeScopeDeclarations,
    private readonly getStorage: () => Promise<KnowledgeStorage>,
    private readonly warn: (message: string) => void,
  ) {
    this.compiled = compileKnowledgeScopes(structuredClone(declarations));
  }

  validatePrincipals(principals: readonly string[]): void {
    for (const principal of principals) {
      if (!this.compiled.match(principal)) {
        throw new KnowledgeDeclarationError(`Knowledge run scope "${principal}" does not match a declared scope type.`);
      }
    }
  }

  async readScopeFor(principals: readonly string[]): Promise<KnowledgeReadScope> {
    this.validatePrincipals(principals);
    const storage = await this.getStorage();
    return knowledgeReadScopeFor(this.compiled, principals, addresses => storage.getScopesByAddress(addresses));
  }

  async roleOn(principals: readonly string[], scope: KnowledgePage): Promise<KnowledgeRole | null> {
    this.validatePrincipals(principals);
    if (!scope.isScope || !scope.address) throw new Error('Knowledge roles require a scope page.');
    const storage = await this.getStorage();
    const parent = scope.parentId ? await storage.getPage({ id: scope.parentId, read: 'all' }) : null;
    return knowledgeRoleOn(this.compiled, principals, { address: scope.address, parentAddress: parent?.address });
  }

  async explainAccess(
    runScopes: readonly string[],
    target: { scope: string } | { page: string },
  ): Promise<KnowledgeAccessExplanation> {
    const principals = knowledgeRunScopes(this.compiled, runScopes);
    this.validatePrincipals(principals);
    const storage = await this.getStorage();

    let scope: KnowledgePage | undefined;
    let page: KnowledgePage | null = null;
    if ('scope' in target) {
      if (!this.compiled.match(target.scope)) {
        throw new KnowledgeDeclarationError(`Knowledge scope "${target.scope}" does not match a declared scope type.`);
      }
      [scope] = await storage.getScopesByAddress([target.scope]);
    } else {
      if (target.page.indexOf('#') > 0) {
        const parsed = parseKnowledgePageRef(target.page);
        if (parsed) [scope] = await storage.getScopesByAddress([parsed.scope]);
        page =
          parsed && scope ? await storage.getPageByPath({ scopeId: scope.id, path: parsed.path, read: 'all' }) : null;
      } else {
        page = await storage.getPage({ id: target.page, read: 'all' });
        if (page?.deletedAt) page = null;
        scope = page
          ? page.isScope
            ? page
            : ((await storage.getPage({ id: page.scopeId, read: 'all' })) ?? undefined)
          : undefined;
      }
      if (!page || !scope?.address) return { role: null, reasons: [], reason: 'missing' };
    }

    const address = scope?.address ?? (target as { scope: string }).scope;
    const parent = scope?.parentId ? await storage.getPage({ id: scope.parentId, read: 'all' }) : null;
    const reasons = knowledgeAccessGrants(this.compiled, principals, { address, parentAddress: parent?.address });
    let role: KnowledgeRole | null = null;
    for (const reason of reasons) role = strongerKnowledgeRole(role, reason.role);
    return {
      role,
      reasons,
      ...(page ? { page: { id: page.id, scope: address } } : {}),
      ...(role ? {} : { reason: page ? ('hidden' as const) : ('no-rule' as const) }),
    };
  }

  async materializeScope(
    address: string,
    principals: readonly string[],
    provenance: KnowledgeProvenance,
    ancestors: readonly string[] = [],
  ): Promise<KnowledgePage> {
    this.validatePrincipals(principals);
    const match = this.compiled.match(address);
    if (!match)
      throw new KnowledgeDeclarationError(`Knowledge scope "${address}" does not match a declared scope type.`);
    if (ancestors.includes(address))
      throw new KnowledgeDeclarationError(`Knowledge scope placement cycle at "${address}".`);
    const storage = await this.getStorage();
    if (match.compiled.child) {
      const parentAddress = address.slice(0, address.lastIndexOf('/'));
      await this.materializeScope(parentAddress, principals, provenance, [...ancestors, address]);
      const [child] = await storage.getScopesByAddress([address]);
      if (!child) throw new Error(`Knowledge template child "${address}" was not materialized.`);
      return child;
    }

    const [existing] = await storage.getScopesByAddress([address]);
    let parentId = existing?.parentId;
    const belongsTo = match.compiled.belongsTo;
    if (belongsTo) {
      const candidates = [...new Set(principals)].filter(principal => {
        const candidate = this.compiled.match(principal);
        if (!candidate || candidate.compiled.key !== belongsTo.key) return false;
        return belongsTo.params.every(
          param => match.params[param] === undefined || candidate.params[param] === match.params[param],
        );
      });
      if (candidates.length > 1) {
        this.warn(
          `Knowledge scope "${address}" has ambiguous belongsTo placement: ${candidates.join(', ')}. Keeping its existing placement.`,
        );
      } else if (candidates[0]) {
        if (existing?.parentId) {
          const parent = await storage.getPage({ id: existing.parentId, read: 'all' });
          if (parent?.address !== candidates[0]) {
            this.warn(
              `Knowledge scope "${address}" already belongs to "${parent?.address}"; ignoring requested parent "${candidates[0]}".`,
            );
          }
        } else if (!ancestors.includes(candidates[0]) && candidates[0] !== address) {
          parentId = (await this.materializeScope(candidates[0], principals, provenance, [...ancestors, address])).id;
        } else {
          this.warn(
            `Knowledge scope "${address}" cannot be placed under "${candidates[0]}" because that would form a cycle.`,
          );
        }
      }
    }
    const declaration = match.compiled.declaration;
    const result = await storage.materializeScope({
      address,
      declaration: match.declaration,
      name: address,
      description: match.concrete?.description ?? declaration.description,
      parentId,
      children: match.compiled.children.map(child => ({
        address: `${address}/${child.child!.name}`,
        declaration: child.key,
        name: child.child!.name,
        description: child.declaration.description,
      })),
      pages: declaration.pages,
      provenance,
    });
    if (result.parentConflict) {
      this.warn(`Knowledge scope "${address}" was already linked by another run; keeping its persisted parent.`);
    }
    return result.scope;
  }
}
