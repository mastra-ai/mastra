"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserRendering = void 0;
const resource_1 = require("../../resource.js");
const ContentAPI = __importStar(require("./content.js"));
const content_1 = require("./content.js");
const JsonAPI = __importStar(require("./json.js"));
const json_1 = require("./json.js");
const LinksAPI = __importStar(require("./links.js"));
const links_1 = require("./links.js");
const MarkdownAPI = __importStar(require("./markdown.js"));
const markdown_1 = require("./markdown.js");
const PDFAPI = __importStar(require("./pdf.js"));
const pdf_1 = require("./pdf.js");
const ScrapeAPI = __importStar(require("./scrape.js"));
const scrape_1 = require("./scrape.js");
const ScreenshotAPI = __importStar(require("./screenshot.js"));
const screenshot_1 = require("./screenshot.js");
const SnapshotAPI = __importStar(require("./snapshot.js"));
const snapshot_1 = require("./snapshot.js");
class BrowserRendering extends resource_1.APIResource {
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
exports.BrowserRendering = BrowserRendering;
BrowserRendering.Content = content_1.Content;
BrowserRendering.PDF = pdf_1.PDF;
BrowserRendering.Scrape = scrape_1.Scrape;
BrowserRendering.Screenshot = screenshot_1.Screenshot;
BrowserRendering.Snapshot = snapshot_1.Snapshot;
BrowserRendering.Json = json_1.Json;
BrowserRendering.Links = links_1.Links;
BrowserRendering.Markdown = markdown_1.Markdown;
//# sourceMappingURL=browser-rendering.js.map