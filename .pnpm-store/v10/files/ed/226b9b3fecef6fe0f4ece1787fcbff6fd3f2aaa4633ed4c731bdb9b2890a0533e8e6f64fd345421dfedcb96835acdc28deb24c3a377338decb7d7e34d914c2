"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// mcp-stdio/index.ts
var mcp_stdio_exports = {};
__export(mcp_stdio_exports, {
  Experimental_StdioMCPTransport: () => StdioMCPTransport
});
module.exports = __toCommonJS(mcp_stdio_exports);

// core/tool/mcp/json-rpc-message.ts
var import_zod2 = require("zod");

// core/tool/mcp/types.ts
var import_zod = require("zod");
var ClientOrServerImplementationSchema = import_zod.z.object({
  name: import_zod.z.string(),
  version: import_zod.z.string()
}).passthrough();
var BaseParamsSchema = import_zod.z.object({
  _meta: import_zod.z.optional(import_zod.z.object({}).passthrough())
}).passthrough();
var ResultSchema = BaseParamsSchema;
var RequestSchema = import_zod.z.object({
  method: import_zod.z.string(),
  params: import_zod.z.optional(BaseParamsSchema)
});
var ServerCapabilitiesSchema = import_zod.z.object({
  experimental: import_zod.z.optional(import_zod.z.object({}).passthrough()),
  logging: import_zod.z.optional(import_zod.z.object({}).passthrough()),
  prompts: import_zod.z.optional(
    import_zod.z.object({
      listChanged: import_zod.z.optional(import_zod.z.boolean())
    }).passthrough()
  ),
  resources: import_zod.z.optional(
    import_zod.z.object({
      subscribe: import_zod.z.optional(import_zod.z.boolean()),
      listChanged: import_zod.z.optional(import_zod.z.boolean())
    }).passthrough()
  ),
  tools: import_zod.z.optional(
    import_zod.z.object({
      listChanged: import_zod.z.optional(import_zod.z.boolean())
    }).passthrough()
  )
}).passthrough();
var InitializeResultSchema = ResultSchema.extend({
  protocolVersion: import_zod.z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ClientOrServerImplementationSchema,
  instructions: import_zod.z.optional(import_zod.z.string())
});
var PaginatedResultSchema = ResultSchema.extend({
  nextCursor: import_zod.z.optional(import_zod.z.string())
});
var ToolSchema = import_zod.z.object({
  name: import_zod.z.string(),
  description: import_zod.z.optional(import_zod.z.string()),
  inputSchema: import_zod.z.object({
    type: import_zod.z.literal("object"),
    properties: import_zod.z.optional(import_zod.z.object({}).passthrough())
  }).passthrough()
}).passthrough();
var ListToolsResultSchema = PaginatedResultSchema.extend({
  tools: import_zod.z.array(ToolSchema)
});
var TextContentSchema = import_zod.z.object({
  type: import_zod.z.literal("text"),
  text: import_zod.z.string()
}).passthrough();
var ImageContentSchema = import_zod.z.object({
  type: import_zod.z.literal("image"),
  data: import_zod.z.string().base64(),
  mimeType: import_zod.z.string()
}).passthrough();
var ResourceContentsSchema = import_zod.z.object({
  /**
   * The URI of this resource.
   */
  uri: import_zod.z.string(),
  /**
   * The MIME type of this resource, if known.
   */
  mimeType: import_zod.z.optional(import_zod.z.string())
}).passthrough();
var TextResourceContentsSchema = ResourceContentsSchema.extend({
  text: import_zod.z.string()
});
var BlobResourceContentsSchema = ResourceContentsSchema.extend({
  blob: import_zod.z.string().base64()
});
var EmbeddedResourceSchema = import_zod.z.object({
  type: import_zod.z.literal("resource"),
  resource: import_zod.z.union([TextResourceContentsSchema, BlobResourceContentsSchema])
}).passthrough();
var CallToolResultSchema = ResultSchema.extend({
  content: import_zod.z.array(
    import_zod.z.union([TextContentSchema, ImageContentSchema, EmbeddedResourceSchema])
  ),
  isError: import_zod.z.boolean().default(false).optional()
}).or(
  ResultSchema.extend({
    toolResult: import_zod.z.unknown()
  })
);

// core/tool/mcp/json-rpc-message.ts
var JSONRPC_VERSION = "2.0";
var JSONRPCRequestSchema = import_zod2.z.object({
  jsonrpc: import_zod2.z.literal(JSONRPC_VERSION),
  id: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number().int()])
}).merge(RequestSchema).strict();
var JSONRPCResponseSchema = import_zod2.z.object({
  jsonrpc: import_zod2.z.literal(JSONRPC_VERSION),
  id: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number().int()]),
  result: ResultSchema
}).strict();
var JSONRPCErrorSchema = import_zod2.z.object({
  jsonrpc: import_zod2.z.literal(JSONRPC_VERSION),
  id: import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number().int()]),
  error: import_zod2.z.object({
    code: import_zod2.z.number().int(),
    message: import_zod2.z.string(),
    data: import_zod2.z.optional(import_zod2.z.unknown())
  })
}).strict();
var JSONRPCNotificationSchema = import_zod2.z.object({
  jsonrpc: import_zod2.z.literal(JSONRPC_VERSION)
}).merge(
  import_zod2.z.object({
    method: import_zod2.z.string(),
    params: import_zod2.z.optional(BaseParamsSchema)
  })
).strict();
var JSONRPCMessageSchema = import_zod2.z.union([
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
  JSONRPCErrorSchema
]);

// errors/index.ts
var import_provider2 = require("@ai-sdk/provider");

// errors/mcp-client-error.ts
var import_provider = require("@ai-sdk/provider");
var name = "AI_MCPClientError";
var marker = `vercel.ai.error.${name}`;
var symbol = Symbol.for(marker);
var _a;
var MCPClientError = class extends import_provider.AISDKError {
  constructor({
    name: name2 = "MCPClientError",
    message,
    cause
  }) {
    super({ name: name2, message, cause });
    this[_a] = true;
  }
  static isInstance(error) {
    return import_provider.AISDKError.hasMarker(error, marker);
  }
};
_a = symbol;

// mcp-stdio/create-child-process.ts
var import_node_child_process = require("child_process");

// mcp-stdio/get-environment.ts
function getEnvironment(customEnv) {
  const DEFAULT_INHERITED_ENV_VARS = globalThis.process.platform === "win32" ? [
    "APPDATA",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "PATH",
    "PROCESSOR_ARCHITECTURE",
    "SYSTEMDRIVE",
    "SYSTEMROOT",
    "TEMP",
    "USERNAME",
    "USERPROFILE"
  ] : ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"];
  const env = customEnv ? { ...customEnv } : {};
  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = globalThis.process.env[key];
    if (value === void 0) {
      continue;
    }
    if (value.startsWith("()")) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

// mcp-stdio/create-child-process.ts
function createChildProcess(config, signal) {
  var _a2, _b;
  return (0, import_node_child_process.spawn)(config.command, (_a2 = config.args) != null ? _a2 : [], {
    env: getEnvironment(config.env),
    stdio: ["pipe", "pipe", (_b = config.stderr) != null ? _b : "inherit"],
    shell: false,
    signal,
    windowsHide: globalThis.process.platform === "win32" && isElectron(),
    cwd: config.cwd
  });
}
function isElectron() {
  return "type" in globalThis.process;
}

// mcp-stdio/mcp-stdio-transport.ts
var StdioMCPTransport = class {
  constructor(server) {
    this.abortController = new AbortController();
    this.readBuffer = new ReadBuffer();
    this.serverParams = server;
  }
  async start() {
    if (this.process) {
      throw new MCPClientError({
        message: "StdioMCPTransport already started."
      });
    }
    return new Promise((resolve, reject) => {
      var _a2, _b, _c, _d;
      try {
        const process = createChildProcess(
          this.serverParams,
          this.abortController.signal
        );
        this.process = process;
        this.process.on("error", (error) => {
          var _a3, _b2;
          if (error.name === "AbortError") {
            (_a3 = this.onclose) == null ? void 0 : _a3.call(this);
            return;
          }
          reject(error);
          (_b2 = this.onerror) == null ? void 0 : _b2.call(this, error);
        });
        this.process.on("spawn", () => {
          resolve();
        });
        this.process.on("close", (_code) => {
          var _a3;
          this.process = void 0;
          (_a3 = this.onclose) == null ? void 0 : _a3.call(this);
        });
        (_a2 = this.process.stdin) == null ? void 0 : _a2.on("error", (error) => {
          var _a3;
          (_a3 = this.onerror) == null ? void 0 : _a3.call(this, error);
        });
        (_b = this.process.stdout) == null ? void 0 : _b.on("data", (chunk) => {
          this.readBuffer.append(chunk);
          this.processReadBuffer();
        });
        (_c = this.process.stdout) == null ? void 0 : _c.on("error", (error) => {
          var _a3;
          (_a3 = this.onerror) == null ? void 0 : _a3.call(this, error);
        });
      } catch (error) {
        reject(error);
        (_d = this.onerror) == null ? void 0 : _d.call(this, error);
      }
    });
  }
  processReadBuffer() {
    var _a2, _b;
    while (true) {
      try {
        const message = this.readBuffer.readMessage();
        if (message === null) {
          break;
        }
        (_a2 = this.onmessage) == null ? void 0 : _a2.call(this, message);
      } catch (error) {
        (_b = this.onerror) == null ? void 0 : _b.call(this, error);
      }
    }
  }
  async close() {
    this.abortController.abort();
    this.process = void 0;
    this.readBuffer.clear();
  }
  send(message) {
    return new Promise((resolve) => {
      var _a2;
      if (!((_a2 = this.process) == null ? void 0 : _a2.stdin)) {
        throw new MCPClientError({
          message: "StdioClientTransport not connected"
        });
      }
      const json = serializeMessage(message);
      if (this.process.stdin.write(json)) {
        resolve();
      } else {
        this.process.stdin.once("drain", resolve);
      }
    });
  }
};
var ReadBuffer = class {
  append(chunk) {
    this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
  }
  readMessage() {
    if (!this.buffer)
      return null;
    const index = this.buffer.indexOf("\n");
    if (index === -1) {
      return null;
    }
    const line = this.buffer.toString("utf8", 0, index);
    this.buffer = this.buffer.subarray(index + 1);
    return deserializeMessage(line);
  }
  clear() {
    this.buffer = void 0;
  }
};
function serializeMessage(message) {
  return JSON.stringify(message) + "\n";
}
function deserializeMessage(line) {
  return JSONRPCMessageSchema.parse(JSON.parse(line));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Experimental_StdioMCPTransport
});
//# sourceMappingURL=index.js.map