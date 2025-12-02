import {
  colors
} from "./chunk-4L7RY2JA.js";
import {
  publicDirURL
} from "./chunk-OSUFJZHZ.js";
import {
  BaseComponent
} from "./chunk-4YEN7HVQ.js";

// src/templates/error_cause/main.ts
import { dump, themes } from "@poppinss/dumper/html";
import { dump as dumpCli } from "@poppinss/dumper/console";
var ErrorCause = class extends BaseComponent {
  cssFile = new URL("./error_cause/style.css", publicDirURL);
  /**
   * The toHTML method is used to output the HTML for the
   * web view
   */
  async toHTML(props) {
    if (!props.error.cause) {
      return "";
    }
    return `<section>
      <div class="card">
        <div class="card-heading">
          <div>
            <h3 class="card-title">
              Error Cause
            </h3>
          </div>
        </div>
        <div class="card-body">
          <div id="error-cause">
            ${dump(props.error.cause, {
      cspNonce: props.cspNonce,
      styles: themes.cssVariables,
      inspectObjectPrototype: false,
      inspectStaticMembers: false,
      inspectArrayPrototype: false
    })}
          </div>
        </div>
      </div>
    </section>`;
  }
  /**
   * The toANSI method is used to output the text for the console
   */
  async toANSI(props) {
    if (!props.error.cause) {
      return "";
    }
    let depth = process.env.YOUCH_CAUSE ? Number(process.env.YOUCH_CAUSE) : 2;
    if (Number.isNaN(depth)) {
      depth = 2;
    }
    return `

${colors.red("[CAUSE]")}
${dumpCli(props.error.cause, {
      depth,
      inspectObjectPrototype: false,
      inspectStaticMembers: false,
      inspectArrayPrototype: false
    })}`;
  }
};

export {
  ErrorCause
};
