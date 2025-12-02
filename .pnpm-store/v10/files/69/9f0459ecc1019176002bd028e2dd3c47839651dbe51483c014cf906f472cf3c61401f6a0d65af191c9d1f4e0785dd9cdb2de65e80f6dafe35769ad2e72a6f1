'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var sass$1 = require('@lezer/sass');
var language = require('@codemirror/language');
var langCss = require('@codemirror/lang-css');

/**
A language provider based on the [Lezer Sass
parser](https://github.com/lezer-parser/sass), extended with
highlighting and indentation information.
*/
const sassLanguage = language.LRLanguage.define({
    name: "sass",
    parser: sass$1.parser.configure({
        props: [
            language.foldNodeProp.add({
                Block: language.foldInside,
                Comment(node, state) {
                    return { from: node.from + 2, to: state.sliceDoc(node.to - 2, node.to) == "*/" ? node.to - 2 : node.to };
                }
            }),
            language.indentNodeProp.add({
                Declaration: language.continuedIndent()
            })
        ]
    }),
    languageData: {
        commentTokens: { block: { open: "/*", close: "*/" }, line: "//" },
        indentOnInput: /^\s*\}$/,
        wordChars: "$-"
    }
});
const indentedSassLanguage = sassLanguage.configure({
    dialect: "indented",
    props: [
        language.indentNodeProp.add({
            "Block RuleSet": cx => cx.baseIndent + cx.unit
        }),
        language.foldNodeProp.add({
            Block: node => ({ from: node.from, to: node.to })
        })
    ]
});
/**
Property, variable, $-variable, and value keyword completion
source.
*/
const sassCompletionSource = langCss.defineCSSCompletionSource(node => node.name == "VariableName" || node.name == "SassVariableName");
/**
Language support for CSS.
*/
function sass(config) {
    return new language.LanguageSupport((config === null || config === void 0 ? void 0 : config.indented) ? indentedSassLanguage : sassLanguage, sassLanguage.data.of({ autocomplete: sassCompletionSource }));
}

exports.sass = sass;
exports.sassCompletionSource = sassCompletionSource;
exports.sassLanguage = sassLanguage;
