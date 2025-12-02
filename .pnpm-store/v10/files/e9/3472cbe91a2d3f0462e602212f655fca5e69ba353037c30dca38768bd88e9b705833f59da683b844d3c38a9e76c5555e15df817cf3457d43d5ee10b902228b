import { LRLanguage, Language, LanguageSupport } from '@codemirror/language';

/**
A language provider based on the [Lezer PHP
parser](https://github.com/lezer-parser/php), extended with
highlighting and indentation information.
*/
declare const phpLanguage: LRLanguage;
/**
PHP language support.
*/
declare function php(config?: {
    /**
    By default, the parser will treat content outside of `<?` and
    `?>` markers as HTML. You can pass a different language here to
    change that. Explicitly passing disables parsing of such content.
    */
    baseLanguage?: Language | null;
    /**
    By default, PHP parsing only starts at the first `<?` marker.
    When you set this to true, it starts immediately at the start of
    the document.
    */
    plain?: boolean;
}): LanguageSupport;

export { php, phpLanguage };
