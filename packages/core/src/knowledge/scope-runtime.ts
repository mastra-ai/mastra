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
import { refreshKnowledgeLinksTo, updateKnowledgeLinks } from './links';

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

type ScopeMatch = NonNullable<ReturnType<CompiledKnowledgeScopes['match']>>;
type HeldPrincipals = Map<string, Array<{ principal: string; params: ScopeMatch['params'] }>>;
/** The addresses a write-run start looked up, and the scope pages it found or wrote since. */
type KnownScopes = { looked: Set<string>; byAddress: Map<string, KnowledgePage>; byId: Map<string, KnowledgePage> };
type MaterializeRun = { held: HeldPrincipals; known?: KnownScopes };

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

  /**
   * Whether a stored scope row belongs to the declaration its address matches today. Rows written
   * before scope params matched exactly one segment can carry another (`org:acme:viewer` stored
   * under `org:$orgId`); they must not pick up the rules of the declaration that now matches them.
   */
  #isCurrent(scope: KnowledgePage): boolean {
    return !scope.declaration || this.compiled.match(scope.address!)?.declaration === scope.declaration;
  }

  #assertCurrent(scope: KnowledgePage): void {
    if (this.#isCurrent(scope)) return;
    throw new KnowledgeDeclarationError(
      `Knowledge scope "${scope.address}" was created from "${scope.declaration}", which no longer matches it ` +
        `(scope params match one segment; encode colons in ids as %3A). It can't be used as a scope of ` +
        `"${this.compiled.match(scope.address!)?.declaration}".`,
    );
  }

  async readScopeFor(principals: readonly string[]): Promise<KnowledgeReadScope> {
    this.validatePrincipals(principals);
    await this.checkDeclarations();
    const storage = await this.getStorage();
    const read = await knowledgeReadScopeFor(this.compiled, principals, addresses =>
      storage.getScopesByAddress(addresses),
    );
    if (read === 'all' || read.addresses.length === 0) return read;
    const stale = new Set(
      (await storage.getScopesByAddress(read.addresses))
        .filter(scope => !this.#isCurrent(scope))
        .map(scope => scope.address!),
    );
    return stale.size ? { ...read, addresses: read.addresses.filter(address => !stale.has(address)) } : read;
  }

  async roleOn(principals: readonly string[], scope: KnowledgePage): Promise<KnowledgeRole | null> {
    this.validatePrincipals(principals);
    if (!scope.isScope || !scope.address) throw new Error('Knowledge roles require a scope page.');
    if (!this.#isCurrent(scope)) return null;
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
    const reasons =
      scope && !this.#isCurrent(scope)
        ? []
        : knowledgeAccessGrants(this.compiled, principals, { address, parentAddress: parent?.address });
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
  ): Promise<KnowledgePage> {
    this.validatePrincipals(principals);
    await this.checkDeclarations();
    return this.#materialize(address, principals, provenance, [], { held: this.#held(principals) });
  }

  /**
   * {@link materializeScope} for each address in turn (a write-run start's principals), reading
   * scopes from one lookup. `#materialize` skips the store call for a scope that exists, needs no new
   * `belongsTo` link, has its child scopes and declares no template pages; warnings fire as before.
   */
  async materializeScopes(
    addresses: readonly string[],
    principals: readonly string[],
    provenance: KnowledgeProvenance,
  ): Promise<void> {
    this.validatePrincipals(principals);
    await this.checkDeclarations();
    const storage = await this.getStorage();
    const wanted = new Set<string>();
    for (const address of addresses) {
      wanted.add(address);
      const match = this.compiled.match(address);
      if (match?.compiled.child) wanted.add(address.slice(0, address.lastIndexOf('/')));
      else for (const child of match?.compiled.children ?? []) wanted.add(`${address}/${child.child!.name}`);
    }
    const known: KnownScopes = { looked: wanted, byAddress: new Map(), byId: new Map() };
    for (const row of await storage.getScopesByAddress([...wanted])) {
      known.byAddress.set(row.address!, row);
      known.byId.set(row.id, row);
    }
    const run = { held: this.#held(principals), known };
    for (const address of addresses) await this.#materialize(address, principals, provenance, [], run);
  }

  /** The run's distinct principals grouped by declaration key, matched once. */
  #held(principals: readonly string[]): HeldPrincipals {
    const held: HeldPrincipals = new Map();
    for (const principal of new Set(principals)) {
      const match = this.compiled.match(principal);
      if (!match) continue;
      const group = held.get(match.compiled.key) ?? [];
      group.push({ principal, params: match.params });
      held.set(match.compiled.key, group);
    }
    return held;
  }

  #belongsToCandidates(match: ScopeMatch, held: HeldPrincipals): string[] {
    const belongsTo = match.compiled.belongsTo!;
    return (held.get(belongsTo.key) ?? [])
      .filter(candidate =>
        belongsTo.params.every(
          param => match.params[param] === undefined || candidate.params[param] === match.params[param],
        ),
      )
      .map(candidate => candidate.principal);
  }

  async #materialize(
    address: string,
    principals: readonly string[],
    provenance: KnowledgeProvenance,
    ancestors: readonly string[],
    run: MaterializeRun,
  ): Promise<KnowledgePage> {
    const match = this.compiled.match(address);
    if (!match)
      throw new KnowledgeDeclarationError(`Knowledge scope "${address}" does not match a declared scope type.`);
    if (ancestors.includes(address))
      throw new KnowledgeDeclarationError(`Knowledge scope placement cycle at "${address}".`);
    const storage = await this.getStorage();
    const known = run.known;
    const lookUp = async (scope: string) =>
      known?.looked.has(scope) || known?.byAddress.has(scope)
        ? known.byAddress.get(scope)
        : (await storage.getScopesByAddress([scope]))[0];
    if (match.compiled.child) {
      const parentAddress = address.slice(0, address.lastIndexOf('/'));
      await this.#materialize(parentAddress, principals, provenance, [...ancestors, address], run);
      const child = known?.byAddress.get(address) ?? (await storage.getScopesByAddress([address]))[0];
      if (!child) throw new Error(`Knowledge template child "${address}" was not materialized.`);
      return child;
    }

    const existing = await lookUp(address);
    if (existing) this.#assertCurrent(existing);
    let parentId = existing?.parentId;
    const belongsTo = match.compiled.belongsTo;
    if (belongsTo) {
      const candidates = this.#belongsToCandidates(match, run.held);
      if (candidates.length > 1) {
        this.warn(
          `Knowledge scope "${address}" has ambiguous belongsTo placement: ${candidates.join(', ')}. Keeping its existing placement.`,
        );
      } else if (candidates[0]) {
        if (existing?.parentId) {
          let parent = known?.byId.get(existing.parentId) ?? null;
          if (!parent) {
            parent = await storage.getPage({ id: existing.parentId, read: 'all' });
            if (parent) known?.byId.set(parent.id, parent);
          }
          if (parent?.address !== candidates[0]) {
            this.warn(
              `Knowledge scope "${address}" already belongs to "${parent?.address}"; ignoring requested parent "${candidates[0]}".`,
            );
          }
        } else if (!ancestors.includes(candidates[0]) && candidates[0] !== address) {
          parentId = (await this.#materialize(candidates[0], principals, provenance, [...ancestors, address], run)).id;
        } else {
          this.warn(
            `Knowledge scope "${address}" cannot be placed under "${candidates[0]}" because that would form a cycle.`,
          );
        }
      }
    }
    const declaration = match.compiled.declaration;
    // Placed already: nothing to link, and no template pages to restore or child scopes to create.
    if (
      known &&
      existing &&
      parentId === existing.parentId &&
      !declaration.pages?.length &&
      match.compiled.children.every(child => known.byAddress.has(`${address}/${child.child!.name}`))
    ) {
      return existing;
    }
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
    this.#assertCurrent(result.scope);
    if (result.created) {
      // A new scope (and its config pages) can resolve body links written before it existed.
      await updateKnowledgeLinks(this.warn, () =>
        refreshKnowledgeLinksTo(storage, [result.scope], { withDescendants: true }),
      );
    }
    if (result.parentConflict) {
      this.warn(`Knowledge scope "${address}" was already linked by another run; keeping its persisted parent.`);
    }
    if (run.known) {
      run.known.byAddress.set(address, result.scope);
      run.known.byId.set(result.scope.id, result.scope);
    }
    return result.scope;
  }
}
