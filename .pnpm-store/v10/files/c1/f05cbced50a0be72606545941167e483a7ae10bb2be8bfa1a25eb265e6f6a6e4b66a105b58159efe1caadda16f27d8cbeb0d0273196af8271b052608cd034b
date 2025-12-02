import {
  Parser,
  htmlEscape,
  wordWrap
} from "../../chunk-26HALFTP.js";

// formatters/html/themes.ts
var themes = {
  nightOwl: {
    pre: "background-color: #061626; color: #c792ea;",
    toggle: "color: #4f5357; background: none; border: none;",
    braces: "color: #ffd700;",
    brackets: "color: #ffd700;",
    number: "color: #f78c6c;",
    bigInt: "color: #f78c6c; font-weight: bold;",
    boolean: "color: #ff5874; font-style: italic;",
    string: "color: #ecc48d;",
    null: "color: #637777;",
    undefined: "color: #637777;",
    prototypeLabel: "color: #637777;",
    symbol: "color: #82aaff;",
    regex: "color: #ff5874;",
    date: "color: #7fdbca;",
    buffer: "color: #7fdbca;",
    functionLabel: "color: #89b4fa;",
    arrayLabel: "color: #82aaff;",
    objectLabel: "color: #82aaff;",
    mapLabel: "color: #82aaff;",
    setLabel: "color: #82aaff;",
    objectKey: "color: #c792ea;",
    objectKeyPrefix: "color: #637777; font-style: italic; font-weight: bold",
    classLabel: "color: #82aaff;",
    collapseLabel: "color: #7fdbca; font-style: italic;",
    getterLabel: "color: #7fdbca;",
    circularLabel: "color: #7fdbca;",
    weakSetLabel: "color: #7fdbca;",
    weakRefLabel: "color: #7fdbca;",
    weakMapLabel: "color: #7fdbca;",
    observableLabel: "color: #7fdbca;",
    promiseLabel: "color: #7fdbca;",
    generatorLabel: "color: #7fdbca;",
    blobLabel: "color: #7fdbca;",
    unknownLabel: "color: #7fdbca;"
  },
  minLight: {
    pre: "background-color: #fff; color: #212121;",
    toggle: "color: #989999; background: none; border: none;",
    braces: "color: #0431fa;",
    brackets: "color: #0431fa;",
    number: "color: #1976d2;",
    bigInt: "color: #1976d2; font-weight: bold;",
    boolean: "color: #1976d2; font-style: italic;",
    string: "color: #22863a;",
    null: "color: #9c9c9d;",
    undefined: "color: #9c9c9d;",
    prototypeLabel: "color: #9c9c9d;",
    symbol: "color: #d32f2f;",
    regex: "color: #1976d2;",
    date: "color: #7b3814;",
    buffer: "color: #7b3814;",
    functionLabel: "color: #6f42c1;",
    arrayLabel: "color: #d32f2f;",
    objectLabel: "color: #d32f2f;",
    mapLabel: "color: #d32f2f;",
    setLabel: "color: #d32f2f;",
    objectKey: "color: #212121;",
    objectKeyPrefix: "color: #9c9c9d; font-style: italic; font-weight: bold",
    classLabel: "color: #6f42c1;",
    collapseLabel: "color: #9c9c9d; font-style: italic;",
    getterLabel: "color: #7b3814;",
    circularLabel: "color: #7b3814;",
    weakSetLabel: "color: #7b3814;",
    weakRefLabel: "color: #7b3814;",
    weakMapLabel: "color: #7b3814;",
    observableLabel: "color: #7b3814;",
    promiseLabel: "color: #7b3814;",
    generatorLabel: "color: #7b3814;",
    blobLabel: "color: #7b3814;",
    unknownLabel: "color: #7b3814;"
  },
  catppuccin: {
    pre: "background-color: #1e1e2e; color: #94e2d5;",
    toggle: "color: #7c7c8c; background: none; border: none;",
    braces: "color: #f38ba8;",
    brackets: "color: #f38ba8;",
    number: "color: #fab387;",
    bigInt: "color: #fab387; font-weight: bold;",
    boolean: "color: #cba6f7; font-style: italic;",
    string: "color: #a6e3a1;",
    null: "color: #6c7086;",
    undefined: "color: #6c7086;",
    prototypeLabel: "color: #6c7086;",
    symbol: "color: #f9e2af;",
    regex: "color: #cba6f7;",
    date: "color: #94e2d5;",
    buffer: "color: #94e2d5;",
    functionLabel: "color: #cba6f7;",
    arrayLabel: "color: #f9e2af;",
    objectLabel: "color: #f9e2af;",
    mapLabel: "color: #f9e2af;",
    setLabel: "color: #f9e2af;",
    objectKey: "color: #89b4fa;",
    objectKeyPrefix: "color: #6c7086; font-style: italic; font-weight: bold",
    classLabel: "color: #cba6f7;",
    collapseLabel: "color: #6c7086; font-style: italic;",
    getterLabel: "color: #94e2d5;",
    circularLabel: "color: #94e2d5;",
    weakSetLabel: "color: #94e2d5;",
    weakRefLabel: "color: #94e2d5;",
    weakMapLabel: "color: #94e2d5;",
    observableLabel: "color: #94e2d5;",
    promiseLabel: "color: #94e2d5;",
    generatorLabel: "color: #94e2d5;",
    blobLabel: "color: #94e2d5;",
    unknownLabel: "color: #94e2d5;"
  },
  /**
   * Following is the list of defined variables
    --pre-bg-color
    --pre-fg-color
    --toggle-fg-color
    --braces-fg-color
    --brackets-fg-color
    --dt-number-fg-color
    --dt-bigint-fg-color
    --dt-boolean-fg-color
    --dt-string-fg-color
    --dt-null-fg-color
    --dt-undefined-fg-color
    --prototype-label-fg-color
    --dt-symbol-fg-color
    --dt-regex-fg-color
    --dt-date-fg-color
    --dt-buffer-fg-color
    --function-label-fg-color
    --array-label-fg-color
    --object-label-fg-color
    --map-label-fg-color
    --set-label-fg-color
    --object-key-fg-color
    --object-key-prefix-fg-color
    --class-label-fg-color
    --collpase-label-fg-color
    --getter-label-fg-color
    --circular-label-fg-color
    --weakset-label-fg-color
    --weakref-label-fg-color
    --weakmap-label-fg-color
    --observable-label-fg-color
    --promise-label-fg-color
    --generator-label-fg-color
    --blob-label-fg-color
    --unknown-label-fg-color
   */
  cssVariables: {
    pre: "background-color: var(--pre-bg-color); color: var(--pre-fg-color);",
    toggle: "color: var(--toggle-fg-color); background: none; border: none;",
    braces: "color: var(--braces-fg-color);",
    brackets: "color: var(--brackets-fg-color);",
    number: "color: var(--dt-number-fg-color);",
    bigInt: "color: var(--dt-bigint-fg-color); font-weight: bold;",
    boolean: "color: var(--dt-boolean-fg-color); font-style: italic;",
    string: "color: var(--dt-string-fg-color);",
    null: "color: var(--dt-null-fg-color);",
    undefined: "color: var(--dt-undefined-fg-color);",
    prototypeLabel: "color: var(--prototype-label-fg-color);",
    symbol: "color: var(--dt-symbol-fg-color);",
    regex: "color: var(--dt-regex-fg-color);",
    date: "color: var(--dt-date-fg-color);",
    buffer: "color: var(--dt-buffer-fg-color);",
    functionLabel: "color: var(--function-label-fg-color);",
    arrayLabel: "color: var(--array-label-fg-color);",
    objectLabel: "color: var(--object-label-fg-color);",
    mapLabel: "color: var(--map-label-fg-color);",
    setLabel: "color: var(--set-label-fg-color);",
    objectKey: "color: var(--object-key-fg-color);",
    objectKeyPrefix: "color: var(--object-key-prefix-fg-color); font-style: italic; font-weight: bold",
    classLabel: "color: var(--class-label-fg-color);",
    collapseLabel: "color: var(--collpase-label-fg-color); font-style: italic;",
    getterLabel: "color: var(--getter-label-fg-color);",
    circularLabel: "color: var(--circular-label-fg-color);",
    weakSetLabel: "color: var(--weakset-label-fg-color);",
    weakRefLabel: "color: var(--weakref-label-fg-color);",
    weakMapLabel: "color: var(--weakmap-label-fg-color);",
    observableLabel: "color: var(--observable-label-fg-color);",
    promiseLabel: "color: var(--promise-label-fg-color);",
    generatorLabel: "color: var(--generator-label-fg-color);",
    blobLabel: "color: var(--blob-label-fg-color);",
    unknownLabel: "color: var(--unknown-label-fg-color);"
  }
};

// formatters/html/printers/main.ts
var dropdownIcon = "&#9660;";
function openingBrace(formatter) {
  return `<span style="${formatter.styles.braces}">{</span>`;
}
function closingBrace(formatter) {
  return `<span style="${formatter.styles.braces}">}</span>`;
}
function openingBrackets(formatter) {
  return `<span style="${formatter.styles.brackets}">[</span>`;
}
function closingBrackets(formatter) {
  return `<span style="${formatter.styles.brackets}">]</span>`;
}
var HTMLPrinters = {
  "collapse": (token, formatter) => {
    const styles = token.token.type === "object-start" ? formatter.styles.objectLabel : formatter.styles.arrayLabel;
    const collpaseStyles = formatter.styles.collapseLabel;
    return `<span style="${styles}">${token.name}</span> ` + (token.token.type === "object-start" ? openingBrace(formatter) : openingBrackets(formatter)) + ` <span style="${collpaseStyles}">collapsed</span> ` + (token.token.type === "object-start" ? closingBrace(formatter) : closingBrackets(formatter));
  },
  "object-start": (token, formatter) => {
    formatter.indentation.increment();
    const styles = formatter.styles.objectLabel;
    const toggleStyles = formatter.styles.toggle;
    const label = formatter.context.isStaticMember && formatter.context.staticDepth === 0 ? " " : `${token.constructorName || "Object [null]"} `;
    return `<span class="dumper-group dumper-object-group"><span style="${styles}">${label}</span>` + openingBrace(formatter) + `<button class="dumper-toggle" style="${toggleStyles}"><span>${dropdownIcon}</span></button><samp hidden="true">`;
  },
  "object-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + "</samp>" + closingBrace(formatter) + "</span>";
  },
  "object-key": (token, formatter) => {
    formatter.context.isStack = token.value === "stack";
    const styles = formatter.styles.objectKey;
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    let value = token.value;
    if (token.isSymbol) {
      value = `[${value}]`;
    } else if (!/^[a-z$_][$\w]*$/i.test(value)) {
      value = `"${htmlEscape(value.replace(/"/g, '\\"'))}"`;
    }
    let prefix = "";
    if (formatter.context.isStaticMember) {
      formatter.context.staticDepth++;
      if (formatter.context.staticDepth === 1) {
        const prefixStyles = formatter.styles.objectKeyPrefix;
        prefix = `<span class="dumper-object-prefix" style="${prefixStyles}">static </span>`;
      }
    }
    return indent + prefix + `<span class="dumper-object-key" style="${styles}">${value}</span>: `;
  },
  "object-circular-ref": (_, formatter) => {
    const styles = formatter.styles.circularLabel;
    return `<span style="${styles}">[*Circular]</span>`;
  },
  "object-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.objectLabel;
    return `<span style="${styles}">[Object]</span>`;
  },
  "object-value-getter": (_, formatter) => {
    const styles = formatter.styles.getterLabel;
    return `<span style="${styles}">[Getter]</span>`;
  },
  "object-value-start": () => {
    return "";
  },
  "object-value-end": (_, formatter) => {
    if (formatter.context.isStaticMember) {
      formatter.context.staticDepth--;
    }
    return `,`;
  },
  "array-start": (token, formatter) => {
    formatter.indentation.increment();
    const toggleStyles = formatter.styles.toggle;
    const styles = formatter.styles.arrayLabel;
    const label = `${token.name}:${token.size} `;
    return `<span class="dumper-group dumper-array-group"><span style="${styles}">${label}</span>` + openingBrackets(formatter) + `<button class="dumper-toggle" style="${toggleStyles}"><span>${dropdownIcon}</span></button><samp hidden="true">`;
  },
  "array-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + "</samp>" + closingBrackets(formatter) + "</span>";
  },
  "array-value-start": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent;
  },
  "array-value-hole": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.undefined;
    return indent + `<span class="dumper-undefined" style="${styles}">${htmlEscape("<hole>")},</span>`;
  },
  "array-value-end": () => {
    return `,`;
  },
  "array-circular-ref": (_, formatter) => {
    const styles = formatter.styles.circularLabel;
    return `<span style="${styles}">[*Circular]</span>`;
  },
  "array-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.arrayLabel;
    return `<span style="${styles}">[Array]</span>`;
  },
  "array-max-length-ref": (token, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.arrayLabel;
    const itemsLeft = token.size - token.limit;
    if (itemsLeft <= 0) {
      return "";
    }
    const label = itemsLeft === 1 ? `1 more item` : `${itemsLeft} more items`;
    return `${indent}<span style="${styles}">[...${label}]</span>`;
  },
  "prototype-start": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    formatter.indentation.increment();
    const styles = formatter.styles.prototypeLabel;
    const toggleStyles = formatter.styles.toggle;
    const label = "[[Prototype]] ";
    return indent + `<span class="dumper-group dumper-prototype-group"><span style="${styles}">${label}</span>` + openingBrace(formatter) + `<button class="dumper-toggle" style="${toggleStyles}"><span>${dropdownIcon}</span></button><samp hidden="true">`;
  },
  "prototype-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + "</samp>" + closingBrace(formatter) + "</span>";
  },
  "map-start": (token, formatter) => {
    formatter.indentation.increment();
    const toggleStyles = formatter.styles.toggle;
    const styles = formatter.styles.mapLabel;
    const label = `Map:${token.size} `;
    return `<span class="dumper-group dumper-map-group"><span style="${styles}">${label}</span>` + openingBrace(formatter) + `<button class="dumper-toggle" style="${toggleStyles}"><span>${dropdownIcon}</span></button><samp hidden="true">`;
  },
  "map-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + "</samp>" + closingBrace(formatter) + "</span>";
  },
  "map-row-start": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    formatter.indentation.increment();
    return indent + openingBrackets(formatter);
  },
  "map-row-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + closingBrackets(formatter) + `,`;
  },
  "map-key-start": (_, formatter) => {
    const styles = formatter.styles.objectKey;
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + `<span style="${styles}">key</span>: `;
  },
  "map-key-end": function() {
    return "";
  },
  "map-value-start": (_, formatter) => {
    const styles = formatter.styles.objectKey;
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + `<span style="${styles}">value</span>: `;
  },
  "map-value-end": function() {
    return "";
  },
  "map-circular-ref": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.circularLabel;
    return `${indent}<span style="${styles}">[*Circular]</span>`;
  },
  "map-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.mapLabel;
    return `<span style="${styles}">[Map]</span>`;
  },
  "map-max-length-ref": (token, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.mapLabel;
    const itemsLeft = token.size - token.limit;
    if (itemsLeft <= 0) {
      return "";
    }
    const label = itemsLeft === 1 ? `1 more item` : `${itemsLeft} more items`;
    return `${indent}<span style="${styles}">[...${label}]</span>`;
  },
  "set-start": (token, formatter) => {
    formatter.indentation.increment();
    const toggleStyles = formatter.styles.toggle;
    const styles = formatter.styles.setLabel;
    const label = `Set:${token.size} `;
    return `<span class="dumper-group dumper-set-group"><span class="dumper-set-label" style="${styles}">${label}</span>` + openingBrackets(formatter) + `<button class="dumper-toggle" style="${toggleStyles}"><span>${dropdownIcon}</span></button><samp hidden="true">`;
  },
  "set-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + "</samp>" + closingBrackets(formatter) + "</span>";
  },
  "set-value-start": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent;
  },
  "set-value-end": () => {
    return `,`;
  },
  "set-circular-ref": (_, formatter) => {
    const styles = formatter.styles.circularLabel;
    return `<span style="${styles}">[*Circular]</span>`;
  },
  "set-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.setLabel;
    return `<span style="${styles}">[Set]</span>`;
  },
  "set-max-length-ref": (token, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.setLabel;
    const itemsLeft = token.size - token.limit;
    if (itemsLeft <= 0) {
      return "";
    }
    const label = itemsLeft === 1 ? `1 more item` : `${itemsLeft} more items`;
    return `${indent}<span style="${styles}">[...${label}]</span>`;
  },
  "string": (token, formatter) => {
    let value = token.value;
    const indent = formatter.indentation.getSpaces();
    if (formatter.context.isStack) {
      value = token.value.split("\n").map((row, index) => {
        let rowValue = `<span>${htmlEscape(row.trim())}</span>`;
        if (index > 0) {
          rowValue = `${indent}${rowValue}`;
        }
        return rowValue;
      }).join("\n");
    } else {
      value = wordWrap(token.value, {
        newLine: formatter.newLine,
        indent: formatter.indentation.getSpaces(),
        width: 70
      });
    }
    const styles = formatter.styles.string;
    return `<span class="dumper-string" style="${styles}">${value}</span>`;
  },
  "boolean": (token, formatter) => {
    const styles = formatter.styles.boolean;
    return `<span class="dumper-boolean" style="${styles}">` + token.value + "</span>";
  },
  "number": (token, formatter) => {
    const styles = formatter.styles.number;
    return `<span class="dumper-number" style="${styles}">` + token.value + "</span>";
  },
  "bigInt": (token, formatter) => {
    const styles = formatter.styles.bigInt;
    return `<span class="dumper-big-int" style="${styles}">` + token.value + "</span>";
  },
  "undefined": (_, formatter) => {
    const styles = formatter.styles.undefined;
    return `<span class="dumper-undefined" style="${styles}">undefined</span>`;
  },
  "null": (_, formatter) => {
    const styles = formatter.styles.null;
    return `<span class="dumper-null" style="${styles}">null</span>`;
  },
  "symbol": (token, formatter) => {
    const styles = formatter.styles.symbol;
    return `<span class="dumper-symbol" style="${styles}">` + token.value + "</span>";
  },
  "function": (token, formatter) => {
    const className = token.isClass ? "dumper-class" : "dumper-function";
    const styles = token.isClass ? formatter.styles.classLabel : formatter.styles.functionLabel;
    const async = token.isAsync ? `async ` : "";
    const generator = token.isGenerator ? `*` : "";
    const label = token.isClass ? `[class ${token.name}]` : `[${async}${generator}function ${token.name}]`;
    return `<span class="${className}" style="${styles}">` + label + "</span>";
  },
  "date": function(token, formatter) {
    const styles = formatter.styles.date;
    return `<span class="dumper-date" style="${styles}">` + token.value + "</span>";
  },
  "buffer": function(token, formatter) {
    const styles = formatter.styles.buffer;
    return `<span class="dumper-buffer" style="${styles}">` + htmlEscape(token.value) + "</span>";
  },
  "regexp": function(token, formatter) {
    const styles = formatter.styles.regex;
    return `<span class="dumper-regex" style="${styles}">` + token.value + "</span>";
  },
  "unknown": function(token, formatter) {
    const styles = formatter.styles.unknownLabel;
    return `<span class="dumper-value-unknown" style="${styles}">` + String(token.value) + "</span>";
  },
  "weak-set": function(_, formatter) {
    const styles = formatter.styles.weakSetLabel;
    return `<span class="dumper-weak-set" style="${styles}">[WeakSet]</span>`;
  },
  "weak-ref": function(_, formatter) {
    const styles = formatter.styles.weakRefLabel;
    return `<span class="dumper-weak-ref" style="${styles}">[WeakRef]</span>`;
  },
  "weak-map": function(_, formatter) {
    const styles = formatter.styles.weakMapLabel;
    return `<span class="dumper-weak-map" style="${styles}">[WeakMap]</span>`;
  },
  "observable": function(_, formatter) {
    const styles = formatter.styles.observableLabel;
    return `<span class="dumper-observable" style="${styles}">[Observable]</span>`;
  },
  "blob": function(token, formatter) {
    const styles = formatter.styles.objectLabel;
    const propertiesStart = `<span styles="${formatter.styles.braces}">{ `;
    const propertiesEnd = `<span styles="${formatter.styles.braces}"> }</span></span>`;
    const sizeProp = `<span styles="${formatter.styles.objectKey}">size: </span>`;
    const sizeValue = `<span styles="${formatter.styles.number}">${token.size}</span>,`;
    const typeProp = `<span styles="${formatter.styles.objectKey}">type: </span>`;
    const typeValue = `<span styles="${formatter.styles.string}">${token.contentType}</span>`;
    return `<span class="dumper-blob" style="${styles}">[Blob]` + propertiesStart + `${sizeProp}${sizeValue} ${typeProp}${typeValue}` + propertiesEnd + "</span>";
  },
  "promise": function(token, formatter) {
    const styles = formatter.styles.promiseLabel;
    const label = token.isFulfilled ? "resolved" : "pending";
    return `<span class="dumper-promise" style="${styles}">[Promise${htmlEscape(`<${label}>`)}]</span>`;
  },
  "generator": function(token, formatter) {
    const styles = formatter.styles.generatorLabel;
    const label = token.isAsync ? "[AsyncGenerator] {}" : "[Generator] {}";
    return `<span class="dumper-generator" style="${styles}">` + label + "</span>";
  },
  "static-members-start": function(_, formatter) {
    formatter.context.isStaticMember = true;
    formatter.context.staticDepth = 0;
    return "";
  },
  "static-members-end": function(_, formatter) {
    formatter.context.isStaticMember = false;
    formatter.context.staticDepth = 0;
    return "";
  }
};

// formatters/html/formatter.ts
var seed = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
var nanoid = (length = 15) => {
  let output = "";
  let random = new Uint8Array(length);
  if (globalThis.crypto) {
    crypto.getRandomValues(random);
  } else {
    for (let i = 0; i < length; i++) {
      random[i] = Math.floor(Math.random() * 256);
    }
  }
  for (let n = 0; n < length; n++) {
    output += seed[63 & random[n]];
  }
  return output;
};
var HTMLFormatter = class {
  #config;
  /**
   * Styles for output elements
   */
  styles;
  /**
   * Context maintained through out the printing
   * phase. Each instance has its own context
   * that gets mutated internally.
   */
  context;
  /**
   * Value for the newline character
   */
  newLine = "\n";
  /**
   * Utility to manage indentation
   */
  indentation = {
    counter: 0,
    /**
     * Increment the identation by 1 step
     */
    increment() {
      this.counter++;
    },
    /**
     * Decrement the identation by 1 step
     */
    decrement() {
      this.counter--;
    },
    /**
     * Get the identation spaces as per the current
     * identation level
     */
    getSpaces() {
      return new Array(this.counter * 2 + 1).join("&nbsp;");
    }
  };
  constructor(config, context) {
    this.context = context || {};
    this.#config = config || {};
    this.styles = Object.freeze({ ...themes.nightOwl, ...config?.styles });
  }
  /**
   * Wraps the final output inside pre tags and add the script
   * to activate the frontend iteractions.
   */
  #wrapOutput(code) {
    const id = `dump-${nanoid()}`;
    const expand = this.#config.expand === "all" ? `'all'` : this.#config.expand;
    const nonce = this.#config.cspNonce ? ` nonce="${this.#config.cspNonce}"` : "";
    return `<div id="${id}" class="dumper-dump"><pre style="${this.styles.pre}"><code>${code}</code></pre><script${nonce}>dumperActivate('${id}', ${expand})</script></div>`;
  }
  /**
   * Format a collection of tokens to HTML output wrapped
   * inside the `pre` tag.
   */
  format(tokens) {
    return this.#wrapOutput(
      tokens.map((token) => {
        const formatter = HTMLPrinters[token.type];
        return formatter(token, this) || "";
      }).join("")
    );
  }
};

// formatters/html/head.ts
function createStyleSheet() {
  return `.dumper-dump, .dumper-dump pre, .dumper-dump code, .dumper-dump samp {
  font-family: JetBrains Mono, monaspace argon, Menlo, Monaco, Consolas, monospace;
}
.dumper-dump pre {
  line-height: 24px;
  font-size: 15px;
  overflow-x: scroll;
  position:relative;
  z-index:99999;
  padding: 10px 15px;
  margin: 0;
}
.dumper-dump pre samp {
  position: relative;
}
.dumper-dump pre samp[hidden="true"] {
  display: none;
}
.dumper-dump .dumper-prototype-group {
  opacity: 0.5;
}

.dumper-dump .dumper-toggle {
   transform: rotate(270deg);
}

.dumper-dump .dumper-toggle span {
  display: inline-block;
  position: relative;
  top: 1px;
  margin: 0 5px;
  font-size: 14px;
}
.dumper-dump .dumper-toggle[aria-expanded="true"] {
  transform: none;
}`;
}
function createScript() {
  return `function expandGroup(group) {
  const trigger = group.querySelector('button')
  trigger.setAttribute('aria-expanded', 'true')

  const samp = group.querySelector('samp')
  samp.removeAttribute('hidden')
}

function collapseGroup(group) {
  const trigger = group.querySelector('button')
  trigger.removeAttribute('aria-expanded', 'true')

  const samp = group.querySelector('samp')
  samp.setAttribute('hidden', 'true')
}

function dumperActivate(dumpId, expand) {
  if (expand === true) {
    expandGroup(document.querySelector(\`#\${dumpId} .dumper-group\`))
  } else if (expand === 'all') {
    document.querySelectorAll(\`#\${dumpId} .dumper-group\`).forEach((c) => expandGroup(c))
  }

  document.querySelectorAll(\`#\${dumpId} .dumper-toggle\`).forEach((trigger) => {
    trigger.addEventListener('click', function (event) {
      const target = event.currentTarget
      const parent = target.parentElement
      const isExpanded = !!target.getAttribute('aria-expanded')

      if (isExpanded) {
        collapseGroup(parent)
        if (event.metaKey) {
          parent.querySelectorAll('.dumper-group').forEach((c) => collapseGroup(c))
        }
      } else {
        expandGroup(parent)
        if (event.metaKey) {
          parent.querySelectorAll('.dumper-group').forEach((c) => expandGroup(c))
        }
      }
    })
  })
}`;
}

// formatters/html/main.ts
function dump(value, config) {
  const parser = new Parser(config);
  parser.parse(value);
  return new HTMLFormatter(config).format(parser.flush());
}
export {
  HTMLFormatter,
  HTMLPrinters,
  createScript,
  createStyleSheet,
  dump,
  themes
};
