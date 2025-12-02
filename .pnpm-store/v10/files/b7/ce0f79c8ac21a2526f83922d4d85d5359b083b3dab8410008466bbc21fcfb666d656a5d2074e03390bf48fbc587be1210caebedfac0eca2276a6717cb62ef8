import {ExternalTokenizer} from "@lezer/lr"
import {
  abstract, and, array, as, Boolean, _break, _case, _catch, clone, _const, _continue,
  declare, _default, _do, echo, _else, elseif, enddeclare, endfor, endforeach, endif,
  endswitch, endwhile, _enum, _extends, final, _finally, fn, _for, foreach, from,
  _function, global, goto, _if, _implements, include, include_once, _instanceof,
  insteadof, _interface, list, match, namespace, _new, _null, or, print, readonly, _require, require_once,
  _return, _switch, _throw, trait, _try, unset, use, _var, Visibility,
  _while, xor, _yield,

  castOpen, eof, automaticSemicolon, HeredocString,
  interpolatedStringContent, EscapeSequence, afterInterpolation
} from "./parser.terms.js"

const keywordMap = {
  abstract,
  and,
  array,
  as,
  true: Boolean,
  false: Boolean,
  break: _break,
  case: _case,
  catch: _catch,
  clone,
  const: _const,
  continue: _continue,
  declare,
  default: _default,
  do: _do,
  echo,
  else: _else,
  elseif,
  enddeclare,
  endfor,
  endforeach,
  endif,
  endswitch,
  endwhile,
  enum: _enum,
  extends: _extends,
  final,
  finally: _finally,
  fn,
  for: _for,
  foreach,
  from,
  function: _function,
  global,
  goto,
  if: _if,
  implements: _implements,
  include,
  include_once,
  instanceof: _instanceof,
  insteadof,
  interface: _interface,
  list,
  match,
  namespace,
  new: _new,
  null: _null,
  or,
  print,
  readonly,
  require: _require,
  require_once,
  return: _return,
  switch: _switch,
  throw: _throw,
  trait,
  try: _try,
  unset,
  use,
  var: _var,
  public: Visibility,
  private: Visibility,
  protected: Visibility,
  while: _while,
  xor,
  yield: _yield,
  __proto__: null,
}

export function keywords(name) {
  let found = keywordMap[name.toLowerCase()]
  return found == null ? -1 : found
}

function isSpace(ch) {
  return ch == 9 || ch == 10 || ch == 13 || ch == 32
}

function isASCIILetter(ch) {
  return ch >= 97 && ch <= 122 || ch >= 65 && ch <= 90
}

function isIdentifierStart(ch) {
  return ch == 95 || ch >= 0x80 || isASCIILetter(ch)
}

function isHex(ch) {
  return ch >= 48 && ch <= 55 || ch >= 97 && ch <= 102 || ch >= 65 && ch <= 70 /* 0-9, a-f, A-F */
}

const castTypes = {
  int: true, integer: true, bool: true, boolean: true,
  float: true, double: true, real: true, string: true,
  array: true, object: true, unset: true,
  __proto__: null
}

export const expression = new ExternalTokenizer(input => {
  if (input.next == 40 /* '(' */) {
    input.advance()
    let peek = 0
    while (isSpace(input.peek(peek))) peek++
    let name = "", next
    while (isASCIILetter(next = input.peek(peek))) {
      name += String.fromCharCode(next)
      peek++
    }
    while (isSpace(input.peek(peek))) peek++
    if (input.peek(peek) == 41 /* ')' */ && castTypes[name.toLowerCase()])
      input.acceptToken(castOpen)
  } else if (input.next == 60 /* '<' */ && input.peek(1) == 60 && input.peek(2) == 60) {
    for (let i = 0; i < 3; i++) input.advance();
    while (input.next == 32 /* ' ' */ || input.next == 9 /* '\t' */) input.advance()
    let quoted = input.next == 39 /* "'" */
    if (quoted) input.advance()
    if (!isIdentifierStart(input.next)) return
    let tag = String.fromCharCode(input.next)
    for (;;) {
      input.advance()
      if (!isIdentifierStart(input.next) && !(input.next >= 48 && input.next <= 55) /* 0-9 */) break
      tag += String.fromCharCode(input.next)
    }
    if (quoted) {
      if (input.next != 39) return
      input.advance()
    }
    if (input.next != 10 /* '\n' */ && input.next != 13 /* '\r' */) return
    for (;;) {
      let lineStart = input.next == 10 || input.next == 13
      input.advance()
      if (input.next < 0) return
      if (lineStart) {
        while (input.next == 32 /* ' ' */ || input.next == 9 /* '\t' */) input.advance()
        let match = true
        for (let i = 0; i < tag.length; i++) {
          if (input.next != tag.charCodeAt(i)) { match = false; break }
          input.advance()
        }
        if (match) return input.acceptToken(HeredocString)
      }
    }
  }
})

export const eofToken = new ExternalTokenizer(input => {
  if (input.next < 0) input.acceptToken(eof)
})

export const semicolon = new ExternalTokenizer((input, stack) => {
  if (input.next == 63 /* '?' */ && stack.canShift(automaticSemicolon) && input.peek(1) == 62 /* '>' */)
    input.acceptToken(automaticSemicolon)
})

function scanEscape(input) {
  let after = input.peek(1)
  if (after == 110 /* 'n' */ || after == 114 /* 'r' */ || after == 116 /* 't' */ ||
      after == 118 /* 'v' */ || after == 101 /* 'e' */ || after == 102 /* 'f' */ ||
      after == 92 /* '\\' */ || after == 36 /* '"' */ || after == 34 /* '$' */ ||
      after == 123 /* '{' */)
    return 2

  if (after >= 48 && after <= 55 /* '0'-'7' */) {
    let size = 2, next
    while (size < 5 && (next = input.peek(size)) >= 48 && next <= 55) size++
    return size
  }

  if (after == 120 /* 'x' */ && isHex(input.peek(2))) {
    return isHex(input.peek(3)) ? 4 : 3
  }

  if (after == 117 /* 'u' */ && input.peek(2) == 123 /* '{' */) {
    for (let size = 3;; size++) {
      let next = input.peek(size)
      if (next == 125 /* '}' */) return size == 2 ? 0 : size + 1
      if (!isHex(next)) break
    }
  }

  return 0
}

export const interpolated = new ExternalTokenizer((input, stack) => {
  let content = false
  for (;; content = true) {
    if (input.next == 34 /* '"' */ || input.next < 0 ||
        input.next == 36 /* '$' */ && (isIdentifierStart(input.peek(1)) || input.peek(1) == 123 /* '{' */) ||
        input.next == 123 /* '{' */ && input.peek(1) == 36 /* '$' */) {
      break
    } else if (input.next == 92 /* '\\' */) {
      let escaped = scanEscape(input)
      if (escaped) {
        if (content) break
        else return input.acceptToken(EscapeSequence, escaped)
      }
    } else if (!content && (
      input.next == 91 /* '[' */ ||
      input.next == 45 /* '-' */ && input.peek(1) == 62 /* '>' */ && isIdentifierStart(input.peek(2)) ||
      input.next == 63 /* '?' */ && input.peek(1) == 45 && input.peek(2) == 62 && isIdentifierStart(input.peek(3))
    ) && stack.canShift(afterInterpolation)) {
      break
    }
    input.advance()
  }
  if (content) input.acceptToken(interpolatedStringContent)
})
