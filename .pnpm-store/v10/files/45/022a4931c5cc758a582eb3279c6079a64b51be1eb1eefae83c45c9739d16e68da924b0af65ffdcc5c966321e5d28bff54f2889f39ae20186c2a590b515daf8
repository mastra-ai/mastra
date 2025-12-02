// src/component.ts
import { readFile } from "fs/promises";
var BaseComponent = class {
  #cachedStyles;
  #cachedScript;
  /**
   * A flag to know if we are in dev mode or not. In dev mode,
   * the styles and scripts are refetched from the disk.
   * Otherwise they are cached.
   */
  #inDevMode;
  /**
   * Absolute path to the frontend JavaScript that should be
   * injected within the HTML head. The JavaScript does not
   * get transpiled, hence it should work cross browser by
   * default.
   */
  scriptFile;
  /**
   * Absolute path to the CSS file that should be injected
   * within the HTML head.
   */
  cssFile;
  constructor(devMode) {
    this.#inDevMode = devMode;
  }
  /**
   * Returns the styles for the component. The null value
   * is not returned if no styles are associated with
   * the component
   */
  async getStyles() {
    if (!this.cssFile) {
      return null;
    }
    if (this.#inDevMode) {
      return await readFile(this.cssFile, "utf-8");
    }
    this.#cachedStyles = this.#cachedStyles ?? await readFile(this.cssFile, "utf-8");
    return this.#cachedStyles;
  }
  /**
   * Returns the frontend script for the component. The null
   * value is not returned if no styles are associated
   * with the component
   */
  async getScript() {
    if (!this.scriptFile) {
      return null;
    }
    if (this.#inDevMode) {
      return await readFile(this.scriptFile, "utf-8");
    }
    this.#cachedScript = this.#cachedScript ?? await readFile(this.scriptFile, "utf-8");
    return this.#cachedScript;
  }
};

export {
  BaseComponent
};
