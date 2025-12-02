import { classProperty, inheritsComments } from '@babel/types';
import getMemberExpressionRoot from '../utils/getMemberExpressionRoot.js';
import getMembers from '../utils/getMembers.js';
import { visitors } from '@babel/traverse';
import { ignore } from './traverse.js';
const explodedVisitors = visitors.explode({
    Function: { enter: ignore },
    Class: { enter: ignore },
    Loop: { enter: ignore },
    AssignmentExpression(path, state) {
        const left = path.get('left');
        if (left.isMemberExpression()) {
            const first = getMemberExpressionRoot(left);
            if (first.isIdentifier({ name: state.variableName })) {
                const [member] = getMembers(left);
                if (member &&
                    !member.path.has('computed') &&
                    !member.path.isPrivateName()) {
                    const property = classProperty(member.path.node, path.node.right, null, null, false, true);
                    inheritsComments(property, path.node);
                    if (path.parentPath.isExpressionStatement()) {
                        inheritsComments(property, path.parentPath.node);
                    }
                    state.classDefinition.get('body').unshiftContainer('body', property);
                    path.skip();
                    path.remove();
                }
            }
        }
        else {
            path.skip();
        }
    },
});
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
export default function normalizeClassDefinition(classDefinition) {
    let variableName;
    if (classDefinition.isClassDeclaration()) {
        // Class declarations may not have an id, e.g.: `export default class extends React.Component {}`
        if (classDefinition.node.id) {
            variableName = classDefinition.node.id.name;
        }
    }
    else if (classDefinition.isClassExpression()) {
        let parentPath = classDefinition.parentPath;
        while (parentPath &&
            parentPath.node !== classDefinition.scope.block &&
            !parentPath.isBlockStatement()) {
            if (parentPath.isVariableDeclarator()) {
                const idPath = parentPath.get('id');
                if (idPath.isIdentifier()) {
                    variableName = idPath.node.name;
                    break;
                }
            }
            else if (parentPath.isAssignmentExpression()) {
                const leftPath = parentPath.get('left');
                if (leftPath.isIdentifier()) {
                    variableName = leftPath.node.name;
                    break;
                }
            }
            parentPath = parentPath.parentPath;
        }
    }
    if (!variableName) {
        return;
    }
    const state = {
        variableName,
        classDefinition,
    };
    classDefinition.parentPath.scope.path.traverse(explodedVisitors, state);
}
