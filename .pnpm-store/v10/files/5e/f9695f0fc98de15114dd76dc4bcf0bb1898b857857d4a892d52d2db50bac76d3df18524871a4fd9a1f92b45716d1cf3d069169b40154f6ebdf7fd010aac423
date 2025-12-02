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

// src/server/index.ts
var server_exports = {};
__export(server_exports, {
  A2AError: () => A2AError,
  A2AExpressApp: () => A2AExpressApp,
  DefaultExecutionEventBus: () => DefaultExecutionEventBus,
  DefaultExecutionEventBusManager: () => DefaultExecutionEventBusManager,
  DefaultRequestHandler: () => DefaultRequestHandler,
  ExecutionEventQueue: () => ExecutionEventQueue,
  InMemoryTaskStore: () => InMemoryTaskStore,
  JsonRpcTransportHandler: () => JsonRpcTransportHandler,
  RequestContext: () => RequestContext,
  ResultManager: () => ResultManager
});
module.exports = __toCommonJS(server_exports);

// src/server/agent_execution/request_context.ts
var RequestContext = class {
  userMessage;
  task;
  referenceTasks;
  taskId;
  contextId;
  constructor(userMessage, taskId, contextId, task, referenceTasks) {
    this.userMessage = userMessage;
    this.taskId = taskId;
    this.contextId = contextId;
    this.task = task;
    this.referenceTasks = referenceTasks;
  }
};

// src/server/events/execution_event_bus.ts
var import_events = require("events");
var DefaultExecutionEventBus = class extends import_events.EventEmitter {
  constructor() {
    super();
  }
  publish(event) {
    this.emit("event", event);
  }
  finished() {
    this.emit("finished");
  }
};

// src/server/events/execution_event_bus_manager.ts
var DefaultExecutionEventBusManager = class {
  taskIdToBus = /* @__PURE__ */ new Map();
  /**
   * Creates or retrieves an existing ExecutionEventBus based on the taskId.
   * @param taskId The ID of the task.
   * @returns An instance of IExecutionEventBus.
   */
  createOrGetByTaskId(taskId) {
    if (!this.taskIdToBus.has(taskId)) {
      this.taskIdToBus.set(taskId, new DefaultExecutionEventBus());
    }
    return this.taskIdToBus.get(taskId);
  }
  /**
   * Retrieves an existing ExecutionEventBus based on the taskId.
   * @param taskId The ID of the task.
   * @returns An instance of IExecutionEventBus or undefined if not found.
   */
  getByTaskId(taskId) {
    return this.taskIdToBus.get(taskId);
  }
  /**
   * Removes the event bus for a given taskId.
   * This should be called when an execution flow is complete to free resources.
   * @param taskId The ID of the task.
   */
  cleanupByTaskId(taskId) {
    const bus = this.taskIdToBus.get(taskId);
    if (bus) {
      bus.removeAllListeners();
    }
    this.taskIdToBus.delete(taskId);
  }
};

// src/server/events/execution_event_queue.ts
var ExecutionEventQueue = class {
  eventBus;
  eventQueue = [];
  resolvePromise;
  stopped = false;
  boundHandleEvent;
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.eventBus.on("event", this.handleEvent);
    this.eventBus.on("finished", this.handleFinished);
  }
  handleEvent = (event) => {
    if (this.stopped) return;
    this.eventQueue.push(event);
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = void 0;
    }
  };
  handleFinished = () => {
    this.stop();
  };
  /**
   * Provides an async generator that yields events from the event bus.
   * Stops when a Message event is received or a TaskStatusUpdateEvent with final=true is received.
   */
  async *events() {
    while (!this.stopped || this.eventQueue.length > 0) {
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        yield event;
        if (event.kind === "message" || event.kind === "status-update" && event.final) {
          this.handleFinished();
          break;
        }
      } else if (!this.stopped) {
        await new Promise((resolve) => {
          this.resolvePromise = resolve;
        });
      }
    }
  }
  /**
   * Stops the event queue from processing further events.
   */
  stop() {
    this.stopped = true;
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = void 0;
    }
    this.eventBus.off("event", this.handleEvent);
    this.eventBus.off("finished", this.handleFinished);
  }
};

// src/server/request_handler/default_request_handler.ts
var import_uuid = require("uuid");

// src/server/error.ts
var A2AError = class _A2AError extends Error {
  code;
  data;
  taskId;
  // Optional task ID context
  constructor(code, message, data, taskId) {
    super(message);
    this.name = "A2AError";
    this.code = code;
    this.data = data;
    this.taskId = taskId;
  }
  /**
   * Formats the error into a standard JSON-RPC error object structure.
   */
  toJSONRPCError() {
    const errorObject = {
      code: this.code,
      message: this.message
    };
    if (this.data !== void 0) {
      errorObject.data = this.data;
    }
    return errorObject;
  }
  // Static factory methods for common errors
  static parseError(message, data) {
    return new _A2AError(-32700, message, data);
  }
  static invalidRequest(message, data) {
    return new _A2AError(-32600, message, data);
  }
  static methodNotFound(method) {
    return new _A2AError(
      -32601,
      `Method not found: ${method}`
    );
  }
  static invalidParams(message, data) {
    return new _A2AError(-32602, message, data);
  }
  static internalError(message, data) {
    return new _A2AError(-32603, message, data);
  }
  static taskNotFound(taskId) {
    return new _A2AError(
      -32001,
      `Task not found: ${taskId}`,
      void 0,
      taskId
    );
  }
  static taskNotCancelable(taskId) {
    return new _A2AError(
      -32002,
      `Task not cancelable: ${taskId}`,
      void 0,
      taskId
    );
  }
  static pushNotificationNotSupported() {
    return new _A2AError(
      -32003,
      "Push Notification is not supported"
    );
  }
  static unsupportedOperation(operation) {
    return new _A2AError(
      -32004,
      `Unsupported operation: ${operation}`
    );
  }
};

// src/server/result_manager.ts
var ResultManager = class {
  taskStore;
  currentTask;
  latestUserMessage;
  // To add to history if a new task is created
  finalMessageResult;
  // Stores the message if it's the final result
  constructor(taskStore) {
    this.taskStore = taskStore;
  }
  setContext(latestUserMessage) {
    this.latestUserMessage = latestUserMessage;
  }
  /**
   * Processes an agent execution event and updates the task store.
   * @param event The agent execution event.
   */
  async processEvent(event) {
    if (event.kind === "message") {
      this.finalMessageResult = event;
    } else if (event.kind === "task") {
      const taskEvent = event;
      this.currentTask = { ...taskEvent };
      if (this.latestUserMessage) {
        if (!this.currentTask.history?.find((msg) => msg.messageId === this.latestUserMessage.messageId)) {
          this.currentTask.history = [this.latestUserMessage, ...this.currentTask.history || []];
        }
      }
      await this.saveCurrentTask();
    } else if (event.kind === "status-update") {
      const updateEvent = event;
      if (this.currentTask && this.currentTask.id === updateEvent.taskId) {
        this.currentTask.status = updateEvent.status;
        if (updateEvent.status.message) {
          if (!this.currentTask.history?.find((msg) => msg.messageId === updateEvent.status.message.messageId)) {
            this.currentTask.history = [...this.currentTask.history || [], updateEvent.status.message];
          }
        }
        await this.saveCurrentTask();
      } else if (!this.currentTask && updateEvent.taskId) {
        const loaded = await this.taskStore.load(updateEvent.taskId);
        if (loaded) {
          this.currentTask = loaded;
          this.currentTask.status = updateEvent.status;
          if (updateEvent.status.message) {
            if (!this.currentTask.history?.find((msg) => msg.messageId === updateEvent.status.message.messageId)) {
              this.currentTask.history = [...this.currentTask.history || [], updateEvent.status.message];
            }
          }
          await this.saveCurrentTask();
        } else {
          console.warn(`ResultManager: Received status update for unknown task ${updateEvent.taskId}`);
        }
      }
    } else if (event.kind === "artifact-update") {
      const artifactEvent = event;
      if (this.currentTask && this.currentTask.id === artifactEvent.taskId) {
        if (!this.currentTask.artifacts) {
          this.currentTask.artifacts = [];
        }
        const existingArtifactIndex = this.currentTask.artifacts.findIndex(
          (art) => art.artifactId === artifactEvent.artifact.artifactId
        );
        if (existingArtifactIndex !== -1) {
          if (artifactEvent.append) {
            const existingArtifact = this.currentTask.artifacts[existingArtifactIndex];
            existingArtifact.parts.push(...artifactEvent.artifact.parts);
            if (artifactEvent.artifact.description) existingArtifact.description = artifactEvent.artifact.description;
            if (artifactEvent.artifact.name) existingArtifact.name = artifactEvent.artifact.name;
            if (artifactEvent.artifact.metadata) existingArtifact.metadata = { ...existingArtifact.metadata, ...artifactEvent.artifact.metadata };
          } else {
            this.currentTask.artifacts[existingArtifactIndex] = artifactEvent.artifact;
          }
        } else {
          this.currentTask.artifacts.push(artifactEvent.artifact);
        }
        await this.saveCurrentTask();
      } else if (!this.currentTask && artifactEvent.taskId) {
        const loaded = await this.taskStore.load(artifactEvent.taskId);
        if (loaded) {
          this.currentTask = loaded;
          if (!this.currentTask.artifacts) this.currentTask.artifacts = [];
          const existingArtifactIndex = this.currentTask.artifacts.findIndex(
            (art) => art.artifactId === artifactEvent.artifact.artifactId
          );
          if (existingArtifactIndex !== -1) {
            if (artifactEvent.append) {
              this.currentTask.artifacts[existingArtifactIndex].parts.push(...artifactEvent.artifact.parts);
            } else {
              this.currentTask.artifacts[existingArtifactIndex] = artifactEvent.artifact;
            }
          } else {
            this.currentTask.artifacts.push(artifactEvent.artifact);
          }
          await this.saveCurrentTask();
        } else {
          console.warn(`ResultManager: Received artifact update for unknown task ${artifactEvent.taskId}`);
        }
      }
    }
  }
  async saveCurrentTask() {
    if (this.currentTask) {
      await this.taskStore.save(this.currentTask);
    }
  }
  /**
   * Gets the final result, which could be a Message or a Task.
   * This should be called after the event stream has been fully processed.
   * @returns The final Message or the current Task.
   */
  getFinalResult() {
    if (this.finalMessageResult) {
      return this.finalMessageResult;
    }
    return this.currentTask;
  }
  /**
   * Gets the task currently being managed by this ResultManager instance.
   * This task could be one that was started with or one created during agent execution.
   * @returns The current Task or undefined if no task is active.
   */
  getCurrentTask() {
    return this.currentTask;
  }
};

// src/server/request_handler/default_request_handler.ts
var terminalStates = ["completed", "failed", "canceled", "rejected"];
var DefaultRequestHandler = class {
  agentCard;
  taskStore;
  agentExecutor;
  eventBusManager;
  // Store for push notification configurations (could be part of TaskStore or separate)
  pushNotificationConfigs = /* @__PURE__ */ new Map();
  constructor(agentCard, taskStore, agentExecutor, eventBusManager = new DefaultExecutionEventBusManager()) {
    this.agentCard = agentCard;
    this.taskStore = taskStore;
    this.agentExecutor = agentExecutor;
    this.eventBusManager = eventBusManager;
  }
  async getAgentCard() {
    return this.agentCard;
  }
  async _createRequestContext(incomingMessage, taskId, isStream) {
    let task;
    let referenceTasks;
    if (incomingMessage.taskId) {
      task = await this.taskStore.load(incomingMessage.taskId);
      if (!task) {
        throw A2AError.taskNotFound(incomingMessage.taskId);
      }
      if (terminalStates.includes(task.status.state)) {
        throw A2AError.invalidRequest(`Task ${task.id} is in a terminal state (${task.status.state}) and cannot be modified.`);
      }
    }
    if (incomingMessage.referenceTaskIds && incomingMessage.referenceTaskIds.length > 0) {
      referenceTasks = [];
      for (const refId of incomingMessage.referenceTaskIds) {
        const refTask = await this.taskStore.load(refId);
        if (refTask) {
          referenceTasks.push(refTask);
        } else {
          console.warn(`Reference task ${refId} not found.`);
        }
      }
    }
    const contextId = incomingMessage.contextId || task?.contextId || (0, import_uuid.v4)();
    const messageForContext = {
      ...incomingMessage,
      contextId
    };
    return new RequestContext(
      messageForContext,
      taskId,
      contextId,
      task,
      referenceTasks
    );
  }
  async _processEvents(taskId, resultManager, eventQueue, options) {
    let firstResultSent = false;
    try {
      for await (const event of eventQueue.events()) {
        await resultManager.processEvent(event);
        if (options?.firstResultResolver && !firstResultSent) {
          if (event.kind === "message" || event.kind === "task") {
            options.firstResultResolver(event);
            firstResultSent = true;
          }
        }
      }
      if (options?.firstResultRejector && !firstResultSent) {
        options.firstResultRejector(A2AError.internalError("Execution finished before a message or task was produced."));
      }
    } catch (error) {
      console.error(`Event processing loop failed for task ${taskId}:`, error);
      if (options?.firstResultRejector && !firstResultSent) {
        options.firstResultRejector(error);
      }
      throw error;
    } finally {
      this.eventBusManager.cleanupByTaskId(taskId);
    }
  }
  async sendMessage(params) {
    const incomingMessage = params.message;
    if (!incomingMessage.messageId) {
      throw A2AError.invalidParams("message.messageId is required.");
    }
    const isBlocking = params.configuration?.blocking !== false;
    const taskId = incomingMessage.taskId || (0, import_uuid.v4)();
    const resultManager = new ResultManager(this.taskStore);
    resultManager.setContext(incomingMessage);
    const requestContext = await this._createRequestContext(incomingMessage, taskId, false);
    const finalMessageForAgent = requestContext.userMessage;
    const eventBus = this.eventBusManager.createOrGetByTaskId(taskId);
    const eventQueue = new ExecutionEventQueue(eventBus);
    this.agentExecutor.execute(requestContext, eventBus).catch((err) => {
      console.error(`Agent execution failed for message ${finalMessageForAgent.messageId}:`, err);
      const errorTask = {
        id: requestContext.task?.id || (0, import_uuid.v4)(),
        // Use existing task ID or generate new
        contextId: finalMessageForAgent.contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: (0, import_uuid.v4)(),
            parts: [{ kind: "text", text: `Agent execution error: ${err.message}` }],
            taskId: requestContext.task?.id,
            contextId: finalMessageForAgent.contextId
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        history: requestContext.task?.history ? [...requestContext.task.history] : [],
        kind: "task"
      };
      if (finalMessageForAgent) {
        if (!errorTask.history?.find((m) => m.messageId === finalMessageForAgent.messageId)) {
          errorTask.history?.push(finalMessageForAgent);
        }
      }
      eventBus.publish(errorTask);
      eventBus.publish({
        // And publish a final status update
        kind: "status-update",
        taskId: errorTask.id,
        contextId: errorTask.contextId,
        status: errorTask.status,
        final: true
      });
      eventBus.finished();
    });
    if (isBlocking) {
      await this._processEvents(taskId, resultManager, eventQueue);
      const finalResult = resultManager.getFinalResult();
      if (!finalResult) {
        throw A2AError.internalError("Agent execution finished without a result, and no task context found.");
      }
      return finalResult;
    } else {
      return new Promise((resolve, reject) => {
        this._processEvents(taskId, resultManager, eventQueue, {
          firstResultResolver: resolve,
          firstResultRejector: reject
        });
      });
    }
  }
  async *sendMessageStream(params) {
    const incomingMessage = params.message;
    if (!incomingMessage.messageId) {
      throw A2AError.invalidParams("message.messageId is required for streaming.");
    }
    const taskId = incomingMessage.taskId || (0, import_uuid.v4)();
    const resultManager = new ResultManager(this.taskStore);
    resultManager.setContext(incomingMessage);
    const requestContext = await this._createRequestContext(incomingMessage, taskId, true);
    const finalMessageForAgent = requestContext.userMessage;
    const eventBus = this.eventBusManager.createOrGetByTaskId(taskId);
    const eventQueue = new ExecutionEventQueue(eventBus);
    this.agentExecutor.execute(requestContext, eventBus).catch((err) => {
      console.error(`Agent execution failed for stream message ${finalMessageForAgent.messageId}:`, err);
      const errorTaskStatus = {
        kind: "status-update",
        taskId: requestContext.task?.id || (0, import_uuid.v4)(),
        // Use existing or a placeholder
        contextId: finalMessageForAgent.contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: (0, import_uuid.v4)(),
            parts: [{ kind: "text", text: `Agent execution error: ${err.message}` }],
            taskId: requestContext.task?.id,
            contextId: finalMessageForAgent.contextId
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        final: true
        // This will terminate the stream for the client
      };
      eventBus.publish(errorTaskStatus);
    });
    try {
      for await (const event of eventQueue.events()) {
        await resultManager.processEvent(event);
        yield event;
      }
    } finally {
      this.eventBusManager.cleanupByTaskId(taskId);
    }
  }
  async getTask(params) {
    const task = await this.taskStore.load(params.id);
    if (!task) {
      throw A2AError.taskNotFound(params.id);
    }
    if (params.historyLength !== void 0 && params.historyLength >= 0) {
      if (task.history) {
        task.history = task.history.slice(-params.historyLength);
      }
    } else {
      task.history = [];
    }
    return task;
  }
  async cancelTask(params) {
    const task = await this.taskStore.load(params.id);
    if (!task) {
      throw A2AError.taskNotFound(params.id);
    }
    const nonCancelableStates = ["completed", "failed", "canceled", "rejected"];
    if (nonCancelableStates.includes(task.status.state)) {
      throw A2AError.taskNotCancelable(params.id);
    }
    const eventBus = this.eventBusManager.getByTaskId(params.id);
    if (eventBus) {
      await this.agentExecutor.cancelTask(params.id, eventBus);
    } else {
      task.status = {
        state: "canceled",
        message: {
          // Optional: Add a system message indicating cancellation
          kind: "message",
          role: "agent",
          messageId: (0, import_uuid.v4)(),
          parts: [{ kind: "text", text: "Task cancellation requested by user." }],
          taskId: task.id,
          contextId: task.contextId
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      task.history = [...task.history || [], task.status.message];
      await this.taskStore.save(task);
    }
    const latestTask = await this.taskStore.load(params.id);
    return latestTask;
  }
  async setTaskPushNotificationConfig(params) {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw A2AError.pushNotificationNotSupported();
    }
    const taskAndHistory = await this.taskStore.load(params.taskId);
    if (!taskAndHistory) {
      throw A2AError.taskNotFound(params.taskId);
    }
    this.pushNotificationConfigs.set(params.taskId, params.pushNotificationConfig);
    return params;
  }
  async getTaskPushNotificationConfig(params) {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw A2AError.pushNotificationNotSupported();
    }
    const taskAndHistory = await this.taskStore.load(params.id);
    if (!taskAndHistory) {
      throw A2AError.taskNotFound(params.id);
    }
    const config = this.pushNotificationConfigs.get(params.id);
    if (!config) {
      throw A2AError.internalError(`Push notification config not found for task ${params.id}.`);
    }
    return { taskId: params.id, pushNotificationConfig: config };
  }
  async *resubscribe(params) {
    if (!this.agentCard.capabilities.streaming) {
      throw A2AError.unsupportedOperation("Streaming (and thus resubscription) is not supported.");
    }
    const task = await this.taskStore.load(params.id);
    if (!task) {
      throw A2AError.taskNotFound(params.id);
    }
    yield task;
    const finalStates = ["completed", "failed", "canceled", "rejected"];
    if (finalStates.includes(task.status.state)) {
      return;
    }
    const eventBus = this.eventBusManager.getByTaskId(params.id);
    if (!eventBus) {
      console.warn(`Resubscribe: No active event bus for task ${params.id}.`);
      return;
    }
    const eventQueue = new ExecutionEventQueue(eventBus);
    try {
      for await (const event of eventQueue.events()) {
        if (event.kind === "status-update" && event.taskId === params.id) {
          yield event;
        } else if (event.kind === "artifact-update" && event.taskId === params.id) {
          yield event;
        } else if (event.kind === "task" && event.id === params.id) {
          yield event;
        }
      }
    } finally {
      eventQueue.stop();
    }
  }
};

// src/server/store.ts
var InMemoryTaskStore = class {
  store = /* @__PURE__ */ new Map();
  async load(taskId) {
    const entry = this.store.get(taskId);
    return entry ? { ...entry } : void 0;
  }
  async save(task) {
    this.store.set(task.id, { ...task });
  }
};

// src/server/transports/jsonrpc_transport_handler.ts
var JsonRpcTransportHandler = class {
  requestHandler;
  constructor(requestHandler) {
    this.requestHandler = requestHandler;
  }
  /**
   * Handles an incoming JSON-RPC request.
   * For streaming methods, it returns an AsyncGenerator of JSONRPCResult.
   * For non-streaming methods, it returns a Promise of a single JSONRPCMessage (Result or ErrorResponse).
   */
  async handle(requestBody) {
    let rpcRequest;
    try {
      if (typeof requestBody === "string") {
        rpcRequest = JSON.parse(requestBody);
      } else if (typeof requestBody === "object" && requestBody !== null) {
        rpcRequest = requestBody;
      } else {
        throw A2AError.parseError("Invalid request body type.");
      }
      if (rpcRequest.jsonrpc !== "2.0" || !rpcRequest.method || typeof rpcRequest.method !== "string") {
        throw A2AError.invalidRequest(
          "Invalid JSON-RPC request structure."
        );
      }
    } catch (error) {
      const a2aError = error instanceof A2AError ? error : A2AError.parseError(error.message || "Failed to parse JSON request.");
      return {
        jsonrpc: "2.0",
        id: typeof rpcRequest?.id !== "undefined" ? rpcRequest.id : null,
        error: a2aError.toJSONRPCError()
      };
    }
    const { method, params = {}, id: requestId = null } = rpcRequest;
    try {
      if (method === "message/stream" || method === "tasks/resubscribe") {
        const agentCard = await this.requestHandler.getAgentCard();
        if (!agentCard.capabilities.streaming) {
          throw A2AError.unsupportedOperation(`Method ${method} requires streaming capability.`);
        }
        const agentEventStream = method === "message/stream" ? this.requestHandler.sendMessageStream(params) : this.requestHandler.resubscribe(params);
        return async function* jsonRpcEventStream() {
          try {
            for await (const event of agentEventStream) {
              yield {
                jsonrpc: "2.0",
                id: requestId,
                // Use the original request ID for all streamed responses
                result: event
              };
            }
          } catch (streamError) {
            console.error(`Error in agent event stream for ${method} (request ${requestId}):`, streamError);
            throw streamError;
          }
        }();
      } else {
        let result;
        switch (method) {
          case "message/send":
            result = await this.requestHandler.sendMessage(params);
            break;
          case "tasks/get":
            result = await this.requestHandler.getTask(params);
            break;
          case "tasks/cancel":
            result = await this.requestHandler.cancelTask(params);
            break;
          case "tasks/pushNotificationConfig/set":
            result = await this.requestHandler.setTaskPushNotificationConfig(
              params
            );
            break;
          case "tasks/pushNotificationConfig/get":
            result = await this.requestHandler.getTaskPushNotificationConfig(
              params
            );
            break;
          default:
            throw A2AError.methodNotFound(method);
        }
        return {
          jsonrpc: "2.0",
          id: requestId,
          result
        };
      }
    } catch (error) {
      const a2aError = error instanceof A2AError ? error : A2AError.internalError(error.message || "An unexpected error occurred.");
      return {
        jsonrpc: "2.0",
        id: requestId,
        error: a2aError.toJSONRPCError()
      };
    }
  }
};

// src/server/a2a_express_app.ts
var import_express = __toESM(require("express"), 1);
var A2AExpressApp = class {
  requestHandler;
  // Kept for getAgentCard
  jsonRpcTransportHandler;
  constructor(requestHandler) {
    this.requestHandler = requestHandler;
    this.jsonRpcTransportHandler = new JsonRpcTransportHandler(requestHandler);
  }
  /**
   * Adds A2A routes to an existing Express app.
   * @param app Optional existing Express app.
   * @param baseUrl The base URL for A2A endpoints (e.g., "/a2a/api").
   * @param middlewares Optional array of Express middlewares to apply to the A2A routes.
   * @returns The Express app with A2A routes.
   */
  setupRoutes(app, baseUrl = "", middlewares) {
    const router = import_express.default.Router();
    router.use(import_express.default.json(), ...middlewares ?? []);
    router.get("/.well-known/agent.json", async (req, res) => {
      try {
        const agentCard = await this.requestHandler.getAgentCard();
        res.json(agentCard);
      } catch (error) {
        console.error("Error fetching agent card:", error);
        res.status(500).json({ error: "Failed to retrieve agent card" });
      }
    });
    router.post("/", async (req, res) => {
      try {
        const rpcResponseOrStream = await this.jsonRpcTransportHandler.handle(req.body);
        if (typeof rpcResponseOrStream?.[Symbol.asyncIterator] === "function") {
          const stream = rpcResponseOrStream;
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();
          try {
            for await (const event of stream) {
              res.write(`id: ${(/* @__PURE__ */ new Date()).getTime()}
`);
              res.write(`data: ${JSON.stringify(event)}

`);
            }
          } catch (streamError) {
            console.error(`Error during SSE streaming (request ${req.body?.id}):`, streamError);
            const a2aError = streamError instanceof A2AError ? streamError : A2AError.internalError(streamError.message || "Streaming error.");
            const errorResponse = {
              jsonrpc: "2.0",
              id: req.body?.id || null,
              // Use original request ID if available
              error: a2aError.toJSONRPCError()
            };
            if (!res.headersSent) {
              res.status(500).json(errorResponse);
            } else {
              res.write(`id: ${(/* @__PURE__ */ new Date()).getTime()}
`);
              res.write(`event: error
`);
              res.write(`data: ${JSON.stringify(errorResponse)}

`);
            }
          } finally {
            if (!res.writableEnded) {
              res.end();
            }
          }
        } else {
          const rpcResponse = rpcResponseOrStream;
          res.status(200).json(rpcResponse);
        }
      } catch (error) {
        console.error("Unhandled error in A2AExpressApp POST handler:", error);
        const a2aError = error instanceof A2AError ? error : A2AError.internalError("General processing error.");
        const errorResponse = {
          jsonrpc: "2.0",
          id: req.body?.id || null,
          error: a2aError.toJSONRPCError()
        };
        if (!res.headersSent) {
          res.status(500).json(errorResponse);
        } else if (!res.writableEnded) {
          res.end();
        }
      }
    });
    app.use(baseUrl, router);
    return app;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  A2AError,
  A2AExpressApp,
  DefaultExecutionEventBus,
  DefaultExecutionEventBusManager,
  DefaultRequestHandler,
  ExecutionEventQueue,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  RequestContext,
  ResultManager
});
