import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Screenshot extends APIResource {
    /**
     * Takes a screenshot of a webpage from provided URL or HTML. Control page loading
     * with `gotoOptions` and `waitFor*` options. Customize screenshots with
     * `viewport`, `fullPage`, `clip` and others.
     */
    create(params: ScreenshotCreateParams, options?: Core.RequestOptions): Core.APIPromise<ScreenshotCreateResponse>;
}
export interface ScreenshotCreateResponse {
    /**
     * Response status
     */
    status: boolean;
    errors?: Array<ScreenshotCreateResponse.Error>;
}
export declare namespace ScreenshotCreateResponse {
    interface Error {
        /**
         * Error code
         */
        code: number;
        /**
         * Error Message
         */
        message: string;
    }
}
export interface ScreenshotCreateParams {
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
    addScriptTag?: Array<ScreenshotCreateParams.AddScriptTag>;
    /**
     * Body param: Adds a `<link rel="stylesheet">` tag into the page with the desired
     * URL or a `<style type="text/css">` tag with the content.
     */
    addStyleTag?: Array<ScreenshotCreateParams.AddStyleTag>;
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
    authenticate?: ScreenshotCreateParams.Authenticate;
    /**
     * Body param: Attempt to proceed when 'awaited' events fail or timeout.
     */
    bestAttempt?: boolean;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.page.setcookie).
     */
    cookies?: Array<ScreenshotCreateParams.Cookie>;
    /**
     * Body param:
     */
    emulateMediaType?: string;
    /**
     * Body param: Check [options](https://pptr.dev/api/puppeteer.gotooptions).
     */
    gotoOptions?: ScreenshotCreateParams.GotoOptions;
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
     * Body param: Check [options](https://pptr.dev/api/puppeteer.screenshotoptions).
     */
    screenshotOptions?: ScreenshotCreateParams.ScreenshotOptions;
    /**
     * Body param:
     */
    scrollPage?: boolean;
    /**
     * Body param:
     */
    selector?: string;
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
    viewport?: ScreenshotCreateParams.Viewport;
    /**
     * Body param: Wait for the selector to appear in page. Check
     * [options](https://pptr.dev/api/puppeteer.page.waitforselector).
     */
    waitForSelector?: ScreenshotCreateParams.WaitForSelector;
    /**
     * Body param: Waits for a specified timeout before continuing.
     */
    waitForTimeout?: number;
}
export declare namespace ScreenshotCreateParams {
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
     * Check [options](https://pptr.dev/api/puppeteer.screenshotoptions).
     */
    interface ScreenshotOptions {
        captureBeyondViewport?: boolean;
        clip?: ScreenshotOptions.Clip;
        encoding?: 'binary' | 'base64';
        fromSurface?: boolean;
        fullPage?: boolean;
        omitBackground?: boolean;
        optimizeForSpeed?: boolean;
        quality?: number;
        type?: 'png' | 'jpeg' | 'webp';
    }
    namespace ScreenshotOptions {
        interface Clip {
            height: number;
            width: number;
            x: number;
            y: number;
            scale?: number;
        }
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
export declare namespace Screenshot {
    export { type ScreenshotCreateResponse as ScreenshotCreateResponse, type ScreenshotCreateParams as ScreenshotCreateParams, };
}
//# sourceMappingURL=screenshot.d.ts.map