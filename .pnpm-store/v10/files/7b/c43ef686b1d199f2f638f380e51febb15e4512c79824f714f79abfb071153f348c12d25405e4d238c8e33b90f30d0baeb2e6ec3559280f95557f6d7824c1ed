'use strict';

var java$1 = require('@lezer/java');
var language = require('@codemirror/language');

/**
A language provider based on the [Lezer Java
parser](https://github.com/lezer-parser/java), extended with
highlighting and indentation information.
*/
const javaLanguage = language.LRLanguage.define({
    name: "java",
    parser: java$1.parser.configure({
        props: [
            language.indentNodeProp.add({
                IfStatement: language.continuedIndent({ except: /^\s*({|else\b)/ }),
                TryStatement: language.continuedIndent({ except: /^\s*({|catch|finally)\b/ }),
                LabeledStatement: language.flatIndent,
                SwitchBlock: context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
                },
                Block: language.delimitedIndent({ closing: "}" }),
                BlockComment: () => null,
                Statement: language.continuedIndent({ except: /^{/ })
            }),
            language.foldNodeProp.add({
                ["Block SwitchBlock ClassBody ElementValueArrayInitializer ModuleBody EnumBody " +
                    "ConstructorBody InterfaceBody ArrayInitializer"]: language.foldInside,
                BlockComment(tree) { return { from: tree.from + 2, to: tree.to - 2 }; }
            })
        ]
    }),
    languageData: {
        commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*(?:case |default:|\{|\})$/
    }
});
/**
Java language support.
*/
function java() {
    return new language.LanguageSupport(javaLanguage);
}

exports.java = java;
exports.javaLanguage = javaLanguage;
