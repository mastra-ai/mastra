import { BaseComponent } from '../../component.js';
import type { ErrorStackSourceProps } from '../../types.js';
/**
 * Pretty prints the stack frame source code with syntax
 * highlighting.
 */
export declare class ErrorStackSource extends BaseComponent<ErrorStackSourceProps> {
    cssFile: URL;
    /**
     * The toHTML method is used to output the HTML for the
     * web view
     */
    toHTML(props: ErrorStackSourceProps): Promise<string>;
    /**
     * The toANSI method is used to output the text for the console
     */
    toANSI(props: ErrorStackSourceProps): Promise<string>;
}
