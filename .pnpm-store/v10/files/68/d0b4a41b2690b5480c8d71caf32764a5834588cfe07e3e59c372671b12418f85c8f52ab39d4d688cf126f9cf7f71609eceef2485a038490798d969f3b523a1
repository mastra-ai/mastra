// https://util.unicode.org/UnicodeJsps/list-unicodeset.jsp?a=%5Cp%7Bpunctuation%7D

// punctuation to keep at start of word
const prePunctuation = {
  '#': true, //#hastag
  '@': true, //@atmention
  '_': true,//underscore
  '°': true,
  // '+': true,//+4
  // '\\-',//-4  (escape)
  // '.',//.4
  // zero-width chars
  '\u200B': true,
  '\u200C': true,
  '\u200D': true,
  '\uFEFF': true
}

// punctuation to keep at end of word
const postPunctuation = {
  '%': true,//88%
  '_': true,//underscore
  '°': true,//degrees, italian ordinal
  // '\'',// sometimes
  // zero-width chars
  '\u200B': true,
  '\u200C': true,
  '\u200D': true,
  '\uFEFF': true
}

const emoticons = {
  '<3': true,
  '</3': true,
  '<\\3': true,
  ':^P': true,
  ':^p': true,
  ':^O': true,
  ':^3': true,
}

export { prePunctuation, postPunctuation, emoticons }