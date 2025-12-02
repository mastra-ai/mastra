/**
 * Find the tokens in the given code and call the given callback
 *
 * @function tokenize
 * @param {string} src The code
 * @param {ShjLanguage|Array} lang The language of the code
 * @param {function(string, ShjToken=):void} token The callback function
 * this function will be given
 * * the text of the token
 * * the type of the token
 */
export function tokenize(src: string, lang: ShjLanguage | any[], token: (arg0: string, arg1: ShjToken | undefined) => void): Promise<void>;
/**
 * Highlight a string passed as argument and return it
 * @example
 * elm.innerHTML = await highlightText(code, 'js');
 *
 * @async
 * @function highlightText
 * @param {string} src The code
 * @param {ShjLanguage} lang The language of the code
 * @param {Boolean} [multiline=true] If it is multiline, it will add a wrapper for the line numbering and header
 * @param {ShjOptions} [opt={}] Customization options
 * @returns {Promise<string>} The highlighted string
 */
export function highlightText(src: string, lang: ShjLanguage, multiline?: boolean, opt?: ShjOptions): Promise<string>;
/**
 * Highlight a DOM element by getting the new innerHTML with highlightText
 *
 * @async
 * @function highlightElement
 * @param {Element} elm The DOM element
 * @param {ShjLanguage} [lang] The language of the code (seaching by default on `elm` for a 'shj-lang-' class)
 * @param {ShjDisplayMode} [mode] The display mode (guessed by default)
 * @param {ShjOptions} [opt={}] Customization options
 */
export function highlightElement(elm: Element, lang?: ShjLanguage, mode?: ShjDisplayMode, opt?: ShjOptions): Promise<void>;
export function highlightAll(opt?: ShjOptions): Promise<void[]>;
export function loadLanguage(languageName: string, language: {
    default: ShjLanguageDefinition;
}): void;
/**
 * Default languages supported
 */
export type ShjLanguage = ("asm" | "bash" | "bf" | "c" | "css" | "csv" | "diff" | "docker" | "git" | "go" | "html" | "http" | "ini" | "java" | "js" | "jsdoc" | "json" | "leanpub-md" | "log" | "lua" | "make" | "md" | "pl" | "plain" | "py" | "regex" | "rs" | "sql" | "todo" | "toml" | "ts" | "uri" | "xml" | "yaml");
/**
 * Themes supported in the browser
 */
export type ShjBrowserTheme = ("atom-dark" | "github-dark" | "github-dim" | "dark" | "default" | "github-light" | "visual-studio-dark");
export type ShjOptions = {
    /**
     * Indicates whether to hide line numbers
     */
    hideLineNumbers?: boolean;
};
/**
 * * `inline` inside `code` element
 * * `oneline` inside `div` element and containing only one line
 * * `multiline` inside `div` element
 */
export type ShjDisplayMode = ("inline" | "oneline" | "multiline");
/**
 * Token types
 */
export type ShjToken = ("deleted" | "err" | "var" | "section" | "kwd" | "class" | "cmnt" | "insert" | "type" | "func" | "bool" | "num" | "oper" | "str" | "esc");
export type ShjLanguageComponent = {
    match: RegExp;
    type: string;
} | {
    match: RegExp;
    sub: string | ShjLanguageDefinition | ((code: string) => ShjLanguageComponent);
} | {
    expand: string;
};
export type ShjLanguageDefinition = ShjLanguageComponent[];
//# sourceMappingURL=index.d.ts.map