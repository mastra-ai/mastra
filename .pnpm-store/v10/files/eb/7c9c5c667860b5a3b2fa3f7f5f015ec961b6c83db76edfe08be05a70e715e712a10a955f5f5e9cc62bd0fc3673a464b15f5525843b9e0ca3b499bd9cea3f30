// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ContentAPI from "./content.mjs";
import { Content } from "./content.mjs";
import * as JsonAPI from "./json.mjs";
import { Json } from "./json.mjs";
import * as LinksAPI from "./links.mjs";
import { Links } from "./links.mjs";
import * as MarkdownAPI from "./markdown.mjs";
import { Markdown } from "./markdown.mjs";
import * as PDFAPI from "./pdf.mjs";
import { PDF } from "./pdf.mjs";
import * as ScrapeAPI from "./scrape.mjs";
import { Scrape } from "./scrape.mjs";
import * as ScreenshotAPI from "./screenshot.mjs";
import { Screenshot } from "./screenshot.mjs";
import * as SnapshotAPI from "./snapshot.mjs";
import { Snapshot } from "./snapshot.mjs";
export class BrowserRendering extends APIResource {
    constructor() {
        super(...arguments);
        this.content = new ContentAPI.Content(this._client);
        this.pdf = new PDFAPI.PDF(this._client);
        this.scrape = new ScrapeAPI.Scrape(this._client);
        this.screenshot = new ScreenshotAPI.Screenshot(this._client);
        this.snapshot = new SnapshotAPI.Snapshot(this._client);
        this.json = new JsonAPI.Json(this._client);
        this.links = new LinksAPI.Links(this._client);
        this.markdown = new MarkdownAPI.Markdown(this._client);
    }
}
BrowserRendering.Content = Content;
BrowserRendering.PDF = PDF;
BrowserRendering.Scrape = Scrape;
BrowserRendering.Screenshot = Screenshot;
BrowserRendering.Snapshot = Snapshot;
BrowserRendering.Json = Json;
BrowserRendering.Links = Links;
BrowserRendering.Markdown = Markdown;
//# sourceMappingURL=browser-rendering.mjs.map