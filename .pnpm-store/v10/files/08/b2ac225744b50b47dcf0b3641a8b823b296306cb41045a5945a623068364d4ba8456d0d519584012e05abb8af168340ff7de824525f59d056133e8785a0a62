import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {
  DirectiveEnd, DocEnd, blockEnd, eof,
  sequenceStartMark, sequenceContinueMark,
  explicitMapStartMark, explicitMapContinueMark,
  mapStartMark, mapContinueMark, flowMapMark,
  Literal, QuotedLiteral, Anchor, Alias, Tag,
  BlockLiteralHeader, BlockLiteralContent,
  BracketL, BraceL, Colon, FlowSequence, FlowMapping
} from "./parser.terms.js"

const
  type_Top = 0, // Top document level
  type_Seq = 1, // Block sequence
  type_Map = 2, // Block mapping
  type_Flow = 3, // Inside flow content
  type_Lit = 4 // Block literal with explicit indentation

class Context {
  constructor(parent, depth, type) {
    this.parent = parent
    this.depth = depth
    this.type = type
    this.hash = (parent ? parent.hash + parent.hash << 8 : 0) + depth + (depth << 4) + type
  }
}

Context.top = new Context(null, -1, type_Top)

function findColumn(input, pos) {
  for (let col = 0, p = pos - input.pos - 1;; p--, col++) {
    let ch = input.peek(p)
    if (isBreakSpace(ch) || ch == -1) return col
  }
}

function isNonBreakSpace(ch) {
  return ch == 32 || ch == 9
}

function isBreakSpace(ch) {
  return ch == 10 || ch == 13
}

function isSpace(ch) {
  return isNonBreakSpace(ch) || isBreakSpace(ch)
}

function isSep(ch) {
  return ch < 0 || isSpace(ch)
}

export const indentation = new ContextTracker({
  start: Context.top,
  reduce(context, term) {
    return context.type == type_Flow && (term == FlowSequence || term == FlowMapping) ? context.parent : context
  },
  shift(context, term, stack, input) {
    if (term == sequenceStartMark)
      return new Context(context, findColumn(input, input.pos), type_Seq)
    if (term == mapStartMark || term == explicitMapStartMark)
      return new Context(context, findColumn(input, input.pos), type_Map)
    if (term == blockEnd)
      return context.parent
    if (term == BracketL || term == BraceL)
      return new Context(context, 0, type_Flow)
    if (term == BlockLiteralContent && context.type == type_Lit)
      return context.parent
    if (term == BlockLiteralHeader) {
      let indent = /[1-9]/.exec(input.read(input.pos, stack.pos))
      if (indent) return new Context(context, context.depth + (+indent[0]), type_Lit)
    }
    return context
  },
  hash(context) { return context.hash }
})

function three(input, ch, off = 0) {
  return input.peek(off) == ch && input.peek(off + 1) == ch && input.peek(off + 2) == ch && isSep(input.peek(off + 3))
}

export const newlines = new ExternalTokenizer((input, stack) => {
  if (input.next == -1 && stack.canShift(eof))
    return input.acceptToken(eof)
  let prev = input.peek(-1)
  if ((isBreakSpace(prev) || prev < 0) && stack.context.type != type_Flow) {
    if (three(input, 45 /* '-' */)) {
      if (stack.canShift(blockEnd)) input.acceptToken(blockEnd)
      else return input.acceptToken(DirectiveEnd, 3)
    }
    if (three(input, 46 /* '.' */)) {
      if (stack.canShift(blockEnd)) input.acceptToken(blockEnd)
      else return input.acceptToken(DocEnd, 3)
    }
    let depth = 0
    while (input.next == 32 /* ' ' */) { depth++; input.advance() }
    if ((depth < stack.context.depth ||
         depth == stack.context.depth && stack.context.type == type_Seq &&
         (input.next != 45 /* '-' */ || !isSep(input.peek(1)))) &&
        // Not blank
        input.next != -1 && !isBreakSpace(input.next) && input.next != 35 /* '#' */)
      input.acceptToken(blockEnd, -depth)
  }
}, {contextual: true})

export const blockMark = new ExternalTokenizer((input, stack) => {
  if (stack.context.type == type_Flow) {
    if (input.next == 63 /* '?' */) {
      input.advance()
      if (isSep(input.next)) input.acceptToken(flowMapMark)
    }
    return
  }
  if (input.next == 45 /* '-' */) {
    input.advance()
    if (isSep(input.next))
      input.acceptToken(stack.context.type == type_Seq && stack.context.depth == findColumn(input, input.pos - 1)
                        ? sequenceContinueMark : sequenceStartMark)
  } else if (input.next == 63 /* '?' */) {
    input.advance()
    if (isSep(input.next))
      input.acceptToken(stack.context.type == type_Map && stack.context.depth == findColumn(input, input.pos - 1)
                        ? explicitMapContinueMark : explicitMapStartMark)
  } else {
    let start = input.pos
    // Scan over a potential key to see if it is followed by a colon.
    for (;;) {
      if (isNonBreakSpace(input.next)) {
        if (input.pos == start) return
        input.advance()
      } else if (input.next == 33 /* '!' */) {
        readTag(input)
      } else if (input.next == 38 /* '&' */) {
        readAnchor(input)
      } else if (input.next == 42 /* '*' */) {
        readAnchor(input)
        break
      } else if (input.next == 39 /* "'" */ || input.next == 34 /* '"' */) {
        if (readQuoted(input, true)) break
        return
      } else if (input.next == 91 /* '[' */ || input.next == 123 /* '{' */) {
        if (!scanBrackets(input)) return
        break
      } else {
        readPlain(input, true, false, 0)
        break
      }
    }
    while (isNonBreakSpace(input.next)) input.advance()
    if (input.next == 58 /* ':' */) {
      if (input.pos == start && stack.canShift(Colon)) return
      let after = input.peek(1)
      if (isSep(after))
        input.acceptTokenTo(stack.context.type == type_Map && stack.context.depth == findColumn(input, start)
                            ? mapContinueMark : mapStartMark, start)
    }
  }
}, {contextual: true})

function uriChar(ch) {
  return ch > 32 && ch < 127 && ch != 34 && ch != 37 && ch != 44 && ch != 60 &&
    ch != 62 && ch != 92 && ch != 94 && ch != 96 && ch != 123 && ch != 124 && ch != 125
}

function hexChar(ch) {
  return ch >= 48 && ch <= 57 || ch >= 97 && ch <= 102 || ch >= 65 && ch <= 70
}

function readUriChar(input, quoted) {
  if (input.next == 37 /* '%' */) {
    input.advance()
    if (hexChar(input.next)) input.advance()
    if (hexChar(input.next)) input.advance()
    return true
  } else if (uriChar(input.next) || quoted && input.next == 44 /* ',' */) {
    input.advance()
    return true
  }
  return false
}

function readTag(input) {
  input.advance() // !
  if (input.next == 60 /* '<' */) {
    input.advance()
    for (;;) {
      if (!readUriChar(input, true)) {
        if (input.next == 62 /* '>' */) input.advance()
        break
      }
    }
  } else {
    while (readUriChar(input, false)) {}
  }
}

function readAnchor(input) {
  input.advance()
  while (!isSep(input.next) && charTag(input.tag) != "f") input.advance()
}
  
function readQuoted(input, scan) {
  let quote = input.next, lineBreak = false, start = input.pos
  input.advance()
  for (;;) {
    let ch = input.next
    if (ch < 0) break
    input.advance()
    if (ch == quote) {
      if (ch == 39 /* "'" */) {
        if (input.next == 39) input.advance()
        else break
      } else {
        break
      }
    } else if (ch == 92 /* "\\" */ && quote == 34 /* '"' */) {
      if (input.next >= 0) input.advance()
    } else if (isBreakSpace(ch)) {
      if (scan) return false
      lineBreak = true
    } else if (scan && input.pos >= start + 1024) {
      return false
    }
  }
  return !lineBreak
}

function scanBrackets(input) {
  for (let stack = [], end = input.pos + 1024;;) {
    if (input.next == 91 /* '[' */ || input.next == 123 /* '{' */) {
      stack.push(input.next)
      input.advance()
    } else if (input.next == 39 /* "'" */ || input.next == 34 /* '"' */) {
      if (!readQuoted(input, true)) return false
    } else if (input.next == 93 /* ']' */ || input.next == 125 /* '}' */) {
      if (stack[stack.length - 1] != input.next - 2) return false
      stack.pop()
      input.advance()
      if (!stack.length) return true
    } else if (input.next < 0 || input.pos > end || isBreakSpace(input.next)) {
      return false
    } else {
      input.advance()
    }
  }
}

// "Safe char" info for char codes 33 to 125. s: safe, i: indicator, f: flow indicator
const charTable = "iiisiiissisfissssssssssssisssiiissssssssssssssssssssssssssfsfssissssssssssssssssssssssssssfif"

function charTag(ch) {
  if (ch < 33) return "u"
  if (ch > 125) return "s"
  return charTable[ch - 33]
}

function isSafe(ch, inFlow) {
  let tag = charTag(ch)
  return tag != "u" && !(inFlow && tag == "f")
}

function readPlain(input, scan, inFlow, indent) {
  if (charTag(input.next) == "s" ||
      (input.next == 63 /* '?' */ || input.next == 58 /* ':' */ || input.next == 45 /* '-' */) &&
      isSafe(input.peek(1), inFlow)) {
    input.advance()
  } else {
    return false
  }
  let start = input.pos
  for (;;) {
    let next = input.next, off = 0, lineIndent = indent + 1
    while (isSpace(next)) {
      if (isBreakSpace(next)) {
        if (scan) return false
        lineIndent = 0
      } else {
        lineIndent++
      }
      next = input.peek(++off)
    }
    let safe = next >= 0 &&
        (next == 58 /* ':' */ ? isSafe(input.peek(off + 1), inFlow) :
         next == 35 /* '#' */ ? input.peek(off - 1) != 32 /* ' ' */ :
         isSafe(next, inFlow))
    if (!safe || !inFlow && lineIndent <= indent ||
        lineIndent == 0 && !inFlow && (three(input, 45, off) || three(input, 46, off)))
      break
    if (scan && charTag(next) == "f") return false
    for (let i = off; i >= 0; i--) input.advance()
    if (scan && input.pos > start + 1024) return false
  }
  return true
}

export const literals = new ExternalTokenizer((input, stack) => {
  if (input.next == 33 /* '!' */) {
    readTag(input)
    input.acceptToken(Tag)
  } else if (input.next == 38 /* '&' */ || input.next == 42 /* '*' */) {
    let token = input.next == 38 ? Anchor : Alias
    readAnchor(input)
    input.acceptToken(token)
  } else if (input.next == 39 /* "'" */ || input.next == 34 /* '"' */) {
    readQuoted(input, false)
    input.acceptToken(QuotedLiteral)
  } else if (readPlain(input, false, stack.context.type == type_Flow, stack.context.depth)) {
    input.acceptToken(Literal)
  }
})

export const blockLiteral = new ExternalTokenizer((input, stack) => {
  let indent = stack.context.type == type_Lit ? stack.context.depth : -1, upto = input.pos
  scan: for (;;) {
    let depth = 0, next = input.next
    while (next == 32 /* ' ' */) next = input.peek(++depth)
    if (!depth && (three(input, 45, depth) || three(input, 46, depth))) break
    if (!isBreakSpace(next)) {
      if (indent < 0) indent = Math.max(stack.context.depth + 1, depth)
      if (depth < indent) break
    }
    for (;;) {
      if (input.next < 0) break scan
      let isBreak = isBreakSpace(input.next)
      input.advance()
      if (isBreak) continue scan
      upto = input.pos
    }
  }
  input.acceptTokenTo(BlockLiteralContent, upto)
})
