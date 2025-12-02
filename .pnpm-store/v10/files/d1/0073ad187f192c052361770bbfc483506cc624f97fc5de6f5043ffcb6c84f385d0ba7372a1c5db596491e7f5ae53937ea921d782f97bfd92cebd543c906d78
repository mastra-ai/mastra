import type { NodePath } from '@babel/traverse';
import type { TSTypeParameterDeclaration, TSTypeParameterInstantiation, TypeParameterDeclaration, TypeParameterInstantiation } from '@babel/types';
export type TypeParameters = Record<string, NodePath>;
export default function getTypeParameters(declaration: NodePath<TSTypeParameterDeclaration | TypeParameterDeclaration>, instantiation: NodePath<TSTypeParameterInstantiation | TypeParameterInstantiation>, inputParams: TypeParameters | null | undefined): TypeParameters;
