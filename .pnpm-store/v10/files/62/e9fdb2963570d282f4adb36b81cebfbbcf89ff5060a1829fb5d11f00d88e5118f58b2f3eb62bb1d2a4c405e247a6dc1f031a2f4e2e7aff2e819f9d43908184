import {
  publicDirURL
} from "./chunk-OSUFJZHZ.js";
import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/templates/header/main.ts
var DARK_MODE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" stroke="none"/><path d="M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z"/></svg>`;
var LIGHT_MODE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" stroke="none"/><circle cx="12" cy="12" r="4"/><path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/></svg>`;
var Header = class extends BaseComponent {
  cssFile = new URL("./header/style.css", publicDirURL);
  scriptFile = new URL("./header/script.js", publicDirURL);
  /**
   * The toHTML method is used to output the HTML for the
   * web view
   */
  async toHTML() {
    return `<header id="header">
      <div id="header-actions">
        <div id="toggle-theme-container">
          <input type="checkbox" id="toggle-theme-checkbox" />
          <label id="toggle-theme-label" for="toggle-theme-checkbox">
            <span id="light-theme-indicator" title="Light mode">${LIGHT_MODE_SVG}</span>
            <span id="dark-theme-indicator" title="Dark mode">${DARK_MODE_SVG}</span>
          </label>
        </div>
      </div>
    </header>`;
  }
  /**
   * The toANSI method is used to output the text for the console
   */
  async toANSI() {
    return "";
  }
};

export {
  Header
};
