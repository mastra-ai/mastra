import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Scrape extends APIResource {
    /**
     * Get meta attributes like height, width, text and others of selected elements.
     */
    create(params: ScrapeCreateParams, options?: Core.RequestOptions): Core.APIPromise<ScrapeCreateResponse>;
}
export type ScrapeCreateResponse = Array<ScrapeCreateResponse.ScrapeCreateResponseItem>;
export declare namespace ScrapeCreateResponse {
    interface ScrapeCreateResponseItem {
        results: ScrapeCreateResponseItem.Results;
        /**
         * Selector
         */
        selector: string;
    }
    namespace ScrapeCreateResponseItem {
        interface Results {
            attributes: Array<Results.Attribute>;
            /**
             * Element height
             */
            height: number;
            /**
             * Html content
             */
            html: string;
            /**
             * Element left
             */
            left: number;
            /**
             * Text content
             */
            text: string;
            /**
             * Element top
             */
            top: number;
            /**
             * Element width
             */
            width: number;
        }
        namespace Results {
            interface Attribute {
                /**
                 * Attribute name
                 */
                name: string;
                /**
                 * Attribute value
                 */
                value: string;
            }
        }
    }
}
export interface ScrapeCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
    /**
     * Body param:
     */
    elements: Array<ScrapeCreateParams.Element>;
    /**
     * Query param: Cache TTL default is 5s. Set to 0 to disable.
     */
    cacheTTL?: number;
    /**
     * Body param: The maximum duration allowed for the browser action to complete
     * after the page has loaded (such as taking screenshots, extracting content, or
     * generating PDFs). If this time limit is exceeded, the action stops and returns a
     * timeout error.
     */
    actionTimeout?: number;
    /**
     * Body param: Adds a `<script>` tag into the page with the desired URL or content.
     */
    addScriptTag?: Array<ScrapeCreateParams.AddScriptTag>;
    /**
     * Body param: Adds a `<link rel="stylesheet">` tag into the page with the desired
     * URL or a `<style type="text/css">` tag with the content.
     */
    addStyleTag?: Array<ScrapeCreateParams.AddStyleTag>;
    /**
     * Body param: Only allow requests that match the provided regex patterns, eg.
     * '/^.\*\.(css)'.
     */
    allowRequestPattern?: Array<string>;
    /**
     * Body param: Only allow requests that match the provided resource types, eg.
     * 'image' or 'script'.
     */
    allowResourceTypes?: Array<'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'prefetch' | 'eventsource' | 'websocket' | 'manifest' | 'signedexchange' | 'ping' | 'cspviolationreport' | 'preflight' | 'other'>;
    /**
     * Body param: Provide credentials for HTTP authentication.
     */
    authenticate?: ScrapeCreateParams.Authenticate;
    /**
     * Body param: Attempt to proceed when 'awaited' events fail or timeout.
     */
    bestAttempt?: boolean;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.page.setcookie).
     */
    cookies?: Array<ScrapeCreateParams.Cookie>;
    /**
     * Body param:
     */
    emulateMediaType?: string;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.gotooptions).
     */
    gotoOptions?: ScrapeCreateParams.GotoOptions;
    /**
     * Body param: Set the content of the page, eg: `<h1>Hello World!!</h1>`. Either
     * `html` or `url` must be set.
     */
    html?: string;
    /**
     * Body param: Block undesired requests that match the provided regex patterns, eg.
     * '/^.\*\.(css)'.
     */
    rejectRequestPattern?: Array<string>;
    /**
     * Body param: Block undesired requests that match the provided resource types, eg.
     * 'image' or 'script'.
     */
    rejectResourceTypes?: Array<'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'prefetch' | 'eventsource' | 'websocket' | 'manifest' | 'signedexchange' | 'ping' | 'cspviolationreport' | 'preflight' | 'other'>;
    /**
     * Body param:
     */
    setExtraHTTPHeaders?: {
        [key: string]: string;
    };
    /**
     * Body param:
     */
    setJavaScriptEnabled?: boolean;
    /**
     * Body param: URL to navigate to, eg. `https://example.com`.
     */
    url?: string;
    /**
     * Body param:
     */
    userAgent?: string;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.page.setviewport).
     */
    viewport?: ScrapeCreateParams.Viewport;
    /**
     * Body param: Wait for the selector to appear in page. Check
     * [options](https://pptr.dev/api/puppeteer.page.waitforselector).
     */
    waitForSelector?: ScrapeCreateParams.WaitForSelector;
    /**
     * Body param: Waits for a specified timeout before continuing.
     */
    waitForTimeout?: number;
}
export declare namespace ScrapeCreateParams {
    interface Element {
        selector: string;
    }
    interface AddScriptTag {
        id?: string;
        content?: string;
        type?: string;
        url?: string;
    }
    interface AddStyleTag {
        content?: string;
        url?: string;
    }
    /**
     * Provide credentials for HTTP authentication.
     */
    interface Authenticate {
        password: string;
        username: string;
    }
    interface Cookie {
        name: string;
        value: string;
        domain?: string;
        expires?: number;
        httpOnly?: boolean;
        partitionKey?: string;
        path?: string;
        priority?: 'Low' | 'Medium' | 'High';
        sameParty?: boolean;
        sameSite?: 'Strict' | 'Lax' | 'None';
        secure?: boolean;
        sourcePort?: number;
        sourceScheme?: 'Unset' | 'NonSecure' | 'Secure';
        url?: string;
    }
    /**
     * Check [options](https://pptr.dev/api/puppeteer.gotooptions).
     */
    interface GotoOptions {
        referer?: string;
        referrerPolicy?: string;
        timeout?: number;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' | Array<'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'>;
    }
    /**
     * Check [options](https://pptr.dev/api/puppeteer.page.setviewport).
     */
    interface Viewport {
        height: number;
        width: number;
        deviceScaleFactor?: number;
        hasTouch?: boolean;
        isLandscape?: boolean;
        isMobile?: boolean;
    }
    /**
     * Wait for the selector to appear in page. Check
     * [options](https://pptr.dev/api/puppeteer.page.waitforselector).
     */
    interface WaitForSelector {
        selector: string;
        hidden?: true;
        timeout?: number;
        visible?: true;
    }
}
export declare namespace Scrape {
    export { type ScrapeCreateResponse as ScrapeCreateResponse, type ScrapeCreateParams as ScrapeCreateParams };
}
//# sourceMappingURL=scrape.d.ts.map