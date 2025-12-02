import "./chunk-D6YTI3O5.mjs";

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/version.mjs
var version = "16.9.0";
var versionInfo = Object.freeze({
  major: 16,
  minor: 9,
  patch: 0,
  preReleaseTag: null
});

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/devAssert.mjs
function devAssert(condition, message) {
  const booleanCondition = Boolean(condition);
  if (!booleanCondition) {
    throw new Error(message);
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/isPromise.mjs
function isPromise(value) {
  return typeof (value === null || value === void 0 ? void 0 : value.then) === "function";
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/isObjectLike.mjs
function isObjectLike(value) {
  return typeof value == "object" && value !== null;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/invariant.mjs
function invariant(condition, message) {
  const booleanCondition = Boolean(condition);
  if (!booleanCondition) {
    throw new Error(
      message != null ? message : "Unexpected invariant triggered."
    );
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/location.mjs
var LineRegExp = /\r\n|[\n\r]/g;
function getLocation(source, position) {
  let lastLineStart = 0;
  let line = 1;
  for (const match of source.body.matchAll(LineRegExp)) {
    typeof match.index === "number" || invariant(false);
    if (match.index >= position) {
      break;
    }
    lastLineStart = match.index + match[0].length;
    line += 1;
  }
  return {
    line,
    column: position + 1 - lastLineStart
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/printLocation.mjs
function printLocation(location) {
  return printSourceLocation(
    location.source,
    getLocation(location.source, location.start)
  );
}
function printSourceLocation(source, sourceLocation) {
  const firstLineColumnOffset = source.locationOffset.column - 1;
  const body = "".padStart(firstLineColumnOffset) + source.body;
  const lineIndex = sourceLocation.line - 1;
  const lineOffset = source.locationOffset.line - 1;
  const lineNum = sourceLocation.line + lineOffset;
  const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
  const columnNum = sourceLocation.column + columnOffset;
  const locationStr = `${source.name}:${lineNum}:${columnNum}
`;
  const lines = body.split(/\r\n|[\n\r]/g);
  const locationLine = lines[lineIndex];
  if (locationLine.length > 120) {
    const subLineIndex = Math.floor(columnNum / 80);
    const subLineColumnNum = columnNum % 80;
    const subLines = [];
    for (let i = 0; i < locationLine.length; i += 80) {
      subLines.push(locationLine.slice(i, i + 80));
    }
    return locationStr + printPrefixedLines([
      [`${lineNum} |`, subLines[0]],
      ...subLines.slice(1, subLineIndex + 1).map((subLine) => ["|", subLine]),
      ["|", "^".padStart(subLineColumnNum)],
      ["|", subLines[subLineIndex + 1]]
    ]);
  }
  return locationStr + printPrefixedLines([
    // Lines specified like this: ["prefix", "string"],
    [`${lineNum - 1} |`, lines[lineIndex - 1]],
    [`${lineNum} |`, locationLine],
    ["|", "^".padStart(columnNum)],
    [`${lineNum + 1} |`, lines[lineIndex + 1]]
  ]);
}
function printPrefixedLines(lines) {
  const existingLines = lines.filter(([_, line]) => line !== void 0);
  const padLen = Math.max(...existingLines.map(([prefix]) => prefix.length));
  return existingLines.map(([prefix, line]) => prefix.padStart(padLen) + (line ? " " + line : "")).join("\n");
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/error/GraphQLError.mjs
function toNormalizedOptions(args) {
  const firstArg = args[0];
  if (firstArg == null || "kind" in firstArg || "length" in firstArg) {
    return {
      nodes: firstArg,
      source: args[1],
      positions: args[2],
      path: args[3],
      originalError: args[4],
      extensions: args[5]
    };
  }
  return firstArg;
}
var GraphQLError = class _GraphQLError extends Error {
  /**
   * An array of `{ line, column }` locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  /**
   * The original error thrown from a field resolver during execution.
   */
  /**
   * Extension fields to add to the formatted error.
   */
  /**
   * @deprecated Please use the `GraphQLErrorOptions` constructor overload instead.
   */
  constructor(message, ...rawArgs) {
    var _this$nodes, _nodeLocations$, _ref;
    const { nodes, source, positions, path, originalError, extensions } = toNormalizedOptions(rawArgs);
    super(message);
    this.name = "GraphQLError";
    this.path = path !== null && path !== void 0 ? path : void 0;
    this.originalError = originalError !== null && originalError !== void 0 ? originalError : void 0;
    this.nodes = undefinedIfEmpty(
      Array.isArray(nodes) ? nodes : nodes ? [nodes] : void 0
    );
    const nodeLocations = undefinedIfEmpty(
      (_this$nodes = this.nodes) === null || _this$nodes === void 0 ? void 0 : _this$nodes.map((node) => node.loc).filter((loc) => loc != null)
    );
    this.source = source !== null && source !== void 0 ? source : nodeLocations === null || nodeLocations === void 0 ? void 0 : (_nodeLocations$ = nodeLocations[0]) === null || _nodeLocations$ === void 0 ? void 0 : _nodeLocations$.source;
    this.positions = positions !== null && positions !== void 0 ? positions : nodeLocations === null || nodeLocations === void 0 ? void 0 : nodeLocations.map((loc) => loc.start);
    this.locations = positions && source ? positions.map((pos) => getLocation(source, pos)) : nodeLocations === null || nodeLocations === void 0 ? void 0 : nodeLocations.map((loc) => getLocation(loc.source, loc.start));
    const originalExtensions = isObjectLike(
      originalError === null || originalError === void 0 ? void 0 : originalError.extensions
    ) ? originalError === null || originalError === void 0 ? void 0 : originalError.extensions : void 0;
    this.extensions = (_ref = extensions !== null && extensions !== void 0 ? extensions : originalExtensions) !== null && _ref !== void 0 ? _ref : /* @__PURE__ */ Object.create(null);
    Object.defineProperties(this, {
      message: {
        writable: true,
        enumerable: true
      },
      name: {
        enumerable: false
      },
      nodes: {
        enumerable: false
      },
      source: {
        enumerable: false
      },
      positions: {
        enumerable: false
      },
      originalError: {
        enumerable: false
      }
    });
    if (originalError !== null && originalError !== void 0 && originalError.stack) {
      Object.defineProperty(this, "stack", {
        value: originalError.stack,
        writable: true,
        configurable: true
      });
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _GraphQLError);
    } else {
      Object.defineProperty(this, "stack", {
        value: Error().stack,
        writable: true,
        configurable: true
      });
    }
  }
  get [Symbol.toStringTag]() {
    return "GraphQLError";
  }
  toString() {
    let output = this.message;
    if (this.nodes) {
      for (const node of this.nodes) {
        if (node.loc) {
          output += "\n\n" + printLocation(node.loc);
        }
      }
    } else if (this.source && this.locations) {
      for (const location of this.locations) {
        output += "\n\n" + printSourceLocation(this.source, location);
      }
    }
    return output;
  }
  toJSON() {
    const formattedError = {
      message: this.message
    };
    if (this.locations != null) {
      formattedError.locations = this.locations;
    }
    if (this.path != null) {
      formattedError.path = this.path;
    }
    if (this.extensions != null && Object.keys(this.extensions).length > 0) {
      formattedError.extensions = this.extensions;
    }
    return formattedError;
  }
};
function undefinedIfEmpty(array) {
  return array === void 0 || array.length === 0 ? void 0 : array;
}
function printError(error) {
  return error.toString();
}
function formatError(error) {
  return error.toJSON();
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/error/syntaxError.mjs
function syntaxError(source, position, description) {
  return new GraphQLError(`Syntax Error: ${description}`, {
    source,
    positions: [position]
  });
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/ast.mjs
var Location = class {
  /**
   * The character offset at which this Node begins.
   */
  /**
   * The character offset at which this Node ends.
   */
  /**
   * The Token at which this Node begins.
   */
  /**
   * The Token at which this Node ends.
   */
  /**
   * The Source document the AST represents.
   */
  constructor(startToken, endToken, source) {
    this.start = startToken.start;
    this.end = endToken.end;
    this.startToken = startToken;
    this.endToken = endToken;
    this.source = source;
  }
  get [Symbol.toStringTag]() {
    return "Location";
  }
  toJSON() {
    return {
      start: this.start,
      end: this.end
    };
  }
};
var Token = class {
  /**
   * The kind of Token.
   */
  /**
   * The character offset at which this Node begins.
   */
  /**
   * The character offset at which this Node ends.
   */
  /**
   * The 1-indexed line number on which this Token appears.
   */
  /**
   * The 1-indexed column number at which this Token begins.
   */
  /**
   * For non-punctuation tokens, represents the interpreted value of the token.
   *
   * Note: is undefined for punctuation tokens, but typed as string for
   * convenience in the parser.
   */
  /**
   * Tokens exist as nodes in a double-linked-list amongst all tokens
   * including ignored tokens. <SOF> is always the first node and <EOF>
   * the last.
   */
  constructor(kind, start, end, line, column, value) {
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.line = line;
    this.column = column;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
  get [Symbol.toStringTag]() {
    return "Token";
  }
  toJSON() {
    return {
      kind: this.kind,
      value: this.value,
      line: this.line,
      column: this.column
    };
  }
};
var QueryDocumentKeys = {
  Name: [],
  Document: ["definitions"],
  OperationDefinition: [
    "name",
    "variableDefinitions",
    "directives",
    "selectionSet"
  ],
  VariableDefinition: ["variable", "type", "defaultValue", "directives"],
  Variable: ["name"],
  SelectionSet: ["selections"],
  Field: ["alias", "name", "arguments", "directives", "selectionSet"],
  Argument: ["name", "value"],
  FragmentSpread: ["name", "directives"],
  InlineFragment: ["typeCondition", "directives", "selectionSet"],
  FragmentDefinition: [
    "name",
    // Note: fragment variable definitions are deprecated and will removed in v17.0.0
    "variableDefinitions",
    "typeCondition",
    "directives",
    "selectionSet"
  ],
  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ["values"],
  ObjectValue: ["fields"],
  ObjectField: ["name", "value"],
  Directive: ["name", "arguments"],
  NamedType: ["name"],
  ListType: ["type"],
  NonNullType: ["type"],
  SchemaDefinition: ["description", "directives", "operationTypes"],
  OperationTypeDefinition: ["type"],
  ScalarTypeDefinition: ["description", "name", "directives"],
  ObjectTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  FieldDefinition: ["description", "name", "arguments", "type", "directives"],
  InputValueDefinition: [
    "description",
    "name",
    "type",
    "defaultValue",
    "directives"
  ],
  InterfaceTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  UnionTypeDefinition: ["description", "name", "directives", "types"],
  EnumTypeDefinition: ["description", "name", "directives", "values"],
  EnumValueDefinition: ["description", "name", "directives"],
  InputObjectTypeDefinition: ["description", "name", "directives", "fields"],
  DirectiveDefinition: ["description", "name", "arguments", "locations"],
  SchemaExtension: ["directives", "operationTypes"],
  ScalarTypeExtension: ["name", "directives"],
  ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
  InterfaceTypeExtension: ["name", "interfaces", "directives", "fields"],
  UnionTypeExtension: ["name", "directives", "types"],
  EnumTypeExtension: ["name", "directives", "values"],
  InputObjectTypeExtension: ["name", "directives", "fields"]
};
var kindValues = new Set(Object.keys(QueryDocumentKeys));
function isNode(maybeNode) {
  const maybeKind = maybeNode === null || maybeNode === void 0 ? void 0 : maybeNode.kind;
  return typeof maybeKind === "string" && kindValues.has(maybeKind);
}
var OperationTypeNode;
(function(OperationTypeNode2) {
  OperationTypeNode2["QUERY"] = "query";
  OperationTypeNode2["MUTATION"] = "mutation";
  OperationTypeNode2["SUBSCRIPTION"] = "subscription";
})(OperationTypeNode || (OperationTypeNode = {}));

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/directiveLocation.mjs
var DirectiveLocation;
(function(DirectiveLocation2) {
  DirectiveLocation2["QUERY"] = "QUERY";
  DirectiveLocation2["MUTATION"] = "MUTATION";
  DirectiveLocation2["SUBSCRIPTION"] = "SUBSCRIPTION";
  DirectiveLocation2["FIELD"] = "FIELD";
  DirectiveLocation2["FRAGMENT_DEFINITION"] = "FRAGMENT_DEFINITION";
  DirectiveLocation2["FRAGMENT_SPREAD"] = "FRAGMENT_SPREAD";
  DirectiveLocation2["INLINE_FRAGMENT"] = "INLINE_FRAGMENT";
  DirectiveLocation2["VARIABLE_DEFINITION"] = "VARIABLE_DEFINITION";
  DirectiveLocation2["SCHEMA"] = "SCHEMA";
  DirectiveLocation2["SCALAR"] = "SCALAR";
  DirectiveLocation2["OBJECT"] = "OBJECT";
  DirectiveLocation2["FIELD_DEFINITION"] = "FIELD_DEFINITION";
  DirectiveLocation2["ARGUMENT_DEFINITION"] = "ARGUMENT_DEFINITION";
  DirectiveLocation2["INTERFACE"] = "INTERFACE";
  DirectiveLocation2["UNION"] = "UNION";
  DirectiveLocation2["ENUM"] = "ENUM";
  DirectiveLocation2["ENUM_VALUE"] = "ENUM_VALUE";
  DirectiveLocation2["INPUT_OBJECT"] = "INPUT_OBJECT";
  DirectiveLocation2["INPUT_FIELD_DEFINITION"] = "INPUT_FIELD_DEFINITION";
})(DirectiveLocation || (DirectiveLocation = {}));

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/kinds.mjs
var Kind;
(function(Kind2) {
  Kind2["NAME"] = "Name";
  Kind2["DOCUMENT"] = "Document";
  Kind2["OPERATION_DEFINITION"] = "OperationDefinition";
  Kind2["VARIABLE_DEFINITION"] = "VariableDefinition";
  Kind2["SELECTION_SET"] = "SelectionSet";
  Kind2["FIELD"] = "Field";
  Kind2["ARGUMENT"] = "Argument";
  Kind2["FRAGMENT_SPREAD"] = "FragmentSpread";
  Kind2["INLINE_FRAGMENT"] = "InlineFragment";
  Kind2["FRAGMENT_DEFINITION"] = "FragmentDefinition";
  Kind2["VARIABLE"] = "Variable";
  Kind2["INT"] = "IntValue";
  Kind2["FLOAT"] = "FloatValue";
  Kind2["STRING"] = "StringValue";
  Kind2["BOOLEAN"] = "BooleanValue";
  Kind2["NULL"] = "NullValue";
  Kind2["ENUM"] = "EnumValue";
  Kind2["LIST"] = "ListValue";
  Kind2["OBJECT"] = "ObjectValue";
  Kind2["OBJECT_FIELD"] = "ObjectField";
  Kind2["DIRECTIVE"] = "Directive";
  Kind2["NAMED_TYPE"] = "NamedType";
  Kind2["LIST_TYPE"] = "ListType";
  Kind2["NON_NULL_TYPE"] = "NonNullType";
  Kind2["SCHEMA_DEFINITION"] = "SchemaDefinition";
  Kind2["OPERATION_TYPE_DEFINITION"] = "OperationTypeDefinition";
  Kind2["SCALAR_TYPE_DEFINITION"] = "ScalarTypeDefinition";
  Kind2["OBJECT_TYPE_DEFINITION"] = "ObjectTypeDefinition";
  Kind2["FIELD_DEFINITION"] = "FieldDefinition";
  Kind2["INPUT_VALUE_DEFINITION"] = "InputValueDefinition";
  Kind2["INTERFACE_TYPE_DEFINITION"] = "InterfaceTypeDefinition";
  Kind2["UNION_TYPE_DEFINITION"] = "UnionTypeDefinition";
  Kind2["ENUM_TYPE_DEFINITION"] = "EnumTypeDefinition";
  Kind2["ENUM_VALUE_DEFINITION"] = "EnumValueDefinition";
  Kind2["INPUT_OBJECT_TYPE_DEFINITION"] = "InputObjectTypeDefinition";
  Kind2["DIRECTIVE_DEFINITION"] = "DirectiveDefinition";
  Kind2["SCHEMA_EXTENSION"] = "SchemaExtension";
  Kind2["SCALAR_TYPE_EXTENSION"] = "ScalarTypeExtension";
  Kind2["OBJECT_TYPE_EXTENSION"] = "ObjectTypeExtension";
  Kind2["INTERFACE_TYPE_EXTENSION"] = "InterfaceTypeExtension";
  Kind2["UNION_TYPE_EXTENSION"] = "UnionTypeExtension";
  Kind2["ENUM_TYPE_EXTENSION"] = "EnumTypeExtension";
  Kind2["INPUT_OBJECT_TYPE_EXTENSION"] = "InputObjectTypeExtension";
})(Kind || (Kind = {}));

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/characterClasses.mjs
function isWhiteSpace(code) {
  return code === 9 || code === 32;
}
function isDigit(code) {
  return code >= 48 && code <= 57;
}
function isLetter(code) {
  return code >= 97 && code <= 122 || // A-Z
  code >= 65 && code <= 90;
}
function isNameStart(code) {
  return isLetter(code) || code === 95;
}
function isNameContinue(code) {
  return isLetter(code) || isDigit(code) || code === 95;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/blockString.mjs
function dedentBlockStringLines(lines) {
  var _firstNonEmptyLine2;
  let commonIndent = Number.MAX_SAFE_INTEGER;
  let firstNonEmptyLine = null;
  let lastNonEmptyLine = -1;
  for (let i = 0; i < lines.length; ++i) {
    var _firstNonEmptyLine;
    const line = lines[i];
    const indent2 = leadingWhitespace(line);
    if (indent2 === line.length) {
      continue;
    }
    firstNonEmptyLine = (_firstNonEmptyLine = firstNonEmptyLine) !== null && _firstNonEmptyLine !== void 0 ? _firstNonEmptyLine : i;
    lastNonEmptyLine = i;
    if (i !== 0 && indent2 < commonIndent) {
      commonIndent = indent2;
    }
  }
  return lines.map((line, i) => i === 0 ? line : line.slice(commonIndent)).slice(
    (_firstNonEmptyLine2 = firstNonEmptyLine) !== null && _firstNonEmptyLine2 !== void 0 ? _firstNonEmptyLine2 : 0,
    lastNonEmptyLine + 1
  );
}
function leadingWhitespace(str) {
  let i = 0;
  while (i < str.length && isWhiteSpace(str.charCodeAt(i))) {
    ++i;
  }
  return i;
}
function isPrintableAsBlockString(value) {
  if (value === "") {
    return true;
  }
  let isEmptyLine = true;
  let hasIndent = false;
  let hasCommonIndent = true;
  let seenNonEmptyLine = false;
  for (let i = 0; i < value.length; ++i) {
    switch (value.codePointAt(i)) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      case 11:
      case 12:
      case 14:
      case 15:
        return false;
      case 13:
        return false;
      case 10:
        if (isEmptyLine && !seenNonEmptyLine) {
          return false;
        }
        seenNonEmptyLine = true;
        isEmptyLine = true;
        hasIndent = false;
        break;
      case 9:
      case 32:
        hasIndent || (hasIndent = isEmptyLine);
        break;
      default:
        hasCommonIndent && (hasCommonIndent = hasIndent);
        isEmptyLine = false;
    }
  }
  if (isEmptyLine) {
    return false;
  }
  if (hasCommonIndent && seenNonEmptyLine) {
    return false;
  }
  return true;
}
function printBlockString(value, options) {
  const escapedValue = value.replace(/"""/g, '\\"""');
  const lines = escapedValue.split(/\r\n|[\n\r]/g);
  const isSingleLine = lines.length === 1;
  const forceLeadingNewLine = lines.length > 1 && lines.slice(1).every((line) => line.length === 0 || isWhiteSpace(line.charCodeAt(0)));
  const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""');
  const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
  const hasTrailingSlash = value.endsWith("\\");
  const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;
  const printAsMultipleLines = !(options !== null && options !== void 0 && options.minimize) && // add leading and trailing new lines only if it improves readability
  (!isSingleLine || value.length > 70 || forceTrailingNewline || forceLeadingNewLine || hasTrailingTripleQuotes);
  let result = "";
  const skipLeadingNewLine = isSingleLine && isWhiteSpace(value.charCodeAt(0));
  if (printAsMultipleLines && !skipLeadingNewLine || forceLeadingNewLine) {
    result += "\n";
  }
  result += escapedValue;
  if (printAsMultipleLines || forceTrailingNewline) {
    result += "\n";
  }
  return '"""' + result + '"""';
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/tokenKind.mjs
var TokenKind;
(function(TokenKind2) {
  TokenKind2["SOF"] = "<SOF>";
  TokenKind2["EOF"] = "<EOF>";
  TokenKind2["BANG"] = "!";
  TokenKind2["DOLLAR"] = "$";
  TokenKind2["AMP"] = "&";
  TokenKind2["PAREN_L"] = "(";
  TokenKind2["PAREN_R"] = ")";
  TokenKind2["SPREAD"] = "...";
  TokenKind2["COLON"] = ":";
  TokenKind2["EQUALS"] = "=";
  TokenKind2["AT"] = "@";
  TokenKind2["BRACKET_L"] = "[";
  TokenKind2["BRACKET_R"] = "]";
  TokenKind2["BRACE_L"] = "{";
  TokenKind2["PIPE"] = "|";
  TokenKind2["BRACE_R"] = "}";
  TokenKind2["NAME"] = "Name";
  TokenKind2["INT"] = "Int";
  TokenKind2["FLOAT"] = "Float";
  TokenKind2["STRING"] = "String";
  TokenKind2["BLOCK_STRING"] = "BlockString";
  TokenKind2["COMMENT"] = "Comment";
})(TokenKind || (TokenKind = {}));

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/lexer.mjs
var Lexer = class {
  /**
   * The previously focused non-ignored token.
   */
  /**
   * The currently focused non-ignored token.
   */
  /**
   * The (1-indexed) line containing the current token.
   */
  /**
   * The character offset at which the current line begins.
   */
  constructor(source) {
    const startOfFileToken = new Token(TokenKind.SOF, 0, 0, 0, 0);
    this.source = source;
    this.lastToken = startOfFileToken;
    this.token = startOfFileToken;
    this.line = 1;
    this.lineStart = 0;
  }
  get [Symbol.toStringTag]() {
    return "Lexer";
  }
  /**
   * Advances the token stream to the next non-ignored token.
   */
  advance() {
    this.lastToken = this.token;
    const token = this.token = this.lookahead();
    return token;
  }
  /**
   * Looks ahead and returns the next non-ignored token, but does not change
   * the state of Lexer.
   */
  lookahead() {
    let token = this.token;
    if (token.kind !== TokenKind.EOF) {
      do {
        if (token.next) {
          token = token.next;
        } else {
          const nextToken = readNextToken(this, token.end);
          token.next = nextToken;
          nextToken.prev = token;
          token = nextToken;
        }
      } while (token.kind === TokenKind.COMMENT);
    }
    return token;
  }
};
function isPunctuatorTokenKind(kind) {
  return kind === TokenKind.BANG || kind === TokenKind.DOLLAR || kind === TokenKind.AMP || kind === TokenKind.PAREN_L || kind === TokenKind.PAREN_R || kind === TokenKind.SPREAD || kind === TokenKind.COLON || kind === TokenKind.EQUALS || kind === TokenKind.AT || kind === TokenKind.BRACKET_L || kind === TokenKind.BRACKET_R || kind === TokenKind.BRACE_L || kind === TokenKind.PIPE || kind === TokenKind.BRACE_R;
}
function isUnicodeScalarValue(code) {
  return code >= 0 && code <= 55295 || code >= 57344 && code <= 1114111;
}
function isSupplementaryCodePoint(body, location) {
  return isLeadingSurrogate(body.charCodeAt(location)) && isTrailingSurrogate(body.charCodeAt(location + 1));
}
function isLeadingSurrogate(code) {
  return code >= 55296 && code <= 56319;
}
function isTrailingSurrogate(code) {
  return code >= 56320 && code <= 57343;
}
function printCodePointAt(lexer, location) {
  const code = lexer.source.body.codePointAt(location);
  if (code === void 0) {
    return TokenKind.EOF;
  } else if (code >= 32 && code <= 126) {
    const char = String.fromCodePoint(code);
    return char === '"' ? `'"'` : `"${char}"`;
  }
  return "U+" + code.toString(16).toUpperCase().padStart(4, "0");
}
function createToken(lexer, kind, start, end, value) {
  const line = lexer.line;
  const col = 1 + start - lexer.lineStart;
  return new Token(kind, start, end, line, col, value);
}
function readNextToken(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    switch (code) {
      case 65279:
      case 9:
      case 32:
      case 44:
        ++position;
        continue;
      case 10:
        ++position;
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      case 13:
        if (body.charCodeAt(position + 1) === 10) {
          position += 2;
        } else {
          ++position;
        }
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      case 35:
        return readComment(lexer, position);
      case 33:
        return createToken(lexer, TokenKind.BANG, position, position + 1);
      case 36:
        return createToken(lexer, TokenKind.DOLLAR, position, position + 1);
      case 38:
        return createToken(lexer, TokenKind.AMP, position, position + 1);
      case 40:
        return createToken(lexer, TokenKind.PAREN_L, position, position + 1);
      case 41:
        return createToken(lexer, TokenKind.PAREN_R, position, position + 1);
      case 46:
        if (body.charCodeAt(position + 1) === 46 && body.charCodeAt(position + 2) === 46) {
          return createToken(lexer, TokenKind.SPREAD, position, position + 3);
        }
        break;
      case 58:
        return createToken(lexer, TokenKind.COLON, position, position + 1);
      case 61:
        return createToken(lexer, TokenKind.EQUALS, position, position + 1);
      case 64:
        return createToken(lexer, TokenKind.AT, position, position + 1);
      case 91:
        return createToken(lexer, TokenKind.BRACKET_L, position, position + 1);
      case 93:
        return createToken(lexer, TokenKind.BRACKET_R, position, position + 1);
      case 123:
        return createToken(lexer, TokenKind.BRACE_L, position, position + 1);
      case 124:
        return createToken(lexer, TokenKind.PIPE, position, position + 1);
      case 125:
        return createToken(lexer, TokenKind.BRACE_R, position, position + 1);
      case 34:
        if (body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
          return readBlockString(lexer, position);
        }
        return readString(lexer, position);
    }
    if (isDigit(code) || code === 45) {
      return readNumber(lexer, position, code);
    }
    if (isNameStart(code)) {
      return readName(lexer, position);
    }
    throw syntaxError(
      lexer.source,
      position,
      code === 39 ? `Unexpected single quote character ('), did you mean to use a double quote (")?` : isUnicodeScalarValue(code) || isSupplementaryCodePoint(body, position) ? `Unexpected character: ${printCodePointAt(lexer, position)}.` : `Invalid character: ${printCodePointAt(lexer, position)}.`
    );
  }
  return createToken(lexer, TokenKind.EOF, bodyLength, bodyLength);
}
function readComment(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (code === 10 || code === 13) {
      break;
    }
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      break;
    }
  }
  return createToken(
    lexer,
    TokenKind.COMMENT,
    start,
    position,
    body.slice(start + 1, position)
  );
}
function readNumber(lexer, start, firstCode) {
  const body = lexer.source.body;
  let position = start;
  let code = firstCode;
  let isFloat = false;
  if (code === 45) {
    code = body.charCodeAt(++position);
  }
  if (code === 48) {
    code = body.charCodeAt(++position);
    if (isDigit(code)) {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid number, unexpected digit after 0: ${printCodePointAt(
          lexer,
          position
        )}.`
      );
    }
  } else {
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  if (code === 46) {
    isFloat = true;
    code = body.charCodeAt(++position);
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  if (code === 69 || code === 101) {
    isFloat = true;
    code = body.charCodeAt(++position);
    if (code === 43 || code === 45) {
      code = body.charCodeAt(++position);
    }
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  if (code === 46 || isNameStart(code)) {
    throw syntaxError(
      lexer.source,
      position,
      `Invalid number, expected digit but got: ${printCodePointAt(
        lexer,
        position
      )}.`
    );
  }
  return createToken(
    lexer,
    isFloat ? TokenKind.FLOAT : TokenKind.INT,
    start,
    position,
    body.slice(start, position)
  );
}
function readDigits(lexer, start, firstCode) {
  if (!isDigit(firstCode)) {
    throw syntaxError(
      lexer.source,
      start,
      `Invalid number, expected digit but got: ${printCodePointAt(
        lexer,
        start
      )}.`
    );
  }
  const body = lexer.source.body;
  let position = start + 1;
  while (isDigit(body.charCodeAt(position))) {
    ++position;
  }
  return position;
}
function readString(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  let chunkStart = position;
  let value = "";
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (code === 34) {
      value += body.slice(chunkStart, position);
      return createToken(lexer, TokenKind.STRING, start, position + 1, value);
    }
    if (code === 92) {
      value += body.slice(chunkStart, position);
      const escape = body.charCodeAt(position + 1) === 117 ? body.charCodeAt(position + 2) === 123 ? readEscapedUnicodeVariableWidth(lexer, position) : readEscapedUnicodeFixedWidth(lexer, position) : readEscapedCharacter(lexer, position);
      value += escape.value;
      position += escape.size;
      chunkStart = position;
      continue;
    }
    if (code === 10 || code === 13) {
      break;
    }
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCodePointAt(
          lexer,
          position
        )}.`
      );
    }
  }
  throw syntaxError(lexer.source, position, "Unterminated string.");
}
function readEscapedUnicodeVariableWidth(lexer, position) {
  const body = lexer.source.body;
  let point = 0;
  let size = 3;
  while (size < 12) {
    const code = body.charCodeAt(position + size++);
    if (code === 125) {
      if (size < 5 || !isUnicodeScalarValue(point)) {
        break;
      }
      return {
        value: String.fromCodePoint(point),
        size
      };
    }
    point = point << 4 | readHexDigit(code);
    if (point < 0) {
      break;
    }
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid Unicode escape sequence: "${body.slice(
      position,
      position + size
    )}".`
  );
}
function readEscapedUnicodeFixedWidth(lexer, position) {
  const body = lexer.source.body;
  const code = read16BitHexCode(body, position + 2);
  if (isUnicodeScalarValue(code)) {
    return {
      value: String.fromCodePoint(code),
      size: 6
    };
  }
  if (isLeadingSurrogate(code)) {
    if (body.charCodeAt(position + 6) === 92 && body.charCodeAt(position + 7) === 117) {
      const trailingCode = read16BitHexCode(body, position + 8);
      if (isTrailingSurrogate(trailingCode)) {
        return {
          value: String.fromCodePoint(code, trailingCode),
          size: 12
        };
      }
    }
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid Unicode escape sequence: "${body.slice(position, position + 6)}".`
  );
}
function read16BitHexCode(body, position) {
  return readHexDigit(body.charCodeAt(position)) << 12 | readHexDigit(body.charCodeAt(position + 1)) << 8 | readHexDigit(body.charCodeAt(position + 2)) << 4 | readHexDigit(body.charCodeAt(position + 3));
}
function readHexDigit(code) {
  return code >= 48 && code <= 57 ? code - 48 : code >= 65 && code <= 70 ? code - 55 : code >= 97 && code <= 102 ? code - 87 : -1;
}
function readEscapedCharacter(lexer, position) {
  const body = lexer.source.body;
  const code = body.charCodeAt(position + 1);
  switch (code) {
    case 34:
      return {
        value: '"',
        size: 2
      };
    case 92:
      return {
        value: "\\",
        size: 2
      };
    case 47:
      return {
        value: "/",
        size: 2
      };
    case 98:
      return {
        value: "\b",
        size: 2
      };
    case 102:
      return {
        value: "\f",
        size: 2
      };
    case 110:
      return {
        value: "\n",
        size: 2
      };
    case 114:
      return {
        value: "\r",
        size: 2
      };
    case 116:
      return {
        value: "	",
        size: 2
      };
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid character escape sequence: "${body.slice(
      position,
      position + 2
    )}".`
  );
}
function readBlockString(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let lineStart = lexer.lineStart;
  let position = start + 3;
  let chunkStart = position;
  let currentLine = "";
  const blockLines = [];
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (code === 34 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
      currentLine += body.slice(chunkStart, position);
      blockLines.push(currentLine);
      const token = createToken(
        lexer,
        TokenKind.BLOCK_STRING,
        start,
        position + 3,
        // Return a string of the lines joined with U+000A.
        dedentBlockStringLines(blockLines).join("\n")
      );
      lexer.line += blockLines.length - 1;
      lexer.lineStart = lineStart;
      return token;
    }
    if (code === 92 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34 && body.charCodeAt(position + 3) === 34) {
      currentLine += body.slice(chunkStart, position);
      chunkStart = position + 1;
      position += 4;
      continue;
    }
    if (code === 10 || code === 13) {
      currentLine += body.slice(chunkStart, position);
      blockLines.push(currentLine);
      if (code === 13 && body.charCodeAt(position + 1) === 10) {
        position += 2;
      } else {
        ++position;
      }
      currentLine = "";
      chunkStart = position;
      lineStart = position;
      continue;
    }
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCodePointAt(
          lexer,
          position
        )}.`
      );
    }
  }
  throw syntaxError(lexer.source, position, "Unterminated string.");
}
function readName(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (isNameContinue(code)) {
      ++position;
    } else {
      break;
    }
  }
  return createToken(
    lexer,
    TokenKind.NAME,
    start,
    position,
    body.slice(start, position)
  );
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/inspect.mjs
var MAX_ARRAY_LENGTH = 10;
var MAX_RECURSIVE_DEPTH = 2;
function inspect(value) {
  return formatValue(value, []);
}
function formatValue(value, seenValues) {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "function":
      return value.name ? `[function ${value.name}]` : "[function]";
    case "object":
      return formatObjectValue(value, seenValues);
    default:
      return String(value);
  }
}
function formatObjectValue(value, previouslySeenValues) {
  if (value === null) {
    return "null";
  }
  if (previouslySeenValues.includes(value)) {
    return "[Circular]";
  }
  const seenValues = [...previouslySeenValues, value];
  if (isJSONable(value)) {
    const jsonValue = value.toJSON();
    if (jsonValue !== value) {
      return typeof jsonValue === "string" ? jsonValue : formatValue(jsonValue, seenValues);
    }
  } else if (Array.isArray(value)) {
    return formatArray(value, seenValues);
  }
  return formatObject(value, seenValues);
}
function isJSONable(value) {
  return typeof value.toJSON === "function";
}
function formatObject(object, seenValues) {
  const entries = Object.entries(object);
  if (entries.length === 0) {
    return "{}";
  }
  if (seenValues.length > MAX_RECURSIVE_DEPTH) {
    return "[" + getObjectTag(object) + "]";
  }
  const properties = entries.map(
    ([key, value]) => key + ": " + formatValue(value, seenValues)
  );
  return "{ " + properties.join(", ") + " }";
}
function formatArray(array, seenValues) {
  if (array.length === 0) {
    return "[]";
  }
  if (seenValues.length > MAX_RECURSIVE_DEPTH) {
    return "[Array]";
  }
  const len = Math.min(MAX_ARRAY_LENGTH, array.length);
  const remaining = array.length - len;
  const items = [];
  for (let i = 0; i < len; ++i) {
    items.push(formatValue(array[i], seenValues));
  }
  if (remaining === 1) {
    items.push("... 1 more item");
  } else if (remaining > 1) {
    items.push(`... ${remaining} more items`);
  }
  return "[" + items.join(", ") + "]";
}
function getObjectTag(object) {
  const tag = Object.prototype.toString.call(object).replace(/^\[object /, "").replace(/]$/, "");
  if (tag === "Object" && typeof object.constructor === "function") {
    const name = object.constructor.name;
    if (typeof name === "string" && name !== "") {
      return name;
    }
  }
  return tag;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/instanceOf.mjs
var isProduction = globalThis.process && // eslint-disable-next-line no-undef
process.env.NODE_ENV === "production";
var instanceOf = (
  /* c8 ignore next 6 */
  // FIXME: https://github.com/graphql/graphql-js/issues/2317
  isProduction ? function instanceOf2(value, constructor) {
    return value instanceof constructor;
  } : function instanceOf3(value, constructor) {
    if (value instanceof constructor) {
      return true;
    }
    if (typeof value === "object" && value !== null) {
      var _value$constructor;
      const className = constructor.prototype[Symbol.toStringTag];
      const valueClassName = (
        // We still need to support constructor's name to detect conflicts with older versions of this library.
        Symbol.toStringTag in value ? value[Symbol.toStringTag] : (_value$constructor = value.constructor) === null || _value$constructor === void 0 ? void 0 : _value$constructor.name
      );
      if (className === valueClassName) {
        const stringifiedValue = inspect(value);
        throw new Error(`Cannot use ${className} "${stringifiedValue}" from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`);
      }
    }
    return false;
  }
);

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/source.mjs
var Source = class {
  constructor(body, name = "GraphQL request", locationOffset = {
    line: 1,
    column: 1
  }) {
    typeof body === "string" || devAssert(false, `Body must be a string. Received: ${inspect(body)}.`);
    this.body = body;
    this.name = name;
    this.locationOffset = locationOffset;
    this.locationOffset.line > 0 || devAssert(
      false,
      "line in locationOffset is 1-indexed and must be positive."
    );
    this.locationOffset.column > 0 || devAssert(
      false,
      "column in locationOffset is 1-indexed and must be positive."
    );
  }
  get [Symbol.toStringTag]() {
    return "Source";
  }
};
function isSource(source) {
  return instanceOf(source, Source);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/parser.mjs
function parse(source, options) {
  const parser = new Parser(source, options);
  return parser.parseDocument();
}
function parseValue(source, options) {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const value = parser.parseValueLiteral(false);
  parser.expectToken(TokenKind.EOF);
  return value;
}
function parseConstValue(source, options) {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const value = parser.parseConstValueLiteral();
  parser.expectToken(TokenKind.EOF);
  return value;
}
function parseType(source, options) {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const type = parser.parseTypeReference();
  parser.expectToken(TokenKind.EOF);
  return type;
}
var Parser = class {
  constructor(source, options = {}) {
    const sourceObj = isSource(source) ? source : new Source(source);
    this._lexer = new Lexer(sourceObj);
    this._options = options;
    this._tokenCounter = 0;
  }
  /**
   * Converts a name lex token into a name parse node.
   */
  parseName() {
    const token = this.expectToken(TokenKind.NAME);
    return this.node(token, {
      kind: Kind.NAME,
      value: token.value
    });
  }
  // Implements the parsing rules in the Document section.
  /**
   * Document : Definition+
   */
  parseDocument() {
    return this.node(this._lexer.token, {
      kind: Kind.DOCUMENT,
      definitions: this.many(
        TokenKind.SOF,
        this.parseDefinition,
        TokenKind.EOF
      )
    });
  }
  /**
   * Definition :
   *   - ExecutableDefinition
   *   - TypeSystemDefinition
   *   - TypeSystemExtension
   *
   * ExecutableDefinition :
   *   - OperationDefinition
   *   - FragmentDefinition
   *
   * TypeSystemDefinition :
   *   - SchemaDefinition
   *   - TypeDefinition
   *   - DirectiveDefinition
   *
   * TypeDefinition :
   *   - ScalarTypeDefinition
   *   - ObjectTypeDefinition
   *   - InterfaceTypeDefinition
   *   - UnionTypeDefinition
   *   - EnumTypeDefinition
   *   - InputObjectTypeDefinition
   */
  parseDefinition() {
    if (this.peek(TokenKind.BRACE_L)) {
      return this.parseOperationDefinition();
    }
    const hasDescription = this.peekDescription();
    const keywordToken = hasDescription ? this._lexer.lookahead() : this._lexer.token;
    if (keywordToken.kind === TokenKind.NAME) {
      switch (keywordToken.value) {
        case "schema":
          return this.parseSchemaDefinition();
        case "scalar":
          return this.parseScalarTypeDefinition();
        case "type":
          return this.parseObjectTypeDefinition();
        case "interface":
          return this.parseInterfaceTypeDefinition();
        case "union":
          return this.parseUnionTypeDefinition();
        case "enum":
          return this.parseEnumTypeDefinition();
        case "input":
          return this.parseInputObjectTypeDefinition();
        case "directive":
          return this.parseDirectiveDefinition();
      }
      if (hasDescription) {
        throw syntaxError(
          this._lexer.source,
          this._lexer.token.start,
          "Unexpected description, descriptions are supported only on type definitions."
        );
      }
      switch (keywordToken.value) {
        case "query":
        case "mutation":
        case "subscription":
          return this.parseOperationDefinition();
        case "fragment":
          return this.parseFragmentDefinition();
        case "extend":
          return this.parseTypeSystemExtension();
      }
    }
    throw this.unexpected(keywordToken);
  }
  // Implements the parsing rules in the Operations section.
  /**
   * OperationDefinition :
   *  - SelectionSet
   *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
   */
  parseOperationDefinition() {
    const start = this._lexer.token;
    if (this.peek(TokenKind.BRACE_L)) {
      return this.node(start, {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        name: void 0,
        variableDefinitions: [],
        directives: [],
        selectionSet: this.parseSelectionSet()
      });
    }
    const operation = this.parseOperationType();
    let name;
    if (this.peek(TokenKind.NAME)) {
      name = this.parseName();
    }
    return this.node(start, {
      kind: Kind.OPERATION_DEFINITION,
      operation,
      name,
      variableDefinitions: this.parseVariableDefinitions(),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet()
    });
  }
  /**
   * OperationType : one of query mutation subscription
   */
  parseOperationType() {
    const operationToken = this.expectToken(TokenKind.NAME);
    switch (operationToken.value) {
      case "query":
        return OperationTypeNode.QUERY;
      case "mutation":
        return OperationTypeNode.MUTATION;
      case "subscription":
        return OperationTypeNode.SUBSCRIPTION;
    }
    throw this.unexpected(operationToken);
  }
  /**
   * VariableDefinitions : ( VariableDefinition+ )
   */
  parseVariableDefinitions() {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseVariableDefinition,
      TokenKind.PAREN_R
    );
  }
  /**
   * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
   */
  parseVariableDefinition() {
    return this.node(this._lexer.token, {
      kind: Kind.VARIABLE_DEFINITION,
      variable: this.parseVariable(),
      type: (this.expectToken(TokenKind.COLON), this.parseTypeReference()),
      defaultValue: this.expectOptionalToken(TokenKind.EQUALS) ? this.parseConstValueLiteral() : void 0,
      directives: this.parseConstDirectives()
    });
  }
  /**
   * Variable : $ Name
   */
  parseVariable() {
    const start = this._lexer.token;
    this.expectToken(TokenKind.DOLLAR);
    return this.node(start, {
      kind: Kind.VARIABLE,
      name: this.parseName()
    });
  }
  /**
   * ```
   * SelectionSet : { Selection+ }
   * ```
   */
  parseSelectionSet() {
    return this.node(this._lexer.token, {
      kind: Kind.SELECTION_SET,
      selections: this.many(
        TokenKind.BRACE_L,
        this.parseSelection,
        TokenKind.BRACE_R
      )
    });
  }
  /**
   * Selection :
   *   - Field
   *   - FragmentSpread
   *   - InlineFragment
   */
  parseSelection() {
    return this.peek(TokenKind.SPREAD) ? this.parseFragment() : this.parseField();
  }
  /**
   * Field : Alias? Name Arguments? Directives? SelectionSet?
   *
   * Alias : Name :
   */
  parseField() {
    const start = this._lexer.token;
    const nameOrAlias = this.parseName();
    let alias;
    let name;
    if (this.expectOptionalToken(TokenKind.COLON)) {
      alias = nameOrAlias;
      name = this.parseName();
    } else {
      name = nameOrAlias;
    }
    return this.node(start, {
      kind: Kind.FIELD,
      alias,
      name,
      arguments: this.parseArguments(false),
      directives: this.parseDirectives(false),
      selectionSet: this.peek(TokenKind.BRACE_L) ? this.parseSelectionSet() : void 0
    });
  }
  /**
   * Arguments[Const] : ( Argument[?Const]+ )
   */
  parseArguments(isConst) {
    const item = isConst ? this.parseConstArgument : this.parseArgument;
    return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
  }
  /**
   * Argument[Const] : Name : Value[?Const]
   */
  parseArgument(isConst = false) {
    const start = this._lexer.token;
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    return this.node(start, {
      kind: Kind.ARGUMENT,
      name,
      value: this.parseValueLiteral(isConst)
    });
  }
  parseConstArgument() {
    return this.parseArgument(true);
  }
  // Implements the parsing rules in the Fragments section.
  /**
   * Corresponds to both FragmentSpread and InlineFragment in the spec.
   *
   * FragmentSpread : ... FragmentName Directives?
   *
   * InlineFragment : ... TypeCondition? Directives? SelectionSet
   */
  parseFragment() {
    const start = this._lexer.token;
    this.expectToken(TokenKind.SPREAD);
    const hasTypeCondition = this.expectOptionalKeyword("on");
    if (!hasTypeCondition && this.peek(TokenKind.NAME)) {
      return this.node(start, {
        kind: Kind.FRAGMENT_SPREAD,
        name: this.parseFragmentName(),
        directives: this.parseDirectives(false)
      });
    }
    return this.node(start, {
      kind: Kind.INLINE_FRAGMENT,
      typeCondition: hasTypeCondition ? this.parseNamedType() : void 0,
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet()
    });
  }
  /**
   * FragmentDefinition :
   *   - fragment FragmentName on TypeCondition Directives? SelectionSet
   *
   * TypeCondition : NamedType
   */
  parseFragmentDefinition() {
    const start = this._lexer.token;
    this.expectKeyword("fragment");
    if (this._options.allowLegacyFragmentVariables === true) {
      return this.node(start, {
        kind: Kind.FRAGMENT_DEFINITION,
        name: this.parseFragmentName(),
        variableDefinitions: this.parseVariableDefinitions(),
        typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
        directives: this.parseDirectives(false),
        selectionSet: this.parseSelectionSet()
      });
    }
    return this.node(start, {
      kind: Kind.FRAGMENT_DEFINITION,
      name: this.parseFragmentName(),
      typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet()
    });
  }
  /**
   * FragmentName : Name but not `on`
   */
  parseFragmentName() {
    if (this._lexer.token.value === "on") {
      throw this.unexpected();
    }
    return this.parseName();
  }
  // Implements the parsing rules in the Values section.
  /**
   * Value[Const] :
   *   - [~Const] Variable
   *   - IntValue
   *   - FloatValue
   *   - StringValue
   *   - BooleanValue
   *   - NullValue
   *   - EnumValue
   *   - ListValue[?Const]
   *   - ObjectValue[?Const]
   *
   * BooleanValue : one of `true` `false`
   *
   * NullValue : `null`
   *
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseValueLiteral(isConst) {
    const token = this._lexer.token;
    switch (token.kind) {
      case TokenKind.BRACKET_L:
        return this.parseList(isConst);
      case TokenKind.BRACE_L:
        return this.parseObject(isConst);
      case TokenKind.INT:
        this.advanceLexer();
        return this.node(token, {
          kind: Kind.INT,
          value: token.value
        });
      case TokenKind.FLOAT:
        this.advanceLexer();
        return this.node(token, {
          kind: Kind.FLOAT,
          value: token.value
        });
      case TokenKind.STRING:
      case TokenKind.BLOCK_STRING:
        return this.parseStringLiteral();
      case TokenKind.NAME:
        this.advanceLexer();
        switch (token.value) {
          case "true":
            return this.node(token, {
              kind: Kind.BOOLEAN,
              value: true
            });
          case "false":
            return this.node(token, {
              kind: Kind.BOOLEAN,
              value: false
            });
          case "null":
            return this.node(token, {
              kind: Kind.NULL
            });
          default:
            return this.node(token, {
              kind: Kind.ENUM,
              value: token.value
            });
        }
      case TokenKind.DOLLAR:
        if (isConst) {
          this.expectToken(TokenKind.DOLLAR);
          if (this._lexer.token.kind === TokenKind.NAME) {
            const varName = this._lexer.token.value;
            throw syntaxError(
              this._lexer.source,
              token.start,
              `Unexpected variable "$${varName}" in constant value.`
            );
          } else {
            throw this.unexpected(token);
          }
        }
        return this.parseVariable();
      default:
        throw this.unexpected();
    }
  }
  parseConstValueLiteral() {
    return this.parseValueLiteral(true);
  }
  parseStringLiteral() {
    const token = this._lexer.token;
    this.advanceLexer();
    return this.node(token, {
      kind: Kind.STRING,
      value: token.value,
      block: token.kind === TokenKind.BLOCK_STRING
    });
  }
  /**
   * ListValue[Const] :
   *   - [ ]
   *   - [ Value[?Const]+ ]
   */
  parseList(isConst) {
    const item = () => this.parseValueLiteral(isConst);
    return this.node(this._lexer.token, {
      kind: Kind.LIST,
      values: this.any(TokenKind.BRACKET_L, item, TokenKind.BRACKET_R)
    });
  }
  /**
   * ```
   * ObjectValue[Const] :
   *   - { }
   *   - { ObjectField[?Const]+ }
   * ```
   */
  parseObject(isConst) {
    const item = () => this.parseObjectField(isConst);
    return this.node(this._lexer.token, {
      kind: Kind.OBJECT,
      fields: this.any(TokenKind.BRACE_L, item, TokenKind.BRACE_R)
    });
  }
  /**
   * ObjectField[Const] : Name : Value[?Const]
   */
  parseObjectField(isConst) {
    const start = this._lexer.token;
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    return this.node(start, {
      kind: Kind.OBJECT_FIELD,
      name,
      value: this.parseValueLiteral(isConst)
    });
  }
  // Implements the parsing rules in the Directives section.
  /**
   * Directives[Const] : Directive[?Const]+
   */
  parseDirectives(isConst) {
    const directives = [];
    while (this.peek(TokenKind.AT)) {
      directives.push(this.parseDirective(isConst));
    }
    return directives;
  }
  parseConstDirectives() {
    return this.parseDirectives(true);
  }
  /**
   * ```
   * Directive[Const] : @ Name Arguments[?Const]?
   * ```
   */
  parseDirective(isConst) {
    const start = this._lexer.token;
    this.expectToken(TokenKind.AT);
    return this.node(start, {
      kind: Kind.DIRECTIVE,
      name: this.parseName(),
      arguments: this.parseArguments(isConst)
    });
  }
  // Implements the parsing rules in the Types section.
  /**
   * Type :
   *   - NamedType
   *   - ListType
   *   - NonNullType
   */
  parseTypeReference() {
    const start = this._lexer.token;
    let type;
    if (this.expectOptionalToken(TokenKind.BRACKET_L)) {
      const innerType = this.parseTypeReference();
      this.expectToken(TokenKind.BRACKET_R);
      type = this.node(start, {
        kind: Kind.LIST_TYPE,
        type: innerType
      });
    } else {
      type = this.parseNamedType();
    }
    if (this.expectOptionalToken(TokenKind.BANG)) {
      return this.node(start, {
        kind: Kind.NON_NULL_TYPE,
        type
      });
    }
    return type;
  }
  /**
   * NamedType : Name
   */
  parseNamedType() {
    return this.node(this._lexer.token, {
      kind: Kind.NAMED_TYPE,
      name: this.parseName()
    });
  }
  // Implements the parsing rules in the Type Definition section.
  peekDescription() {
    return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
  }
  /**
   * Description : StringValue
   */
  parseDescription() {
    if (this.peekDescription()) {
      return this.parseStringLiteral();
    }
  }
  /**
   * ```
   * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
   * ```
   */
  parseSchemaDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("schema");
    const directives = this.parseConstDirectives();
    const operationTypes = this.many(
      TokenKind.BRACE_L,
      this.parseOperationTypeDefinition,
      TokenKind.BRACE_R
    );
    return this.node(start, {
      kind: Kind.SCHEMA_DEFINITION,
      description,
      directives,
      operationTypes
    });
  }
  /**
   * OperationTypeDefinition : OperationType : NamedType
   */
  parseOperationTypeDefinition() {
    const start = this._lexer.token;
    const operation = this.parseOperationType();
    this.expectToken(TokenKind.COLON);
    const type = this.parseNamedType();
    return this.node(start, {
      kind: Kind.OPERATION_TYPE_DEFINITION,
      operation,
      type
    });
  }
  /**
   * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
   */
  parseScalarTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("scalar");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      description,
      name,
      directives
    });
  }
  /**
   * ObjectTypeDefinition :
   *   Description?
   *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
   */
  parseObjectTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("type");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    return this.node(start, {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      description,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * ImplementsInterfaces :
   *   - implements `&`? NamedType
   *   - ImplementsInterfaces & NamedType
   */
  parseImplementsInterfaces() {
    return this.expectOptionalKeyword("implements") ? this.delimitedMany(TokenKind.AMP, this.parseNamedType) : [];
  }
  /**
   * ```
   * FieldsDefinition : { FieldDefinition+ }
   * ```
   */
  parseFieldsDefinition() {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseFieldDefinition,
      TokenKind.BRACE_R
    );
  }
  /**
   * FieldDefinition :
   *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
   */
  parseFieldDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.FIELD_DEFINITION,
      description,
      name,
      arguments: args,
      type,
      directives
    });
  }
  /**
   * ArgumentsDefinition : ( InputValueDefinition+ )
   */
  parseArgumentDefs() {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseInputValueDef,
      TokenKind.PAREN_R
    );
  }
  /**
   * InputValueDefinition :
   *   - Description? Name : Type DefaultValue? Directives[Const]?
   */
  parseInputValueDef() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    let defaultValue;
    if (this.expectOptionalToken(TokenKind.EQUALS)) {
      defaultValue = this.parseConstValueLiteral();
    }
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description,
      name,
      type,
      defaultValue,
      directives
    });
  }
  /**
   * InterfaceTypeDefinition :
   *   - Description? interface Name Directives[Const]? FieldsDefinition?
   */
  parseInterfaceTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("interface");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    return this.node(start, {
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      description,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * UnionTypeDefinition :
   *   - Description? union Name Directives[Const]? UnionMemberTypes?
   */
  parseUnionTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("union");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const types = this.parseUnionMemberTypes();
    return this.node(start, {
      kind: Kind.UNION_TYPE_DEFINITION,
      description,
      name,
      directives,
      types
    });
  }
  /**
   * UnionMemberTypes :
   *   - = `|`? NamedType
   *   - UnionMemberTypes | NamedType
   */
  parseUnionMemberTypes() {
    return this.expectOptionalToken(TokenKind.EQUALS) ? this.delimitedMany(TokenKind.PIPE, this.parseNamedType) : [];
  }
  /**
   * EnumTypeDefinition :
   *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
   */
  parseEnumTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("enum");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const values = this.parseEnumValuesDefinition();
    return this.node(start, {
      kind: Kind.ENUM_TYPE_DEFINITION,
      description,
      name,
      directives,
      values
    });
  }
  /**
   * ```
   * EnumValuesDefinition : { EnumValueDefinition+ }
   * ```
   */
  parseEnumValuesDefinition() {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseEnumValueDefinition,
      TokenKind.BRACE_R
    );
  }
  /**
   * EnumValueDefinition : Description? EnumValue Directives[Const]?
   */
  parseEnumValueDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseEnumValueName();
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.ENUM_VALUE_DEFINITION,
      description,
      name,
      directives
    });
  }
  /**
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseEnumValueName() {
    if (this._lexer.token.value === "true" || this._lexer.token.value === "false" || this._lexer.token.value === "null") {
      throw syntaxError(
        this._lexer.source,
        this._lexer.token.start,
        `${getTokenDesc(
          this._lexer.token
        )} is reserved and cannot be used for an enum value.`
      );
    }
    return this.parseName();
  }
  /**
   * InputObjectTypeDefinition :
   *   - Description? input Name Directives[Const]? InputFieldsDefinition?
   */
  parseInputObjectTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("input");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const fields = this.parseInputFieldsDefinition();
    return this.node(start, {
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      description,
      name,
      directives,
      fields
    });
  }
  /**
   * ```
   * InputFieldsDefinition : { InputValueDefinition+ }
   * ```
   */
  parseInputFieldsDefinition() {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseInputValueDef,
      TokenKind.BRACE_R
    );
  }
  /**
   * TypeSystemExtension :
   *   - SchemaExtension
   *   - TypeExtension
   *
   * TypeExtension :
   *   - ScalarTypeExtension
   *   - ObjectTypeExtension
   *   - InterfaceTypeExtension
   *   - UnionTypeExtension
   *   - EnumTypeExtension
   *   - InputObjectTypeDefinition
   */
  parseTypeSystemExtension() {
    const keywordToken = this._lexer.lookahead();
    if (keywordToken.kind === TokenKind.NAME) {
      switch (keywordToken.value) {
        case "schema":
          return this.parseSchemaExtension();
        case "scalar":
          return this.parseScalarTypeExtension();
        case "type":
          return this.parseObjectTypeExtension();
        case "interface":
          return this.parseInterfaceTypeExtension();
        case "union":
          return this.parseUnionTypeExtension();
        case "enum":
          return this.parseEnumTypeExtension();
        case "input":
          return this.parseInputObjectTypeExtension();
      }
    }
    throw this.unexpected(keywordToken);
  }
  /**
   * ```
   * SchemaExtension :
   *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
   *  - extend schema Directives[Const]
   * ```
   */
  parseSchemaExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("schema");
    const directives = this.parseConstDirectives();
    const operationTypes = this.optionalMany(
      TokenKind.BRACE_L,
      this.parseOperationTypeDefinition,
      TokenKind.BRACE_R
    );
    if (directives.length === 0 && operationTypes.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.SCHEMA_EXTENSION,
      directives,
      operationTypes
    });
  }
  /**
   * ScalarTypeExtension :
   *   - extend scalar Name Directives[Const]
   */
  parseScalarTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("scalar");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    if (directives.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.SCALAR_TYPE_EXTENSION,
      name,
      directives
    });
  }
  /**
   * ObjectTypeExtension :
   *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend type Name ImplementsInterfaces? Directives[Const]
   *  - extend type Name ImplementsInterfaces
   */
  parseObjectTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("type");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.OBJECT_TYPE_EXTENSION,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * InterfaceTypeExtension :
   *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend interface Name ImplementsInterfaces? Directives[Const]
   *  - extend interface Name ImplementsInterfaces
   */
  parseInterfaceTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("interface");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.INTERFACE_TYPE_EXTENSION,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * UnionTypeExtension :
   *   - extend union Name Directives[Const]? UnionMemberTypes
   *   - extend union Name Directives[Const]
   */
  parseUnionTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("union");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const types = this.parseUnionMemberTypes();
    if (directives.length === 0 && types.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.UNION_TYPE_EXTENSION,
      name,
      directives,
      types
    });
  }
  /**
   * EnumTypeExtension :
   *   - extend enum Name Directives[Const]? EnumValuesDefinition
   *   - extend enum Name Directives[Const]
   */
  parseEnumTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("enum");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const values = this.parseEnumValuesDefinition();
    if (directives.length === 0 && values.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.ENUM_TYPE_EXTENSION,
      name,
      directives,
      values
    });
  }
  /**
   * InputObjectTypeExtension :
   *   - extend input Name Directives[Const]? InputFieldsDefinition
   *   - extend input Name Directives[Const]
   */
  parseInputObjectTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("input");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const fields = this.parseInputFieldsDefinition();
    if (directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
      name,
      directives,
      fields
    });
  }
  /**
   * ```
   * DirectiveDefinition :
   *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
   * ```
   */
  parseDirectiveDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("directive");
    this.expectToken(TokenKind.AT);
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    const repeatable = this.expectOptionalKeyword("repeatable");
    this.expectKeyword("on");
    const locations = this.parseDirectiveLocations();
    return this.node(start, {
      kind: Kind.DIRECTIVE_DEFINITION,
      description,
      name,
      arguments: args,
      repeatable,
      locations
    });
  }
  /**
   * DirectiveLocations :
   *   - `|`? DirectiveLocation
   *   - DirectiveLocations | DirectiveLocation
   */
  parseDirectiveLocations() {
    return this.delimitedMany(TokenKind.PIPE, this.parseDirectiveLocation);
  }
  /*
   * DirectiveLocation :
   *   - ExecutableDirectiveLocation
   *   - TypeSystemDirectiveLocation
   *
   * ExecutableDirectiveLocation : one of
   *   `QUERY`
   *   `MUTATION`
   *   `SUBSCRIPTION`
   *   `FIELD`
   *   `FRAGMENT_DEFINITION`
   *   `FRAGMENT_SPREAD`
   *   `INLINE_FRAGMENT`
   *
   * TypeSystemDirectiveLocation : one of
   *   `SCHEMA`
   *   `SCALAR`
   *   `OBJECT`
   *   `FIELD_DEFINITION`
   *   `ARGUMENT_DEFINITION`
   *   `INTERFACE`
   *   `UNION`
   *   `ENUM`
   *   `ENUM_VALUE`
   *   `INPUT_OBJECT`
   *   `INPUT_FIELD_DEFINITION`
   */
  parseDirectiveLocation() {
    const start = this._lexer.token;
    const name = this.parseName();
    if (Object.prototype.hasOwnProperty.call(DirectiveLocation, name.value)) {
      return name;
    }
    throw this.unexpected(start);
  }
  // Core parsing utility functions
  /**
   * Returns a node that, if configured to do so, sets a "loc" field as a
   * location object, used to identify the place in the source that created a
   * given parsed object.
   */
  node(startToken, node) {
    if (this._options.noLocation !== true) {
      node.loc = new Location(
        startToken,
        this._lexer.lastToken,
        this._lexer.source
      );
    }
    return node;
  }
  /**
   * Determines if the next token is of a given kind
   */
  peek(kind) {
    return this._lexer.token.kind === kind;
  }
  /**
   * If the next token is of the given kind, return that token after advancing the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectToken(kind) {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this.advanceLexer();
      return token;
    }
    throw syntaxError(
      this._lexer.source,
      token.start,
      `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`
    );
  }
  /**
   * If the next token is of the given kind, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalToken(kind) {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this.advanceLexer();
      return true;
    }
    return false;
  }
  /**
   * If the next token is a given keyword, advance the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectKeyword(value) {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this.advanceLexer();
    } else {
      throw syntaxError(
        this._lexer.source,
        token.start,
        `Expected "${value}", found ${getTokenDesc(token)}.`
      );
    }
  }
  /**
   * If the next token is a given keyword, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalKeyword(value) {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this.advanceLexer();
      return true;
    }
    return false;
  }
  /**
   * Helper function for creating an error when an unexpected lexed token is encountered.
   */
  unexpected(atToken) {
    const token = atToken !== null && atToken !== void 0 ? atToken : this._lexer.token;
    return syntaxError(
      this._lexer.source,
      token.start,
      `Unexpected ${getTokenDesc(token)}.`
    );
  }
  /**
   * Returns a possibly empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  any(openKind, parseFn, closeKind) {
    this.expectToken(openKind);
    const nodes = [];
    while (!this.expectOptionalToken(closeKind)) {
      nodes.push(parseFn.call(this));
    }
    return nodes;
  }
  /**
   * Returns a list of parse nodes, determined by the parseFn.
   * It can be empty only if open token is missing otherwise it will always return non-empty list
   * that begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  optionalMany(openKind, parseFn, closeKind) {
    if (this.expectOptionalToken(openKind)) {
      const nodes = [];
      do {
        nodes.push(parseFn.call(this));
      } while (!this.expectOptionalToken(closeKind));
      return nodes;
    }
    return [];
  }
  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  many(openKind, parseFn, closeKind) {
    this.expectToken(openKind);
    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (!this.expectOptionalToken(closeKind));
    return nodes;
  }
  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
   * Advances the parser to the next lex token after last item in the list.
   */
  delimitedMany(delimiterKind, parseFn) {
    this.expectOptionalToken(delimiterKind);
    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (this.expectOptionalToken(delimiterKind));
    return nodes;
  }
  advanceLexer() {
    const { maxTokens } = this._options;
    const token = this._lexer.advance();
    if (maxTokens !== void 0 && token.kind !== TokenKind.EOF) {
      ++this._tokenCounter;
      if (this._tokenCounter > maxTokens) {
        throw syntaxError(
          this._lexer.source,
          token.start,
          `Document contains more that ${maxTokens} tokens. Parsing aborted.`
        );
      }
    }
  }
};
function getTokenDesc(token) {
  const value = token.value;
  return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : "");
}
function getTokenKindDesc(kind) {
  return isPunctuatorTokenKind(kind) ? `"${kind}"` : kind;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/didYouMean.mjs
var MAX_SUGGESTIONS = 5;
function didYouMean(firstArg, secondArg) {
  const [subMessage, suggestionsArg] = secondArg ? [firstArg, secondArg] : [void 0, firstArg];
  let message = " Did you mean ";
  if (subMessage) {
    message += subMessage + " ";
  }
  const suggestions = suggestionsArg.map((x) => `"${x}"`);
  switch (suggestions.length) {
    case 0:
      return "";
    case 1:
      return message + suggestions[0] + "?";
    case 2:
      return message + suggestions[0] + " or " + suggestions[1] + "?";
  }
  const selected = suggestions.slice(0, MAX_SUGGESTIONS);
  const lastItem = selected.pop();
  return message + selected.join(", ") + ", or " + lastItem + "?";
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/identityFunc.mjs
function identityFunc(x) {
  return x;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/keyMap.mjs
function keyMap(list, keyFn) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const item of list) {
    result[keyFn(item)] = item;
  }
  return result;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/keyValMap.mjs
function keyValMap(list, keyFn, valFn) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const item of list) {
    result[keyFn(item)] = valFn(item);
  }
  return result;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/mapValue.mjs
function mapValue(map, fn) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const key of Object.keys(map)) {
    result[key] = fn(map[key], key);
  }
  return result;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/naturalCompare.mjs
function naturalCompare(aStr, bStr) {
  let aIndex = 0;
  let bIndex = 0;
  while (aIndex < aStr.length && bIndex < bStr.length) {
    let aChar = aStr.charCodeAt(aIndex);
    let bChar = bStr.charCodeAt(bIndex);
    if (isDigit2(aChar) && isDigit2(bChar)) {
      let aNum = 0;
      do {
        ++aIndex;
        aNum = aNum * 10 + aChar - DIGIT_0;
        aChar = aStr.charCodeAt(aIndex);
      } while (isDigit2(aChar) && aNum > 0);
      let bNum = 0;
      do {
        ++bIndex;
        bNum = bNum * 10 + bChar - DIGIT_0;
        bChar = bStr.charCodeAt(bIndex);
      } while (isDigit2(bChar) && bNum > 0);
      if (aNum < bNum) {
        return -1;
      }
      if (aNum > bNum) {
        return 1;
      }
    } else {
      if (aChar < bChar) {
        return -1;
      }
      if (aChar > bChar) {
        return 1;
      }
      ++aIndex;
      ++bIndex;
    }
  }
  return aStr.length - bStr.length;
}
var DIGIT_0 = 48;
var DIGIT_9 = 57;
function isDigit2(code) {
  return !isNaN(code) && DIGIT_0 <= code && code <= DIGIT_9;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/suggestionList.mjs
function suggestionList(input, options) {
  const optionsByDistance = /* @__PURE__ */ Object.create(null);
  const lexicalDistance = new LexicalDistance(input);
  const threshold = Math.floor(input.length * 0.4) + 1;
  for (const option of options) {
    const distance = lexicalDistance.measure(option, threshold);
    if (distance !== void 0) {
      optionsByDistance[option] = distance;
    }
  }
  return Object.keys(optionsByDistance).sort((a, b) => {
    const distanceDiff = optionsByDistance[a] - optionsByDistance[b];
    return distanceDiff !== 0 ? distanceDiff : naturalCompare(a, b);
  });
}
var LexicalDistance = class {
  constructor(input) {
    this._input = input;
    this._inputLowerCase = input.toLowerCase();
    this._inputArray = stringToArray(this._inputLowerCase);
    this._rows = [
      new Array(input.length + 1).fill(0),
      new Array(input.length + 1).fill(0),
      new Array(input.length + 1).fill(0)
    ];
  }
  measure(option, threshold) {
    if (this._input === option) {
      return 0;
    }
    const optionLowerCase = option.toLowerCase();
    if (this._inputLowerCase === optionLowerCase) {
      return 1;
    }
    let a = stringToArray(optionLowerCase);
    let b = this._inputArray;
    if (a.length < b.length) {
      const tmp = a;
      a = b;
      b = tmp;
    }
    const aLength = a.length;
    const bLength = b.length;
    if (aLength - bLength > threshold) {
      return void 0;
    }
    const rows = this._rows;
    for (let j = 0; j <= bLength; j++) {
      rows[0][j] = j;
    }
    for (let i = 1; i <= aLength; i++) {
      const upRow = rows[(i - 1) % 3];
      const currentRow = rows[i % 3];
      let smallestCell = currentRow[0] = i;
      for (let j = 1; j <= bLength; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let currentCell = Math.min(
          upRow[j] + 1,
          // delete
          currentRow[j - 1] + 1,
          // insert
          upRow[j - 1] + cost
          // substitute
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          const doubleDiagonalCell = rows[(i - 2) % 3][j - 2];
          currentCell = Math.min(currentCell, doubleDiagonalCell + 1);
        }
        if (currentCell < smallestCell) {
          smallestCell = currentCell;
        }
        currentRow[j] = currentCell;
      }
      if (smallestCell > threshold) {
        return void 0;
      }
    }
    const distance = rows[aLength % 3][bLength];
    return distance <= threshold ? distance : void 0;
  }
};
function stringToArray(str) {
  const strLength = str.length;
  const array = new Array(strLength);
  for (let i = 0; i < strLength; ++i) {
    array[i] = str.charCodeAt(i);
  }
  return array;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/toObjMap.mjs
function toObjMap(obj) {
  if (obj == null) {
    return /* @__PURE__ */ Object.create(null);
  }
  if (Object.getPrototypeOf(obj) === null) {
    return obj;
  }
  const map = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    map[key] = value;
  }
  return map;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/printString.mjs
function printString(str) {
  return `"${str.replace(escapedRegExp, escapedReplacer)}"`;
}
var escapedRegExp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;
function escapedReplacer(str) {
  return escapeSequences[str.charCodeAt(0)];
}
var escapeSequences = [
  "\\u0000",
  "\\u0001",
  "\\u0002",
  "\\u0003",
  "\\u0004",
  "\\u0005",
  "\\u0006",
  "\\u0007",
  "\\b",
  "\\t",
  "\\n",
  "\\u000B",
  "\\f",
  "\\r",
  "\\u000E",
  "\\u000F",
  "\\u0010",
  "\\u0011",
  "\\u0012",
  "\\u0013",
  "\\u0014",
  "\\u0015",
  "\\u0016",
  "\\u0017",
  "\\u0018",
  "\\u0019",
  "\\u001A",
  "\\u001B",
  "\\u001C",
  "\\u001D",
  "\\u001E",
  "\\u001F",
  "",
  "",
  '\\"',
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 2F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 3F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 4F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\\\",
  "",
  "",
  "",
  // 5F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 6F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\u007F",
  "\\u0080",
  "\\u0081",
  "\\u0082",
  "\\u0083",
  "\\u0084",
  "\\u0085",
  "\\u0086",
  "\\u0087",
  "\\u0088",
  "\\u0089",
  "\\u008A",
  "\\u008B",
  "\\u008C",
  "\\u008D",
  "\\u008E",
  "\\u008F",
  "\\u0090",
  "\\u0091",
  "\\u0092",
  "\\u0093",
  "\\u0094",
  "\\u0095",
  "\\u0096",
  "\\u0097",
  "\\u0098",
  "\\u0099",
  "\\u009A",
  "\\u009B",
  "\\u009C",
  "\\u009D",
  "\\u009E",
  "\\u009F"
];

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/visitor.mjs
var BREAK = Object.freeze({});
function visit(root, visitor, visitorKeys = QueryDocumentKeys) {
  const enterLeaveMap = /* @__PURE__ */ new Map();
  for (const kind of Object.values(Kind)) {
    enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
  }
  let stack = void 0;
  let inArray = Array.isArray(root);
  let keys = [root];
  let index = -1;
  let edits = [];
  let node = root;
  let key = void 0;
  let parent = void 0;
  const path = [];
  const ancestors = [];
  do {
    index++;
    const isLeaving = index === keys.length;
    const isEdited = isLeaving && edits.length !== 0;
    if (isLeaving) {
      key = ancestors.length === 0 ? void 0 : path[path.length - 1];
      node = parent;
      parent = ancestors.pop();
      if (isEdited) {
        if (inArray) {
          node = node.slice();
          let editOffset = 0;
          for (const [editKey, editValue] of edits) {
            const arrayKey = editKey - editOffset;
            if (editValue === null) {
              node.splice(arrayKey, 1);
              editOffset++;
            } else {
              node[arrayKey] = editValue;
            }
          }
        } else {
          node = Object.defineProperties(
            {},
            Object.getOwnPropertyDescriptors(node)
          );
          for (const [editKey, editValue] of edits) {
            node[editKey] = editValue;
          }
        }
      }
      index = stack.index;
      keys = stack.keys;
      edits = stack.edits;
      inArray = stack.inArray;
      stack = stack.prev;
    } else if (parent) {
      key = inArray ? index : keys[index];
      node = parent[key];
      if (node === null || node === void 0) {
        continue;
      }
      path.push(key);
    }
    let result;
    if (!Array.isArray(node)) {
      var _enterLeaveMap$get, _enterLeaveMap$get2;
      isNode(node) || devAssert(false, `Invalid AST Node: ${inspect(node)}.`);
      const visitFn = isLeaving ? (_enterLeaveMap$get = enterLeaveMap.get(node.kind)) === null || _enterLeaveMap$get === void 0 ? void 0 : _enterLeaveMap$get.leave : (_enterLeaveMap$get2 = enterLeaveMap.get(node.kind)) === null || _enterLeaveMap$get2 === void 0 ? void 0 : _enterLeaveMap$get2.enter;
      result = visitFn === null || visitFn === void 0 ? void 0 : visitFn.call(visitor, node, key, parent, path, ancestors);
      if (result === BREAK) {
        break;
      }
      if (result === false) {
        if (!isLeaving) {
          path.pop();
          continue;
        }
      } else if (result !== void 0) {
        edits.push([key, result]);
        if (!isLeaving) {
          if (isNode(result)) {
            node = result;
          } else {
            path.pop();
            continue;
          }
        }
      }
    }
    if (result === void 0 && isEdited) {
      edits.push([key, node]);
    }
    if (isLeaving) {
      path.pop();
    } else {
      var _node$kind;
      stack = {
        inArray,
        index,
        keys,
        edits,
        prev: stack
      };
      inArray = Array.isArray(node);
      keys = inArray ? node : (_node$kind = visitorKeys[node.kind]) !== null && _node$kind !== void 0 ? _node$kind : [];
      index = -1;
      edits = [];
      if (parent) {
        ancestors.push(parent);
      }
      parent = node;
    }
  } while (stack !== void 0);
  if (edits.length !== 0) {
    return edits[edits.length - 1][1];
  }
  return root;
}
function visitInParallel(visitors) {
  const skipping = new Array(visitors.length).fill(null);
  const mergedVisitor = /* @__PURE__ */ Object.create(null);
  for (const kind of Object.values(Kind)) {
    let hasVisitor = false;
    const enterList = new Array(visitors.length).fill(void 0);
    const leaveList = new Array(visitors.length).fill(void 0);
    for (let i = 0; i < visitors.length; ++i) {
      const { enter, leave } = getEnterLeaveForKind(visitors[i], kind);
      hasVisitor || (hasVisitor = enter != null || leave != null);
      enterList[i] = enter;
      leaveList[i] = leave;
    }
    if (!hasVisitor) {
      continue;
    }
    const mergedEnterLeave = {
      enter(...args) {
        const node = args[0];
        for (let i = 0; i < visitors.length; i++) {
          if (skipping[i] === null) {
            var _enterList$i;
            const result = (_enterList$i = enterList[i]) === null || _enterList$i === void 0 ? void 0 : _enterList$i.apply(visitors[i], args);
            if (result === false) {
              skipping[i] = node;
            } else if (result === BREAK) {
              skipping[i] = BREAK;
            } else if (result !== void 0) {
              return result;
            }
          }
        }
      },
      leave(...args) {
        const node = args[0];
        for (let i = 0; i < visitors.length; i++) {
          if (skipping[i] === null) {
            var _leaveList$i;
            const result = (_leaveList$i = leaveList[i]) === null || _leaveList$i === void 0 ? void 0 : _leaveList$i.apply(visitors[i], args);
            if (result === BREAK) {
              skipping[i] = BREAK;
            } else if (result !== void 0 && result !== false) {
              return result;
            }
          } else if (skipping[i] === node) {
            skipping[i] = null;
          }
        }
      }
    };
    mergedVisitor[kind] = mergedEnterLeave;
  }
  return mergedVisitor;
}
function getEnterLeaveForKind(visitor, kind) {
  const kindVisitor = visitor[kind];
  if (typeof kindVisitor === "object") {
    return kindVisitor;
  } else if (typeof kindVisitor === "function") {
    return {
      enter: kindVisitor,
      leave: void 0
    };
  }
  return {
    enter: visitor.enter,
    leave: visitor.leave
  };
}
function getVisitFn(visitor, kind, isLeaving) {
  const { enter, leave } = getEnterLeaveForKind(visitor, kind);
  return isLeaving ? leave : enter;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/printer.mjs
function print(ast) {
  return visit(ast, printDocASTReducer);
}
var MAX_LINE_LENGTH = 80;
var printDocASTReducer = {
  Name: {
    leave: (node) => node.value
  },
  Variable: {
    leave: (node) => "$" + node.name
  },
  // Document
  Document: {
    leave: (node) => join(node.definitions, "\n\n")
  },
  OperationDefinition: {
    leave(node) {
      const varDefs = wrap("(", join(node.variableDefinitions, ", "), ")");
      const prefix = join(
        [
          node.operation,
          join([node.name, varDefs]),
          join(node.directives, " ")
        ],
        " "
      );
      return (prefix === "query" ? "" : prefix + " ") + node.selectionSet;
    }
  },
  VariableDefinition: {
    leave: ({ variable, type, defaultValue, directives }) => variable + ": " + type + wrap(" = ", defaultValue) + wrap(" ", join(directives, " "))
  },
  SelectionSet: {
    leave: ({ selections }) => block(selections)
  },
  Field: {
    leave({ alias, name, arguments: args, directives, selectionSet }) {
      const prefix = wrap("", alias, ": ") + name;
      let argsLine = prefix + wrap("(", join(args, ", "), ")");
      if (argsLine.length > MAX_LINE_LENGTH) {
        argsLine = prefix + wrap("(\n", indent(join(args, "\n")), "\n)");
      }
      return join([argsLine, join(directives, " "), selectionSet], " ");
    }
  },
  Argument: {
    leave: ({ name, value }) => name + ": " + value
  },
  // Fragments
  FragmentSpread: {
    leave: ({ name, directives }) => "..." + name + wrap(" ", join(directives, " "))
  },
  InlineFragment: {
    leave: ({ typeCondition, directives, selectionSet }) => join(
      [
        "...",
        wrap("on ", typeCondition),
        join(directives, " "),
        selectionSet
      ],
      " "
    )
  },
  FragmentDefinition: {
    leave: ({ name, typeCondition, variableDefinitions, directives, selectionSet }) => (
      // or removed in the future.
      `fragment ${name}${wrap("(", join(variableDefinitions, ", "), ")")} on ${typeCondition} ${wrap("", join(directives, " "), " ")}` + selectionSet
    )
  },
  // Value
  IntValue: {
    leave: ({ value }) => value
  },
  FloatValue: {
    leave: ({ value }) => value
  },
  StringValue: {
    leave: ({ value, block: isBlockString }) => isBlockString ? printBlockString(value) : printString(value)
  },
  BooleanValue: {
    leave: ({ value }) => value ? "true" : "false"
  },
  NullValue: {
    leave: () => "null"
  },
  EnumValue: {
    leave: ({ value }) => value
  },
  ListValue: {
    leave: ({ values }) => "[" + join(values, ", ") + "]"
  },
  ObjectValue: {
    leave: ({ fields }) => "{" + join(fields, ", ") + "}"
  },
  ObjectField: {
    leave: ({ name, value }) => name + ": " + value
  },
  // Directive
  Directive: {
    leave: ({ name, arguments: args }) => "@" + name + wrap("(", join(args, ", "), ")")
  },
  // Type
  NamedType: {
    leave: ({ name }) => name
  },
  ListType: {
    leave: ({ type }) => "[" + type + "]"
  },
  NonNullType: {
    leave: ({ type }) => type + "!"
  },
  // Type System Definitions
  SchemaDefinition: {
    leave: ({ description, directives, operationTypes }) => wrap("", description, "\n") + join(["schema", join(directives, " "), block(operationTypes)], " ")
  },
  OperationTypeDefinition: {
    leave: ({ operation, type }) => operation + ": " + type
  },
  ScalarTypeDefinition: {
    leave: ({ description, name, directives }) => wrap("", description, "\n") + join(["scalar", name, join(directives, " ")], " ")
  },
  ObjectTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) => wrap("", description, "\n") + join(
      [
        "type",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  FieldDefinition: {
    leave: ({ description, name, arguments: args, type, directives }) => wrap("", description, "\n") + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + ": " + type + wrap(" ", join(directives, " "))
  },
  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) => wrap("", description, "\n") + join(
      [name + ": " + type, wrap("= ", defaultValue), join(directives, " ")],
      " "
    )
  },
  InterfaceTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) => wrap("", description, "\n") + join(
      [
        "interface",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  UnionTypeDefinition: {
    leave: ({ description, name, directives, types }) => wrap("", description, "\n") + join(
      ["union", name, join(directives, " "), wrap("= ", join(types, " | "))],
      " "
    )
  },
  EnumTypeDefinition: {
    leave: ({ description, name, directives, values }) => wrap("", description, "\n") + join(["enum", name, join(directives, " "), block(values)], " ")
  },
  EnumValueDefinition: {
    leave: ({ description, name, directives }) => wrap("", description, "\n") + join([name, join(directives, " ")], " ")
  },
  InputObjectTypeDefinition: {
    leave: ({ description, name, directives, fields }) => wrap("", description, "\n") + join(["input", name, join(directives, " "), block(fields)], " ")
  },
  DirectiveDefinition: {
    leave: ({ description, name, arguments: args, repeatable, locations }) => wrap("", description, "\n") + "directive @" + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + (repeatable ? " repeatable" : "") + " on " + join(locations, " | ")
  },
  SchemaExtension: {
    leave: ({ directives, operationTypes }) => join(
      ["extend schema", join(directives, " "), block(operationTypes)],
      " "
    )
  },
  ScalarTypeExtension: {
    leave: ({ name, directives }) => join(["extend scalar", name, join(directives, " ")], " ")
  },
  ObjectTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) => join(
      [
        "extend type",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  InterfaceTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) => join(
      [
        "extend interface",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  UnionTypeExtension: {
    leave: ({ name, directives, types }) => join(
      [
        "extend union",
        name,
        join(directives, " "),
        wrap("= ", join(types, " | "))
      ],
      " "
    )
  },
  EnumTypeExtension: {
    leave: ({ name, directives, values }) => join(["extend enum", name, join(directives, " "), block(values)], " ")
  },
  InputObjectTypeExtension: {
    leave: ({ name, directives, fields }) => join(["extend input", name, join(directives, " "), block(fields)], " ")
  }
};
function join(maybeArray, separator = "") {
  var _maybeArray$filter$jo;
  return (_maybeArray$filter$jo = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.filter((x) => x).join(separator)) !== null && _maybeArray$filter$jo !== void 0 ? _maybeArray$filter$jo : "";
}
function block(array) {
  return wrap("{\n", indent(join(array, "\n")), "\n}");
}
function wrap(start, maybeString, end = "") {
  return maybeString != null && maybeString !== "" ? start + maybeString + end : "";
}
function indent(str) {
  return wrap("  ", str.replace(/\n/g, "\n  "));
}
function hasMultilineItems(maybeArray) {
  var _maybeArray$some;
  return (_maybeArray$some = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.some((str) => str.includes("\n"))) !== null && _maybeArray$some !== void 0 ? _maybeArray$some : false;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/valueFromASTUntyped.mjs
function valueFromASTUntyped(valueNode, variables) {
  switch (valueNode.kind) {
    case Kind.NULL:
      return null;
    case Kind.INT:
      return parseInt(valueNode.value, 10);
    case Kind.FLOAT:
      return parseFloat(valueNode.value);
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.BOOLEAN:
      return valueNode.value;
    case Kind.LIST:
      return valueNode.values.map(
        (node) => valueFromASTUntyped(node, variables)
      );
    case Kind.OBJECT:
      return keyValMap(
        valueNode.fields,
        (field) => field.name.value,
        (field) => valueFromASTUntyped(field.value, variables)
      );
    case Kind.VARIABLE:
      return variables === null || variables === void 0 ? void 0 : variables[valueNode.name.value];
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/assertName.mjs
function assertName(name) {
  name != null || devAssert(false, "Must provide name.");
  typeof name === "string" || devAssert(false, "Expected name to be a string.");
  if (name.length === 0) {
    throw new GraphQLError("Expected name to be a non-empty string.");
  }
  for (let i = 1; i < name.length; ++i) {
    if (!isNameContinue(name.charCodeAt(i))) {
      throw new GraphQLError(
        `Names must only contain [_a-zA-Z0-9] but "${name}" does not.`
      );
    }
  }
  if (!isNameStart(name.charCodeAt(0))) {
    throw new GraphQLError(
      `Names must start with [_a-zA-Z] but "${name}" does not.`
    );
  }
  return name;
}
function assertEnumValueName(name) {
  if (name === "true" || name === "false" || name === "null") {
    throw new GraphQLError(`Enum values cannot be named: ${name}`);
  }
  return assertName(name);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/definition.mjs
function isType(type) {
  return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type) || isListType(type) || isNonNullType(type);
}
function assertType(type) {
  if (!isType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL type.`);
  }
  return type;
}
function isScalarType(type) {
  return instanceOf(type, GraphQLScalarType);
}
function assertScalarType(type) {
  if (!isScalarType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
  }
  return type;
}
function isObjectType(type) {
  return instanceOf(type, GraphQLObjectType);
}
function assertObjectType(type) {
  if (!isObjectType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
  }
  return type;
}
function isInterfaceType(type) {
  return instanceOf(type, GraphQLInterfaceType);
}
function assertInterfaceType(type) {
  if (!isInterfaceType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Interface type.`
    );
  }
  return type;
}
function isUnionType(type) {
  return instanceOf(type, GraphQLUnionType);
}
function assertUnionType(type) {
  if (!isUnionType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
  }
  return type;
}
function isEnumType(type) {
  return instanceOf(type, GraphQLEnumType);
}
function assertEnumType(type) {
  if (!isEnumType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
  }
  return type;
}
function isInputObjectType(type) {
  return instanceOf(type, GraphQLInputObjectType);
}
function assertInputObjectType(type) {
  if (!isInputObjectType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Input Object type.`
    );
  }
  return type;
}
function isListType(type) {
  return instanceOf(type, GraphQLList);
}
function assertListType(type) {
  if (!isListType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
  }
  return type;
}
function isNonNullType(type) {
  return instanceOf(type, GraphQLNonNull);
}
function assertNonNullType(type) {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
  }
  return type;
}
function isInputType(type) {
  return isScalarType(type) || isEnumType(type) || isInputObjectType(type) || isWrappingType(type) && isInputType(type.ofType);
}
function assertInputType(type) {
  if (!isInputType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL input type.`);
  }
  return type;
}
function isOutputType(type) {
  return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isWrappingType(type) && isOutputType(type.ofType);
}
function assertOutputType(type) {
  if (!isOutputType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL output type.`);
  }
  return type;
}
function isLeafType(type) {
  return isScalarType(type) || isEnumType(type);
}
function assertLeafType(type) {
  if (!isLeafType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL leaf type.`);
  }
  return type;
}
function isCompositeType(type) {
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}
function assertCompositeType(type) {
  if (!isCompositeType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL composite type.`
    );
  }
  return type;
}
function isAbstractType(type) {
  return isInterfaceType(type) || isUnionType(type);
}
function assertAbstractType(type) {
  if (!isAbstractType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL abstract type.`);
  }
  return type;
}
var GraphQLList = class {
  constructor(ofType) {
    isType(ofType) || devAssert(false, `Expected ${inspect(ofType)} to be a GraphQL type.`);
    this.ofType = ofType;
  }
  get [Symbol.toStringTag]() {
    return "GraphQLList";
  }
  toString() {
    return "[" + String(this.ofType) + "]";
  }
  toJSON() {
    return this.toString();
  }
};
var GraphQLNonNull = class {
  constructor(ofType) {
    isNullableType(ofType) || devAssert(
      false,
      `Expected ${inspect(ofType)} to be a GraphQL nullable type.`
    );
    this.ofType = ofType;
  }
  get [Symbol.toStringTag]() {
    return "GraphQLNonNull";
  }
  toString() {
    return String(this.ofType) + "!";
  }
  toJSON() {
    return this.toString();
  }
};
function isWrappingType(type) {
  return isListType(type) || isNonNullType(type);
}
function assertWrappingType(type) {
  if (!isWrappingType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL wrapping type.`);
  }
  return type;
}
function isNullableType(type) {
  return isType(type) && !isNonNullType(type);
}
function assertNullableType(type) {
  if (!isNullableType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
  }
  return type;
}
function getNullableType(type) {
  if (type) {
    return isNonNullType(type) ? type.ofType : type;
  }
}
function isNamedType(type) {
  return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type);
}
function assertNamedType(type) {
  if (!isNamedType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL named type.`);
  }
  return type;
}
function getNamedType(type) {
  if (type) {
    let unwrappedType = type;
    while (isWrappingType(unwrappedType)) {
      unwrappedType = unwrappedType.ofType;
    }
    return unwrappedType;
  }
}
function resolveReadonlyArrayThunk(thunk) {
  return typeof thunk === "function" ? thunk() : thunk;
}
function resolveObjMapThunk(thunk) {
  return typeof thunk === "function" ? thunk() : thunk;
}
var GraphQLScalarType = class {
  constructor(config) {
    var _config$parseValue, _config$serialize, _config$parseLiteral, _config$extensionASTN;
    const parseValue2 = (_config$parseValue = config.parseValue) !== null && _config$parseValue !== void 0 ? _config$parseValue : identityFunc;
    this.name = assertName(config.name);
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize = (_config$serialize = config.serialize) !== null && _config$serialize !== void 0 ? _config$serialize : identityFunc;
    this.parseValue = parseValue2;
    this.parseLiteral = (_config$parseLiteral = config.parseLiteral) !== null && _config$parseLiteral !== void 0 ? _config$parseLiteral : (node, variables) => parseValue2(valueFromASTUntyped(node, variables));
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN = config.extensionASTNodes) !== null && _config$extensionASTN !== void 0 ? _config$extensionASTN : [];
    config.specifiedByURL == null || typeof config.specifiedByURL === "string" || devAssert(
      false,
      `${this.name} must provide "specifiedByURL" as a string, but got: ${inspect(config.specifiedByURL)}.`
    );
    config.serialize == null || typeof config.serialize === "function" || devAssert(
      false,
      `${this.name} must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.`
    );
    if (config.parseLiteral) {
      typeof config.parseValue === "function" && typeof config.parseLiteral === "function" || devAssert(
        false,
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`
      );
    }
  }
  get [Symbol.toStringTag]() {
    return "GraphQLScalarType";
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      specifiedByURL: this.specifiedByURL,
      serialize: this.serialize,
      parseValue: this.parseValue,
      parseLiteral: this.parseLiteral,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes
    };
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return this.toString();
  }
};
var GraphQLObjectType = class {
  constructor(config) {
    var _config$extensionASTN2;
    this.name = assertName(config.name);
    this.description = config.description;
    this.isTypeOf = config.isTypeOf;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN2 = config.extensionASTNodes) !== null && _config$extensionASTN2 !== void 0 ? _config$extensionASTN2 : [];
    this._fields = () => defineFieldMap(config);
    this._interfaces = () => defineInterfaces(config);
    config.isTypeOf == null || typeof config.isTypeOf === "function" || devAssert(
      false,
      `${this.name} must provide "isTypeOf" as a function, but got: ${inspect(config.isTypeOf)}.`
    );
  }
  get [Symbol.toStringTag]() {
    return "GraphQLObjectType";
  }
  getFields() {
    if (typeof this._fields === "function") {
      this._fields = this._fields();
    }
    return this._fields;
  }
  getInterfaces() {
    if (typeof this._interfaces === "function") {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: fieldsToFieldsConfig(this.getFields()),
      isTypeOf: this.isTypeOf,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes
    };
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return this.toString();
  }
};
function defineInterfaces(config) {
  var _config$interfaces;
  const interfaces = resolveReadonlyArrayThunk(
    (_config$interfaces = config.interfaces) !== null && _config$interfaces !== void 0 ? _config$interfaces : []
  );
  Array.isArray(interfaces) || devAssert(
    false,
    `${config.name} interfaces must be an Array or a function which returns an Array.`
  );
  return interfaces;
}
function defineFieldMap(config) {
  const fieldMap = resolveObjMapThunk(config.fields);
  isPlainObj(fieldMap) || devAssert(
    false,
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`
  );
  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    var _fieldConfig$args;
    isPlainObj(fieldConfig) || devAssert(
      false,
      `${config.name}.${fieldName} field config must be an object.`
    );
    fieldConfig.resolve == null || typeof fieldConfig.resolve === "function" || devAssert(
      false,
      `${config.name}.${fieldName} field resolver must be a function if provided, but got: ${inspect(fieldConfig.resolve)}.`
    );
    const argsConfig = (_fieldConfig$args = fieldConfig.args) !== null && _fieldConfig$args !== void 0 ? _fieldConfig$args : {};
    isPlainObj(argsConfig) || devAssert(
      false,
      `${config.name}.${fieldName} args must be an object with argument names as keys.`
    );
    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      args: defineArguments(argsConfig),
      resolve: fieldConfig.resolve,
      subscribe: fieldConfig.subscribe,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode
    };
  });
}
function defineArguments(config) {
  return Object.entries(config).map(([argName, argConfig]) => ({
    name: assertName(argName),
    description: argConfig.description,
    type: argConfig.type,
    defaultValue: argConfig.defaultValue,
    deprecationReason: argConfig.deprecationReason,
    extensions: toObjMap(argConfig.extensions),
    astNode: argConfig.astNode
  }));
}
function isPlainObj(obj) {
  return isObjectLike(obj) && !Array.isArray(obj);
}
function fieldsToFieldsConfig(fields) {
  return mapValue(fields, (field) => ({
    description: field.description,
    type: field.type,
    args: argsToArgsConfig(field.args),
    resolve: field.resolve,
    subscribe: field.subscribe,
    deprecationReason: field.deprecationReason,
    extensions: field.extensions,
    astNode: field.astNode
  }));
}
function argsToArgsConfig(args) {
  return keyValMap(
    args,
    (arg) => arg.name,
    (arg) => ({
      description: arg.description,
      type: arg.type,
      defaultValue: arg.defaultValue,
      deprecationReason: arg.deprecationReason,
      extensions: arg.extensions,
      astNode: arg.astNode
    })
  );
}
function isRequiredArgument(arg) {
  return isNonNullType(arg.type) && arg.defaultValue === void 0;
}
var GraphQLInterfaceType = class {
  constructor(config) {
    var _config$extensionASTN3;
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN3 = config.extensionASTNodes) !== null && _config$extensionASTN3 !== void 0 ? _config$extensionASTN3 : [];
    this._fields = defineFieldMap.bind(void 0, config);
    this._interfaces = defineInterfaces.bind(void 0, config);
    config.resolveType == null || typeof config.resolveType === "function" || devAssert(
      false,
      `${this.name} must provide "resolveType" as a function, but got: ${inspect(config.resolveType)}.`
    );
  }
  get [Symbol.toStringTag]() {
    return "GraphQLInterfaceType";
  }
  getFields() {
    if (typeof this._fields === "function") {
      this._fields = this._fields();
    }
    return this._fields;
  }
  getInterfaces() {
    if (typeof this._interfaces === "function") {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: fieldsToFieldsConfig(this.getFields()),
      resolveType: this.resolveType,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes
    };
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return this.toString();
  }
};
var GraphQLUnionType = class {
  constructor(config) {
    var _config$extensionASTN4;
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN4 = config.extensionASTNodes) !== null && _config$extensionASTN4 !== void 0 ? _config$extensionASTN4 : [];
    this._types = defineTypes.bind(void 0, config);
    config.resolveType == null || typeof config.resolveType === "function" || devAssert(
      false,
      `${this.name} must provide "resolveType" as a function, but got: ${inspect(config.resolveType)}.`
    );
  }
  get [Symbol.toStringTag]() {
    return "GraphQLUnionType";
  }
  getTypes() {
    if (typeof this._types === "function") {
      this._types = this._types();
    }
    return this._types;
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      types: this.getTypes(),
      resolveType: this.resolveType,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes
    };
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return this.toString();
  }
};
function defineTypes(config) {
  const types = resolveReadonlyArrayThunk(config.types);
  Array.isArray(types) || devAssert(
    false,
    `Must provide Array of types or a function which returns such an array for Union ${config.name}.`
  );
  return types;
}
var GraphQLEnumType = class {
  /* <T> */
  constructor(config) {
    var _config$extensionASTN5;
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN5 = config.extensionASTNodes) !== null && _config$extensionASTN5 !== void 0 ? _config$extensionASTN5 : [];
    this._values = typeof config.values === "function" ? config.values : defineEnumValues(this.name, config.values);
    this._valueLookup = null;
    this._nameLookup = null;
  }
  get [Symbol.toStringTag]() {
    return "GraphQLEnumType";
  }
  getValues() {
    if (typeof this._values === "function") {
      this._values = defineEnumValues(this.name, this._values());
    }
    return this._values;
  }
  getValue(name) {
    if (this._nameLookup === null) {
      this._nameLookup = keyMap(this.getValues(), (value) => value.name);
    }
    return this._nameLookup[name];
  }
  serialize(outputValue) {
    if (this._valueLookup === null) {
      this._valueLookup = new Map(
        this.getValues().map((enumValue2) => [enumValue2.value, enumValue2])
      );
    }
    const enumValue = this._valueLookup.get(outputValue);
    if (enumValue === void 0) {
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`
      );
    }
    return enumValue.name;
  }
  parseValue(inputValue) {
    if (typeof inputValue !== "string") {
      const valueStr = inspect(inputValue);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` + didYouMeanEnumValue(this, valueStr)
      );
    }
    const enumValue = this.getValue(inputValue);
    if (enumValue == null) {
      throw new GraphQLError(
        `Value "${inputValue}" does not exist in "${this.name}" enum.` + didYouMeanEnumValue(this, inputValue)
      );
    }
    return enumValue.value;
  }
  parseLiteral(valueNode, _variables) {
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` + didYouMeanEnumValue(this, valueStr),
        {
          nodes: valueNode
        }
      );
    }
    const enumValue = this.getValue(valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` + didYouMeanEnumValue(this, valueStr),
        {
          nodes: valueNode
        }
      );
    }
    return enumValue.value;
  }
  toConfig() {
    const values = keyValMap(
      this.getValues(),
      (value) => value.name,
      (value) => ({
        description: value.description,
        value: value.value,
        deprecationReason: value.deprecationReason,
        extensions: value.extensions,
        astNode: value.astNode
      })
    );
    return {
      name: this.name,
      description: this.description,
      values,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes
    };
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return this.toString();
  }
};
function didYouMeanEnumValue(enumType, unknownValueStr) {
  const allNames = enumType.getValues().map((value) => value.name);
  const suggestedValues = suggestionList(unknownValueStr, allNames);
  return didYouMean("the enum value", suggestedValues);
}
function defineEnumValues(typeName, valueMap) {
  isPlainObj(valueMap) || devAssert(
    false,
    `${typeName} values must be an object with value names as keys.`
  );
  return Object.entries(valueMap).map(([valueName, valueConfig]) => {
    isPlainObj(valueConfig) || devAssert(
      false,
      `${typeName}.${valueName} must refer to an object with a "value" key representing an internal value but got: ${inspect(valueConfig)}.`
    );
    return {
      name: assertEnumValueName(valueName),
      description: valueConfig.description,
      value: valueConfig.value !== void 0 ? valueConfig.value : valueName,
      deprecationReason: valueConfig.deprecationReason,
      extensions: toObjMap(valueConfig.extensions),
      astNode: valueConfig.astNode
    };
  });
}
var GraphQLInputObjectType = class {
  constructor(config) {
    var _config$extensionASTN6, _config$isOneOf;
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN6 = config.extensionASTNodes) !== null && _config$extensionASTN6 !== void 0 ? _config$extensionASTN6 : [];
    this.isOneOf = (_config$isOneOf = config.isOneOf) !== null && _config$isOneOf !== void 0 ? _config$isOneOf : false;
    this._fields = defineInputFieldMap.bind(void 0, config);
  }
  get [Symbol.toStringTag]() {
    return "GraphQLInputObjectType";
  }
  getFields() {
    if (typeof this._fields === "function") {
      this._fields = this._fields();
    }
    return this._fields;
  }
  toConfig() {
    const fields = mapValue(this.getFields(), (field) => ({
      description: field.description,
      type: field.type,
      defaultValue: field.defaultValue,
      deprecationReason: field.deprecationReason,
      extensions: field.extensions,
      astNode: field.astNode
    }));
    return {
      name: this.name,
      description: this.description,
      fields,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      isOneOf: this.isOneOf
    };
  }
  toString() {
    return this.name;
  }
  toJSON() {
    return this.toString();
  }
};
function defineInputFieldMap(config) {
  const fieldMap = resolveObjMapThunk(config.fields);
  isPlainObj(fieldMap) || devAssert(
    false,
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`
  );
  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    !("resolve" in fieldConfig) || devAssert(
      false,
      `${config.name}.${fieldName} field has a resolve property, but Input Types cannot define resolvers.`
    );
    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      defaultValue: fieldConfig.defaultValue,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode
    };
  });
}
function isRequiredInputField(field) {
  return isNonNullType(field.type) && field.defaultValue === void 0;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/typeComparators.mjs
function isEqualType(typeA, typeB) {
  if (typeA === typeB) {
    return true;
  }
  if (isNonNullType(typeA) && isNonNullType(typeB)) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }
  if (isListType(typeA) && isListType(typeB)) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }
  return false;
}
function isTypeSubTypeOf(schema, maybeSubType, superType) {
  if (maybeSubType === superType) {
    return true;
  }
  if (isNonNullType(superType)) {
    if (isNonNullType(maybeSubType)) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  }
  if (isNonNullType(maybeSubType)) {
    return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
  }
  if (isListType(superType)) {
    if (isListType(maybeSubType)) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  }
  if (isListType(maybeSubType)) {
    return false;
  }
  return isAbstractType(superType) && (isInterfaceType(maybeSubType) || isObjectType(maybeSubType)) && schema.isSubType(superType, maybeSubType);
}
function doTypesOverlap(schema, typeA, typeB) {
  if (typeA === typeB) {
    return true;
  }
  if (isAbstractType(typeA)) {
    if (isAbstractType(typeB)) {
      return schema.getPossibleTypes(typeA).some((type) => schema.isSubType(typeB, type));
    }
    return schema.isSubType(typeA, typeB);
  }
  if (isAbstractType(typeB)) {
    return schema.isSubType(typeB, typeA);
  }
  return false;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/scalars.mjs
var GRAPHQL_MAX_INT = 2147483647;
var GRAPHQL_MIN_INT = -2147483648;
var GraphQLInt = new GraphQLScalarType({
  name: "Int",
  description: "The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.",
  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === "boolean") {
      return coercedValue ? 1 : 0;
    }
    let num = coercedValue;
    if (typeof coercedValue === "string" && coercedValue !== "") {
      num = Number(coercedValue);
    }
    if (typeof num !== "number" || !Number.isInteger(num)) {
      throw new GraphQLError(
        `Int cannot represent non-integer value: ${inspect(coercedValue)}`
      );
    }
    if (num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT) {
      throw new GraphQLError(
        "Int cannot represent non 32-bit signed integer value: " + inspect(coercedValue)
      );
    }
    return num;
  },
  parseValue(inputValue) {
    if (typeof inputValue !== "number" || !Number.isInteger(inputValue)) {
      throw new GraphQLError(
        `Int cannot represent non-integer value: ${inspect(inputValue)}`
      );
    }
    if (inputValue > GRAPHQL_MAX_INT || inputValue < GRAPHQL_MIN_INT) {
      throw new GraphQLError(
        `Int cannot represent non 32-bit signed integer value: ${inputValue}`
      );
    }
    return inputValue;
  },
  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        `Int cannot represent non-integer value: ${print(valueNode)}`,
        {
          nodes: valueNode
        }
      );
    }
    const num = parseInt(valueNode.value, 10);
    if (num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT) {
      throw new GraphQLError(
        `Int cannot represent non 32-bit signed integer value: ${valueNode.value}`,
        {
          nodes: valueNode
        }
      );
    }
    return num;
  }
});
var GraphQLFloat = new GraphQLScalarType({
  name: "Float",
  description: "The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).",
  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === "boolean") {
      return coercedValue ? 1 : 0;
    }
    let num = coercedValue;
    if (typeof coercedValue === "string" && coercedValue !== "") {
      num = Number(coercedValue);
    }
    if (typeof num !== "number" || !Number.isFinite(num)) {
      throw new GraphQLError(
        `Float cannot represent non numeric value: ${inspect(coercedValue)}`
      );
    }
    return num;
  },
  parseValue(inputValue) {
    if (typeof inputValue !== "number" || !Number.isFinite(inputValue)) {
      throw new GraphQLError(
        `Float cannot represent non numeric value: ${inspect(inputValue)}`
      );
    }
    return inputValue;
  },
  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.FLOAT && valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        `Float cannot represent non numeric value: ${print(valueNode)}`,
        valueNode
      );
    }
    return parseFloat(valueNode.value);
  }
});
var GraphQLString = new GraphQLScalarType({
  name: "String",
  description: "The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.",
  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === "string") {
      return coercedValue;
    }
    if (typeof coercedValue === "boolean") {
      return coercedValue ? "true" : "false";
    }
    if (typeof coercedValue === "number" && Number.isFinite(coercedValue)) {
      return coercedValue.toString();
    }
    throw new GraphQLError(
      `String cannot represent value: ${inspect(outputValue)}`
    );
  },
  parseValue(inputValue) {
    if (typeof inputValue !== "string") {
      throw new GraphQLError(
        `String cannot represent a non string value: ${inspect(inputValue)}`
      );
    }
    return inputValue;
  },
  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING) {
      throw new GraphQLError(
        `String cannot represent a non string value: ${print(valueNode)}`,
        {
          nodes: valueNode
        }
      );
    }
    return valueNode.value;
  }
});
var GraphQLBoolean = new GraphQLScalarType({
  name: "Boolean",
  description: "The `Boolean` scalar type represents `true` or `false`.",
  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === "boolean") {
      return coercedValue;
    }
    if (Number.isFinite(coercedValue)) {
      return coercedValue !== 0;
    }
    throw new GraphQLError(
      `Boolean cannot represent a non boolean value: ${inspect(coercedValue)}`
    );
  },
  parseValue(inputValue) {
    if (typeof inputValue !== "boolean") {
      throw new GraphQLError(
        `Boolean cannot represent a non boolean value: ${inspect(inputValue)}`
      );
    }
    return inputValue;
  },
  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.BOOLEAN) {
      throw new GraphQLError(
        `Boolean cannot represent a non boolean value: ${print(valueNode)}`,
        {
          nodes: valueNode
        }
      );
    }
    return valueNode.value;
  }
});
var GraphQLID = new GraphQLScalarType({
  name: "ID",
  description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === "string") {
      return coercedValue;
    }
    if (Number.isInteger(coercedValue)) {
      return String(coercedValue);
    }
    throw new GraphQLError(
      `ID cannot represent value: ${inspect(outputValue)}`
    );
  },
  parseValue(inputValue) {
    if (typeof inputValue === "string") {
      return inputValue;
    }
    if (typeof inputValue === "number" && Number.isInteger(inputValue)) {
      return inputValue.toString();
    }
    throw new GraphQLError(`ID cannot represent value: ${inspect(inputValue)}`);
  },
  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING && valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        "ID cannot represent a non-string and non-integer value: " + print(valueNode),
        {
          nodes: valueNode
        }
      );
    }
    return valueNode.value;
  }
});
var specifiedScalarTypes = Object.freeze([
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID
]);
function isSpecifiedScalarType(type) {
  return specifiedScalarTypes.some(({ name }) => type.name === name);
}
function serializeObject(outputValue) {
  if (isObjectLike(outputValue)) {
    if (typeof outputValue.valueOf === "function") {
      const valueOfResult = outputValue.valueOf();
      if (!isObjectLike(valueOfResult)) {
        return valueOfResult;
      }
    }
    if (typeof outputValue.toJSON === "function") {
      return outputValue.toJSON();
    }
  }
  return outputValue;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/directives.mjs
function isDirective(directive) {
  return instanceOf(directive, GraphQLDirective);
}
function assertDirective(directive) {
  if (!isDirective(directive)) {
    throw new Error(
      `Expected ${inspect(directive)} to be a GraphQL directive.`
    );
  }
  return directive;
}
var GraphQLDirective = class {
  constructor(config) {
    var _config$isRepeatable, _config$args;
    this.name = assertName(config.name);
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = (_config$isRepeatable = config.isRepeatable) !== null && _config$isRepeatable !== void 0 ? _config$isRepeatable : false;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    Array.isArray(config.locations) || devAssert(false, `@${config.name} locations must be an Array.`);
    const args = (_config$args = config.args) !== null && _config$args !== void 0 ? _config$args : {};
    isObjectLike(args) && !Array.isArray(args) || devAssert(
      false,
      `@${config.name} args must be an object with argument names as keys.`
    );
    this.args = defineArguments(args);
  }
  get [Symbol.toStringTag]() {
    return "GraphQLDirective";
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      locations: this.locations,
      args: argsToArgsConfig(this.args),
      isRepeatable: this.isRepeatable,
      extensions: this.extensions,
      astNode: this.astNode
    };
  }
  toString() {
    return "@" + this.name;
  }
  toJSON() {
    return this.toString();
  }
};
var GraphQLIncludeDirective = new GraphQLDirective({
  name: "include",
  description: "Directs the executor to include this field or fragment only when the `if` argument is true.",
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Included when true."
    }
  }
});
var GraphQLSkipDirective = new GraphQLDirective({
  name: "skip",
  description: "Directs the executor to skip this field or fragment when the `if` argument is true.",
  locations: [
    DirectiveLocation.FIELD,
    DirectiveLocation.FRAGMENT_SPREAD,
    DirectiveLocation.INLINE_FRAGMENT
  ],
  args: {
    if: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Skipped when true."
    }
  }
});
var DEFAULT_DEPRECATION_REASON = "No longer supported";
var GraphQLDeprecatedDirective = new GraphQLDirective({
  name: "deprecated",
  description: "Marks an element of a GraphQL schema as no longer supported.",
  locations: [
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.ARGUMENT_DEFINITION,
    DirectiveLocation.INPUT_FIELD_DEFINITION,
    DirectiveLocation.ENUM_VALUE
  ],
  args: {
    reason: {
      type: GraphQLString,
      description: "Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).",
      defaultValue: DEFAULT_DEPRECATION_REASON
    }
  }
});
var GraphQLSpecifiedByDirective = new GraphQLDirective({
  name: "specifiedBy",
  description: "Exposes a URL that specifies the behavior of this scalar.",
  locations: [DirectiveLocation.SCALAR],
  args: {
    url: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The URL that specifies the behavior of this scalar."
    }
  }
});
var GraphQLOneOfDirective = new GraphQLDirective({
  name: "oneOf",
  description: "Indicates exactly one field must be supplied and this field must not be `null`.",
  locations: [DirectiveLocation.INPUT_OBJECT],
  args: {}
});
var specifiedDirectives = Object.freeze([
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
  GraphQLOneOfDirective
]);
function isSpecifiedDirective(directive) {
  return specifiedDirectives.some(({ name }) => name === directive.name);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/isIterableObject.mjs
function isIterableObject(maybeIterable) {
  return typeof maybeIterable === "object" && typeof (maybeIterable === null || maybeIterable === void 0 ? void 0 : maybeIterable[Symbol.iterator]) === "function";
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/astFromValue.mjs
function astFromValue(value, type) {
  if (isNonNullType(type)) {
    const astValue = astFromValue(value, type.ofType);
    if ((astValue === null || astValue === void 0 ? void 0 : astValue.kind) === Kind.NULL) {
      return null;
    }
    return astValue;
  }
  if (value === null) {
    return {
      kind: Kind.NULL
    };
  }
  if (value === void 0) {
    return null;
  }
  if (isListType(type)) {
    const itemType = type.ofType;
    if (isIterableObject(value)) {
      const valuesNodes = [];
      for (const item of value) {
        const itemNode = astFromValue(item, itemType);
        if (itemNode != null) {
          valuesNodes.push(itemNode);
        }
      }
      return {
        kind: Kind.LIST,
        values: valuesNodes
      };
    }
    return astFromValue(value, itemType);
  }
  if (isInputObjectType(type)) {
    if (!isObjectLike(value)) {
      return null;
    }
    const fieldNodes = [];
    for (const field of Object.values(type.getFields())) {
      const fieldValue = astFromValue(value[field.name], field.type);
      if (fieldValue) {
        fieldNodes.push({
          kind: Kind.OBJECT_FIELD,
          name: {
            kind: Kind.NAME,
            value: field.name
          },
          value: fieldValue
        });
      }
    }
    return {
      kind: Kind.OBJECT,
      fields: fieldNodes
    };
  }
  if (isLeafType(type)) {
    const serialized = type.serialize(value);
    if (serialized == null) {
      return null;
    }
    if (typeof serialized === "boolean") {
      return {
        kind: Kind.BOOLEAN,
        value: serialized
      };
    }
    if (typeof serialized === "number" && Number.isFinite(serialized)) {
      const stringNum = String(serialized);
      return integerStringRegExp.test(stringNum) ? {
        kind: Kind.INT,
        value: stringNum
      } : {
        kind: Kind.FLOAT,
        value: stringNum
      };
    }
    if (typeof serialized === "string") {
      if (isEnumType(type)) {
        return {
          kind: Kind.ENUM,
          value: serialized
        };
      }
      if (type === GraphQLID && integerStringRegExp.test(serialized)) {
        return {
          kind: Kind.INT,
          value: serialized
        };
      }
      return {
        kind: Kind.STRING,
        value: serialized
      };
    }
    throw new TypeError(`Cannot convert value to AST: ${inspect(serialized)}.`);
  }
  invariant(false, "Unexpected input type: " + inspect(type));
}
var integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/introspection.mjs
var __Schema = new GraphQLObjectType({
  name: "__Schema",
  description: "A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.",
  fields: () => ({
    description: {
      type: GraphQLString,
      resolve: (schema) => schema.description
    },
    types: {
      description: "A list of all types supported by this server.",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__Type))),
      resolve(schema) {
        return Object.values(schema.getTypeMap());
      }
    },
    queryType: {
      description: "The type that query operations will be rooted at.",
      type: new GraphQLNonNull(__Type),
      resolve: (schema) => schema.getQueryType()
    },
    mutationType: {
      description: "If this server supports mutation, the type that mutation operations will be rooted at.",
      type: __Type,
      resolve: (schema) => schema.getMutationType()
    },
    subscriptionType: {
      description: "If this server support subscription, the type that subscription operations will be rooted at.",
      type: __Type,
      resolve: (schema) => schema.getSubscriptionType()
    },
    directives: {
      description: "A list of all directives supported by this server.",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(__Directive))
      ),
      resolve: (schema) => schema.getDirectives()
    }
  })
});
var __Directive = new GraphQLObjectType({
  name: "__Directive",
  description: "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
  fields: () => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (directive) => directive.name
    },
    description: {
      type: GraphQLString,
      resolve: (directive) => directive.description
    },
    isRepeatable: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (directive) => directive.isRepeatable
    },
    locations: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(__DirectiveLocation))
      ),
      resolve: (directive) => directive.locations
    },
    args: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(__InputValue))
      ),
      args: {
        includeDeprecated: {
          type: GraphQLBoolean,
          defaultValue: false
        }
      },
      resolve(field, { includeDeprecated }) {
        return includeDeprecated ? field.args : field.args.filter((arg) => arg.deprecationReason == null);
      }
    }
  })
});
var __DirectiveLocation = new GraphQLEnumType({
  name: "__DirectiveLocation",
  description: "A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.",
  values: {
    QUERY: {
      value: DirectiveLocation.QUERY,
      description: "Location adjacent to a query operation."
    },
    MUTATION: {
      value: DirectiveLocation.MUTATION,
      description: "Location adjacent to a mutation operation."
    },
    SUBSCRIPTION: {
      value: DirectiveLocation.SUBSCRIPTION,
      description: "Location adjacent to a subscription operation."
    },
    FIELD: {
      value: DirectiveLocation.FIELD,
      description: "Location adjacent to a field."
    },
    FRAGMENT_DEFINITION: {
      value: DirectiveLocation.FRAGMENT_DEFINITION,
      description: "Location adjacent to a fragment definition."
    },
    FRAGMENT_SPREAD: {
      value: DirectiveLocation.FRAGMENT_SPREAD,
      description: "Location adjacent to a fragment spread."
    },
    INLINE_FRAGMENT: {
      value: DirectiveLocation.INLINE_FRAGMENT,
      description: "Location adjacent to an inline fragment."
    },
    VARIABLE_DEFINITION: {
      value: DirectiveLocation.VARIABLE_DEFINITION,
      description: "Location adjacent to a variable definition."
    },
    SCHEMA: {
      value: DirectiveLocation.SCHEMA,
      description: "Location adjacent to a schema definition."
    },
    SCALAR: {
      value: DirectiveLocation.SCALAR,
      description: "Location adjacent to a scalar definition."
    },
    OBJECT: {
      value: DirectiveLocation.OBJECT,
      description: "Location adjacent to an object type definition."
    },
    FIELD_DEFINITION: {
      value: DirectiveLocation.FIELD_DEFINITION,
      description: "Location adjacent to a field definition."
    },
    ARGUMENT_DEFINITION: {
      value: DirectiveLocation.ARGUMENT_DEFINITION,
      description: "Location adjacent to an argument definition."
    },
    INTERFACE: {
      value: DirectiveLocation.INTERFACE,
      description: "Location adjacent to an interface definition."
    },
    UNION: {
      value: DirectiveLocation.UNION,
      description: "Location adjacent to a union definition."
    },
    ENUM: {
      value: DirectiveLocation.ENUM,
      description: "Location adjacent to an enum definition."
    },
    ENUM_VALUE: {
      value: DirectiveLocation.ENUM_VALUE,
      description: "Location adjacent to an enum value definition."
    },
    INPUT_OBJECT: {
      value: DirectiveLocation.INPUT_OBJECT,
      description: "Location adjacent to an input object type definition."
    },
    INPUT_FIELD_DEFINITION: {
      value: DirectiveLocation.INPUT_FIELD_DEFINITION,
      description: "Location adjacent to an input object field definition."
    }
  }
});
var __Type = new GraphQLObjectType({
  name: "__Type",
  description: "The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.",
  fields: () => ({
    kind: {
      type: new GraphQLNonNull(__TypeKind),
      resolve(type) {
        if (isScalarType(type)) {
          return TypeKind.SCALAR;
        }
        if (isObjectType(type)) {
          return TypeKind.OBJECT;
        }
        if (isInterfaceType(type)) {
          return TypeKind.INTERFACE;
        }
        if (isUnionType(type)) {
          return TypeKind.UNION;
        }
        if (isEnumType(type)) {
          return TypeKind.ENUM;
        }
        if (isInputObjectType(type)) {
          return TypeKind.INPUT_OBJECT;
        }
        if (isListType(type)) {
          return TypeKind.LIST;
        }
        if (isNonNullType(type)) {
          return TypeKind.NON_NULL;
        }
        invariant(false, `Unexpected type: "${inspect(type)}".`);
      }
    },
    name: {
      type: GraphQLString,
      resolve: (type) => "name" in type ? type.name : void 0
    },
    description: {
      type: GraphQLString,
      resolve: (type) => (
        /* c8 ignore next */
        "description" in type ? type.description : void 0
      )
    },
    specifiedByURL: {
      type: GraphQLString,
      resolve: (obj) => "specifiedByURL" in obj ? obj.specifiedByURL : void 0
    },
    fields: {
      type: new GraphQLList(new GraphQLNonNull(__Field)),
      args: {
        includeDeprecated: {
          type: GraphQLBoolean,
          defaultValue: false
        }
      },
      resolve(type, { includeDeprecated }) {
        if (isObjectType(type) || isInterfaceType(type)) {
          const fields = Object.values(type.getFields());
          return includeDeprecated ? fields : fields.filter((field) => field.deprecationReason == null);
        }
      }
    },
    interfaces: {
      type: new GraphQLList(new GraphQLNonNull(__Type)),
      resolve(type) {
        if (isObjectType(type) || isInterfaceType(type)) {
          return type.getInterfaces();
        }
      }
    },
    possibleTypes: {
      type: new GraphQLList(new GraphQLNonNull(__Type)),
      resolve(type, _args, _context, { schema }) {
        if (isAbstractType(type)) {
          return schema.getPossibleTypes(type);
        }
      }
    },
    enumValues: {
      type: new GraphQLList(new GraphQLNonNull(__EnumValue)),
      args: {
        includeDeprecated: {
          type: GraphQLBoolean,
          defaultValue: false
        }
      },
      resolve(type, { includeDeprecated }) {
        if (isEnumType(type)) {
          const values = type.getValues();
          return includeDeprecated ? values : values.filter((field) => field.deprecationReason == null);
        }
      }
    },
    inputFields: {
      type: new GraphQLList(new GraphQLNonNull(__InputValue)),
      args: {
        includeDeprecated: {
          type: GraphQLBoolean,
          defaultValue: false
        }
      },
      resolve(type, { includeDeprecated }) {
        if (isInputObjectType(type)) {
          const values = Object.values(type.getFields());
          return includeDeprecated ? values : values.filter((field) => field.deprecationReason == null);
        }
      }
    },
    ofType: {
      type: __Type,
      resolve: (type) => "ofType" in type ? type.ofType : void 0
    },
    isOneOf: {
      type: GraphQLBoolean,
      resolve: (type) => {
        if (isInputObjectType(type)) {
          return type.isOneOf;
        }
      }
    }
  })
});
var __Field = new GraphQLObjectType({
  name: "__Field",
  description: "Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.",
  fields: () => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (field) => field.name
    },
    description: {
      type: GraphQLString,
      resolve: (field) => field.description
    },
    args: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(__InputValue))
      ),
      args: {
        includeDeprecated: {
          type: GraphQLBoolean,
          defaultValue: false
        }
      },
      resolve(field, { includeDeprecated }) {
        return includeDeprecated ? field.args : field.args.filter((arg) => arg.deprecationReason == null);
      }
    },
    type: {
      type: new GraphQLNonNull(__Type),
      resolve: (field) => field.type
    },
    isDeprecated: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (field) => field.deprecationReason != null
    },
    deprecationReason: {
      type: GraphQLString,
      resolve: (field) => field.deprecationReason
    }
  })
});
var __InputValue = new GraphQLObjectType({
  name: "__InputValue",
  description: "Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.",
  fields: () => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (inputValue) => inputValue.name
    },
    description: {
      type: GraphQLString,
      resolve: (inputValue) => inputValue.description
    },
    type: {
      type: new GraphQLNonNull(__Type),
      resolve: (inputValue) => inputValue.type
    },
    defaultValue: {
      type: GraphQLString,
      description: "A GraphQL-formatted string representing the default value for this input value.",
      resolve(inputValue) {
        const { type, defaultValue } = inputValue;
        const valueAST = astFromValue(defaultValue, type);
        return valueAST ? print(valueAST) : null;
      }
    },
    isDeprecated: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (field) => field.deprecationReason != null
    },
    deprecationReason: {
      type: GraphQLString,
      resolve: (obj) => obj.deprecationReason
    }
  })
});
var __EnumValue = new GraphQLObjectType({
  name: "__EnumValue",
  description: "One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.",
  fields: () => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (enumValue) => enumValue.name
    },
    description: {
      type: GraphQLString,
      resolve: (enumValue) => enumValue.description
    },
    isDeprecated: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (enumValue) => enumValue.deprecationReason != null
    },
    deprecationReason: {
      type: GraphQLString,
      resolve: (enumValue) => enumValue.deprecationReason
    }
  })
});
var TypeKind;
(function(TypeKind2) {
  TypeKind2["SCALAR"] = "SCALAR";
  TypeKind2["OBJECT"] = "OBJECT";
  TypeKind2["INTERFACE"] = "INTERFACE";
  TypeKind2["UNION"] = "UNION";
  TypeKind2["ENUM"] = "ENUM";
  TypeKind2["INPUT_OBJECT"] = "INPUT_OBJECT";
  TypeKind2["LIST"] = "LIST";
  TypeKind2["NON_NULL"] = "NON_NULL";
})(TypeKind || (TypeKind = {}));
var __TypeKind = new GraphQLEnumType({
  name: "__TypeKind",
  description: "An enum describing what kind of type a given `__Type` is.",
  values: {
    SCALAR: {
      value: TypeKind.SCALAR,
      description: "Indicates this type is a scalar."
    },
    OBJECT: {
      value: TypeKind.OBJECT,
      description: "Indicates this type is an object. `fields` and `interfaces` are valid fields."
    },
    INTERFACE: {
      value: TypeKind.INTERFACE,
      description: "Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields."
    },
    UNION: {
      value: TypeKind.UNION,
      description: "Indicates this type is a union. `possibleTypes` is a valid field."
    },
    ENUM: {
      value: TypeKind.ENUM,
      description: "Indicates this type is an enum. `enumValues` is a valid field."
    },
    INPUT_OBJECT: {
      value: TypeKind.INPUT_OBJECT,
      description: "Indicates this type is an input object. `inputFields` is a valid field."
    },
    LIST: {
      value: TypeKind.LIST,
      description: "Indicates this type is a list. `ofType` is a valid field."
    },
    NON_NULL: {
      value: TypeKind.NON_NULL,
      description: "Indicates this type is a non-null. `ofType` is a valid field."
    }
  }
});
var SchemaMetaFieldDef = {
  name: "__schema",
  type: new GraphQLNonNull(__Schema),
  description: "Access the current type schema of this server.",
  args: [],
  resolve: (_source, _args, _context, { schema }) => schema,
  deprecationReason: void 0,
  extensions: /* @__PURE__ */ Object.create(null),
  astNode: void 0
};
var TypeMetaFieldDef = {
  name: "__type",
  type: __Type,
  description: "Request the type information of a single type.",
  args: [
    {
      name: "name",
      description: void 0,
      type: new GraphQLNonNull(GraphQLString),
      defaultValue: void 0,
      deprecationReason: void 0,
      extensions: /* @__PURE__ */ Object.create(null),
      astNode: void 0
    }
  ],
  resolve: (_source, { name }, _context, { schema }) => schema.getType(name),
  deprecationReason: void 0,
  extensions: /* @__PURE__ */ Object.create(null),
  astNode: void 0
};
var TypeNameMetaFieldDef = {
  name: "__typename",
  type: new GraphQLNonNull(GraphQLString),
  description: "The name of the current Object type at runtime.",
  args: [],
  resolve: (_source, _args, _context, { parentType }) => parentType.name,
  deprecationReason: void 0,
  extensions: /* @__PURE__ */ Object.create(null),
  astNode: void 0
};
var introspectionTypes = Object.freeze([
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind
]);
function isIntrospectionType(type) {
  return introspectionTypes.some(({ name }) => type.name === name);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/schema.mjs
function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema);
}
function assertSchema(schema) {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }
  return schema;
}
var GraphQLSchema = class {
  // Used as a cache for validateSchema().
  constructor(config) {
    var _config$extensionASTN, _config$directives;
    this.__validationErrors = config.assumeValid === true ? [] : void 0;
    isObjectLike(config) || devAssert(false, "Must provide configuration object.");
    !config.types || Array.isArray(config.types) || devAssert(
      false,
      `"types" must be Array if provided but got: ${inspect(config.types)}.`
    );
    !config.directives || Array.isArray(config.directives) || devAssert(
      false,
      `"directives" must be Array if provided but got: ${inspect(config.directives)}.`
    );
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = (_config$extensionASTN = config.extensionASTNodes) !== null && _config$extensionASTN !== void 0 ? _config$extensionASTN : [];
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    this._directives = (_config$directives = config.directives) !== null && _config$directives !== void 0 ? _config$directives : specifiedDirectives;
    const allReferencedTypes = new Set(config.types);
    if (config.types != null) {
      for (const type of config.types) {
        allReferencedTypes.delete(type);
        collectReferencedTypes(type, allReferencedTypes);
      }
    }
    if (this._queryType != null) {
      collectReferencedTypes(this._queryType, allReferencedTypes);
    }
    if (this._mutationType != null) {
      collectReferencedTypes(this._mutationType, allReferencedTypes);
    }
    if (this._subscriptionType != null) {
      collectReferencedTypes(this._subscriptionType, allReferencedTypes);
    }
    for (const directive of this._directives) {
      if (isDirective(directive)) {
        for (const arg of directive.args) {
          collectReferencedTypes(arg.type, allReferencedTypes);
        }
      }
    }
    collectReferencedTypes(__Schema, allReferencedTypes);
    this._typeMap = /* @__PURE__ */ Object.create(null);
    this._subTypeMap = /* @__PURE__ */ Object.create(null);
    this._implementationsMap = /* @__PURE__ */ Object.create(null);
    for (const namedType of allReferencedTypes) {
      if (namedType == null) {
        continue;
      }
      const typeName = namedType.name;
      typeName || devAssert(
        false,
        "One of the provided types for building the Schema is missing a name."
      );
      if (this._typeMap[typeName] !== void 0) {
        throw new Error(
          `Schema must contain uniquely named types but contains multiple types named "${typeName}".`
        );
      }
      this._typeMap[typeName] = namedType;
      if (isInterfaceType(namedType)) {
        for (const iface of namedType.getInterfaces()) {
          if (isInterfaceType(iface)) {
            let implementations = this._implementationsMap[iface.name];
            if (implementations === void 0) {
              implementations = this._implementationsMap[iface.name] = {
                objects: [],
                interfaces: []
              };
            }
            implementations.interfaces.push(namedType);
          }
        }
      } else if (isObjectType(namedType)) {
        for (const iface of namedType.getInterfaces()) {
          if (isInterfaceType(iface)) {
            let implementations = this._implementationsMap[iface.name];
            if (implementations === void 0) {
              implementations = this._implementationsMap[iface.name] = {
                objects: [],
                interfaces: []
              };
            }
            implementations.objects.push(namedType);
          }
        }
      }
    }
  }
  get [Symbol.toStringTag]() {
    return "GraphQLSchema";
  }
  getQueryType() {
    return this._queryType;
  }
  getMutationType() {
    return this._mutationType;
  }
  getSubscriptionType() {
    return this._subscriptionType;
  }
  getRootType(operation) {
    switch (operation) {
      case OperationTypeNode.QUERY:
        return this.getQueryType();
      case OperationTypeNode.MUTATION:
        return this.getMutationType();
      case OperationTypeNode.SUBSCRIPTION:
        return this.getSubscriptionType();
    }
  }
  getTypeMap() {
    return this._typeMap;
  }
  getType(name) {
    return this.getTypeMap()[name];
  }
  getPossibleTypes(abstractType) {
    return isUnionType(abstractType) ? abstractType.getTypes() : this.getImplementations(abstractType).objects;
  }
  getImplementations(interfaceType) {
    const implementations = this._implementationsMap[interfaceType.name];
    return implementations !== null && implementations !== void 0 ? implementations : {
      objects: [],
      interfaces: []
    };
  }
  isSubType(abstractType, maybeSubType) {
    let map = this._subTypeMap[abstractType.name];
    if (map === void 0) {
      map = /* @__PURE__ */ Object.create(null);
      if (isUnionType(abstractType)) {
        for (const type of abstractType.getTypes()) {
          map[type.name] = true;
        }
      } else {
        const implementations = this.getImplementations(abstractType);
        for (const type of implementations.objects) {
          map[type.name] = true;
        }
        for (const type of implementations.interfaces) {
          map[type.name] = true;
        }
      }
      this._subTypeMap[abstractType.name] = map;
    }
    return map[maybeSubType.name] !== void 0;
  }
  getDirectives() {
    return this._directives;
  }
  getDirective(name) {
    return this.getDirectives().find((directive) => directive.name === name);
  }
  toConfig() {
    return {
      description: this.description,
      query: this.getQueryType(),
      mutation: this.getMutationType(),
      subscription: this.getSubscriptionType(),
      types: Object.values(this.getTypeMap()),
      directives: this.getDirectives(),
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      assumeValid: this.__validationErrors !== void 0
    };
  }
};
function collectReferencedTypes(type, typeSet) {
  const namedType = getNamedType(type);
  if (!typeSet.has(namedType)) {
    typeSet.add(namedType);
    if (isUnionType(namedType)) {
      for (const memberType of namedType.getTypes()) {
        collectReferencedTypes(memberType, typeSet);
      }
    } else if (isObjectType(namedType) || isInterfaceType(namedType)) {
      for (const interfaceType of namedType.getInterfaces()) {
        collectReferencedTypes(interfaceType, typeSet);
      }
      for (const field of Object.values(namedType.getFields())) {
        collectReferencedTypes(field.type, typeSet);
        for (const arg of field.args) {
          collectReferencedTypes(arg.type, typeSet);
        }
      }
    } else if (isInputObjectType(namedType)) {
      for (const field of Object.values(namedType.getFields())) {
        collectReferencedTypes(field.type, typeSet);
      }
    }
  }
  return typeSet;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/type/validate.mjs
function validateSchema(schema) {
  assertSchema(schema);
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }
  const context = new SchemaValidationContext(schema);
  validateRootTypes(context);
  validateDirectives(context);
  validateTypes(context);
  const errors = context.getErrors();
  schema.__validationErrors = errors;
  return errors;
}
function assertValidSchema(schema) {
  const errors = validateSchema(schema);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join("\n\n"));
  }
}
var SchemaValidationContext = class {
  constructor(schema) {
    this._errors = [];
    this.schema = schema;
  }
  reportError(message, nodes) {
    const _nodes = Array.isArray(nodes) ? nodes.filter(Boolean) : nodes;
    this._errors.push(
      new GraphQLError(message, {
        nodes: _nodes
      })
    );
  }
  getErrors() {
    return this._errors;
  }
};
function validateRootTypes(context) {
  const schema = context.schema;
  const queryType = schema.getQueryType();
  if (!queryType) {
    context.reportError("Query root type must be provided.", schema.astNode);
  } else if (!isObjectType(queryType)) {
    var _getOperationTypeNode;
    context.reportError(
      `Query root type must be Object type, it cannot be ${inspect(
        queryType
      )}.`,
      (_getOperationTypeNode = getOperationTypeNode(
        schema,
        OperationTypeNode.QUERY
      )) !== null && _getOperationTypeNode !== void 0 ? _getOperationTypeNode : queryType.astNode
    );
  }
  const mutationType = schema.getMutationType();
  if (mutationType && !isObjectType(mutationType)) {
    var _getOperationTypeNode2;
    context.reportError(
      `Mutation root type must be Object type if provided, it cannot be ${inspect(mutationType)}.`,
      (_getOperationTypeNode2 = getOperationTypeNode(
        schema,
        OperationTypeNode.MUTATION
      )) !== null && _getOperationTypeNode2 !== void 0 ? _getOperationTypeNode2 : mutationType.astNode
    );
  }
  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !isObjectType(subscriptionType)) {
    var _getOperationTypeNode3;
    context.reportError(
      `Subscription root type must be Object type if provided, it cannot be ${inspect(subscriptionType)}.`,
      (_getOperationTypeNode3 = getOperationTypeNode(
        schema,
        OperationTypeNode.SUBSCRIPTION
      )) !== null && _getOperationTypeNode3 !== void 0 ? _getOperationTypeNode3 : subscriptionType.astNode
    );
  }
}
function getOperationTypeNode(schema, operation) {
  var _flatMap$find;
  return (_flatMap$find = [schema.astNode, ...schema.extensionASTNodes].flatMap(
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    (schemaNode) => {
      var _schemaNode$operation;
      return (
        /* c8 ignore next */
        (_schemaNode$operation = schemaNode === null || schemaNode === void 0 ? void 0 : schemaNode.operationTypes) !== null && _schemaNode$operation !== void 0 ? _schemaNode$operation : []
      );
    }
  ).find((operationNode) => operationNode.operation === operation)) === null || _flatMap$find === void 0 ? void 0 : _flatMap$find.type;
}
function validateDirectives(context) {
  for (const directive of context.schema.getDirectives()) {
    if (!isDirective(directive)) {
      context.reportError(
        `Expected directive but got: ${inspect(directive)}.`,
        directive === null || directive === void 0 ? void 0 : directive.astNode
      );
      continue;
    }
    validateName(context, directive);
    for (const arg of directive.args) {
      validateName(context, arg);
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of @${directive.name}(${arg.name}:) must be Input Type but got: ${inspect(arg.type)}.`,
          arg.astNode
        );
      }
      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        var _arg$astNode;
        context.reportError(
          `Required argument @${directive.name}(${arg.name}:) cannot be deprecated.`,
          [
            getDeprecatedDirectiveNode(arg.astNode),
            (_arg$astNode = arg.astNode) === null || _arg$astNode === void 0 ? void 0 : _arg$astNode.type
          ]
        );
      }
    }
  }
}
function validateName(context, node) {
  if (node.name.startsWith("__")) {
    context.reportError(
      `Name "${node.name}" must not begin with "__", which is reserved by GraphQL introspection.`,
      node.astNode
    );
  }
}
function validateTypes(context) {
  const validateInputObjectCircularRefs = createInputObjectCircularRefsValidator(context);
  const typeMap = context.schema.getTypeMap();
  for (const type of Object.values(typeMap)) {
    if (!isNamedType(type)) {
      context.reportError(
        `Expected GraphQL named type but got: ${inspect(type)}.`,
        type.astNode
      );
      continue;
    }
    if (!isIntrospectionType(type)) {
      validateName(context, type);
    }
    if (isObjectType(type)) {
      validateFields(context, type);
      validateInterfaces(context, type);
    } else if (isInterfaceType(type)) {
      validateFields(context, type);
      validateInterfaces(context, type);
    } else if (isUnionType(type)) {
      validateUnionMembers(context, type);
    } else if (isEnumType(type)) {
      validateEnumValues(context, type);
    } else if (isInputObjectType(type)) {
      validateInputFields(context, type);
      validateInputObjectCircularRefs(type);
    }
  }
}
function validateFields(context, type) {
  const fields = Object.values(type.getFields());
  if (fields.length === 0) {
    context.reportError(`Type ${type.name} must define one or more fields.`, [
      type.astNode,
      ...type.extensionASTNodes
    ]);
  }
  for (const field of fields) {
    validateName(context, field);
    if (!isOutputType(field.type)) {
      var _field$astNode;
      context.reportError(
        `The type of ${type.name}.${field.name} must be Output Type but got: ${inspect(field.type)}.`,
        (_field$astNode = field.astNode) === null || _field$astNode === void 0 ? void 0 : _field$astNode.type
      );
    }
    for (const arg of field.args) {
      const argName = arg.name;
      validateName(context, arg);
      if (!isInputType(arg.type)) {
        var _arg$astNode2;
        context.reportError(
          `The type of ${type.name}.${field.name}(${argName}:) must be Input Type but got: ${inspect(arg.type)}.`,
          (_arg$astNode2 = arg.astNode) === null || _arg$astNode2 === void 0 ? void 0 : _arg$astNode2.type
        );
      }
      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        var _arg$astNode3;
        context.reportError(
          `Required argument ${type.name}.${field.name}(${argName}:) cannot be deprecated.`,
          [
            getDeprecatedDirectiveNode(arg.astNode),
            (_arg$astNode3 = arg.astNode) === null || _arg$astNode3 === void 0 ? void 0 : _arg$astNode3.type
          ]
        );
      }
    }
  }
}
function validateInterfaces(context, type) {
  const ifaceTypeNames = /* @__PURE__ */ Object.create(null);
  for (const iface of type.getInterfaces()) {
    if (!isInterfaceType(iface)) {
      context.reportError(
        `Type ${inspect(type)} must only implement Interface types, it cannot implement ${inspect(iface)}.`,
        getAllImplementsInterfaceNodes(type, iface)
      );
      continue;
    }
    if (type === iface) {
      context.reportError(
        `Type ${type.name} cannot implement itself because it would create a circular reference.`,
        getAllImplementsInterfaceNodes(type, iface)
      );
      continue;
    }
    if (ifaceTypeNames[iface.name]) {
      context.reportError(
        `Type ${type.name} can only implement ${iface.name} once.`,
        getAllImplementsInterfaceNodes(type, iface)
      );
      continue;
    }
    ifaceTypeNames[iface.name] = true;
    validateTypeImplementsAncestors(context, type, iface);
    validateTypeImplementsInterface(context, type, iface);
  }
}
function validateTypeImplementsInterface(context, type, iface) {
  const typeFieldMap = type.getFields();
  for (const ifaceField of Object.values(iface.getFields())) {
    const fieldName = ifaceField.name;
    const typeField = typeFieldMap[fieldName];
    if (!typeField) {
      context.reportError(
        `Interface field ${iface.name}.${fieldName} expected but ${type.name} does not provide it.`,
        [ifaceField.astNode, type.astNode, ...type.extensionASTNodes]
      );
      continue;
    }
    if (!isTypeSubTypeOf(context.schema, typeField.type, ifaceField.type)) {
      var _ifaceField$astNode, _typeField$astNode;
      context.reportError(
        `Interface field ${iface.name}.${fieldName} expects type ${inspect(ifaceField.type)} but ${type.name}.${fieldName} is type ${inspect(typeField.type)}.`,
        [
          (_ifaceField$astNode = ifaceField.astNode) === null || _ifaceField$astNode === void 0 ? void 0 : _ifaceField$astNode.type,
          (_typeField$astNode = typeField.astNode) === null || _typeField$astNode === void 0 ? void 0 : _typeField$astNode.type
        ]
      );
    }
    for (const ifaceArg of ifaceField.args) {
      const argName = ifaceArg.name;
      const typeArg = typeField.args.find((arg) => arg.name === argName);
      if (!typeArg) {
        context.reportError(
          `Interface field argument ${iface.name}.${fieldName}(${argName}:) expected but ${type.name}.${fieldName} does not provide it.`,
          [ifaceArg.astNode, typeField.astNode]
        );
        continue;
      }
      if (!isEqualType(ifaceArg.type, typeArg.type)) {
        var _ifaceArg$astNode, _typeArg$astNode;
        context.reportError(
          `Interface field argument ${iface.name}.${fieldName}(${argName}:) expects type ${inspect(ifaceArg.type)} but ${type.name}.${fieldName}(${argName}:) is type ${inspect(typeArg.type)}.`,
          [
            (_ifaceArg$astNode = ifaceArg.astNode) === null || _ifaceArg$astNode === void 0 ? void 0 : _ifaceArg$astNode.type,
            (_typeArg$astNode = typeArg.astNode) === null || _typeArg$astNode === void 0 ? void 0 : _typeArg$astNode.type
          ]
        );
      }
    }
    for (const typeArg of typeField.args) {
      const argName = typeArg.name;
      const ifaceArg = ifaceField.args.find((arg) => arg.name === argName);
      if (!ifaceArg && isRequiredArgument(typeArg)) {
        context.reportError(
          `Object field ${type.name}.${fieldName} includes required argument ${argName} that is missing from the Interface field ${iface.name}.${fieldName}.`,
          [typeArg.astNode, ifaceField.astNode]
        );
      }
    }
  }
}
function validateTypeImplementsAncestors(context, type, iface) {
  const ifaceInterfaces = type.getInterfaces();
  for (const transitive of iface.getInterfaces()) {
    if (!ifaceInterfaces.includes(transitive)) {
      context.reportError(
        transitive === type ? `Type ${type.name} cannot implement ${iface.name} because it would create a circular reference.` : `Type ${type.name} must implement ${transitive.name} because it is implemented by ${iface.name}.`,
        [
          ...getAllImplementsInterfaceNodes(iface, transitive),
          ...getAllImplementsInterfaceNodes(type, iface)
        ]
      );
    }
  }
}
function validateUnionMembers(context, union) {
  const memberTypes = union.getTypes();
  if (memberTypes.length === 0) {
    context.reportError(
      `Union type ${union.name} must define one or more member types.`,
      [union.astNode, ...union.extensionASTNodes]
    );
  }
  const includedTypeNames = /* @__PURE__ */ Object.create(null);
  for (const memberType of memberTypes) {
    if (includedTypeNames[memberType.name]) {
      context.reportError(
        `Union type ${union.name} can only include type ${memberType.name} once.`,
        getUnionMemberTypeNodes(union, memberType.name)
      );
      continue;
    }
    includedTypeNames[memberType.name] = true;
    if (!isObjectType(memberType)) {
      context.reportError(
        `Union type ${union.name} can only include Object types, it cannot include ${inspect(memberType)}.`,
        getUnionMemberTypeNodes(union, String(memberType))
      );
    }
  }
}
function validateEnumValues(context, enumType) {
  const enumValues = enumType.getValues();
  if (enumValues.length === 0) {
    context.reportError(
      `Enum type ${enumType.name} must define one or more values.`,
      [enumType.astNode, ...enumType.extensionASTNodes]
    );
  }
  for (const enumValue of enumValues) {
    validateName(context, enumValue);
  }
}
function validateInputFields(context, inputObj) {
  const fields = Object.values(inputObj.getFields());
  if (fields.length === 0) {
    context.reportError(
      `Input Object type ${inputObj.name} must define one or more fields.`,
      [inputObj.astNode, ...inputObj.extensionASTNodes]
    );
  }
  for (const field of fields) {
    validateName(context, field);
    if (!isInputType(field.type)) {
      var _field$astNode2;
      context.reportError(
        `The type of ${inputObj.name}.${field.name} must be Input Type but got: ${inspect(field.type)}.`,
        (_field$astNode2 = field.astNode) === null || _field$astNode2 === void 0 ? void 0 : _field$astNode2.type
      );
    }
    if (isRequiredInputField(field) && field.deprecationReason != null) {
      var _field$astNode3;
      context.reportError(
        `Required input field ${inputObj.name}.${field.name} cannot be deprecated.`,
        [
          getDeprecatedDirectiveNode(field.astNode),
          (_field$astNode3 = field.astNode) === null || _field$astNode3 === void 0 ? void 0 : _field$astNode3.type
        ]
      );
    }
    if (inputObj.isOneOf) {
      validateOneOfInputObjectField(inputObj, field, context);
    }
  }
}
function validateOneOfInputObjectField(type, field, context) {
  if (isNonNullType(field.type)) {
    var _field$astNode4;
    context.reportError(
      `OneOf input field ${type.name}.${field.name} must be nullable.`,
      (_field$astNode4 = field.astNode) === null || _field$astNode4 === void 0 ? void 0 : _field$astNode4.type
    );
  }
  if (field.defaultValue !== void 0) {
    context.reportError(
      `OneOf input field ${type.name}.${field.name} cannot have a default value.`,
      field.astNode
    );
  }
}
function createInputObjectCircularRefsValidator(context) {
  const visitedTypes = /* @__PURE__ */ Object.create(null);
  const fieldPath = [];
  const fieldPathIndexByTypeName = /* @__PURE__ */ Object.create(null);
  return detectCycleRecursive;
  function detectCycleRecursive(inputObj) {
    if (visitedTypes[inputObj.name]) {
      return;
    }
    visitedTypes[inputObj.name] = true;
    fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;
    const fields = Object.values(inputObj.getFields());
    for (const field of fields) {
      if (isNonNullType(field.type) && isInputObjectType(field.type.ofType)) {
        const fieldType = field.type.ofType;
        const cycleIndex = fieldPathIndexByTypeName[fieldType.name];
        fieldPath.push(field);
        if (cycleIndex === void 0) {
          detectCycleRecursive(fieldType);
        } else {
          const cyclePath = fieldPath.slice(cycleIndex);
          const pathStr = cyclePath.map((fieldObj) => fieldObj.name).join(".");
          context.reportError(
            `Cannot reference Input Object "${fieldType.name}" within itself through a series of non-null fields: "${pathStr}".`,
            cyclePath.map((fieldObj) => fieldObj.astNode)
          );
        }
        fieldPath.pop();
      }
    }
    fieldPathIndexByTypeName[inputObj.name] = void 0;
  }
}
function getAllImplementsInterfaceNodes(type, iface) {
  const { astNode, extensionASTNodes } = type;
  const nodes = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;
  return nodes.flatMap((typeNode) => {
    var _typeNode$interfaces;
    return (
      /* c8 ignore next */
      (_typeNode$interfaces = typeNode.interfaces) !== null && _typeNode$interfaces !== void 0 ? _typeNode$interfaces : []
    );
  }).filter((ifaceNode) => ifaceNode.name.value === iface.name);
}
function getUnionMemberTypeNodes(union, typeName) {
  const { astNode, extensionASTNodes } = union;
  const nodes = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;
  return nodes.flatMap((unionNode) => {
    var _unionNode$types;
    return (
      /* c8 ignore next */
      (_unionNode$types = unionNode.types) !== null && _unionNode$types !== void 0 ? _unionNode$types : []
    );
  }).filter((typeNode) => typeNode.name.value === typeName);
}
function getDeprecatedDirectiveNode(definitionNode) {
  var _definitionNode$direc;
  return definitionNode === null || definitionNode === void 0 ? void 0 : (_definitionNode$direc = definitionNode.directives) === null || _definitionNode$direc === void 0 ? void 0 : _definitionNode$direc.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name
  );
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/typeFromAST.mjs
function typeFromAST(schema, typeNode) {
  switch (typeNode.kind) {
    case Kind.LIST_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new GraphQLList(innerType);
    }
    case Kind.NON_NULL_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new GraphQLNonNull(innerType);
    }
    case Kind.NAMED_TYPE:
      return schema.getType(typeNode.name.value);
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/TypeInfo.mjs
var TypeInfo = class {
  constructor(schema, initialType, getFieldDefFn) {
    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._defaultValueStack = [];
    this._directive = null;
    this._argument = null;
    this._enumValue = null;
    this._getFieldDef = getFieldDefFn !== null && getFieldDefFn !== void 0 ? getFieldDefFn : getFieldDef;
    if (initialType) {
      if (isInputType(initialType)) {
        this._inputTypeStack.push(initialType);
      }
      if (isCompositeType(initialType)) {
        this._parentTypeStack.push(initialType);
      }
      if (isOutputType(initialType)) {
        this._typeStack.push(initialType);
      }
    }
  }
  get [Symbol.toStringTag]() {
    return "TypeInfo";
  }
  getType() {
    if (this._typeStack.length > 0) {
      return this._typeStack[this._typeStack.length - 1];
    }
  }
  getParentType() {
    if (this._parentTypeStack.length > 0) {
      return this._parentTypeStack[this._parentTypeStack.length - 1];
    }
  }
  getInputType() {
    if (this._inputTypeStack.length > 0) {
      return this._inputTypeStack[this._inputTypeStack.length - 1];
    }
  }
  getParentInputType() {
    if (this._inputTypeStack.length > 1) {
      return this._inputTypeStack[this._inputTypeStack.length - 2];
    }
  }
  getFieldDef() {
    if (this._fieldDefStack.length > 0) {
      return this._fieldDefStack[this._fieldDefStack.length - 1];
    }
  }
  getDefaultValue() {
    if (this._defaultValueStack.length > 0) {
      return this._defaultValueStack[this._defaultValueStack.length - 1];
    }
  }
  getDirective() {
    return this._directive;
  }
  getArgument() {
    return this._argument;
  }
  getEnumValue() {
    return this._enumValue;
  }
  enter(node) {
    const schema = this._schema;
    switch (node.kind) {
      case Kind.SELECTION_SET: {
        const namedType = getNamedType(this.getType());
        this._parentTypeStack.push(
          isCompositeType(namedType) ? namedType : void 0
        );
        break;
      }
      case Kind.FIELD: {
        const parentType = this.getParentType();
        let fieldDef;
        let fieldType;
        if (parentType) {
          fieldDef = this._getFieldDef(schema, parentType, node);
          if (fieldDef) {
            fieldType = fieldDef.type;
          }
        }
        this._fieldDefStack.push(fieldDef);
        this._typeStack.push(isOutputType(fieldType) ? fieldType : void 0);
        break;
      }
      case Kind.DIRECTIVE:
        this._directive = schema.getDirective(node.name.value);
        break;
      case Kind.OPERATION_DEFINITION: {
        const rootType = schema.getRootType(node.operation);
        this._typeStack.push(isObjectType(rootType) ? rootType : void 0);
        break;
      }
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION: {
        const typeConditionAST = node.typeCondition;
        const outputType = typeConditionAST ? typeFromAST(schema, typeConditionAST) : getNamedType(this.getType());
        this._typeStack.push(isOutputType(outputType) ? outputType : void 0);
        break;
      }
      case Kind.VARIABLE_DEFINITION: {
        const inputType = typeFromAST(schema, node.type);
        this._inputTypeStack.push(
          isInputType(inputType) ? inputType : void 0
        );
        break;
      }
      case Kind.ARGUMENT: {
        var _this$getDirective;
        let argDef;
        let argType;
        const fieldOrDirective = (_this$getDirective = this.getDirective()) !== null && _this$getDirective !== void 0 ? _this$getDirective : this.getFieldDef();
        if (fieldOrDirective) {
          argDef = fieldOrDirective.args.find(
            (arg) => arg.name === node.name.value
          );
          if (argDef) {
            argType = argDef.type;
          }
        }
        this._argument = argDef;
        this._defaultValueStack.push(argDef ? argDef.defaultValue : void 0);
        this._inputTypeStack.push(isInputType(argType) ? argType : void 0);
        break;
      }
      case Kind.LIST: {
        const listType = getNullableType(this.getInputType());
        const itemType = isListType(listType) ? listType.ofType : listType;
        this._defaultValueStack.push(void 0);
        this._inputTypeStack.push(isInputType(itemType) ? itemType : void 0);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const objectType = getNamedType(this.getInputType());
        let inputFieldType;
        let inputField;
        if (isInputObjectType(objectType)) {
          inputField = objectType.getFields()[node.name.value];
          if (inputField) {
            inputFieldType = inputField.type;
          }
        }
        this._defaultValueStack.push(
          inputField ? inputField.defaultValue : void 0
        );
        this._inputTypeStack.push(
          isInputType(inputFieldType) ? inputFieldType : void 0
        );
        break;
      }
      case Kind.ENUM: {
        const enumType = getNamedType(this.getInputType());
        let enumValue;
        if (isEnumType(enumType)) {
          enumValue = enumType.getValue(node.value);
        }
        this._enumValue = enumValue;
        break;
      }
      default:
    }
  }
  leave(node) {
    switch (node.kind) {
      case Kind.SELECTION_SET:
        this._parentTypeStack.pop();
        break;
      case Kind.FIELD:
        this._fieldDefStack.pop();
        this._typeStack.pop();
        break;
      case Kind.DIRECTIVE:
        this._directive = null;
        break;
      case Kind.OPERATION_DEFINITION:
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION:
        this._typeStack.pop();
        break;
      case Kind.VARIABLE_DEFINITION:
        this._inputTypeStack.pop();
        break;
      case Kind.ARGUMENT:
        this._argument = null;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.ENUM:
        this._enumValue = null;
        break;
      default:
    }
  }
};
function getFieldDef(schema, parentType, fieldNode) {
  const name = fieldNode.name.value;
  if (name === SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  }
  if (name === TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  }
  if (name === TypeNameMetaFieldDef.name && isCompositeType(parentType)) {
    return TypeNameMetaFieldDef;
  }
  if (isObjectType(parentType) || isInterfaceType(parentType)) {
    return parentType.getFields()[name];
  }
}
function visitWithTypeInfo(typeInfo, visitor) {
  return {
    enter(...args) {
      const node = args[0];
      typeInfo.enter(node);
      const fn = getEnterLeaveForKind(visitor, node.kind).enter;
      if (fn) {
        const result = fn.apply(visitor, args);
        if (result !== void 0) {
          typeInfo.leave(node);
          if (isNode(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(...args) {
      const node = args[0];
      const fn = getEnterLeaveForKind(visitor, node.kind).leave;
      let result;
      if (fn) {
        result = fn.apply(visitor, args);
      }
      typeInfo.leave(node);
      return result;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/language/predicates.mjs
function isDefinitionNode(node) {
  return isExecutableDefinitionNode(node) || isTypeSystemDefinitionNode(node) || isTypeSystemExtensionNode(node);
}
function isExecutableDefinitionNode(node) {
  return node.kind === Kind.OPERATION_DEFINITION || node.kind === Kind.FRAGMENT_DEFINITION;
}
function isSelectionNode(node) {
  return node.kind === Kind.FIELD || node.kind === Kind.FRAGMENT_SPREAD || node.kind === Kind.INLINE_FRAGMENT;
}
function isValueNode(node) {
  return node.kind === Kind.VARIABLE || node.kind === Kind.INT || node.kind === Kind.FLOAT || node.kind === Kind.STRING || node.kind === Kind.BOOLEAN || node.kind === Kind.NULL || node.kind === Kind.ENUM || node.kind === Kind.LIST || node.kind === Kind.OBJECT;
}
function isConstValueNode(node) {
  return isValueNode(node) && (node.kind === Kind.LIST ? node.values.some(isConstValueNode) : node.kind === Kind.OBJECT ? node.fields.some((field) => isConstValueNode(field.value)) : node.kind !== Kind.VARIABLE);
}
function isTypeNode(node) {
  return node.kind === Kind.NAMED_TYPE || node.kind === Kind.LIST_TYPE || node.kind === Kind.NON_NULL_TYPE;
}
function isTypeSystemDefinitionNode(node) {
  return node.kind === Kind.SCHEMA_DEFINITION || isTypeDefinitionNode(node) || node.kind === Kind.DIRECTIVE_DEFINITION;
}
function isTypeDefinitionNode(node) {
  return node.kind === Kind.SCALAR_TYPE_DEFINITION || node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.INTERFACE_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION || node.kind === Kind.ENUM_TYPE_DEFINITION || node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION;
}
function isTypeSystemExtensionNode(node) {
  return node.kind === Kind.SCHEMA_EXTENSION || isTypeExtensionNode(node);
}
function isTypeExtensionNode(node) {
  return node.kind === Kind.SCALAR_TYPE_EXTENSION || node.kind === Kind.OBJECT_TYPE_EXTENSION || node.kind === Kind.INTERFACE_TYPE_EXTENSION || node.kind === Kind.UNION_TYPE_EXTENSION || node.kind === Kind.ENUM_TYPE_EXTENSION || node.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/ExecutableDefinitionsRule.mjs
function ExecutableDefinitionsRule(context) {
  return {
    Document(node) {
      for (const definition of node.definitions) {
        if (!isExecutableDefinitionNode(definition)) {
          const defName = definition.kind === Kind.SCHEMA_DEFINITION || definition.kind === Kind.SCHEMA_EXTENSION ? "schema" : '"' + definition.name.value + '"';
          context.reportError(
            new GraphQLError(`The ${defName} definition is not executable.`, {
              nodes: definition
            })
          );
        }
      }
      return false;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/FieldsOnCorrectTypeRule.mjs
function FieldsOnCorrectTypeRule(context) {
  return {
    Field(node) {
      const type = context.getParentType();
      if (type) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          const schema = context.getSchema();
          const fieldName = node.name.value;
          let suggestion = didYouMean(
            "to use an inline fragment on",
            getSuggestedTypeNames(schema, type, fieldName)
          );
          if (suggestion === "") {
            suggestion = didYouMean(getSuggestedFieldNames(type, fieldName));
          }
          context.reportError(
            new GraphQLError(
              `Cannot query field "${fieldName}" on type "${type.name}".` + suggestion,
              {
                nodes: node
              }
            )
          );
        }
      }
    }
  };
}
function getSuggestedTypeNames(schema, type, fieldName) {
  if (!isAbstractType(type)) {
    return [];
  }
  const suggestedTypes = /* @__PURE__ */ new Set();
  const usageCount = /* @__PURE__ */ Object.create(null);
  for (const possibleType of schema.getPossibleTypes(type)) {
    if (!possibleType.getFields()[fieldName]) {
      continue;
    }
    suggestedTypes.add(possibleType);
    usageCount[possibleType.name] = 1;
    for (const possibleInterface of possibleType.getInterfaces()) {
      var _usageCount$possibleI;
      if (!possibleInterface.getFields()[fieldName]) {
        continue;
      }
      suggestedTypes.add(possibleInterface);
      usageCount[possibleInterface.name] = ((_usageCount$possibleI = usageCount[possibleInterface.name]) !== null && _usageCount$possibleI !== void 0 ? _usageCount$possibleI : 0) + 1;
    }
  }
  return [...suggestedTypes].sort((typeA, typeB) => {
    const usageCountDiff = usageCount[typeB.name] - usageCount[typeA.name];
    if (usageCountDiff !== 0) {
      return usageCountDiff;
    }
    if (isInterfaceType(typeA) && schema.isSubType(typeA, typeB)) {
      return -1;
    }
    if (isInterfaceType(typeB) && schema.isSubType(typeB, typeA)) {
      return 1;
    }
    return naturalCompare(typeA.name, typeB.name);
  }).map((x) => x.name);
}
function getSuggestedFieldNames(type, fieldName) {
  if (isObjectType(type) || isInterfaceType(type)) {
    const possibleFieldNames = Object.keys(type.getFields());
    return suggestionList(fieldName, possibleFieldNames);
  }
  return [];
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/FragmentsOnCompositeTypesRule.mjs
function FragmentsOnCompositeTypesRule(context) {
  return {
    InlineFragment(node) {
      const typeCondition = node.typeCondition;
      if (typeCondition) {
        const type = typeFromAST(context.getSchema(), typeCondition);
        if (type && !isCompositeType(type)) {
          const typeStr = print(typeCondition);
          context.reportError(
            new GraphQLError(
              `Fragment cannot condition on non composite type "${typeStr}".`,
              {
                nodes: typeCondition
              }
            )
          );
        }
      }
    },
    FragmentDefinition(node) {
      const type = typeFromAST(context.getSchema(), node.typeCondition);
      if (type && !isCompositeType(type)) {
        const typeStr = print(node.typeCondition);
        context.reportError(
          new GraphQLError(
            `Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`,
            {
              nodes: node.typeCondition
            }
          )
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/KnownArgumentNamesRule.mjs
function KnownArgumentNamesRule(context) {
  return {
    // eslint-disable-next-line new-cap
    ...KnownArgumentNamesOnDirectivesRule(context),
    Argument(argNode) {
      const argDef = context.getArgument();
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();
      if (!argDef && fieldDef && parentType) {
        const argName = argNode.name.value;
        const knownArgsNames = fieldDef.args.map((arg) => arg.name);
        const suggestions = suggestionList(argName, knownArgsNames);
        context.reportError(
          new GraphQLError(
            `Unknown argument "${argName}" on field "${parentType.name}.${fieldDef.name}".` + didYouMean(suggestions),
            {
              nodes: argNode
            }
          )
        );
      }
    }
  };
}
function KnownArgumentNamesOnDirectivesRule(context) {
  const directiveArgs = /* @__PURE__ */ Object.create(null);
  const schema = context.getSchema();
  const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
  for (const directive of definedDirectives) {
    directiveArgs[directive.name] = directive.args.map((arg) => arg.name);
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      var _def$arguments;
      const argsNodes = (_def$arguments = def.arguments) !== null && _def$arguments !== void 0 ? _def$arguments : [];
      directiveArgs[def.name.value] = argsNodes.map((arg) => arg.name.value);
    }
  }
  return {
    Directive(directiveNode) {
      const directiveName = directiveNode.name.value;
      const knownArgs = directiveArgs[directiveName];
      if (directiveNode.arguments && knownArgs) {
        for (const argNode of directiveNode.arguments) {
          const argName = argNode.name.value;
          if (!knownArgs.includes(argName)) {
            const suggestions = suggestionList(argName, knownArgs);
            context.reportError(
              new GraphQLError(
                `Unknown argument "${argName}" on directive "@${directiveName}".` + didYouMean(suggestions),
                {
                  nodes: argNode
                }
              )
            );
          }
        }
      }
      return false;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/KnownDirectivesRule.mjs
function KnownDirectivesRule(context) {
  const locationsMap = /* @__PURE__ */ Object.create(null);
  const schema = context.getSchema();
  const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
  for (const directive of definedDirectives) {
    locationsMap[directive.name] = directive.locations;
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      locationsMap[def.name.value] = def.locations.map((name) => name.value);
    }
  }
  return {
    Directive(node, _key, _parent, _path, ancestors) {
      const name = node.name.value;
      const locations = locationsMap[name];
      if (!locations) {
        context.reportError(
          new GraphQLError(`Unknown directive "@${name}".`, {
            nodes: node
          })
        );
        return;
      }
      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (candidateLocation && !locations.includes(candidateLocation)) {
        context.reportError(
          new GraphQLError(
            `Directive "@${name}" may not be used on ${candidateLocation}.`,
            {
              nodes: node
            }
          )
        );
      }
    }
  };
}
function getDirectiveLocationForASTPath(ancestors) {
  const appliedTo = ancestors[ancestors.length - 1];
  "kind" in appliedTo || invariant(false);
  switch (appliedTo.kind) {
    case Kind.OPERATION_DEFINITION:
      return getDirectiveLocationForOperation(appliedTo.operation);
    case Kind.FIELD:
      return DirectiveLocation.FIELD;
    case Kind.FRAGMENT_SPREAD:
      return DirectiveLocation.FRAGMENT_SPREAD;
    case Kind.INLINE_FRAGMENT:
      return DirectiveLocation.INLINE_FRAGMENT;
    case Kind.FRAGMENT_DEFINITION:
      return DirectiveLocation.FRAGMENT_DEFINITION;
    case Kind.VARIABLE_DEFINITION:
      return DirectiveLocation.VARIABLE_DEFINITION;
    case Kind.SCHEMA_DEFINITION:
    case Kind.SCHEMA_EXTENSION:
      return DirectiveLocation.SCHEMA;
    case Kind.SCALAR_TYPE_DEFINITION:
    case Kind.SCALAR_TYPE_EXTENSION:
      return DirectiveLocation.SCALAR;
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
      return DirectiveLocation.OBJECT;
    case Kind.FIELD_DEFINITION:
      return DirectiveLocation.FIELD_DEFINITION;
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION:
      return DirectiveLocation.INTERFACE;
    case Kind.UNION_TYPE_DEFINITION:
    case Kind.UNION_TYPE_EXTENSION:
      return DirectiveLocation.UNION;
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_EXTENSION:
      return DirectiveLocation.ENUM;
    case Kind.ENUM_VALUE_DEFINITION:
      return DirectiveLocation.ENUM_VALUE;
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return DirectiveLocation.INPUT_OBJECT;
    case Kind.INPUT_VALUE_DEFINITION: {
      const parentNode = ancestors[ancestors.length - 3];
      "kind" in parentNode || invariant(false);
      return parentNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? DirectiveLocation.INPUT_FIELD_DEFINITION : DirectiveLocation.ARGUMENT_DEFINITION;
    }
    default:
      invariant(false, "Unexpected kind: " + inspect(appliedTo.kind));
  }
}
function getDirectiveLocationForOperation(operation) {
  switch (operation) {
    case OperationTypeNode.QUERY:
      return DirectiveLocation.QUERY;
    case OperationTypeNode.MUTATION:
      return DirectiveLocation.MUTATION;
    case OperationTypeNode.SUBSCRIPTION:
      return DirectiveLocation.SUBSCRIPTION;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/KnownFragmentNamesRule.mjs
function KnownFragmentNamesRule(context) {
  return {
    FragmentSpread(node) {
      const fragmentName = node.name.value;
      const fragment = context.getFragment(fragmentName);
      if (!fragment) {
        context.reportError(
          new GraphQLError(`Unknown fragment "${fragmentName}".`, {
            nodes: node.name
          })
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/KnownTypeNamesRule.mjs
function KnownTypeNamesRule(context) {
  const schema = context.getSchema();
  const existingTypesMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
  const definedTypes = /* @__PURE__ */ Object.create(null);
  for (const def of context.getDocument().definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes[def.name.value] = true;
    }
  }
  const typeNames = [
    ...Object.keys(existingTypesMap),
    ...Object.keys(definedTypes)
  ];
  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
        var _ancestors$;
        const definitionNode = (_ancestors$ = ancestors[2]) !== null && _ancestors$ !== void 0 ? _ancestors$ : parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && standardTypeNames.includes(typeName)) {
          return;
        }
        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? standardTypeNames.concat(typeNames) : typeNames
        );
        context.reportError(
          new GraphQLError(
            `Unknown type "${typeName}".` + didYouMean(suggestedTypes),
            {
              nodes: node
            }
          )
        );
      }
    }
  };
}
var standardTypeNames = [...specifiedScalarTypes, ...introspectionTypes].map(
  (type) => type.name
);
function isSDLNode(value) {
  return "kind" in value && (isTypeSystemDefinitionNode(value) || isTypeSystemExtensionNode(value));
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/LoneAnonymousOperationRule.mjs
function LoneAnonymousOperationRule(context) {
  let operationCount = 0;
  return {
    Document(node) {
      operationCount = node.definitions.filter(
        (definition) => definition.kind === Kind.OPERATION_DEFINITION
      ).length;
    },
    OperationDefinition(node) {
      if (!node.name && operationCount > 1) {
        context.reportError(
          new GraphQLError(
            "This anonymous operation must be the only defined operation.",
            {
              nodes: node
            }
          )
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/LoneSchemaDefinitionRule.mjs
function LoneSchemaDefinitionRule(context) {
  var _ref, _ref2, _oldSchema$astNode;
  const oldSchema = context.getSchema();
  const alreadyDefined = (_ref = (_ref2 = (_oldSchema$astNode = oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.astNode) !== null && _oldSchema$astNode !== void 0 ? _oldSchema$astNode : oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getQueryType()) !== null && _ref2 !== void 0 ? _ref2 : oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getMutationType()) !== null && _ref !== void 0 ? _ref : oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getSubscriptionType();
  let schemaDefinitionsCount = 0;
  return {
    SchemaDefinition(node) {
      if (alreadyDefined) {
        context.reportError(
          new GraphQLError(
            "Cannot define a new schema within a schema extension.",
            {
              nodes: node
            }
          )
        );
        return;
      }
      if (schemaDefinitionsCount > 0) {
        context.reportError(
          new GraphQLError("Must provide only one schema definition.", {
            nodes: node
          })
        );
      }
      ++schemaDefinitionsCount;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/MaxIntrospectionDepthRule.mjs
var MAX_LISTS_DEPTH = 3;
function MaxIntrospectionDepthRule(context) {
  function checkDepth(node, visitedFragments = /* @__PURE__ */ Object.create(null), depth = 0) {
    if (node.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = node.name.value;
      if (visitedFragments[fragmentName] === true) {
        return false;
      }
      const fragment = context.getFragment(fragmentName);
      if (!fragment) {
        return false;
      }
      try {
        visitedFragments[fragmentName] = true;
        return checkDepth(fragment, visitedFragments, depth);
      } finally {
        visitedFragments[fragmentName] = void 0;
      }
    }
    if (node.kind === Kind.FIELD && // check all introspection lists
    (node.name.value === "fields" || node.name.value === "interfaces" || node.name.value === "possibleTypes" || node.name.value === "inputFields")) {
      depth++;
      if (depth >= MAX_LISTS_DEPTH) {
        return true;
      }
    }
    if ("selectionSet" in node && node.selectionSet) {
      for (const child of node.selectionSet.selections) {
        if (checkDepth(child, visitedFragments, depth)) {
          return true;
        }
      }
    }
    return false;
  }
  return {
    Field(node) {
      if (node.name.value === "__schema" || node.name.value === "__type") {
        if (checkDepth(node)) {
          context.reportError(
            new GraphQLError("Maximum introspection depth exceeded", {
              nodes: [node]
            })
          );
          return false;
        }
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/NoFragmentCyclesRule.mjs
function NoFragmentCyclesRule(context) {
  const visitedFrags = /* @__PURE__ */ Object.create(null);
  const spreadPath = [];
  const spreadPathIndexByName = /* @__PURE__ */ Object.create(null);
  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      detectCycleRecursive(node);
      return false;
    }
  };
  function detectCycleRecursive(fragment) {
    if (visitedFrags[fragment.name.value]) {
      return;
    }
    const fragmentName = fragment.name.value;
    visitedFrags[fragmentName] = true;
    const spreadNodes = context.getFragmentSpreads(fragment.selectionSet);
    if (spreadNodes.length === 0) {
      return;
    }
    spreadPathIndexByName[fragmentName] = spreadPath.length;
    for (const spreadNode of spreadNodes) {
      const spreadName = spreadNode.name.value;
      const cycleIndex = spreadPathIndexByName[spreadName];
      spreadPath.push(spreadNode);
      if (cycleIndex === void 0) {
        const spreadFragment = context.getFragment(spreadName);
        if (spreadFragment) {
          detectCycleRecursive(spreadFragment);
        }
      } else {
        const cyclePath = spreadPath.slice(cycleIndex);
        const viaPath = cyclePath.slice(0, -1).map((s) => '"' + s.name.value + '"').join(", ");
        context.reportError(
          new GraphQLError(
            `Cannot spread fragment "${spreadName}" within itself` + (viaPath !== "" ? ` via ${viaPath}.` : "."),
            {
              nodes: cyclePath
            }
          )
        );
      }
      spreadPath.pop();
    }
    spreadPathIndexByName[fragmentName] = void 0;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/NoUndefinedVariablesRule.mjs
function NoUndefinedVariablesRule(context) {
  let variableNameDefined = /* @__PURE__ */ Object.create(null);
  return {
    OperationDefinition: {
      enter() {
        variableNameDefined = /* @__PURE__ */ Object.create(null);
      },
      leave(operation) {
        const usages = context.getRecursiveVariableUsages(operation);
        for (const { node } of usages) {
          const varName = node.name.value;
          if (variableNameDefined[varName] !== true) {
            context.reportError(
              new GraphQLError(
                operation.name ? `Variable "$${varName}" is not defined by operation "${operation.name.value}".` : `Variable "$${varName}" is not defined.`,
                {
                  nodes: [node, operation]
                }
              )
            );
          }
        }
      }
    },
    VariableDefinition(node) {
      variableNameDefined[node.variable.name.value] = true;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/NoUnusedFragmentsRule.mjs
function NoUnusedFragmentsRule(context) {
  const operationDefs = [];
  const fragmentDefs = [];
  return {
    OperationDefinition(node) {
      operationDefs.push(node);
      return false;
    },
    FragmentDefinition(node) {
      fragmentDefs.push(node);
      return false;
    },
    Document: {
      leave() {
        const fragmentNameUsed = /* @__PURE__ */ Object.create(null);
        for (const operation of operationDefs) {
          for (const fragment of context.getRecursivelyReferencedFragments(
            operation
          )) {
            fragmentNameUsed[fragment.name.value] = true;
          }
        }
        for (const fragmentDef of fragmentDefs) {
          const fragName = fragmentDef.name.value;
          if (fragmentNameUsed[fragName] !== true) {
            context.reportError(
              new GraphQLError(`Fragment "${fragName}" is never used.`, {
                nodes: fragmentDef
              })
            );
          }
        }
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/NoUnusedVariablesRule.mjs
function NoUnusedVariablesRule(context) {
  let variableDefs = [];
  return {
    OperationDefinition: {
      enter() {
        variableDefs = [];
      },
      leave(operation) {
        const variableNameUsed = /* @__PURE__ */ Object.create(null);
        const usages = context.getRecursiveVariableUsages(operation);
        for (const { node } of usages) {
          variableNameUsed[node.name.value] = true;
        }
        for (const variableDef of variableDefs) {
          const variableName = variableDef.variable.name.value;
          if (variableNameUsed[variableName] !== true) {
            context.reportError(
              new GraphQLError(
                operation.name ? `Variable "$${variableName}" is never used in operation "${operation.name.value}".` : `Variable "$${variableName}" is never used.`,
                {
                  nodes: variableDef
                }
              )
            );
          }
        }
      }
    },
    VariableDefinition(def) {
      variableDefs.push(def);
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/sortValueNode.mjs
function sortValueNode(valueNode) {
  switch (valueNode.kind) {
    case Kind.OBJECT:
      return { ...valueNode, fields: sortFields(valueNode.fields) };
    case Kind.LIST:
      return { ...valueNode, values: valueNode.values.map(sortValueNode) };
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.STRING:
    case Kind.BOOLEAN:
    case Kind.NULL:
    case Kind.ENUM:
    case Kind.VARIABLE:
      return valueNode;
  }
}
function sortFields(fields) {
  return fields.map((fieldNode) => ({
    ...fieldNode,
    value: sortValueNode(fieldNode.value)
  })).sort(
    (fieldA, fieldB) => naturalCompare(fieldA.name.value, fieldB.name.value)
  );
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/OverlappingFieldsCanBeMergedRule.mjs
function reasonMessage(reason) {
  if (Array.isArray(reason)) {
    return reason.map(
      ([responseName, subReason]) => `subfields "${responseName}" conflict because ` + reasonMessage(subReason)
    ).join(" and ");
  }
  return reason;
}
function OverlappingFieldsCanBeMergedRule(context) {
  const comparedFragmentPairs = new PairSet();
  const cachedFieldsAndFragmentNames = /* @__PURE__ */ new Map();
  return {
    SelectionSet(selectionSet) {
      const conflicts = findConflictsWithinSelectionSet(
        context,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        context.getParentType(),
        selectionSet
      );
      for (const [[responseName, reason], fields1, fields2] of conflicts) {
        const reasonMsg = reasonMessage(reason);
        context.reportError(
          new GraphQLError(
            `Fields "${responseName}" conflict because ${reasonMsg}. Use different aliases on the fields to fetch both if this was intentional.`,
            {
              nodes: fields1.concat(fields2)
            }
          )
        );
      }
    }
  };
}
function findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentType, selectionSet) {
  const conflicts = [];
  const [fieldMap, fragmentNames] = getFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    parentType,
    selectionSet
  );
  collectConflictsWithin(
    context,
    conflicts,
    cachedFieldsAndFragmentNames,
    comparedFragmentPairs,
    fieldMap
  );
  if (fragmentNames.length !== 0) {
    for (let i = 0; i < fragmentNames.length; i++) {
      collectConflictsBetweenFieldsAndFragment(
        context,
        conflicts,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        false,
        fieldMap,
        fragmentNames[i]
      );
      for (let j = i + 1; j < fragmentNames.length; j++) {
        collectConflictsBetweenFragments(
          context,
          conflicts,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          false,
          fragmentNames[i],
          fragmentNames[j]
        );
      }
    }
  }
  return conflicts;
}
function collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fragmentName) {
  const fragment = context.getFragment(fragmentName);
  if (!fragment) {
    return;
  }
  const [fieldMap2, referencedFragmentNames] = getReferencedFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    fragment
  );
  if (fieldMap === fieldMap2) {
    return;
  }
  collectConflictsBetween(
    context,
    conflicts,
    cachedFieldsAndFragmentNames,
    comparedFragmentPairs,
    areMutuallyExclusive,
    fieldMap,
    fieldMap2
  );
  for (const referencedFragmentName of referencedFragmentNames) {
    if (comparedFragmentPairs.has(
      referencedFragmentName,
      fragmentName,
      areMutuallyExclusive
    )) {
      continue;
    }
    comparedFragmentPairs.add(
      referencedFragmentName,
      fragmentName,
      areMutuallyExclusive
    );
    collectConflictsBetweenFieldsAndFragment(
      context,
      conflicts,
      cachedFieldsAndFragmentNames,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap,
      referencedFragmentName
    );
  }
}
function collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentName1, fragmentName2) {
  if (fragmentName1 === fragmentName2) {
    return;
  }
  if (comparedFragmentPairs.has(
    fragmentName1,
    fragmentName2,
    areMutuallyExclusive
  )) {
    return;
  }
  comparedFragmentPairs.add(fragmentName1, fragmentName2, areMutuallyExclusive);
  const fragment1 = context.getFragment(fragmentName1);
  const fragment2 = context.getFragment(fragmentName2);
  if (!fragment1 || !fragment2) {
    return;
  }
  const [fieldMap1, referencedFragmentNames1] = getReferencedFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    fragment1
  );
  const [fieldMap2, referencedFragmentNames2] = getReferencedFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    fragment2
  );
  collectConflictsBetween(
    context,
    conflicts,
    cachedFieldsAndFragmentNames,
    comparedFragmentPairs,
    areMutuallyExclusive,
    fieldMap1,
    fieldMap2
  );
  for (const referencedFragmentName2 of referencedFragmentNames2) {
    collectConflictsBetweenFragments(
      context,
      conflicts,
      cachedFieldsAndFragmentNames,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fragmentName1,
      referencedFragmentName2
    );
  }
  for (const referencedFragmentName1 of referencedFragmentNames1) {
    collectConflictsBetweenFragments(
      context,
      conflicts,
      cachedFieldsAndFragmentNames,
      comparedFragmentPairs,
      areMutuallyExclusive,
      referencedFragmentName1,
      fragmentName2
    );
  }
}
function findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, parentType1, selectionSet1, parentType2, selectionSet2) {
  const conflicts = [];
  const [fieldMap1, fragmentNames1] = getFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    parentType1,
    selectionSet1
  );
  const [fieldMap2, fragmentNames2] = getFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    parentType2,
    selectionSet2
  );
  collectConflictsBetween(
    context,
    conflicts,
    cachedFieldsAndFragmentNames,
    comparedFragmentPairs,
    areMutuallyExclusive,
    fieldMap1,
    fieldMap2
  );
  for (const fragmentName2 of fragmentNames2) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      conflicts,
      cachedFieldsAndFragmentNames,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap1,
      fragmentName2
    );
  }
  for (const fragmentName1 of fragmentNames1) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      conflicts,
      cachedFieldsAndFragmentNames,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap2,
      fragmentName1
    );
  }
  for (const fragmentName1 of fragmentNames1) {
    for (const fragmentName2 of fragmentNames2) {
      collectConflictsBetweenFragments(
        context,
        conflicts,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        areMutuallyExclusive,
        fragmentName1,
        fragmentName2
      );
    }
  }
  return conflicts;
}
function collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, fieldMap) {
  for (const [responseName, fields] of Object.entries(fieldMap)) {
    if (fields.length > 1) {
      for (let i = 0; i < fields.length; i++) {
        for (let j = i + 1; j < fields.length; j++) {
          const conflict = findConflict(
            context,
            cachedFieldsAndFragmentNames,
            comparedFragmentPairs,
            false,
            // within one collection is never mutually exclusive
            responseName,
            fields[i],
            fields[j]
          );
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }
    }
  }
}
function collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, fieldMap1, fieldMap2) {
  for (const [responseName, fields1] of Object.entries(fieldMap1)) {
    const fields2 = fieldMap2[responseName];
    if (fields2) {
      for (const field1 of fields1) {
        for (const field2 of fields2) {
          const conflict = findConflict(
            context,
            cachedFieldsAndFragmentNames,
            comparedFragmentPairs,
            parentFieldsAreMutuallyExclusive,
            responseName,
            field1,
            field2
          );
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }
    }
  }
}
function findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, field1, field2) {
  const [parentType1, node1, def1] = field1;
  const [parentType2, node2, def2] = field2;
  const areMutuallyExclusive = parentFieldsAreMutuallyExclusive || parentType1 !== parentType2 && isObjectType(parentType1) && isObjectType(parentType2);
  if (!areMutuallyExclusive) {
    const name1 = node1.name.value;
    const name2 = node2.name.value;
    if (name1 !== name2) {
      return [
        [responseName, `"${name1}" and "${name2}" are different fields`],
        [node1],
        [node2]
      ];
    }
    if (!sameArguments(node1, node2)) {
      return [
        [responseName, "they have differing arguments"],
        [node1],
        [node2]
      ];
    }
  }
  const type1 = def1 === null || def1 === void 0 ? void 0 : def1.type;
  const type2 = def2 === null || def2 === void 0 ? void 0 : def2.type;
  if (type1 && type2 && doTypesConflict(type1, type2)) {
    return [
      [
        responseName,
        `they return conflicting types "${inspect(type1)}" and "${inspect(
          type2
        )}"`
      ],
      [node1],
      [node2]
    ];
  }
  const selectionSet1 = node1.selectionSet;
  const selectionSet2 = node2.selectionSet;
  if (selectionSet1 && selectionSet2) {
    const conflicts = findConflictsBetweenSubSelectionSets(
      context,
      cachedFieldsAndFragmentNames,
      comparedFragmentPairs,
      areMutuallyExclusive,
      getNamedType(type1),
      selectionSet1,
      getNamedType(type2),
      selectionSet2
    );
    return subfieldConflicts(conflicts, responseName, node1, node2);
  }
}
function sameArguments(node1, node2) {
  const args1 = node1.arguments;
  const args2 = node2.arguments;
  if (args1 === void 0 || args1.length === 0) {
    return args2 === void 0 || args2.length === 0;
  }
  if (args2 === void 0 || args2.length === 0) {
    return false;
  }
  if (args1.length !== args2.length) {
    return false;
  }
  const values2 = new Map(args2.map(({ name, value }) => [name.value, value]));
  return args1.every((arg1) => {
    const value1 = arg1.value;
    const value2 = values2.get(arg1.name.value);
    if (value2 === void 0) {
      return false;
    }
    return stringifyValue(value1) === stringifyValue(value2);
  });
}
function stringifyValue(value) {
  return print(sortValueNode(value));
}
function doTypesConflict(type1, type2) {
  if (isListType(type1)) {
    return isListType(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
  }
  if (isListType(type2)) {
    return true;
  }
  if (isNonNullType(type1)) {
    return isNonNullType(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
  }
  if (isNonNullType(type2)) {
    return true;
  }
  if (isLeafType(type1) || isLeafType(type2)) {
    return type1 !== type2;
  }
  return false;
}
function getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType, selectionSet) {
  const cached = cachedFieldsAndFragmentNames.get(selectionSet);
  if (cached) {
    return cached;
  }
  const nodeAndDefs = /* @__PURE__ */ Object.create(null);
  const fragmentNames = /* @__PURE__ */ Object.create(null);
  _collectFieldsAndFragmentNames(
    context,
    parentType,
    selectionSet,
    nodeAndDefs,
    fragmentNames
  );
  const result = [nodeAndDefs, Object.keys(fragmentNames)];
  cachedFieldsAndFragmentNames.set(selectionSet, result);
  return result;
}
function getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment) {
  const cached = cachedFieldsAndFragmentNames.get(fragment.selectionSet);
  if (cached) {
    return cached;
  }
  const fragmentType = typeFromAST(context.getSchema(), fragment.typeCondition);
  return getFieldsAndFragmentNames(
    context,
    cachedFieldsAndFragmentNames,
    fragmentType,
    fragment.selectionSet
  );
}
function _collectFieldsAndFragmentNames(context, parentType, selectionSet, nodeAndDefs, fragmentNames) {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const fieldName = selection.name.value;
        let fieldDef;
        if (isObjectType(parentType) || isInterfaceType(parentType)) {
          fieldDef = parentType.getFields()[fieldName];
        }
        const responseName = selection.alias ? selection.alias.value : fieldName;
        if (!nodeAndDefs[responseName]) {
          nodeAndDefs[responseName] = [];
        }
        nodeAndDefs[responseName].push([parentType, selection, fieldDef]);
        break;
      }
      case Kind.FRAGMENT_SPREAD:
        fragmentNames[selection.name.value] = true;
        break;
      case Kind.INLINE_FRAGMENT: {
        const typeCondition = selection.typeCondition;
        const inlineFragmentType = typeCondition ? typeFromAST(context.getSchema(), typeCondition) : parentType;
        _collectFieldsAndFragmentNames(
          context,
          inlineFragmentType,
          selection.selectionSet,
          nodeAndDefs,
          fragmentNames
        );
        break;
      }
    }
  }
}
function subfieldConflicts(conflicts, responseName, node1, node2) {
  if (conflicts.length > 0) {
    return [
      [responseName, conflicts.map(([reason]) => reason)],
      [node1, ...conflicts.map(([, fields1]) => fields1).flat()],
      [node2, ...conflicts.map(([, , fields2]) => fields2).flat()]
    ];
  }
}
var PairSet = class {
  constructor() {
    this._data = /* @__PURE__ */ new Map();
  }
  has(a, b, areMutuallyExclusive) {
    var _this$_data$get;
    const [key1, key2] = a < b ? [a, b] : [b, a];
    const result = (_this$_data$get = this._data.get(key1)) === null || _this$_data$get === void 0 ? void 0 : _this$_data$get.get(key2);
    if (result === void 0) {
      return false;
    }
    return areMutuallyExclusive ? true : areMutuallyExclusive === result;
  }
  add(a, b, areMutuallyExclusive) {
    const [key1, key2] = a < b ? [a, b] : [b, a];
    const map = this._data.get(key1);
    if (map === void 0) {
      this._data.set(key1, /* @__PURE__ */ new Map([[key2, areMutuallyExclusive]]));
    } else {
      map.set(key2, areMutuallyExclusive);
    }
  }
};

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/PossibleFragmentSpreadsRule.mjs
function PossibleFragmentSpreadsRule(context) {
  return {
    InlineFragment(node) {
      const fragType = context.getType();
      const parentType = context.getParentType();
      if (isCompositeType(fragType) && isCompositeType(parentType) && !doTypesOverlap(context.getSchema(), fragType, parentType)) {
        const parentTypeStr = inspect(parentType);
        const fragTypeStr = inspect(fragType);
        context.reportError(
          new GraphQLError(
            `Fragment cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            {
              nodes: node
            }
          )
        );
      }
    },
    FragmentSpread(node) {
      const fragName = node.name.value;
      const fragType = getFragmentType(context, fragName);
      const parentType = context.getParentType();
      if (fragType && parentType && !doTypesOverlap(context.getSchema(), fragType, parentType)) {
        const parentTypeStr = inspect(parentType);
        const fragTypeStr = inspect(fragType);
        context.reportError(
          new GraphQLError(
            `Fragment "${fragName}" cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            {
              nodes: node
            }
          )
        );
      }
    }
  };
}
function getFragmentType(context, name) {
  const frag = context.getFragment(name);
  if (frag) {
    const type = typeFromAST(context.getSchema(), frag.typeCondition);
    if (isCompositeType(type)) {
      return type;
    }
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/PossibleTypeExtensionsRule.mjs
function PossibleTypeExtensionsRule(context) {
  const schema = context.getSchema();
  const definedTypes = /* @__PURE__ */ Object.create(null);
  for (const def of context.getDocument().definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes[def.name.value] = def;
    }
  }
  return {
    ScalarTypeExtension: checkExtension,
    ObjectTypeExtension: checkExtension,
    InterfaceTypeExtension: checkExtension,
    UnionTypeExtension: checkExtension,
    EnumTypeExtension: checkExtension,
    InputObjectTypeExtension: checkExtension
  };
  function checkExtension(node) {
    const typeName = node.name.value;
    const defNode = definedTypes[typeName];
    const existingType = schema === null || schema === void 0 ? void 0 : schema.getType(typeName);
    let expectedKind;
    if (defNode) {
      expectedKind = defKindToExtKind[defNode.kind];
    } else if (existingType) {
      expectedKind = typeToExtKind(existingType);
    }
    if (expectedKind) {
      if (expectedKind !== node.kind) {
        const kindStr = extensionKindToTypeName(node.kind);
        context.reportError(
          new GraphQLError(`Cannot extend non-${kindStr} type "${typeName}".`, {
            nodes: defNode ? [defNode, node] : node
          })
        );
      }
    } else {
      const allTypeNames = Object.keys({
        ...definedTypes,
        ...schema === null || schema === void 0 ? void 0 : schema.getTypeMap()
      });
      const suggestedTypes = suggestionList(typeName, allTypeNames);
      context.reportError(
        new GraphQLError(
          `Cannot extend type "${typeName}" because it is not defined.` + didYouMean(suggestedTypes),
          {
            nodes: node.name
          }
        )
      );
    }
  }
}
var defKindToExtKind = {
  [Kind.SCALAR_TYPE_DEFINITION]: Kind.SCALAR_TYPE_EXTENSION,
  [Kind.OBJECT_TYPE_DEFINITION]: Kind.OBJECT_TYPE_EXTENSION,
  [Kind.INTERFACE_TYPE_DEFINITION]: Kind.INTERFACE_TYPE_EXTENSION,
  [Kind.UNION_TYPE_DEFINITION]: Kind.UNION_TYPE_EXTENSION,
  [Kind.ENUM_TYPE_DEFINITION]: Kind.ENUM_TYPE_EXTENSION,
  [Kind.INPUT_OBJECT_TYPE_DEFINITION]: Kind.INPUT_OBJECT_TYPE_EXTENSION
};
function typeToExtKind(type) {
  if (isScalarType(type)) {
    return Kind.SCALAR_TYPE_EXTENSION;
  }
  if (isObjectType(type)) {
    return Kind.OBJECT_TYPE_EXTENSION;
  }
  if (isInterfaceType(type)) {
    return Kind.INTERFACE_TYPE_EXTENSION;
  }
  if (isUnionType(type)) {
    return Kind.UNION_TYPE_EXTENSION;
  }
  if (isEnumType(type)) {
    return Kind.ENUM_TYPE_EXTENSION;
  }
  if (isInputObjectType(type)) {
    return Kind.INPUT_OBJECT_TYPE_EXTENSION;
  }
  invariant(false, "Unexpected type: " + inspect(type));
}
function extensionKindToTypeName(kind) {
  switch (kind) {
    case Kind.SCALAR_TYPE_EXTENSION:
      return "scalar";
    case Kind.OBJECT_TYPE_EXTENSION:
      return "object";
    case Kind.INTERFACE_TYPE_EXTENSION:
      return "interface";
    case Kind.UNION_TYPE_EXTENSION:
      return "union";
    case Kind.ENUM_TYPE_EXTENSION:
      return "enum";
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return "input object";
    default:
      invariant(false, "Unexpected kind: " + inspect(kind));
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/ProvidedRequiredArgumentsRule.mjs
function ProvidedRequiredArgumentsRule(context) {
  return {
    // eslint-disable-next-line new-cap
    ...ProvidedRequiredArgumentsOnDirectivesRule(context),
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(fieldNode) {
        var _fieldNode$arguments;
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }
        const providedArgs = new Set(
          // FIXME: https://github.com/graphql/graphql-js/issues/2203
          /* c8 ignore next */
          (_fieldNode$arguments = fieldNode.arguments) === null || _fieldNode$arguments === void 0 ? void 0 : _fieldNode$arguments.map((arg) => arg.name.value)
        );
        for (const argDef of fieldDef.args) {
          if (!providedArgs.has(argDef.name) && isRequiredArgument(argDef)) {
            const argTypeStr = inspect(argDef.type);
            context.reportError(
              new GraphQLError(
                `Field "${fieldDef.name}" argument "${argDef.name}" of type "${argTypeStr}" is required, but it was not provided.`,
                {
                  nodes: fieldNode
                }
              )
            );
          }
        }
      }
    }
  };
}
function ProvidedRequiredArgumentsOnDirectivesRule(context) {
  var _schema$getDirectives;
  const requiredArgsMap = /* @__PURE__ */ Object.create(null);
  const schema = context.getSchema();
  const definedDirectives = (_schema$getDirectives = schema === null || schema === void 0 ? void 0 : schema.getDirectives()) !== null && _schema$getDirectives !== void 0 ? _schema$getDirectives : specifiedDirectives;
  for (const directive of definedDirectives) {
    requiredArgsMap[directive.name] = keyMap(
      directive.args.filter(isRequiredArgument),
      (arg) => arg.name
    );
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      var _def$arguments;
      const argNodes = (_def$arguments = def.arguments) !== null && _def$arguments !== void 0 ? _def$arguments : [];
      requiredArgsMap[def.name.value] = keyMap(
        argNodes.filter(isRequiredArgumentNode),
        (arg) => arg.name.value
      );
    }
  }
  return {
    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(directiveNode) {
        const directiveName = directiveNode.name.value;
        const requiredArgs = requiredArgsMap[directiveName];
        if (requiredArgs) {
          var _directiveNode$argume;
          const argNodes = (_directiveNode$argume = directiveNode.arguments) !== null && _directiveNode$argume !== void 0 ? _directiveNode$argume : [];
          const argNodeMap = new Set(argNodes.map((arg) => arg.name.value));
          for (const [argName, argDef] of Object.entries(requiredArgs)) {
            if (!argNodeMap.has(argName)) {
              const argType = isType(argDef.type) ? inspect(argDef.type) : print(argDef.type);
              context.reportError(
                new GraphQLError(
                  `Directive "@${directiveName}" argument "${argName}" of type "${argType}" is required, but it was not provided.`,
                  {
                    nodes: directiveNode
                  }
                )
              );
            }
          }
        }
      }
    }
  };
}
function isRequiredArgumentNode(arg) {
  return arg.type.kind === Kind.NON_NULL_TYPE && arg.defaultValue == null;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/ScalarLeafsRule.mjs
function ScalarLeafsRule(context) {
  return {
    Field(node) {
      const type = context.getType();
      const selectionSet = node.selectionSet;
      if (type) {
        if (isLeafType(getNamedType(type))) {
          if (selectionSet) {
            const fieldName = node.name.value;
            const typeStr = inspect(type);
            context.reportError(
              new GraphQLError(
                `Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`,
                {
                  nodes: selectionSet
                }
              )
            );
          }
        } else if (!selectionSet) {
          const fieldName = node.name.value;
          const typeStr = inspect(type);
          context.reportError(
            new GraphQLError(
              `Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`,
              {
                nodes: node
              }
            )
          );
        }
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/printPathArray.mjs
function printPathArray(path) {
  return path.map(
    (key) => typeof key === "number" ? "[" + key.toString() + "]" : "." + key
  ).join("");
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/Path.mjs
function addPath(prev, key, typename) {
  return {
    prev,
    key,
    typename
  };
}
function pathToArray(path) {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/coerceInputValue.mjs
function coerceInputValue(inputValue, type, onError = defaultOnError) {
  return coerceInputValueImpl(inputValue, type, onError, void 0);
}
function defaultOnError(path, invalidValue, error) {
  let errorPrefix = "Invalid value " + inspect(invalidValue);
  if (path.length > 0) {
    errorPrefix += ` at "value${printPathArray(path)}"`;
  }
  error.message = errorPrefix + ": " + error.message;
  throw error;
}
function coerceInputValueImpl(inputValue, type, onError, path) {
  if (isNonNullType(type)) {
    if (inputValue != null) {
      return coerceInputValueImpl(inputValue, type.ofType, onError, path);
    }
    onError(
      pathToArray(path),
      inputValue,
      new GraphQLError(
        `Expected non-nullable type "${inspect(type)}" not to be null.`
      )
    );
    return;
  }
  if (inputValue == null) {
    return null;
  }
  if (isListType(type)) {
    const itemType = type.ofType;
    if (isIterableObject(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = addPath(path, index, void 0);
        return coerceInputValueImpl(itemValue, itemType, onError, itemPath);
      });
    }
    return [coerceInputValueImpl(inputValue, itemType, onError, path)];
  }
  if (isInputObjectType(type)) {
    if (!isObjectLike(inputValue)) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${type.name}" to be an object.`)
      );
      return;
    }
    const coercedValue = {};
    const fieldDefs = type.getFields();
    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];
      if (fieldValue === void 0) {
        if (field.defaultValue !== void 0) {
          coercedValue[field.name] = field.defaultValue;
        } else if (isNonNullType(field.type)) {
          const typeStr = inspect(field.type);
          onError(
            pathToArray(path),
            inputValue,
            new GraphQLError(
              `Field "${field.name}" of required type "${typeStr}" was not provided.`
            )
          );
        }
        continue;
      }
      coercedValue[field.name] = coerceInputValueImpl(
        fieldValue,
        field.type,
        onError,
        addPath(path, field.name, type.name)
      );
    }
    for (const fieldName of Object.keys(inputValue)) {
      if (!fieldDefs[fieldName]) {
        const suggestions = suggestionList(
          fieldName,
          Object.keys(type.getFields())
        );
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Field "${fieldName}" is not defined by type "${type.name}".` + didYouMean(suggestions)
          )
        );
      }
    }
    if (type.isOneOf) {
      const keys = Object.keys(coercedValue);
      if (keys.length !== 1) {
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Exactly one key must be specified for OneOf type "${type.name}".`
          )
        );
      }
      const key = keys[0];
      const value = coercedValue[key];
      if (value === null) {
        onError(
          pathToArray(path).concat(key),
          value,
          new GraphQLError(`Field "${key}" must be non-null.`)
        );
      }
    }
    return coercedValue;
  }
  if (isLeafType(type)) {
    let parseResult;
    try {
      parseResult = type.parseValue(inputValue);
    } catch (error) {
      if (error instanceof GraphQLError) {
        onError(pathToArray(path), inputValue, error);
      } else {
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(`Expected type "${type.name}". ` + error.message, {
            originalError: error
          })
        );
      }
      return;
    }
    if (parseResult === void 0) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${type.name}".`)
      );
    }
    return parseResult;
  }
  invariant(false, "Unexpected input type: " + inspect(type));
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/valueFromAST.mjs
function valueFromAST(valueNode, type, variables) {
  if (!valueNode) {
    return;
  }
  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    if (variables == null || variables[variableName] === void 0) {
      return;
    }
    const variableValue = variables[variableName];
    if (variableValue === null && isNonNullType(type)) {
      return;
    }
    return variableValue;
  }
  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      return;
    }
    return valueFromAST(valueNode, type.ofType, variables);
  }
  if (valueNode.kind === Kind.NULL) {
    return null;
  }
  if (isListType(type)) {
    const itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      const coercedValues = [];
      for (const itemNode of valueNode.values) {
        if (isMissingVariable(itemNode, variables)) {
          if (isNonNullType(itemType)) {
            return;
          }
          coercedValues.push(null);
        } else {
          const itemValue = valueFromAST(itemNode, itemType, variables);
          if (itemValue === void 0) {
            return;
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(valueNode, itemType, variables);
    if (coercedValue === void 0) {
      return;
    }
    return [coercedValue];
  }
  if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      return;
    }
    const coercedObj = /* @__PURE__ */ Object.create(null);
    const fieldNodes = keyMap(valueNode.fields, (field) => field.name.value);
    for (const field of Object.values(type.getFields())) {
      const fieldNode = fieldNodes[field.name];
      if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
        if (field.defaultValue !== void 0) {
          coercedObj[field.name] = field.defaultValue;
        } else if (isNonNullType(field.type)) {
          return;
        }
        continue;
      }
      const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
      if (fieldValue === void 0) {
        return;
      }
      coercedObj[field.name] = fieldValue;
    }
    if (type.isOneOf) {
      const keys = Object.keys(coercedObj);
      if (keys.length !== 1) {
        return;
      }
      if (coercedObj[keys[0]] === null) {
        return;
      }
    }
    return coercedObj;
  }
  if (isLeafType(type)) {
    let result;
    try {
      result = type.parseLiteral(valueNode, variables);
    } catch (_error) {
      return;
    }
    if (result === void 0) {
      return;
    }
    return result;
  }
  invariant(false, "Unexpected input type: " + inspect(type));
}
function isMissingVariable(valueNode, variables) {
  return valueNode.kind === Kind.VARIABLE && (variables == null || variables[valueNode.name.value] === void 0);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/execution/values.mjs
function getVariableValues(schema, varDefNodes, inputs, options) {
  const errors = [];
  const maxErrors = options === null || options === void 0 ? void 0 : options.maxErrors;
  try {
    const coerced = coerceVariableValues(
      schema,
      varDefNodes,
      inputs,
      (error) => {
        if (maxErrors != null && errors.length >= maxErrors) {
          throw new GraphQLError(
            "Too many errors processing variables, error limit reached. Execution aborted."
          );
        }
        errors.push(error);
      }
    );
    if (errors.length === 0) {
      return {
        coerced
      };
    }
  } catch (error) {
    errors.push(error);
  }
  return {
    errors
  };
}
function coerceVariableValues(schema, varDefNodes, inputs, onError) {
  const coercedValues = {};
  for (const varDefNode of varDefNodes) {
    const varName = varDefNode.variable.name.value;
    const varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
      const varTypeStr = print(varDefNode.type);
      onError(
        new GraphQLError(
          `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
          {
            nodes: varDefNode.type
          }
        )
      );
      continue;
    }
    if (!hasOwnProperty(inputs, varName)) {
      if (varDefNode.defaultValue) {
        coercedValues[varName] = valueFromAST(varDefNode.defaultValue, varType);
      } else if (isNonNullType(varType)) {
        const varTypeStr = inspect(varType);
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
            {
              nodes: varDefNode
            }
          )
        );
      }
      continue;
    }
    const value = inputs[varName];
    if (value === null && isNonNullType(varType)) {
      const varTypeStr = inspect(varType);
      onError(
        new GraphQLError(
          `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
          {
            nodes: varDefNode
          }
        )
      );
      continue;
    }
    coercedValues[varName] = coerceInputValue(
      value,
      varType,
      (path, invalidValue, error) => {
        let prefix = `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
        if (path.length > 0) {
          prefix += ` at "${varName}${printPathArray(path)}"`;
        }
        onError(
          new GraphQLError(prefix + "; " + error.message, {
            nodes: varDefNode,
            originalError: error
          })
        );
      }
    );
  }
  return coercedValues;
}
function getArgumentValues(def, node, variableValues) {
  var _node$arguments;
  const coercedValues = {};
  const argumentNodes = (_node$arguments = node.arguments) !== null && _node$arguments !== void 0 ? _node$arguments : [];
  const argNodeMap = keyMap(argumentNodes, (arg) => arg.name.value);
  for (const argDef of def.args) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap[name];
    if (!argumentNode) {
      if (argDef.defaultValue !== void 0) {
        coercedValues[name] = argDef.defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${inspect(argType)}" was not provided.`,
          {
            nodes: node
          }
        );
      }
      continue;
    }
    const valueNode = argumentNode.value;
    let isNull = valueNode.kind === Kind.NULL;
    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (variableValues == null || !hasOwnProperty(variableValues, variableName)) {
        if (argDef.defaultValue !== void 0) {
          coercedValues[name] = argDef.defaultValue;
        } else if (isNonNullType(argType)) {
          throw new GraphQLError(
            `Argument "${name}" of required type "${inspect(argType)}" was provided the variable "$${variableName}" which was not provided a runtime value.`,
            {
              nodes: valueNode
            }
          );
        }
        continue;
      }
      isNull = variableValues[variableName] == null;
    }
    if (isNull && isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${inspect(argType)}" must not be null.`,
        {
          nodes: valueNode
        }
      );
    }
    const coercedValue = valueFromAST(valueNode, argType, variableValues);
    if (coercedValue === void 0) {
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        {
          nodes: valueNode
        }
      );
    }
    coercedValues[name] = coercedValue;
  }
  return coercedValues;
}
function getDirectiveValues(directiveDef, node, variableValues) {
  var _node$directives;
  const directiveNode = (_node$directives = node.directives) === null || _node$directives === void 0 ? void 0 : _node$directives.find(
    (directive) => directive.name.value === directiveDef.name
  );
  if (directiveNode) {
    return getArgumentValues(directiveDef, directiveNode, variableValues);
  }
}
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/execution/collectFields.mjs
function collectFields(schema, fragments, variableValues, runtimeType, selectionSet) {
  const fields = /* @__PURE__ */ new Map();
  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    runtimeType,
    selectionSet,
    fields,
    /* @__PURE__ */ new Set()
  );
  return fields;
}
function collectSubfields(schema, fragments, variableValues, returnType, fieldNodes) {
  const subFieldNodes = /* @__PURE__ */ new Map();
  const visitedFragmentNames = /* @__PURE__ */ new Set();
  for (const node of fieldNodes) {
    if (node.selectionSet) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        returnType,
        node.selectionSet,
        subFieldNodes,
        visitedFragmentNames
      );
    }
  }
  return subFieldNodes;
}
function collectFieldsImpl(schema, fragments, variableValues, runtimeType, selectionSet, fields, visitedFragmentNames) {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        const fieldList = fields.get(name);
        if (fieldList !== void 0) {
          fieldList.push(selection);
        } else {
          fields.set(name, [selection]);
        }
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (!shouldIncludeNode(variableValues, selection) || !doesFragmentConditionMatch(schema, selection, runtimeType)) {
          continue;
        }
        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        if (visitedFragmentNames.has(fragName) || !shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        visitedFragmentNames.add(fragName);
        const fragment = fragments[fragName];
        if (!fragment || !doesFragmentConditionMatch(schema, fragment, runtimeType)) {
          continue;
        }
        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      }
    }
  }
}
function shouldIncludeNode(variableValues, node) {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if ((skip === null || skip === void 0 ? void 0 : skip.if) === true) {
    return false;
  }
  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues
  );
  if ((include === null || include === void 0 ? void 0 : include.if) === false) {
    return false;
  }
  return true;
}
function doesFragmentConditionMatch(schema, fragment, type) {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return schema.isSubType(conditionalType, type);
  }
  return false;
}
function getFieldEntryKey(node) {
  return node.alias ? node.alias.value : node.name.value;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/SingleFieldSubscriptionsRule.mjs
function SingleFieldSubscriptionsRule(context) {
  return {
    OperationDefinition(node) {
      if (node.operation === "subscription") {
        const schema = context.getSchema();
        const subscriptionType = schema.getSubscriptionType();
        if (subscriptionType) {
          const operationName = node.name ? node.name.value : null;
          const variableValues = /* @__PURE__ */ Object.create(null);
          const document = context.getDocument();
          const fragments = /* @__PURE__ */ Object.create(null);
          for (const definition of document.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
              fragments[definition.name.value] = definition;
            }
          }
          const fields = collectFields(
            schema,
            fragments,
            variableValues,
            subscriptionType,
            node.selectionSet
          );
          if (fields.size > 1) {
            const fieldSelectionLists = [...fields.values()];
            const extraFieldSelectionLists = fieldSelectionLists.slice(1);
            const extraFieldSelections = extraFieldSelectionLists.flat();
            context.reportError(
              new GraphQLError(
                operationName != null ? `Subscription "${operationName}" must select only one top level field.` : "Anonymous Subscription must select only one top level field.",
                {
                  nodes: extraFieldSelections
                }
              )
            );
          }
          for (const fieldNodes of fields.values()) {
            const field = fieldNodes[0];
            const fieldName = field.name.value;
            if (fieldName.startsWith("__")) {
              context.reportError(
                new GraphQLError(
                  operationName != null ? `Subscription "${operationName}" must not select an introspection top level field.` : "Anonymous Subscription must not select an introspection top level field.",
                  {
                    nodes: fieldNodes
                  }
                )
              );
            }
          }
        }
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/groupBy.mjs
function groupBy(list, keyFn) {
  const result = /* @__PURE__ */ new Map();
  for (const item of list) {
    const key = keyFn(item);
    const group = result.get(key);
    if (group === void 0) {
      result.set(key, [item]);
    } else {
      group.push(item);
    }
  }
  return result;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueArgumentDefinitionNamesRule.mjs
function UniqueArgumentDefinitionNamesRule(context) {
  return {
    DirectiveDefinition(directiveNode) {
      var _directiveNode$argume;
      const argumentNodes = (_directiveNode$argume = directiveNode.arguments) !== null && _directiveNode$argume !== void 0 ? _directiveNode$argume : [];
      return checkArgUniqueness(`@${directiveNode.name.value}`, argumentNodes);
    },
    InterfaceTypeDefinition: checkArgUniquenessPerField,
    InterfaceTypeExtension: checkArgUniquenessPerField,
    ObjectTypeDefinition: checkArgUniquenessPerField,
    ObjectTypeExtension: checkArgUniquenessPerField
  };
  function checkArgUniquenessPerField(typeNode) {
    var _typeNode$fields;
    const typeName = typeNode.name.value;
    const fieldNodes = (_typeNode$fields = typeNode.fields) !== null && _typeNode$fields !== void 0 ? _typeNode$fields : [];
    for (const fieldDef of fieldNodes) {
      var _fieldDef$arguments;
      const fieldName = fieldDef.name.value;
      const argumentNodes = (_fieldDef$arguments = fieldDef.arguments) !== null && _fieldDef$arguments !== void 0 ? _fieldDef$arguments : [];
      checkArgUniqueness(`${typeName}.${fieldName}`, argumentNodes);
    }
    return false;
  }
  function checkArgUniqueness(parentName, argumentNodes) {
    const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);
    for (const [argName, argNodes] of seenArgs) {
      if (argNodes.length > 1) {
        context.reportError(
          new GraphQLError(
            `Argument "${parentName}(${argName}:)" can only be defined once.`,
            {
              nodes: argNodes.map((node) => node.name)
            }
          )
        );
      }
    }
    return false;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueArgumentNamesRule.mjs
function UniqueArgumentNamesRule(context) {
  return {
    Field: checkArgUniqueness,
    Directive: checkArgUniqueness
  };
  function checkArgUniqueness(parentNode) {
    var _parentNode$arguments;
    const argumentNodes = (_parentNode$arguments = parentNode.arguments) !== null && _parentNode$arguments !== void 0 ? _parentNode$arguments : [];
    const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);
    for (const [argName, argNodes] of seenArgs) {
      if (argNodes.length > 1) {
        context.reportError(
          new GraphQLError(
            `There can be only one argument named "${argName}".`,
            {
              nodes: argNodes.map((node) => node.name)
            }
          )
        );
      }
    }
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueDirectiveNamesRule.mjs
function UniqueDirectiveNamesRule(context) {
  const knownDirectiveNames = /* @__PURE__ */ Object.create(null);
  const schema = context.getSchema();
  return {
    DirectiveDefinition(node) {
      const directiveName = node.name.value;
      if (schema !== null && schema !== void 0 && schema.getDirective(directiveName)) {
        context.reportError(
          new GraphQLError(
            `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
            {
              nodes: node.name
            }
          )
        );
        return;
      }
      if (knownDirectiveNames[directiveName]) {
        context.reportError(
          new GraphQLError(
            `There can be only one directive named "@${directiveName}".`,
            {
              nodes: [knownDirectiveNames[directiveName], node.name]
            }
          )
        );
      } else {
        knownDirectiveNames[directiveName] = node.name;
      }
      return false;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueDirectivesPerLocationRule.mjs
function UniqueDirectivesPerLocationRule(context) {
  const uniqueDirectiveMap = /* @__PURE__ */ Object.create(null);
  const schema = context.getSchema();
  const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
  for (const directive of definedDirectives) {
    uniqueDirectiveMap[directive.name] = !directive.isRepeatable;
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      uniqueDirectiveMap[def.name.value] = !def.repeatable;
    }
  }
  const schemaDirectives = /* @__PURE__ */ Object.create(null);
  const typeDirectivesMap = /* @__PURE__ */ Object.create(null);
  return {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    enter(node) {
      if (!("directives" in node) || !node.directives) {
        return;
      }
      let seenDirectives;
      if (node.kind === Kind.SCHEMA_DEFINITION || node.kind === Kind.SCHEMA_EXTENSION) {
        seenDirectives = schemaDirectives;
      } else if (isTypeDefinitionNode(node) || isTypeExtensionNode(node)) {
        const typeName = node.name.value;
        seenDirectives = typeDirectivesMap[typeName];
        if (seenDirectives === void 0) {
          typeDirectivesMap[typeName] = seenDirectives = /* @__PURE__ */ Object.create(null);
        }
      } else {
        seenDirectives = /* @__PURE__ */ Object.create(null);
      }
      for (const directive of node.directives) {
        const directiveName = directive.name.value;
        if (uniqueDirectiveMap[directiveName]) {
          if (seenDirectives[directiveName]) {
            context.reportError(
              new GraphQLError(
                `The directive "@${directiveName}" can only be used once at this location.`,
                {
                  nodes: [seenDirectives[directiveName], directive]
                }
              )
            );
          } else {
            seenDirectives[directiveName] = directive;
          }
        }
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueEnumValueNamesRule.mjs
function UniqueEnumValueNamesRule(context) {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
  const knownValueNames = /* @__PURE__ */ Object.create(null);
  return {
    EnumTypeDefinition: checkValueUniqueness,
    EnumTypeExtension: checkValueUniqueness
  };
  function checkValueUniqueness(node) {
    var _node$values;
    const typeName = node.name.value;
    if (!knownValueNames[typeName]) {
      knownValueNames[typeName] = /* @__PURE__ */ Object.create(null);
    }
    const valueNodes = (_node$values = node.values) !== null && _node$values !== void 0 ? _node$values : [];
    const valueNames = knownValueNames[typeName];
    for (const valueDef of valueNodes) {
      const valueName = valueDef.name.value;
      const existingType = existingTypeMap[typeName];
      if (isEnumType(existingType) && existingType.getValue(valueName)) {
        context.reportError(
          new GraphQLError(
            `Enum value "${typeName}.${valueName}" already exists in the schema. It cannot also be defined in this type extension.`,
            {
              nodes: valueDef.name
            }
          )
        );
      } else if (valueNames[valueName]) {
        context.reportError(
          new GraphQLError(
            `Enum value "${typeName}.${valueName}" can only be defined once.`,
            {
              nodes: [valueNames[valueName], valueDef.name]
            }
          )
        );
      } else {
        valueNames[valueName] = valueDef.name;
      }
    }
    return false;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueFieldDefinitionNamesRule.mjs
function UniqueFieldDefinitionNamesRule(context) {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
  const knownFieldNames = /* @__PURE__ */ Object.create(null);
  return {
    InputObjectTypeDefinition: checkFieldUniqueness,
    InputObjectTypeExtension: checkFieldUniqueness,
    InterfaceTypeDefinition: checkFieldUniqueness,
    InterfaceTypeExtension: checkFieldUniqueness,
    ObjectTypeDefinition: checkFieldUniqueness,
    ObjectTypeExtension: checkFieldUniqueness
  };
  function checkFieldUniqueness(node) {
    var _node$fields;
    const typeName = node.name.value;
    if (!knownFieldNames[typeName]) {
      knownFieldNames[typeName] = /* @__PURE__ */ Object.create(null);
    }
    const fieldNodes = (_node$fields = node.fields) !== null && _node$fields !== void 0 ? _node$fields : [];
    const fieldNames = knownFieldNames[typeName];
    for (const fieldDef of fieldNodes) {
      const fieldName = fieldDef.name.value;
      if (hasField(existingTypeMap[typeName], fieldName)) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
            {
              nodes: fieldDef.name
            }
          )
        );
      } else if (fieldNames[fieldName]) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" can only be defined once.`,
            {
              nodes: [fieldNames[fieldName], fieldDef.name]
            }
          )
        );
      } else {
        fieldNames[fieldName] = fieldDef.name;
      }
    }
    return false;
  }
}
function hasField(type, fieldName) {
  if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
    return type.getFields()[fieldName] != null;
  }
  return false;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueFragmentNamesRule.mjs
function UniqueFragmentNamesRule(context) {
  const knownFragmentNames = /* @__PURE__ */ Object.create(null);
  return {
    OperationDefinition: () => false,
    FragmentDefinition(node) {
      const fragmentName = node.name.value;
      if (knownFragmentNames[fragmentName]) {
        context.reportError(
          new GraphQLError(
            `There can be only one fragment named "${fragmentName}".`,
            {
              nodes: [knownFragmentNames[fragmentName], node.name]
            }
          )
        );
      } else {
        knownFragmentNames[fragmentName] = node.name;
      }
      return false;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueInputFieldNamesRule.mjs
function UniqueInputFieldNamesRule(context) {
  const knownNameStack = [];
  let knownNames = /* @__PURE__ */ Object.create(null);
  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = /* @__PURE__ */ Object.create(null);
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        prevKnownNames || invariant(false);
        knownNames = prevKnownNames;
      }
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      if (knownNames[fieldName]) {
        context.reportError(
          new GraphQLError(
            `There can be only one input field named "${fieldName}".`,
            {
              nodes: [knownNames[fieldName], node.name]
            }
          )
        );
      } else {
        knownNames[fieldName] = node.name;
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueOperationNamesRule.mjs
function UniqueOperationNamesRule(context) {
  const knownOperationNames = /* @__PURE__ */ Object.create(null);
  return {
    OperationDefinition(node) {
      const operationName = node.name;
      if (operationName) {
        if (knownOperationNames[operationName.value]) {
          context.reportError(
            new GraphQLError(
              `There can be only one operation named "${operationName.value}".`,
              {
                nodes: [
                  knownOperationNames[operationName.value],
                  operationName
                ]
              }
            )
          );
        } else {
          knownOperationNames[operationName.value] = operationName;
        }
      }
      return false;
    },
    FragmentDefinition: () => false
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueOperationTypesRule.mjs
function UniqueOperationTypesRule(context) {
  const schema = context.getSchema();
  const definedOperationTypes = /* @__PURE__ */ Object.create(null);
  const existingOperationTypes = schema ? {
    query: schema.getQueryType(),
    mutation: schema.getMutationType(),
    subscription: schema.getSubscriptionType()
  } : {};
  return {
    SchemaDefinition: checkOperationTypes,
    SchemaExtension: checkOperationTypes
  };
  function checkOperationTypes(node) {
    var _node$operationTypes;
    const operationTypesNodes = (_node$operationTypes = node.operationTypes) !== null && _node$operationTypes !== void 0 ? _node$operationTypes : [];
    for (const operationType of operationTypesNodes) {
      const operation = operationType.operation;
      const alreadyDefinedOperationType = definedOperationTypes[operation];
      if (existingOperationTypes[operation]) {
        context.reportError(
          new GraphQLError(
            `Type for ${operation} already defined in the schema. It cannot be redefined.`,
            {
              nodes: operationType
            }
          )
        );
      } else if (alreadyDefinedOperationType) {
        context.reportError(
          new GraphQLError(
            `There can be only one ${operation} type in schema.`,
            {
              nodes: [alreadyDefinedOperationType, operationType]
            }
          )
        );
      } else {
        definedOperationTypes[operation] = operationType;
      }
    }
    return false;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueTypeNamesRule.mjs
function UniqueTypeNamesRule(context) {
  const knownTypeNames = /* @__PURE__ */ Object.create(null);
  const schema = context.getSchema();
  return {
    ScalarTypeDefinition: checkTypeName,
    ObjectTypeDefinition: checkTypeName,
    InterfaceTypeDefinition: checkTypeName,
    UnionTypeDefinition: checkTypeName,
    EnumTypeDefinition: checkTypeName,
    InputObjectTypeDefinition: checkTypeName
  };
  function checkTypeName(node) {
    const typeName = node.name.value;
    if (schema !== null && schema !== void 0 && schema.getType(typeName)) {
      context.reportError(
        new GraphQLError(
          `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`,
          {
            nodes: node.name
          }
        )
      );
      return;
    }
    if (knownTypeNames[typeName]) {
      context.reportError(
        new GraphQLError(`There can be only one type named "${typeName}".`, {
          nodes: [knownTypeNames[typeName], node.name]
        })
      );
    } else {
      knownTypeNames[typeName] = node.name;
    }
    return false;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/UniqueVariableNamesRule.mjs
function UniqueVariableNamesRule(context) {
  return {
    OperationDefinition(operationNode) {
      var _operationNode$variab;
      const variableDefinitions = (_operationNode$variab = operationNode.variableDefinitions) !== null && _operationNode$variab !== void 0 ? _operationNode$variab : [];
      const seenVariableDefinitions = groupBy(
        variableDefinitions,
        (node) => node.variable.name.value
      );
      for (const [variableName, variableNodes] of seenVariableDefinitions) {
        if (variableNodes.length > 1) {
          context.reportError(
            new GraphQLError(
              `There can be only one variable named "$${variableName}".`,
              {
                nodes: variableNodes.map((node) => node.variable.name)
              }
            )
          );
        }
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/ValuesOfCorrectTypeRule.mjs
function ValuesOfCorrectTypeRule(context) {
  let variableDefinitions = {};
  return {
    OperationDefinition: {
      enter() {
        variableDefinitions = {};
      }
    },
    VariableDefinition(definition) {
      variableDefinitions[definition.variable.name.value] = definition;
    },
    ListValue(node) {
      const type = getNullableType(context.getParentInputType());
      if (!isListType(type)) {
        isValidValueNode(context, node);
        return false;
      }
    },
    ObjectValue(node) {
      const type = getNamedType(context.getInputType());
      if (!isInputObjectType(type)) {
        isValidValueNode(context, node);
        return false;
      }
      const fieldNodeMap = keyMap(node.fields, (field) => field.name.value);
      for (const fieldDef of Object.values(type.getFields())) {
        const fieldNode = fieldNodeMap[fieldDef.name];
        if (!fieldNode && isRequiredInputField(fieldDef)) {
          const typeStr = inspect(fieldDef.type);
          context.reportError(
            new GraphQLError(
              `Field "${type.name}.${fieldDef.name}" of required type "${typeStr}" was not provided.`,
              {
                nodes: node
              }
            )
          );
        }
      }
      if (type.isOneOf) {
        validateOneOfInputObject(
          context,
          node,
          type,
          fieldNodeMap,
          variableDefinitions
        );
      }
    },
    ObjectField(node) {
      const parentType = getNamedType(context.getParentInputType());
      const fieldType = context.getInputType();
      if (!fieldType && isInputObjectType(parentType)) {
        const suggestions = suggestionList(
          node.name.value,
          Object.keys(parentType.getFields())
        );
        context.reportError(
          new GraphQLError(
            `Field "${node.name.value}" is not defined by type "${parentType.name}".` + didYouMean(suggestions),
            {
              nodes: node
            }
          )
        );
      }
    },
    NullValue(node) {
      const type = context.getInputType();
      if (isNonNullType(type)) {
        context.reportError(
          new GraphQLError(
            `Expected value of type "${inspect(type)}", found ${print(node)}.`,
            {
              nodes: node
            }
          )
        );
      }
    },
    EnumValue: (node) => isValidValueNode(context, node),
    IntValue: (node) => isValidValueNode(context, node),
    FloatValue: (node) => isValidValueNode(context, node),
    StringValue: (node) => isValidValueNode(context, node),
    BooleanValue: (node) => isValidValueNode(context, node)
  };
}
function isValidValueNode(context, node) {
  const locationType = context.getInputType();
  if (!locationType) {
    return;
  }
  const type = getNamedType(locationType);
  if (!isLeafType(type)) {
    const typeStr = inspect(locationType);
    context.reportError(
      new GraphQLError(
        `Expected value of type "${typeStr}", found ${print(node)}.`,
        {
          nodes: node
        }
      )
    );
    return;
  }
  try {
    const parseResult = type.parseLiteral(
      node,
      void 0
      /* variables */
    );
    if (parseResult === void 0) {
      const typeStr = inspect(locationType);
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}.`,
          {
            nodes: node
          }
        )
      );
    }
  } catch (error) {
    const typeStr = inspect(locationType);
    if (error instanceof GraphQLError) {
      context.reportError(error);
    } else {
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}; ` + error.message,
          {
            nodes: node,
            originalError: error
          }
        )
      );
    }
  }
}
function validateOneOfInputObject(context, node, type, fieldNodeMap, variableDefinitions) {
  var _fieldNodeMap$keys$;
  const keys = Object.keys(fieldNodeMap);
  const isNotExactlyOneField = keys.length !== 1;
  if (isNotExactlyOneField) {
    context.reportError(
      new GraphQLError(
        `OneOf Input Object "${type.name}" must specify exactly one key.`,
        {
          nodes: [node]
        }
      )
    );
    return;
  }
  const value = (_fieldNodeMap$keys$ = fieldNodeMap[keys[0]]) === null || _fieldNodeMap$keys$ === void 0 ? void 0 : _fieldNodeMap$keys$.value;
  const isNullLiteral = !value || value.kind === Kind.NULL;
  const isVariable = (value === null || value === void 0 ? void 0 : value.kind) === Kind.VARIABLE;
  if (isNullLiteral) {
    context.reportError(
      new GraphQLError(`Field "${type.name}.${keys[0]}" must be non-null.`, {
        nodes: [node]
      })
    );
    return;
  }
  if (isVariable) {
    const variableName = value.name.value;
    const definition = variableDefinitions[variableName];
    const isNullableVariable = definition.type.kind !== Kind.NON_NULL_TYPE;
    if (isNullableVariable) {
      context.reportError(
        new GraphQLError(
          `Variable "${variableName}" must be non-nullable to be used for OneOf Input Object "${type.name}".`,
          {
            nodes: [node]
          }
        )
      );
    }
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/VariablesAreInputTypesRule.mjs
function VariablesAreInputTypesRule(context) {
  return {
    VariableDefinition(node) {
      const type = typeFromAST(context.getSchema(), node.type);
      if (type !== void 0 && !isInputType(type)) {
        const variableName = node.variable.name.value;
        const typeName = print(node.type);
        context.reportError(
          new GraphQLError(
            `Variable "$${variableName}" cannot be non-input type "${typeName}".`,
            {
              nodes: node.type
            }
          )
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/VariablesInAllowedPositionRule.mjs
function VariablesInAllowedPositionRule(context) {
  let varDefMap = /* @__PURE__ */ Object.create(null);
  return {
    OperationDefinition: {
      enter() {
        varDefMap = /* @__PURE__ */ Object.create(null);
      },
      leave(operation) {
        const usages = context.getRecursiveVariableUsages(operation);
        for (const { node, type, defaultValue } of usages) {
          const varName = node.name.value;
          const varDef = varDefMap[varName];
          if (varDef && type) {
            const schema = context.getSchema();
            const varType = typeFromAST(schema, varDef.type);
            if (varType && !allowedVariableUsage(
              schema,
              varType,
              varDef.defaultValue,
              type,
              defaultValue
            )) {
              const varTypeStr = inspect(varType);
              const typeStr = inspect(type);
              context.reportError(
                new GraphQLError(
                  `Variable "$${varName}" of type "${varTypeStr}" used in position expecting type "${typeStr}".`,
                  {
                    nodes: [varDef, node]
                  }
                )
              );
            }
          }
        }
      }
    },
    VariableDefinition(node) {
      varDefMap[node.variable.name.value] = node;
    }
  };
}
function allowedVariableUsage(schema, varType, varDefaultValue, locationType, locationDefaultValue) {
  if (isNonNullType(locationType) && !isNonNullType(varType)) {
    const hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== Kind.NULL;
    const hasLocationDefaultValue = locationDefaultValue !== void 0;
    if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
      return false;
    }
    const nullableLocationType = locationType.ofType;
    return isTypeSubTypeOf(schema, varType, nullableLocationType);
  }
  return isTypeSubTypeOf(schema, varType, locationType);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/specifiedRules.mjs
var recommendedRules = Object.freeze([MaxIntrospectionDepthRule]);
var specifiedRules = Object.freeze([
  ExecutableDefinitionsRule,
  UniqueOperationNamesRule,
  LoneAnonymousOperationRule,
  SingleFieldSubscriptionsRule,
  KnownTypeNamesRule,
  FragmentsOnCompositeTypesRule,
  VariablesAreInputTypesRule,
  ScalarLeafsRule,
  FieldsOnCorrectTypeRule,
  UniqueFragmentNamesRule,
  KnownFragmentNamesRule,
  NoUnusedFragmentsRule,
  PossibleFragmentSpreadsRule,
  NoFragmentCyclesRule,
  UniqueVariableNamesRule,
  NoUndefinedVariablesRule,
  NoUnusedVariablesRule,
  KnownDirectivesRule,
  UniqueDirectivesPerLocationRule,
  KnownArgumentNamesRule,
  UniqueArgumentNamesRule,
  ValuesOfCorrectTypeRule,
  ProvidedRequiredArgumentsRule,
  VariablesInAllowedPositionRule,
  OverlappingFieldsCanBeMergedRule,
  UniqueInputFieldNamesRule,
  ...recommendedRules
]);
var specifiedSDLRules = Object.freeze([
  LoneSchemaDefinitionRule,
  UniqueOperationTypesRule,
  UniqueTypeNamesRule,
  UniqueEnumValueNamesRule,
  UniqueFieldDefinitionNamesRule,
  UniqueArgumentDefinitionNamesRule,
  UniqueDirectiveNamesRule,
  KnownTypeNamesRule,
  KnownDirectivesRule,
  UniqueDirectivesPerLocationRule,
  PossibleTypeExtensionsRule,
  KnownArgumentNamesOnDirectivesRule,
  UniqueArgumentNamesRule,
  UniqueInputFieldNamesRule,
  ProvidedRequiredArgumentsOnDirectivesRule
]);

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/ValidationContext.mjs
var ASTValidationContext = class {
  constructor(ast, onError) {
    this._ast = ast;
    this._fragments = void 0;
    this._fragmentSpreads = /* @__PURE__ */ new Map();
    this._recursivelyReferencedFragments = /* @__PURE__ */ new Map();
    this._onError = onError;
  }
  get [Symbol.toStringTag]() {
    return "ASTValidationContext";
  }
  reportError(error) {
    this._onError(error);
  }
  getDocument() {
    return this._ast;
  }
  getFragment(name) {
    let fragments;
    if (this._fragments) {
      fragments = this._fragments;
    } else {
      fragments = /* @__PURE__ */ Object.create(null);
      for (const defNode of this.getDocument().definitions) {
        if (defNode.kind === Kind.FRAGMENT_DEFINITION) {
          fragments[defNode.name.value] = defNode;
        }
      }
      this._fragments = fragments;
    }
    return fragments[name];
  }
  getFragmentSpreads(node) {
    let spreads = this._fragmentSpreads.get(node);
    if (!spreads) {
      spreads = [];
      const setsToVisit = [node];
      let set;
      while (set = setsToVisit.pop()) {
        for (const selection of set.selections) {
          if (selection.kind === Kind.FRAGMENT_SPREAD) {
            spreads.push(selection);
          } else if (selection.selectionSet) {
            setsToVisit.push(selection.selectionSet);
          }
        }
      }
      this._fragmentSpreads.set(node, spreads);
    }
    return spreads;
  }
  getRecursivelyReferencedFragments(operation) {
    let fragments = this._recursivelyReferencedFragments.get(operation);
    if (!fragments) {
      fragments = [];
      const collectedNames = /* @__PURE__ */ Object.create(null);
      const nodesToVisit = [operation.selectionSet];
      let node;
      while (node = nodesToVisit.pop()) {
        for (const spread of this.getFragmentSpreads(node)) {
          const fragName = spread.name.value;
          if (collectedNames[fragName] !== true) {
            collectedNames[fragName] = true;
            const fragment = this.getFragment(fragName);
            if (fragment) {
              fragments.push(fragment);
              nodesToVisit.push(fragment.selectionSet);
            }
          }
        }
      }
      this._recursivelyReferencedFragments.set(operation, fragments);
    }
    return fragments;
  }
};
var SDLValidationContext = class extends ASTValidationContext {
  constructor(ast, schema, onError) {
    super(ast, onError);
    this._schema = schema;
  }
  get [Symbol.toStringTag]() {
    return "SDLValidationContext";
  }
  getSchema() {
    return this._schema;
  }
};
var ValidationContext = class extends ASTValidationContext {
  constructor(schema, ast, typeInfo, onError) {
    super(ast, onError);
    this._schema = schema;
    this._typeInfo = typeInfo;
    this._variableUsages = /* @__PURE__ */ new Map();
    this._recursiveVariableUsages = /* @__PURE__ */ new Map();
  }
  get [Symbol.toStringTag]() {
    return "ValidationContext";
  }
  getSchema() {
    return this._schema;
  }
  getVariableUsages(node) {
    let usages = this._variableUsages.get(node);
    if (!usages) {
      const newUsages = [];
      const typeInfo = new TypeInfo(this._schema);
      visit(
        node,
        visitWithTypeInfo(typeInfo, {
          VariableDefinition: () => false,
          Variable(variable) {
            newUsages.push({
              node: variable,
              type: typeInfo.getInputType(),
              defaultValue: typeInfo.getDefaultValue()
            });
          }
        })
      );
      usages = newUsages;
      this._variableUsages.set(node, usages);
    }
    return usages;
  }
  getRecursiveVariableUsages(operation) {
    let usages = this._recursiveVariableUsages.get(operation);
    if (!usages) {
      usages = this.getVariableUsages(operation);
      for (const frag of this.getRecursivelyReferencedFragments(operation)) {
        usages = usages.concat(this.getVariableUsages(frag));
      }
      this._recursiveVariableUsages.set(operation, usages);
    }
    return usages;
  }
  getType() {
    return this._typeInfo.getType();
  }
  getParentType() {
    return this._typeInfo.getParentType();
  }
  getInputType() {
    return this._typeInfo.getInputType();
  }
  getParentInputType() {
    return this._typeInfo.getParentInputType();
  }
  getFieldDef() {
    return this._typeInfo.getFieldDef();
  }
  getDirective() {
    return this._typeInfo.getDirective();
  }
  getArgument() {
    return this._typeInfo.getArgument();
  }
  getEnumValue() {
    return this._typeInfo.getEnumValue();
  }
};

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/validate.mjs
function validate(schema, documentAST, rules = specifiedRules, options, typeInfo = new TypeInfo(schema)) {
  var _options$maxErrors;
  const maxErrors = (_options$maxErrors = options === null || options === void 0 ? void 0 : options.maxErrors) !== null && _options$maxErrors !== void 0 ? _options$maxErrors : 100;
  documentAST || devAssert(false, "Must provide document.");
  assertValidSchema(schema);
  const abortObj = Object.freeze({});
  const errors = [];
  const context = new ValidationContext(
    schema,
    documentAST,
    typeInfo,
    (error) => {
      if (errors.length >= maxErrors) {
        errors.push(
          new GraphQLError(
            "Too many validation errors, error limit reached. Validation aborted."
          )
        );
        throw abortObj;
      }
      errors.push(error);
    }
  );
  const visitor = visitInParallel(rules.map((rule) => rule(context)));
  try {
    visit(documentAST, visitWithTypeInfo(typeInfo, visitor));
  } catch (e) {
    if (e !== abortObj) {
      throw e;
    }
  }
  return errors;
}
function validateSDL(documentAST, schemaToExtend, rules = specifiedSDLRules) {
  const errors = [];
  const context = new SDLValidationContext(
    documentAST,
    schemaToExtend,
    (error) => {
      errors.push(error);
    }
  );
  const visitors = rules.map((rule) => rule(context));
  visit(documentAST, visitInParallel(visitors));
  return errors;
}
function assertValidSDL(documentAST) {
  const errors = validateSDL(documentAST);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join("\n\n"));
  }
}
function assertValidSDLExtension(documentAST, schema) {
  const errors = validateSDL(documentAST, schema);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join("\n\n"));
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/memoize3.mjs
function memoize3(fn) {
  let cache0;
  return function memoized(a1, a2, a3) {
    if (cache0 === void 0) {
      cache0 = /* @__PURE__ */ new WeakMap();
    }
    let cache1 = cache0.get(a1);
    if (cache1 === void 0) {
      cache1 = /* @__PURE__ */ new WeakMap();
      cache0.set(a1, cache1);
    }
    let cache2 = cache1.get(a2);
    if (cache2 === void 0) {
      cache2 = /* @__PURE__ */ new WeakMap();
      cache1.set(a2, cache2);
    }
    let fnResult = cache2.get(a3);
    if (fnResult === void 0) {
      fnResult = fn(a1, a2, a3);
      cache2.set(a3, fnResult);
    }
    return fnResult;
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/promiseForObject.mjs
function promiseForObject(object) {
  return Promise.all(Object.values(object)).then((resolvedValues) => {
    const resolvedObject = /* @__PURE__ */ Object.create(null);
    for (const [i, key] of Object.keys(object).entries()) {
      resolvedObject[key] = resolvedValues[i];
    }
    return resolvedObject;
  });
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/promiseReduce.mjs
function promiseReduce(values, callbackFn, initialValue) {
  let accumulator = initialValue;
  for (const value of values) {
    accumulator = isPromise(accumulator) ? accumulator.then((resolved) => callbackFn(resolved, value)) : callbackFn(accumulator, value);
  }
  return accumulator;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/toError.mjs
function toError(thrownValue) {
  return thrownValue instanceof Error ? thrownValue : new NonErrorThrown(thrownValue);
}
var NonErrorThrown = class extends Error {
  constructor(thrownValue) {
    super("Unexpected error value: " + inspect(thrownValue));
    this.name = "NonErrorThrown";
    this.thrownValue = thrownValue;
  }
};

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/error/locatedError.mjs
function locatedError(rawOriginalError, nodes, path) {
  var _nodes;
  const originalError = toError(rawOriginalError);
  if (isLocatedGraphQLError(originalError)) {
    return originalError;
  }
  return new GraphQLError(originalError.message, {
    nodes: (_nodes = originalError.nodes) !== null && _nodes !== void 0 ? _nodes : nodes,
    source: originalError.source,
    positions: originalError.positions,
    path,
    originalError
  });
}
function isLocatedGraphQLError(error) {
  return Array.isArray(error.path);
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/execution/execute.mjs
var collectSubfields2 = memoize3(
  (exeContext, returnType, fieldNodes) => collectSubfields(
    exeContext.schema,
    exeContext.fragments,
    exeContext.variableValues,
    returnType,
    fieldNodes
  )
);
function execute(args) {
  arguments.length < 2 || devAssert(
    false,
    "graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead."
  );
  const { schema, document, variableValues, rootValue } = args;
  assertValidExecutionArguments(schema, document, variableValues);
  const exeContext = buildExecutionContext(args);
  if (!("schema" in exeContext)) {
    return {
      errors: exeContext
    };
  }
  try {
    const { operation } = exeContext;
    const result = executeOperation(exeContext, operation, rootValue);
    if (isPromise(result)) {
      return result.then(
        (data) => buildResponse(data, exeContext.errors),
        (error) => {
          exeContext.errors.push(error);
          return buildResponse(null, exeContext.errors);
        }
      );
    }
    return buildResponse(result, exeContext.errors);
  } catch (error) {
    exeContext.errors.push(error);
    return buildResponse(null, exeContext.errors);
  }
}
function executeSync(args) {
  const result = execute(args);
  if (isPromise(result)) {
    throw new Error("GraphQL execution failed to complete synchronously.");
  }
  return result;
}
function buildResponse(data, errors) {
  return errors.length === 0 ? {
    data
  } : {
    errors,
    data
  };
}
function assertValidExecutionArguments(schema, document, rawVariableValues) {
  document || devAssert(false, "Must provide document.");
  assertValidSchema(schema);
  rawVariableValues == null || isObjectLike(rawVariableValues) || devAssert(
    false,
    "Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided."
  );
}
function buildExecutionContext(args) {
  var _definition$name, _operation$variableDe;
  const {
    schema,
    document,
    rootValue,
    contextValue,
    variableValues: rawVariableValues,
    operationName,
    fieldResolver,
    typeResolver,
    subscribeFieldResolver
  } = args;
  let operation;
  const fragments = /* @__PURE__ */ Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== void 0) {
            return [
              new GraphQLError(
                "Must provide operation name if query contains multiple operations."
              )
            ];
          }
          operation = definition;
        } else if (((_definition$name = definition.name) === null || _definition$name === void 0 ? void 0 : _definition$name.value) === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
      default:
    }
  }
  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError("Must provide an operation.")];
  }
  const variableDefinitions = (_operation$variableDe = operation.variableDefinitions) !== null && _operation$variableDe !== void 0 ? _operation$variableDe : [];
  const coercedVariableValues = getVariableValues(
    schema,
    variableDefinitions,
    rawVariableValues !== null && rawVariableValues !== void 0 ? rawVariableValues : {},
    {
      maxErrors: 50
    }
  );
  if (coercedVariableValues.errors) {
    return coercedVariableValues.errors;
  }
  return {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: coercedVariableValues.coerced,
    fieldResolver: fieldResolver !== null && fieldResolver !== void 0 ? fieldResolver : defaultFieldResolver,
    typeResolver: typeResolver !== null && typeResolver !== void 0 ? typeResolver : defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver !== null && subscribeFieldResolver !== void 0 ? subscribeFieldResolver : defaultFieldResolver,
    errors: []
  };
}
function executeOperation(exeContext, operation, rootValue) {
  const rootType = exeContext.schema.getRootType(operation.operation);
  if (rootType == null) {
    throw new GraphQLError(
      `Schema is not configured to execute ${operation.operation} operation.`,
      {
        nodes: operation
      }
    );
  }
  const rootFields = collectFields(
    exeContext.schema,
    exeContext.fragments,
    exeContext.variableValues,
    rootType,
    operation.selectionSet
  );
  const path = void 0;
  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      return executeFields(exeContext, rootType, rootValue, path, rootFields);
    case OperationTypeNode.MUTATION:
      return executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        rootFields
      );
    case OperationTypeNode.SUBSCRIPTION:
      return executeFields(exeContext, rootType, rootValue, path, rootFields);
  }
}
function executeFieldsSerially(exeContext, parentType, sourceValue, path, fields) {
  return promiseReduce(
    fields.entries(),
    (results, [responseName, fieldNodes]) => {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath
      );
      if (result === void 0) {
        return results;
      }
      if (isPromise(result)) {
        return result.then((resolvedResult) => {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    },
    /* @__PURE__ */ Object.create(null)
  );
}
function executeFields(exeContext, parentType, sourceValue, path, fields) {
  const results = /* @__PURE__ */ Object.create(null);
  let containsPromise = false;
  try {
    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath
      );
      if (result !== void 0) {
        results[responseName] = result;
        if (isPromise(result)) {
          containsPromise = true;
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      return promiseForObject(results).finally(() => {
        throw error;
      });
    }
    throw error;
  }
  if (!containsPromise) {
    return results;
  }
  return promiseForObject(results);
}
function executeField(exeContext, parentType, source, fieldNodes, path) {
  var _fieldDef$resolve;
  const fieldDef = getFieldDef2(exeContext.schema, parentType, fieldNodes[0]);
  if (!fieldDef) {
    return;
  }
  const returnType = fieldDef.type;
  const resolveFn = (_fieldDef$resolve = fieldDef.resolve) !== null && _fieldDef$resolve !== void 0 ? _fieldDef$resolve : exeContext.fieldResolver;
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    parentType,
    path
  );
  try {
    const args = getArgumentValues(
      fieldDef,
      fieldNodes[0],
      exeContext.variableValues
    );
    const contextValue = exeContext.contextValue;
    const result = resolveFn(source, args, contextValue, info);
    let completed;
    if (isPromise(result)) {
      completed = result.then(
        (resolved) => completeValue(exeContext, returnType, fieldNodes, info, path, resolved)
      );
    } else {
      completed = completeValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result
      );
    }
    if (isPromise(completed)) {
      return completed.then(void 0, (rawError) => {
        const error = locatedError(rawError, fieldNodes, pathToArray(path));
        return handleFieldError(error, returnType, exeContext);
      });
    }
    return completed;
  } catch (rawError) {
    const error = locatedError(rawError, fieldNodes, pathToArray(path));
    return handleFieldError(error, returnType, exeContext);
  }
}
function buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path) {
  return {
    fieldName: fieldDef.name,
    fieldNodes,
    returnType: fieldDef.type,
    parentType,
    path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues
  };
}
function handleFieldError(error, returnType, exeContext) {
  if (isNonNullType(returnType)) {
    throw error;
  }
  exeContext.errors.push(error);
  return null;
}
function completeValue(exeContext, returnType, fieldNodes, info, path, result) {
  if (result instanceof Error) {
    throw result;
  }
  if (isNonNullType(returnType)) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldNodes,
      info,
      path,
      result
    );
    if (completed === null) {
      throw new Error(
        `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`
      );
    }
    return completed;
  }
  if (result == null) {
    return null;
  }
  if (isListType(returnType)) {
    return completeListValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result
    );
  }
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }
  if (isAbstractType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result
    );
  }
  if (isObjectType(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldNodes,
      info,
      path,
      result
    );
  }
  invariant(
    false,
    "Cannot complete value of unexpected output type: " + inspect(returnType)
  );
}
function completeListValue(exeContext, returnType, fieldNodes, info, path, result) {
  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`
    );
  }
  const itemType = returnType.ofType;
  let containsPromise = false;
  const completedResults = Array.from(result, (item, index) => {
    const itemPath = addPath(path, index, void 0);
    try {
      let completedItem;
      if (isPromise(item)) {
        completedItem = item.then(
          (resolved) => completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved
          )
        );
      } else {
        completedItem = completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          itemPath,
          item
        );
      }
      if (isPromise(completedItem)) {
        containsPromise = true;
        return completedItem.then(void 0, (rawError) => {
          const error = locatedError(
            rawError,
            fieldNodes,
            pathToArray(itemPath)
          );
          return handleFieldError(error, itemType, exeContext);
        });
      }
      return completedItem;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
      return handleFieldError(error, itemType, exeContext);
    }
  });
  return containsPromise ? Promise.all(completedResults) : completedResults;
}
function completeLeafValue(returnType, result) {
  const serializedResult = returnType.serialize(result);
  if (serializedResult == null) {
    throw new Error(
      `Expected \`${inspect(returnType)}.serialize(${inspect(result)})\` to return non-nullable value, returned: ${inspect(serializedResult)}`
    );
  }
  return serializedResult;
}
function completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result) {
  var _returnType$resolveTy;
  const resolveTypeFn = (_returnType$resolveTy = returnType.resolveType) !== null && _returnType$resolveTy !== void 0 ? _returnType$resolveTy : exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
  if (isPromise(runtimeType)) {
    return runtimeType.then(
      (resolvedRuntimeType) => completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          exeContext,
          returnType,
          fieldNodes,
          info,
          result
        ),
        fieldNodes,
        info,
        path,
        result
      )
    );
  }
  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      exeContext,
      returnType,
      fieldNodes,
      info,
      result
    ),
    fieldNodes,
    info,
    path,
    result
  );
}
function ensureValidRuntimeType(runtimeTypeName, exeContext, returnType, fieldNodes, info, result) {
  if (runtimeTypeName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      fieldNodes
    );
  }
  if (isObjectType(runtimeTypeName)) {
    throw new GraphQLError(
      "Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead."
    );
  }
  if (typeof runtimeTypeName !== "string") {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`
    );
  }
  const runtimeType = exeContext.schema.getType(runtimeTypeName);
  if (runtimeType == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
      {
        nodes: fieldNodes
      }
    );
  }
  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
      {
        nodes: fieldNodes
      }
    );
  }
  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      {
        nodes: fieldNodes
      }
    );
  }
  return runtimeType;
}
function completeObjectValue(exeContext, returnType, fieldNodes, info, path, result) {
  const subFieldNodes = collectSubfields2(exeContext, returnType, fieldNodes);
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);
    if (isPromise(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
        return executeFields(
          exeContext,
          returnType,
          result,
          path,
          subFieldNodes
        );
      });
    }
    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldNodes);
    }
  }
  return executeFields(exeContext, returnType, result, path, subFieldNodes);
}
function invalidReturnTypeError(returnType, result, fieldNodes) {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    {
      nodes: fieldNodes
    }
  );
}
var defaultTypeResolver = function(value, contextValue, info, abstractType) {
  if (isObjectLike(value) && typeof value.__typename === "string") {
    return value.__typename;
  }
  const possibleTypes = info.schema.getPossibleTypes(abstractType);
  const promisedIsTypeOfResults = [];
  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];
    if (type.isTypeOf) {
      const isTypeOfResult = type.isTypeOf(value, contextValue, info);
      if (isPromise(isTypeOfResult)) {
        promisedIsTypeOfResults[i] = isTypeOfResult;
      } else if (isTypeOfResult) {
        return type.name;
      }
    }
  }
  if (promisedIsTypeOfResults.length) {
    return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
      for (let i = 0; i < isTypeOfResults.length; i++) {
        if (isTypeOfResults[i]) {
          return possibleTypes[i].name;
        }
      }
    });
  }
};
var defaultFieldResolver = function(source, args, contextValue, info) {
  if (isObjectLike(source) || typeof source === "function") {
    const property = source[info.fieldName];
    if (typeof property === "function") {
      return source[info.fieldName](args, contextValue, info);
    }
    return property;
  }
};
function getFieldDef2(schema, parentType, fieldNode) {
  const fieldName = fieldNode.name.value;
  if (fieldName === SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  } else if (fieldName === TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  } else if (fieldName === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef;
  }
  return parentType.getFields()[fieldName];
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/graphql.mjs
function graphql(args) {
  return new Promise((resolve) => resolve(graphqlImpl(args)));
}
function graphqlSync(args) {
  const result = graphqlImpl(args);
  if (isPromise(result)) {
    throw new Error("GraphQL execution failed to complete synchronously.");
  }
  return result;
}
function graphqlImpl(args) {
  arguments.length < 2 || devAssert(
    false,
    "graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead."
  );
  const {
    schema,
    source,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver
  } = args;
  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    return {
      errors: schemaValidationErrors
    };
  }
  let document;
  try {
    document = parse(source);
  } catch (syntaxError2) {
    return {
      errors: [syntaxError2]
    };
  }
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return {
      errors: validationErrors
    };
  }
  return execute({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver
  });
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/jsutils/isAsyncIterable.mjs
function isAsyncIterable(maybeAsyncIterable) {
  return typeof (maybeAsyncIterable === null || maybeAsyncIterable === void 0 ? void 0 : maybeAsyncIterable[Symbol.asyncIterator]) === "function";
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/execution/mapAsyncIterator.mjs
function mapAsyncIterator(iterable, callback) {
  const iterator = iterable[Symbol.asyncIterator]();
  async function mapResult(result) {
    if (result.done) {
      return result;
    }
    try {
      return {
        value: await callback(result.value),
        done: false
      };
    } catch (error) {
      if (typeof iterator.return === "function") {
        try {
          await iterator.return();
        } catch (_e) {
        }
      }
      throw error;
    }
  }
  return {
    async next() {
      return mapResult(await iterator.next());
    },
    async return() {
      return typeof iterator.return === "function" ? mapResult(await iterator.return()) : {
        value: void 0,
        done: true
      };
    },
    async throw(error) {
      if (typeof iterator.throw === "function") {
        return mapResult(await iterator.throw(error));
      }
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/execution/subscribe.mjs
async function subscribe(args) {
  arguments.length < 2 || devAssert(
    false,
    "graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead."
  );
  const resultOrStream = await createSourceEventStream(args);
  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }
  const mapSourceToResponse = (payload) => execute({ ...args, rootValue: payload });
  return mapAsyncIterator(resultOrStream, mapSourceToResponse);
}
function toNormalizedArgs(args) {
  const firstArg = args[0];
  if (firstArg && "document" in firstArg) {
    return firstArg;
  }
  return {
    schema: firstArg,
    // FIXME: when underlying TS bug fixed, see https://github.com/microsoft/TypeScript/issues/31613
    document: args[1],
    rootValue: args[2],
    contextValue: args[3],
    variableValues: args[4],
    operationName: args[5],
    subscribeFieldResolver: args[6]
  };
}
async function createSourceEventStream(...rawArgs) {
  const args = toNormalizedArgs(rawArgs);
  const { schema, document, variableValues } = args;
  assertValidExecutionArguments(schema, document, variableValues);
  const exeContext = buildExecutionContext(args);
  if (!("schema" in exeContext)) {
    return {
      errors: exeContext
    };
  }
  try {
    const eventStream = await executeSubscription(exeContext);
    if (!isAsyncIterable(eventStream)) {
      throw new Error(
        `Subscription field must return Async Iterable. Received: ${inspect(eventStream)}.`
      );
    }
    return eventStream;
  } catch (error) {
    if (error instanceof GraphQLError) {
      return {
        errors: [error]
      };
    }
    throw error;
  }
}
async function executeSubscription(exeContext) {
  const { schema, fragments, operation, variableValues, rootValue } = exeContext;
  const rootType = schema.getSubscriptionType();
  if (rootType == null) {
    throw new GraphQLError(
      "Schema is not configured to execute subscription operation.",
      {
        nodes: operation
      }
    );
  }
  const rootFields = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation.selectionSet
  );
  const [responseName, fieldNodes] = [...rootFields.entries()][0];
  const fieldDef = getFieldDef2(schema, rootType, fieldNodes[0]);
  if (!fieldDef) {
    const fieldName = fieldNodes[0].name.value;
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      {
        nodes: fieldNodes
      }
    );
  }
  const path = addPath(void 0, responseName, rootType.name);
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldNodes,
    rootType,
    path
  );
  try {
    var _fieldDef$subscribe;
    const args = getArgumentValues(fieldDef, fieldNodes[0], variableValues);
    const contextValue = exeContext.contextValue;
    const resolveFn = (_fieldDef$subscribe = fieldDef.subscribe) !== null && _fieldDef$subscribe !== void 0 ? _fieldDef$subscribe : exeContext.subscribeFieldResolver;
    const eventStream = await resolveFn(rootValue, args, contextValue, info);
    if (eventStream instanceof Error) {
      throw eventStream;
    }
    return eventStream;
  } catch (error) {
    throw locatedError(error, fieldNodes, pathToArray(path));
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/custom/NoDeprecatedCustomRule.mjs
function NoDeprecatedCustomRule(context) {
  return {
    Field(node) {
      const fieldDef = context.getFieldDef();
      const deprecationReason = fieldDef === null || fieldDef === void 0 ? void 0 : fieldDef.deprecationReason;
      if (fieldDef && deprecationReason != null) {
        const parentType = context.getParentType();
        parentType != null || invariant(false);
        context.reportError(
          new GraphQLError(
            `The field ${parentType.name}.${fieldDef.name} is deprecated. ${deprecationReason}`,
            {
              nodes: node
            }
          )
        );
      }
    },
    Argument(node) {
      const argDef = context.getArgument();
      const deprecationReason = argDef === null || argDef === void 0 ? void 0 : argDef.deprecationReason;
      if (argDef && deprecationReason != null) {
        const directiveDef = context.getDirective();
        if (directiveDef != null) {
          context.reportError(
            new GraphQLError(
              `Directive "@${directiveDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
              {
                nodes: node
              }
            )
          );
        } else {
          const parentType = context.getParentType();
          const fieldDef = context.getFieldDef();
          parentType != null && fieldDef != null || invariant(false);
          context.reportError(
            new GraphQLError(
              `Field "${parentType.name}.${fieldDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
              {
                nodes: node
              }
            )
          );
        }
      }
    },
    ObjectField(node) {
      const inputObjectDef = getNamedType(context.getParentInputType());
      if (isInputObjectType(inputObjectDef)) {
        const inputFieldDef = inputObjectDef.getFields()[node.name.value];
        const deprecationReason = inputFieldDef === null || inputFieldDef === void 0 ? void 0 : inputFieldDef.deprecationReason;
        if (deprecationReason != null) {
          context.reportError(
            new GraphQLError(
              `The input field ${inputObjectDef.name}.${inputFieldDef.name} is deprecated. ${deprecationReason}`,
              {
                nodes: node
              }
            )
          );
        }
      }
    },
    EnumValue(node) {
      const enumValueDef = context.getEnumValue();
      const deprecationReason = enumValueDef === null || enumValueDef === void 0 ? void 0 : enumValueDef.deprecationReason;
      if (enumValueDef && deprecationReason != null) {
        const enumTypeDef = getNamedType(context.getInputType());
        enumTypeDef != null || invariant(false);
        context.reportError(
          new GraphQLError(
            `The enum value "${enumTypeDef.name}.${enumValueDef.name}" is deprecated. ${deprecationReason}`,
            {
              nodes: node
            }
          )
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/validation/rules/custom/NoSchemaIntrospectionCustomRule.mjs
function NoSchemaIntrospectionCustomRule(context) {
  return {
    Field(node) {
      const type = getNamedType(context.getType());
      if (type && isIntrospectionType(type)) {
        context.reportError(
          new GraphQLError(
            `GraphQL introspection has been disabled, but the requested query contained the field "${node.name.value}".`,
            {
              nodes: node
            }
          )
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/getIntrospectionQuery.mjs
function getIntrospectionQuery(options) {
  const optionsWithDefault = {
    descriptions: true,
    specifiedByUrl: false,
    directiveIsRepeatable: false,
    schemaDescription: false,
    inputValueDeprecation: false,
    oneOf: false,
    ...options
  };
  const descriptions = optionsWithDefault.descriptions ? "description" : "";
  const specifiedByUrl = optionsWithDefault.specifiedByUrl ? "specifiedByURL" : "";
  const directiveIsRepeatable = optionsWithDefault.directiveIsRepeatable ? "isRepeatable" : "";
  const schemaDescription = optionsWithDefault.schemaDescription ? descriptions : "";
  function inputDeprecation(str) {
    return optionsWithDefault.inputValueDeprecation ? str : "";
  }
  const oneOf = optionsWithDefault.oneOf ? "isOneOf" : "";
  return `
    query IntrospectionQuery {
      __schema {
        ${schemaDescription}
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          ${descriptions}
          ${directiveIsRepeatable}
          locations
          args${inputDeprecation("(includeDeprecated: true)")} {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      ${descriptions}
      ${specifiedByUrl}
      ${oneOf}
      fields(includeDeprecated: true) {
        name
        ${descriptions}
        args${inputDeprecation("(includeDeprecated: true)")} {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields${inputDeprecation("(includeDeprecated: true)")} {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        ${descriptions}
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      ${descriptions}
      type { ...TypeRef }
      defaultValue
      ${inputDeprecation("isDeprecated")}
      ${inputDeprecation("deprecationReason")}
    }

    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/getOperationAST.mjs
function getOperationAST(documentAST, operationName) {
  let operation = null;
  for (const definition of documentAST.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      var _definition$name;
      if (operationName == null) {
        if (operation) {
          return null;
        }
        operation = definition;
      } else if (((_definition$name = definition.name) === null || _definition$name === void 0 ? void 0 : _definition$name.value) === operationName) {
        return definition;
      }
    }
  }
  return operation;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/getOperationRootType.mjs
function getOperationRootType(schema, operation) {
  if (operation.operation === "query") {
    const queryType = schema.getQueryType();
    if (!queryType) {
      throw new GraphQLError(
        "Schema does not define the required query root type.",
        {
          nodes: operation
        }
      );
    }
    return queryType;
  }
  if (operation.operation === "mutation") {
    const mutationType = schema.getMutationType();
    if (!mutationType) {
      throw new GraphQLError("Schema is not configured for mutations.", {
        nodes: operation
      });
    }
    return mutationType;
  }
  if (operation.operation === "subscription") {
    const subscriptionType = schema.getSubscriptionType();
    if (!subscriptionType) {
      throw new GraphQLError("Schema is not configured for subscriptions.", {
        nodes: operation
      });
    }
    return subscriptionType;
  }
  throw new GraphQLError(
    "Can only have query, mutation and subscription operations.",
    {
      nodes: operation
    }
  );
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/introspectionFromSchema.mjs
function introspectionFromSchema(schema, options) {
  const optionsWithDefaults = {
    specifiedByUrl: true,
    directiveIsRepeatable: true,
    schemaDescription: true,
    inputValueDeprecation: true,
    oneOf: true,
    ...options
  };
  const document = parse(getIntrospectionQuery(optionsWithDefaults));
  const result = executeSync({
    schema,
    document
  });
  !result.errors && result.data || invariant(false);
  return result.data;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/buildClientSchema.mjs
function buildClientSchema(introspection, options) {
  isObjectLike(introspection) && isObjectLike(introspection.__schema) || devAssert(
    false,
    `Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ${inspect(
      introspection
    )}.`
  );
  const schemaIntrospection = introspection.__schema;
  const typeMap = keyValMap(
    schemaIntrospection.types,
    (typeIntrospection) => typeIntrospection.name,
    (typeIntrospection) => buildType(typeIntrospection)
  );
  for (const stdType of [...specifiedScalarTypes, ...introspectionTypes]) {
    if (typeMap[stdType.name]) {
      typeMap[stdType.name] = stdType;
    }
  }
  const queryType = schemaIntrospection.queryType ? getObjectType(schemaIntrospection.queryType) : null;
  const mutationType = schemaIntrospection.mutationType ? getObjectType(schemaIntrospection.mutationType) : null;
  const subscriptionType = schemaIntrospection.subscriptionType ? getObjectType(schemaIntrospection.subscriptionType) : null;
  const directives = schemaIntrospection.directives ? schemaIntrospection.directives.map(buildDirective) : [];
  return new GraphQLSchema({
    description: schemaIntrospection.description,
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: Object.values(typeMap),
    directives,
    assumeValid: options === null || options === void 0 ? void 0 : options.assumeValid
  });
  function getType(typeRef) {
    if (typeRef.kind === TypeKind.LIST) {
      const itemRef = typeRef.ofType;
      if (!itemRef) {
        throw new Error("Decorated type deeper than introspection query.");
      }
      return new GraphQLList(getType(itemRef));
    }
    if (typeRef.kind === TypeKind.NON_NULL) {
      const nullableRef = typeRef.ofType;
      if (!nullableRef) {
        throw new Error("Decorated type deeper than introspection query.");
      }
      const nullableType = getType(nullableRef);
      return new GraphQLNonNull(assertNullableType(nullableType));
    }
    return getNamedType2(typeRef);
  }
  function getNamedType2(typeRef) {
    const typeName = typeRef.name;
    if (!typeName) {
      throw new Error(`Unknown type reference: ${inspect(typeRef)}.`);
    }
    const type = typeMap[typeName];
    if (!type) {
      throw new Error(
        `Invalid or incomplete schema, unknown type: ${typeName}. Ensure that a full introspection query is used in order to build a client schema.`
      );
    }
    return type;
  }
  function getObjectType(typeRef) {
    return assertObjectType(getNamedType2(typeRef));
  }
  function getInterfaceType(typeRef) {
    return assertInterfaceType(getNamedType2(typeRef));
  }
  function buildType(type) {
    if (type != null && type.name != null && type.kind != null) {
      switch (type.kind) {
        case TypeKind.SCALAR:
          return buildScalarDef(type);
        case TypeKind.OBJECT:
          return buildObjectDef(type);
        case TypeKind.INTERFACE:
          return buildInterfaceDef(type);
        case TypeKind.UNION:
          return buildUnionDef(type);
        case TypeKind.ENUM:
          return buildEnumDef(type);
        case TypeKind.INPUT_OBJECT:
          return buildInputObjectDef(type);
      }
    }
    const typeStr = inspect(type);
    throw new Error(
      `Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: ${typeStr}.`
    );
  }
  function buildScalarDef(scalarIntrospection) {
    return new GraphQLScalarType({
      name: scalarIntrospection.name,
      description: scalarIntrospection.description,
      specifiedByURL: scalarIntrospection.specifiedByURL
    });
  }
  function buildImplementationsList(implementingIntrospection) {
    if (implementingIntrospection.interfaces === null && implementingIntrospection.kind === TypeKind.INTERFACE) {
      return [];
    }
    if (!implementingIntrospection.interfaces) {
      const implementingIntrospectionStr = inspect(implementingIntrospection);
      throw new Error(
        `Introspection result missing interfaces: ${implementingIntrospectionStr}.`
      );
    }
    return implementingIntrospection.interfaces.map(getInterfaceType);
  }
  function buildObjectDef(objectIntrospection) {
    return new GraphQLObjectType({
      name: objectIntrospection.name,
      description: objectIntrospection.description,
      interfaces: () => buildImplementationsList(objectIntrospection),
      fields: () => buildFieldDefMap(objectIntrospection)
    });
  }
  function buildInterfaceDef(interfaceIntrospection) {
    return new GraphQLInterfaceType({
      name: interfaceIntrospection.name,
      description: interfaceIntrospection.description,
      interfaces: () => buildImplementationsList(interfaceIntrospection),
      fields: () => buildFieldDefMap(interfaceIntrospection)
    });
  }
  function buildUnionDef(unionIntrospection) {
    if (!unionIntrospection.possibleTypes) {
      const unionIntrospectionStr = inspect(unionIntrospection);
      throw new Error(
        `Introspection result missing possibleTypes: ${unionIntrospectionStr}.`
      );
    }
    return new GraphQLUnionType({
      name: unionIntrospection.name,
      description: unionIntrospection.description,
      types: () => unionIntrospection.possibleTypes.map(getObjectType)
    });
  }
  function buildEnumDef(enumIntrospection) {
    if (!enumIntrospection.enumValues) {
      const enumIntrospectionStr = inspect(enumIntrospection);
      throw new Error(
        `Introspection result missing enumValues: ${enumIntrospectionStr}.`
      );
    }
    return new GraphQLEnumType({
      name: enumIntrospection.name,
      description: enumIntrospection.description,
      values: keyValMap(
        enumIntrospection.enumValues,
        (valueIntrospection) => valueIntrospection.name,
        (valueIntrospection) => ({
          description: valueIntrospection.description,
          deprecationReason: valueIntrospection.deprecationReason
        })
      )
    });
  }
  function buildInputObjectDef(inputObjectIntrospection) {
    if (!inputObjectIntrospection.inputFields) {
      const inputObjectIntrospectionStr = inspect(inputObjectIntrospection);
      throw new Error(
        `Introspection result missing inputFields: ${inputObjectIntrospectionStr}.`
      );
    }
    return new GraphQLInputObjectType({
      name: inputObjectIntrospection.name,
      description: inputObjectIntrospection.description,
      fields: () => buildInputValueDefMap(inputObjectIntrospection.inputFields),
      isOneOf: inputObjectIntrospection.isOneOf
    });
  }
  function buildFieldDefMap(typeIntrospection) {
    if (!typeIntrospection.fields) {
      throw new Error(
        `Introspection result missing fields: ${inspect(typeIntrospection)}.`
      );
    }
    return keyValMap(
      typeIntrospection.fields,
      (fieldIntrospection) => fieldIntrospection.name,
      buildField
    );
  }
  function buildField(fieldIntrospection) {
    const type = getType(fieldIntrospection.type);
    if (!isOutputType(type)) {
      const typeStr = inspect(type);
      throw new Error(
        `Introspection must provide output type for fields, but received: ${typeStr}.`
      );
    }
    if (!fieldIntrospection.args) {
      const fieldIntrospectionStr = inspect(fieldIntrospection);
      throw new Error(
        `Introspection result missing field args: ${fieldIntrospectionStr}.`
      );
    }
    return {
      description: fieldIntrospection.description,
      deprecationReason: fieldIntrospection.deprecationReason,
      type,
      args: buildInputValueDefMap(fieldIntrospection.args)
    };
  }
  function buildInputValueDefMap(inputValueIntrospections) {
    return keyValMap(
      inputValueIntrospections,
      (inputValue) => inputValue.name,
      buildInputValue
    );
  }
  function buildInputValue(inputValueIntrospection) {
    const type = getType(inputValueIntrospection.type);
    if (!isInputType(type)) {
      const typeStr = inspect(type);
      throw new Error(
        `Introspection must provide input type for arguments, but received: ${typeStr}.`
      );
    }
    const defaultValue = inputValueIntrospection.defaultValue != null ? valueFromAST(parseValue(inputValueIntrospection.defaultValue), type) : void 0;
    return {
      description: inputValueIntrospection.description,
      type,
      defaultValue,
      deprecationReason: inputValueIntrospection.deprecationReason
    };
  }
  function buildDirective(directiveIntrospection) {
    if (!directiveIntrospection.args) {
      const directiveIntrospectionStr = inspect(directiveIntrospection);
      throw new Error(
        `Introspection result missing directive args: ${directiveIntrospectionStr}.`
      );
    }
    if (!directiveIntrospection.locations) {
      const directiveIntrospectionStr = inspect(directiveIntrospection);
      throw new Error(
        `Introspection result missing directive locations: ${directiveIntrospectionStr}.`
      );
    }
    return new GraphQLDirective({
      name: directiveIntrospection.name,
      description: directiveIntrospection.description,
      isRepeatable: directiveIntrospection.isRepeatable,
      locations: directiveIntrospection.locations.slice(),
      args: buildInputValueDefMap(directiveIntrospection.args)
    });
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/extendSchema.mjs
function extendSchema(schema, documentAST, options) {
  assertSchema(schema);
  documentAST != null && documentAST.kind === Kind.DOCUMENT || devAssert(false, "Must provide valid Document AST.");
  if ((options === null || options === void 0 ? void 0 : options.assumeValid) !== true && (options === null || options === void 0 ? void 0 : options.assumeValidSDL) !== true) {
    assertValidSDLExtension(documentAST, schema);
  }
  const schemaConfig = schema.toConfig();
  const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
  return schemaConfig === extendedConfig ? schema : new GraphQLSchema(extendedConfig);
}
function extendSchemaImpl(schemaConfig, documentAST, options) {
  var _schemaDef, _schemaDef$descriptio, _schemaDef2, _options$assumeValid;
  const typeDefs = [];
  const typeExtensionsMap = /* @__PURE__ */ Object.create(null);
  const directiveDefs = [];
  let schemaDef;
  const schemaExtensions = [];
  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (def.kind === Kind.SCHEMA_EXTENSION) {
      schemaExtensions.push(def);
    } else if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (isTypeExtensionNode(def)) {
      const extendedTypeName = def.name.value;
      const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
      typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }
  if (Object.keys(typeExtensionsMap).length === 0 && typeDefs.length === 0 && directiveDefs.length === 0 && schemaExtensions.length === 0 && schemaDef == null) {
    return schemaConfig;
  }
  const typeMap = /* @__PURE__ */ Object.create(null);
  for (const existingType of schemaConfig.types) {
    typeMap[existingType.name] = extendNamedType(existingType);
  }
  for (const typeNode of typeDefs) {
    var _stdTypeMap$name;
    const name = typeNode.name.value;
    typeMap[name] = (_stdTypeMap$name = stdTypeMap[name]) !== null && _stdTypeMap$name !== void 0 ? _stdTypeMap$name : buildType(typeNode);
  }
  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription: schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
    // Then, incorporate schema definition and all schema extensions.
    ...schemaDef && getOperationTypes([schemaDef]),
    ...getOperationTypes(schemaExtensions)
  };
  return {
    description: (_schemaDef = schemaDef) === null || _schemaDef === void 0 ? void 0 : (_schemaDef$descriptio = _schemaDef.description) === null || _schemaDef$descriptio === void 0 ? void 0 : _schemaDef$descriptio.value,
    ...operationTypes,
    types: Object.values(typeMap),
    directives: [
      ...schemaConfig.directives.map(replaceDirective),
      ...directiveDefs.map(buildDirective)
    ],
    extensions: /* @__PURE__ */ Object.create(null),
    astNode: (_schemaDef2 = schemaDef) !== null && _schemaDef2 !== void 0 ? _schemaDef2 : schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
    assumeValid: (_options$assumeValid = options === null || options === void 0 ? void 0 : options.assumeValid) !== null && _options$assumeValid !== void 0 ? _options$assumeValid : false
  };
  function replaceType(type) {
    if (isListType(type)) {
      return new GraphQLList(replaceType(type.ofType));
    }
    if (isNonNullType(type)) {
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }
  function replaceNamedType(type) {
    return typeMap[type.name];
  }
  function replaceDirective(directive) {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      args: mapValue(config.args, extendArg)
    });
  }
  function extendNamedType(type) {
    if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
      return type;
    }
    if (isScalarType(type)) {
      return extendScalarType(type);
    }
    if (isObjectType(type)) {
      return extendObjectType(type);
    }
    if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    }
    if (isUnionType(type)) {
      return extendUnionType(type);
    }
    if (isEnumType(type)) {
      return extendEnumType(type);
    }
    if (isInputObjectType(type)) {
      return extendInputObjectType(type);
    }
    invariant(false, "Unexpected type: " + inspect(type));
  }
  function extendInputObjectType(type) {
    var _typeExtensionsMap$co;
    const config = type.toConfig();
    const extensions = (_typeExtensionsMap$co = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co !== void 0 ? _typeExtensionsMap$co : [];
    return new GraphQLInputObjectType({
      ...config,
      fields: () => ({
        ...mapValue(config.fields, (field) => ({
          ...field,
          type: replaceType(field.type)
        })),
        ...buildInputFieldMap(extensions)
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    });
  }
  function extendEnumType(type) {
    var _typeExtensionsMap$ty;
    const config = type.toConfig();
    const extensions = (_typeExtensionsMap$ty = typeExtensionsMap[type.name]) !== null && _typeExtensionsMap$ty !== void 0 ? _typeExtensionsMap$ty : [];
    return new GraphQLEnumType({
      ...config,
      values: { ...config.values, ...buildEnumValueMap(extensions) },
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    });
  }
  function extendScalarType(type) {
    var _typeExtensionsMap$co2;
    const config = type.toConfig();
    const extensions = (_typeExtensionsMap$co2 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co2 !== void 0 ? _typeExtensionsMap$co2 : [];
    let specifiedByURL = config.specifiedByURL;
    for (const extensionNode of extensions) {
      var _getSpecifiedByURL;
      specifiedByURL = (_getSpecifiedByURL = getSpecifiedByURL(extensionNode)) !== null && _getSpecifiedByURL !== void 0 ? _getSpecifiedByURL : specifiedByURL;
    }
    return new GraphQLScalarType({
      ...config,
      specifiedByURL,
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    });
  }
  function extendObjectType(type) {
    var _typeExtensionsMap$co3;
    const config = type.toConfig();
    const extensions = (_typeExtensionsMap$co3 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co3 !== void 0 ? _typeExtensionsMap$co3 : [];
    return new GraphQLObjectType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...buildInterfaces(extensions)
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        ...buildFieldMap(extensions)
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    });
  }
  function extendInterfaceType(type) {
    var _typeExtensionsMap$co4;
    const config = type.toConfig();
    const extensions = (_typeExtensionsMap$co4 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co4 !== void 0 ? _typeExtensionsMap$co4 : [];
    return new GraphQLInterfaceType({
      ...config,
      interfaces: () => [
        ...type.getInterfaces().map(replaceNamedType),
        ...buildInterfaces(extensions)
      ],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        ...buildFieldMap(extensions)
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    });
  }
  function extendUnionType(type) {
    var _typeExtensionsMap$co5;
    const config = type.toConfig();
    const extensions = (_typeExtensionsMap$co5 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co5 !== void 0 ? _typeExtensionsMap$co5 : [];
    return new GraphQLUnionType({
      ...config,
      types: () => [
        ...type.getTypes().map(replaceNamedType),
        ...buildUnionTypes(extensions)
      ],
      extensionASTNodes: config.extensionASTNodes.concat(extensions)
    });
  }
  function extendField(field) {
    return {
      ...field,
      type: replaceType(field.type),
      args: field.args && mapValue(field.args, extendArg)
    };
  }
  function extendArg(arg) {
    return { ...arg, type: replaceType(arg.type) };
  }
  function getOperationTypes(nodes) {
    const opTypes = {};
    for (const node of nodes) {
      var _node$operationTypes;
      const operationTypesNodes = (
        /* c8 ignore next */
        (_node$operationTypes = node.operationTypes) !== null && _node$operationTypes !== void 0 ? _node$operationTypes : []
      );
      for (const operationType of operationTypesNodes) {
        opTypes[operationType.operation] = getNamedType2(operationType.type);
      }
    }
    return opTypes;
  }
  function getNamedType2(node) {
    var _stdTypeMap$name2;
    const name = node.name.value;
    const type = (_stdTypeMap$name2 = stdTypeMap[name]) !== null && _stdTypeMap$name2 !== void 0 ? _stdTypeMap$name2 : typeMap[name];
    if (type === void 0) {
      throw new Error(`Unknown type: "${name}".`);
    }
    return type;
  }
  function getWrappedType(node) {
    if (node.kind === Kind.LIST_TYPE) {
      return new GraphQLList(getWrappedType(node.type));
    }
    if (node.kind === Kind.NON_NULL_TYPE) {
      return new GraphQLNonNull(getWrappedType(node.type));
    }
    return getNamedType2(node);
  }
  function buildDirective(node) {
    var _node$description;
    return new GraphQLDirective({
      name: node.name.value,
      description: (_node$description = node.description) === null || _node$description === void 0 ? void 0 : _node$description.value,
      // @ts-expect-error
      locations: node.locations.map(({ value }) => value),
      isRepeatable: node.repeatable,
      args: buildArgumentMap(node.arguments),
      astNode: node
    });
  }
  function buildFieldMap(nodes) {
    const fieldConfigMap = /* @__PURE__ */ Object.create(null);
    for (const node of nodes) {
      var _node$fields;
      const nodeFields = (
        /* c8 ignore next */
        (_node$fields = node.fields) !== null && _node$fields !== void 0 ? _node$fields : []
      );
      for (const field of nodeFields) {
        var _field$description;
        fieldConfigMap[field.name.value] = {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          type: getWrappedType(field.type),
          description: (_field$description = field.description) === null || _field$description === void 0 ? void 0 : _field$description.value,
          args: buildArgumentMap(field.arguments),
          deprecationReason: getDeprecationReason(field),
          astNode: field
        };
      }
    }
    return fieldConfigMap;
  }
  function buildArgumentMap(args) {
    const argsNodes = (
      /* c8 ignore next */
      args !== null && args !== void 0 ? args : []
    );
    const argConfigMap = /* @__PURE__ */ Object.create(null);
    for (const arg of argsNodes) {
      var _arg$description;
      const type = getWrappedType(arg.type);
      argConfigMap[arg.name.value] = {
        type,
        description: (_arg$description = arg.description) === null || _arg$description === void 0 ? void 0 : _arg$description.value,
        defaultValue: valueFromAST(arg.defaultValue, type),
        deprecationReason: getDeprecationReason(arg),
        astNode: arg
      };
    }
    return argConfigMap;
  }
  function buildInputFieldMap(nodes) {
    const inputFieldMap = /* @__PURE__ */ Object.create(null);
    for (const node of nodes) {
      var _node$fields2;
      const fieldsNodes = (
        /* c8 ignore next */
        (_node$fields2 = node.fields) !== null && _node$fields2 !== void 0 ? _node$fields2 : []
      );
      for (const field of fieldsNodes) {
        var _field$description2;
        const type = getWrappedType(field.type);
        inputFieldMap[field.name.value] = {
          type,
          description: (_field$description2 = field.description) === null || _field$description2 === void 0 ? void 0 : _field$description2.value,
          defaultValue: valueFromAST(field.defaultValue, type),
          deprecationReason: getDeprecationReason(field),
          astNode: field
        };
      }
    }
    return inputFieldMap;
  }
  function buildEnumValueMap(nodes) {
    const enumValueMap = /* @__PURE__ */ Object.create(null);
    for (const node of nodes) {
      var _node$values;
      const valuesNodes = (
        /* c8 ignore next */
        (_node$values = node.values) !== null && _node$values !== void 0 ? _node$values : []
      );
      for (const value of valuesNodes) {
        var _value$description;
        enumValueMap[value.name.value] = {
          description: (_value$description = value.description) === null || _value$description === void 0 ? void 0 : _value$description.value,
          deprecationReason: getDeprecationReason(value),
          astNode: value
        };
      }
    }
    return enumValueMap;
  }
  function buildInterfaces(nodes) {
    return nodes.flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (node) => {
        var _node$interfaces$map, _node$interfaces;
        return (
          /* c8 ignore next */
          (_node$interfaces$map = (_node$interfaces = node.interfaces) === null || _node$interfaces === void 0 ? void 0 : _node$interfaces.map(getNamedType2)) !== null && _node$interfaces$map !== void 0 ? _node$interfaces$map : []
        );
      }
    );
  }
  function buildUnionTypes(nodes) {
    return nodes.flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (node) => {
        var _node$types$map, _node$types;
        return (
          /* c8 ignore next */
          (_node$types$map = (_node$types = node.types) === null || _node$types === void 0 ? void 0 : _node$types.map(getNamedType2)) !== null && _node$types$map !== void 0 ? _node$types$map : []
        );
      }
    );
  }
  function buildType(astNode) {
    var _typeExtensionsMap$na;
    const name = astNode.name.value;
    const extensionASTNodes = (_typeExtensionsMap$na = typeExtensionsMap[name]) !== null && _typeExtensionsMap$na !== void 0 ? _typeExtensionsMap$na : [];
    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION: {
        var _astNode$description;
        const allNodes = [astNode, ...extensionASTNodes];
        return new GraphQLObjectType({
          name,
          description: (_astNode$description = astNode.description) === null || _astNode$description === void 0 ? void 0 : _astNode$description.value,
          interfaces: () => buildInterfaces(allNodes),
          fields: () => buildFieldMap(allNodes),
          astNode,
          extensionASTNodes
        });
      }
      case Kind.INTERFACE_TYPE_DEFINITION: {
        var _astNode$description2;
        const allNodes = [astNode, ...extensionASTNodes];
        return new GraphQLInterfaceType({
          name,
          description: (_astNode$description2 = astNode.description) === null || _astNode$description2 === void 0 ? void 0 : _astNode$description2.value,
          interfaces: () => buildInterfaces(allNodes),
          fields: () => buildFieldMap(allNodes),
          astNode,
          extensionASTNodes
        });
      }
      case Kind.ENUM_TYPE_DEFINITION: {
        var _astNode$description3;
        const allNodes = [astNode, ...extensionASTNodes];
        return new GraphQLEnumType({
          name,
          description: (_astNode$description3 = astNode.description) === null || _astNode$description3 === void 0 ? void 0 : _astNode$description3.value,
          values: buildEnumValueMap(allNodes),
          astNode,
          extensionASTNodes
        });
      }
      case Kind.UNION_TYPE_DEFINITION: {
        var _astNode$description4;
        const allNodes = [astNode, ...extensionASTNodes];
        return new GraphQLUnionType({
          name,
          description: (_astNode$description4 = astNode.description) === null || _astNode$description4 === void 0 ? void 0 : _astNode$description4.value,
          types: () => buildUnionTypes(allNodes),
          astNode,
          extensionASTNodes
        });
      }
      case Kind.SCALAR_TYPE_DEFINITION: {
        var _astNode$description5;
        return new GraphQLScalarType({
          name,
          description: (_astNode$description5 = astNode.description) === null || _astNode$description5 === void 0 ? void 0 : _astNode$description5.value,
          specifiedByURL: getSpecifiedByURL(astNode),
          astNode,
          extensionASTNodes
        });
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
        var _astNode$description6;
        const allNodes = [astNode, ...extensionASTNodes];
        return new GraphQLInputObjectType({
          name,
          description: (_astNode$description6 = astNode.description) === null || _astNode$description6 === void 0 ? void 0 : _astNode$description6.value,
          fields: () => buildInputFieldMap(allNodes),
          astNode,
          extensionASTNodes,
          isOneOf: isOneOf(astNode)
        });
      }
    }
  }
}
var stdTypeMap = keyMap(
  [...specifiedScalarTypes, ...introspectionTypes],
  (type) => type.name
);
function getDeprecationReason(node) {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  return deprecated === null || deprecated === void 0 ? void 0 : deprecated.reason;
}
function getSpecifiedByURL(node) {
  const specifiedBy = getDirectiveValues(GraphQLSpecifiedByDirective, node);
  return specifiedBy === null || specifiedBy === void 0 ? void 0 : specifiedBy.url;
}
function isOneOf(node) {
  return Boolean(getDirectiveValues(GraphQLOneOfDirective, node));
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/buildASTSchema.mjs
function buildASTSchema(documentAST, options) {
  documentAST != null && documentAST.kind === Kind.DOCUMENT || devAssert(false, "Must provide valid Document AST.");
  if ((options === null || options === void 0 ? void 0 : options.assumeValid) !== true && (options === null || options === void 0 ? void 0 : options.assumeValidSDL) !== true) {
    assertValidSDL(documentAST);
  }
  const emptySchemaConfig = {
    description: void 0,
    types: [],
    directives: [],
    extensions: /* @__PURE__ */ Object.create(null),
    extensionASTNodes: [],
    assumeValid: false
  };
  const config = extendSchemaImpl(emptySchemaConfig, documentAST, options);
  if (config.astNode == null) {
    for (const type of config.types) {
      switch (type.name) {
        case "Query":
          config.query = type;
          break;
        case "Mutation":
          config.mutation = type;
          break;
        case "Subscription":
          config.subscription = type;
          break;
      }
    }
  }
  const directives = [
    ...config.directives,
    // If specified directives were not explicitly declared, add them.
    ...specifiedDirectives.filter(
      (stdDirective) => config.directives.every(
        (directive) => directive.name !== stdDirective.name
      )
    )
  ];
  return new GraphQLSchema({ ...config, directives });
}
function buildSchema(source, options) {
  const document = parse(source, {
    noLocation: options === null || options === void 0 ? void 0 : options.noLocation,
    allowLegacyFragmentVariables: options === null || options === void 0 ? void 0 : options.allowLegacyFragmentVariables
  });
  return buildASTSchema(document, {
    assumeValidSDL: options === null || options === void 0 ? void 0 : options.assumeValidSDL,
    assumeValid: options === null || options === void 0 ? void 0 : options.assumeValid
  });
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/lexicographicSortSchema.mjs
function lexicographicSortSchema(schema) {
  const schemaConfig = schema.toConfig();
  const typeMap = keyValMap(
    sortByName(schemaConfig.types),
    (type) => type.name,
    sortNamedType
  );
  return new GraphQLSchema({
    ...schemaConfig,
    types: Object.values(typeMap),
    directives: sortByName(schemaConfig.directives).map(sortDirective),
    query: replaceMaybeType(schemaConfig.query),
    mutation: replaceMaybeType(schemaConfig.mutation),
    subscription: replaceMaybeType(schemaConfig.subscription)
  });
  function replaceType(type) {
    if (isListType(type)) {
      return new GraphQLList(replaceType(type.ofType));
    } else if (isNonNullType(type)) {
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }
  function replaceNamedType(type) {
    return typeMap[type.name];
  }
  function replaceMaybeType(maybeType) {
    return maybeType && replaceNamedType(maybeType);
  }
  function sortDirective(directive) {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      locations: sortBy(config.locations, (x) => x),
      args: sortArgs(config.args)
    });
  }
  function sortArgs(args) {
    return sortObjMap(args, (arg) => ({ ...arg, type: replaceType(arg.type) }));
  }
  function sortFields2(fieldsMap) {
    return sortObjMap(fieldsMap, (field) => ({
      ...field,
      type: replaceType(field.type),
      args: field.args && sortArgs(field.args)
    }));
  }
  function sortInputFields(fieldsMap) {
    return sortObjMap(fieldsMap, (field) => ({
      ...field,
      type: replaceType(field.type)
    }));
  }
  function sortTypes(array) {
    return sortByName(array).map(replaceNamedType);
  }
  function sortNamedType(type) {
    if (isScalarType(type) || isIntrospectionType(type)) {
      return type;
    }
    if (isObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLObjectType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields2(config.fields)
      });
    }
    if (isInterfaceType(type)) {
      const config = type.toConfig();
      return new GraphQLInterfaceType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields2(config.fields)
      });
    }
    if (isUnionType(type)) {
      const config = type.toConfig();
      return new GraphQLUnionType({
        ...config,
        types: () => sortTypes(config.types)
      });
    }
    if (isEnumType(type)) {
      const config = type.toConfig();
      return new GraphQLEnumType({
        ...config,
        values: sortObjMap(config.values, (value) => value)
      });
    }
    if (isInputObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLInputObjectType({
        ...config,
        fields: () => sortInputFields(config.fields)
      });
    }
    invariant(false, "Unexpected type: " + inspect(type));
  }
}
function sortObjMap(map, sortValueFn) {
  const sortedMap = /* @__PURE__ */ Object.create(null);
  for (const key of Object.keys(map).sort(naturalCompare)) {
    sortedMap[key] = sortValueFn(map[key]);
  }
  return sortedMap;
}
function sortByName(array) {
  return sortBy(array, (obj) => obj.name);
}
function sortBy(array, mapToKey) {
  return array.slice().sort((obj1, obj2) => {
    const key1 = mapToKey(obj1);
    const key2 = mapToKey(obj2);
    return naturalCompare(key1, key2);
  });
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/printSchema.mjs
function printSchema(schema) {
  return printFilteredSchema(
    schema,
    (n) => !isSpecifiedDirective(n),
    isDefinedType
  );
}
function printIntrospectionSchema(schema) {
  return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType);
}
function isDefinedType(type) {
  return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}
function printFilteredSchema(schema, directiveFilter, typeFilter) {
  const directives = schema.getDirectives().filter(directiveFilter);
  const types = Object.values(schema.getTypeMap()).filter(typeFilter);
  return [
    printSchemaDefinition(schema),
    ...directives.map((directive) => printDirective(directive)),
    ...types.map((type) => printType(type))
  ].filter(Boolean).join("\n\n");
}
function printSchemaDefinition(schema) {
  if (schema.description == null && isSchemaOfCommonNames(schema)) {
    return;
  }
  const operationTypes = [];
  const queryType = schema.getQueryType();
  if (queryType) {
    operationTypes.push(`  query: ${queryType.name}`);
  }
  const mutationType = schema.getMutationType();
  if (mutationType) {
    operationTypes.push(`  mutation: ${mutationType.name}`);
  }
  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    operationTypes.push(`  subscription: ${subscriptionType.name}`);
  }
  return printDescription(schema) + `schema {
${operationTypes.join("\n")}
}`;
}
function isSchemaOfCommonNames(schema) {
  const queryType = schema.getQueryType();
  if (queryType && queryType.name !== "Query") {
    return false;
  }
  const mutationType = schema.getMutationType();
  if (mutationType && mutationType.name !== "Mutation") {
    return false;
  }
  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && subscriptionType.name !== "Subscription") {
    return false;
  }
  return true;
}
function printType(type) {
  if (isScalarType(type)) {
    return printScalar(type);
  }
  if (isObjectType(type)) {
    return printObject(type);
  }
  if (isInterfaceType(type)) {
    return printInterface(type);
  }
  if (isUnionType(type)) {
    return printUnion(type);
  }
  if (isEnumType(type)) {
    return printEnum(type);
  }
  if (isInputObjectType(type)) {
    return printInputObject(type);
  }
  invariant(false, "Unexpected type: " + inspect(type));
}
function printScalar(type) {
  return printDescription(type) + `scalar ${type.name}` + printSpecifiedByURL(type);
}
function printImplementedInterfaces(type) {
  const interfaces = type.getInterfaces();
  return interfaces.length ? " implements " + interfaces.map((i) => i.name).join(" & ") : "";
}
function printObject(type) {
  return printDescription(type) + `type ${type.name}` + printImplementedInterfaces(type) + printFields(type);
}
function printInterface(type) {
  return printDescription(type) + `interface ${type.name}` + printImplementedInterfaces(type) + printFields(type);
}
function printUnion(type) {
  const types = type.getTypes();
  const possibleTypes = types.length ? " = " + types.join(" | ") : "";
  return printDescription(type) + "union " + type.name + possibleTypes;
}
function printEnum(type) {
  const values = type.getValues().map(
    (value, i) => printDescription(value, "  ", !i) + "  " + value.name + printDeprecated(value.deprecationReason)
  );
  return printDescription(type) + `enum ${type.name}` + printBlock(values);
}
function printInputObject(type) {
  const fields = Object.values(type.getFields()).map(
    (f, i) => printDescription(f, "  ", !i) + "  " + printInputValue(f)
  );
  return printDescription(type) + `input ${type.name}` + (type.isOneOf ? " @oneOf" : "") + printBlock(fields);
}
function printFields(type) {
  const fields = Object.values(type.getFields()).map(
    (f, i) => printDescription(f, "  ", !i) + "  " + f.name + printArgs(f.args, "  ") + ": " + String(f.type) + printDeprecated(f.deprecationReason)
  );
  return printBlock(fields);
}
function printBlock(items) {
  return items.length !== 0 ? " {\n" + items.join("\n") + "\n}" : "";
}
function printArgs(args, indentation = "") {
  if (args.length === 0) {
    return "";
  }
  if (args.every((arg) => !arg.description)) {
    return "(" + args.map(printInputValue).join(", ") + ")";
  }
  return "(\n" + args.map(
    (arg, i) => printDescription(arg, "  " + indentation, !i) + "  " + indentation + printInputValue(arg)
  ).join("\n") + "\n" + indentation + ")";
}
function printInputValue(arg) {
  const defaultAST = astFromValue(arg.defaultValue, arg.type);
  let argDecl = arg.name + ": " + String(arg.type);
  if (defaultAST) {
    argDecl += ` = ${print(defaultAST)}`;
  }
  return argDecl + printDeprecated(arg.deprecationReason);
}
function printDirective(directive) {
  return printDescription(directive) + "directive @" + directive.name + printArgs(directive.args) + (directive.isRepeatable ? " repeatable" : "") + " on " + directive.locations.join(" | ");
}
function printDeprecated(reason) {
  if (reason == null) {
    return "";
  }
  if (reason !== DEFAULT_DEPRECATION_REASON) {
    const astValue = print({
      kind: Kind.STRING,
      value: reason
    });
    return ` @deprecated(reason: ${astValue})`;
  }
  return " @deprecated";
}
function printSpecifiedByURL(scalar) {
  if (scalar.specifiedByURL == null) {
    return "";
  }
  const astValue = print({
    kind: Kind.STRING,
    value: scalar.specifiedByURL
  });
  return ` @specifiedBy(url: ${astValue})`;
}
function printDescription(def, indentation = "", firstInBlock = true) {
  const { description } = def;
  if (description == null) {
    return "";
  }
  const blockString = print({
    kind: Kind.STRING,
    value: description,
    block: isPrintableAsBlockString(description)
  });
  const prefix = indentation && !firstInBlock ? "\n" + indentation : indentation;
  return prefix + blockString.replace(/\n/g, "\n" + indentation) + "\n";
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/concatAST.mjs
function concatAST(documents) {
  const definitions = [];
  for (const doc of documents) {
    definitions.push(...doc.definitions);
  }
  return {
    kind: Kind.DOCUMENT,
    definitions
  };
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/separateOperations.mjs
function separateOperations(documentAST) {
  const operations = [];
  const depGraph = /* @__PURE__ */ Object.create(null);
  for (const definitionNode of documentAST.definitions) {
    switch (definitionNode.kind) {
      case Kind.OPERATION_DEFINITION:
        operations.push(definitionNode);
        break;
      case Kind.FRAGMENT_DEFINITION:
        depGraph[definitionNode.name.value] = collectDependencies(
          definitionNode.selectionSet
        );
        break;
      default:
    }
  }
  const separatedDocumentASTs = /* @__PURE__ */ Object.create(null);
  for (const operation of operations) {
    const dependencies = /* @__PURE__ */ new Set();
    for (const fragmentName of collectDependencies(operation.selectionSet)) {
      collectTransitiveDependencies(dependencies, depGraph, fragmentName);
    }
    const operationName = operation.name ? operation.name.value : "";
    separatedDocumentASTs[operationName] = {
      kind: Kind.DOCUMENT,
      definitions: documentAST.definitions.filter(
        (node) => node === operation || node.kind === Kind.FRAGMENT_DEFINITION && dependencies.has(node.name.value)
      )
    };
  }
  return separatedDocumentASTs;
}
function collectTransitiveDependencies(collected, depGraph, fromName) {
  if (!collected.has(fromName)) {
    collected.add(fromName);
    const immediateDeps = depGraph[fromName];
    if (immediateDeps !== void 0) {
      for (const toName of immediateDeps) {
        collectTransitiveDependencies(collected, depGraph, toName);
      }
    }
  }
}
function collectDependencies(selectionSet) {
  const dependencies = [];
  visit(selectionSet, {
    FragmentSpread(node) {
      dependencies.push(node.name.value);
    }
  });
  return dependencies;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/stripIgnoredCharacters.mjs
function stripIgnoredCharacters(source) {
  const sourceObj = isSource(source) ? source : new Source(source);
  const body = sourceObj.body;
  const lexer = new Lexer(sourceObj);
  let strippedBody = "";
  let wasLastAddedTokenNonPunctuator = false;
  while (lexer.advance().kind !== TokenKind.EOF) {
    const currentToken = lexer.token;
    const tokenKind = currentToken.kind;
    const isNonPunctuator = !isPunctuatorTokenKind(currentToken.kind);
    if (wasLastAddedTokenNonPunctuator) {
      if (isNonPunctuator || currentToken.kind === TokenKind.SPREAD) {
        strippedBody += " ";
      }
    }
    const tokenBody = body.slice(currentToken.start, currentToken.end);
    if (tokenKind === TokenKind.BLOCK_STRING) {
      strippedBody += printBlockString(currentToken.value, {
        minimize: true
      });
    } else {
      strippedBody += tokenBody;
    }
    wasLastAddedTokenNonPunctuator = isNonPunctuator;
  }
  return strippedBody;
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/assertValidName.mjs
function assertValidName(name) {
  const error = isValidNameError(name);
  if (error) {
    throw error;
  }
  return name;
}
function isValidNameError(name) {
  typeof name === "string" || devAssert(false, "Expected name to be a string.");
  if (name.startsWith("__")) {
    return new GraphQLError(
      `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`
    );
  }
  try {
    assertName(name);
  } catch (error) {
    return error;
  }
}

// ../../node_modules/.pnpm/graphql@16.9.0/node_modules/graphql/utilities/findBreakingChanges.mjs
var BreakingChangeType;
(function(BreakingChangeType2) {
  BreakingChangeType2["TYPE_REMOVED"] = "TYPE_REMOVED";
  BreakingChangeType2["TYPE_CHANGED_KIND"] = "TYPE_CHANGED_KIND";
  BreakingChangeType2["TYPE_REMOVED_FROM_UNION"] = "TYPE_REMOVED_FROM_UNION";
  BreakingChangeType2["VALUE_REMOVED_FROM_ENUM"] = "VALUE_REMOVED_FROM_ENUM";
  BreakingChangeType2["REQUIRED_INPUT_FIELD_ADDED"] = "REQUIRED_INPUT_FIELD_ADDED";
  BreakingChangeType2["IMPLEMENTED_INTERFACE_REMOVED"] = "IMPLEMENTED_INTERFACE_REMOVED";
  BreakingChangeType2["FIELD_REMOVED"] = "FIELD_REMOVED";
  BreakingChangeType2["FIELD_CHANGED_KIND"] = "FIELD_CHANGED_KIND";
  BreakingChangeType2["REQUIRED_ARG_ADDED"] = "REQUIRED_ARG_ADDED";
  BreakingChangeType2["ARG_REMOVED"] = "ARG_REMOVED";
  BreakingChangeType2["ARG_CHANGED_KIND"] = "ARG_CHANGED_KIND";
  BreakingChangeType2["DIRECTIVE_REMOVED"] = "DIRECTIVE_REMOVED";
  BreakingChangeType2["DIRECTIVE_ARG_REMOVED"] = "DIRECTIVE_ARG_REMOVED";
  BreakingChangeType2["REQUIRED_DIRECTIVE_ARG_ADDED"] = "REQUIRED_DIRECTIVE_ARG_ADDED";
  BreakingChangeType2["DIRECTIVE_REPEATABLE_REMOVED"] = "DIRECTIVE_REPEATABLE_REMOVED";
  BreakingChangeType2["DIRECTIVE_LOCATION_REMOVED"] = "DIRECTIVE_LOCATION_REMOVED";
})(BreakingChangeType || (BreakingChangeType = {}));
var DangerousChangeType;
(function(DangerousChangeType2) {
  DangerousChangeType2["VALUE_ADDED_TO_ENUM"] = "VALUE_ADDED_TO_ENUM";
  DangerousChangeType2["TYPE_ADDED_TO_UNION"] = "TYPE_ADDED_TO_UNION";
  DangerousChangeType2["OPTIONAL_INPUT_FIELD_ADDED"] = "OPTIONAL_INPUT_FIELD_ADDED";
  DangerousChangeType2["OPTIONAL_ARG_ADDED"] = "OPTIONAL_ARG_ADDED";
  DangerousChangeType2["IMPLEMENTED_INTERFACE_ADDED"] = "IMPLEMENTED_INTERFACE_ADDED";
  DangerousChangeType2["ARG_DEFAULT_VALUE_CHANGE"] = "ARG_DEFAULT_VALUE_CHANGE";
})(DangerousChangeType || (DangerousChangeType = {}));
function findBreakingChanges(oldSchema, newSchema) {
  return findSchemaChanges(oldSchema, newSchema).filter(
    (change) => change.type in BreakingChangeType
  );
}
function findDangerousChanges(oldSchema, newSchema) {
  return findSchemaChanges(oldSchema, newSchema).filter(
    (change) => change.type in DangerousChangeType
  );
}
function findSchemaChanges(oldSchema, newSchema) {
  return [
    ...findTypeChanges(oldSchema, newSchema),
    ...findDirectiveChanges(oldSchema, newSchema)
  ];
}
function findDirectiveChanges(oldSchema, newSchema) {
  const schemaChanges = [];
  const directivesDiff = diff(
    oldSchema.getDirectives(),
    newSchema.getDirectives()
  );
  for (const oldDirective of directivesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.DIRECTIVE_REMOVED,
      description: `${oldDirective.name} was removed.`
    });
  }
  for (const [oldDirective, newDirective] of directivesDiff.persisted) {
    const argsDiff = diff(oldDirective.args, newDirective.args);
    for (const newArg of argsDiff.added) {
      if (isRequiredArgument(newArg)) {
        schemaChanges.push({
          type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
          description: `A required arg ${newArg.name} on directive ${oldDirective.name} was added.`
        });
      }
    }
    for (const oldArg of argsDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: `${oldArg.name} was removed from ${oldDirective.name}.`
      });
    }
    if (oldDirective.isRepeatable && !newDirective.isRepeatable) {
      schemaChanges.push({
        type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
        description: `Repeatable flag was removed from ${oldDirective.name}.`
      });
    }
    for (const location of oldDirective.locations) {
      if (!newDirective.locations.includes(location)) {
        schemaChanges.push({
          type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
          description: `${location} was removed from ${oldDirective.name}.`
        });
      }
    }
  }
  return schemaChanges;
}
function findTypeChanges(oldSchema, newSchema) {
  const schemaChanges = [];
  const typesDiff = diff(
    Object.values(oldSchema.getTypeMap()),
    Object.values(newSchema.getTypeMap())
  );
  for (const oldType of typesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.TYPE_REMOVED,
      description: isSpecifiedScalarType(oldType) ? `Standard scalar ${oldType.name} was removed because it is not referenced anymore.` : `${oldType.name} was removed.`
    });
  }
  for (const [oldType, newType] of typesDiff.persisted) {
    if (isEnumType(oldType) && isEnumType(newType)) {
      schemaChanges.push(...findEnumTypeChanges(oldType, newType));
    } else if (isUnionType(oldType) && isUnionType(newType)) {
      schemaChanges.push(...findUnionTypeChanges(oldType, newType));
    } else if (isInputObjectType(oldType) && isInputObjectType(newType)) {
      schemaChanges.push(...findInputObjectTypeChanges(oldType, newType));
    } else if (isObjectType(oldType) && isObjectType(newType)) {
      schemaChanges.push(
        ...findFieldChanges(oldType, newType),
        ...findImplementedInterfacesChanges(oldType, newType)
      );
    } else if (isInterfaceType(oldType) && isInterfaceType(newType)) {
      schemaChanges.push(
        ...findFieldChanges(oldType, newType),
        ...findImplementedInterfacesChanges(oldType, newType)
      );
    } else if (oldType.constructor !== newType.constructor) {
      schemaChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: `${oldType.name} changed from ${typeKindName(oldType)} to ${typeKindName(newType)}.`
      });
    }
  }
  return schemaChanges;
}
function findInputObjectTypeChanges(oldType, newType) {
  const schemaChanges = [];
  const fieldsDiff = diff(
    Object.values(oldType.getFields()),
    Object.values(newType.getFields())
  );
  for (const newField of fieldsDiff.added) {
    if (isRequiredInputField(newField)) {
      schemaChanges.push({
        type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
        description: `A required field ${newField.name} on input type ${oldType.name} was added.`
      });
    } else {
      schemaChanges.push({
        type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
        description: `An optional field ${newField.name} on input type ${oldType.name} was added.`
      });
    }
  }
  for (const oldField of fieldsDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.FIELD_REMOVED,
      description: `${oldType.name}.${oldField.name} was removed.`
    });
  }
  for (const [oldField, newField] of fieldsDiff.persisted) {
    const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
      oldField.type,
      newField.type
    );
    if (!isSafe) {
      schemaChanges.push({
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: `${oldType.name}.${oldField.name} changed type from ${String(oldField.type)} to ${String(newField.type)}.`
      });
    }
  }
  return schemaChanges;
}
function findUnionTypeChanges(oldType, newType) {
  const schemaChanges = [];
  const possibleTypesDiff = diff(oldType.getTypes(), newType.getTypes());
  for (const newPossibleType of possibleTypesDiff.added) {
    schemaChanges.push({
      type: DangerousChangeType.TYPE_ADDED_TO_UNION,
      description: `${newPossibleType.name} was added to union type ${oldType.name}.`
    });
  }
  for (const oldPossibleType of possibleTypesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
      description: `${oldPossibleType.name} was removed from union type ${oldType.name}.`
    });
  }
  return schemaChanges;
}
function findEnumTypeChanges(oldType, newType) {
  const schemaChanges = [];
  const valuesDiff = diff(oldType.getValues(), newType.getValues());
  for (const newValue of valuesDiff.added) {
    schemaChanges.push({
      type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
      description: `${newValue.name} was added to enum type ${oldType.name}.`
    });
  }
  for (const oldValue of valuesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
      description: `${oldValue.name} was removed from enum type ${oldType.name}.`
    });
  }
  return schemaChanges;
}
function findImplementedInterfacesChanges(oldType, newType) {
  const schemaChanges = [];
  const interfacesDiff = diff(oldType.getInterfaces(), newType.getInterfaces());
  for (const newInterface of interfacesDiff.added) {
    schemaChanges.push({
      type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
      description: `${newInterface.name} added to interfaces implemented by ${oldType.name}.`
    });
  }
  for (const oldInterface of interfacesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
      description: `${oldType.name} no longer implements interface ${oldInterface.name}.`
    });
  }
  return schemaChanges;
}
function findFieldChanges(oldType, newType) {
  const schemaChanges = [];
  const fieldsDiff = diff(
    Object.values(oldType.getFields()),
    Object.values(newType.getFields())
  );
  for (const oldField of fieldsDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.FIELD_REMOVED,
      description: `${oldType.name}.${oldField.name} was removed.`
    });
  }
  for (const [oldField, newField] of fieldsDiff.persisted) {
    schemaChanges.push(...findArgChanges(oldType, oldField, newField));
    const isSafe = isChangeSafeForObjectOrInterfaceField(
      oldField.type,
      newField.type
    );
    if (!isSafe) {
      schemaChanges.push({
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: `${oldType.name}.${oldField.name} changed type from ${String(oldField.type)} to ${String(newField.type)}.`
      });
    }
  }
  return schemaChanges;
}
function findArgChanges(oldType, oldField, newField) {
  const schemaChanges = [];
  const argsDiff = diff(oldField.args, newField.args);
  for (const oldArg of argsDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.ARG_REMOVED,
      description: `${oldType.name}.${oldField.name} arg ${oldArg.name} was removed.`
    });
  }
  for (const [oldArg, newArg] of argsDiff.persisted) {
    const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
      oldArg.type,
      newArg.type
    );
    if (!isSafe) {
      schemaChanges.push({
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description: `${oldType.name}.${oldField.name} arg ${oldArg.name} has changed type from ${String(oldArg.type)} to ${String(newArg.type)}.`
      });
    } else if (oldArg.defaultValue !== void 0) {
      if (newArg.defaultValue === void 0) {
        schemaChanges.push({
          type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
          description: `${oldType.name}.${oldField.name} arg ${oldArg.name} defaultValue was removed.`
        });
      } else {
        const oldValueStr = stringifyValue2(oldArg.defaultValue, oldArg.type);
        const newValueStr = stringifyValue2(newArg.defaultValue, newArg.type);
        if (oldValueStr !== newValueStr) {
          schemaChanges.push({
            type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
            description: `${oldType.name}.${oldField.name} arg ${oldArg.name} has changed defaultValue from ${oldValueStr} to ${newValueStr}.`
          });
        }
      }
    }
  }
  for (const newArg of argsDiff.added) {
    if (isRequiredArgument(newArg)) {
      schemaChanges.push({
        type: BreakingChangeType.REQUIRED_ARG_ADDED,
        description: `A required arg ${newArg.name} on ${oldType.name}.${oldField.name} was added.`
      });
    } else {
      schemaChanges.push({
        type: DangerousChangeType.OPTIONAL_ARG_ADDED,
        description: `An optional arg ${newArg.name} on ${oldType.name}.${oldField.name} was added.`
      });
    }
  }
  return schemaChanges;
}
function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
  if (isListType(oldType)) {
    return (
      // if they're both lists, make sure the underlying types are compatible
      isListType(newType) && isChangeSafeForObjectOrInterfaceField(
        oldType.ofType,
        newType.ofType
      ) || // moving from nullable to non-null of the same underlying type is safe
      isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
    );
  }
  if (isNonNullType(oldType)) {
    return isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType);
  }
  return (
    // if they're both named types, see if their names are equivalent
    isNamedType(newType) && oldType.name === newType.name || // moving from nullable to non-null of the same underlying type is safe
    isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
  );
}
function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
  if (isListType(oldType)) {
    return isListType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType);
  }
  if (isNonNullType(oldType)) {
    return (
      // if they're both non-null, make sure the underlying types are
      // compatible
      isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(
        oldType.ofType,
        newType.ofType
      ) || // moving from non-null to nullable of the same underlying type is safe
      !isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType)
    );
  }
  return isNamedType(newType) && oldType.name === newType.name;
}
function typeKindName(type) {
  if (isScalarType(type)) {
    return "a Scalar type";
  }
  if (isObjectType(type)) {
    return "an Object type";
  }
  if (isInterfaceType(type)) {
    return "an Interface type";
  }
  if (isUnionType(type)) {
    return "a Union type";
  }
  if (isEnumType(type)) {
    return "an Enum type";
  }
  if (isInputObjectType(type)) {
    return "an Input type";
  }
  invariant(false, "Unexpected type: " + inspect(type));
}
function stringifyValue2(value, type) {
  const ast = astFromValue(value, type);
  ast != null || invariant(false);
  return print(sortValueNode(ast));
}
function diff(oldArray, newArray) {
  const added = [];
  const removed = [];
  const persisted = [];
  const oldMap = keyMap(oldArray, ({ name }) => name);
  const newMap = keyMap(newArray, ({ name }) => name);
  for (const oldItem of oldArray) {
    const newItem = newMap[oldItem.name];
    if (newItem === void 0) {
      removed.push(oldItem);
    } else {
      persisted.push([oldItem, newItem]);
    }
  }
  for (const newItem of newArray) {
    if (oldMap[newItem.name] === void 0) {
      added.push(newItem);
    }
  }
  return {
    added,
    persisted,
    removed
  };
}
export {
  BREAK,
  BreakingChangeType,
  DEFAULT_DEPRECATION_REASON,
  DangerousChangeType,
  DirectiveLocation,
  ExecutableDefinitionsRule,
  FieldsOnCorrectTypeRule,
  FragmentsOnCompositeTypesRule,
  GRAPHQL_MAX_INT,
  GRAPHQL_MIN_INT,
  GraphQLBoolean,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLError,
  GraphQLFloat,
  GraphQLID,
  GraphQLIncludeDirective,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOneOfDirective,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLSkipDirective,
  GraphQLSpecifiedByDirective,
  GraphQLString,
  GraphQLUnionType,
  Kind,
  KnownArgumentNamesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
  KnownTypeNamesRule,
  Lexer,
  Location,
  LoneAnonymousOperationRule,
  LoneSchemaDefinitionRule,
  MaxIntrospectionDepthRule,
  NoDeprecatedCustomRule,
  NoFragmentCyclesRule,
  NoSchemaIntrospectionCustomRule,
  NoUndefinedVariablesRule,
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  OperationTypeNode,
  OverlappingFieldsCanBeMergedRule,
  PossibleFragmentSpreadsRule,
  PossibleTypeExtensionsRule,
  ProvidedRequiredArgumentsRule,
  ScalarLeafsRule,
  SchemaMetaFieldDef,
  SingleFieldSubscriptionsRule,
  Source,
  Token,
  TokenKind,
  TypeInfo,
  TypeKind,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  UniqueArgumentDefinitionNamesRule,
  UniqueArgumentNamesRule,
  UniqueDirectiveNamesRule,
  UniqueDirectivesPerLocationRule,
  UniqueEnumValueNamesRule,
  UniqueFieldDefinitionNamesRule,
  UniqueFragmentNamesRule,
  UniqueInputFieldNamesRule,
  UniqueOperationNamesRule,
  UniqueOperationTypesRule,
  UniqueTypeNamesRule,
  UniqueVariableNamesRule,
  ValidationContext,
  ValuesOfCorrectTypeRule,
  VariablesAreInputTypesRule,
  VariablesInAllowedPositionRule,
  __Directive,
  __DirectiveLocation,
  __EnumValue,
  __Field,
  __InputValue,
  __Schema,
  __Type,
  __TypeKind,
  assertAbstractType,
  assertCompositeType,
  assertDirective,
  assertEnumType,
  assertEnumValueName,
  assertInputObjectType,
  assertInputType,
  assertInterfaceType,
  assertLeafType,
  assertListType,
  assertName,
  assertNamedType,
  assertNonNullType,
  assertNullableType,
  assertObjectType,
  assertOutputType,
  assertScalarType,
  assertSchema,
  assertType,
  assertUnionType,
  assertValidName,
  assertValidSchema,
  assertWrappingType,
  astFromValue,
  buildASTSchema,
  buildClientSchema,
  buildSchema,
  coerceInputValue,
  concatAST,
  createSourceEventStream,
  defaultFieldResolver,
  defaultTypeResolver,
  doTypesOverlap,
  execute,
  executeSync,
  extendSchema,
  findBreakingChanges,
  findDangerousChanges,
  formatError,
  getArgumentValues,
  getDirectiveValues,
  getEnterLeaveForKind,
  getIntrospectionQuery,
  getLocation,
  getNamedType,
  getNullableType,
  getOperationAST,
  getOperationRootType,
  getVariableValues,
  getVisitFn,
  graphql,
  graphqlSync,
  introspectionFromSchema,
  introspectionTypes,
  isAbstractType,
  isCompositeType,
  isConstValueNode,
  isDefinitionNode,
  isDirective,
  isEnumType,
  isEqualType,
  isExecutableDefinitionNode,
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isIntrospectionType,
  isLeafType,
  isListType,
  isNamedType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isScalarType,
  isSchema,
  isSelectionNode,
  isSpecifiedDirective,
  isSpecifiedScalarType,
  isType,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  isTypeNode,
  isTypeSubTypeOf,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
  isUnionType,
  isValidNameError,
  isValueNode,
  isWrappingType,
  lexicographicSortSchema,
  locatedError,
  parse,
  parseConstValue,
  parseType,
  parseValue,
  print,
  printError,
  printIntrospectionSchema,
  printLocation,
  printSchema,
  printSourceLocation,
  printType,
  recommendedRules,
  resolveObjMapThunk,
  resolveReadonlyArrayThunk,
  pathToArray as responsePathAsArray,
  separateOperations,
  specifiedDirectives,
  specifiedRules,
  specifiedScalarTypes,
  stripIgnoredCharacters,
  subscribe,
  syntaxError,
  typeFromAST,
  validate,
  validateSchema,
  valueFromAST,
  valueFromASTUntyped,
  version,
  versionInfo,
  visit,
  visitInParallel,
  visitWithTypeInfo
};
//# sourceMappingURL=graphql-6JDEV3ML.mjs.map