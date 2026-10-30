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
  #declarationsChecked?: Promise<void>;

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

  /**
   * Fails when stored scope pages carry declaration keys this config doesn't declare: a renamed or
   * removed key would otherwise silently cut those scopes off from prefix and `belongsTo` reach.
   * Checked once per instance; only a pass is remembered, so a store error is retried next time.
   */
  checkDeclarations(): Promise<void> {
    if (!this.#declarationsChecked) {
      const check = this.#checkDeclarations();
      this.#declarationsChecked = check;
      check.catch(() => {
        if (this.#declarationsChecked === check) this.#declarationsChecked = undefined;
      });
    }
    return this.#declarationsChecked;
  }

  async #checkDeclarations(): Promise<void> {
    const storage = await this.getStorage();
    const orphans = (await storage.listScopeDeclarations()).filter(
      ({ declaration }) => !this.compiled.declarations.has(declaration),
    );
    if (orphans.length === 0) return;
    const listed = orphans
      .map(({ declaration, scopes }) => `"${declaration}" (${scopes} scope${scopes === 1 ? '' : 's'})`)
      .join(', ');
    throw new KnowledgeDeclarationError(
      `Knowledge storage has scopes created from declarations this config doesn't declare: ${listed}. ` +
        'Restore each key in scopes, rename it with knowledge.renameScopeDeclaration(from, to), ' +
        'or keep the key with no access rules to retire it.',
    );
  }

  /** Re-keys stored scopes from declaration `from` to `to`. See {@link Knowledge.renameScopeDeclaration}. */
  async renameScopeDeclaration(from: string, to: string): Promise<number> {
    if (this.compiled.declarations.has(from)) {
      throw new KnowledgeDeclarationError(
        `Can't rename scope declaration "${from}": it is still declared. Remove it from scopes first.`,
      );
    }
    if (!this.compiled.declarations.has(to)) {
      throw new KnowledgeDeclarationError(`Can't rename scope declaration to "${to}": it isn't declared in scopes.`);
    }
    const storage = await this.getStorage();
    const renamed = await storage.renameScopeDeclaration({
      from,
      to,
      check: scopes => {
        const mismatched = scopes.filter(scope => this.compiled.match(scope.address)?.declaration !== scope.to);
        if (mismatched.length === 0) return;
        throw new KnowledgeDeclarationError(
          `Can't rename scope declaration "${from}" to "${to}": ` +
            mismatched
              .slice(0, 5)
              .map(scope => `"${scope.address}" doesn't match "${scope.to}"`)
              .join(', ') +
            (mismatched.length > 5 ? `, and ${mismatched.length - 5} more` : '') +
            '. Nothing was renamed.',
        );
      },
    });
    this.#declarationsChecked = undefined;
    return renamed;
  }

  async readScopeFor(principals: readonly string[]): Promise<KnowledgeReadScope> {
    this.validatePrincipals(principals);
    await this.checkDeclarations();
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

  /**
   * The `<scope>#<key path>` of a page its scope's declaration lists in `pages`, or undefined for an
   * ordinary page. Template pages belong to config: tools can't move them or merge them away.
   */
  async templatePageRef(page: KnowledgePage): Promise<string | undefined> {
    if (page.isScope || !page.key) return undefined;
    const storage = await this.getStorage();
    const path: string[] = [];
    let current: KnowledgePage | null = page;
    while (current && !current.isScope) {
      if (!current.key) return undefined;
      path.unshift(current.key);
      current = current.parentId ? await storage.getPage({ id: current.parentId, read: 'all' }) : null;
    }
    if (!current?.address) return undefined;
    let templates = this.compiled.match(current.address)?.compiled.declaration.pages;
    for (const key of path) {
      const template = templates?.find(entry => entry.key === key);
      if (!template) return undefined;
      templates = template.pages;
    }
    return `${current.address}#${path.join('/')}`;
  }

  async materializeScope(
    address: string,
    principals: readonly string[],
    provenance: KnowledgeProvenance,
    ancestors: readonly string[] = [],
  ): Promise<KnowledgePage> {
    this.validatePrincipals(principals);
    await this.checkDeclarations();
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
