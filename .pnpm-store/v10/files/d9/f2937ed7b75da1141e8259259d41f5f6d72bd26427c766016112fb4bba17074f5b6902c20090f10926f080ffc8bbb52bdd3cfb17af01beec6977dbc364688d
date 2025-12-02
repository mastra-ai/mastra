import { parser } from '@lezer/java';
import { LRLanguage, indentNodeProp, continuedIndent, flatIndent, delimitedIndent, foldNodeProp, foldInside, LanguageSupport } from '@codemirror/language';

/**
A language provider based on the [Lezer Java
parser](https://github.com/lezer-parser/java), extended with
highlighting and indentation information.
*/
const javaLanguage = /*@__PURE__*/LRLanguage.define({
    name: "java",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                IfStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|else\b)/ }),
                TryStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|catch|finally)\b/ }),
                LabeledStatement: flatIndent,
                SwitchBlock: context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
                },
                Block: /*@__PURE__*/delimitedIndent({ closing: "}" }),
                BlockComment: () => null,
                Statement: /*@__PURE__*/continuedIndent({ except: /^{/ })
            }),
            /*@__PURE__*/foldNodeProp.add({
                ["Block SwitchBlock ClassBody ElementValueArrayInitializer ModuleBody EnumBody " +
                    "ConstructorBody InterfaceBody ArrayInitializer"]: foldInside,
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
    return new LanguageSupport(javaLanguage);
}

export { java, javaLanguage };
