import type { ParsedError } from 'youch-core/types';
import { type Metadata } from './metadata.js';
import type { YouchTemplates } from './types.js';
/**
 * A super lightweight templates collection that allows composing
 * HTML using TypeScript based components with the ability to
 * override the component for a pre-defined template.
 *
 * @example
 * ```ts
 * const templates = new Templates()
 * const html = templates.render(
 *   {
 *     title: 'Internal server error',
 *     error: await new ErrorParser().parse(error)
 *   }
 * )
 *
 * // Override a template
 * class MyHeader extends BaseComponent {
 *   async render() {}
 * }
 *
 * templates.use('header', new MyHeader(templates.devMode))
 * ```
 */
export declare class Templates {
    #private;
    devMode: boolean;
    constructor(devMode: boolean);
    /**
     * Define a custom component to be used in place of the default component.
     * Overriding components allows you control the HTML layout, styles and
     * the frontend scripts of an HTML fragment.
     */
    use<K extends keyof YouchTemplates>(templateName: K, component: YouchTemplates[K]): this;
    /**
     * Inject custom styles to the document. Injected styles are
     * always placed after the global and the components style
     * tags.
     */
    injectStyles(cssFragment: string): this;
    /**
     * Returns the HTML output for the given parsed error
     */
    toHTML(props: {
        title: string;
        ide?: string;
        cspNonce?: string;
        error: ParsedError;
        metadata: Metadata;
    }): Promise<string>;
    /**
     * Returns the ANSI output to be printed on the terminal
     */
    toANSI(props: {
        title: string;
        error: ParsedError;
        metadata: Metadata;
    }): Promise<string>;
}
