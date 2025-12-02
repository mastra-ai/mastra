import { parser } from '@lezer/go';
import { syntaxTree, LRLanguage, indentNodeProp, continuedIndent, flatIndent, delimitedIndent, foldNodeProp, foldInside, LanguageSupport } from '@codemirror/language';
import { snippetCompletion, ifNotIn, completeFromList } from '@codemirror/autocomplete';
import { NodeWeakMap, IterMode } from '@lezer/common';

/**
A collection of Go-related [snippets](https://codemirror.net/6/docs/ref/#autocomplete.snippet).
*/
const snippets = [
    /*@__PURE__*/snippetCompletion("func ${name}(${params}) ${type} {\n\t${}\n}", {
        label: "func",
        detail: "declaration",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("func (${receiver}) ${name}(${params}) ${type} {\n\t${}\n}", {
        label: "func",
        detail: "method declaration",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("var ${name} = ${value}", {
        label: "var",
        detail: "declaration",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("type ${name} ${type}", {
        label: "type",
        detail: "declaration",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("const ${name} = ${value}", {
        label: "const",
        detail: "declaration",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("type ${name} = ${type}", {
        label: "type",
        detail: "alias declaration",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("for ${init}; ${test}; ${update} {\n\t${}\n}", {
        label: "for",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("for ${i} := range ${value} {\n\t${}\n}", {
        label: "for",
        detail: "range",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("select {\n\t${}\n}", {
        label: "select",
        detail: "statement",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("case ${}:\n${}", {
        label: "case",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("switch ${} {\n\t${}\n}", {
        label: "switch",
        detail: "statement",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("switch ${}.(${type}) {\n\t${}\n}", {
        label: "switch",
        detail: "type statement",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("if ${} {\n\t${}\n}", {
        label: "if",
        detail: "block",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("if ${} {\n\t${}\n} else {\n\t${}\n}", {
        label: "if",
        detail: "/ else block",
        type: "keyword"
    }),
    /*@__PURE__*/snippetCompletion("import ${name} \"${module}\"\n${}", {
        label: "import",
        detail: "declaration",
        type: "keyword"
    }),
];

const cache = /*@__PURE__*/new NodeWeakMap();
const ScopeNodes = /*@__PURE__*/new Set([
    "SourceFile", "Block",
    "FunctionDecl", "MethodDecl", "FunctionLiteral",
    "ForStatement", "SwitchStatement", "TypeSwitchStatement", "IfStatement",
]);
function defIDs(type, spec) {
    return (node, def) => {
        outer: for (let cur = node.node.firstChild, depth = 0, parent = null;;) {
            while (!cur) {
                if (!depth)
                    break outer;
                depth--;
                cur = parent.nextSibling;
                parent = parent.parent;
            }
            if (spec && cur.name == spec || cur.name == "SpecList") {
                depth++;
                parent = cur;
                cur = cur.firstChild;
            }
            else {
                if (cur.name == "DefName")
                    def(cur, type);
                cur = cur.nextSibling;
            }
        }
        return true;
    };
}
const gatherCompletions = {
    FunctionDecl: /*@__PURE__*/defIDs("function"),
    VarDecl: /*@__PURE__*/defIDs("var", "VarSpec"),
    ConstDecl: /*@__PURE__*/defIDs("constant", "ConstSpec"),
    TypeDecl: /*@__PURE__*/defIDs("type", "TypeSpec"),
    ImportDecl: /*@__PURE__*/defIDs("constant", "ImportSpec"),
    Parameter: /*@__PURE__*/defIDs("var"),
    __proto__: null
};
function getScope(doc, node) {
    let cached = cache.get(node);
    if (cached)
        return cached;
    let completions = [], top = true;
    function def(node, type) {
        let name = doc.sliceString(node.from, node.to);
        completions.push({ label: name, type });
    }
    node.cursor(IterMode.IncludeAnonymous).iterate(node => {
        if (top) {
            top = false;
        }
        else if (node.name) {
            let gather = gatherCompletions[node.name];
            if (gather && gather(node, def) || ScopeNodes.has(node.name))
                return false;
        }
        else if (node.to - node.from > 8192) {
            // Allow caching for bigger internal nodes
            for (let c of getScope(doc, node.node))
                completions.push(c);
            return false;
        }
    });
    cache.set(node, completions);
    return completions;
}
const Identifier = /^[\w$\xa1-\uffff][\w$\d\xa1-\uffff]*$/;
const dontComplete = [
    "String", "LineComment", "BlockComment",
    "DefName", "LabelName", "FieldName",
    ".", "?."
];
/**
Completion source that looks up locally defined names in Go code.
*/
const localCompletionSource = context => {
    let inner = syntaxTree(context.state).resolveInner(context.pos, -1);
    if (dontComplete.indexOf(inner.name) > -1)
        return null;
    let isWord = inner.name == "VariableName" ||
        inner.to - inner.from < 20 && Identifier.test(context.state.sliceDoc(inner.from, inner.to));
    if (!isWord && !context.explicit)
        return null;
    let options = [];
    for (let pos = inner; pos; pos = pos.parent) {
        if (ScopeNodes.has(pos.name))
            options = options.concat(getScope(context.state.doc, pos));
    }
    return {
        options,
        from: isWord ? inner.from : context.pos,
        validFor: Identifier
    };
};

/**
A language provider based on the [Lezer Go
parser](https://github.com/lezer-parser/go), extended with
folding and indentation information.
*/
const goLanguage = /*@__PURE__*/LRLanguage.define({
    name: "go",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                IfStatement: /*@__PURE__*/continuedIndent({ except: /^\s*({|else\b)/ }),
                LabeledStatement: flatIndent,
                "SwitchBlock SelectBlock": context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed || isCase ? 0 : context.unit);
                },
                Block: /*@__PURE__*/delimitedIndent({ closing: "}" }),
                BlockComment: () => null,
                Statement: /*@__PURE__*/continuedIndent({ except: /^{/ }),
            }),
            /*@__PURE__*/foldNodeProp.add({
                "Block SwitchBlock SelectBlock LiteralValue InterfaceType StructType SpecList": foldInside,
                BlockComment(tree) { return { from: tree.from + 2, to: tree.to - 2 }; }
            })
        ]
    }),
    languageData: {
        closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
        commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*(?:case\b|default\b|\})$/
    }
});
let kwCompletion = (name) => ({ label: name, type: "keyword" });
const keywords = /*@__PURE__*/"interface struct chan map package go return break continue goto fallthrough else defer range true false nil".split(" ").map(kwCompletion);
/**
Go support. Includes [snippet](https://codemirror.net/6/docs/ref/#lang-go.snippets) and local
variable completion.
*/
function go() {
    let completions = snippets.concat(keywords);
    return new LanguageSupport(goLanguage, [
        goLanguage.data.of({
            autocomplete: ifNotIn(dontComplete, completeFromList(completions))
        }),
        goLanguage.data.of({
            autocomplete: localCompletionSource
        })
    ]);
}

export { go, goLanguage, localCompletionSource, snippets };
