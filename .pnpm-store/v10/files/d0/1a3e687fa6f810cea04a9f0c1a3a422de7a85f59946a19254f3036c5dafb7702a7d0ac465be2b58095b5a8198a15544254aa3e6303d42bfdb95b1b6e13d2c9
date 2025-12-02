// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import { type Response } from '../../_shims/index';

export class PDF extends APIResource {
  /**
   * Fetches rendered PDF from provided URL or HTML. Check available options like
   * `gotoOptions` and `waitFor*` to control page load behaviour.
   */
  create(params: PDFCreateParams, options?: Core.RequestOptions): Core.APIPromise<Response> {
    const { account_id, cacheTTL, ...body } = params;
    return this._client.post(`/accounts/${account_id}/browser-rendering/pdf`, {
      query: { cacheTTL },
      body,
      ...options,
      headers: { Accept: 'application/pdf', ...options?.headers },
      __binaryResponse: true,
    });
  }
}

export interface PDFCreateParams {
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
  addScriptTag?: Array<PDFCreateParams.AddScriptTag>;

  /**
   * Body param: Adds a `<link rel="stylesheet">` tag into the page with the desired
   * URL or a `<style type="text/css">` tag with the content.
   */
  addStyleTag?: Array<PDFCreateParams.AddStyleTag>;

  /**
   * Body param: Only allow requests that match the provided regex patterns, eg.
   * '/^.\*\.(css)'.
   */
  allowRequestPattern?: Array<string>;

  /**
   * Body param: Only allow requests that match the provided resource types, eg.
   * 'image' or 'script'.
   */
  allowResourceTypes?: Array<
    | 'document'
    | 'stylesheet'
    | 'image'
    | 'media'
    | 'font'
    | 'script'
    | 'texttrack'
    | 'xhr'
    | 'fetch'
    | 'prefetch'
    | 'eventsource'
    | 'websocket'
    | 'manifest'
    | 'signedexchange'
    | 'ping'
    | 'cspviolationreport'
    | 'preflight'
    | 'other'
  >;

  /**
   * Body param: Provide credentials for HTTP authentication.
   */
  authenticate?: PDFCreateParams.Authenticate;

  /**
   * Body param: Attempt to proceed when 'awaited' events fail or timeout.
   */
  bestAttempt?: boolean;

  /**
   * Body param: Check [options](https://pptr.dev/api/puppeteer.page.setcookie).
   */
  cookies?: Array<PDFCreateParams.Cookie>;

  /**
   * Body param:
   */
  emulateMediaType?: string;

  /**
   * Body param: Check [options](https://pptr.dev/api/puppeteer.gotooptions).
   */
  gotoOptions?: PDFCreateParams.GotoOptions;

  /**
   * Body param: Set the content of the page, eg: `<h1>Hello World!!</h1>`. Either
   * `html` or `url` must be set.
   */
  html?: string;

  /**
   * Body param: Check [options](https://pptr.dev/api/puppeteer.pdfoptions).
   */
  pdfOptions?: PDFCreateParams.PDFOptions;

  /**
   * Body param: Block undesired requests that match the provided regex patterns, eg.
   * '/^.\*\.(css)'.
   */
  rejectRequestPattern?: Array<string>;

  /**
   * Body param: Block undesired requests that match the provided resource types, eg.
   * 'image' or 'script'.
   */
  rejectResourceTypes?: Array<
    | 'document'
    | 'stylesheet'
    | 'image'
    | 'media'
    | 'font'
    | 'script'
    | 'texttrack'
    | 'xhr'
    | 'fetch'
    | 'prefetch'
    | 'eventsource'
    | 'websocket'
    | 'manifest'
    | 'signedexchange'
    | 'ping'
    | 'cspviolationreport'
    | 'preflight'
    | 'other'
  >;

  /**
   * Body param:
   */
  setExtraHTTPHeaders?: { [key: string]: string };

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
  viewport?: PDFCreateParams.Viewport;

  /**
   * Body param: Wait for the selector to appear in page. Check
   * [options](https://pptr.dev/api/puppeteer.page.waitforselector).
   */
  waitForSelector?: PDFCreateParams.WaitForSelector;

  /**
   * Body param: Waits for a specified timeout before continuing.
   */
  waitForTimeout?: number;
}

export namespace PDFCreateParams {
  export interface AddScriptTag {
    id?: string;

    content?: string;

    type?: string;

    url?: string;
  }

  export interface AddStyleTag {
    content?: string;

    url?: string;
  }

  /**
   * Provide credentials for HTTP authentication.
   */
  export interface Authenticate {
    password: string;

    username: string;
  }

  export interface Cookie {
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
  export interface GotoOptions {
    referer?: string;

    referrerPolicy?: string;

    timeout?: number;

    waitUntil?:
      | 'load'
      | 'domcontentloaded'
      | 'networkidle0'
      | 'networkidle2'
      | Array<'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'>;
  }

  /**
   * Check [options](https://pptr.dev/api/puppeteer.pdfoptions).
   */
  export interface PDFOptions {
    /**
     * Whether to show the header and footer.
     */
    displayHeaderFooter?: boolean;

    /**
     * HTML template for the print footer.
     */
    footerTemplate?: string;

    /**
     * Paper format. Takes priority over width and height if set.
     */
    format?: 'letter' | 'legal' | 'tabloid' | 'ledger' | 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6';

    /**
     * HTML template for the print header.
     */
    headerTemplate?: string;

    /**
     * Sets the height of paper. Can be a number or string with unit.
     */
    height?: string | number;

    /**
     * Whether to print in landscape orientation.
     */
    landscape?: boolean;

    /**
     * Set the PDF margins. Useful when setting header and footer.
     */
    margin?: PDFOptions.Margin;

    /**
     * Hides default white background and allows generating pdfs with transparency.
     */
    omitBackground?: boolean;

    /**
     * Generate document outline.
     */
    outline?: boolean;

    /**
     * Paper ranges to print, e.g. '1-5, 8, 11-13'.
     */
    pageRanges?: string;

    /**
     * Give CSS @page size priority over other size declarations.
     */
    preferCSSPageSize?: boolean;

    /**
     * Set to true to print background graphics.
     */
    printBackground?: boolean;

    /**
     * Scales the rendering of the web page. Amount must be between 0.1 and 2.
     */
    scale?: number;

    /**
     * Generate tagged (accessible) PDF.
     */
    tagged?: boolean;

    /**
     * Timeout in milliseconds.
     */
    timeout?: number;

    /**
     * Sets the width of paper. Can be a number or string with unit.
     */
    width?: string | number;
  }

  export namespace PDFOptions {
    /**
     * Set the PDF margins. Useful when setting header and footer.
     */
    export interface Margin {
      bottom?: string | number;

      left?: string | number;

      right?: string | number;

      top?: string | number;
    }
  }

  /**
   * Check [options](https://pptr.dev/api/puppeteer.page.setviewport).
   */
  export interface Viewport {
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
  export interface WaitForSelector {
    selector: string;

    hidden?: true;

    timeout?: number;

    visible?: true;
  }
}

export declare namespace PDF {
  export { type PDFCreateParams as PDFCreateParams };
}
