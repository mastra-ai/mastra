/* Hand-written tokenizers for CSS tokens that can't be
   expressed by Lezer's built-in tokenizer. */

import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {Dialect_indented, callee, identifier, VariableName, queryIdentifier, descendantOp, Unit,
        blankLineStart, newline, whitespace, eof, indent, dedent, LineComment, Comment,
        IndentedMixin, IndentedInclude,
        InterpolationStart, InterpolationEnd, InterpolationContinue} from "./parser.terms.js"

const space = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
               8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288]
const colon = 58, parenL = 40, underscore = 95, bracketL = 91, dash = 45, period = 46,
      hash = 35, percent = 37, braceL = 123, braceR = 125, slash = 47, asterisk = 42,
      newlineChar = 10, equals = 61, plus = 43, and = 38

function isAlpha(ch) { return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch >= 161 }

function isDigit(ch) { return ch >= 48 && ch <= 57 }

function startOfComment(input) {
  let next
  return input.next == slash && ((next = input.peek(1)) == slash || next == asterisk)
}

export const spaces = new ExternalTokenizer((input, stack) => {
  if (stack.dialectEnabled(Dialect_indented)) {
    let prev
    if (input.next < 0 && stack.canShift(eof)) {
      input.acceptToken(eof)
    } else if (((prev = input.peek(-1)) == newlineChar || prev < 0) && stack.canShift(blankLineStart)) {
      let spaces = 0, next
      while (input.next != newlineChar && space.includes(input.next)) { input.advance(); spaces++ }
      if (input.next == newlineChar || startOfComment(input))
        input.acceptToken(blankLineStart, -spaces)
      else if (spaces)
        input.acceptToken(whitespace)
    } else if (input.next == newlineChar) {
      input.acceptToken(newline, 1)
    } else if (space.includes(input.next)) {
      input.advance()
      while (input.next != newlineChar && space.includes(input.next)) input.advance()
      input.acceptToken(whitespace)
    }
  } else {
    let length = 0
    while (space.includes(input.next)) {
      input.advance()
      length++
    }
    if (length) input.acceptToken(whitespace)
  }
}, {contextual: true})

export const comments = new ExternalTokenizer((input, stack) => {
  if (!startOfComment(input)) return
  input.advance()
  if (stack.dialectEnabled(Dialect_indented)) {
    let indentedComment = -1
    for (let off = 1;; off++) {
      let prev = input.peek(-off - 1)
      if (prev == newlineChar || prev < 0) {
        indentedComment = off + 1
        break
      } else if (!space.includes(prev)) {
        break
      }
    }
    if (indentedComment > -1) { // Weird indented-style comment
      let block = input.next == asterisk, end = 0
      input.advance()
      while (input.next >= 0) {
        if (input.next == newlineChar) {
          input.advance()
          let indented = 0
          while (input.next != newlineChar && space.includes(input.next)) {
            indented++
            input.advance()
          }
          if (indented < indentedComment) {
            end = -indented - 1
            break
          }
        } else if (block && input.next == asterisk && input.peek(1) == slash) {
          end = 2
          break
        } else {
          input.advance()
        }
      }
      input.acceptToken(block ? Comment : LineComment, end)
      return
    }
  }
  if (input.next == slash) {
    while (input.next != newlineChar && input.next >= 0) input.advance()
    input.acceptToken(LineComment)
  } else {
    input.advance()
    while (input.next >= 0) {
      let {next} = input
      input.advance()
      if (next == asterisk && input.next == slash) {
        input.advance()
        break
      }
    }
    input.acceptToken(Comment)
  }
})

export const indentedMixins = new ExternalTokenizer((input, stack) => {
  if ((input.next == plus || input.next == equals) && stack.dialectEnabled(Dialect_indented))
    input.acceptToken(input.next == equals ? IndentedMixin : IndentedInclude, 1)
})

export const indentation = new ExternalTokenizer((input, stack) => {
  if (!stack.dialectEnabled(Dialect_indented)) return
  let cDepth = stack.context.depth
  if (input.next < 0 && cDepth) {
    input.acceptToken(dedent)
    return
  }
  let prev = input.peek(-1), depth
  if (prev == newlineChar) {
    let depth = 0
    while (input.next != newlineChar && space.includes(input.next)) {
      input.advance()
      depth++
    }
    if (depth != cDepth &&
        input.next != newlineChar && !startOfComment(input)) {
      if (depth < cDepth) input.acceptToken(dedent, -depth)
      else input.acceptToken(indent)
    }
  }
})

export const identifiers = new ExternalTokenizer((input, stack) => {
  for (let inside = false, dashes = 0, i = 0;; i++) {
    let {next} = input
    if (isAlpha(next) || next == dash || next == underscore || (inside && isDigit(next))) {
      if (!inside && (next != dash || i > 0)) inside = true
      if (dashes === i && next == dash) dashes++
      input.advance()
    } else if (next == hash && input.peek(1) == braceL) {
      input.acceptToken(InterpolationStart, 2)
      break
    } else {
      if (inside) input.acceptToken(
        dashes == 2 && stack.canShift(VariableName) ? VariableName
          : stack.canShift(queryIdentifier) ? queryIdentifier
          : next == parenL ? callee
          : identifier)
      break
    }
  }
})

export const interpolationEnd = new ExternalTokenizer(input => {
  if (input.next == braceR) {
    input.advance()
    while (isAlpha(input.next) || input.next == dash || input.next == underscore || isDigit(input.next))
      input.advance()
    if (input.next == hash && input.peek(1) == braceL)
      input.acceptToken(InterpolationContinue, 2)
    else
      input.acceptToken(InterpolationEnd)
  }
})

export const descendant = new ExternalTokenizer(input => {
  if (space.includes(input.peek(-1))) {
    let {next} = input
    if (isAlpha(next) || next == underscore || next == hash || next == period ||
        next == bracketL || next == colon && isAlpha(input.peek(1)) || next == dash || next == and || next == asterisk)
      input.acceptToken(descendantOp)
  }
})

export const unitToken = new ExternalTokenizer(input => {
  if (!space.includes(input.peek(-1))) {
    let {next} = input
    if (next == percent) { input.advance(); input.acceptToken(Unit) }
    if (isAlpha(next)) {
      do { input.advance() } while (isAlpha(input.next) || isDigit(input.next))
      input.acceptToken(Unit)
    }
  }
})

function IndentLevel(parent, depth) {
  this.parent = parent
  this.depth = depth
  this.hash = (parent ? parent.hash + parent.hash << 8 : 0) + depth + (depth << 4)
}

const topIndent = new IndentLevel(null, 0)

export const trackIndent = new ContextTracker({
  start: topIndent,
  shift(context, term, stack, input) {
    if (term == indent) return new IndentLevel(context, stack.pos - input.pos)
    if (term == dedent) return context.parent
    return context
  },
  hash(context) { return context.hash }
})
