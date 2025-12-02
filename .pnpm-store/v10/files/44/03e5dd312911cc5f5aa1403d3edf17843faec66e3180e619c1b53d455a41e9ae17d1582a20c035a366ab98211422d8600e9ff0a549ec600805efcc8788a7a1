import {
  Layout
} from "./chunk-VE4LENUR.js";
import {
  ErrorInfo
} from "./chunk-3X66E37A.js";
import {
  ErrorCause
} from "./chunk-PINJDICN.js";
import {
  ErrorMetadata
} from "./chunk-HFSXRSKS.js";
import {
  ErrorStack
} from "./chunk-JAN2TFI2.js";
import {
  ErrorStackSource
} from "./chunk-4XB2BYKC.js";
import "./chunk-4L7RY2JA.js";
import {
  Header
} from "./chunk-PUHGL6HA.js";
import "./chunk-OSUFJZHZ.js";
import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/youch.ts
import cookie from "cookie";
import { ErrorParser } from "youch-core";

// src/metadata.ts
var Metadata = class {
  #groups = {};
  /**
   * Converts value to an array (if not an array already)
   */
  #toArray(value) {
    return Array.isArray(value) ? value : [value];
  }
  /**
   * Define a group, its sections and their rows. In case of
   * existing groups/sections, the new data will be merged
   * with the existing data
   */
  group(name, sections) {
    this.#groups[name] = this.#groups[name] ?? {};
    Object.keys(sections).forEach((section) => {
      if (!this.#groups[name][section]) {
        this.#groups[name][section] = sections[section];
      } else {
        this.#groups[name][section] = this.#toArray(this.#groups[name][section]);
        this.#groups[name][section].push(...this.#toArray(sections[section]));
      }
    });
    return this;
  }
  /**
   * Returns the existing metadata groups, sections and
   * rows.
   */
  toJSON() {
    return this.#groups;
  }
};

// src/templates.ts
import { createScript, createStyleSheet } from "@poppinss/dumper/html";
var Templates = class {
  constructor(devMode) {
    this.devMode = devMode;
    this.#knownTemplates = {
      layout: new Layout(devMode),
      header: new Header(devMode),
      errorInfo: new ErrorInfo(devMode),
      errorStack: new ErrorStack(devMode),
      errorStackSource: new ErrorStackSource(devMode),
      errorCause: new ErrorCause(devMode),
      errorMetadata: new ErrorMetadata(devMode)
    };
  }
  #knownTemplates;
  #styles = /* @__PURE__ */ new Map([["global", createStyleSheet()]]);
  #scripts = /* @__PURE__ */ new Map([["global", createScript()]]);
  /**
   * Returns a collection of style and script tags to dump
   * inside the document HEAD.
   */
  #getStylesAndScripts(cspNonce) {
    let customInjectedStyles = "";
    const styles = [];
    const scripts = [];
    const cspNonceAttr = cspNonce ? ` nonce="${cspNonce}"` : "";
    this.#styles.forEach((bucket, name) => {
      if (name === "injected") {
        customInjectedStyles = `<style id="${name}-styles"${cspNonceAttr}>${bucket}</style>`;
      } else {
        styles.push(`<style id="${name}-styles"${cspNonceAttr}>${bucket}</style>`);
      }
    });
    this.#scripts.forEach((bucket, name) => {
      scripts.push(`<script id="${name}-script"${cspNonceAttr}>${bucket}</script>`);
    });
    return { styles: `${styles.join("\n")}
${customInjectedStyles}`, scripts: scripts.join("\n") };
  }
  /**
   * Collects styles and scripts for components as we render
   * them.
   */
  async #collectStylesAndScripts(templateName) {
    if (!this.#styles.has(templateName)) {
      const styles = await this.#knownTemplates[templateName].getStyles();
      if (styles) {
        this.#styles.set(templateName, styles);
      }
    }
    if (!this.#scripts.has(templateName)) {
      const script = await this.#knownTemplates[templateName].getScript();
      if (script) {
        this.#scripts.set(templateName, script);
      }
    }
  }
  /**
   * Returns the HTML for a given template
   */
  async #tmplToHTML(templateName, props) {
    const component = this.#knownTemplates[templateName];
    if (!component) {
      throw new Error(`Invalid template "${templateName}"`);
    }
    await this.#collectStylesAndScripts(templateName);
    return component.toHTML(props);
  }
  /**
   * Returns the ANSI output for a given template
   */
  async #tmplToANSI(templateName, props) {
    const component = this.#knownTemplates[templateName];
    if (!component) {
      throw new Error(`Invalid template "${templateName}"`);
    }
    return component.toANSI(props);
  }
  /**
   * Define a custom component to be used in place of the default component.
   * Overriding components allows you control the HTML layout, styles and
   * the frontend scripts of an HTML fragment.
   */
  use(templateName, component) {
    this.#knownTemplates[templateName] = component;
    return this;
  }
  /**
   * Inject custom styles to the document. Injected styles are
   * always placed after the global and the components style
   * tags.
   */
  injectStyles(cssFragment) {
    let injectedStyles = this.#styles.get("injected") ?? "";
    injectedStyles += `
${cssFragment}`;
    this.#styles.set("injected", injectedStyles);
    return this;
  }
  /**
   * Returns the HTML output for the given parsed error
   */
  async toHTML(props) {
    const html = await this.#tmplToHTML("layout", {
      title: props.title,
      ide: props.ide,
      cspNonce: props.cspNonce,
      children: async () => {
        const header = await this.#tmplToHTML("header", props);
        const info = await this.#tmplToHTML("errorInfo", props);
        const stackTrace = await this.#tmplToHTML("errorStack", {
          ide: process.env.EDITOR ?? "vscode",
          sourceCodeRenderer: (error, frame) => {
            return this.#tmplToHTML("errorStackSource", {
              error,
              frame,
              ide: props.ide,
              cspNonce: props.cspNonce
            });
          },
          ...props
        });
        const cause = await this.#tmplToHTML("errorCause", props);
        const metadata = await this.#tmplToHTML("errorMetadata", props);
        return `${header}${info}${stackTrace}${cause}${metadata}`;
      }
    });
    const { scripts, styles } = this.#getStylesAndScripts(props.cspNonce);
    return html.replace("<!-- STYLES -->", styles).replace("<!-- SCRIPTS -->", scripts);
  }
  /**
   * Returns the ANSI output to be printed on the terminal
   */
  async toANSI(props) {
    const ansiOutput = await this.#tmplToANSI("layout", {
      title: props.title,
      children: async () => {
        const header = await this.#tmplToANSI("header", {});
        const info = await this.#tmplToANSI("errorInfo", props);
        const stackTrace = await this.#tmplToANSI("errorStack", {
          ide: process.env.EDITOR ?? "vscode",
          sourceCodeRenderer: (error, frame) => {
            return this.#tmplToANSI("errorStackSource", {
              error,
              frame
            });
          },
          ...props
        });
        const cause = await this.#tmplToANSI("errorCause", props);
        const metadata = await this.#tmplToANSI("errorMetadata", props);
        return `${header}${info}${stackTrace}${cause}${metadata}`;
      }
    });
    return ansiOutput;
  }
};

// src/youch.ts
var Youch = class {
  /**
   * Properties to be shared with the Error parser
   */
  #sourceLoader;
  #parsers = [];
  #transformers = [];
  /**
   * Manage templates used for converting error to the HTML
   * output
   */
  templates = new Templates(false);
  /**
   * Define metadata to be displayed alongside the error output
   */
  metadata = new Metadata();
  /**
   * Creates an instance of the ErrorParser and applies the
   * source loader, parsers and transformers on it
   */
  #createErrorParser(options) {
    const errorParser = new ErrorParser(options);
    if (this.#sourceLoader) {
      errorParser.defineSourceLoader(this.#sourceLoader);
    }
    this.#parsers.forEach((parser) => errorParser.useParser(parser));
    this.#transformers.forEach((transformer) => errorParser.useTransformer(transformer));
    return errorParser;
  }
  /**
   * Defines the request properties as a metadata group
   */
  #defineRequestMetadataGroup(request) {
    if (!request || Object.keys(request).length === 0) {
      return;
    }
    this.metadata.group("Request", {
      ...request.url ? {
        url: {
          key: "URL",
          value: request.url
        }
      } : {},
      ...request.method ? {
        method: {
          key: "Method",
          value: request.method
        }
      } : {},
      ...request.headers ? {
        headers: Object.keys(request.headers).map((key) => {
          const value = request.headers[key];
          return {
            key,
            value: key === "cookie" ? { ...cookie.parse(value) } : value
          };
        })
      } : {}
    });
  }
  /**
   * Define custom implementation for loading the source code
   * of a stack frame.
   */
  defineSourceLoader(loader) {
    this.#sourceLoader = loader;
    return this;
  }
  /**
   * Define a custom parser. Parsers are executed before the
   * error gets parsed and provides you with an option to
   * modify the error
   */
  useParser(parser) {
    this.#parsers.push(parser);
    return this;
  }
  /**
   * Define a custom transformer. Transformers are executed
   * after the error has been parsed and can mutate the
   * properties of the parsed error.
   */
  useTransformer(transformer) {
    this.#transformers.push(transformer);
    return this;
  }
  /**
   * Parses error to JSON
   */
  async toJSON(error, options) {
    options = { ...options };
    return this.#createErrorParser({ offset: options.offset }).parse(error);
  }
  /**
   * Render error to HTML
   */
  async toHTML(error, options) {
    options = { ...options };
    this.#defineRequestMetadataGroup(options.request);
    const parsedError = await this.#createErrorParser({ offset: options.offset }).parse(error);
    return this.templates.toHTML({
      title: options.title ?? "An error has occurred",
      ide: options.ide ?? process.env.IDE ?? "vscode",
      cspNonce: options.cspNonce,
      error: parsedError,
      metadata: this.metadata
    });
  }
  /**
   * Render error to ANSI output
   */
  async toANSI(error, options) {
    options = { ...options };
    const parsedError = await this.#createErrorParser({ offset: options.offset }).parse(error);
    return this.templates.toANSI({
      title: "",
      error: parsedError,
      metadata: this.metadata
    });
  }
};
export {
  BaseComponent,
  Metadata,
  Youch
};
