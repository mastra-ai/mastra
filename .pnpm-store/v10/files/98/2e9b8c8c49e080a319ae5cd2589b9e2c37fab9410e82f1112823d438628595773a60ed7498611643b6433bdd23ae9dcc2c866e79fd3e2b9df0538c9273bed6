'use strict';

var php$1 = require('@lezer/php');
var common = require('@lezer/common');
var langHtml = require('@codemirror/lang-html');
var language = require('@codemirror/language');

/**
A language provider based on the [Lezer PHP
parser](https://github.com/lezer-parser/php), extended with
highlighting and indentation information.
*/
const phpLanguage = language.LRLanguage.define({
    name: "php",
    parser: php$1.parser.configure({
        props: [
            language.indentNodeProp.add({
                IfStatement: language.continuedIndent({ except: /^\s*({|else\b|elseif\b|endif\b)/ }),
                TryStatement: language.continuedIndent({ except: /^\s*({|catch\b|finally\b)/ }),
                SwitchBody: context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
                },
                ColonBlock: cx => cx.baseIndent + cx.unit,
                "Block EnumBody DeclarationList": language.delimitedIndent({ closing: "}" }),
                ArrowFunction: cx => cx.baseIndent + cx.unit,
                "String BlockComment": () => null,
                Statement: language.continuedIndent({ except: /^({|end(for|foreach|switch|while)\b)/ })
            }),
            language.foldNodeProp.add({
                "Block EnumBody DeclarationList SwitchBody ArrayExpression ValueList": language.foldInside,
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
        let htmlSupport = langHtml.html({ matchClosingTags: false });
        support.push(htmlSupport.support);
        base = htmlSupport.language;
    }
    return new language.LanguageSupport(phpLanguage.configure({
        wrap: base && common.parseMixed(node => {
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

exports.php = php;
exports.phpLanguage = phpLanguage;
