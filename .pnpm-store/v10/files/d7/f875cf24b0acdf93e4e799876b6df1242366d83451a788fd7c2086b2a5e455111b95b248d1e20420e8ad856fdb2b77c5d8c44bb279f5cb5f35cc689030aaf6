<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-liquid [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-liquid.svg)](https://www.npmjs.org/package/@codemirror/lang-liquid)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-liquid/blob/main/CHANGELOG.md) ]

This package implements [Liquid
template](https://shopify.github.io/liquid/) support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-liquid/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {liquid} from "@codemirror/lang-liquid"

const view = new EditorView({
  parent: document.body,
  doc: `{% if a.active %}{{ a.title }}{% endif %}`,
  extensions: [basicSetup, liquid()]
})
```

## API Reference

<dl>
<dt id="user-content-liquid">
  <code><strong><a href="#user-content-liquid">liquid</a></strong>(<a id="user-content-liquid^config" href="#user-content-liquid^config">config</a>&#8288;?: <a href="#user-content-liquidcompletionconfig">LiquidCompletionConfig</a> &amp; <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a> = {}) → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>Liquid template support.</p>
</dd>
<dt id="user-content-liquidlanguage">
  <code><strong><a href="#user-content-liquidlanguage">liquidLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>A language provider for Liquid templates.</p>
</dd>
<dt id="user-content-liquidcompletionconfig">
  <h4>
    <code>type</code>
    <a href="#user-content-liquidcompletionconfig">LiquidCompletionConfig</a></h4>
</dt>

<dd><p>Configuration options to
<a href="#user-content-liquidcompletionsource"><code>liquidCompletionSource</code></a>.</p>
<dl><dt id="user-content-liquidcompletionconfig.tags">
  <code><strong><a href="#user-content-liquidcompletionconfig.tags">tags</a></strong>&#8288;?: readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Adds additional completions when completing a Liquid tag.</p>
</dd><dt id="user-content-liquidcompletionconfig.filters">
  <code><strong><a href="#user-content-liquidcompletionconfig.filters">filters</a></strong>&#8288;?: readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Add additional filter completions.</p>
</dd><dt id="user-content-liquidcompletionconfig.variables">
  <code><strong><a href="#user-content-liquidcompletionconfig.variables">variables</a></strong>&#8288;?: readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Add variable completions.</p>
</dd><dt id="user-content-liquidcompletionconfig.properties">
  <code><strong><a href="#user-content-liquidcompletionconfig.properties">properties</a></strong>&#8288;?: fn(<a id="user-content-liquidcompletionconfig.properties^path" href="#user-content-liquidcompletionconfig.properties^path">path</a>: readonly <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[], <a id="user-content-liquidcompletionconfig.properties^state" href="#user-content-liquidcompletionconfig.properties^state">state</a>: <a href="https://codemirror.net/docs/ref#state.EditorState">EditorState</a>, <a id="user-content-liquidcompletionconfig.properties^context" href="#user-content-liquidcompletionconfig.properties^context">context</a>: <a href="https://codemirror.net/docs/ref#autocomplete.CompletionContext">CompletionContext</a>) → readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Provides completions for properties completed under the given
path. For example, when completing <code>user.address.</code>, <code>path</code> will
be <code>[&quot;user&quot;, &quot;address&quot;]</code>.</p>
</dd></dl>

</dd>
<dt id="user-content-liquidcompletionsource">
  <code><strong><a href="#user-content-liquidcompletionsource">liquidCompletionSource</a></strong>(<a id="user-content-liquidcompletionsource^config" href="#user-content-liquidcompletionsource^config">config</a>&#8288;?: <a href="#user-content-liquidcompletionconfig">LiquidCompletionConfig</a> = {}) → fn(<a id="user-content-liquidcompletionsource^returns^context" href="#user-content-liquidcompletionsource^returns^context">context</a>: <a href="https://codemirror.net/docs/ref#autocomplete.CompletionContext">CompletionContext</a>) → <a href="https://codemirror.net/docs/ref#autocomplete.CompletionResult">CompletionResult</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>Returns a completion source for liquid templates. Optionally takes
a configuration that adds additional custom completions.</p>
</dd>
<dt id="user-content-closepercentbrace">
  <code><strong><a href="#user-content-closepercentbrace">closePercentBrace</a></strong>: <a href="https://codemirror.net/docs/ref#state.Extension">Extension</a></code></dt>

<dd><p>This extension will, when the user types a <code>%</code> between two
matching braces, insert two percent signs instead and put the
cursor between them.</p>
</dd>
</dl>