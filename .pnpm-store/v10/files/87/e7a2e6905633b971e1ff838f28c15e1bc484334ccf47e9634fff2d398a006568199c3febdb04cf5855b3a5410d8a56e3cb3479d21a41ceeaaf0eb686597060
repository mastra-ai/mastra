import { parser } from '@lezer/xml';
import { syntaxTree, LRLanguage, indentNodeProp, foldNodeProp, bracketMatchingHandle, LanguageSupport } from '@codemirror/language';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

function tagName(doc, tag) {
    let name = tag && tag.getChild("TagName");
    return name ? doc.sliceString(name.from, name.to) : "";
}
function elementName$1(doc, tree) {
    let tag = tree && tree.firstChild;
    return !tag || tag.name != "OpenTag" ? "" : tagName(doc, tag);
}
function attrName(doc, tag, pos) {
    let attr = tag && tag.getChildren("Attribute").find(a => a.from <= pos && a.to >= pos);
    let name = attr && attr.getChild("AttributeName");
    return name ? doc.sliceString(name.from, name.to) : "";
}
function findParentElement(tree) {
    for (let cur = tree && tree.parent; cur; cur = cur.parent)
        if (cur.name == "Element")
            return cur;
    return null;
}
function findLocation(state, pos) {
    var _a;
    let at = syntaxTree(state).resolveInner(pos, -1), inTag = null;
    for (let cur = at; !inTag && cur.parent; cur = cur.parent)
        if (cur.name == "OpenTag" || cur.name == "CloseTag" || cur.name == "SelfClosingTag" || cur.name == "MismatchedCloseTag")
            inTag = cur;
    if (inTag && (inTag.to > pos || inTag.lastChild.type.isError)) {
        let elt = inTag.parent;
        if (at.name == "TagName")
            return inTag.name == "CloseTag" || inTag.name == "MismatchedCloseTag"
                ? { type: "closeTag", from: at.from, context: elt }
                : { type: "openTag", from: at.from, context: findParentElement(elt) };
        if (at.name == "AttributeName")
            return { type: "attrName", from: at.from, context: inTag };
        if (at.name == "AttributeValue")
            return { type: "attrValue", from: at.from, context: inTag };
        let before = at == inTag || at.name == "Attribute" ? at.childBefore(pos) : at;
        if ((before === null || before === void 0 ? void 0 : before.name) == "StartTag")
            return { type: "openTag", from: pos, context: findParentElement(elt) };
        if ((before === null || before === void 0 ? void 0 : before.name) == "StartCloseTag" && before.to <= pos)
            return { type: "closeTag", from: pos, context: elt };
        if ((before === null || before === void 0 ? void 0 : before.name) == "Is")
            return { type: "attrValue", from: pos, context: inTag };
        if (before)
            return { type: "attrName", from: pos, context: inTag };
        return null;
    }
    else if (at.name == "StartCloseTag") {
        return { type: "closeTag", from: pos, context: at.parent };
    }
    while (at.parent && at.to == pos && !((_a = at.lastChild) === null || _a === void 0 ? void 0 : _a.type.isError))
        at = at.parent;
    if (at.name == "Element" || at.name == "Text" || at.name == "Document")
        return { type: "tag", from: pos, context: at.name == "Element" ? at : findParentElement(at) };
    return null;
}
class Element {
    constructor(spec, attrs, attrValues) {
        this.attrs = attrs;
        this.attrValues = attrValues;
        this.children = [];
        this.name = spec.name;
        this.completion = Object.assign(Object.assign({ type: "type" }, spec.completion || {}), { label: this.name });
        this.openCompletion = Object.assign(Object.assign({}, this.completion), { label: "<" + this.name });
        this.closeCompletion = Object.assign(Object.assign({}, this.completion), { label: "</" + this.name + ">", boost: 2 });
        this.closeNameCompletion = Object.assign(Object.assign({}, this.completion), { label: this.name + ">" });
        this.text = spec.textContent ? spec.textContent.map(s => ({ label: s, type: "text" })) : [];
    }
}
const Identifier = /^[:\-\.\w\u00b7-\uffff]*$/;
function attrCompletion(spec) {
    return Object.assign(Object.assign({ type: "property" }, spec.completion || {}), { label: spec.name });
}
function valueCompletion(spec) {
    return typeof spec == "string" ? { label: `"${spec}"`, type: "constant" }
        : /^"/.test(spec.label) ? spec
            : Object.assign(Object.assign({}, spec), { label: `"${spec.label}"` });
}
/**
Create a completion source for the given schema.
*/
function completeFromSchema(eltSpecs, attrSpecs) {
    let allAttrs = [], globalAttrs = [];
    let attrValues = Object.create(null);
    for (let s of attrSpecs) {
        let completion = attrCompletion(s);
        allAttrs.push(completion);
        if (s.global)
            globalAttrs.push(completion);
        if (s.values)
            attrValues[s.name] = s.values.map(valueCompletion);
    }
    let allElements = [], topElements = [];
    let byName = Object.create(null);
    for (let s of eltSpecs) {
        let attrs = globalAttrs, attrVals = attrValues;
        if (s.attributes)
            attrs = attrs.concat(s.attributes.map(s => {
                if (typeof s == "string")
                    return allAttrs.find(a => a.label == s) || { label: s, type: "property" };
                if (s.values) {
                    if (attrVals == attrValues)
                        attrVals = Object.create(attrVals);
                    attrVals[s.name] = s.values.map(valueCompletion);
                }
                return attrCompletion(s);
            }));
        let elt = new Element(s, attrs, attrVals);
        byName[elt.name] = elt;
        allElements.push(elt);
        if (s.top)
            topElements.push(elt);
    }
    if (!topElements.length)
        topElements = allElements;
    for (let i = 0; i < allElements.length; i++) {
        let s = eltSpecs[i], elt = allElements[i];
        if (s.children) {
            for (let ch of s.children)
                if (byName[ch])
                    elt.children.push(byName[ch]);
        }
        else {
            elt.children = allElements;
        }
    }
    return cx => {
        var _a;
        let { doc } = cx.state, loc = findLocation(cx.state, cx.pos);
        if (!loc || (loc.type == "tag" && !cx.explicit))
            return null;
        let { type, from, context } = loc;
        if (type == "openTag") {
            let children = topElements;
            let parentName = elementName$1(doc, context);
            if (parentName) {
                let parent = byName[parentName];
                children = (parent === null || parent === void 0 ? void 0 : parent.children) || allElements;
            }
            return {
                from,
                options: children.map(ch => ch.completion),
                validFor: Identifier
            };
        }
        else if (type == "closeTag") {
            let parentName = elementName$1(doc, context);
            return parentName ? {
                from,
                to: cx.pos + (doc.sliceString(cx.pos, cx.pos + 1) == ">" ? 1 : 0),
                options: [((_a = byName[parentName]) === null || _a === void 0 ? void 0 : _a.closeNameCompletion) || { label: parentName + ">", type: "type" }],
                validFor: Identifier
            } : null;
        }
        else if (type == "attrName") {
            let parent = byName[tagName(doc, context)];
            return {
                from,
                options: (parent === null || parent === void 0 ? void 0 : parent.attrs) || globalAttrs,
                validFor: Identifier
            };
        }
        else if (type == "attrValue") {
            let attr = attrName(doc, context, from);
            if (!attr)
                return null;
            let parent = byName[tagName(doc, context)];
            let values = ((parent === null || parent === void 0 ? void 0 : parent.attrValues) || attrValues)[attr];
            if (!values || !values.length)
                return null;
            return {
                from,
                to: cx.pos + (doc.sliceString(cx.pos, cx.pos + 1) == '"' ? 1 : 0),
                options: values,
                validFor: /^"[^"]*"?$/
            };
        }
        else if (type == "tag") {
            let parentName = elementName$1(doc, context), parent = byName[parentName];
            let closing = [], last = context && context.lastChild;
            if (parentName && (!last || last.name != "CloseTag" || tagName(doc, last) != parentName))
                closing.push(parent ? parent.closeCompletion : { label: "</" + parentName + ">", type: "type", boost: 2 });
            let options = closing.concat(((parent === null || parent === void 0 ? void 0 : parent.children) || (context ? allElements : topElements)).map(e => e.openCompletion));
            if (context && (parent === null || parent === void 0 ? void 0 : parent.text.length)) {
                let openTag = context.firstChild;
                if (openTag.to > cx.pos - 20 && !/\S/.test(cx.state.sliceDoc(openTag.to, cx.pos)))
                    options = options.concat(parent.text);
            }
            return {
                from,
                options,
                validFor: /^<\/?[:\-\.\w\u00b7-\uffff]*$/
            };
        }
        else {
            return null;
        }
    };
}

/**
A language provider based on the [Lezer XML
parser](https://github.com/lezer-parser/xml), extended with
highlighting and indentation information.
*/
const xmlLanguage = /*@__PURE__*/LRLanguage.define({
    name: "xml",
    parser: /*@__PURE__*/parser.configure({
        props: [
            /*@__PURE__*/indentNodeProp.add({
                Element(context) {
                    let closed = /^\s*<\//.test(context.textAfter);
                    return context.lineIndent(context.node.from) + (closed ? 0 : context.unit);
                },
                "OpenTag CloseTag SelfClosingTag"(context) {
                    return context.column(context.node.from) + context.unit;
                }
            }),
            /*@__PURE__*/foldNodeProp.add({
                Element(subtree) {
                    let first = subtree.firstChild, last = subtree.lastChild;
                    if (!first || first.name != "OpenTag")
                        return null;
                    return { from: first.to, to: last.name == "CloseTag" ? last.from : subtree.to };
                }
            }),
            /*@__PURE__*/bracketMatchingHandle.add({
                "OpenTag CloseTag": node => node.getChild("TagName")
            })
        ]
    }),
    languageData: {
        commentTokens: { block: { open: "<!--", close: "-->" } },
        indentOnInput: /^\s*<\/$/
    }
});
/**
XML language support. Includes schema-based autocompletion when
configured.
*/
function xml(conf = {}) {
    let support = [xmlLanguage.data.of({
            autocomplete: completeFromSchema(conf.elements || [], conf.attributes || [])
        })];
    if (conf.autoCloseTags !== false)
        support.push(autoCloseTags);
    return new LanguageSupport(xmlLanguage, support);
}
function elementName(doc, tree, max = doc.length) {
    if (!tree)
        return "";
    let tag = tree.firstChild;
    let name = tag && tag.getChild("TagName");
    return name ? doc.sliceString(name.from, Math.min(name.to, max)) : "";
}
/**
Extension that will automatically insert close tags when a `>` or
`/` is typed.
*/
const autoCloseTags = /*@__PURE__*/EditorView.inputHandler.of((view, from, to, text, insertTransaction) => {
    if (view.composing || view.state.readOnly || from != to || (text != ">" && text != "/") ||
        !xmlLanguage.isActiveAt(view.state, from, -1))
        return false;
    let base = insertTransaction(), { state } = base;
    let closeTags = state.changeByRange(range => {
        var _a, _b, _c;
        let { head } = range;
        let didType = state.doc.sliceString(head - 1, head) == text;
        let after = syntaxTree(state).resolveInner(head, -1), name;
        if (didType && text == ">" && after.name == "EndTag") {
            let tag = after.parent;
            if (((_b = (_a = tag.parent) === null || _a === void 0 ? void 0 : _a.lastChild) === null || _b === void 0 ? void 0 : _b.name) != "CloseTag" &&
                (name = elementName(state.doc, tag.parent, head))) {
                let to = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0);
                let insert = `</${name}>`;
                return { range, changes: { from: head, to, insert } };
            }
        }
        else if (didType && text == "/" && after.name == "StartCloseTag") {
            let base = after.parent;
            if (after.from == head - 2 && ((_c = base.lastChild) === null || _c === void 0 ? void 0 : _c.name) != "CloseTag" &&
                (name = elementName(state.doc, base, head))) {
                let to = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0);
                let insert = `${name}>`;
                return {
                    range: EditorSelection.cursor(head + insert.length, -1),
                    changes: { from: head, to, insert }
                };
            }
        }
        return { range };
    });
    if (closeTags.changes.empty)
        return false;
    view.dispatch([
        base,
        state.update(closeTags, {
            userEvent: "input.complete",
            scrollIntoView: true
        })
    ]);
    return true;
});

export { autoCloseTags, completeFromSchema, xml, xmlLanguage };
