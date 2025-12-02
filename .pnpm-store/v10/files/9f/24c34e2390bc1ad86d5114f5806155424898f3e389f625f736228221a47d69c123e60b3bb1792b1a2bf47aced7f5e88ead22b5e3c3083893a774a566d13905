<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-markdown [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-markdown.svg)](https://www.npmjs.org/package/@codemirror/lang-markdown)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-markdown/blob/main/CHANGELOG.md) ]

This package implements Markdown language support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-markdown/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {markdown} from "@codemirror/lang-markdown"

const view = new EditorView({
  parent: document.body,
  doc: `*CodeMirror* Markdown \`mode\``,
  extensions: [basicSetup, markdown()]
})
```

## API Reference

<dl>
<dt id="user-content-markdown">
  <code><strong><a href="#user-content-markdown">markdown</a></strong>(<a id="user-content-markdown^config" href="#user-content-markdown^config">config</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a> = {}) → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>Markdown language support.</p>
<dl><dt id="user-content-markdown^config">
  <code><strong><a href="#user-content-markdown^config">config</a></strong></code></dt>

<dd><dl><dt id="user-content-markdown^config.defaultcodelanguage">
  <code><strong><a href="#user-content-markdown^config.defaultcodelanguage">defaultCodeLanguage</a></strong>&#8288;?: <a href="https://codemirror.net/docs/ref#language.Language">Language</a> | <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>When given, this language will be used by default to parse code
blocks.</p>
</dd><dt id="user-content-markdown^config.codelanguages">
  <code><strong><a href="#user-content-markdown^config.codelanguages">codeLanguages</a></strong>&#8288;?: readonly <a href="https://codemirror.net/docs/ref#language.LanguageDescription">LanguageDescription</a>[] | fn(<a id="user-content-markdown^config.codelanguages^info" href="#user-content-markdown^config.codelanguages^info">info</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>) → <a href="https://codemirror.net/docs/ref#language.Language">Language</a> | <a href="https://codemirror.net/docs/ref#language.LanguageDescription">LanguageDescription</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>A source of language support for highlighting fenced code
blocks. When it is an array, the parser will use
<a href="https://codemirror.net/docs/ref/#language.LanguageDescription%5EmatchLanguageName"><code>LanguageDescription.matchLanguageName</code></a>
with the fenced code info to find a matching language. When it
is a function, will be called with the info string and may
return a language or <code>LanguageDescription</code> object.</p>
</dd><dt id="user-content-markdown^config.addkeymap">
  <code><strong><a href="#user-content-markdown^config.addkeymap">addKeymap</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Set this to false to disable installation of the Markdown
<a href="#user-content-markdownkeymap">keymap</a>.</p>
</dd><dt id="user-content-markdown^config.extensions">
  <code><strong><a href="#user-content-markdown^config.extensions">extensions</a></strong>&#8288;?: <a href="https://github.com/lezer-parser/markdown#user-content-markdownextension">MarkdownExtension</a></code></dt>

<dd><p>Markdown parser
<a href="https://github.com/lezer-parser/markdown#user-content-markdownextension">extensions</a>
to add to the parser.</p>
</dd><dt id="user-content-markdown^config.base">
  <code><strong><a href="#user-content-markdown^config.base">base</a></strong>&#8288;?: <a href="https://codemirror.net/docs/ref#language.Language">Language</a></code></dt>

<dd><p>The base language to use. Defaults to
<a href="#user-content-commonmarklanguage"><code>commonmarkLanguage</code></a>.</p>
</dd><dt id="user-content-markdown^config.completehtmltags">
  <code><strong><a href="#user-content-markdown^config.completehtmltags">completeHTMLTags</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>By default, the extension installs an autocompletion source that
completes HTML tags when a <code>&lt;</code> is typed. Set this to false to
disable this.</p>
</dd><dt id="user-content-markdown^config.pasteurlaslink">
  <code><strong><a href="#user-content-markdown^config.pasteurlaslink">pasteURLAsLink</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>The returned language contains
<a href="#user-content-pasteurlaslink"><code>pasteURLAsLink</code></a> as a support
extension unless you set this to false.</p>
</dd><dt id="user-content-markdown^config.htmltaglanguage">
  <code><strong><a href="#user-content-markdown^config.htmltaglanguage">htmlTagLanguage</a></strong>&#8288;?: <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>By default, HTML tags in the document are handled by the <a href="https://github.com/codemirror/lang-html">HTML
language</a> package with
tag matching turned off. You can pass in an alternative language
configuration here if you want.</p>
</dd></dl></dd></dl></dd>
<dt id="user-content-markdownlanguage">
  <code><strong><a href="#user-content-markdownlanguage">markdownLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.Language">Language</a></code></dt>

<dd><p>Language support for <a href="https://github.github.com/gfm/">GFM</a> plus
subscript, superscript, and emoji syntax.</p>
</dd>
<dt id="user-content-commonmarklanguage">
  <code><strong><a href="#user-content-commonmarklanguage">commonmarkLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.Language">Language</a></code></dt>

<dd><p>Language support for strict CommonMark.</p>
</dd>
<dt id="user-content-insertnewlinecontinuemarkup">
  <code><strong><a href="#user-content-insertnewlinecontinuemarkup">insertNewlineContinueMarkup</a></strong>: <a href="https://codemirror.net/docs/ref#state.StateCommand">StateCommand</a></code></dt>

<dd><p>This command, when invoked in Markdown context with cursor
selection(s), will create a new line with the markup for
blockquotes and lists that were active on the old line. If the
cursor was directly after the end of the markup for the old line,
trailing whitespace and list markers are removed from that line.</p>
<p>The command does nothing in non-Markdown context, so it should
not be used as the only binding for Enter (even in a Markdown
document, HTML and code regions might use a different language).</p>
</dd>
<dt id="user-content-insertnewlinecontinuemarkupcommand">
  <code><strong><a href="#user-content-insertnewlinecontinuemarkupcommand">insertNewlineContinueMarkupCommand</a></strong>(<a id="user-content-insertnewlinecontinuemarkupcommand^config" href="#user-content-insertnewlinecontinuemarkupcommand^config">config</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a> = {}) → <a href="https://codemirror.net/docs/ref#state.StateCommand">StateCommand</a></code></dt>

<dd><p>Returns a command like
<a href="#user-content-insertnewlinecontinuemarkup"><code>insertNewlineContinueMarkup</code></a>,
allowing further configuration.</p>
<dl><dt id="user-content-insertnewlinecontinuemarkupcommand^config">
  <code><strong><a href="#user-content-insertnewlinecontinuemarkupcommand^config">config</a></strong></code></dt>

<dd><dl><dt id="user-content-insertnewlinecontinuemarkupcommand^config.nontightlists">
  <code><strong><a href="#user-content-insertnewlinecontinuemarkupcommand^config.nontightlists">nonTightLists</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>By default, when pressing enter in a blank second item in a
tight (no blank lines between items) list, the command will
insert a blank line above that item, starting a non-tight list.
Set this to false to disable this behavior.</p>
</dd></dl></dd></dl></dd>
<dt id="user-content-deletemarkupbackward">
  <code><strong><a href="#user-content-deletemarkupbackward">deleteMarkupBackward</a></strong>: <a href="https://codemirror.net/docs/ref#state.StateCommand">StateCommand</a></code></dt>

<dd><p>This command will, when invoked in a Markdown context with the
cursor directly after list or blockquote markup, delete one level
of markup. When the markup is for a list, it will be replaced by
spaces on the first invocation (a further invocation will delete
the spaces), to make it easy to continue a list.</p>
<p>When not after Markdown block markup, this command will return
false, so it is intended to be bound alongside other deletion
commands, with a higher precedence than the more generic commands.</p>
</dd>
<dt id="user-content-markdownkeymap">
  <code><strong><a href="#user-content-markdownkeymap">markdownKeymap</a></strong>: readonly <a href="https://codemirror.net/docs/ref#view.KeyBinding">KeyBinding</a>[]</code></dt>

<dd><p>A small keymap with Markdown-specific bindings. Binds Enter to
<a href="#user-content-insertnewlinecontinuemarkup"><code>insertNewlineContinueMarkup</code></a>
and Backspace to
<a href="#user-content-deletemarkupbackward"><code>deleteMarkupBackward</code></a>.</p>
</dd>
<dt id="user-content-pasteurlaslink">
  <code><strong><a href="#user-content-pasteurlaslink">pasteURLAsLink</a></strong>: <a href="https://codemirror.net/docs/ref#state.Extension">Extension</a></code></dt>

<dd><p>An extension that intercepts pastes when the pasted content looks
like a URL and the selection is non-empty and selects regular
text, making the selection a link with the pasted URL as target.</p>
</dd>
</dl>
