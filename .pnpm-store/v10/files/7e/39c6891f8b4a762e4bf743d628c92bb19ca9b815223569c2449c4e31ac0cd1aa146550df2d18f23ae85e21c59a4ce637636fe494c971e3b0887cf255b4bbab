import { parser } from '@lezer/php';
import { parseMixed } from '@lezer/common';
import { html } from '@codemirror/lang-html';
import { LRLanguage, indentNodeProp, continuedIndent, delimitedIndent, foldNodeProp, foldInside, LanguageSupport } from '@codemirror/language';

/**
A language provider based on the [Lezer PHP
parser](https://github.com/lezer-parser/php), extended with
highlighting and indentation information.
*/
const phpLanguage = /*@__PURE__*/LRLanguage.define({
    name: "php",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                IfStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|else\b|elseif\b|endif\b)/ }),
                TryStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|catch\b|finally\b)/ }),
                SwitchBody: context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
                },
                ColonBlock: cx => cx.baseIndent + cx.unit,
                "Block EnumBody DeclarationList": /*@__PURE__*/delimitedIndent({ closing: "}" }),
                ArrowFunction: cx => cx.baseIndent + cx.unit,
                "String BlockComment": () => null,
                Statement: /*@__PURE__*/continuedIndent({ except: /^({|end(for|foreach|switch|while)\b)/ })
            }),
            /*@__PURE__*/foldNodeProp.add({
                "Block EnumBody DeclarationList SwitchBody ArrayExpression ValueList": foldInside,
                ColonBlock(tree) { return { from: tree.from + 1, to: tree.to }; },
                BlockComment(tree) { return { from: tree.from + 2, to: tree.to - 2 }; }
            })
        ]
    }),
    languageData: {
        commentTokens: { block: { open: "/*", close: "*/" }, line: "//" },
        indentOnInput: /^\s*(?:case |default:|end(?:if|for(?:each)?|switch|while)|else(?:if)?|\{|\})$/,
        wordChars: "$",
        closeBrackets: { stringPrefixes: ["b", "B"] }
    }
});
/**
PHP language support.
*/
function php(config = {}) {
    let support = [], base;
    if (config.baseLanguage === null) ;
    else if (config.baseLanguage) {
        base = config.baseLanguage;
    }
    else {
        let htmlSupport = html({ matchClosingTags: false });
        support.push(htmlSupport.support);
        base = htmlSupport.language;
    }
    return new LanguageSupport(phpLanguage.configure({
        wrap: base && parseMixed(node => {
            if (!node.type.isTop)
                return null;
            return {
                parser: base.parser,
                overlay: node => node.name == "Text"
            };
        }),
        top: config.plain ? "Program" : "Template"
    }), support);
}

export { php, phpLanguage };
