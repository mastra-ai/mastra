import {
  publicDirURL
} from "./chunk-OSUFJZHZ.js";
import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/templates/layout/main.ts
var Layout = class extends BaseComponent {
  cssFile = new URL("./layout/style.css", publicDirURL);
  scriptFile = new URL("./layout/script.js", publicDirURL);
  /**
   * The toHTML method is used to output the HTML for the
   * web view
   */
  async toHTML(props) {
    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${props.title}</title>
        <!-- STYLES -->
        <!-- SCRIPTS -->
      </head>
      <body>
        <div id="layout">
          ${await props.children()}
        </div>
      </body>
    </html>`;
  }
  /**
   * The toANSI method is used to output the text for the console
   */
  async toANSI(props) {
    return `
${await props.children()}
`;
  }
};

export {
  Layout
};
