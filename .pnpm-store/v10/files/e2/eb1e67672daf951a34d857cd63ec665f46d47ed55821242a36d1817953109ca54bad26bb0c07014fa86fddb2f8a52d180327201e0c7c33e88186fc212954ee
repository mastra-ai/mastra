import {
  colors,
  stripAnsi
} from "./chunk-4L7RY2JA.js";
import {
  publicDirURL
} from "./chunk-OSUFJZHZ.js";
import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/templates/error_stack_source/main.ts
import { extname } from "path";
import { highlightText } from "@speed-highlight/core";
import { highlightText as cliHighlightText } from "@speed-highlight/core/terminal";
var GUTTER = "\u2503";
var POINTER = "\u276F";
var LANGS_MAP = {
  ".tsx": "ts",
  ".jsx": "js",
  ".js": "js",
  ".ts": "ts",
  ".css": "css",
  ".json": "json",
  ".html": "html",
  ".astro": "ts",
  ".vue": "ts"
};
var ErrorStackSource = class extends BaseComponent {
  cssFile = new URL("./error_stack_source/style.css", publicDirURL);
  /**
   * The toHTML method is used to output the HTML for the
   * web view
   */
  async toHTML(props) {
    const frame = props.frame;
    if (frame.type === "native" || !frame.source || !frame.fileName) {
      return "";
    }
    const language = LANGS_MAP[extname(frame.fileName)] ?? "plain";
    const highlightMarginTop = `${frame.source.findIndex((chunk) => {
      return chunk.lineNumber === frame.lineNumber;
    }) * 24}px`;
    const highlight = `<div class="line-highlight" style="margin-top: ${highlightMarginTop}"></div>`;
    let code = await highlightText(
      frame.source.map((chunk) => chunk.chunk).join("\n"),
      language,
      true
    );
    code = code.replace(
      '<div class="shj-numbers">',
      `<div class="shj-numbers" style="counter-set: line ${frame.source[0].lineNumber - 1}">`
    );
    return `<pre><code class="shj-lang-js">${highlight}${code}</code></pre>`;
  }
  /**
   * The toANSI method is used to output the text for the console
   */
  async toANSI(props) {
    const frame = props.frame;
    if (frame.type === "native" || !frame.source || !frame.fileName) {
      return "";
    }
    const language = LANGS_MAP[extname(frame.fileName)] ?? "plain";
    const largestLineNumber = Math.max(...frame.source.map(({ lineNumber }) => lineNumber));
    const lineNumberCols = String(largestLineNumber).length;
    const code = frame.source.map(({ chunk }) => chunk).join("\n");
    const highlighted = await cliHighlightText(code, language);
    return `

${highlighted.split("\n").map((line, index) => {
      const lineNumber = frame.source[index].lineNumber;
      const alignedLineNumber = String(lineNumber).padStart(lineNumberCols, " ");
      if (lineNumber === props.frame.lineNumber) {
        return ` ${colors.bgRed(`${POINTER} ${alignedLineNumber} ${GUTTER}  ${stripAnsi(line)}`)}`;
      }
      return `   ${colors.dim(alignedLineNumber)} ${colors.dim(GUTTER)}  ${line}`;
    }).join("\n")}
`;
  }
};

export {
  ErrorStackSource
};
