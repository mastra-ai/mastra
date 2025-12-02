import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Content extends APIResource {
    /**
     * Fetches rendered HTML content from provided URL or HTML. Check available options
     * like `gotoOptions` and `waitFor*` to control page load behaviour.
     */
    create(params: ContentCreateParams, options?: Core.RequestOptions): Core.APIPromise<ContentCreateResponse>;
}
/**
 * HTML content
 */
export type ContentCreateResponse = string;
export interface ContentCreateParams {
    /**
     * Path param: Account ID.
     */
    account_id: string;
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
    addScriptTag?: Array<ContentCreateParams.AddScriptTag>;
    /**
     * Body param: Adds a `<link rel="stylesheet">` tag into the page with the desired
     * URL or a `<style type="text/css">` tag with the content.
     */
    addStyleTag?: Array<ContentCreateParams.AddStyleTag>;
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
    authenticate?: ContentCreateParams.Authenticate;
    /**
     * Body param: Attempt to proceed when 'awaited' events fail or timeout.
     */
    bestAttempt?: boolean;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.page.setcookie).
     */
    cookies?: Array<ContentCreateParams.Cookie>;
    /**
     * Body param:
     */
    emulateMediaType?: string;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.gotooptions).
     */
    gotoOptions?: ContentCreateParams.GotoOptions;
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
    viewport?: ContentCreateParams.Viewport;
    /**
     * Body param: Wait for the selector to appear in page. Check
     * [options](https://pptr.dev/api/puppeteer.page.waitforselector).
     */
    waitForSelector?: ContentCreateParams.WaitForSelector;
    /**
     * Body param: Waits for a specified timeout before continuing.
     */
    waitForTimeout?: number;
}
export declare namespace ContentCreateParams {
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
export declare namespace Content {
    export { type ContentCreateResponse as ContentCreateResponse, type ContentCreateParams as ContentCreateParams, };
}
//# sourceMappingURL=content.d.ts.map