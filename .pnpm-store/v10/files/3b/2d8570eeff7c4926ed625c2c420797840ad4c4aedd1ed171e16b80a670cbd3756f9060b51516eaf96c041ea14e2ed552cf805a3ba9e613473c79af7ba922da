import type { NodePath } from '@babel/traverse';
import { Scope as BaseScope } from '@babel/traverse';
import type { Identifier, TSEnumDeclaration, TSInterfaceDeclaration, TSTypeAliasDeclaration } from '@babel/types';
type BindingNode = TSEnumDeclaration | TSInterfaceDeclaration | TSTypeAliasDeclaration;
type TypeKind = 'alias' | 'enum' | 'interface';
/**
 * What the f... is this?
 * Well, babel and in particular @babel/traverse have no scope tracking
 * for typescript types. Flow types do work because they are part of the
 * normal reference tracking and mix with non-type identifiers.
 * This monkey-patching of @babel/traverse adds scope tracking for
 * typescript types. It tries to do this without changing any babel behavior.
 *
 * This is not the best solution, but it allows to use @babel/traverse in react-docgen
 * which needs to be able to do scope tracking of typescript types.
 *
 * see https://github.com/babel/babel/issues/14662
 */
declare module '@babel/traverse' {
    interface Scope {
        typeBindings: Record<string, TypeBinding>;
        getTypeBinding(name: string): TypeBinding | undefined;
        getOwnTypeBinding(name: string): TypeBinding | undefined;
        registerTypeBinding(this: BaseScope, typeKind: TypeKind, path: NodePath<Identifier>, bindingPath: NodePath<BindingNode>): void;
        _realRegisterDeclaration: BaseScope['registerDeclaration'];
        _realCrawl: BaseScope['crawl'];
    }
}
declare class TypeBinding {
    identifier: Identifier;
    identifierPath: NodePath<Identifier>;
    path: NodePath;
    scope: BaseScope;
    typeKind: TypeKind;
    constructor(data: {
        identifier: Identifier;
        identifierPath: NodePath<Identifier>;
        path: NodePath;
        scope: BaseScope;
        typeKind: TypeKind;
    });
}
export default function initialize(scopeClass: typeof BaseScope): void;
export {};
