declare const outdent: Outdent;
export interface Outdent {
    /**
     * Remove indentation from a template literal.
     */
    (strings: TemplateStringsArray, ...values: Array<any>): string;
    /**
     * Create and return a new Outdent instance with the given options.
     */
    (options: Options): Outdent;
    /**
     * Remove indentation from a string
     */
    string(str: string): string;
}
export interface Options {
    trimLeadingNewline?: boolean;
    trimTrailingNewline?: boolean;
}
export default outdent;
export { outdent };
