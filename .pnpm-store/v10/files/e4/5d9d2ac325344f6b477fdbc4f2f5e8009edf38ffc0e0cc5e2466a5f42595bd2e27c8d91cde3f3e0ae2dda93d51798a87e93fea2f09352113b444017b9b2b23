import { parser } from '@lezer/cpp';
import { LRLanguage, indentNodeProp, continuedIndent, flatIndent, delimitedIndent, foldNodeProp, foldInside, LanguageSupport } from '@codemirror/language';

/**
A language provider based on the [Lezer C++
parser](https://github.com/lezer-parser/cpp), extended with
highlighting and indentation information.
*/
const cppLanguage = /*@__PURE__*/LRLanguage.define({
    name: "cpp",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                IfStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|else\b)/ }),
                TryStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|catch)\b/ }),
                LabeledStatement: flatIndent,
                CaseStatement: context => context.baseIndent + context.unit,
                BlockComment: () => null,
                CompoundStatement: /*@__PURE__*/delimitedIndent({ closing: "}" }),
                Statement: /*@__PURE__*/continuedIndent({ except: /^{/ })
            }),
            /*@__PURE__*/foldNodeProp.add({
                "DeclarationList CompoundStatement EnumeratorList FieldDeclarationList InitializerList": foldInside,
                BlockComment(tree) { return { from: tree.from + 2, to: tree.to - 2 }; }
            })
        ]
    }),
    languageData: {
        commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*(?:case |default:|\{|\})$/,
        closeBrackets: { stringPrefixes: ["L", "u", "U", "u8", "LR", "UR", "uR", "u8R", "R"] }
    }
});
/**
Language support for C++.
*/
function cpp() {
    return new LanguageSupport(cppLanguage);
}

export { cpp, cppLanguage };
