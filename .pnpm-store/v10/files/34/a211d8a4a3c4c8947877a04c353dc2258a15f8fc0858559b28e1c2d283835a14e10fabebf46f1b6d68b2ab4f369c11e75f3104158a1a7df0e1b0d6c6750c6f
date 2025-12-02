import {ExternalTokenizer} from "@lezer/lr"
import {Float, RawString, closureParamDelim, tpOpen, tpClose} from "./parser.terms"

const _b = 98, _e = 101, _f = 102, _r = 114, _E = 69, Zero = 48,
      Dot = 46, Plus = 43, Minus = 45, Hash = 35, Quote = 34, Pipe = 124, LessThan = 60, GreaterThan = 62

function isNum(ch) { return ch >= 48 && ch <= 57 }
function isNum_(ch) { return isNum(ch) || ch == 95 }

export const literalTokens = new ExternalTokenizer((input, stack) => {
  if (isNum(input.next)) {
    let isFloat = false
    do { input.advance() } while (isNum_(input.next))
    if (input.next == Dot) {
      isFloat = true
      input.advance()
      if (isNum(input.next)) {
        do { input.advance() } while (isNum_(input.next))
      } else if (input.next == Dot || input.next > 0x7f || /\w/.test(String.fromCharCode(input.next))) {
        return
      }
    }
    if (input.next == _e || input.next == _E) {
      isFloat = true
      input.advance()
      if (input.next == Plus || input.next == Minus) input.advance()
      if (!isNum_(input.next)) return
      do { input.advance() } while (isNum_(input.next))
    }
    if (input.next == _f) {
      let after = input.peek(1)
      if (after == Zero + 3 && input.peek(2) == Zero + 2 ||
          after == Zero + 6 && input.peek(2) == Zero + 4) {
        input.advance(3)
        isFloat = true
      } else {
        return
      }
    }
    if (isFloat) input.acceptToken(Float)
  } else if (input.next == _b || input.next == _r) {
    if (input.next == _b) input.advance()
    if (input.next != _r) return
    input.advance()
    let count = 0
    while (input.next == Hash) { count++; input.advance() }
    if (input.next != Quote) return
    input.advance()
    content: for (;;) {
      if (input.next < 0) return
      let isQuote = input.next == Quote
      input.advance()
      if (isQuote) {
        for (let i = 0; i < count; i++) {
          if (input.next != Hash) continue content
          input.advance()
        }
        input.acceptToken(RawString)
        return
      }
    }
  }
})

export const closureParam = new ExternalTokenizer(input => {
  if (input.next == Pipe) input.acceptToken(closureParamDelim, 1)
})

export const tpDelim = new ExternalTokenizer(input => {
  if (input.next == LessThan) input.acceptToken(tpOpen, 1)
  else if (input.next == GreaterThan) input.acceptToken(tpClose, 1)
})
