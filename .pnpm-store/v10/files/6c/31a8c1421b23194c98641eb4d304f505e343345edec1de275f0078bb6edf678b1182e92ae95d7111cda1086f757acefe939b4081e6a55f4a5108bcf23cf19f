import type { NodePath } from '@babel/traverse';
import type { ClassDeclaration, ClassExpression } from '@babel/types';
/**
 * Given a class definition (i.e. `class` declaration or expression), this
 * function "normalizes" the definition, by looking for assignments of static
 * properties and converting them to ClassProperties.
 *
 * Example:
 *
 * class MyComponent extends React.Component {
 *   // ...
 * }
 * MyComponent.propTypes = { ... };
 *
 * is converted to
 *
 * class MyComponent extends React.Component {
 *   // ...
 *   static propTypes = { ... };
 * }
 */
export default function normalizeClassDefinition(classDefinition: NodePath<ClassDeclaration | ClassExpression>): void;
