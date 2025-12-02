// src/parser.ts
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { Exception } from "@poppinss/exception";
import { parse } from "error-stack-parser-es";

// src/debug.ts
import { debuglog } from "util";
var debug_default = debuglog("youch:core");

// src/source_file.ts
var SourceFile = class {
  #contents;
  constructor(options) {
    if ("contents" in options) {
      this.#contents = options.contents;
    }
  }
  /**
   * Slice the file contents for the buffer size around a given
   * line number.
   *
   * @example
   * ```ts
   * const chunks = sourceFile.slice(11, 7)
   * // Here chunks will be an array of 7 items from line number
   * // 8 to 14
   * ```
   */
  slice(lineNumber, bufferSize) {
    if (!this.#contents) {
      return void 0;
    }
    const lines = this.#contents.split(/\n|\r\n/);
    const contentSize = lines.length;
    const chunkSize = Math.ceil((bufferSize - 1) / 2);
    let startIndex = chunkSize >= lineNumber ? 0 : lineNumber - chunkSize - 1;
    if (contentSize - lineNumber < chunkSize) {
      startIndex = Math.max(startIndex - (chunkSize - (contentSize - lineNumber)), 0);
    }
    const sourceIndex = lineNumber - 1;
    const startRemainder = startIndex - sourceIndex + chunkSize;
    const endIndex = startRemainder + chunkSize + lineNumber;
    debug_default("slicing file contents", {
      startIndex,
      endIndex,
      sourceIndex,
      contentSize,
      bufferSize,
      chunkSize
    });
    return lines.slice(startIndex, endIndex).map((chunk, index) => {
      return {
        chunk,
        lineNumber: startIndex + index + 1
      };
    });
  }
};

// src/parser.ts
var ErrorParser = class _ErrorParser {
  /**
   * FS source loader reads the file contents from the filesystem
   * for all non-native frames
   */
  static fsSourceLoader = async (frame) => {
    if (!frame.fileName || frame.fileType !== "fs" || frame.type === "native") {
      return void 0;
    }
    debug_default("reading contents for source file %s", frame.fileName);
    try {
      return {
        contents: await readFile(frame.fileName, "utf-8")
      };
    } catch (error) {
      debug_default(`Unable to read source file %s, error %s`, frame.fileName, error.message);
    }
  };
  /**
   * Native frames filename identifiers for Node.js and
   * Deno
   */
  #nativeFramesIdentifiers = ["node:", "ext:"];
  /**
   * Native frames filename identifier for Bun. In case of
   * bun, the filename exactly matches the keyword "native"
   */
  #bunNativeIdentifier = "native";
  /**
   * Cache of preloaded source files along with their absolute
   * path
   */
  #sourceFiles = /* @__PURE__ */ new Map();
  /**
   * The offset can be used to skip initial frames from the
   * error stack
   */
  #offset;
  /**
   * Custom source loader to consult for reading the sourcefile
   * contents
   */
  #sourceLoader = _ErrorParser.fsSourceLoader;
  /**
   * Parsers are used to prepare the source value for parsing
   */
  #parsers = [];
  /**
   * Transformers are used to post process the parsed error and
   * attach additional information to it.
   */
  #transformers = [];
  constructor(options) {
    options = options ?? {};
    this.#offset = options.offset;
  }
  /**
   * Normalizes the unknown error to be an Error
   */
  #normalizeError(source) {
    if (source instanceof Error) {
      return source;
    }
    if (typeof source === "object" && source && "message" in source && "stack" in source) {
      return source;
    }
    const error = new Exception(JSON.stringify(source));
    error.help = 'To get as much information as possible from your errors, make sure to throw Error objects. See <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error">https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error</a> for more information.';
    return error;
  }
  /**
   * Returns the source chunks for a given file and the
   * line number.
   */
  async #getSource(frame) {
    let sourceFile = this.#sourceFiles.get(frame.fileName);
    if (sourceFile) {
      debug_default("reading sourcefile from cache %s", frame.fileName);
      return sourceFile.slice(frame.lineNumber ?? 1, 11);
    }
    const contents = await this.#sourceLoader(frame);
    if (contents) {
      sourceFile = new SourceFile(contents);
      debug_default("caching sourcefile instance for %s", frame.fileName);
      this.#sourceFiles.set(frame.fileName, sourceFile);
      return sourceFile.slice(frame.lineNumber ?? 1, 11);
    }
  }
  /**
   * Syntax errors in JavaScript does not contain the source file
   * location within the stack trace, since the error has
   * happened in the language parser.
   *
   * However, Node.js includes the absolute path to the file within
   * the stack trace contents as the first line. So we parse
   * that out in this function.
   */
  #parseSyntaxError(error) {
    const [sourceIdentifier] = error.stack?.split("\n") || [];
    const tokens = sourceIdentifier.split(":");
    const lineNumber = Number(tokens.pop());
    const fileName = tokens.join(":");
    if (fileName && !Number.isNaN(lineNumber)) {
      return [
        {
          fileName,
          lineNumber,
          source: sourceIdentifier
        }
      ];
    }
    return [];
  }
  /**
   * Applies the offset on the frames to skip certain frames
   * from the start
   */
  #applyOffset(frames) {
    if (this.#offset) {
      return frames.slice(this.#offset);
    }
    return frames;
  }
  /**
   * Replaces windows slash to unix slash
   */
  #toUnixSlash(fileName) {
    const isExtendedLengthPath = fileName.startsWith("\\\\?\\");
    return isExtendedLengthPath ? fileName : fileName.replace(/\\/g, "/");
  }
  /**
   * Normalizes the filename to be a path with unix slash. The
   * URL style paths are also converted to normalized file
   * paths
   */
  #normalizeFileName(fileName) {
    if (fileName.startsWith("file:")) {
      return this.#toUnixSlash(fileURLToPath(fileName));
    }
    return this.#toUnixSlash(fileName);
  }
  /**
   * Returns the type of the frame.
   */
  #getFrameType(fileName) {
    return this.#nativeFramesIdentifiers.some((identifier) => fileName.includes(identifier)) || fileName === this.#bunNativeIdentifier ? "native" : fileName.includes("node_modules/") ? "module" : "app";
  }
  /**
   * Returns the source type of the frame.
   */
  #getFrameSourceType(fileName) {
    return fileName.startsWith("http://") ? "http" : fileName.startsWith("https://") ? "https" : "fs";
  }
  /**
   * Enhances a frame to contain additional information
   */
  async #enhanceFrames(frames) {
    let stackFrames = [];
    for (const { source: raw, ...frame } of frames) {
      const stackFrame = {
        ...frame,
        raw
      };
      if (!stackFrame.fileName) {
        stackFrames.push(stackFrame);
        continue;
      }
      stackFrame.fileName = this.#normalizeFileName(stackFrame.fileName);
      stackFrame.type = this.#getFrameType(stackFrame.fileName);
      stackFrame.fileType = this.#getFrameSourceType(stackFrame.fileName);
      stackFrame.source = await this.#getSource(stackFrame);
      debug_default("stack frame %O", stackFrame);
      stackFrames.push(stackFrame);
    }
    return stackFrames;
  }
  /**
   * Register a parser. Parsers are synchronous functions
   * that can be used to pre-process the source value
   * before it get parsed.
   *
   * @example
   * ```ts
   * sourceFile.useParser((source) => {
   *   if (valueCanBeParsed) {
   *     return newValue
   *   }
   *   return source
   * })
   * ```
   */
  useParser(parser) {
    this.#parsers.push(parser);
    return this;
  }
  /**
   * Register a transformer. Transformers can be async functions
   * to post-process the parsed error value.
   *
   * @example
   * ```ts
   * sourceFile.useTransformer((error, source) => {
   *   // mutate "error" properties
   * })
   * ```
   */
  useTransformer(transformer) {
    this.#transformers.push(transformer);
    return this;
  }
  /**
   * Define a custom source loader to load the contents of the
   * source file within the error stack.
   *
   * For example: You might want to register a custom source loader
   * that makes an fetch call to the server to read the source of
   * the file within the error stack.
   */
  defineSourceLoader(loader) {
    this.#sourceLoader = loader;
    return this;
  }
  /**
   * Parse an unknown value into a parsed error object.
   */
  async parse(source) {
    debug_default("parsing source %O", source);
    source = this.#parsers.reduce((result, parser) => {
      result = parser(result);
      return result;
    }, source);
    let error = this.#normalizeError(source);
    debug_default("error normalized to %O", error);
    let esFrames = error instanceof SyntaxError ? this.#parseSyntaxError(error) : [];
    esFrames = esFrames.concat(parse(error, { allowEmpty: true }));
    esFrames = this.#applyOffset(esFrames);
    const parsedError = {
      message: error.message,
      name: error.name,
      frames: await this.#enhanceFrames(esFrames),
      hint: "hint" in error && error.hint ? String(error.hint) : "help" in error && error.help ? String(error.help) : void 0,
      code: "code" in error ? String(error.code) : void 0,
      cause: error.cause,
      stack: error.stack,
      raw: error
    };
    for (const transformer of this.#transformers) {
      await transformer(parsedError, error);
    }
    return parsedError;
  }
};
export {
  ErrorParser
};
