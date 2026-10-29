import type {
  KnowledgePage,
  KnowledgeProvenance,
  KnowledgeReadScope,
  KnowledgeStorage,
} from '../storage/domains/knowledge';
import { knowledgeReadScopeFor, knowledgeRoleOn } from './access';
import { compileKnowledgeScopes, KnowledgeDeclarationError } from './declarations';
import type { CompiledKnowledgeScopes, KnowledgeRole, KnowledgeScopeDeclarations } from './declarations';

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
