import {ExternalTokenizer} from "@lezer/lr"
import {RawString, templateArgsEndFallback, MacroName} from "./parser.terms.js"

const R = 82, L = 76, u = 117, U = 85,
      a = 97, z = 122, A = 65, Z = 90, Underscore = 95,
      Zero = 48,
      Quote = 34,
      ParenL = 40, ParenR = 41,
      Space = 32, Newline = 10,
      GreaterThan = 62

export const rawString = new ExternalTokenizer(input => {
  // Raw string literals can start with: R, LR, uR, UR, u8R
  if (input.next == L || input.next == U) {
    input.advance()
  } else if (input.next == u) {
    input.advance()
    if (input.next == Zero + 8) input.advance()
  }
  if (input.next != R) return
  input.advance()
  if (input.next != Quote) return
  input.advance()

  let marker = ""
  while (input.next != ParenL) {
    if (input.next == Space || input.next <= 13 || input.next == ParenR) return
    marker += String.fromCharCode(input.next)
    input.advance()
  }
  input.advance()

  for (;;) {
    if (input.next < 0)
      return input.acceptToken(RawString)
    if (input.next == ParenR) {
      let match = true
      for (let i = 0; match && i < marker.length; i++)
        if (input.peek(i + 1) != marker.charCodeAt(i)) match = false
      if (match && input.peek(marker.length + 1) == Quote)
        return input.acceptToken(RawString, 2 + marker.length)
    }
    input.advance()
  }
})

export const fallback = new ExternalTokenizer(input => {
  if (input.next == GreaterThan) {
    // Provide a template-args-closing token when the next characters
    // are ">>", in which case the regular tokenizer will only see a
    // bit shift op.
    if (input.peek(1) == GreaterThan)
      input.acceptToken(templateArgsEndFallback, 1)
  } else {
    // Notice all-uppercase identifiers
    let sawLetter = false, i = 0
    for (;; i++) {
      if (input.next >= A && input.next <= Z) sawLetter = true
      else if (input.next >= a && input.next <= z) return
      else if (input.next != Underscore && !(input.next >= Zero && input.next <= Zero + 9)) break
      input.advance()
    }
    if (sawLetter && i > 1) input.acceptToken(MacroName)
  }
}, {extend: true})
