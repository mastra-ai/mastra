import { parser } from '@lezer/sass';
import { LRLanguage, foldNodeProp, foldInside, indentNodeProp, continuedIndent, LanguageSupport } from '@codemirror/language';
import { defineCSSCompletionSource } from '@codemirror/lang-css';

/**
A language provider based on the [Lezer Sass
parser](https://github.com/lezer-parser/sass), extended with
highlighting and indentation information.
*/
const sassLanguage = /*@__PURE__*/LRLanguage.define({
    name: "sass",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/foldNodeProp.add({
                Block: foldInside,
                Comment(node, state) {
                    return { from: node.from + 2, to: state.sliceDoc(node.to - 2, node.to) == "*/" ? node.to - 2 : node.to };
                }
            }),
            /*@__PURE__*/indentNodeProp.add({
                Declaration: /*@__PURE__*/continuedIndent()
            })
        ]
    }),
    languageData: {
        commentTokens: { block: { open: "/*", close: "*/" }, line: "//" },
        indentOnInput: /^\s*\}$/,
        wordChars: "$-"
    }
});
const indentedSassLanguage = /*@__PURE__*/sassLanguage.configure({
    dialect: "indented",
    props: [
        /*@__PURE__*/indentNodeProp.add({
            "Block RuleSet": cx => cx.baseIndent + cx.unit
        }),
        /*@__PURE__*/foldNodeProp.add({
            Block: node => ({ from: node.from, to: node.to })
        })
    ]
});
/**
Property, variable, $-variable, and value keyword completion
source.
*/
const sassCompletionSource = /*@__PURE__*/defineCSSCompletionSource(node => node.name == "VariableName" || node.name == "SassVariableName");
/**
Language support for CSS.
*/
function sass(config) {
    return new LanguageSupport((config === null || config === void 0 ? void 0 : config.indented) ? indentedSassLanguage : sassLanguage, sassLanguage.data.of({ autocomplete: sassCompletionSource }));
}

export { sass, sassCompletionSource, sassLanguage };
