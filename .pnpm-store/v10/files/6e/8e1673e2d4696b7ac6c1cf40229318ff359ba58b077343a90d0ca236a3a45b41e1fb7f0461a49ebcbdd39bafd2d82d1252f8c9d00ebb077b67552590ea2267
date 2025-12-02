import ChainResolver from './ChainResolver.js';
import FindAllDefinitionsResolver from './FindAllDefinitionsResolver.js';
import FindAnnotatedDefinitionsResolver from './FindAnnotatedDefinitionsResolver.js';
import FindExportedDefinitionsResolver from './FindExportedDefinitionsResolver.js';
import type { NodePath } from '@babel/traverse';
import type FileState from '../FileState.js';
import type { ArrowFunctionExpression, CallExpression, ClassDeclaration, ClassExpression, FunctionDeclaration, FunctionExpression, ObjectExpression, ObjectMethod } from '@babel/types';
export type StatelessComponentNode = ArrowFunctionExpression | FunctionDeclaration | FunctionExpression | ObjectMethod;
export type ComponentNode = CallExpression | ClassDeclaration | ClassExpression | ObjectExpression | StatelessComponentNode;
export type ComponentNodePath = NodePath<ComponentNode>;
export type ResolverFunction = (file: FileState) => ComponentNodePath[];
export interface ResolverClass {
    resolve: ResolverFunction;
}
export type Resolver = ResolverClass | ResolverFunction;
export { FindAllDefinitionsResolver, FindAnnotatedDefinitionsResolver, FindExportedDefinitionsResolver, ChainResolver, };
