---
'@mastra/rag': patch
---

Add support for all missing languages in Language enum

Previously, the Language enum defined 26 programming languages (including PHP, GO, JAVA, KOTLIN, JS, PYTHON, RUBY, RUST, SCALA, SWIFT, HTML, SOL, CSHARP, COBOL, LUA, PERL, HASKELL, ELIXIR, and POWERSHELL), but only 5 languages (CPP, C, TS, MARKDOWN, LATEX) were actually supported in the `getSeparatorsForLanguage` method. This caused runtime errors when trying to use the other languages for code chunking.

This change adds proper separator definitions for all 21 missing languages, ensuring that all languages defined in the Language enum are now fully supported. Each language has been configured with appropriate separators based on its syntax and common programming patterns (classes, functions, control structures, etc.).

Fixes the issue where using `Language.PHP` or other unsupported languages would throw "Language X is not supported!" error.
