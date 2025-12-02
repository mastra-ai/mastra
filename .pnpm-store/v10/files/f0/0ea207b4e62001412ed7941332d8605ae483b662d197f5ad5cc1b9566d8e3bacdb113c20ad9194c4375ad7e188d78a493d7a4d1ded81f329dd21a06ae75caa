import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { Completion, CompletionSource } from '@codemirror/autocomplete';

/**
A language provider based on the [Lezer Go
parser](https://github.com/lezer-parser/go), extended with
folding and indentation information.
*/
declare const goLanguage: LRLanguage;
/**
Go support. Includes [snippet](https://codemirror.net/6/docs/ref/#lang-go.snippets) and local
variable completion.
*/
declare function go(): LanguageSupport;

/**
A collection of Go-related [snippets](https://codemirror.net/6/docs/ref/#autocomplete.snippet).
*/
declare const snippets: readonly Completion[];

/**
Completion source that looks up locally defined names in Go code.
*/
declare const localCompletionSource: CompletionSource;

export { go, goLanguage, localCompletionSource, snippets };
