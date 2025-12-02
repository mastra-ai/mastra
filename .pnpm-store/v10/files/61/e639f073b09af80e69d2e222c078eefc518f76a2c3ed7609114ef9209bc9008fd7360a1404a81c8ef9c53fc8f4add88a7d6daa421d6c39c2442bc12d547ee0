import { BaseComponent } from '../../component.js';
import type { LayoutProps } from '../../types.js';
/**
 * Layout component renders the HTML structure for the document
 * along with the styles for the global elements.
 *
 * You can define a custom Layout if you want to modify the HTML
 * structure or the CSS variables for the colors.
 */
export declare class Layout extends BaseComponent<LayoutProps> {
    cssFile: URL;
    scriptFile: URL;
    /**
     * The toHTML method is used to output the HTML for the
     * web view
     */
    toHTML(props: LayoutProps): Promise<string>;
    /**
     * The toANSI method is used to output the text for the console
     */
    toANSI(props: LayoutProps): Promise<string>;
}
