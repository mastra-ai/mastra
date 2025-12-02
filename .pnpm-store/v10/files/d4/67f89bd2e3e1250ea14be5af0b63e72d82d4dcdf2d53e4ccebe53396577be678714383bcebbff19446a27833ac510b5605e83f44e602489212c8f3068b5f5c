'use strict';

var cpp$1 = require('@lezer/cpp');
var language = require('@codemirror/language');

/**
A language provider based on the [Lezer C++
parser](https://github.com/lezer-parser/cpp), extended with
highlighting and indentation information.
*/
const cppLanguage = language.LRLanguage.define({
    name: "cpp",
    parser: cpp$1.parser.configure({
        props: [
            language.indentNodeProp.add({
                IfStatement: language.continuedIndent({ except: /^\s*({|else\b)/ }),
                TryStatement: language.continuedIndent({ except: /^\s*({|catch)\b/ }),
                LabeledStatement: language.flatIndent,
                CaseStatement: context => context.baseIndent + context.unit,
                BlockComment: () => null,
                CompoundStatement: language.delimitedIndent({ closing: "}" }),
                Statement: language.continuedIndent({ except: /^{/ })
            }),
            language.foldNodeProp.add({
                "DeclarationList CompoundStatement EnumeratorList FieldDeclarationList InitializerList": language.foldInside,
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
    return new language.LanguageSupport(cppLanguage);
}

exports.cpp = cpp;
exports.cppLanguage = cppLanguage;
