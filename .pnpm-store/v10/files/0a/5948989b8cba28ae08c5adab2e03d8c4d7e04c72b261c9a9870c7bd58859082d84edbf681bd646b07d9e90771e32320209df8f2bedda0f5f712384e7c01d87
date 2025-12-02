'use strict';

var rust$1 = require('@lezer/rust');
var language = require('@codemirror/language');

/**
A syntax provider based on the [Lezer Rust
parser](https://github.com/lezer-parser/rust), extended with
highlighting and indentation information.
*/
const rustLanguage = language.LRLanguage.define({
    name: "rust",
    parser: rust$1.parser.configure({
        props: [
            language.indentNodeProp.add({
                IfExpression: language.continuedIndent({ except: /^\s*({|else\b)/ }),
                "String BlockComment": () => null,
                "AttributeItem": cx => cx.continue(),
                "Statement MatchArm": language.continuedIndent()
            }),
            language.foldNodeProp.add(type => {
                if (/(Block|edTokens|List)$/.test(type.name))
                    return language.foldInside;
                if (type.name == "BlockComment")
                    return tree => ({ from: tree.from + 2, to: tree.to - 2 });
                return undefined;
            })
        ]
    }),
    languageData: {
        commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*(?:\{|\})$/,
        closeBrackets: { stringPrefixes: ["b", "r", "br"] }
    }
});
/**
Rust language support
*/
function rust() {
    return new language.LanguageSupport(rustLanguage);
}

exports.rust = rust;
exports.rustLanguage = rustLanguage;
