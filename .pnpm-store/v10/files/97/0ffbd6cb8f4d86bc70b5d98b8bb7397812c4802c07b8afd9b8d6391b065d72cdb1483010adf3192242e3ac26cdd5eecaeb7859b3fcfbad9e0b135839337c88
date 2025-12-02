<!-- /README.md is generated from /src/README.md -->

# @lezer/markdown

This is an incremental Markdown ([CommonMark](https://commonmark.org/)
with support for extension) parser that integrates well with the
[Lezer](https://lezer.codemirror.net/) parser system. It does not in
fact use the Lezer runtime (that runs LR parsers, and Markdown can't
really be parsed that way), but it produces Lezer-style compact syntax
trees and consumes fragments of such trees for its incremental
parsing.

Note that this only _parses_ the document, producing a data structure
that represents its syntactic form, and doesn't help with outputting
HTML. Also, in order to be single-pass and incremental, it doesn't do
some things that a conforming CommonMark parser is expected to
do—specifically, it doesn't validate link references, so it'll parse
`[a][b]` and similar as a link, even if no `[b]` reference is
declared.

The
[@codemirror/lang-markdown](https://github.com/codemirror/lang-markdown)
package integrates this parser with CodeMirror to provide Markdown
editor support.

The code is licensed under an MIT license.

## Interface
<dl>
<dt id="user-content-parser">
  <code><strong><a href="#user-content-parser">parser</a></strong>: <a href="#user-content-markdownparser">MarkdownParser</a></code></dt>

<dd><p>The default CommonMark parser.</p>
</dd>
</dl>
<dl>
<dt id="user-content-markdownparser">
  <h4>
    <code>class</code>
    <a href="#user-content-markdownparser">MarkdownParser</a> <code>extends <a href="https://lezer.codemirror.net/docs/ref/#common.Parser">Parser</a></code></h4>
</dt>

<dd><p>A Markdown parser configuration.</p>
<dl><dt id="user-content-markdownparser.nodeset">
  <code><strong><a href="#user-content-markdownparser.nodeset">nodeSet</a></strong>: <a href="https://lezer.codemirror.net/docs/ref/#common.NodeSet">NodeSet</a></code></dt>

<dd><p>The parser's syntax <a href="https://lezer.codemirror.net/docs/ref/#common.NodeSet">node
types</a>.</p>
</dd><dt id="user-content-markdownparser.configure">
  <code><strong><a href="#user-content-markdownparser.configure">configure</a></strong>(<a id="user-content-markdownparser.configure^spec" href="#user-content-markdownparser.configure^spec">spec</a>: <a href="#user-content-markdownextension">MarkdownExtension</a>) → <a href="#user-content-markdownparser">MarkdownParser</a></code></dt>

<dd><p>Reconfigure the parser.</p>
</dd><dt id="user-content-markdownparser.parseinline">
  <code><strong><a href="#user-content-markdownparser.parseinline">parseInline</a></strong>(<a id="user-content-markdownparser.parseinline^text" href="#user-content-markdownparser.parseinline^text">text</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, <a id="user-content-markdownparser.parseinline^offset" href="#user-content-markdownparser.parseinline^offset">offset</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="#user-content-element">Element</a>[]</code></dt>

<dd><p>Parse the given piece of inline text at the given offset,
returning an array of <a href="#user-content-element"><code>Element</code></a> objects representing
the inline content.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-markdownconfig">
  <h4>
    <code>interface</code>
    <a href="#user-content-markdownconfig">MarkdownConfig</a></h4>
</dt>

<dd><p>Objects of this type are used to
<a href="#user-content-markdownparser.configure">configure</a> the Markdown parser.</p>
<dl><dt id="user-content-markdownconfig.props">
  <code><strong><a href="#user-content-markdownconfig.props">props</a></strong>&#8288;?: readonly <a href="https://lezer.codemirror.net/docs/ref/#common.NodePropSource">NodePropSource</a>[]</code></dt>

<dd><p>Node props to add to the parser's node set.</p>
</dd><dt id="user-content-markdownconfig.definenodes">
  <code><strong><a href="#user-content-markdownconfig.definenodes">defineNodes</a></strong>&#8288;?: readonly (<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a> | <a href="#user-content-nodespec">NodeSpec</a>)[]</code></dt>

<dd><p>Define new <a href="#user-content-nodespec">node types</a> for use in parser extensions.</p>
</dd><dt id="user-content-markdownconfig.parseblock">
  <code><strong><a href="#user-content-markdownconfig.parseblock">parseBlock</a></strong>&#8288;?: readonly <a href="#user-content-blockparser">BlockParser</a>[]</code></dt>

<dd><p>Define additional <a href="#user-content-blockparser">block parsing</a> logic.</p>
</dd><dt id="user-content-markdownconfig.parseinline">
  <code><strong><a href="#user-content-markdownconfig.parseinline">parseInline</a></strong>&#8288;?: readonly <a href="#user-content-inlineparser">InlineParser</a>[]</code></dt>

<dd><p>Define new <a href="#user-content-inlineparser">inline parsing</a> logic.</p>
</dd><dt id="user-content-markdownconfig.remove">
  <code><strong><a href="#user-content-markdownconfig.remove">remove</a></strong>&#8288;?: readonly <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>[]</code></dt>

<dd><p>Remove the named parsers from the configuration.</p>
</dd><dt id="user-content-markdownconfig.wrap">
  <code><strong><a href="#user-content-markdownconfig.wrap">wrap</a></strong>&#8288;?: <a href="https://lezer.codemirror.net/docs/ref/#common.ParseWrapper">ParseWrapper</a></code></dt>

<dd><p>Add a parse wrapper (such as a <a href="#user-content-common.parsemixed">mixed-language
parser</a>) to this parser.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-markdownextension">
  <code>type</code>
  <code><strong><a href="#user-content-markdownextension">MarkdownExtension</a></strong> = <a href="#user-content-markdownconfig">MarkdownConfig</a> | readonly <a href="#user-content-markdownextension">MarkdownExtension</a>[]</code>
</dt>

<dd><p>To make it possible to group extensions together into bigger
extensions (such as the <a href="#user-content-gfm">Github-flavored Markdown</a>
extension), <a href="#user-content-markdownparser.configure">reconfiguration</a> accepts
nested arrays of <a href="#user-content-markdownconfig">config</a> objects.</p>
</dd>
</dl>
<dl>
<dt id="user-content-parsecode">
  <code><strong><a href="#user-content-parsecode">parseCode</a></strong>(<a id="user-content-parsecode^config" href="#user-content-parsecode^config">config</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>) → <a href="#user-content-markdownextension">MarkdownExtension</a></code></dt>

<dd><p>Create a Markdown extension to enable nested parsing on code
blocks and/or embedded HTML.</p>
<dl><dt id="user-content-parsecode^config">
  <code><strong><a href="#user-content-parsecode^config">config</a></strong></code></dt>

<dd><dl><dt id="user-content-parsecode^config.codeparser">
  <code><strong><a href="#user-content-parsecode^config.codeparser">codeParser</a></strong>&#8288;?: fn(<a id="user-content-parsecode^config.codeparser^info" href="#user-content-parsecode^config.codeparser^info">info</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>) → <a href="https://lezer.codemirror.net/docs/ref/#common.Parser">Parser</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>When provided, this will be used to parse the content of code
blocks. <code>info</code> is the string after the opening <code>```</code> marker,
or the empty string if there is no such info or this is an
indented code block. If there is a parser available for the
code, it should return a function that can construct the
<a href="https://lezer.codemirror.net/docs/ref/#common.PartialParse">parse</a>.</p>
</dd><dt id="user-content-parsecode^config.htmlparser">
  <code><strong><a href="#user-content-parsecode^config.htmlparser">htmlParser</a></strong>&#8288;?: <a href="https://lezer.codemirror.net/docs/ref/#common.Parser">Parser</a></code></dt>

<dd><p>The parser used to parse HTML tags (both block and inline).</p>
</dd></dl></dd></dl></dd>
</dl>

### GitHub Flavored Markdown
<dl>
<dt id="user-content-gfm">
  <code><strong><a href="#user-content-gfm">GFM</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a>[]</code></dt>

<dd><p>Extension bundle containing <a href="#user-content-table"><code>Table</code></a>,
<a href="#user-content-tasklist"><code>TaskList</code></a>, <a href="#user-content-strikethrough"><code>Strikethrough</code></a>, and
<a href="#user-content-autolink"><code>Autolink</code></a>.</p>
</dd>
</dl>
<dl>
<dt id="user-content-table">
  <code><strong><a href="#user-content-table">Table</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>This extension provides
<a href="https://github.github.com/gfm/#tables-extension-">GFM-style</a>
tables, using syntax like this:</p>
<pre><code>| head 1 | head 2 |
| ---    | ---    |
| cell 1 | cell 2 |
</code></pre>
</dd>
</dl>
<dl>
<dt id="user-content-tasklist">
  <code><strong><a href="#user-content-tasklist">TaskList</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>Extension providing
<a href="https://github.github.com/gfm/#task-list-items-extension-">GFM-style</a>
task list items, where list items can be prefixed with <code>[ ]</code> or
<code>[x]</code> to add a checkbox.</p>
</dd>
</dl>
<dl>
<dt id="user-content-strikethrough">
  <code><strong><a href="#user-content-strikethrough">Strikethrough</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>An extension that implements
<a href="https://github.github.com/gfm/#strikethrough-extension-">GFM-style</a>
Strikethrough syntax using <code>~~</code> delimiters.</p>
</dd>
</dl>
<dl>
<dt id="user-content-autolink">
  <code><strong><a href="#user-content-autolink">Autolink</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>Extension that implements autolinking for
<code>www.</code>/<code>http://</code>/<code>https://</code>/<code>mailto:</code>/<code>xmpp:</code> URLs and email
addresses.</p>
</dd>
</dl>

### Other extensions
<dl>
<dt id="user-content-subscript">
  <code><strong><a href="#user-content-subscript">Subscript</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>Extension providing
<a href="https://pandoc.org/MANUAL.html#superscripts-and-subscripts">Pandoc-style</a>
subscript using <code>~</code> markers.</p>
</dd>
</dl>
<dl>
<dt id="user-content-superscript">
  <code><strong><a href="#user-content-superscript">Superscript</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>Extension providing
<a href="https://pandoc.org/MANUAL.html#superscripts-and-subscripts">Pandoc-style</a>
superscript using <code>^</code> markers.</p>
</dd>
</dl>
<dl>
<dt id="user-content-emoji">
  <code><strong><a href="#user-content-emoji">Emoji</a></strong>: <a href="#user-content-markdownconfig">MarkdownConfig</a></code></dt>

<dd><p>Extension that parses two colons with only letters, underscores,
and numbers between them as <code>Emoji</code> nodes.</p>
</dd>
</dl>

### Extension

The parser can, to a certain extent, be extended to handle additional
syntax.
<dl>
<dt id="user-content-nodespec">
  <h4>
    <code>interface</code>
    <a href="#user-content-nodespec">NodeSpec</a></h4>
</dt>

<dd><p>Used in the <a href="#user-content-markdownconfig.definenodes">configuration</a> to define
new <a href="https://lezer.codemirror.net/docs/ref/#common.NodeType">syntax node
types</a>.</p>
<dl><dt id="user-content-nodespec.name">
  <code><strong><a href="#user-content-nodespec.name">name</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The node's name.</p>
</dd><dt id="user-content-nodespec.block">
  <code><strong><a href="#user-content-nodespec.block">block</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Should be set to true if this type represents a block node.</p>
</dd><dt id="user-content-nodespec.composite">
  <code><strong><a href="#user-content-nodespec.composite">composite</a></strong>&#8288;?: fn(<a id="user-content-nodespec.composite^cx" href="#user-content-nodespec.composite^cx">cx</a>: <a href="#user-content-blockcontext">BlockContext</a>, <a id="user-content-nodespec.composite^line" href="#user-content-nodespec.composite^line">line</a>: <a href="#user-content-line">Line</a>, <a id="user-content-nodespec.composite^value" href="#user-content-nodespec.composite^value">value</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>If this is a composite block, this should hold a function that,
at the start of a new line where that block is active, checks
whether the composite block should continue (return value) and
optionally <a href="#user-content-line.movebase">adjusts</a> the line's base position
and <a href="#user-content-line.addmarker">registers</a> nodes for any markers involved
in the block's syntax.</p>
</dd><dt id="user-content-nodespec.style">
  <code><strong><a href="#user-content-nodespec.style">style</a></strong>&#8288;?: <a href="https://lezer.codemirror.net/docs/ref/#highlight.Tag">Tag</a> | readonly <a href="https://lezer.codemirror.net/docs/ref/#highlight.Tag">Tag</a>[] | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a>&lt;<a href="https://lezer.codemirror.net/docs/ref/#highlight.Tag">Tag</a> | readonly <a href="https://lezer.codemirror.net/docs/ref/#highlight.Tag">Tag</a>[]&gt;</code></dt>

<dd><p>Add highlighting tag information for this node. The value of
this property may either by a tag or array of tags to assign
directly to this node, or an object in the style of
<a href="https://lezer.codemirror.net/docs/ref/#highlight.styleTags"><code>styleTags</code></a>'s
argument to assign more complicated rules.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-blockcontext">
  <h4>
    <code>class</code>
    <a href="#user-content-blockcontext">BlockContext</a> <code>implements <a href="https://lezer.codemirror.net/docs/ref/#common.PartialParse">PartialParse</a></code></h4>
</dt>

<dd><p>Block-level parsing functions get access to this context object.</p>
<dl><dt id="user-content-blockcontext.linestart">
  <code><strong><a href="#user-content-blockcontext.linestart">lineStart</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The start of the current line.</p>
</dd><dt id="user-content-blockcontext.parser">
  <code><strong><a href="#user-content-blockcontext.parser">parser</a></strong>: <a href="#user-content-markdownparser">MarkdownParser</a></code></dt>

<dd><p>The parser configuration used.</p>
</dd><dt id="user-content-blockcontext.depth">
  <code><strong><a href="#user-content-blockcontext.depth">depth</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The number of parent blocks surrounding the current block.</p>
</dd><dt id="user-content-blockcontext.parenttype">
  <code><strong><a href="#user-content-blockcontext.parenttype">parentType</a></strong>(<a id="user-content-blockcontext.parenttype^depth" href="#user-content-blockcontext.parenttype^depth">depth</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a> = this.depth - 1) → <a href="https://lezer.codemirror.net/docs/ref/#common.NodeType">NodeType</a></code></dt>

<dd><p>Get the type of the parent block at the given depth. When no
depth is passed, return the type of the innermost parent.</p>
</dd><dt id="user-content-blockcontext.nextline">
  <code><strong><a href="#user-content-blockcontext.nextline">nextLine</a></strong>() → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Move to the next input line. This should only be called by
(non-composite) <a href="#user-content-blockparser.parse">block parsers</a> that consume
the line directly, or leaf block parser
<a href="#user-content-leafblockparser.nextline"><code>nextLine</code></a> methods when they
consume the current line (and return true).</p>
</dd><dt id="user-content-blockcontext.peekline">
  <code><strong><a href="#user-content-blockcontext.peekline">peekLine</a></strong>() → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>Retrieve the text of the line after the current one, without
actually moving the context's current line forward.</p>
</dd><dt id="user-content-blockcontext.prevlineend">
  <code><strong><a href="#user-content-blockcontext.prevlineend">prevLineEnd</a></strong>() → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The end position of the previous line.</p>
</dd><dt id="user-content-blockcontext.startcomposite">
  <code><strong><a href="#user-content-blockcontext.startcomposite">startComposite</a></strong>(<a id="user-content-blockcontext.startcomposite^type" href="#user-content-blockcontext.startcomposite^type">type</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, <a id="user-content-blockcontext.startcomposite^start" href="#user-content-blockcontext.startcomposite^start">start</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-blockcontext.startcomposite^value" href="#user-content-blockcontext.startcomposite^value">value</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a> = 0)</code></dt>

<dd><p>Start a composite block. Should only be called from <a href="#user-content-blockparser.parse">block
parser functions</a> that return null.</p>
</dd><dt id="user-content-blockcontext.addelement">
  <code><strong><a href="#user-content-blockcontext.addelement">addElement</a></strong>(<a id="user-content-blockcontext.addelement^elt" href="#user-content-blockcontext.addelement^elt">elt</a>: <a href="#user-content-element">Element</a>)</code></dt>

<dd><p>Add a block element. Can be called by <a href="#user-content-blockparser.parse">block
parsers</a>.</p>
</dd><dt id="user-content-blockcontext.addleafelement">
  <code><strong><a href="#user-content-blockcontext.addleafelement">addLeafElement</a></strong>(<a id="user-content-blockcontext.addleafelement^leaf" href="#user-content-blockcontext.addleafelement^leaf">leaf</a>: <a href="#user-content-leafblock">LeafBlock</a>, <a id="user-content-blockcontext.addleafelement^elt" href="#user-content-blockcontext.addleafelement^elt">elt</a>: <a href="#user-content-element">Element</a>)</code></dt>

<dd><p>Add a block element from a <a href="#user-content-leafblockparser">leaf parser</a>. This
makes sure any extra composite block markup (such as blockquote
markers) inside the block are also added to the syntax tree.</p>
</dd><dt id="user-content-blockcontext.elt">
  <code><strong><a href="#user-content-blockcontext.elt">elt</a></strong>(<a id="user-content-blockcontext.elt^type" href="#user-content-blockcontext.elt^type">type</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, <a id="user-content-blockcontext.elt^from" href="#user-content-blockcontext.elt^from">from</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-blockcontext.elt^to" href="#user-content-blockcontext.elt^to">to</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-blockcontext.elt^children" href="#user-content-blockcontext.elt^children">children</a>&#8288;?: readonly <a href="#user-content-element">Element</a>[]) → <a href="#user-content-element">Element</a></code><div><code><strong><a href="#user-content-blockcontext.elt">elt</a></strong>(<a id="user-content-blockcontext.elt^tree" href="#user-content-blockcontext.elt^tree">tree</a>: <a href="https://lezer.codemirror.net/docs/ref/#common.Tree">Tree</a>, <a id="user-content-blockcontext.elt^at" href="#user-content-blockcontext.elt^at">at</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="#user-content-element">Element</a></code></div></dt>

<dd><p>Create an <a href="#user-content-element"><code>Element</code></a> object to represent some syntax
node.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-blockparser">
  <h4>
    <code>interface</code>
    <a href="#user-content-blockparser">BlockParser</a></h4>
</dt>

<dd><p>Block parsers handle block-level structure. There are three
general types of block parsers:</p>
<ul>
<li>
<p>Composite block parsers, which handle things like lists and
blockquotes. These define a <a href="#user-content-blockparser.parse"><code>parse</code></a> method
that <a href="#user-content-blockcontext.startcomposite">starts</a> a composite block
and returns null when it recognizes its syntax.</p>
</li>
<li>
<p>Eager leaf block parsers, used for things like code or HTML
blocks. These can unambiguously recognize their content from its
first line. They define a <a href="#user-content-blockparser.parse"><code>parse</code></a> method
that, if it recognizes the construct,
<a href="#user-content-blockcontext.nextline">moves</a> the current line forward to the
line beyond the end of the block,
<a href="#user-content-blockcontext.addelement">add</a> a syntax node for the block, and
return true.</p>
</li>
<li>
<p>Leaf block parsers that observe a paragraph-like construct as it
comes in, and optionally decide to handle it at some point. This
is used for &quot;setext&quot; (underlined) headings and link references.
These define a <a href="#user-content-blockparser.leaf"><code>leaf</code></a> method that checks
the first line of the block and returns a
<a href="#user-content-leafblockparser"><code>LeafBlockParser</code></a> object if it wants to
observe that block.</p>
</li>
</ul>
<dl><dt id="user-content-blockparser.name">
  <code><strong><a href="#user-content-blockparser.name">name</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The name of the parser. Can be used by other block parsers to
<a href="#user-content-blockparser.before">specify</a> precedence.</p>
</dd><dt id="user-content-blockparser.parse">
  <code><strong><a href="#user-content-blockparser.parse">parse</a></strong>&#8288;?: fn(<a id="user-content-blockparser.parse^cx" href="#user-content-blockparser.parse^cx">cx</a>: <a href="#user-content-blockcontext">BlockContext</a>, <a id="user-content-blockparser.parse^line" href="#user-content-blockparser.parse^line">line</a>: <a href="#user-content-line">Line</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>The eager parse function, which can look at the block's first
line and return <code>false</code> to do nothing, <code>true</code> if it has parsed
(and <a href="#user-content-blockcontext.nextline">moved past</a> a block), or <code>null</code> if
it has started a composite block.</p>
</dd><dt id="user-content-blockparser.leaf">
  <code><strong><a href="#user-content-blockparser.leaf">leaf</a></strong>&#8288;?: fn(<a id="user-content-blockparser.leaf^cx" href="#user-content-blockparser.leaf^cx">cx</a>: <a href="#user-content-blockcontext">BlockContext</a>, <a id="user-content-blockparser.leaf^leaf" href="#user-content-blockparser.leaf^leaf">leaf</a>: <a href="#user-content-leafblock">LeafBlock</a>) → <a href="#user-content-leafblockparser">LeafBlockParser</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>A leaf parse function. If no <a href="#user-content-blockparser.parse">regular</a> parse
functions match for a given line, its content will be
accumulated for a paragraph-style block. This method can return
an <a href="#user-content-leafblockparser">object</a> that overrides that style of
parsing in some situations.</p>
</dd><dt id="user-content-blockparser.endleaf">
  <code><strong><a href="#user-content-blockparser.endleaf">endLeaf</a></strong>&#8288;?: fn(<a id="user-content-blockparser.endleaf^cx" href="#user-content-blockparser.endleaf^cx">cx</a>: <a href="#user-content-blockcontext">BlockContext</a>, <a id="user-content-blockparser.endleaf^line" href="#user-content-blockparser.endleaf^line">line</a>: <a href="#user-content-line">Line</a>, <a id="user-content-blockparser.endleaf^leaf" href="#user-content-blockparser.endleaf^leaf">leaf</a>: <a href="#user-content-leafblock">LeafBlock</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Some constructs, such as code blocks or newly started
blockquotes, can interrupt paragraphs even without a blank line.
If your construct can do this, provide a predicate here that
recognizes lines that should end a paragraph (or other non-eager
<a href="#user-content-blockparser.leaf">leaf block</a>).</p>
</dd><dt id="user-content-blockparser.before">
  <code><strong><a href="#user-content-blockparser.before">before</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>When given, this parser will be installed directly before the
block parser with the given name. The default configuration
defines block parsers with names LinkReference, IndentedCode,
FencedCode, Blockquote, HorizontalRule, BulletList, OrderedList,
ATXHeading, HTMLBlock, and SetextHeading.</p>
</dd><dt id="user-content-blockparser.after">
  <code><strong><a href="#user-content-blockparser.after">after</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>When given, the parser will be installed directly <em>after</em> the
parser with the given name.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-leafblockparser">
  <h4>
    <code>interface</code>
    <a href="#user-content-leafblockparser">LeafBlockParser</a></h4>
</dt>

<dd><p>Objects that are used to <a href="#user-content-blockparser.leaf">override</a>
paragraph-style blocks should conform to this interface.</p>
<dl><dt id="user-content-leafblockparser.nextline">
  <code><strong><a href="#user-content-leafblockparser.nextline">nextLine</a></strong>(<a id="user-content-leafblockparser.nextline^cx" href="#user-content-leafblockparser.nextline^cx">cx</a>: <a href="#user-content-blockcontext">BlockContext</a>, <a id="user-content-leafblockparser.nextline^line" href="#user-content-leafblockparser.nextline^line">line</a>: <a href="#user-content-line">Line</a>, <a id="user-content-leafblockparser.nextline^leaf" href="#user-content-leafblockparser.nextline^leaf">leaf</a>: <a href="#user-content-leafblock">LeafBlock</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Update the parser's state for the next line, and optionally
finish the block. This is not called for the first line (the
object is constructed at that line), but for any further lines.
When it returns <code>true</code>, the block is finished. It is okay for
the function to <a href="#user-content-blockcontext.nextline">consume</a> the current
line or any subsequent lines when returning true.</p>
</dd><dt id="user-content-leafblockparser.finish">
  <code><strong><a href="#user-content-leafblockparser.finish">finish</a></strong>(<a id="user-content-leafblockparser.finish^cx" href="#user-content-leafblockparser.finish^cx">cx</a>: <a href="#user-content-blockcontext">BlockContext</a>, <a id="user-content-leafblockparser.finish^leaf" href="#user-content-leafblockparser.finish^leaf">leaf</a>: <a href="#user-content-leafblock">LeafBlock</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Called when the block is finished by external circumstances
(such as a blank line or the <a href="#user-content-blockparser.endleaf">start</a> of
another construct). If this parser can handle the block up to
its current position, it should
<a href="#user-content-blockcontext.addleafelement">finish</a> the block and return
true.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-line">
  <h4>
    <code>class</code>
    <a href="#user-content-line">Line</a></h4>
</dt>

<dd><p>Data structure used during block-level per-line parsing.</p>
<dl><dt id="user-content-line.text">
  <code><strong><a href="#user-content-line.text">text</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The line's full text.</p>
</dd><dt id="user-content-line.baseindent">
  <code><strong><a href="#user-content-line.baseindent">baseIndent</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The base indent provided by the composite contexts (that have
been handled so far).</p>
</dd><dt id="user-content-line.basepos">
  <code><strong><a href="#user-content-line.basepos">basePos</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The string position corresponding to the base indent.</p>
</dd><dt id="user-content-line.pos">
  <code><strong><a href="#user-content-line.pos">pos</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The position of the next non-whitespace character beyond any
list, blockquote, or other composite block markers.</p>
</dd><dt id="user-content-line.indent">
  <code><strong><a href="#user-content-line.indent">indent</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The column of the next non-whitespace character.</p>
</dd><dt id="user-content-line.next">
  <code><strong><a href="#user-content-line.next">next</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The character code of the character after <code>pos</code>.</p>
</dd><dt id="user-content-line.skipspace">
  <code><strong><a href="#user-content-line.skipspace">skipSpace</a></strong>(<a id="user-content-line.skipspace^from" href="#user-content-line.skipspace^from">from</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Skip whitespace after the given position, return the position of
the next non-space character or the end of the line if there's
only space after <code>from</code>.</p>
</dd><dt id="user-content-line.movebase">
  <code><strong><a href="#user-content-line.movebase">moveBase</a></strong>(<a id="user-content-line.movebase^to" href="#user-content-line.movebase^to">to</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>)</code></dt>

<dd><p>Move the line's base position forward to the given position.
This should only be called by composite <a href="#user-content-blockparser.parse">block
parsers</a> or <a href="#user-content-nodespec.composite">markup skipping
functions</a>.</p>
</dd><dt id="user-content-line.movebasecolumn">
  <code><strong><a href="#user-content-line.movebasecolumn">moveBaseColumn</a></strong>(<a id="user-content-line.movebasecolumn^indent" href="#user-content-line.movebasecolumn^indent">indent</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>)</code></dt>

<dd><p>Move the line's base position forward to the given <em>column</em>.</p>
</dd><dt id="user-content-line.addmarker">
  <code><strong><a href="#user-content-line.addmarker">addMarker</a></strong>(<a id="user-content-line.addmarker^elt" href="#user-content-line.addmarker^elt">elt</a>: <a href="#user-content-element">Element</a>)</code></dt>

<dd><p>Store a composite-block-level marker. Should be called from
<a href="#user-content-nodespec.composite">markup skipping functions</a> when they
consume any non-whitespace characters.</p>
</dd><dt id="user-content-line.countindent">
  <code><strong><a href="#user-content-line.countindent">countIndent</a></strong>(<a id="user-content-line.countindent^to" href="#user-content-line.countindent^to">to</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-line.countindent^from" href="#user-content-line.countindent^from">from</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a> = 0, <a id="user-content-line.countindent^indent" href="#user-content-line.countindent^indent">indent</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a> = 0) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Find the column position at <code>to</code>, optionally starting at a given
position and column.</p>
</dd><dt id="user-content-line.findcolumn">
  <code><strong><a href="#user-content-line.findcolumn">findColumn</a></strong>(<a id="user-content-line.findcolumn^goal" href="#user-content-line.findcolumn^goal">goal</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Find the position corresponding to the given column.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-leafblock">
  <h4>
    <code>class</code>
    <a href="#user-content-leafblock">LeafBlock</a></h4>
</dt>

<dd><p>Data structure used to accumulate a block's content during <a href="#user-content-blockparser.leaf">leaf
block parsing</a>.</p>
<dl><dt id="user-content-leafblock.parsers">
  <code><strong><a href="#user-content-leafblock.parsers">parsers</a></strong>: <a href="#user-content-leafblockparser">LeafBlockParser</a>[]</code></dt>

<dd><p>The block parsers active for this block.</p>
</dd><dt id="user-content-leafblock.start">
  <code><strong><a href="#user-content-leafblock.start">start</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The start position of the block.</p>
</dd><dt id="user-content-leafblock.content">
  <code><strong><a href="#user-content-leafblock.content">content</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The block's text content.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-inlinecontext">
  <h4>
    <code>class</code>
    <a href="#user-content-inlinecontext">InlineContext</a></h4>
</dt>

<dd><p>Inline parsing functions get access to this context, and use it to
read the content and emit syntax nodes.</p>
<dl><dt id="user-content-inlinecontext.parser">
  <code><strong><a href="#user-content-inlinecontext.parser">parser</a></strong>: <a href="#user-content-markdownparser">MarkdownParser</a></code></dt>

<dd><p>The parser that is being used.</p>
</dd><dt id="user-content-inlinecontext.text">
  <code><strong><a href="#user-content-inlinecontext.text">text</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>The text of this inline section.</p>
</dd><dt id="user-content-inlinecontext.offset">
  <code><strong><a href="#user-content-inlinecontext.offset">offset</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The starting offset of the section in the document.</p>
</dd><dt id="user-content-inlinecontext.char">
  <code><strong><a href="#user-content-inlinecontext.char">char</a></strong>(<a id="user-content-inlinecontext.char^pos" href="#user-content-inlinecontext.char^pos">pos</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Get the character code at the given (document-relative)
position.</p>
</dd><dt id="user-content-inlinecontext.end">
  <code><strong><a href="#user-content-inlinecontext.end">end</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The position of the end of this inline section.</p>
</dd><dt id="user-content-inlinecontext.slice">
  <code><strong><a href="#user-content-inlinecontext.slice">slice</a></strong>(<a id="user-content-inlinecontext.slice^from" href="#user-content-inlinecontext.slice^from">from</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-inlinecontext.slice^to" href="#user-content-inlinecontext.slice^to">to</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>Get a substring of this inline section. Again uses
document-relative positions.</p>
</dd><dt id="user-content-inlinecontext.adddelimiter">
  <code><strong><a href="#user-content-inlinecontext.adddelimiter">addDelimiter</a></strong>(<a id="user-content-inlinecontext.adddelimiter^type" href="#user-content-inlinecontext.adddelimiter^type">type</a>: <a href="#user-content-delimitertype">DelimiterType</a>, <a id="user-content-inlinecontext.adddelimiter^from" href="#user-content-inlinecontext.adddelimiter^from">from</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-inlinecontext.adddelimiter^to" href="#user-content-inlinecontext.adddelimiter^to">to</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-inlinecontext.adddelimiter^open" href="#user-content-inlinecontext.adddelimiter^open">open</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>, <a id="user-content-inlinecontext.adddelimiter^close" href="#user-content-inlinecontext.adddelimiter^close">close</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Add a <a href="#user-content-delimitertype">delimiter</a> at this given position. <code>open</code>
and <code>close</code> indicate whether this delimiter is opening, closing,
or both. Returns the end of the delimiter, for convenient
returning from <a href="#user-content-inlineparser.parse">parse functions</a>.</p>
</dd><dt id="user-content-inlinecontext.hasopenlink">
  <code><strong><a href="#user-content-inlinecontext.hasopenlink">hasOpenLink</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>Returns true when there is an unmatched link or image opening
token before the current position.</p>
</dd><dt id="user-content-inlinecontext.addelement">
  <code><strong><a href="#user-content-inlinecontext.addelement">addElement</a></strong>(<a id="user-content-inlinecontext.addelement^elt" href="#user-content-inlinecontext.addelement^elt">elt</a>: <a href="#user-content-element">Element</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Add an inline element. Returns the end of the element.</p>
</dd><dt id="user-content-inlinecontext.findopeningdelimiter">
  <code><strong><a href="#user-content-inlinecontext.findopeningdelimiter">findOpeningDelimiter</a></strong>(<a id="user-content-inlinecontext.findopeningdelimiter^type" href="#user-content-inlinecontext.findopeningdelimiter^type">type</a>: <a href="#user-content-delimitertype">DelimiterType</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a> | <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null">null</a></code></dt>

<dd><p>Find an opening delimiter of the given type. Returns <code>null</code> if
no delimiter is found, or an index that can be passed to
<a href="#user-content-inlinecontext.takecontent"><code>takeContent</code></a> otherwise.</p>
</dd><dt id="user-content-inlinecontext.takecontent">
  <code><strong><a href="#user-content-inlinecontext.takecontent">takeContent</a></strong>(<a id="user-content-inlinecontext.takecontent^startindex" href="#user-content-inlinecontext.takecontent^startindex">startIndex</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="#user-content-element">Element</a>[]</code></dt>

<dd><p>Remove all inline elements and delimiters starting from the
given index (which you should get from
<a href="#user-content-inlinecontext.findopeningdelimiter"><code>findOpeningDelimiter</code></a>,
resolve delimiters inside of them, and return them as an array
of elements.</p>
</dd><dt id="user-content-inlinecontext.skipspace">
  <code><strong><a href="#user-content-inlinecontext.skipspace">skipSpace</a></strong>(<a id="user-content-inlinecontext.skipspace^from" href="#user-content-inlinecontext.skipspace^from">from</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>Skip space after the given (document) position, returning either
the position of the next non-space character or the end of the
section.</p>
</dd><dt id="user-content-inlinecontext.elt">
  <code><strong><a href="#user-content-inlinecontext.elt">elt</a></strong>(<a id="user-content-inlinecontext.elt^type" href="#user-content-inlinecontext.elt^type">type</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a>, <a id="user-content-inlinecontext.elt^from" href="#user-content-inlinecontext.elt^from">from</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-inlinecontext.elt^to" href="#user-content-inlinecontext.elt^to">to</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-inlinecontext.elt^children" href="#user-content-inlinecontext.elt^children">children</a>&#8288;?: readonly <a href="#user-content-element">Element</a>[]) → <a href="#user-content-element">Element</a></code><div><code><strong><a href="#user-content-inlinecontext.elt">elt</a></strong>(<a id="user-content-inlinecontext.elt^tree" href="#user-content-inlinecontext.elt^tree">tree</a>: <a href="https://lezer.codemirror.net/docs/ref/#common.Tree">Tree</a>, <a id="user-content-inlinecontext.elt^at" href="#user-content-inlinecontext.elt^at">at</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="#user-content-element">Element</a></code></div></dt>

<dd><p>Create an <a href="#user-content-element"><code>Element</code></a> for a syntax node.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-inlineparser">
  <h4>
    <code>interface</code>
    <a href="#user-content-inlineparser">InlineParser</a></h4>
</dt>

<dd><p>Inline parsers are called for every character of parts of the
document that are parsed as inline content.</p>
<dl><dt id="user-content-inlineparser.name">
  <code><strong><a href="#user-content-inlineparser.name">name</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>This parser's name, which can be used by other parsers to
<a href="#user-content-inlineparser.before">indicate</a> a relative precedence.</p>
</dd><dt id="user-content-inlineparser.parse">
  <code><strong><a href="#user-content-inlineparser.parse">parse</a></strong>(<a id="user-content-inlineparser.parse^cx" href="#user-content-inlineparser.parse^cx">cx</a>: <a href="#user-content-inlinecontext">InlineContext</a>, <a id="user-content-inlineparser.parse^next" href="#user-content-inlineparser.parse^next">next</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>, <a id="user-content-inlineparser.parse^pos" href="#user-content-inlineparser.parse^pos">pos</a>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a>) → <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The parse function. Gets the next character and its position as
arguments. Should return -1 if it doesn't handle the character,
or add some <a href="#user-content-inlinecontext.addelement">element</a> or
<a href="#user-content-inlinecontext.adddelimiter">delimiter</a> and return the end
position of the content it parsed if it can.</p>
</dd><dt id="user-content-inlineparser.before">
  <code><strong><a href="#user-content-inlineparser.before">before</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>When given, this parser will be installed directly before the
parser with the given name. The default configuration defines
inline parsers with names Escape, Entity, InlineCode, HTMLTag,
Emphasis, HardBreak, Link, and Image. When no <code>before</code> or
<code>after</code> property is given, the parser is added to the end of the
list.</p>
</dd><dt id="user-content-inlineparser.after">
  <code><strong><a href="#user-content-inlineparser.after">after</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>When given, the parser will be installed directly <em>after</em> the
parser with the given name.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-delimitertype">
  <h4>
    <code>interface</code>
    <a href="#user-content-delimitertype">DelimiterType</a></h4>
</dt>

<dd><p>Delimiters are used during inline parsing to store the positions
of things that <em>might</em> be delimiters, if another matching
delimiter is found. They are identified by objects with these
properties.</p>
<dl><dt id="user-content-delimitertype.resolve">
  <code><strong><a href="#user-content-delimitertype.resolve">resolve</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>If this is given, the delimiter should be matched automatically
when a piece of inline content is finished. Such delimiters will
be matched with delimiters of the same type according to their
<a href="#user-content-inlinecontext.adddelimiter">open and close</a> properties. When a
match is found, the content between the delimiters is wrapped in
a node whose name is given by the value of this property.</p>
<p>When this isn't given, you need to match the delimiter eagerly
using the <a href="#user-content-inlinecontext.findopeningdelimiter"><code>findOpeningDelimiter</code></a>
and <a href="#user-content-inlinecontext.takecontent"><code>takeContent</code></a> methods.</p>
</dd><dt id="user-content-delimitertype.mark">
  <code><strong><a href="#user-content-delimitertype.mark">mark</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String">string</a></code></dt>

<dd><p>If the delimiter itself should, when matched, create a syntax
node, set this to the name of the syntax node.</p>
</dd></dl>

</dd>
</dl>
<dl>
<dt id="user-content-element">
  <h4>
    <code>class</code>
    <a href="#user-content-element">Element</a></h4>
</dt>

<dd><p>Elements are used to compose syntax nodes during parsing.</p>
<dl><dt id="user-content-element.type">
  <code><strong><a href="#user-content-element.type">type</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The node's
<a href="https://lezer.codemirror.net/docs/ref/#common.NodeType.id">id</a>.</p>
</dd><dt id="user-content-element.from">
  <code><strong><a href="#user-content-element.from">from</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The start of the node, as an offset from the start of the document.</p>
</dd><dt id="user-content-element.to">
  <code><strong><a href="#user-content-element.to">to</a></strong>: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number">number</a></code></dt>

<dd><p>The end of the node.</p>
</dd></dl>

</dd>
</dl>
