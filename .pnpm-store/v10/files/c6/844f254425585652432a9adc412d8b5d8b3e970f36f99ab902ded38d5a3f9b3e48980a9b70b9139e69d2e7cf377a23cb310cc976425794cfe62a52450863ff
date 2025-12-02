/**
 * BaseComponent that must be used to create custom components.
 * It has support for loading CSS files and frontend scripts.
 */
export declare abstract class BaseComponent<Props = undefined> {
    #private;
    $props: Props;
    /**
     * Absolute path to the frontend JavaScript that should be
     * injected within the HTML head. The JavaScript does not
     * get transpiled, hence it should work cross browser by
     * default.
     */
    scriptFile?: string | URL;
    /**
     * Absolute path to the CSS file that should be injected
     * within the HTML head.
     */
    cssFile?: string | URL;
    constructor(devMode: boolean);
    /**
     * Returns the styles for the component. The null value
     * is not returned if no styles are associated with
     * the component
     */
    getStyles(): Promise<string | null>;
    /**
     * Returns the frontend script for the component. The null
     * value is not returned if no styles are associated
     * with the component
     */
    getScript(): Promise<string | null>;
    /**
     * The toHTML method is used to output the HTML for the
     * web view
     */
    abstract toHTML(props: Props): Promise<string>;
    /**
     * The toANSI method is used to output the text for the console
     */
    abstract toANSI(props: Props): Promise<string>;
}
