import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/templates/error_metadata/main.ts
import { dump, themes } from "@poppinss/dumper/html";
var ErrorMetadata = class extends BaseComponent {
  #primitives = ["string", "boolean", "number", "undefined"];
  /**
   * Formats the error row value
   */
  #formatRowValue(value, dumpValue, cspNonce) {
    if (dumpValue === true) {
      return dump(value, { styles: themes.cssVariables, cspNonce });
    }
    if (this.#primitives.includes(typeof value) || value === null) {
      return value;
    }
    return dump(value, { styles: themes.cssVariables, cspNonce });
  }
  /**
   * Returns HTML fragment with HTML table containing rows
   * metadata section rows
   */
  #renderRows(rows, cspNonce) {
    return `<table class="card-table">
      <tbody>
        ${rows.map((row) => {
      return `<tr>
              <td class="table-key">${row.key}</td>
              <td class="table-value">
                ${this.#formatRowValue(row.value, row.dump, cspNonce)}
              </td>
            </tr>`;
    }).join("\n")}
      </tbody>
    </table>`;
  }
  /**
   * Renders each section with its rows inside a table
   */
  #renderSection(section, rows, cspNonce) {
    return `<div>
      <h4 class="card-subtitle">${section}</h4>
      ${Array.isArray(rows) ? this.#renderRows(rows, cspNonce) : `<span>${this.#formatRowValue(rows.value, rows.dump, cspNonce)}</span>`}
    </div>`;
  }
  /**
   * Renders each group as a card
   */
  #renderGroup(group, sections, cspNonce) {
    return `<section>
      <div class="card">
        <div class="card-heading">
          <h3 class="card-title">${group}</h3>
        </div>
        <div class="card-body">
          ${Object.keys(sections).map((section) => this.#renderSection(section, sections[section], cspNonce)).join("\n")}
        </div>
      </div>
    </section>`;
  }
  /**
   * The toHTML method is used to output the HTML for the
   * web view
   */
  async toHTML(props) {
    const groups = props.metadata.toJSON();
    const groupsNames = Object.keys(groups);
    if (!groupsNames.length) {
      return "";
    }
    return groupsNames.map((group) => this.#renderGroup(group, groups[group], props.cspNonce)).join("\n");
  }
  /**
   * The toANSI method is used to output the text for the console
   */
  async toANSI() {
    return "";
  }
};

export {
  ErrorMetadata
};
