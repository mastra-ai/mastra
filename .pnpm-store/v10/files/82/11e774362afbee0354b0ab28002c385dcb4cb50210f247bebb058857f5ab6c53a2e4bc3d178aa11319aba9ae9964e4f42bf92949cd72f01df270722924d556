import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {insertedSemi, space as spaceToken,
        IncDecOp, identifier, Rune, String, Number,
        _break, _continue, _return, fallthrough,
        closeParen as closeParenToken, closeBracket, closeBrace as closeBraceToken} from "./parser.terms.js"

const newline = 10, carriageReturn = 13, space = 32, tab = 9, slash = 47, closeParen = 41, closeBrace = 125

export const semicolon = new ExternalTokenizer((input, stack) => {
  for (let scan = 0, next = input.next;;) {
    if (stack.context && (next < 0 || next == newline || next == carriageReturn ||
                          next == slash && input.peek(scan + 1) == slash) ||
        next == closeParen || next == closeBrace)
      input.acceptToken(insertedSemi)
    if (next != space && next != tab) break
    next = input.peek(++scan)
  }
}, {contextual: true})

let trackedTokens = new Set([IncDecOp, identifier, Rune, String, Number,
                             _break, _continue, _return, fallthrough,
                             closeParenToken, closeBracket, closeBraceToken])

export const trackTokens = new ContextTracker({
  start: false,
  shift: (context, term) => term == spaceToken ? context : trackedTokens.has(term)
})
