import {styleTags, tags as t} from "@lezer/highlight"

export const yamlHighlighting = styleTags({
  DirectiveName: t.keyword,
  DirectiveContent: t.attributeValue,
  "DirectiveEnd DocEnd": t.meta,
  QuotedLiteral: t.string,
  BlockLiteralHeader: t.special(t.string),
  BlockLiteralContent: t.content,
  Literal: t.content,
  "Key/Literal Key/QuotedLiteral": t.definition(t.propertyName),
  "Anchor Alias": t.labelName,
  Tag: t.typeName,
  Comment: t.lineComment,
  ": , -": t.separator,
  "?": t.punctuation,
  "[ ]": t.squareBracket,
  "{ }": t.brace
})
