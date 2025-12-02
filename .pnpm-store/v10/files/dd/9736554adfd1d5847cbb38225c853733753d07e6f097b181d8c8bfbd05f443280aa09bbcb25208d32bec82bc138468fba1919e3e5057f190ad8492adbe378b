import * as _codemirror_autocomplete from '@codemirror/autocomplete';
import { LRLanguage, LanguageSupport } from '@codemirror/language';

/**
A language provider based on the [Lezer Sass
parser](https://github.com/lezer-parser/sass), extended with
highlighting and indentation information.
*/
declare const sassLanguage: LRLanguage;
/**
Property, variable, $-variable, and value keyword completion
source.
*/
declare const sassCompletionSource: _codemirror_autocomplete.CompletionSource;
/**
Language support for CSS.
*/
declare function sass(config?: {
    /**
    When enabled, support classical indentation-based syntax. Default
    to false (SCSS syntax).
    */
    indented?: boolean;
}): LanguageSupport;

export { sass, sassCompletionSource, sassLanguage };
