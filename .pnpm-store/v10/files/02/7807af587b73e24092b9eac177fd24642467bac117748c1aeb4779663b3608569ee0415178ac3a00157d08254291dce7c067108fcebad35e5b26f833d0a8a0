import {
  colors,
  htmlEscape
} from "./chunk-4L7RY2JA.js";
import {
  publicDirURL
} from "./chunk-OSUFJZHZ.js";
import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/templates/error_stack/main.ts
import { dump, themes } from "@poppinss/dumper/html";
import { dump as dumpCli } from "@poppinss/dumper/console";
var CHEVIRON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" width="24" height="24" stroke-width="2">
  <path d="M6 9l6 6l6 -6"></path>
</svg>`;
var EDITORS = {
  textmate: "txmt://open?url=file://%f&line=%l",
  macvim: "mvim://open?url=file://%f&line=%l",
  emacs: "emacs://open?url=file://%f&line=%l",
  sublime: "subl://open?url=file://%f&line=%l",
  phpstorm: "phpstorm://open?file=%f&line=%l",
  atom: "atom://core/open/file?filename=%f&line=%l",
  vscode: "vscode://file/%f:%l"
};
var ErrorStack = class extends BaseComponent {
  cssFile = new URL("./error_stack/style.css", publicDirURL);
  scriptFile = new URL("./error_stack/script.js", publicDirURL);
  /**
   * Returns the file's relative name from the CWD
   */
  #getRelativeFileName(filePath) {
    return filePath.replace(`${process.cwd()}/`, "");
  }
  /**
   * Returns the index of the frame that should be expanded by
   * default
   */
  #getFirstExpandedFrameIndex(frames) {
    let expandAtIndex = frames.findIndex((frame) => frame.type === "app");
    if (expandAtIndex === -1) {
      expandAtIndex = frames.findIndex((frame) => frame.type === "module");
    }
    return expandAtIndex;
  }
  /**
   * Returns the link to open the file within known code
   * editors
   */
  #getEditorLink(ide, frame) {
    const editorURL = EDITORS[ide] || ide;
    if (!editorURL || frame.type === "native") {
      return {
        text: this.#getRelativeFileName(frame.fileName)
      };
    }
    return {
      href: editorURL.replace("%f", frame.fileName).replace("%l", String(frame.lineNumber)),
      text: this.#getRelativeFileName(frame.fileName)
    };
  }
  /**
   * Returns the HTML fragment for the frame location
   */
  #renderFrameLocation(frame, ide) {
    const { text, href } = this.#getEditorLink(ide, frame);
    const fileName = `<a${href ? ` href="${href}"` : ""} class="stack-frame-filepath" title="${text}">
      ${htmlEscape(text)}
    </a>`;
    const functionName = frame.functionName ? `<span>in <code title="${frame.functionName}">
        ${htmlEscape(frame.functionName)}
      </code></span>` : "";
    const loc = `<span>at line <code>${frame.lineNumber}:${frame.columnNumber}</code></span>`;
    if (frame.type !== "native" && frame.source) {
      return `<button class="stack-frame-location">
        ${fileName} ${functionName} ${loc}
      </button>`;
    }
    return `<div class="stack-frame-location">
      ${fileName} ${functionName} ${loc}
    </div>`;
  }
  /**
   * Returns HTML fragment for the stack frame
   */
  async #renderStackFrame(frame, index, expandAtIndex, props) {
    const label = frame.type === "app" ? '<span class="frame-label">In App</span>' : "";
    const expandedClass = expandAtIndex === index ? " expanded" : "";
    const toggleButton = frame.type !== "native" && frame.source ? `<button class="stack-frame-toggle-indicator">${CHEVIRON}</button>` : "";
    return `<li class="stack-frame stack-frame-${frame.type}${expandedClass}">
      <div class="stack-frame-contents">
        ${this.#renderFrameLocation(frame, props.ide)}
        <div class="stack-frame-extras">
          ${label}
          ${toggleButton}
        </div>
      </div>
      <div class="stack-frame-source">
        ${await props.sourceCodeRenderer(props.error, frame)}
      </div>
    </li>`;
  }
  /**
   * Returns the ANSI output to print the stack frame on the
   * terminal
   */
  async #printStackFrame(frame, index, expandAtIndex, props) {
    const fileName = this.#getRelativeFileName(frame.fileName);
    const loc = `${fileName}:${frame.lineNumber}:${frame.columnNumber}`;
    if (index === expandAtIndex) {
      const functionName2 = frame.functionName ? `at ${frame.functionName} ` : "";
      const codeSnippet = await props.sourceCodeRenderer(props.error, frame);
      return ` \u2043 ${functionName2}${colors.yellow(`(${loc})`)}${codeSnippet}`;
    }
    if (frame.type === "native") {
      const functionName2 = frame.functionName ? `at ${colors.italic(frame.functionName)} ` : "";
      return colors.dim(` \u2043 ${functionName2}(${colors.italic(loc)})`);
    }
    const functionName = frame.functionName ? `at ${frame.functionName} ` : "";
    return ` \u2043 ${functionName}${colors.yellow(`(${loc})`)}`;
  }
  /**
   * The toHTML method is used to output the HTML for the
   * web view
   */
  async toHTML(props) {
    const frames = await Promise.all(
      props.error.frames.map((frame, index) => {
        return this.#renderStackFrame(
          frame,
          index,
          this.#getFirstExpandedFrameIndex(props.error.frames),
          props
        );
      })
    );
    return `<section>
      <div class="card">
        <div class="card-heading">
          <div>
            <h3 class="card-title">
              Stack Trace
            </h3>
          </div>
        </div>
        <div class="card-body">
          <div id="stack-frames-wrapper">
            <div id="stack-frames-header">
              <div id="all-frames-toggle-wrapper">
                <label id="all-frames-toggle">
                  <input type="checkbox" />
                  <span> View All Frames </span>
                </label>
              </div>

              <div>
                <div class="toggle-switch">
                  <button id="formatted-frames-toggle" class="active"> Pretty </button>
                  <button id="raw-frames-toggle"> Raw </button>
                </div>
              </div>
            </div>

            <div id="stack-frames-body">
              <div id="stack-frames-formatted" class="visible">
                <ul id="stack-frames">
                  ${frames.join("\n")}
                </ul>
              </div>
              <div id="stack-frames-raw">
                ${dump(props.error.raw, {
      styles: themes.cssVariables,
      expand: true,
      cspNonce: props.cspNonce,
      inspectObjectPrototype: false,
      inspectStaticMembers: false,
      inspectArrayPrototype: false
    })}
              </div>
            </div>
          <div>
        </div>
      </div>
    </section>`;
  }
  /**
   * The toANSI method is used to output the text for the console
   */
  async toANSI(props) {
    const displayRaw = process.env.YOUCH_RAW;
    if (displayRaw) {
      const depth = Number.isNaN(Number(displayRaw)) ? 2 : Number(displayRaw);
      return `

${colors.red("[RAW]")}
${dumpCli(props.error.raw, {
        depth,
        inspectObjectPrototype: false,
        inspectStaticMembers: false,
        inspectArrayPrototype: false
      })}`;
    }
    const frames = await Promise.all(
      props.error.frames.map((frame, index) => {
        return this.#printStackFrame(
          frame,
          index,
          this.#getFirstExpandedFrameIndex(props.error.frames),
          props
        );
      })
    );
    return `

${frames.join("\n")}`;
  }
};

export {
  ErrorStack
};
