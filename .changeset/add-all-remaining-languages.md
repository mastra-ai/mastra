---
'@mastra/rag': minor
---

Added support for 20 additional languages in code chunking

Extended RecursiveCharacterTransformer to support all languages defined in the Language enum. Previously, only 6 languages were supported (CPP, C, TS, MARKDOWN, LATEX, PHP), causing runtime errors for other defined languages.

**Newly supported languages:**
- GO, JAVA, KOTLIN, JS, PYTHON, RUBY, RUST, SCALA, SWIFT (popular programming languages)
- HTML, SOL (Solidity), CSHARP, COBOL, LUA, PERL, HASKELL, ELIXIR, POWERSHELL (additional languages)
- PROTO (Protocol Buffers), RST (reStructuredText) (data/documentation formats)

Each language has been configured with appropriate separators based on its syntax patterns (modules, classes, functions, control structures) to enable semantic code chunking.

**Before:**

```typescript
import { RecursiveCharacterTransformer, Language } from '@mastra/rag';

// These would all throw "Language X is not supported!" errors
const goTransformer = RecursiveCharacterTransformer.fromLanguage(Language.GO);
const pythonTransformer = RecursiveCharacterTransformer.fromLanguage(Language.PYTHON);
const rustTransformer = RecursiveCharacterTransformer.fromLanguage(Language.RUST);
```

**After:**

```typescript
import { RecursiveCharacterTransformer, Language } from '@mastra/rag';

// All languages now work seamlessly
const goTransformer = RecursiveCharacterTransformer.fromLanguage(Language.GO);
const goChunks = goTransformer.transform(goCodeDocument);

const pythonTransformer = RecursiveCharacterTransformer.fromLanguage(Language.PYTHON);
const pythonChunks = pythonTransformer.transform(pythonCodeDocument);

const rustTransformer = RecursiveCharacterTransformer.fromLanguage(Language.RUST);
const rustChunks = rustTransformer.transform(rustCodeDocument);
// All languages in the Language enum are now fully supported
```
