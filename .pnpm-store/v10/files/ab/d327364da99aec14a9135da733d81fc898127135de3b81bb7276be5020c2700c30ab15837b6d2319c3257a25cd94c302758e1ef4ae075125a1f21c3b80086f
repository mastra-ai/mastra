import {simpleMode} from "./simple-mode.js"

export const factor = simpleMode({
    start: [
      // comments
      {regex: /#?!.*/, token: "comment"},
      // strings """, multiline --> state
      {regex: /"""/, token: "string", next: "string3"},
      {regex: /(STRING:)(\s)/, token: ["keyword", null], next: "string2"},
      {regex: /\S*?"/, token: "string", next: "string"},
      // numbers: dec, hex, unicode, bin, fractional, complex
      {regex: /(?:0x[\d,a-f]+)|(?:0o[0-7]+)|(?:0b[0,1]+)|(?:\-?\d+.?\d*)(?=\s)/, token: "number"},
      //{regex: /[+-]?/} //fractional
      // definition: defining word, defined word, etc
      {regex: /((?:GENERIC)|\:?\:)(\s+)(\S+)(\s+)(\()/, token: ["keyword", null, "def", null, "bracket"], next: "stack"},
      // method definition: defining word, type, defined word, etc
      {regex: /(M\:)(\s+)(\S+)(\s+)(\S+)/, token: ["keyword", null, "def", null, "tag"]},
      // vocabulary using --> state
      {regex: /USING\:/, token: "keyword", next: "vocabulary"},
      // vocabulary definition/use
      {regex: /(USE\:|IN\:)(\s+)(\S+)(?=\s|$)/, token: ["keyword", null, "tag"]},
      // definition: a defining word, defined word
      {regex: /(\S+\:)(\s+)(\S+)(?=\s|$)/, token: ["keyword", null, "def"]},
      // "keywords", incl. ; t f . [ ] { } defining words
      {regex: /(?:;|\\|t|f|if|loop|while|until|do|PRIVATE>|<PRIVATE|\.|\S*\[|\]|\S*\{|\})(?=\s|$)/, token: "keyword"},
      // <constructors> and the like
      {regex: /\S+[\)>\.\*\?]+(?=\s|$)/, token: "builtin"},
      {regex: /[\)><]+\S+(?=\s|$)/, token: "builtin"},
      // operators
      {regex: /(?:[\+\-\=\/\*<>])(?=\s|$)/, token: "keyword"},
      // any id (?)
      {regex: /\S+/, token: "variable"},
      {regex: /\s+|./, token: null}
    ],
    vocabulary: [
      {regex: /;/, token: "keyword", next: "start"},
      {regex: /\S+/, token: "tag"},
      {regex: /\s+|./, token: null}
    ],
    string: [
      {regex: /(?:[^\\]|\\.)*?"/, token: "string", next: "start"},
      {regex: /.*/, token: "string"}
    ],
    string2: [
      {regex: /^;/, token: "keyword", next: "start"},
      {regex: /.*/, token: "string"}
    ],
    string3: [
      {regex: /(?:[^\\]|\\.)*?"""/, token: "string", next: "start"},
      {regex: /.*/, token: "string"}
    ],
    stack: [
      {regex: /\)/, token: "bracket", next: "start"},
      {regex: /--/, token: "bracket"},
      {regex: /\S+/, token: "meta"},
      {regex: /\s+|./, token: null}
    ],
    languageData: {
      name: "factor",
      dontIndentStates: ["start", "vocabulary", "string", "string3", "stack"],
      commentTokens: {line: "!"}
    }
  });
