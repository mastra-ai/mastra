import strip from 'strip-indent';
function deindent(code) {
    const firstNewLine = code.indexOf('\n');
    return (code.slice(0, firstNewLine + 1) +
        // remove indentation from all lines except first.
        strip(code.slice(firstNewLine + 1)));
}
/**
 * Prints the given path without leading or trailing comments.
 */
export default function printValue(path) {
    let source = path.getSource();
    // variable declarations and interface/type/class members might end with one of these
    if (source.endsWith(',') || source.endsWith(';')) {
        source = source.slice(0, -1);
    }
    return deindent(source);
}
