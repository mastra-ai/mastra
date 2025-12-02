// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as ContentAPI from './content';
import { Content, ContentCreateParams, ContentCreateResponse } from './content';
import * as JsonAPI from './json';
import { Json, JsonCreateParams, JsonCreateResponse } from './json';
import * as LinksAPI from './links';
import { LinkCreateParams, LinkCreateResponse, Links } from './links';
import * as MarkdownAPI from './markdown';
import { Markdown, MarkdownCreateParams, MarkdownCreateResponse } from './markdown';
import * as PDFAPI from './pdf';
import { PDF, PDFCreateParams } from './pdf';
import * as ScrapeAPI from './scrape';
import { Scrape, ScrapeCreateParams, ScrapeCreateResponse } from './scrape';
import * as ScreenshotAPI from './screenshot';
import { Screenshot, ScreenshotCreateParams, ScreenshotCreateResponse } from './screenshot';
import * as SnapshotAPI from './snapshot';
import { Snapshot, SnapshotCreateParams, SnapshotCreateResponse } from './snapshot';

export class BrowserRendering extends APIResource {
  content: ContentAPI.Content = new ContentAPI.Content(this._client);
  pdf: PDFAPI.PDF = new PDFAPI.PDF(this._client);
  scrape: ScrapeAPI.Scrape = new ScrapeAPI.Scrape(this._client);
  screenshot: ScreenshotAPI.Screenshot = new ScreenshotAPI.Screenshot(this._client);
  snapshot: SnapshotAPI.Snapshot = new SnapshotAPI.Snapshot(this._client);
  json: JsonAPI.Json = new JsonAPI.Json(this._client);
  links: LinksAPI.Links = new LinksAPI.Links(this._client);
  markdown: MarkdownAPI.Markdown = new MarkdownAPI.Markdown(this._client);
}

BrowserRendering.Content = Content;
BrowserRendering.PDF = PDF;
BrowserRendering.Scrape = Scrape;
BrowserRendering.Screenshot = Screenshot;
BrowserRendering.Snapshot = Snapshot;
BrowserRendering.Json = Json;
BrowserRendering.Links = Links;
BrowserRendering.Markdown = Markdown;

export declare namespace BrowserRendering {
  export {
    Content as Content,
    type ContentCreateResponse as ContentCreateResponse,
    type ContentCreateParams as ContentCreateParams,
  };

  export { PDF as PDF, type PDFCreateParams as PDFCreateParams };

  export {
    Scrape as Scrape,
    type ScrapeCreateResponse as ScrapeCreateResponse,
    type ScrapeCreateParams as ScrapeCreateParams,
  };

  export {
    Screenshot as Screenshot,
    type ScreenshotCreateResponse as ScreenshotCreateResponse,
    type ScreenshotCreateParams as ScreenshotCreateParams,
  };

  export {
    Snapshot as Snapshot,
    type SnapshotCreateResponse as SnapshotCreateResponse,
    type SnapshotCreateParams as SnapshotCreateParams,
  };

  export {
    Json as Json,
    type JsonCreateResponse as JsonCreateResponse,
    type JsonCreateParams as JsonCreateParams,
  };

  export {
    Links as Links,
    type LinkCreateResponse as LinkCreateResponse,
    type LinkCreateParams as LinkCreateParams,
  };

  export {
    Markdown as Markdown,
    type MarkdownCreateResponse as MarkdownCreateResponse,
    type MarkdownCreateParams as MarkdownCreateParams,
  };
}
