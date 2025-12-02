<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-xml [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-xml.svg)](https://www.npmjs.org/package/@codemirror/lang-xml)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-xml/blob/main/CHANGELOG.md) ]

This package implements XML language support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-xml/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## API Reference

<dl>
<dt id="user-content-xml">
  <code><strong><a href="#user-content-xml">xml</a></strong>(<a id="user-content-xml^conf" href="#user-content-xml^conf">conf</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a> = {}) → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>XML language support. Includes schema-based autocompletion when
configured.</p>
<dl><dt id="user-content-xml^conf">
  <code><strong><a href="#user-content-xml^conf">conf</a></strong></code></dt>

<dd><dl><dt id="user-content-xml^conf.elements">
  <code><strong><a href="#user-content-xml^conf.elements">elements</a></strong>&#8288;?: readonly <a href="#user-content-elementspec">ElementSpec</a>[]</code></dt>

<dd><p>Provide a schema to create completions from.</p>
</dd><dt id="user-content-xml^conf.attributes">
  <code><strong><a href="#user-content-xml^conf.attributes">attributes</a></strong>&#8288;?: readonly <a href="#user-content-attrspec">AttrSpec</a>[]</code></dt>

<dd><p>Supporting attribute descriptions for the schema specified in
<a href="#user-content-xml%5econf.elements"><code>elements</code></a>.</p>
</dd><dt id="user-content-xml^conf.autoclosetags">
  <code><strong><a href="#user-content-xml^conf.autoclosetags">autoCloseTags</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Determines whether <a href="#user-content-autoclosetags"><code>autoCloseTags</code></a>
is included in the support extensions. Defaults to true.</p>
</dd></dl></dd></dl></dd>
<dt id="user-content-xmllanguage">
  <code><strong><a href="#user-content-xmllanguage">xmlLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>A language provider based on the <a href="https://github.com/lezer-parser/xml">Lezer XML
parser</a>, extended with
highlighting and indentation information.</p>
</dd>
<dt id="user-content-elementspec">
  <h4>
    <code>interface</code>
    <a href="#user-content-elementspec">ElementSpec</a></h4>
</dt>

<dd><p>Describes an element in your XML document schema.</p>
<dl><dt id="user-content-elementspec.name">
  <code><strong><a href="#user-content-elementspec.name">name</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The element name.</p>
</dd><dt id="user-content-elementspec.children">
  <code><strong><a href="#user-content-elementspec.children">children</a></strong>&#8288;?: readonly <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[]</code></dt>

<dd><p>Allowed children in this element. When not given, all elements
are allowed inside it.</p>
</dd><dt id="user-content-elementspec.textcontent">
  <code><strong><a href="#user-content-elementspec.textcontent">textContent</a></strong>&#8288;?: readonly <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[]</code></dt>

<dd><p>When given, allows users to complete the given content strings
as plain text when at the start of the element.</p>
</dd><dt id="user-content-elementspec.top">
  <code><strong><a href="#user-content-elementspec.top">top</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Whether this element may appear at the top of the document.</p>
</dd><dt id="user-content-elementspec.attributes">
  <code><strong><a href="#user-content-elementspec.attributes">attributes</a></strong>&#8288;?: readonly (<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="#user-content-attrspec">AttrSpec</a>)[]</code></dt>

<dd><p>Allowed attributes in this element. Strings refer to attributes
specified in <a href="#user-content-xmlconfig.attrs"><code>XMLConfig.attrs</code></a>, but
you can also provide one-off <a href="#user-content-attrspec">attribute
specs</a>. Attributes marked as
<a href="#user-content-attrspec.global"><code>global</code></a> are allowed in every
element, and don't have to be mentioned here.</p>
</dd><dt id="user-content-elementspec.completion">
  <code><strong><a href="#user-content-elementspec.completion">completion</a></strong>&#8288;?: <a href="https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype">Partial</a>&lt;<a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>&gt;</code></dt>

<dd><p>Can be provided to add extra fields to the
<a href="#user-content-autocompletion.completion">completion</a> object created for this
element.</p>
</dd></dl>

</dd>
<dt id="user-content-attrspec">
  <h4>
    <code>interface</code>
    <a href="#user-content-attrspec">AttrSpec</a></h4>
</dt>

<dd><p>Describes an attribute in your XML schema.</p>
<dl><dt id="user-content-attrspec.name">
  <code><strong><a href="#user-content-attrspec.name">name</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The attribute name.</p>
</dd><dt id="user-content-attrspec.values">
  <code><strong><a href="#user-content-attrspec.values">values</a></strong>&#8288;?: readonly (<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>)[]</code></dt>

<dd><p>Pre-defined values to complete for this attribute.</p>
</dd><dt id="user-content-attrspec.global">
  <code><strong><a href="#user-content-attrspec.global">global</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>When <code>true</code>, this attribute can be added to all elements.</p>
</dd><dt id="user-content-attrspec.completion">
  <code><strong><a href="#user-content-attrspec.completion">completion</a></strong>&#8288;?: <a href="https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype">Partial</a>&lt;<a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>&gt;</code></dt>

<dd><p>Provides extra fields to the
<a href="#user-content-autocompletion.completion">completion</a> object created for this
element</p>
</dd></dl>

</dd>
<dt id="user-content-completefromschema">
  <code><strong><a href="#user-content-completefromschema">completeFromSchema</a></strong>(<a id="user-content-completefromschema^eltspecs" href="#user-content-completefromschema^eltspecs">eltSpecs</a>: readonly <a href="#user-content-elementspec">ElementSpec</a>[], <a id="user-content-completefromschema^attrspecs" href="#user-content-completefromschema^attrspecs">attrSpecs</a>: readonly <a href="#user-content-attrspec">AttrSpec</a>[]) → <a href="https://codemirror.net/docs/ref#autocomplete.CompletionSource">CompletionSource</a></code></dt>

<dd><p>Create a completion source for the given schema.</p>
</dd>
<dt id="user-content-autoclosetags">
  <code><strong><a href="#user-content-autoclosetags">autoCloseTags</a></strong>: <a href="https://codemirror.net/docs/ref#state.Extension">Extension</a></code></dt>

<dd><p>Extension that will automatically insert close tags when a <code>&gt;</code> or
<code>/</code> is typed.</p>
</dd>
</dl>
