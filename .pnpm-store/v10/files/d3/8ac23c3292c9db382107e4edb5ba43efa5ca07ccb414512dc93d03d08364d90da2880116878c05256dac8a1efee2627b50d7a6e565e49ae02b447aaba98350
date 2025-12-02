import type { NodePath } from '@babel/traverse';
import type { CallExpression, ClassDeclaration, ClassExpression, ClassMethod, Expression, ObjectExpression, ObjectMethod, TaggedTemplateExpression, VariableDeclaration } from '@babel/types';
import type { StatelessComponentNode } from '../resolver/index.js';
type SupportedNodes = CallExpression | ClassDeclaration | ClassExpression | ObjectExpression | StatelessComponentNode | TaggedTemplateExpression | VariableDeclaration;
export declare function isSupportedDefinitionType(path: NodePath): path is NodePath<SupportedNodes>;
/**
 * This is a helper method for handlers to make it easier to work either with
 * an ObjectExpression from `React.createClass` class or with a class
 * definition.
 *
 * Given a path and a name, this function will either return the path of the
 * property value if the path is an ObjectExpression, or the value of the
 * ClassProperty/MethodDefinition if it is a class definition (declaration or
 * expression).
 *
 * It also normalizes the names so that e.g. `defaultProps` and
 * `getDefaultProps` can be used interchangeably.
 */
export default function getMemberValuePath(componentDefinition: NodePath<SupportedNodes>, memberName: string): NodePath<ClassMethod | Expression | ObjectMethod> | null;
export {};
