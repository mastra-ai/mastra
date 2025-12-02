import { BaseComponent } from '../../component.js';
import type { ErrorStackProps } from '../../types.js';
/**
 * Displays the formatted and raw error stack along with the
 * source code for individual stack frames
 */
export declare class ErrorStack extends BaseComponent<ErrorStackProps> {
    #private;
    cssFile: URL;
    scriptFile: URL;
    /**
     * The toHTML method is used to output the HTML for the
     * web view
     */
    toHTML(props: ErrorStackProps): Promise<string>;
    /**
     * The toANSI method is used to output the text for the console
     */
    toANSI(props: ErrorStackProps): Promise<string>;
}
