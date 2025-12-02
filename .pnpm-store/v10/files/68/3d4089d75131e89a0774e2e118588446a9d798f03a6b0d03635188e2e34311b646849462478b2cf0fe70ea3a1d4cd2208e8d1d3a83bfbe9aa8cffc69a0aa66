/**
 * Given a "nested" Member/CallExpression, e.g.
 *
 * foo.bar()[baz][42]
 *
 * this returns a list of "members". In this example it would be something like
 * [
 *   {path: NodePath<bar>, arguments: NodePath<empty>, computed: false},
 *   {path: NodePath<baz>, arguments: null, computed: true},
 *   {path: NodePath<42>, arguments: null, computed: false}
 * ]
 */
export default function getMembers(path, includeRoot = false) {
    const result = [];
    let argumentPaths = [];
    let resultPath = path;
    while (true) {
        if (resultPath.isMemberExpression()) {
            const property = resultPath.get('property');
            result.push({
                path: property,
                computed: resultPath.node.computed,
                argumentPaths,
            });
            argumentPaths = [];
            resultPath = resultPath.get('object');
        }
        else if (resultPath.isCallExpression()) {
            const callee = resultPath.get('callee');
            if (callee.isExpression()) {
                argumentPaths = resultPath.get('arguments');
                resultPath = callee;
            }
            else {
                break;
            }
        }
        else {
            break;
        }
    }
    if (includeRoot && result.length > 0) {
        result.push({
            path: resultPath,
            computed: false,
            argumentPaths,
        });
    }
    return result.reverse();
}
