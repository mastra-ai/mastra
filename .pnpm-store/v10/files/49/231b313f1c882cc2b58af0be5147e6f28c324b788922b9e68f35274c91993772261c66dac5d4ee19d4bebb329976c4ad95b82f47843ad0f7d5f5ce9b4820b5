## 6.5.0 (2025-10-23)

### New features

Add a variant of `insertNewlineContinueMarkup` that supports configuration options.

## 6.4.0 (2025-10-02)

### New features

The new `pasteURLAsLink` extension allows you to paste URLs over a selection to quickly create a link.

## 6.3.4 (2025-08-01)

### Bug fixes

Make sure header-based indentation is available even when Markdown isn't the editor's top-level language.

## 6.3.3 (2025-06-13)

### Bug fixes

Make `insertNewlineContinueMarkup` take effect even when at the end of a nested range of Markdown content.

## 6.3.2 (2025-01-09)

### Bug fixes

Make Markdown-specific commands return false inside fenced code.

Fix an infinite loop caused by `insertNewlineContinueMarkup`.

## 6.3.1 (2024-11-06)

### Bug fixes

Fix an issue where `insertNewlineContinueMarkup` didn't work with the cursor directly after an HTML tag.

## 6.3.0 (2024-09-28)

### New features

The new `htmlTagLanguage` option allows client code to configure which language is used to parse HTML tags in the document.

## 6.2.5 (2024-04-12)

### Bug fixes

Disable folding for list nodes (since it will shadow the folding on the first list item).

## 6.2.4 (2024-01-16)

### Bug fixes

Starting at the third list item, `insertNewlineContinueMarkup` will now keep the tightness of the list, and only require two presses to clear an empty list item.

## 6.2.3 (2023-11-27)

### Bug fixes

Support code folding for GFM tables.

## 6.2.2 (2023-10-06)

### Bug fixes

Fix a bug in `insertNewlineContinueMarkup` that caused it to put the cursor in the wrong place when the editor's line break was more than one character long.

## 6.2.1 (2023-09-14)

### Bug fixes

Make `insertNewlineContinueMarkup` and `deleteMarkupBackward` use tabs for indentation when appropriate.

## 6.2.0 (2023-06-23)

### New features

The markdown package now installs a completion source that completes HTML tags when in Markdown context.

## 6.1.1 (2023-04-13)

### Bug fixes

Fix the declaration of `comentTokens` language data for Markdown.

Fix a bug in `deleteMarkupBackward` that would cause it to delete pieces of continued paragraphs below list item markers.

## 6.1.0 (2023-02-17)

### New features

Add support for folding entire sections from the header.

## 6.0.5 (2022-11-10)

### Bug fixes

Make sure task lists are indented correctly even when deeply nested.

## 6.0.4 (2022-11-02)

### Bug fixes

Fix an issue where nested task lists were indented too deeply.

## 6.0.3 (2022-10-24)

### Bug fixes

Add a `name` value to the Markdown language object.

## 6.0.2 (2022-10-10)

### Bug fixes

Improve `insertNewlineContinueMarkup`'s behavior in a fenced code block.

## 6.0.1 (2022-07-25)

### Bug fixes

Ignore text after whitespace in code block metadata, when determining which language the block is.

## 6.0.0 (2022-06-08)

### Breaking changes

Update dependencies to 6.0.0

## 0.20.1 (2022-05-20)

### New features

The `codeLanguages` option to `markdown` may now be a function from an info string to a language.

## 0.20.0 (2022-04-20)

### New features

`insertNewlineContinueMarkup` can now continue task lists. Move highlighting information into @lezer/markdown

## 0.19.6 (2022-02-04)

### Bug fixes

Fix an issue where `deleteMarkupBackward` could get confused when there was only whitespace between the cursor and the start of the line.

## 0.19.5 (2022-01-28)

### Bug fixes

Make `insertNewlineContinueMarkup` exit blockquotes after two blank lines.

## 0.19.4 (2022-01-03)

### Bug fixes

Fix a bug where list items after a removed item were incorrectly renumbered.

## 0.19.3 (2021-12-10)

### Bug fixes

`insertNewlineContinueMarkup` will no longer exit lists when there is content after the cursor.

Fix an issue in `deleteMarkupBackward` where it only deleted a single space when after a number marker.

## 0.19.2 (2021-10-20)

### Bug fixes

Fix a bug where the monospace highlighting tag wasn't correctly applied to code block content.

## 0.19.1 (2021-08-11)

### Bug fixes

Fix incorrect versions for @lezer dependencies.

## 0.19.0 (2021-08-11)

### Breaking changes

Update dependencies to 0.19.0

## 0.18.4 (2021-06-16)

### Bug fixes

Fix a case where `deleteMarkupBackward` would return true without actually having an effect.

## 0.18.3 (2021-05-19)

### Bug fixes

`insertNewlineContinueMarkup` will not continue moving list markers down when they are after an empty line anymore.

## 0.18.2 (2021-05-07)

### Bug fixes

Fix a bug where `insertNewlineContinueMarkup` could duplicate bits of content when in dededented continued list items.

## 0.18.1 (2021-04-01)

### Bug fixes

Add `monospace` style tag to all children of inline code nodes.

## 0.18.0 (2021-03-03)

### Breaking changes

Update dependencies to 0.18.

## 0.17.3 (2021-02-22)

### New features

Include heading depth in style tags.

## 0.17.2 (2021-02-10)

### Bug fixes

Fix a bug where `insertNewlineContinueMarkup` would sometimes duplicate bits of content.

### New features

The package now exports both a `commonmarkLanguage`, with just plain CommonMark, and a `markdownLanguage`, with GFM and some other extensions enabled.

It is now possible to pass lezer-markdown extensions to the `markdown` function to configure the parser.

## 0.17.1 (2021-01-06)

### New features

The package now also exports a CommonJS module.

## 0.17.0 (2020-12-29)

### Breaking changes

First numbered release.

