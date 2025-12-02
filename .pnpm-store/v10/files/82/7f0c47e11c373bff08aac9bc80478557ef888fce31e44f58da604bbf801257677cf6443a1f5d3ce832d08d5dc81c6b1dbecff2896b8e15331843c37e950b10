import {styleTags, tags as t} from "@lezer/highlight"

export const xmlHighlighting = styleTags({
  Text: t.content,
  "StartTag StartCloseTag EndTag SelfCloseEndTag": t.angleBracket,
  TagName: t.tagName,
  "MismatchedCloseTag/TagName": [t.tagName, t.invalid],
  AttributeName: t.attributeName,
  AttributeValue: t.attributeValue,
  Is: t.definitionOperator,
  "EntityReference CharacterReference": t.character,
  Comment: t.blockComment,
  ProcessingInst: t.processingInstruction,
  DoctypeDecl: t.documentMeta,
  Cdata: t.special(t.string)
})
