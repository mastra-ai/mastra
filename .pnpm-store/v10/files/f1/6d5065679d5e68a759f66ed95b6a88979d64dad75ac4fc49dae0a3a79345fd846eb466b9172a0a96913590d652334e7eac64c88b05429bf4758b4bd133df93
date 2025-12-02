"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var mdb_exports = {};
__export(mdb_exports, {
  MDBBackend: () => MDBBackend,
  runMainBackend: () => runMainBackend,
  runOnPauseBackendLoop: () => runOnPauseBackendLoop
});
module.exports = __toCommonJS(mdb_exports);
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
var import_utils = require("playwright-core/lib/utils");
var import_tool = require("./tool");
var mcpBundle = __toESM(require("./bundle"));
var mcpServer = __toESM(require("./server"));
var mcpHttp = __toESM(require("./http"));
const mdbDebug = (0, import_utilsBundle.debug)("pw:mcp:mdb");
const errorsDebug = (0, import_utilsBundle.debug)("pw:mcp:errors");
const z = mcpBundle.z;
class MDBBackend {
  constructor(mainBackend) {
    this._progress = [];
    this._mainBackend = mainBackend;
    this._progressCallback = (params) => {
      if (params.message)
        this._progress.push({ type: "text", text: params.message });
    };
  }
  async initialize(server, clientInfo) {
    if (!this._clientInfo) {
      this._clientInfo = clientInfo;
      await this._mainBackend.initialize?.(server, clientInfo);
    }
  }
  async listTools() {
    return await this._mainBackend.listTools();
  }
  async callTool(name, args) {
    if (name === pushToolsSchema.name) {
      await this._createOnPauseClient(pushToolsSchema.inputSchema.parse(args || {}));
      return { content: [{ type: "text", text: "Tools pushed" }] };
    }
    if (this._onPauseClient?.tools.find((tool) => tool.name === name)) {
      const result2 = await this._onPauseClient.client.callTool({
        name,
        arguments: args
      });
      await this._mainBackend.afterCallTool?.(name, args, result2);
      return result2;
    }
    await this._onPauseClient?.transport.terminateSession().catch(errorsDebug);
    await this._onPauseClient?.client.close().catch(errorsDebug);
    this._onPauseClient = void 0;
    const resultPromise = new import_utils.ManualPromise();
    const interruptPromise = new import_utils.ManualPromise();
    this._interruptPromise = interruptPromise;
    this._mainBackend.callTool(name, args, this._progressCallback).then((result2) => {
      resultPromise.resolve(result2);
    }).catch((e) => {
      resultPromise.resolve({ content: [{ type: "text", text: String(e) }], isError: true });
    });
    const result = await Promise.race([interruptPromise, resultPromise]);
    if (interruptPromise.isDone())
      mdbDebug("client call intercepted", result);
    else
      mdbDebug("client call result", result);
    result.content.unshift(...this._progress);
    this._progress.length = 0;
    return result;
  }
  async _createOnPauseClient(params) {
    if (this._onPauseClient)
      await this._onPauseClient.client.close().catch(errorsDebug);
    this._onPauseClient = await this._createClient(params.mcpUrl);
    this._interruptPromise?.resolve({
      content: [{
        type: "text",
        text: params.introMessage || ""
      }]
    });
    this._interruptPromise = void 0;
  }
  async _createClient(url) {
    const client = new mcpBundle.Client({ name: "Interrupting client", version: "0.0.0" }, { capabilities: { roots: {} } });
    client.setRequestHandler(mcpBundle.ListRootsRequestSchema, () => ({ roots: this._clientInfo?.roots || [] }));
    client.setRequestHandler(mcpBundle.PingRequestSchema, () => ({}));
    client.setNotificationHandler(mcpBundle.ProgressNotificationSchema, (notification) => {
      if (notification.method === "notifications/progress") {
        const { message } = notification.params;
        if (message)
          this._progress.push({ type: "text", text: message });
      }
    });
    const transport = new mcpBundle.StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);
    const { tools } = await client.listTools();
    return { client, tools, transport };
  }
}
const pushToolsSchema = (0, import_tool.defineToolSchema)({
  name: "mdb_push_tools",
  title: "Push MCP tools to the tools stack",
  description: "Push MCP tools to the tools stack",
  inputSchema: z.object({
    mcpUrl: z.string(),
    introMessage: z.string().optional()
  }),
  type: "readOnly"
});
async function runMainBackend(backendFactory, options) {
  const mdbBackend = new MDBBackend(backendFactory.create());
  const factory = {
    ...backendFactory,
    create: () => mdbBackend
  };
  const url = await startAsHttp(factory, { port: options?.port || 0 });
  process.env.PLAYWRIGHT_DEBUGGER_MCP = url;
  if (options?.port !== void 0)
    return url;
  await mcpServer.connect(factory, new mcpBundle.StdioServerTransport(), false);
}
async function runOnPauseBackendLoop(backend, introMessage) {
  const wrappedBackend = new ServerBackendWithCloseListener(backend);
  const factory = {
    name: "on-pause-backend",
    nameInConfig: "on-pause-backend",
    version: "0.0.0",
    create: () => wrappedBackend
  };
  const httpServer = await mcpHttp.startHttpServer({ port: 0 });
  await mcpHttp.installHttpTransport(httpServer, factory);
  const url = mcpHttp.httpAddressToString(httpServer.address());
  const client = new mcpBundle.Client({ name: "Pushing client", version: "0.0.0" });
  client.setRequestHandler(mcpBundle.PingRequestSchema, () => ({}));
  const transport = new mcpBundle.StreamableHTTPClientTransport(new URL(process.env.PLAYWRIGHT_DEBUGGER_MCP));
  await client.connect(transport);
  const pushToolsResult = await client.callTool({
    name: pushToolsSchema.name,
    arguments: {
      mcpUrl: url,
      introMessage
    }
  });
  if (pushToolsResult.isError)
    errorsDebug("Failed to push tools", pushToolsResult.content);
  await transport.terminateSession();
  await client.close();
  await wrappedBackend.waitForClosed();
  httpServer.close();
}
async function startAsHttp(backendFactory, options) {
  const httpServer = await mcpHttp.startHttpServer(options);
  await mcpHttp.installHttpTransport(httpServer, backendFactory);
  return mcpHttp.httpAddressToString(httpServer.address());
}
class ServerBackendWithCloseListener {
  constructor(backend) {
    this._serverClosedPromise = new import_utils.ManualPromise();
    this._backend = backend;
  }
  async initialize(server, clientInfo) {
    await this._backend.initialize?.(server, clientInfo);
  }
  async listTools() {
    return this._backend.listTools();
  }
  async callTool(name, args, progress) {
    return this._backend.callTool(name, args, progress);
  }
  serverClosed(server) {
    this._backend.serverClosed?.(server);
    this._serverClosedPromise.resolve();
  }
  async waitForClosed() {
    await this._serverClosedPromise;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MDBBackend,
  runMainBackend,
  runOnPauseBackendLoop
});
