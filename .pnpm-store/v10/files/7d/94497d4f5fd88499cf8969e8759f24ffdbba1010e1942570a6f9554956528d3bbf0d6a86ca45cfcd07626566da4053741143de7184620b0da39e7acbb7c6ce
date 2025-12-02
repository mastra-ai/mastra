import {Tree, TreeBuffer, NodeType, NodeProp, NodePropSource, TreeFragment, NodeSet, TreeCursor,
        Input, Parser, PartialParse, SyntaxNode, ParseWrapper} from "@lezer/common"
import {styleTags, tags as t, Tag} from "@lezer/highlight"

class CompositeBlock {
  static create(type: number, value: number, from: number, parentHash: number, end: number) {
    let hash = (parentHash + (parentHash << 8) + type + (value << 4)) | 0
    return new CompositeBlock(type, value, from, hash, end, [], [])
  }

  /// @internal
  hashProp: [NodeProp<any>, any][]

  constructor(readonly type: number,
              // Used for indentation in list items, markup character in lists
              readonly value: number,
              readonly from: number,
              readonly hash: number,
              public end: number,
              readonly children: (Tree | TreeBuffer)[],
              readonly positions: number[]) {
    this.hashProp = [[NodeProp.contextHash, hash]]
  }

  addChild(child: Tree, pos: number) {
    if (child.prop(NodeProp.contextHash) != this.hash)
      child = new Tree(child.type, child.children, child.positions, child.length, this.hashProp)
    this.children.push(child)
    this.positions.push(pos)
  }

  toTree(nodeSet: NodeSet, end = this.end) {
    let last = this.children.length - 1
    if (last >= 0) end = Math.max(end, this.positions[last] + this.children[last].length + this.from)
    return new Tree(nodeSet.types[this.type], this.children, this.positions, end - this.from).balance({
      makeTree: (children, positions, length) => new Tree(NodeType.none, children, positions, length, this.hashProp)
    })
  }
}

export enum Type {
  Document = 1,

  CodeBlock,
  FencedCode,
  Blockquote,
  HorizontalRule,
  BulletList,
  OrderedList,
  ListItem,
  ATXHeading1,
  ATXHeading2,
  ATXHeading3,
  ATXHeading4,
  ATXHeading5,
  ATXHeading6,
  SetextHeading1,
  SetextHeading2,
  HTMLBlock,
  LinkReference,
  Paragraph,
  CommentBlock,
  ProcessingInstructionBlock,

  // Inline
  Escape,
  Entity,
  HardBreak,
  Emphasis,
  StrongEmphasis,
  Link,
  Image,
  InlineCode,
  HTMLTag,
  Comment,
  ProcessingInstruction,
  Autolink,

  // Smaller tokens
  HeaderMark,
  QuoteMark,
  ListMark,
  LinkMark,
  EmphasisMark,
  CodeMark,
  CodeText,
  CodeInfo,
  LinkTitle,
  LinkLabel,
  URL
}

/// Data structure used to accumulate a block's content during [leaf
/// block parsing](#BlockParser.leaf).
export class LeafBlock {
  /// @internal
  marks: Element[] = []
  /// The block parsers active for this block.
  parsers: LeafBlockParser[] = []

  /// @internal
  constructor(
    /// The start position of the block.
    readonly start: number,
    /// The block's text content.
    public content: string
  ) {}
}

/// Data structure used during block-level per-line parsing.
export class Line {
  /// The line's full text.
  text = ""
  /// The base indent provided by the composite contexts (that have
  /// been handled so far).
  baseIndent = 0
  /// The string position corresponding to the base indent.
  basePos = 0
  /// The number of contexts handled @internal
  depth = 0
  /// Any markers (i.e. block quote markers) parsed for the contexts. @internal
  markers: Element[] = []
  /// The position of the next non-whitespace character beyond any
  /// list, blockquote, or other composite block markers.
  pos = 0
  /// The column of the next non-whitespace character.
  indent = 0
  /// The character code of the character after `pos`.
  next = -1

  /// @internal
  forward() {
    if (this.basePos > this.pos) this.forwardInner()
  }
  
  /// @internal
  forwardInner() {
    let newPos = this.skipSpace(this.basePos)
    this.indent = this.countIndent(newPos, this.pos, this.indent)
    this.pos = newPos
    this.next = newPos == this.text.length ? -1 : this.text.charCodeAt(newPos)
  }

  /// Skip whitespace after the given position, return the position of
  /// the next non-space character or the end of the line if there's
  /// only space after `from`.
  skipSpace(from: number) { return skipSpace(this.text, from) }

  /// @internal
  reset(text: string) {
    this.text = text
    this.baseIndent = this.basePos = this.pos = this.indent = 0
    this.forwardInner()
    this.depth = 1
    while (this.markers.length) this.markers.pop()
  }

  /// Move the line's base position forward to the given position.
  /// This should only be called by composite [block
  /// parsers](#BlockParser.parse) or [markup skipping
  /// functions](#NodeSpec.composite).
  moveBase(to: number) {
    this.basePos = to
    this.baseIndent = this.countIndent(to, this.pos, this.indent)
  }

  /// Move the line's base position forward to the given _column_.
  moveBaseColumn(indent: number) {
    this.baseIndent = indent
    this.basePos = this.findColumn(indent)
  }

  /// Store a composite-block-level marker. Should be called from
  /// [markup skipping functions](#NodeSpec.composite) when they
  /// consume any non-whitespace characters.
  addMarker(elt: Element) {
    this.markers.push(elt)
  }

  /// Find the column position at `to`, optionally starting at a given
  /// position and column.
  countIndent(to: number, from = 0, indent = 0) {
    for (let i = from; i < to; i++)
      indent += this.text.charCodeAt(i) == 9 ? 4 - indent % 4 : 1
    return indent
  }

  /// Find the position corresponding to the given column.
  findColumn(goal: number) {
    let i = 0
    for (let indent = 0; i < this.text.length && indent < goal; i++)
      indent += this.text.charCodeAt(i) == 9 ? 4 - indent % 4 : 1
    return i
  }

  /// @internal
  scrub() {
    if (!this.baseIndent) return this.text
    let result = ""
    for (let i = 0; i < this.basePos; i++) result += " "
    return result + this.text.slice(this.basePos)
  }
}

function skipForList(bl: CompositeBlock, cx: BlockContext, line: Line) {
  if (line.pos == line.text.length ||
      (bl != cx.block && line.indent >= cx.stack[line.depth + 1].value + line.baseIndent)) return true
  if (line.indent >= line.baseIndent + 4) return false
  let size = (bl.type == Type.OrderedList ? isOrderedList : isBulletList)(line, cx, false)
  return size > 0 &&
    (bl.type != Type.BulletList || isHorizontalRule(line, cx, false) < 0) &&
    line.text.charCodeAt(line.pos + size - 1) == bl.value
}

const DefaultSkipMarkup: {[type: number]: (bl: CompositeBlock, cx: BlockContext, line: Line) => boolean} = {
  [Type.Blockquote](bl, cx, line) {
    if (line.next != 62 /* '>' */) return false
    line.markers.push(elt(Type.QuoteMark, cx.lineStart + line.pos, cx.lineStart + line.pos + 1))
    line.moveBase(line.pos + (space(line.text.charCodeAt(line.pos + 1)) ? 2 : 1))
    bl.end = cx.lineStart + line.text.length
    return true
  },
  [Type.ListItem](bl, _cx, line) {
    if (line.indent < line.baseIndent + bl.value && line.next > -1) return false
    line.moveBaseColumn(line.baseIndent + bl.value)
    return true
  },
  [Type.OrderedList]: skipForList,
  [Type.BulletList]: skipForList,
  [Type.Document]() { return true }
}

export function space(ch: number) { return ch == 32 || ch == 9 || ch == 10 || ch == 13 }

function skipSpace(line: string, i = 0) {
  while (i < line.length && space(line.charCodeAt(i))) i++
  return i
}

function skipSpaceBack(line: string, i: number, to: number) {
  while (i > to && space(line.charCodeAt(i - 1))) i--
  return i
}

function isFencedCode(line: Line) {
  if (line.next != 96 && line.next != 126 /* '`~' */) return -1
  let pos = line.pos + 1
  while (pos < line.text.length && line.text.charCodeAt(pos) == line.next) pos++
  if (pos < line.pos + 3) return -1
  if (line.next == 96) for (let i = pos; i < line.text.length; i++) if (line.text.charCodeAt(i) == 96) return -1
  return pos
}

function isBlockquote(line: Line) {
  return line.next != 62 /* '>' */ ? -1 : line.text.charCodeAt(line.pos + 1) == 32 ? 2 : 1
}

function isHorizontalRule(line: Line, cx: BlockContext, breaking: boolean) {
  if (line.next != 42 && line.next != 45 && line.next != 95 /* '_-*' */) return -1
  let count = 1
  for (let pos = line.pos + 1; pos < line.text.length; pos++) {
    let ch = line.text.charCodeAt(pos)
    if (ch == line.next) count++
    else if (!space(ch)) return -1
  }
  // Setext headers take precedence
  if (breaking && line.next == 45 && isSetextUnderline(line) > -1 && line.depth == cx.stack.length &&
      cx.parser.leafBlockParsers.indexOf(DefaultLeafBlocks.SetextHeading) > -1) return -1
  return count < 3 ? -1 : 1
}

function inList(cx: BlockContext, type: Type) {
  for (let i = cx.stack.length - 1; i >= 0; i--)
    if (cx.stack[i].type == type) return true
  return false
}

function isBulletList(line: Line, cx: BlockContext, breaking: boolean) {
  return (line.next == 45 || line.next == 43 || line.next == 42 /* '-+*' */) &&
    (line.pos == line.text.length - 1 || space(line.text.charCodeAt(line.pos + 1))) &&
    (!breaking || inList(cx, Type.BulletList) || line.skipSpace(line.pos + 2) < line.text.length) ? 1 : -1
}

function isOrderedList(line: Line, cx: BlockContext, breaking: boolean) {
  let pos = line.pos, next = line.next
  for (;;) {
    if (next >= 48 && next <= 57 /* '0-9' */) pos++
    else break
    if (pos == line.text.length) return -1
    next = line.text.charCodeAt(pos)
  }
  if (pos == line.pos || pos > line.pos + 9 ||
      (next != 46 && next != 41 /* '.)' */) ||
      (pos < line.text.length - 1 && !space(line.text.charCodeAt(pos + 1))) ||
      breaking && !inList(cx, Type.OrderedList) &&
      (line.skipSpace(pos + 1) == line.text.length || pos > line.pos + 1 || line.next != 49 /* '1' */))
    return -1
  return pos + 1 - line.pos
}

function isAtxHeading(line: Line) {
  if (line.next != 35 /* '#' */) return -1
  let pos = line.pos + 1
  while (pos < line.text.length && line.text.charCodeAt(pos) == 35) pos++
  if (pos < line.text.length && line.text.charCodeAt(pos) != 32) return -1
  let size = pos - line.pos
  return size > 6 ? -1 : size
}

function isSetextUnderline(line: Line) {
  if (line.next != 45 && line.next != 61 /* '-=' */ || line.indent >= line.baseIndent + 4) return -1
  let pos = line.pos + 1
  while (pos < line.text.length && line.text.charCodeAt(pos) == line.next) pos++
  let end = pos
  while (pos < line.text.length && space(line.text.charCodeAt(pos))) pos++
  return pos == line.text.length ? end : -1
}

const EmptyLine = /^[ \t]*$/, CommentEnd = /-->/, ProcessingEnd = /\?>/
const HTMLBlockStyle = [
  [/^<(?:script|pre|style)(?:\s|>|$)/i, /<\/(?:script|pre|style)>/i],
  [/^\s*<!--/, CommentEnd],
  [/^\s*<\?/, ProcessingEnd],
  [/^\s*<![A-Z]/, />/],
  [/^\s*<!\[CDATA\[/, /\]\]>/],
  [/^\s*<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i, EmptyLine],
  [/^\s*(?:<\/[a-z][\w-]*\s*>|<[a-z][\w-]*(\s+[a-z:_][\w-.]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*>)\s*$/i, EmptyLine]
]

function isHTMLBlock(line: Line, _cx: BlockContext, breaking: boolean) {
  if (line.next != 60 /* '<' */) return -1
  let rest = line.text.slice(line.pos)
  for (let i = 0, e = HTMLBlockStyle.length - (breaking ? 1 : 0); i < e; i++)
    if (HTMLBlockStyle[i][0].test(rest)) return i
  return -1
}

function getListIndent(line: Line, pos: number) {
  let indentAfter = line.countIndent(pos, line.pos, line.indent)
  let indented = line.countIndent(line.skipSpace(pos), pos, indentAfter)
  return indented >= indentAfter + 5 ? indentAfter + 1 : indented
}

// Return type for block parsing functions. Can be either:
//
// - false to indicate that nothing was matched and lower-precedence
//   parsers should run.
//
// - true to indicate that a leaf block was parsed and the stream
//   was advanced past its content.
//
// - null to indicate that a context was opened and block parsing
//   should continue on this line.
type BlockResult = boolean | null

function addCodeText(marks: Element[], from: number, to: number) {
  let last = marks.length - 1
  if (last >= 0 && marks[last].to == from && marks[last].type == Type.CodeText) (marks[last] as any).to = to
  else marks.push(elt(Type.CodeText, from, to))
}

// Rules for parsing blocks. A return value of false means the rule
// doesn't apply here, true means it does. When true is returned and
// `p.line` has been updated, the rule is assumed to have consumed a
// leaf block. Otherwise, it is assumed to have opened a context.
const DefaultBlockParsers: {[name: string]: ((cx: BlockContext, line: Line) => BlockResult) | undefined} = {
  LinkReference: undefined,

  IndentedCode(cx, line) {
    let base = line.baseIndent + 4
    if (line.indent < base) return false
    let start = line.findColumn(base)
    let from = cx.lineStart + start, to = cx.lineStart + line.text.length
    let marks: Element[] = [], pendingMarks: Element[] = []
    addCodeText(marks, from, to)
    while (cx.nextLine() && line.depth >= cx.stack.length) {
      if (line.pos == line.text.length) { // Empty
        addCodeText(pendingMarks, cx.lineStart - 1, cx.lineStart)
        for (let m of line.markers) pendingMarks.push(m)
      } else if (line.indent < base) {
        break
      } else {
        if (pendingMarks.length) {
          for (let m of pendingMarks) {
            if (m.type == Type.CodeText) addCodeText(marks, m.from, m.to)
            else marks.push(m)
          }
          pendingMarks = []
        }
        addCodeText(marks, cx.lineStart - 1, cx.lineStart)
        for (let m of line.markers) marks.push(m)
        to = cx.lineStart + line.text.length
        let codeStart = cx.lineStart + line.findColumn(line.baseIndent + 4)
        if (codeStart < to) addCodeText(marks, codeStart, to)
      }
    }
    if (pendingMarks.length) {
      pendingMarks = pendingMarks.filter(m => m.type != Type.CodeText)
      if (pendingMarks.length) line.markers = pendingMarks.concat(line.markers)
    }

    cx.addNode(cx.buffer.writeElements(marks, -from).finish(Type.CodeBlock, to - from), from)
    return true
  },

  FencedCode(cx, line) {
    let fenceEnd = isFencedCode(line)
    if (fenceEnd < 0) return false
    let from = cx.lineStart + line.pos, ch = line.next, len = fenceEnd - line.pos
    let infoFrom = line.skipSpace(fenceEnd), infoTo = skipSpaceBack(line.text, line.text.length, infoFrom)
    let marks: (Element | TreeElement)[] = [elt(Type.CodeMark, from, from + len)]
    if (infoFrom < infoTo)
      marks.push(elt(Type.CodeInfo, cx.lineStart + infoFrom, cx.lineStart + infoTo))

    for (let first = true; cx.nextLine() && line.depth >= cx.stack.length; first = false) {
      let i = line.pos
      if (line.indent - line.baseIndent < 4)
        while (i < line.text.length && line.text.charCodeAt(i) == ch) i++
      if (i - line.pos >= len && line.skipSpace(i) == line.text.length) {
        for (let m of line.markers) marks.push(m)
        marks.push(elt(Type.CodeMark, cx.lineStart + line.pos, cx.lineStart + i))
        cx.nextLine()
        break
      } else {
        if (!first) addCodeText(marks, cx.lineStart - 1, cx.lineStart)
        for (let m of line.markers) marks.push(m)
        let textStart = cx.lineStart + line.basePos, textEnd = cx.lineStart + line.text.length
        if (textStart < textEnd) addCodeText(marks, textStart, textEnd)
      }
    }
    cx.addNode(cx.buffer.writeElements(marks, -from)
      .finish(Type.FencedCode, cx.prevLineEnd() - from), from)
    return true
  },

  Blockquote(cx, line) {
    let size = isBlockquote(line)
    if (size < 0) return false
    cx.startContext(Type.Blockquote, line.pos)
    cx.addNode(Type.QuoteMark, cx.lineStart + line.pos, cx.lineStart + line.pos + 1)
    line.moveBase(line.pos + size)
    return null
  },

  HorizontalRule(cx, line) {
    if (isHorizontalRule(line, cx, false) < 0) return false
    let from = cx.lineStart + line.pos
    cx.nextLine()
    cx.addNode(Type.HorizontalRule, from)
    return true
  },

  BulletList(cx, line) {
    let size = isBulletList(line, cx, false)
    if (size < 0) return false
    if (cx.block.type != Type.BulletList)
      cx.startContext(Type.BulletList, line.basePos, line.next)
    let newBase = getListIndent(line, line.pos + 1)
    cx.startContext(Type.ListItem, line.basePos, newBase - line.baseIndent)
    cx.addNode(Type.ListMark, cx.lineStart + line.pos, cx.lineStart + line.pos + size)
    line.moveBaseColumn(newBase)
    return null
  },

  OrderedList(cx, line) {
    let size = isOrderedList(line, cx, false)
    if (size < 0) return false
    if (cx.block.type != Type.OrderedList)
      cx.startContext(Type.OrderedList, line.basePos, line.text.charCodeAt(line.pos + size - 1))
    let newBase = getListIndent(line, line.pos + size)
    cx.startContext(Type.ListItem, line.basePos, newBase - line.baseIndent)
    cx.addNode(Type.ListMark, cx.lineStart + line.pos, cx.lineStart + line.pos + size)
    line.moveBaseColumn(newBase)
    return null
  },

  ATXHeading(cx, line) {
    let size = isAtxHeading(line)
    if (size < 0) return false
    let off = line.pos, from = cx.lineStart + off
    let endOfSpace = skipSpaceBack(line.text, line.text.length, off), after = endOfSpace
    while (after > off && line.text.charCodeAt(after - 1) == line.next) after--
    if (after == endOfSpace || after == off || !space(line.text.charCodeAt(after - 1))) after = line.text.length
    let buf = cx.buffer
      .write(Type.HeaderMark, 0, size)
      .writeElements(cx.parser.parseInline(line.text.slice(off + size + 1, after), from + size + 1), -from)
    if (after < line.text.length) buf.write(Type.HeaderMark, after - off, endOfSpace - off)
    let node = buf.finish(Type.ATXHeading1 - 1 + size, line.text.length - off)
    cx.nextLine()
    cx.addNode(node, from)
    return true
  },

  HTMLBlock(cx, line) {
    let type = isHTMLBlock(line, cx, false)
    if (type < 0) return false
    let from = cx.lineStart + line.pos, end = HTMLBlockStyle[type][1]
    let marks: Element[] = [], trailing = end != EmptyLine
    while (!end.test(line.text) && cx.nextLine()) {
      if (line.depth < cx.stack.length) { trailing = false; break }
      for (let m of line.markers) marks.push(m)
    }
    if (trailing) cx.nextLine()
    let nodeType = end == CommentEnd ? Type.CommentBlock : end == ProcessingEnd ? Type.ProcessingInstructionBlock : Type.HTMLBlock
    let to = cx.prevLineEnd()
    cx.addNode(cx.buffer.writeElements(marks, -from).finish(nodeType, to - from), from)
    return true
  },

  SetextHeading: undefined // Specifies relative precedence for block-continue function
}

const enum RefStage { Failed = -1, Start, Label, Link, Title }

// This implements a state machine that incrementally parses link references. At each
// next line, it looks ahead to see if the line continues the reference or not. If it
// doesn't and a valid link is available ending before that line, it finishes that.
// Similarly, on `finish` (when the leaf is terminated by external circumstances), it
// creates a link reference if there's a valid reference up to the current point.
class LinkReferenceParser implements LeafBlockParser {
  stage = RefStage.Start
  elts: Element[] = []
  pos = 0
  start: number

  constructor(leaf: LeafBlock) {
    this.start = leaf.start
    this.advance(leaf.content)
  }

  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock) {
    if (this.stage == RefStage.Failed) return false
    let content = leaf.content + "\n" + line.scrub()
    let finish = this.advance(content)
    if (finish > -1 && finish < content.length) return this.complete(cx, leaf, finish)
    return false
  }

  finish(cx: BlockContext, leaf: LeafBlock) {
    if ((this.stage == RefStage.Link || this.stage == RefStage.Title) && skipSpace(leaf.content, this.pos) == leaf.content.length)
      return this.complete(cx, leaf, leaf.content.length)
    return false
  }

  complete(cx: BlockContext, leaf: LeafBlock, len: number) {
    cx.addLeafElement(leaf, elt(Type.LinkReference, this.start, this.start + len, this.elts))
    return true
  }

  nextStage(elt: Element | null | false) {
    if (elt) {
      this.pos = elt.to - this.start
      this.elts.push(elt)
      this.stage++
      return true
    }
    if (elt === false) this.stage = RefStage.Failed
    return false
  }

  advance(content: string) {
    for (;;) {
      if (this.stage == RefStage.Failed) {
        return -1
      } else if (this.stage == RefStage.Start) {
        if (!this.nextStage(parseLinkLabel(content, this.pos, this.start, true))) return -1
        if (content.charCodeAt(this.pos) != 58 /* ':' */) return this.stage = RefStage.Failed
        this.elts.push(elt(Type.LinkMark, this.pos + this.start, this.pos + this.start + 1))
        this.pos++
      } else if (this.stage == RefStage.Label) {
        if (!this.nextStage(parseURL(content, skipSpace(content, this.pos), this.start))) return -1
      } else if (this.stage == RefStage.Link) {
        let skip = skipSpace(content, this.pos), end = 0
        if (skip > this.pos) {
          let title = parseLinkTitle(content, skip, this.start)
          if (title) {
            let titleEnd = lineEnd(content, title.to - this.start)
            if (titleEnd > 0) { this.nextStage(title); end = titleEnd }
          }
        }
        if (!end) end = lineEnd(content, this.pos)
        return end > 0 && end < content.length ? end : -1
      } else { // RefStage.Title
        return lineEnd(content, this.pos)
      }
    }
  }
}

function lineEnd(text: string, pos: number) {
  for (; pos < text.length; pos++) {
    let next = text.charCodeAt(pos)
    if (next == 10) break
    if (!space(next)) return -1
  }
  return pos
}

class SetextHeadingParser implements LeafBlockParser {
  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock) {
    let underline = line.depth < cx.stack.length ? -1 : isSetextUnderline(line)
    let next = line.next
    if (underline < 0) return false
    let underlineMark = elt(Type.HeaderMark, cx.lineStart + line.pos, cx.lineStart + underline)
    cx.nextLine()
    cx.addLeafElement(leaf, elt(next == 61 ? Type.SetextHeading1 : Type.SetextHeading2, leaf.start, cx.prevLineEnd(), [
      ...cx.parser.parseInline(leaf.content, leaf.start),
      underlineMark
    ]))
    return true
  }

  finish() {
    return false
  }
}

const DefaultLeafBlocks: {[name: string]: (cx: BlockContext, leaf: LeafBlock) => LeafBlockParser | null} = {
  LinkReference(_, leaf) { return leaf.content.charCodeAt(0) == 91 /* '[' */ ? new LinkReferenceParser(leaf) : null },
  SetextHeading() { return new SetextHeadingParser }
}

const DefaultEndLeaf: readonly ((cx: BlockContext, line: Line) => boolean)[] = [
  (_, line) => isAtxHeading(line) >= 0,
  (_, line) => isFencedCode(line) >= 0,
  (_, line) => isBlockquote(line) >= 0,
  (p, line) => isBulletList(line, p, true) >= 0,
  (p, line) => isOrderedList(line, p, true) >= 0,
  (p, line) => isHorizontalRule(line, p, true) >= 0,
  (p, line) => isHTMLBlock(line, p, true) >= 0
]

const scanLineResult = {text: "", end: 0}

/// Block-level parsing functions get access to this context object.
export class BlockContext implements PartialParse {
  /// @internal
  block: CompositeBlock
  /// @internal
  stack: CompositeBlock[]
  private line = new Line()
  private atEnd = false
  private fragments: FragmentCursor | null
  private to: number
  /// For reused nodes on gaps, we can't directly put the original
  /// node into the tree, since that may be bigger than its parent.
  /// When this happens, we create a dummy tree that is replaced by
  /// the proper node in `injectGaps` @internal
  reusePlaceholders: Map<Tree, Tree> = new Map
  stoppedAt: number | null = null

  /// The start of the current line.
  lineStart: number
  /// The absolute (non-gap-adjusted) position of the line @internal
  absoluteLineStart: number
  /// The range index that absoluteLineStart points into @internal
  rangeI = 0
  /// @internal
  absoluteLineEnd: number

  /// @internal
  constructor(
    /// The parser configuration used.
    readonly parser: MarkdownParser,
    /// @internal
    readonly input: Input,
    fragments: readonly TreeFragment[],
    /// @internal
    readonly ranges: readonly {from: number, to: number}[],
  ) {
    this.to = ranges[ranges.length - 1].to
    this.lineStart = this.absoluteLineStart = this.absoluteLineEnd = ranges[0].from
    this.block = CompositeBlock.create(Type.Document, 0, this.lineStart, 0, 0)
    this.stack = [this.block]
    this.fragments = fragments.length ? new FragmentCursor(fragments, input) : null
    this.readLine()
  }

  get parsedPos() {
    return this.absoluteLineStart
  }

  advance() {
    if (this.stoppedAt != null && this.absoluteLineStart > this.stoppedAt)
      return this.finish()

    let {line} = this
    for (;;) {
      for (let markI = 0;;) {
        let next = line.depth < this.stack.length ? this.stack[this.stack.length - 1] : null
        while (markI < line.markers.length && (!next || line.markers[markI].from < next.end)) {
          let mark = line.markers[markI++]
          this.addNode(mark.type, mark.from, mark.to)
        }
        if (!next) break
        this.finishContext()
      }
      if (line.pos < line.text.length) break
      // Empty line
      if (!this.nextLine()) return this.finish()
    }

    if (this.fragments && this.reuseFragment(line.basePos)) return null

    start: for (;;) {
      for (let type of this.parser.blockParsers) if (type) {
        let result = type(this, line)
        if (result != false) {
          if (result == true) return null
          line.forward()
          continue start
        }
      }
      break
    }
      
    let leaf = new LeafBlock(this.lineStart + line.pos, line.text.slice(line.pos))
    for (let parse of this.parser.leafBlockParsers) if (parse) {
      let parser = parse!(this, leaf)
      if (parser) leaf.parsers.push(parser!)
    }
    lines: while (this.nextLine()) {
      if (line.pos == line.text.length) break
      if (line.indent < line.baseIndent + 4) {
        for (let stop of this.parser.endLeafBlock) if (stop(this, line, leaf)) break lines
      }
      for (let parser of leaf.parsers) if (parser.nextLine(this, line, leaf)) return null
      leaf.content += "\n" + line.scrub()
      for (let m of line.markers) leaf.marks.push(m)
    }
    this.finishLeaf(leaf)
    return null
  }

  stopAt(pos: number) {
    if (this.stoppedAt != null && this.stoppedAt < pos) throw new RangeError("Can't move stoppedAt forward")
    this.stoppedAt = pos
  }

  private reuseFragment(start: number) {
    if (!this.fragments!.moveTo(this.absoluteLineStart + start, this.absoluteLineStart) ||
        !this.fragments!.matches(this.block.hash)) return false
    let taken = this.fragments!.takeNodes(this)
    if (!taken) return false
    this.absoluteLineStart += taken
    this.lineStart = toRelative(this.absoluteLineStart, this.ranges)
    this.moveRangeI()
    if (this.absoluteLineStart < this.to) {
      this.lineStart++
      this.absoluteLineStart++
      this.readLine()
    } else {
      this.atEnd = true
      this.readLine()
    }
    return true
  }

  /// The number of parent blocks surrounding the current block.
  get depth() {
    return this.stack.length
  }

  /// Get the type of the parent block at the given depth. When no
  /// depth is passed, return the type of the innermost parent.
  parentType(depth = this.depth - 1) {
    return this.parser.nodeSet.types[this.stack[depth].type]
  }

  /// Move to the next input line. This should only be called by
  /// (non-composite) [block parsers](#BlockParser.parse) that consume
  /// the line directly, or leaf block parser
  /// [`nextLine`](#LeafBlockParser.nextLine) methods when they
  /// consume the current line (and return true).
  nextLine() {
    this.lineStart += this.line.text.length
    if (this.absoluteLineEnd >= this.to) {
      this.absoluteLineStart = this.absoluteLineEnd
      this.atEnd = true
      this.readLine()
      return false
    } else {
      this.lineStart++
      this.absoluteLineStart = this.absoluteLineEnd + 1
      this.moveRangeI()
      this.readLine()
      return true
    }
  }

  /// Retrieve the text of the line after the current one, without
  /// actually moving the context's current line forward.
  peekLine() {
    return this.scanLine(this.absoluteLineEnd + 1).text
  }

  private moveRangeI() {
    while (this.rangeI < this.ranges.length - 1 && this.absoluteLineStart >= this.ranges[this.rangeI].to) {
      this.rangeI++
      this.absoluteLineStart = Math.max(this.absoluteLineStart, this.ranges[this.rangeI].from)
    }
  }

  /// @internal
  /// Collect the text for the next line.
  scanLine(start: number) {
    let r = scanLineResult
    r.end = start
    if (start >= this.to) {
      r.text = ""
    } else {
      r.text = this.lineChunkAt(start)
      r.end += r.text.length
      if (this.ranges.length > 1) {
        let textOffset = this.absoluteLineStart, rangeI = this.rangeI
        while (this.ranges[rangeI].to < r.end) {
          rangeI++
          let nextFrom = this.ranges[rangeI].from
          let after = this.lineChunkAt(nextFrom)
          r.end = nextFrom + after.length
          r.text = r.text.slice(0, this.ranges[rangeI - 1].to - textOffset) + after
          textOffset = r.end - r.text.length
        }
      }
    }
    return r
  }

  /// @internal
  /// Populate this.line with the content of the next line. Skip
  /// leading characters covered by composite blocks.
  readLine() {
    let {line} = this, {text, end} = this.scanLine(this.absoluteLineStart)
    this.absoluteLineEnd = end
    line.reset(text)
    for (; line.depth < this.stack.length; line.depth++) {
      let cx = this.stack[line.depth], handler = this.parser.skipContextMarkup[cx.type]
      if (!handler) throw new Error("Unhandled block context " + Type[cx.type])
      if (!handler(cx, this, line)) break
      line.forward()
    }
  }

  private lineChunkAt(pos: number) {
    let next = this.input.chunk(pos), text
    if (!this.input.lineChunks) {
      let eol = next.indexOf("\n")
      text = eol < 0 ? next : next.slice(0, eol)
    } else {
      text = next == "\n" ? "" : next
    }
    return pos + text.length > this.to ? text.slice(0, this.to - pos) : text
  }

  /// The end position of the previous line.
  prevLineEnd() { return this.atEnd ? this.lineStart : this.lineStart - 1 }

  /// @internal
  startContext(type: Type, start: number, value = 0) {
    this.block = CompositeBlock.create(type, value, this.lineStart + start, this.block.hash, this.lineStart + this.line.text.length)
    this.stack.push(this.block)
  }

  /// Start a composite block. Should only be called from [block
  /// parser functions](#BlockParser.parse) that return null.
  startComposite(type: string, start: number, value = 0) {
    this.startContext(this.parser.getNodeType(type), start, value)
  }

  /// @internal
  addNode(block: Type | Tree, from: number, to?: number) {
    if (typeof block == "number") block = new Tree(this.parser.nodeSet.types[block], none, none, (to ?? this.prevLineEnd()) - from)
    this.block.addChild(block, from - this.block.from)
  }

  /// Add a block element. Can be called by [block
  /// parsers](#BlockParser.parse).
  addElement(elt: Element) {
    this.block.addChild(elt.toTree(this.parser.nodeSet), elt.from - this.block.from)
  }

  /// Add a block element from a [leaf parser](#LeafBlockParser). This
  /// makes sure any extra composite block markup (such as blockquote
  /// markers) inside the block are also added to the syntax tree.
  addLeafElement(leaf: LeafBlock, elt: Element) {
    this.addNode(this.buffer
      .writeElements(injectMarks(elt.children, leaf.marks), -elt.from)
      .finish(elt.type, elt.to - elt.from), elt.from)
  }

  /// @internal
  finishContext() {
    let cx = this.stack.pop()!
    let top = this.stack[this.stack.length - 1]
    top.addChild(cx.toTree(this.parser.nodeSet), cx.from - top.from)
    this.block = top
  }

  private finish() {
    while (this.stack.length > 1) this.finishContext()
    return this.addGaps(this.block.toTree(this.parser.nodeSet, this.lineStart))
  }

  private addGaps(tree: Tree) {
    return this.ranges.length > 1 ?
      injectGaps(this.ranges, 0, tree.topNode, this.ranges[0].from, this.reusePlaceholders) : tree
  }

  /// @internal
  finishLeaf(leaf: LeafBlock) {
    for (let parser of leaf.parsers) if (parser.finish(this, leaf)) return
    let inline = injectMarks(this.parser.parseInline(leaf.content, leaf.start), leaf.marks)
    this.addNode(this.buffer
      .writeElements(inline, -leaf.start)
      .finish(Type.Paragraph, leaf.content.length), leaf.start)
  }

  /// Create an [`Element`](#Element) object to represent some syntax
  /// node.
  elt(type: string, from: number, to: number, children?: readonly Element[]): Element
  elt(tree: Tree, at: number): Element
  elt(type: string | Tree, from: number, to?: number, children?: readonly Element[]): Element {
    if (typeof type == "string") return elt(this.parser.getNodeType(type), from, to!, children)
    return new TreeElement(type, from)
  }

  /// @internal
  get buffer() { return new Buffer(this.parser.nodeSet) }
}

function injectGaps(
  ranges: readonly {from: number, to: number}[], rangeI: number,
  tree: SyntaxNode, offset: number, dummies: Map<Tree, Tree>
): Tree {
  let rangeEnd = ranges[rangeI].to
  let children = [], positions = [], start = tree.from + offset
  function movePastNext(upto: number, inclusive: boolean) {
    while (inclusive ? upto >= rangeEnd : upto > rangeEnd) {
      let size = ranges[rangeI + 1].from - rangeEnd
      offset += size
      upto += size
      rangeI++
      rangeEnd = ranges[rangeI].to
    }
  }
  for (let ch = tree.firstChild; ch; ch = ch.nextSibling) {
    movePastNext(ch.from + offset, true)
    let from = ch.from + offset, node, reuse = dummies.get(ch.tree!)
    if (reuse) {
      node = reuse
    } else if (ch.to + offset > rangeEnd) {
      node = injectGaps(ranges, rangeI, ch, offset, dummies)
      movePastNext(ch.to + offset, false)
    } else {
      node = ch.toTree()
    }
    children.push(node)
    positions.push(from - start)
  }
  movePastNext(tree.to + offset, false)
  return new Tree(tree.type, children, positions, tree.to + offset - start, tree.tree ? tree.tree.propValues : undefined)
}

/// Used in the [configuration](#MarkdownConfig.defineNodes) to define
/// new [syntax node
/// types](https://lezer.codemirror.net/docs/ref/#common.NodeType).
export interface NodeSpec {
  /// The node's name.
  name: string,
  /// Should be set to true if this type represents a block node.
  block?: boolean,
  /// If this is a composite block, this should hold a function that,
  /// at the start of a new line where that block is active, checks
  /// whether the composite block should continue (return value) and
  /// optionally [adjusts](#Line.moveBase) the line's base position
  /// and [registers](#Line.addMarker) nodes for any markers involved
  /// in the block's syntax.
  composite?(cx: BlockContext, line: Line, value: number): boolean,
  /// Add highlighting tag information for this node. The value of
  /// this property may either by a tag or array of tags to assign
  /// directly to this node, or an object in the style of
  /// [`styleTags`](https://lezer.codemirror.net/docs/ref/#highlight.styleTags)'s
  /// argument to assign more complicated rules.
  style?: Tag | readonly Tag[] | {[selector: string]: Tag | readonly Tag[]},
}

/// Inline parsers are called for every character of parts of the
/// document that are parsed as inline content.
export interface InlineParser {
  /// This parser's name, which can be used by other parsers to
  /// [indicate](#InlineParser.before) a relative precedence.
  name: string,
  /// The parse function. Gets the next character and its position as
  /// arguments. Should return -1 if it doesn't handle the character,
  /// or add some [element](#InlineContext.addElement) or
  /// [delimiter](#InlineContext.addDelimiter) and return the end
  /// position of the content it parsed if it can.
  parse(cx: InlineContext, next: number, pos: number): number,
  /// When given, this parser will be installed directly before the
  /// parser with the given name. The default configuration defines
  /// inline parsers with names Escape, Entity, InlineCode, HTMLTag,
  /// Emphasis, HardBreak, Link, and Image. When no `before` or
  /// `after` property is given, the parser is added to the end of the
  /// list.
  before?: string,
  /// When given, the parser will be installed directly _after_ the
  /// parser with the given name.
  after?: string
}  

/// Block parsers handle block-level structure. There are three
/// general types of block parsers:
///
/// - Composite block parsers, which handle things like lists and
///   blockquotes. These define a [`parse`](#BlockParser.parse) method
///   that [starts](#BlockContext.startComposite) a composite block
///   and returns null when it recognizes its syntax.
///
/// - Eager leaf block parsers, used for things like code or HTML
///   blocks. These can unambiguously recognize their content from its
///   first line. They define a [`parse`](#BlockParser.parse) method
///   that, if it recognizes the construct,
///   [moves](#BlockContext.nextLine) the current line forward to the
///   line beyond the end of the block,
///   [add](#BlockContext.addElement) a syntax node for the block, and
///   return true.
///
/// - Leaf block parsers that observe a paragraph-like construct as it
///   comes in, and optionally decide to handle it at some point. This
///   is used for "setext" (underlined) headings and link references.
///   These define a [`leaf`](#BlockParser.leaf) method that checks
///   the first line of the block and returns a
///   [`LeafBlockParser`](#LeafBlockParser) object if it wants to
///   observe that block.
export interface BlockParser {
  /// The name of the parser. Can be used by other block parsers to
  /// [specify](#BlockParser.before) precedence.
  name: string,
  /// The eager parse function, which can look at the block's first
  /// line and return `false` to do nothing, `true` if it has parsed
  /// (and [moved past](#BlockContext.nextLine) a block), or `null` if
  /// it has started a composite block.
  parse?(cx: BlockContext, line: Line): BlockResult
  /// A leaf parse function. If no [regular](#BlockParser.parse) parse
  /// functions match for a given line, its content will be
  /// accumulated for a paragraph-style block. This method can return
  /// an [object](#LeafBlockParser) that overrides that style of
  /// parsing in some situations.
  leaf?(cx: BlockContext, leaf: LeafBlock): LeafBlockParser | null
  /// Some constructs, such as code blocks or newly started
  /// blockquotes, can interrupt paragraphs even without a blank line.
  /// If your construct can do this, provide a predicate here that
  /// recognizes lines that should end a paragraph (or other non-eager
  /// [leaf block](#BlockParser.leaf)).
  endLeaf?(cx: BlockContext, line: Line, leaf: LeafBlock): boolean
  /// When given, this parser will be installed directly before the
  /// block parser with the given name. The default configuration
  /// defines block parsers with names LinkReference, IndentedCode,
  /// FencedCode, Blockquote, HorizontalRule, BulletList, OrderedList,
  /// ATXHeading, HTMLBlock, and SetextHeading.
  before?: string,
  /// When given, the parser will be installed directly _after_ the
  /// parser with the given name.
  after?: string,
}

/// Objects that are used to [override](#BlockParser.leaf)
/// paragraph-style blocks should conform to this interface.
export interface LeafBlockParser {
  /// Update the parser's state for the next line, and optionally
  /// finish the block. This is not called for the first line (the
  /// object is constructed at that line), but for any further lines.
  /// When it returns `true`, the block is finished. It is okay for
  /// the function to [consume](#BlockContext.nextLine) the current
  /// line or any subsequent lines when returning true.
  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock): boolean
  /// Called when the block is finished by external circumstances
  /// (such as a blank line or the [start](#BlockParser.endLeaf) of
  /// another construct). If this parser can handle the block up to
  /// its current position, it should
  /// [finish](#BlockContext.addLeafElement) the block and return
  /// true.
  finish(cx: BlockContext, leaf: LeafBlock): boolean
}

/// Objects of this type are used to
/// [configure](#MarkdownParser.configure) the Markdown parser.
export interface MarkdownConfig {
  /// Node props to add to the parser's node set.
  props?: readonly NodePropSource[],
  /// Define new [node types](#NodeSpec) for use in parser extensions.
  defineNodes?: readonly (string | NodeSpec)[],
  /// Define additional [block parsing](#BlockParser) logic.
  parseBlock?: readonly BlockParser[],
  /// Define new [inline parsing](#InlineParser) logic.
  parseInline?: readonly InlineParser[],
  /// Remove the named parsers from the configuration.
  remove?: readonly string[]
  /// Add a parse wrapper (such as a [mixed-language
  /// parser](#common.parseMixed)) to this parser.
  wrap?: ParseWrapper
}

/// To make it possible to group extensions together into bigger
/// extensions (such as the [Github-flavored Markdown](#GFM)
/// extension), [reconfiguration](#MarkdownParser.configure) accepts
/// nested arrays of [config](#MarkdownConfig) objects.
export type MarkdownExtension = MarkdownConfig | readonly MarkdownExtension[]

/// A Markdown parser configuration.
export class MarkdownParser extends Parser {
  /// @internal
  nodeTypes: {[name: string]: number} = Object.create(null)

  /// @internal
  constructor(
    /// The parser's syntax [node
    /// types](https://lezer.codemirror.net/docs/ref/#common.NodeSet).
    readonly nodeSet: NodeSet,
    /// @internal
    readonly blockParsers: readonly (((cx: BlockContext, line: Line) => BlockResult) | undefined)[],
    /// @internal
    readonly leafBlockParsers: readonly (((cx: BlockContext, leaf: LeafBlock) => LeafBlockParser | null) | undefined)[],
    /// @internal
    readonly blockNames: readonly string[],
    /// @internal
    readonly endLeafBlock: readonly ((cx: BlockContext, line: Line, leaf: LeafBlock) => boolean)[],
    /// @internal
    readonly skipContextMarkup: {readonly [type: number]: (bl: CompositeBlock, cx: BlockContext, line: Line) => boolean},
    /// @internal
    readonly inlineParsers: readonly (((cx: InlineContext, next: number, pos: number) => number) | undefined)[],
    /// @internal
    readonly inlineNames: readonly string[],
    /// @internal
    readonly wrappers: readonly ParseWrapper[]
  ) {
    super()
    for (let t of nodeSet.types) this.nodeTypes[t.name] = t.id
  }

  createParse(input: Input, fragments: readonly TreeFragment[], ranges: readonly {from: number, to: number}[]): PartialParse {
    let parse: PartialParse = new BlockContext(this, input, fragments, ranges)
    for (let w of this.wrappers) parse = w(parse, input, fragments, ranges)
    return parse
  }

  /// Reconfigure the parser.
  configure(spec: MarkdownExtension) {
    let config = resolveConfig(spec)
    if (!config) return this
    let {nodeSet, skipContextMarkup} = this
    let blockParsers = this.blockParsers.slice(), leafBlockParsers = this.leafBlockParsers.slice(),
        blockNames = this.blockNames.slice(), inlineParsers = this.inlineParsers.slice(),
        inlineNames = this.inlineNames.slice(), endLeafBlock = this.endLeafBlock.slice(),
        wrappers = this.wrappers

    if (nonEmpty(config.defineNodes)) {
      skipContextMarkup = Object.assign({}, skipContextMarkup)
      let nodeTypes = nodeSet.types.slice(), styles: {[selector: string]: Tag | readonly Tag[]} | undefined
      for (let s of config.defineNodes) {
        let {name, block, composite, style} = typeof s == "string" ? {name: s} as NodeSpec : s
        if (nodeTypes.some(t => t.name == name)) continue
        if (composite) (skipContextMarkup as any)[nodeTypes.length] =
          (bl: CompositeBlock, cx: BlockContext, line: Line) => composite!(cx, line, bl.value)
        let id = nodeTypes.length
        let group = composite ? ["Block", "BlockContext"] : !block ? undefined
          : id >= Type.ATXHeading1 && id <= Type.SetextHeading2 ? ["Block", "LeafBlock", "Heading"] : ["Block", "LeafBlock"]
        nodeTypes.push(NodeType.define({
          id,
          name,
          props: group && [[NodeProp.group, group]]
        }))
        if (style) {
          if (!styles) styles = {}
          if (Array.isArray(style) || style instanceof Tag) styles[name] = style
          else Object.assign(styles, style)
        }
      }
      nodeSet = new NodeSet(nodeTypes)
      if (styles) nodeSet = nodeSet.extend(styleTags(styles))
    }

    if (nonEmpty(config.props)) nodeSet = nodeSet.extend(...config.props)

    if (nonEmpty(config.remove)) {
      for (let rm of config.remove) {
        let block = this.blockNames.indexOf(rm), inline = this.inlineNames.indexOf(rm)
        if (block > -1) blockParsers[block] = leafBlockParsers[block] = undefined
        if (inline > -1) inlineParsers[inline] = undefined
      }
    }

    if (nonEmpty(config.parseBlock)) {
      for (let spec of config.parseBlock) {
        let found = blockNames.indexOf(spec.name)
        if (found > -1) {
          blockParsers[found] = spec.parse
          leafBlockParsers[found] = spec.leaf
        } else {
          let pos = spec.before ? findName(blockNames, spec.before)
            : spec.after ? findName(blockNames, spec.after) + 1 : blockNames.length - 1
          blockParsers.splice(pos, 0, spec.parse)
          leafBlockParsers.splice(pos, 0, spec.leaf)
          blockNames.splice(pos, 0, spec.name)
        }
        if (spec.endLeaf) endLeafBlock.push(spec.endLeaf)
      }
    }

    if (nonEmpty(config.parseInline)) {
      for (let spec of config.parseInline) {
        let found = inlineNames.indexOf(spec.name)
        if (found > -1) {
          inlineParsers[found] = spec.parse
        } else {
          let pos = spec.before ? findName(inlineNames, spec.before)
            : spec.after ? findName(inlineNames, spec.after) + 1 : inlineNames.length - 1
          inlineParsers.splice(pos, 0, spec.parse)
          inlineNames.splice(pos, 0, spec.name)
        }
      }
    }

    if (config.wrap) wrappers = wrappers.concat(config.wrap)

    return new MarkdownParser(nodeSet,
                              blockParsers, leafBlockParsers, blockNames,
                              endLeafBlock, skipContextMarkup,
                              inlineParsers, inlineNames, wrappers)
  }

  /// @internal
  getNodeType(name: string) {
    let found = this.nodeTypes[name]
    if (found == null) throw new RangeError(`Unknown node type '${name}'`)
    return found
  }

  /// Parse the given piece of inline text at the given offset,
  /// returning an array of [`Element`](#Element) objects representing
  /// the inline content.
  parseInline(text: string, offset: number) {
    let cx = new InlineContext(this, text, offset)
    outer: for (let pos = offset; pos < cx.end;) {
      let next = cx.char(pos)
      for (let token of this.inlineParsers) if (token) {
        let result = token(cx, next, pos)
        if (result >= 0) { pos = result; continue outer }
      }
      pos++
    }
    return cx.resolveMarkers(0)
  }
}

function nonEmpty<T>(a: undefined | readonly T[]): a is readonly T[] {
  return a != null && a.length > 0
}

function resolveConfig(spec: MarkdownExtension): MarkdownConfig | null {
  if (!Array.isArray(spec)) return spec as MarkdownConfig
  if (spec.length == 0) return null
  let conf = resolveConfig(spec[0])
  if (spec.length == 1) return conf
  let rest = resolveConfig(spec.slice(1))
  if (!rest || !conf) return conf || rest
  let conc: <T>(a: readonly T[] | undefined, b: readonly T[] | undefined) => readonly T[] =
    (a, b) => (a || none).concat(b || none)
  let wrapA = conf.wrap, wrapB = rest.wrap
  return {
    props: conc(conf.props, rest.props),
    defineNodes: conc(conf.defineNodes, rest.defineNodes),
    parseBlock: conc(conf.parseBlock, rest.parseBlock),
    parseInline: conc(conf.parseInline, rest.parseInline),
    remove: conc(conf.remove, rest.remove),
    wrap: !wrapA ? wrapB : !wrapB ? wrapA :
      (inner, input, fragments, ranges) => wrapA!(wrapB!(inner, input, fragments, ranges), input, fragments, ranges)
  }
}

function findName(names: readonly string[], name: string) {
  let found = names.indexOf(name)
  if (found < 0) throw new RangeError(`Position specified relative to unknown parser ${name}`)
  return found
}

let nodeTypes = [NodeType.none]
for (let i = 1, name; name = Type[i]; i++) {
  nodeTypes[i] = NodeType.define({
    id: i,
    name,
    props: i >= Type.Escape ? [] : [[NodeProp.group, i in DefaultSkipMarkup ? ["Block", "BlockContext"] : ["Block", "LeafBlock"]]],
    top: name == "Document"
  })
}

const none: readonly any[] = []

class Buffer {
  content: number[] = []
  nodes: Tree[] = []
  constructor(readonly nodeSet: NodeSet) {}

  write(type: Type, from: number, to: number, children = 0) {
    this.content.push(type, from, to, 4 + children * 4)
    return this
  }

  writeElements(elts: readonly (Element | TreeElement)[], offset = 0) {
    for (let e of elts) e.writeTo(this, offset)
    return this
  }

  finish(type: Type, length: number) {
    return Tree.build({
      buffer: this.content,
      nodeSet: this.nodeSet,
      reused: this.nodes,
      topID: type,
      length
    })
  }
}  

/// Elements are used to compose syntax nodes during parsing.
export class Element {
  /// @internal
  constructor(
    /// The node's
    /// [id](https://lezer.codemirror.net/docs/ref/#common.NodeType.id).
    readonly type: number,
    /// The start of the node, as an offset from the start of the document.
    readonly from: number,
    /// The end of the node.
    readonly to: number,
    /// The node's child nodes @internal
    readonly children: readonly (Element | TreeElement)[] = none
  ) {}

  /// @internal
  writeTo(buf: Buffer, offset: number) {
    let startOff = buf.content.length
    buf.writeElements(this.children, offset)
    buf.content.push(this.type, this.from + offset, this.to + offset, buf.content.length + 4 - startOff)
  }

  /// @internal
  toTree(nodeSet: NodeSet): Tree {
    return new Buffer(nodeSet).writeElements(this.children, -this.from).finish(this.type, this.to - this.from)
  }
}

class TreeElement {
  constructor(readonly tree: Tree, readonly from: number) {}

  get to() { return this.from + this.tree.length }

  get type() { return this.tree.type.id }

  get children() { return none }

  writeTo(buf: Buffer, offset: number) {
    buf.nodes.push(this.tree)
    buf.content.push(buf.nodes.length - 1, this.from + offset, this.to + offset, -1)
  }

  toTree(): Tree { return this.tree }
}

function elt(type: Type, from: number, to: number, children?: readonly (Element | TreeElement)[]) {
  return new Element(type, from, to, children)
}

const enum Mark { None = 0, Open = 1, Close = 2 }

/// Delimiters are used during inline parsing to store the positions
/// of things that _might_ be delimiters, if another matching
/// delimiter is found. They are identified by objects with these
/// properties.
export interface DelimiterType {
  /// If this is given, the delimiter should be matched automatically
  /// when a piece of inline content is finished. Such delimiters will
  /// be matched with delimiters of the same type according to their
  /// [open and close](#InlineContext.addDelimiter) properties. When a
  /// match is found, the content between the delimiters is wrapped in
  /// a node whose name is given by the value of this property.
  ///
  /// When this isn't given, you need to match the delimiter eagerly
  /// using the [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter)
  /// and [`takeContent`](#InlineContext.takeContent) methods.
  resolve?: string,
  /// If the delimiter itself should, when matched, create a syntax
  /// node, set this to the name of the syntax node.
  mark?: string
}

const EmphasisUnderscore: DelimiterType = {resolve: "Emphasis", mark: "EmphasisMark"}
const EmphasisAsterisk: DelimiterType = {resolve: "Emphasis", mark: "EmphasisMark"}
const LinkStart: DelimiterType = {}, ImageStart: DelimiterType = {}

class InlineDelimiter {
  constructor(readonly type: DelimiterType,
              readonly from: number,
              readonly to: number,
              public side: Mark) {}
}

const Escapable = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"

export let Punctuation = /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~\xA1\u2010-\u2027]/
try { Punctuation = new RegExp("[\\p{S}|\\p{P}]", "u") } catch (_) {}

const DefaultInline: {[name: string]: (cx: InlineContext, next: number, pos: number) => number} = {
  Escape(cx, next, start) {
    if (next != 92 /* '\\' */ || start == cx.end - 1) return -1
    let escaped = cx.char(start + 1)
    for (let i = 0; i < Escapable.length; i++) if (Escapable.charCodeAt(i) == escaped)
      return cx.append(elt(Type.Escape, start, start + 2))
    return -1
  },

  Entity(cx, next, start) {
    if (next != 38 /* '&' */) return -1
    let m = /^(?:#\d+|#x[a-f\d]+|\w+);/i.exec(cx.slice(start + 1, start + 31))
    return m ? cx.append(elt(Type.Entity, start, start + 1 + m[0].length)) : -1
  },

  InlineCode(cx, next, start) {
    if (next != 96 /* '`' */ || start && cx.char(start - 1) == 96) return -1
    let pos = start + 1
    while (pos < cx.end && cx.char(pos) == 96) pos++
    let size = pos - start, curSize = 0
    for (; pos < cx.end; pos++) {
      if (cx.char(pos) == 96) {
        curSize++
        if (curSize == size && cx.char(pos + 1) != 96)
          return cx.append(elt(Type.InlineCode, start, pos + 1, [
            elt(Type.CodeMark, start, start + size),
            elt(Type.CodeMark, pos + 1 - size, pos + 1)
          ]))
      } else {
        curSize = 0
      }
    }
    return -1
  },

  HTMLTag(cx, next, start) { // or URL
    if (next != 60 /* '<' */ || start == cx.end - 1) return -1
    let after = cx.slice(start + 1, cx.end)
    let url = /^(?:[a-z][-\w+.]+:[^\s>]+|[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*)>/i.exec(after)
    if (url) {
      return cx.append(elt(Type.Autolink, start, start + 1 + url[0].length, [
        elt(Type.LinkMark, start, start + 1),
        // url[0] includes the closing bracket, so exclude it from this slice
        elt(Type.URL, start + 1, start + url[0].length),
        elt(Type.LinkMark, start + url[0].length, start + 1 + url[0].length)
      ]))
    }
    let comment = /^!--[^>](?:-[^-]|[^-])*?-->/i.exec(after)
    if (comment) return cx.append(elt(Type.Comment, start, start + 1 + comment[0].length))
    let procInst = /^\?[^]*?\?>/.exec(after)
    if (procInst) return cx.append(elt(Type.ProcessingInstruction, start, start + 1 + procInst[0].length))
    let m = /^(?:![A-Z][^]*?>|!\[CDATA\[[^]*?\]\]>|\/\s*[a-zA-Z][\w-]*\s*>|\s*[a-zA-Z][\w-]*(\s+[a-zA-Z:_][\w-.:]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*(\/\s*)?>)/.exec(after)
    if (!m) return -1
    return cx.append(elt(Type.HTMLTag, start, start + 1 + m[0].length))
  },

  Emphasis(cx, next, start) {
    if (next != 95 && next != 42) return -1
    let pos = start + 1
    while (cx.char(pos) == next) pos++
    let before = cx.slice(start - 1, start), after = cx.slice(pos, pos + 1)
    let pBefore = Punctuation.test(before), pAfter = Punctuation.test(after)
    let sBefore = /\s|^$/.test(before), sAfter = /\s|^$/.test(after)
    let leftFlanking = !sAfter && (!pAfter || sBefore || pBefore)
    let rightFlanking = !sBefore && (!pBefore || sAfter || pAfter)
    let canOpen = leftFlanking && (next == 42 || !rightFlanking || pBefore)
    let canClose = rightFlanking && (next == 42 || !leftFlanking || pAfter)
    return cx.append(new InlineDelimiter(next == 95 ? EmphasisUnderscore : EmphasisAsterisk, start, pos,
                                         (canOpen ? Mark.Open : Mark.None) | (canClose ? Mark.Close : Mark.None)))
  },

  HardBreak(cx, next, start) {
    if (next == 92 /* '\\' */ && cx.char(start + 1) == 10 /* '\n' */)
      return cx.append(elt(Type.HardBreak, start, start + 2))
    if (next == 32) {
      let pos = start + 1
      while (cx.char(pos) == 32) pos++
      if (cx.char(pos) == 10 && pos >= start + 2)
        return cx.append(elt(Type.HardBreak, start, pos + 1))
    }
    return -1
  },

  Link(cx, next, start) {
    return next == 91 /* '[' */ ? cx.append(new InlineDelimiter(LinkStart, start, start + 1, Mark.Open)) : -1
  },

  Image(cx, next, start) {
    return next == 33 /* '!' */ && cx.char(start + 1) == 91 /* '[' */
      ? cx.append(new InlineDelimiter(ImageStart, start, start + 2, Mark.Open)) : -1
  },

  LinkEnd(cx, next, start) {
    if (next != 93 /* ']' */) return -1
    // Scanning back to the next link/image start marker
    for (let i = cx.parts.length - 1; i >= 0; i--) {
      let part = cx.parts[i]
      if (part instanceof InlineDelimiter && (part.type == LinkStart || part.type == ImageStart)) {
        // If this one has been set invalid (because it would produce
        // a nested link) or there's no valid link here ignore both.
        if (!part.side || cx.skipSpace(part.to) == start && !/[(\[]/.test(cx.slice(start + 1, start + 2))) {
          cx.parts[i] = null
          return -1
        }
        // Finish the content and replace the entire range in
        // this.parts with the link/image node.
        let content = cx.takeContent(i)
        let link = cx.parts[i] = finishLink(cx, content, part.type == LinkStart ? Type.Link : Type.Image, part.from, start + 1)
        // Set any open-link markers before this link to invalid.
        if (part.type == LinkStart) for (let j = 0; j < i; j++) {
          let p = cx.parts[j]
          if (p instanceof InlineDelimiter && p.type == LinkStart) p.side = Mark.None
        }
        return link.to
      }
    }
    return -1
  }
}

function finishLink(cx: InlineContext, content: Element[], type: Type, start: number, startPos: number) {
  let {text} = cx, next = cx.char(startPos), endPos = startPos
  content.unshift(elt(Type.LinkMark, start, start + (type == Type.Image ? 2 : 1)))
  content.push(elt(Type.LinkMark, startPos - 1, startPos))
  if (next == 40 /* '(' */) {
    let pos = cx.skipSpace(startPos + 1)
    let dest = parseURL(text, pos - cx.offset, cx.offset), title
    if (dest) {
      pos = cx.skipSpace(dest.to)
      // The destination and title must be separated by whitespace
      if (pos != dest.to) {
        title = parseLinkTitle(text, pos - cx.offset, cx.offset)
        if (title) pos = cx.skipSpace(title.to)
      }
    }
    if (cx.char(pos) == 41 /* ')' */) {
      content.push(elt(Type.LinkMark, startPos, startPos + 1))
      endPos = pos + 1
      if (dest) content.push(dest)
      if (title) content.push(title)
      content.push(elt(Type.LinkMark, pos, endPos))
    }
  } else if (next == 91 /* '[' */) {
    let label = parseLinkLabel(text, startPos - cx.offset, cx.offset, false)
    if (label) {
      content.push(label)
      endPos = label.to
    }
  }
  return elt(type, start, endPos, content)
}

// These return `null` when falling off the end of the input, `false`
// when parsing fails otherwise (for use in the incremental link
// reference parser).

function parseURL(text: string, start: number, offset: number): null | false | Element {
  let next = text.charCodeAt(start)
  if (next == 60 /* '<' */) {
    for (let pos = start + 1; pos < text.length; pos++) {
      let ch = text.charCodeAt(pos)
      if (ch == 62 /* '>' */) return elt(Type.URL, start + offset, pos + 1 + offset)
      if (ch == 60 || ch == 10 /* '<\n' */) return false
    }
    return null
  } else {
    let depth = 0, pos = start
    for (let escaped = false; pos < text.length; pos++) {
      let ch = text.charCodeAt(pos)
      if (space(ch)) {
        break
      } else if (escaped) {
        escaped = false
      } else if (ch == 40 /* '(' */) {
        depth++
      } else if (ch == 41 /* ')' */) {
        if (!depth) break
        depth--
      } else if (ch == 92 /* '\\' */) {
        escaped = true
      }
    }
    return pos > start ? elt(Type.URL, start + offset, pos + offset) : pos == text.length ? null : false
  }
}

function parseLinkTitle(text: string, start: number, offset: number): null | false | Element {
  let next = text.charCodeAt(start)
  if (next != 39 && next != 34 && next != 40 /* '"\'(' */) return false
  let end = next == 40 ? 41 : next
  for (let pos = start + 1, escaped = false; pos < text.length; pos++) {
    let ch = text.charCodeAt(pos)
    if (escaped) escaped = false
    else if (ch == end) return elt(Type.LinkTitle, start + offset, pos + 1 + offset)
    else if (ch == 92 /* '\\' */) escaped = true
  }
  return null
}

function parseLinkLabel(text: string, start: number, offset: number, requireNonWS: boolean): null | false | Element {
  for (let escaped = false, pos = start + 1, end = Math.min(text.length, pos + 999); pos < end; pos++) {
    let ch = text.charCodeAt(pos)
    if (escaped) escaped = false
    else if (ch == 93 /* ']' */) return requireNonWS ? false : elt(Type.LinkLabel, start + offset, pos + 1 + offset)
    else {
      if (requireNonWS && !space(ch)) requireNonWS = false
      if (ch == 91 /* '[' */) return false
      else if (ch == 92 /* '\\' */) escaped = true
    }
  }
  return null
}

/// Inline parsing functions get access to this context, and use it to
/// read the content and emit syntax nodes.
export class InlineContext {
  /// @internal
  parts: (Element | InlineDelimiter | null)[] = []

  /// @internal
  constructor(
    /// The parser that is being used.
    readonly parser: MarkdownParser,
    /// The text of this inline section.
    readonly text: string,
    /// The starting offset of the section in the document.
    readonly offset: number
  ) {}

  /// Get the character code at the given (document-relative)
  /// position.
  char(pos: number) { return pos >= this.end ? -1 : this.text.charCodeAt(pos - this.offset) }

  /// The position of the end of this inline section.
  get end() { return this.offset + this.text.length }

  /// Get a substring of this inline section. Again uses
  /// document-relative positions.
  slice(from: number, to: number) { return this.text.slice(from - this.offset, to - this.offset) }

  /// @internal
  append(elt: Element | InlineDelimiter) {
    this.parts.push(elt)
    return elt.to
  }

  /// Add a [delimiter](#DelimiterType) at this given position. `open`
  /// and `close` indicate whether this delimiter is opening, closing,
  /// or both. Returns the end of the delimiter, for convenient
  /// returning from [parse functions](#InlineParser.parse).
  addDelimiter(type: DelimiterType, from: number, to: number, open: boolean, close: boolean) {
    return this.append(new InlineDelimiter(type, from, to, (open ? Mark.Open : Mark.None) | (close ? Mark.Close : Mark.None)))
  }

  /// Returns true when there is an unmatched link or image opening
  /// token before the current position.
  get hasOpenLink() {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      let part = this.parts[i]
      if (part instanceof InlineDelimiter && (part.type == LinkStart || part.type == ImageStart)) return true
    }
    return false
  }

  /// Add an inline element. Returns the end of the element.
  addElement(elt: Element) {
    return this.append(elt)
  }

  /// Resolve markers between this.parts.length and from, wrapping matched markers in the
  /// appropriate node and updating the content of this.parts. @internal
  resolveMarkers(from: number) {
    // Scan forward, looking for closing tokens
    for (let i = from; i < this.parts.length; i++) {
      let close = this.parts[i]
      if (!(close instanceof InlineDelimiter && close.type.resolve && (close.side & Mark.Close))) continue

      let emp = close.type == EmphasisUnderscore || close.type == EmphasisAsterisk
      let closeSize = close.to - close.from
      let open: InlineDelimiter | undefined, j = i - 1
      // Continue scanning for a matching opening token
      for (; j >= from; j--) {
        let part = this.parts[j]
        if (part instanceof InlineDelimiter && (part.side & Mark.Open) && part.type == close.type &&
            // Ignore emphasis delimiters where the character count doesn't match
            !(emp && ((close.side & Mark.Open) || (part.side & Mark.Close)) &&
              (part.to - part.from + closeSize) % 3 == 0 && ((part.to - part.from) % 3 || closeSize % 3))) {
          open = part
          break
        }
      }
      if (!open) continue

      let type = close.type.resolve, content = []
      let start = open.from, end = close.to
      // Emphasis marker effect depends on the character count. Size consumed is minimum of the two
      // markers.
      if (emp) {
        let size = Math.min(2, open.to - open.from, closeSize)
        start = open.to - size
        end = close.from + size
        type = size == 1 ? "Emphasis" : "StrongEmphasis"
      }
      // Move the covered region into content, optionally adding marker nodes
      if (open.type.mark) content.push(this.elt(open.type.mark, start, open.to))
      for (let k = j + 1; k < i; k++) {
        if (this.parts[k] instanceof Element) content.push(this.parts[k] as Element)
        this.parts[k] = null
      }
      if (close.type.mark) content.push(this.elt(close.type.mark, close.from, end))
      let element = this.elt(type, start, end, content)
      // If there are leftover emphasis marker characters, shrink the close/open markers. Otherwise, clear them.
      this.parts[j] = emp && open.from != start ? new InlineDelimiter(open.type, open.from, start, open.side) : null
      let keep = this.parts[i] = emp && close.to != end ? new InlineDelimiter(close.type, end, close.to, close.side) : null
      // Insert the new element in this.parts
      if (keep) this.parts.splice(i, 0, element)
      else this.parts[i] = element
    }

    // Collect the elements remaining in this.parts into an array.
    let result = []
    for (let i = from; i < this.parts.length; i++) {
      let part = this.parts[i]
      if (part instanceof Element) result.push(part)
    }
    return result
  }

  /// Find an opening delimiter of the given type. Returns `null` if
  /// no delimiter is found, or an index that can be passed to
  /// [`takeContent`](#InlineContext.takeContent) otherwise.
  findOpeningDelimiter(type: DelimiterType) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      let part = this.parts[i]
      if (part instanceof InlineDelimiter && part.type == type && (part.side & Mark.Open)) return i
    }
    return null
  }

  /// Remove all inline elements and delimiters starting from the
  /// given index (which you should get from
  /// [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter),
  /// resolve delimiters inside of them, and return them as an array
  /// of elements.
  takeContent(startIndex: number) {
    let content = this.resolveMarkers(startIndex)
    this.parts.length = startIndex
    return content
  }

  /// Return the delimiter at the given index. Mostly useful to get
  /// additional info out of a delimiter index returned by
  /// [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter).
  /// Returns null if there is no delimiter at this index.
  getDelimiterAt(index: number): {from: number, to: number, type: DelimiterType} | null {
    let part = this.parts[index]
    return part instanceof InlineDelimiter ? part : null
  }

  /// Skip space after the given (document) position, returning either
  /// the position of the next non-space character or the end of the
  /// section.
  skipSpace(from: number) { return skipSpace(this.text, from - this.offset) + this.offset }

  /// Create an [`Element`](#Element) for a syntax node.
  elt(type: string, from: number, to: number, children?: readonly Element[]): Element
  elt(tree: Tree, at: number): Element
  elt(type: string | Tree, from: number, to?: number, children?: readonly Element[]): Element {
    if (typeof type == "string") return elt(this.parser.getNodeType(type), from, to!, children)
    return new TreeElement(type, from)
  }
}

function injectMarks(elements: readonly (Element | TreeElement)[], marks: Element[]) {
  if (!marks.length) return elements
  if (!elements.length) return marks
  let elts = elements.slice(), eI = 0
  for (let mark of marks) {
    while (eI < elts.length && elts[eI].to < mark.to) eI++
    if (eI < elts.length && elts[eI].from < mark.from) {
      let e = elts[eI]
      if (e instanceof Element)
        elts[eI] = new Element(e.type, e.from, e.to, injectMarks(e.children, [mark]))
    } else {
      elts.splice(eI++, 0, mark)
    }
  }
  return elts
}

// These are blocks that can span blank lines, and should thus only be
// reused if their next sibling is also being reused.
const NotLast = [Type.CodeBlock, Type.ListItem, Type.OrderedList, Type.BulletList]

class FragmentCursor {
  // Index into fragment array
  i = 0
  // Active fragment
  fragment: TreeFragment | null = null
  fragmentEnd = -1
  // Cursor into the current fragment, if any. When `moveTo` returns
  // true, this points at the first block after `pos`.
  cursor: TreeCursor | null = null

  constructor(readonly fragments: readonly TreeFragment[], readonly input: Input) {
    if (fragments.length) this.fragment = fragments[this.i++]
  }

  nextFragment() {
    this.fragment = this.i < this.fragments.length ? this.fragments[this.i++] : null
    this.cursor = null
    this.fragmentEnd = -1
  }

  moveTo(pos: number, lineStart: number) {
    while (this.fragment && this.fragment.to <= pos) this.nextFragment()
    if (!this.fragment || this.fragment.from > (pos ? pos - 1 : 0)) return false
    if (this.fragmentEnd < 0) {
      let end = this.fragment.to
      while (end > 0 && this.input.read(end - 1, end) != "\n") end--
      this.fragmentEnd = end ? end - 1 : 0
    }

    let c = this.cursor
    if (!c) {
      c = this.cursor = this.fragment.tree.cursor()
      c.firstChild()
    }

    let rPos = pos + this.fragment.offset
    while (c.to <= rPos) if (!c.parent()) return false
    for (;;) {
      if (c.from >= rPos) return this.fragment.from <= lineStart
      if (!c.childAfter(rPos)) return false
    }
  }

  matches(hash: number) {
    let tree = this.cursor!.tree
    return tree && tree.prop(NodeProp.contextHash) == hash
  }

  takeNodes(cx: BlockContext) {
    let cur = this.cursor!, off = this.fragment!.offset, fragEnd = this.fragmentEnd - (this.fragment!.openEnd ? 1 : 0)
    let start = cx.absoluteLineStart, end = start, blockI = cx.block.children.length
    let prevEnd = end, prevI = blockI
    for (;;) {
      if (cur.to - off > fragEnd) {
        if (cur.type.isAnonymous && cur.firstChild()) continue
        break
      }
      let pos = toRelative(cur.from - off, cx.ranges)
      if (cur.to - off <= cx.ranges[cx.rangeI].to) { // Fits in current range
        cx.addNode(cur.tree!, pos)
      } else {
        let dummy = new Tree(cx.parser.nodeSet.types[Type.Paragraph], [], [], 0, cx.block.hashProp)
        cx.reusePlaceholders.set(dummy, cur.tree!)
        cx.addNode(dummy, pos)
      }
      // Taken content must always end in a block, because incremental
      // parsing happens on block boundaries. Never stop directly
      // after an indented code block, since those can continue after
      // any number of blank lines.
      if (cur.type.is("Block")) {
        if (NotLast.indexOf(cur.type.id) < 0) {
          end = cur.to - off
          blockI = cx.block.children.length
        } else {
          end = prevEnd
          blockI = prevI
          prevEnd = cur.to - off
          prevI = cx.block.children.length
        }
      }
      if (!cur.nextSibling()) break
    }
    while (cx.block.children.length > blockI) {
      cx.block.children.pop()
      cx.block.positions.pop()
    }
    return end - start
  }
}

// Convert an input-stream-relative position to a
// Markdown-doc-relative position by subtracting the size of all input
// gaps before `abs`.
function toRelative(abs: number, ranges: readonly {from: number, to: number}[]) {
  let pos = abs
  for (let i = 1; i < ranges.length; i++) {
    let gapFrom = ranges[i - 1].to, gapTo = ranges[i].from
    if (gapFrom < abs) pos -= gapTo - gapFrom
  }
  return pos
}

const markdownHighlighting = styleTags({
  "Blockquote/...": t.quote,
  HorizontalRule: t.contentSeparator,
  "ATXHeading1/... SetextHeading1/...": t.heading1,
  "ATXHeading2/... SetextHeading2/...": t.heading2,
  "ATXHeading3/...": t.heading3,
  "ATXHeading4/...": t.heading4,
  "ATXHeading5/...": t.heading5,
  "ATXHeading6/...": t.heading6,
  "Comment CommentBlock": t.comment,
  Escape: t.escape,
  Entity: t.character,
  "Emphasis/...": t.emphasis,
  "StrongEmphasis/...": t.strong,
  "Link/... Image/...": t.link,
  "OrderedList/... BulletList/...": t.list,
  "BlockQuote/...": t.quote,
  "InlineCode CodeText": t.monospace,
  "URL Autolink": t.url,
  "HeaderMark HardBreak QuoteMark ListMark LinkMark EmphasisMark CodeMark": t.processingInstruction,
  "CodeInfo LinkLabel": t.labelName,
  LinkTitle: t.string,
  Paragraph: t.content
})

/// The default CommonMark parser.
export const parser = new MarkdownParser(
  new NodeSet(nodeTypes).extend(markdownHighlighting),
  Object.keys(DefaultBlockParsers).map(n => DefaultBlockParsers[n]),
  Object.keys(DefaultBlockParsers).map(n => DefaultLeafBlocks[n]),
  Object.keys(DefaultBlockParsers),
  DefaultEndLeaf,
  DefaultSkipMarkup,
  Object.keys(DefaultInline).map(n => DefaultInline[n]),
  Object.keys(DefaultInline),
  []
)
