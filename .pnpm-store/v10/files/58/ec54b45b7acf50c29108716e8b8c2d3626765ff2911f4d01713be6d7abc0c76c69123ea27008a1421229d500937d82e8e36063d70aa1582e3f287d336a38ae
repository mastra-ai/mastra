<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-jinja [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-jinja.svg)](https://www.npmjs.org/package/@codemirror/lang-jinja)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-jinja/blob/main/CHANGELOG.md) ]

This package implements [Jinja
template](https://jinja.palletsprojects.com/en/stable/templates/)
support for the [CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-jinja/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {jinja} from "@codemirror/lang-jinja"

const view = new EditorView({
  parent: document.body,
  doc: `{% if a.active %}{{ a.title }}{% endif %}`,
  extensions: [basicSetup, jinja()]
})
```

## API Reference

<dl>
<dt id="user-content-jinja">
  <code><strong><a href="#user-content-jinja">jinja</a></strong>(<a id="user-content-jinja^config" href="#user-content-jinja^config">config</a>&#8288;?: <a href="#user-content-jinjacompletionconfig">JinjaCompletionConfig</a> &amp; <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a> = {}) → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>Jinja template support.</p>
</dd>
<dt id="user-content-jinjalanguage">
  <code><strong><a href="#user-content-jinjalanguage">jinjaLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>A language provider for Jinja templates.</p>
</dd>
<dt id="user-content-jinjacompletionconfig">
  <h4>
    <code>type</code>
    <a href="#user-content-jinjacompletionconfig">JinjaCompletionConfig</a></h4>
</dt>

<dd><p>Configuration options to
<a href="#user-content-jinjacompletionsource"><code>jinjaCompletionSource</code></a>.</p>
<dl><dt id="user-content-jinjacompletionconfig.tags">
  <code><strong><a href="#user-content-jinjacompletionconfig.tags">tags</a></strong>&#8288;?: readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Adds additional completions when completing a Jinja tag.</p>
</dd><dt id="user-content-jinjacompletionconfig.variables">
  <code><strong><a href="#user-content-jinjacompletionconfig.variables">variables</a></strong>&#8288;?: readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Add additional global variables.</p>
</dd><dt id="user-content-jinjacompletionconfig.properties">
  <code><strong><a href="#user-content-jinjacompletionconfig.properties">properties</a></strong>&#8288;?: fn(<a id="user-content-jinjacompletionconfig.properties^path" href="#user-content-jinjacompletionconfig.properties^path">path</a>: readonly <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[], <a id="user-content-jinjacompletionconfig.properties^state" href="#user-content-jinjacompletionconfig.properties^state">state</a>: <a href="https://codemirror.net/docs/ref#state.EditorState">EditorState</a>, <a id="user-content-jinjacompletionconfig.properties^context" href="#user-content-jinjacompletionconfig.properties^context">context</a>: <a href="https://codemirror.net/docs/ref#autocomplete.CompletionContext">CompletionContext</a>) → readonly <a href="https://codemirror.net/docs/ref#autocomplete.Completion">Completion</a>[]</code></dt>

<dd><p>Provides completions for properties completed under the given
path. For example, when completing <code>user.address.</code>, <code>path</code> will
be <code>[&quot;user&quot;, &quot;address&quot;]</code>.</p>
</dd></dl>

</dd>
<dt id="user-content-jinjacompletionsource">
  <code><strong><a href="#user-content-jinjacompletionsource">jinjaCompletionSource</a></strong>(<a id="user-content-jinjacompletionsource^config" href="#user-content-jinjacompletionsource^config">config</a>&#8288;?: <a href="#user-content-jinjacompletionconfig">JinjaCompletionConfig</a> = {}) → fn(<a id="user-content-jinjacompletionsource^returns^context" href="#user-content-jinjacompletionsource^returns^context">context</a>: <a href="https://codemirror.net/docs/ref#autocomplete.CompletionContext">CompletionContext</a>) → <a href="https://codemirror.net/docs/ref#autocomplete.CompletionResult">CompletionResult</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>Returns a completion source for jinja templates. Optionally takes
a configuration that adds additional custom completions.</p>
</dd>
<dt id="user-content-closepercentbrace">
  <code><strong><a href="#user-content-closepercentbrace">closePercentBrace</a></strong>: <a href="https://codemirror.net/docs/ref#state.Extension">Extension</a></code></dt>

<dd><p>This extension will, when the user types a <code>%</code> between two
matching braces, insert two percent signs instead and put the
cursor between them.</p>
</dd>
</dl>
