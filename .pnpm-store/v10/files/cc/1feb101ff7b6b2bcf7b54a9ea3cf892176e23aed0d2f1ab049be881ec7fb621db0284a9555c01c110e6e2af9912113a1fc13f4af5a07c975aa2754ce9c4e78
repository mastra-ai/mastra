import { parser } from '@lezer/rust';
import { LRLanguage, indentNodeProp, continuedIndent, foldNodeProp, foldInside, LanguageSupport } from '@codemirror/language';

/**
A syntax provider based on the [Lezer Rust
parser](https://github.com/lezer-parser/rust), extended with
highlighting and indentation information.
*/
const rustLanguage = /*@__PURE__*/LRLanguage.define({
    name: "rust",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                IfExpression: /*@__PURE__*/continuedIndent({ except: /^\s*({|else\b)/ }),
                "String BlockComment": () => null,
                "AttributeItem": cx => cx.continue(),
                "Statement MatchArm": /*@__PURE__*/continuedIndent()
            }),
            /*@__PURE__*/foldNodeProp.add(type => {
                if (/(Block|edTokens|List)$/.test(type.name))
                    return foldInside;
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
    return new LanguageSupport(rustLanguage);
}

export { rust, rustLanguage };
