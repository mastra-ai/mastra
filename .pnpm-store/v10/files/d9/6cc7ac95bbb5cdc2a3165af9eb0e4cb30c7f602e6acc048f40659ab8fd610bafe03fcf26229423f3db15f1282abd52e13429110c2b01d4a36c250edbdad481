import { PartialParse, Tree, NodeType, NodePropSource, ParseWrapper, Parser, NodeSet, Input, TreeFragment } from '@lezer/common';
import { Tag } from '@lezer/highlight';

/**
Data structure used to accumulate a block's content during [leaf
block parsing](#BlockParser.leaf).
*/
declare class LeafBlock {
    /**
    The start position of the block.
    */
    readonly start: number;
    /**
    The block's text content.
    */
    content: string;
    /**
    The block parsers active for this block.
    */
    parsers: LeafBlockParser[];
}
/**
Data structure used during block-level per-line parsing.
*/
declare class Line {
    /**
    The line's full text.
    */
    text: string;
    /**
    The base indent provided by the composite contexts (that have
    been handled so far).
    */
    baseIndent: number;
    /**
    The string position corresponding to the base indent.
    */
    basePos: number;
    /**
    The position of the next non-whitespace character beyond any
    list, blockquote, or other composite block markers.
    */
    pos: number;
    /**
    The column of the next non-whitespace character.
    */
    indent: number;
    /**
    The character code of the character after `pos`.
    */
    next: number;
    /**
    Skip whitespace after the given position, return the position of
    the next non-space character or the end of the line if there's
    only space after `from`.
    */
    skipSpace(from: number): number;
    /**
    Move the line's base position forward to the given position.
    This should only be called by composite [block
    parsers](#BlockParser.parse) or [markup skipping
    functions](#NodeSpec.composite).
    */
    moveBase(to: number): void;
    /**
    Move the line's base position forward to the given _column_.
    */
    moveBaseColumn(indent: number): void;
    /**
    Store a composite-block-level marker. Should be called from
    [markup skipping functions](#NodeSpec.composite) when they
    consume any non-whitespace characters.
    */
    addMarker(elt: Element): void;
    /**
    Find the column position at `to`, optionally starting at a given
    position and column.
    */
    countIndent(to: number, from?: number, indent?: number): number;
    /**
    Find the position corresponding to the given column.
    */
    findColumn(goal: number): number;
}
type BlockResult = boolean | null;
/**
Block-level parsing functions get access to this context object.
*/
declare class BlockContext implements PartialParse {
    /**
    The parser configuration used.
    */
    readonly parser: MarkdownParser;
    private line;
    private atEnd;
    private fragments;
    private to;
    stoppedAt: number | null;
    /**
    The start of the current line.
    */
    lineStart: number;
    get parsedPos(): number;
    advance(): Tree | null;
    stopAt(pos: number): void;
    private reuseFragment;
    /**
    The number of parent blocks surrounding the current block.
    */
    get depth(): number;
    /**
    Get the type of the parent block at the given depth. When no
    depth is passed, return the type of the innermost parent.
    */
    parentType(depth?: number): NodeType;
    /**
    Move to the next input line. This should only be called by
    (non-composite) [block parsers](#BlockParser.parse) that consume
    the line directly, or leaf block parser
    [`nextLine`](#LeafBlockParser.nextLine) methods when they
    consume the current line (and return true).
    */
    nextLine(): boolean;
    /**
    Retrieve the text of the line after the current one, without
    actually moving the context's current line forward.
    */
    peekLine(): string;
    private moveRangeI;
    private lineChunkAt;
    /**
    The end position of the previous line.
    */
    prevLineEnd(): number;
    /**
    Start a composite block. Should only be called from [block
    parser functions](#BlockParser.parse) that return null.
    */
    startComposite(type: string, start: number, value?: number): void;
    /**
    Add a block element. Can be called by [block
    parsers](#BlockParser.parse).
    */
    addElement(elt: Element): void;
    /**
    Add a block element from a [leaf parser](#LeafBlockParser). This
    makes sure any extra composite block markup (such as blockquote
    markers) inside the block are also added to the syntax tree.
    */
    addLeafElement(leaf: LeafBlock, elt: Element): void;
    private finish;
    private addGaps;
    /**
    Create an [`Element`](#Element) object to represent some syntax
    node.
    */
    elt(type: string, from: number, to: number, children?: readonly Element[]): Element;
    elt(tree: Tree, at: number): Element;
}
/**
Used in the [configuration](#MarkdownConfig.defineNodes) to define
new [syntax node
types](https://lezer.codemirror.net/docs/ref/#common.NodeType).
*/
interface NodeSpec {
    /**
    The node's name.
    */
    name: string;
    /**
    Should be set to true if this type represents a block node.
    */
    block?: boolean;
    /**
    If this is a composite block, this should hold a function that,
    at the start of a new line where that block is active, checks
    whether the composite block should continue (return value) and
    optionally [adjusts](#Line.moveBase) the line's base position
    and [registers](#Line.addMarker) nodes for any markers involved
    in the block's syntax.
    */
    composite?(cx: BlockContext, line: Line, value: number): boolean;
    /**
    Add highlighting tag information for this node. The value of
    this property may either by a tag or array of tags to assign
    directly to this node, or an object in the style of
    [`styleTags`](https://lezer.codemirror.net/docs/ref/#highlight.styleTags)'s
    argument to assign more complicated rules.
    */
    style?: Tag | readonly Tag[] | {
        [selector: string]: Tag | readonly Tag[];
    };
}
/**
Inline parsers are called for every character of parts of the
document that are parsed as inline content.
*/
interface InlineParser {
    /**
    This parser's name, which can be used by other parsers to
    [indicate](#InlineParser.before) a relative precedence.
    */
    name: string;
    /**
    The parse function. Gets the next character and its position as
    arguments. Should return -1 if it doesn't handle the character,
    or add some [element](#InlineContext.addElement) or
    [delimiter](#InlineContext.addDelimiter) and return the end
    position of the content it parsed if it can.
    */
    parse(cx: InlineContext, next: number, pos: number): number;
    /**
    When given, this parser will be installed directly before the
    parser with the given name. The default configuration defines
    inline parsers with names Escape, Entity, InlineCode, HTMLTag,
    Emphasis, HardBreak, Link, and Image. When no `before` or
    `after` property is given, the parser is added to the end of the
    list.
    */
    before?: string;
    /**
    When given, the parser will be installed directly _after_ the
    parser with the given name.
    */
    after?: string;
}
/**
Block parsers handle block-level structure. There are three
general types of block parsers:

- Composite block parsers, which handle things like lists and
  blockquotes. These define a [`parse`](#BlockParser.parse) method
  that [starts](#BlockContext.startComposite) a composite block
  and returns null when it recognizes its syntax.

- Eager leaf block parsers, used for things like code or HTML
  blocks. These can unambiguously recognize their content from its
  first line. They define a [`parse`](#BlockParser.parse) method
  that, if it recognizes the construct,
  [moves](#BlockContext.nextLine) the current line forward to the
  line beyond the end of the block,
  [add](#BlockContext.addElement) a syntax node for the block, and
  return true.

- Leaf block parsers that observe a paragraph-like construct as it
  comes in, and optionally decide to handle it at some point. This
  is used for "setext" (underlined) headings and link references.
  These define a [`leaf`](#BlockParser.leaf) method that checks
  the first line of the block and returns a
  [`LeafBlockParser`](#LeafBlockParser) object if it wants to
  observe that block.
*/
interface BlockParser {
    /**
    The name of the parser. Can be used by other block parsers to
    [specify](#BlockParser.before) precedence.
    */
    name: string;
    /**
    The eager parse function, which can look at the block's first
    line and return `false` to do nothing, `true` if it has parsed
    (and [moved past](#BlockContext.nextLine) a block), or `null` if
    it has started a composite block.
    */
    parse?(cx: BlockContext, line: Line): BlockResult;
    /**
    A leaf parse function. If no [regular](#BlockParser.parse) parse
    functions match for a given line, its content will be
    accumulated for a paragraph-style block. This method can return
    an [object](#LeafBlockParser) that overrides that style of
    parsing in some situations.
    */
    leaf?(cx: BlockContext, leaf: LeafBlock): LeafBlockParser | null;
    /**
    Some constructs, such as code blocks or newly started
    blockquotes, can interrupt paragraphs even without a blank line.
    If your construct can do this, provide a predicate here that
    recognizes lines that should end a paragraph (or other non-eager
    [leaf block](#BlockParser.leaf)).
    */
    endLeaf?(cx: BlockContext, line: Line, leaf: LeafBlock): boolean;
    /**
    When given, this parser will be installed directly before the
    block parser with the given name. The default configuration
    defines block parsers with names LinkReference, IndentedCode,
    FencedCode, Blockquote, HorizontalRule, BulletList, OrderedList,
    ATXHeading, HTMLBlock, and SetextHeading.
    */
    before?: string;
    /**
    When given, the parser will be installed directly _after_ the
    parser with the given name.
    */
    after?: string;
}
/**
Objects that are used to [override](#BlockParser.leaf)
paragraph-style blocks should conform to this interface.
*/
interface LeafBlockParser {
    /**
    Update the parser's state for the next line, and optionally
    finish the block. This is not called for the first line (the
    object is constructed at that line), but for any further lines.
    When it returns `true`, the block is finished. It is okay for
    the function to [consume](#BlockContext.nextLine) the current
    line or any subsequent lines when returning true.
    */
    nextLine(cx: BlockContext, line: Line, leaf: LeafBlock): boolean;
    /**
    Called when the block is finished by external circumstances
    (such as a blank line or the [start](#BlockParser.endLeaf) of
    another construct). If this parser can handle the block up to
    its current position, it should
    [finish](#BlockContext.addLeafElement) the block and return
    true.
    */
    finish(cx: BlockContext, leaf: LeafBlock): boolean;
}
/**
Objects of this type are used to
[configure](#MarkdownParser.configure) the Markdown parser.
*/
interface MarkdownConfig {
    /**
    Node props to add to the parser's node set.
    */
    props?: readonly NodePropSource[];
    /**
    Define new [node types](#NodeSpec) for use in parser extensions.
    */
    defineNodes?: readonly (string | NodeSpec)[];
    /**
    Define additional [block parsing](#BlockParser) logic.
    */
    parseBlock?: readonly BlockParser[];
    /**
    Define new [inline parsing](#InlineParser) logic.
    */
    parseInline?: readonly InlineParser[];
    /**
    Remove the named parsers from the configuration.
    */
    remove?: readonly string[];
    /**
    Add a parse wrapper (such as a [mixed-language
    parser](#common.parseMixed)) to this parser.
    */
    wrap?: ParseWrapper;
}
/**
To make it possible to group extensions together into bigger
extensions (such as the [Github-flavored Markdown](#GFM)
extension), [reconfiguration](#MarkdownParser.configure) accepts
nested arrays of [config](#MarkdownConfig) objects.
*/
type MarkdownExtension = MarkdownConfig | readonly MarkdownExtension[];
/**
A Markdown parser configuration.
*/
declare class MarkdownParser extends Parser {
    /**
    The parser's syntax [node
    types](https://lezer.codemirror.net/docs/ref/#common.NodeSet).
    */
    readonly nodeSet: NodeSet;
    createParse(input: Input, fragments: readonly TreeFragment[], ranges: readonly {
        from: number;
        to: number;
    }[]): PartialParse;
    /**
    Reconfigure the parser.
    */
    configure(spec: MarkdownExtension): MarkdownParser;
    /**
    Parse the given piece of inline text at the given offset,
    returning an array of [`Element`](#Element) objects representing
    the inline content.
    */
    parseInline(text: string, offset: number): Element[];
}
/**
Elements are used to compose syntax nodes during parsing.
*/
declare class Element {
    /**
    The node's
    [id](https://lezer.codemirror.net/docs/ref/#common.NodeType.id).
    */
    readonly type: number;
    /**
    The start of the node, as an offset from the start of the document.
    */
    readonly from: number;
    /**
    The end of the node.
    */
    readonly to: number;
}
/**
Delimiters are used during inline parsing to store the positions
of things that _might_ be delimiters, if another matching
delimiter is found. They are identified by objects with these
properties.
*/
interface DelimiterType {
    /**
    If this is given, the delimiter should be matched automatically
    when a piece of inline content is finished. Such delimiters will
    be matched with delimiters of the same type according to their
    [open and close](#InlineContext.addDelimiter) properties. When a
    match is found, the content between the delimiters is wrapped in
    a node whose name is given by the value of this property.
    
    When this isn't given, you need to match the delimiter eagerly
    using the [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter)
    and [`takeContent`](#InlineContext.takeContent) methods.
    */
    resolve?: string;
    /**
    If the delimiter itself should, when matched, create a syntax
    node, set this to the name of the syntax node.
    */
    mark?: string;
}
/**
Inline parsing functions get access to this context, and use it to
read the content and emit syntax nodes.
*/
declare class InlineContext {
    /**
    The parser that is being used.
    */
    readonly parser: MarkdownParser;
    /**
    The text of this inline section.
    */
    readonly text: string;
    /**
    The starting offset of the section in the document.
    */
    readonly offset: number;
    /**
    Get the character code at the given (document-relative)
    position.
    */
    char(pos: number): number;
    /**
    The position of the end of this inline section.
    */
    get end(): number;
    /**
    Get a substring of this inline section. Again uses
    document-relative positions.
    */
    slice(from: number, to: number): string;
    /**
    Add a [delimiter](#DelimiterType) at this given position. `open`
    and `close` indicate whether this delimiter is opening, closing,
    or both. Returns the end of the delimiter, for convenient
    returning from [parse functions](#InlineParser.parse).
    */
    addDelimiter(type: DelimiterType, from: number, to: number, open: boolean, close: boolean): number;
    /**
    Returns true when there is an unmatched link or image opening
    token before the current position.
    */
    get hasOpenLink(): boolean;
    /**
    Add an inline element. Returns the end of the element.
    */
    addElement(elt: Element): number;
    /**
    Find an opening delimiter of the given type. Returns `null` if
    no delimiter is found, or an index that can be passed to
    [`takeContent`](#InlineContext.takeContent) otherwise.
    */
    findOpeningDelimiter(type: DelimiterType): number | null;
    /**
    Remove all inline elements and delimiters starting from the
    given index (which you should get from
    [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter),
    resolve delimiters inside of them, and return them as an array
    of elements.
    */
    takeContent(startIndex: number): Element[];
    /**
    Return the delimiter at the given index. Mostly useful to get
    additional info out of a delimiter index returned by
    [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter).
    Returns null if there is no delimiter at this index.
    */
    getDelimiterAt(index: number): {
        from: number;
        to: number;
        type: DelimiterType;
    } | null;
    /**
    Skip space after the given (document) position, returning either
    the position of the next non-space character or the end of the
    section.
    */
    skipSpace(from: number): number;
    /**
    Create an [`Element`](#Element) for a syntax node.
    */
    elt(type: string, from: number, to: number, children?: readonly Element[]): Element;
    elt(tree: Tree, at: number): Element;
}
/**
The default CommonMark parser.
*/
declare const parser: MarkdownParser;

/**
Create a Markdown extension to enable nested parsing on code
blocks and/or embedded HTML.
*/
declare function parseCode(config: {
    /**
    When provided, this will be used to parse the content of code
    blocks. `info` is the string after the opening ` ``` ` marker,
    or the empty string if there is no such info or this is an
    indented code block. If there is a parser available for the
    code, it should return a function that can construct the
    [parse](https://lezer.codemirror.net/docs/ref/#common.PartialParse).
    */
    codeParser?: (info: string) => null | Parser;
    /**
    The parser used to parse HTML tags (both block and inline).
    */
    htmlParser?: Parser;
}): MarkdownExtension;

/**
An extension that implements
[GFM-style](https://github.github.com/gfm/#strikethrough-extension-)
Strikethrough syntax using `~~` delimiters.
*/
declare const Strikethrough: MarkdownConfig;
/**
This extension provides
[GFM-style](https://github.github.com/gfm/#tables-extension-)
tables, using syntax like this:

```
| head 1 | head 2 |
| ---    | ---    |
| cell 1 | cell 2 |
```
*/
declare const Table: MarkdownConfig;
/**
Extension providing
[GFM-style](https://github.github.com/gfm/#task-list-items-extension-)
task list items, where list items can be prefixed with `[ ]` or
`[x]` to add a checkbox.
*/
declare const TaskList: MarkdownConfig;
/**
Extension that implements autolinking for
`www.`/`http://`/`https://`/`mailto:`/`xmpp:` URLs and email
addresses.
*/
declare const Autolink: MarkdownConfig;
/**
Extension bundle containing [`Table`](#Table),
[`TaskList`](#TaskList), [`Strikethrough`](#Strikethrough), and
[`Autolink`](#Autolink).
*/
declare const GFM: MarkdownConfig[];
/**
Extension providing
[Pandoc-style](https://pandoc.org/MANUAL.html#superscripts-and-subscripts)
superscript using `^` markers.
*/
declare const Superscript: MarkdownConfig;
/**
Extension providing
[Pandoc-style](https://pandoc.org/MANUAL.html#superscripts-and-subscripts)
subscript using `~` markers.
*/
declare const Subscript: MarkdownConfig;
/**
Extension that parses two colons with only letters, underscores,
and numbers between them as `Emoji` nodes.
*/
declare const Emoji: MarkdownConfig;

export { Autolink, BlockContext, type BlockParser, type DelimiterType, Element, Emoji, GFM, InlineContext, type InlineParser, LeafBlock, type LeafBlockParser, Line, type MarkdownConfig, type MarkdownExtension, MarkdownParser, type NodeSpec, Strikethrough, Subscript, Superscript, Table, TaskList, parseCode, parser };
