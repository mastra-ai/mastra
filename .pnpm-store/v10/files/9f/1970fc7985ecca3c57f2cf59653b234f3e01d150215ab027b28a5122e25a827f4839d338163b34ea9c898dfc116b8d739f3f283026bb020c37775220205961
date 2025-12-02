/**
 * Returns the path to the first part of the MemberExpression. I.e. given a
 * path representing
 *
 * foo.bar.baz
 *
 * it returns the path of/to `foo`.
 */
export default function getMemberExpressionRoot(memberExpressionPath) {
    let path = memberExpressionPath;
    while (path.isMemberExpression()) {
        path = path.get('object');
    }
    return path;
}
