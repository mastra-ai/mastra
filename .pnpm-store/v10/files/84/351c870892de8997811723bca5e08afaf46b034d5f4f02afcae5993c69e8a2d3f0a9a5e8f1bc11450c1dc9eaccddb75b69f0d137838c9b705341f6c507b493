## 6.10.0 (2025-09-16)

### New features

Allow `[` in `identifierQuotes` for MSSQL-style bracketed identifiers.

## 6.9.1 (2025-07-28)

### Bug fixes

Include more MSSQL keyboards and builtins in the completions.

Allow built-in special variables for a dialect to be completed.

## 6.9.0 (2025-05-30)

### New features

The new `SQLDialect.configureLanguage` method can be used to configure the language (and it's syntax node props) used by a dialect.

## 6.8.0 (2024-10-01)

### New features

The new `keywordCompletion` option can be used to define what kind of completions are generated for keywords.

## 6.7.1 (2024-08-21)

### Bug fixes

Remove single-letter words from the list of Postgres keywords, since they interfere with alias-based autocompletion.

## 6.7.0 (2024-06-24)

### New features

Dialects can now disable quoting of identifiers containing upper-case characters with the `caseInsensitiveIdentifiers` option.

## 6.6.5 (2024-06-17)

### Bug fixes

Fix a bug that broke tokenizing of `e'\n'`-style strings.

## 6.6.4 (2024-05-04)

### Bug fixes

Make statement folding leave the entire first line visible.

Fix a null dereference in schema-based autocompletion.

## 6.6.3 (2024-04-08)

### Bug fixes

Fix a bug where Postgres-style dollar-quoted strings were enabled for all dialects, and the `doubleDollarQuotedStrings` options was ignored.

## 6.6.2 (2024-03-23)

### Bug fixes

Properly support tags in PostgreSQL `4073` quoted strings.

## 6.6.1 (2024-03-04)

### Bug fixes

Fix an issue that caused completions to be missing when using the `defaultSchema` option.

## 6.6.0 (2024-02-29)

### Bug fixes

Don't tokenize identifiers after periods as anything but plain identifiers.

### New features

The `schema` option now allows nested objects to define multiple levels of completions, as well as `self` completion options for specific levels. The old format (using `tables`/`schemas`) continues to work but is deprecated.

## 6.5.5 (2023-12-28)

### Bug fixes

Make sure table and column completions with upper-case characters are quoted.

Tag comments and strings as isolating for the purpose of bidirectional text.

## 6.5.4 (2023-08-10)

### Bug fixes

Remove use of negative lookbehind in a regular expression, which recent versions of Safari still don't support.

## 6.5.3 (2023-08-05)

### Bug fixes

The PL/SQL dialect now correctly handles `q'[]'`-quoting syntax.

## 6.5.2 (2023-06-23)

### Bug fixes

Allow table names to contain multiple dots in the schema passed to `schemaCompletionSource`.

## 6.5.1 (2023-06-21)

### Bug fixes

`schemaCompletionSource` now adds quotes around non-word identifiers even if the user didn't type a starting quote.

## 6.5.0 (2023-05-16)

### New features

Dialect objects now have a public `spec` property holding their configuration.

## 6.4.1 (2023-04-13)

### Bug fixes

Fix a bug where tokenizing of block comments got confused when nested comment start/end markers appeared directly next to each other.

## 6.4.0 (2023-01-23)

### Bug fixes

Fix syntax tree node names for curly and square brackets, which had their names swapped.

### New features

The new `schemas` config option can be used to provide custom completion objects for schema completions.

## 6.3.3 (2022-11-14)

### Bug fixes

Fix tokenizing of double-`$` strings in SQL dialects that support them.

## 6.3.2 (2022-10-24)

### Bug fixes

Make sure the language object has a name.

## 6.3.1 (2022-10-17)

### Bug fixes

Fix tokenizing of `--` line comments.

## 6.3.0 (2022-08-23)

### New features

Schema-based completion now understands basic table alias syntax, and will take it into account when looking up completions.

## 6.2.0 (2022-08-14)

### New features

The new `unquotedBitLiterals` dialect option controls whether `0b01` syntax is recognized.

Dialects now allow a `treatBitsAsBytes` option to allow any characters inside quoted strings prefixed with `b`.

## 6.1.0 (2022-08-05)

### New features

The new `doubleDollarQuotedStrings` options to SQL dialects allows parsing of text delimited by `$$` as strings. Regenerate readme

## 6.0.0 (2022-06-08)

### Breaking changes

Update dependencies to 6.0.0

## 0.20.4 (2022-05-30)

### New features

Schema completion descriptions may now include dots in table names to indicate nested schemas.

## 0.20.3 (2022-05-27)

### Bug fixes

Fix a bug where the slash at the end of block comments wasn't considered part of the comment token.

## 0.20.2 (2022-05-24)

### Bug fixes

Fix an infinite recursion bug in `schemaCompletionSource`.

## 0.20.1 (2022-05-24)

### Breaking changes

The `schemaCompletion` and `keywordCompletion` exports, which returned extensions, have been replaced with `schemaCompletionSource` and `keywordCompletionSource`, which return completion sources. The old exports will remain available until the next major version.

## 0.20.0 (2022-04-20)

### Bug fixes

Fix autocompletion on columns when the table name is written with upper-case letters. Move to @lezer/highlight

## 0.19.4 (2021-10-28)

### Bug fixes

Remove duplicate keywords/types in dialect configurations.

Fix a bug that caused characters directly before a space to be tokenized incorrectly.

## 0.19.3 (2021-08-21)

### Bug fixes

Fix a bug that broke tokenization of keywords.

## 0.19.2 (2021-08-11)

## 0.19.1 (2021-08-11)

### Bug fixes

Fix incorrect versions for @lezer dependencies.

## 0.19.0 (2021-08-11)

### Breaking changes

Update dependencies to 0.19.0

## 0.18.0 (2021-03-03)

### Breaking changes

Update dependencies to 0.18.

## 0.17.2 (2021-02-01)

### Bug fixes

Fix bad syntax tree creation when the input ends with an unfinished quoted identifier.

## 0.17.1 (2021-01-06)

### New features

The package now also exports a CommonJS module.

## 0.17.0 (2020-12-29)

### Breaking changes

First numbered release.

