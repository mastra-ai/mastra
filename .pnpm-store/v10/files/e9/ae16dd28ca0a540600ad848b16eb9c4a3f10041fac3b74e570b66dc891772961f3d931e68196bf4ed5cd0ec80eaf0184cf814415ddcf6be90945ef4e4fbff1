import {
  Parser,
  wordWrap
} from "../../chunk-26HALFTP.js";

// formatters/console/themes.ts
import useColors from "@poppinss/colors";
import supportsColor from "supports-color";
var colors = supportsColor.stdout ? useColors.ansi() : useColors.silent();
var themes = {
  default: {
    braces: (value) => colors.yellow(value),
    brackets: (value) => colors.yellow(value),
    number: (value) => colors.yellow(value),
    bigInt: (value) => colors.yellow().bold(value),
    boolean: (value) => colors.yellow().italic(value),
    string: (value) => colors.green(value),
    null: (value) => colors.dim(value),
    undefined: (value) => colors.dim(value),
    prototypeLabel: (value) => colors.dim(value),
    symbol: (value) => colors.magenta(value),
    regex: (value) => colors.red(value),
    date: (value) => colors.magenta(value),
    buffer: (value) => colors.magenta(value),
    functionLabel: (value) => colors.cyan().italic(value),
    arrayLabel: (value) => colors.cyan(value),
    objectLabel: (value) => colors.cyan(value),
    mapLabel: (value) => colors.cyan(value),
    setLabel: (value) => colors.cyan(value),
    objectKey: (value) => colors.blue(value),
    objectKeyPrefix: (value) => colors.dim(value),
    classLabel: (value) => colors.cyan(value),
    weakSetLabel: (value) => colors.cyan(value),
    weakRefLabel: (value) => colors.cyan(value),
    collapseLabel: (value) => colors.dim(value),
    circularLabel: (value) => colors.cyan(value),
    getterLabel: (value) => colors.cyan(value),
    weakMapLabel: (value) => colors.cyan(value),
    observableLabel: (value) => colors.cyan(value),
    promiseLabel: (value) => colors.blue(value),
    generatorLabel: (value) => colors.cyan(value),
    blobLabel: (value) => colors.magenta(value),
    unknownLabel: (value) => colors.magenta(value)
  }
};

// formatters/console/printers/main.ts
function openingBrace(formatter) {
  return formatter.styles.braces("{");
}
function closingBrace(formatter) {
  return formatter.styles.braces("}");
}
function openingBrackets(formatter) {
  return formatter.styles.brackets("[");
}
function closingBrackets(formatter) {
  return formatter.styles.brackets("]");
}
var ConsolePrinters = {
  "collapse": (token, formatter) => {
    const styles = token.token.type === "object-start" ? formatter.styles.objectLabel : formatter.styles.arrayLabel;
    const collpaseStyles = formatter.styles.collapseLabel;
    return `${styles(token.name)} ` + (token.token.type === "object-start" ? openingBrace(formatter) : openingBrackets(formatter)) + ` ${collpaseStyles("collpased")} ` + (token.token.type === "object-start" ? closingBrace(formatter) : closingBrackets(formatter));
  },
  "object-start": (token, formatter) => {
    formatter.indentation.increment();
    const styles = formatter.styles.objectLabel;
    const label = formatter.context.isStaticMember && formatter.context.staticDepth === 0 || token.constructorName === "Object" ? "" : styles(`${token.constructorName || "Object [null]"}`) + " ";
    return label + openingBrace(formatter);
  },
  "object-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + closingBrace(formatter);
  },
  "object-key": (token, formatter) => {
    formatter.context.isStack = token.value === "stack";
    const styles = formatter.styles.objectKey;
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    let value = token.value;
    if (token.isSymbol) {
      value = `[${value}]`;
    }
    let prefix = "";
    if (formatter.context.isStaticMember) {
      formatter.context.staticDepth++;
      if (formatter.context.staticDepth === 1) {
        const prefixStyles = formatter.styles.objectKeyPrefix;
        prefix = `${prefixStyles("static")} `;
      }
    }
    return indent + prefix + styles(value) + ": ";
  },
  "object-circular-ref": (_, formatter) => {
    const styles = formatter.styles.circularLabel;
    return styles("[*Circular]");
  },
  "object-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.objectLabel;
    return styles("[Object]");
  },
  "object-value-getter": (_, formatter) => {
    const styles = formatter.styles.getterLabel;
    return styles("[Getter]");
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
    const styles = formatter.styles.arrayLabel;
    const label = token.name !== "Array" ? styles(`${token.name}`) + " " : "";
    return label + openingBrackets(formatter);
  },
  "array-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + closingBrackets(formatter);
  },
  "array-value-start": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent;
  },
  "array-value-hole": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.undefined;
    return indent + styles("<hole>") + ",";
  },
  "array-value-end": () => {
    return `,`;
  },
  "array-circular-ref": (_, formatter) => {
    const styles = formatter.styles.circularLabel;
    return styles("[*Circular]");
  },
  "array-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.arrayLabel;
    return styles("[Array]");
  },
  "array-max-length-ref": (token, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.arrayLabel;
    const itemsLeft = token.size - token.limit;
    if (itemsLeft <= 0) {
      return "";
    }
    const label = itemsLeft === 1 ? `1 more item` : `${itemsLeft} more items`;
    return indent + styles(`[...${label}]`);
  },
  "prototype-start": (_, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    formatter.indentation.increment();
    const styles = formatter.styles.prototypeLabel;
    const label = "[[Prototype]] ";
    return indent + styles(label) + openingBrace(formatter);
  },
  "prototype-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + closingBrace(formatter);
  },
  "map-start": (token, formatter) => {
    formatter.indentation.increment();
    const styles = formatter.styles.mapLabel;
    const label = `Map(${token.size}) `;
    return styles(label) + openingBrace(formatter);
  },
  "map-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + closingBrace(formatter);
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
    return indent + styles("key") + ": ";
  },
  "map-key-end": function() {
    return ",";
  },
  "map-value-start": (_, formatter) => {
    const styles = formatter.styles.objectKey;
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + styles("value") + ": ";
  },
  "map-value-end": function() {
    return ",";
  },
  "map-circular-ref": (_, formatter) => {
    const styles = formatter.styles.circularLabel;
    return styles("[*Circular]");
  },
  "map-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.mapLabel;
    return styles("[Map]");
  },
  "map-max-length-ref": (token, formatter) => {
    const styles = formatter.styles.mapLabel;
    const itemsLeft = token.size - token.limit;
    if (itemsLeft <= 0) {
      return "";
    }
    const label = itemsLeft === 1 ? `1 more item` : `${itemsLeft} more items`;
    return styles(`[...${label}]`);
  },
  "set-start": (token, formatter) => {
    formatter.indentation.increment();
    const styles = formatter.styles.setLabel;
    const label = `Set(${token.size}) `;
    return styles(label) + openingBrackets(formatter);
  },
  "set-end": (_, formatter) => {
    formatter.indentation.decrement();
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    return indent + closingBrackets(formatter);
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
    return styles("[*Circular]");
  },
  "set-max-depth-ref": (_, formatter) => {
    const styles = formatter.styles.setLabel;
    return styles("[Set]");
  },
  "set-max-length-ref": (token, formatter) => {
    const indent = `${formatter.newLine}${formatter.indentation.getSpaces()}`;
    const styles = formatter.styles.setLabel;
    const itemsLeft = token.size - token.limit;
    if (itemsLeft <= 0) {
      return "";
    }
    const label = itemsLeft === 1 ? `1 more item` : `${itemsLeft} more items`;
    return indent + styles(`[...${label}]`);
  },
  "string": (token, formatter) => {
    let value = token.value;
    const indent = formatter.indentation.getSpaces();
    if (formatter.context.isStack) {
      value = token.value.split("\n").map((row, index) => {
        let rowValue = row.trim();
        if (index > 0) {
          rowValue = `${indent}${rowValue}`;
        }
        return rowValue;
      }).join("\n");
    } else {
      value = wordWrap(token.value, {
        newLine: formatter.newLine,
        indent: formatter.indentation.getSpaces(),
        width: 70,
        escape: (line) => line
      });
    }
    const styles = formatter.styles.string;
    return styles(value);
  },
  "boolean": (token, formatter) => {
    const styles = formatter.styles.boolean;
    return styles(String(token.value));
  },
  "number": (token, formatter) => {
    const styles = formatter.styles.number;
    return styles(String(token.value));
  },
  "bigInt": (token, formatter) => {
    const styles = formatter.styles.bigInt;
    return styles(token.value);
  },
  "undefined": (_, formatter) => {
    const styles = formatter.styles.undefined;
    return styles("undefined");
  },
  "null": (_, formatter) => {
    const styles = formatter.styles.null;
    return styles("null");
  },
  "symbol": (token, formatter) => {
    const styles = formatter.styles.symbol;
    return styles(token.value);
  },
  "function": (token, formatter) => {
    const styles = token.isClass ? formatter.styles.classLabel : formatter.styles.functionLabel;
    const async = token.isAsync ? `async ` : "";
    const generator = token.isGenerator ? `*` : "";
    const label = token.isClass ? `[class ${token.name}]` : `[${async}${generator}function ${token.name}]`;
    return styles(label);
  },
  "date": function(token, formatter) {
    const styles = formatter.styles.date;
    return styles(token.value);
  },
  "buffer": function(token, formatter) {
    const styles = formatter.styles.buffer;
    return styles(token.value);
  },
  "regexp": function(token, formatter) {
    const styles = formatter.styles.regex;
    return styles(token.value);
  },
  "unknown": function(token, formatter) {
    const styles = formatter.styles.unknownLabel;
    return styles(String(token.value));
  },
  "weak-set": function(_, formatter) {
    const styles = formatter.styles.weakSetLabel;
    return styles("[WeakSet]");
  },
  "weak-ref": function(_, formatter) {
    const styles = formatter.styles.weakRefLabel;
    return styles("[WeakRef]");
  },
  "weak-map": function(_, formatter) {
    const styles = formatter.styles.weakMapLabel;
    return styles("[WeakMap]");
  },
  "observable": function(_, formatter) {
    const styles = formatter.styles.observableLabel;
    return styles("[Observable]");
  },
  "blob": function(token, formatter) {
    const styles = formatter.styles.objectLabel;
    const sizeProp = formatter.styles.objectKey("size: ");
    const sizeValue = formatter.styles.number(`${token.size}`);
    const typeProp = token.contentType ? `, ${formatter.styles.objectKey("type: ")}` : "";
    const typeValue = token.contentType ? formatter.styles.string(`${token.contentType}`) : "";
    return styles("[Blob]") + " " + openingBrace(formatter) + `${sizeProp}${sizeValue}${typeProp}${typeValue}` + closingBrace(formatter);
  },
  "promise": function(token, formatter) {
    const styles = formatter.styles.promiseLabel;
    const label = token.isFulfilled ? "resolved" : "pending";
    return styles(`[Promise${`<${label}>`}]`);
  },
  "generator": function(token, formatter) {
    const styles = formatter.styles.generatorLabel;
    const label = token.isAsync ? "[AsyncGenerator] {}" : "[Generator] {}";
    return styles(label);
  },
  "static-members-start": function(_, formatter) {
    formatter.context.isStaticMember = true;
    formatter.context.staticDepth = 0;
    return " ";
  },
  "static-members-end": function(_, formatter) {
    formatter.context.isStaticMember = false;
    formatter.context.staticDepth = 0;
    return "";
  }
};

// formatters/console/formatter.ts
var ConsoleFormatter = class {
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
      return new Array(this.counter * 2 + 1).join(" ");
    }
  };
  constructor(config, context) {
    this.context = context || {};
    this.styles = Object.freeze({ ...themes.default, ...config?.styles });
  }
  /**
   * Format a collection of tokens to ANSI output
   */
  format(tokens) {
    return tokens.map((token) => {
      const formatter = ConsolePrinters[token.type];
      return formatter(token, this) || "";
    }).join("");
  }
};

// formatters/console/main.ts
function dump(value, config) {
  const parser = new Parser(config);
  parser.parse(value);
  return new ConsoleFormatter(config).format(parser.flush());
}
export {
  ConsoleFormatter,
  ConsolePrinters,
  dump,
  themes
};
