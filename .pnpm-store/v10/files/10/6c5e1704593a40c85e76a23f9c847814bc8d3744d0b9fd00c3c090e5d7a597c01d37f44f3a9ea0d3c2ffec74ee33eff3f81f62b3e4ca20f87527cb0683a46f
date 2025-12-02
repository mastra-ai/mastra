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

@parser

@MarkdownParser

@MarkdownConfig

@MarkdownExtension

@parseCode

### GitHub Flavored Markdown

@GFM

@Table

@TaskList

@Strikethrough

@Autolink

### Other extensions

@Subscript

@Superscript

@Emoji

### Extension

The parser can, to a certain extent, be extended to handle additional
syntax.

@NodeSpec

@BlockContext

@BlockParser

@LeafBlockParser

@Line

@LeafBlock

@InlineContext

@InlineParser

@DelimiterType

@Element
