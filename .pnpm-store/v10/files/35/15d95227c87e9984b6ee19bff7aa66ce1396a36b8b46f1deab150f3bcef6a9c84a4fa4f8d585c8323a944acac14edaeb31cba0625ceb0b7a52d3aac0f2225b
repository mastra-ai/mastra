// src/event-handler.ts
var RealtimeEventHandler = class {
  eventHandlers = {};
  /**
   * Clears all event handlers.
   */
  clearEventHandlers() {
    this.eventHandlers = {};
  }
  /**
   * Adds a listener for a specific event.
   */
  on(eventName, callback) {
    this.eventHandlers[eventName] = this.eventHandlers[eventName] || [];
    this.eventHandlers[eventName].push(
      callback
    );
  }
  /**
   * Adds a listener for a single occurrence of an event.
   */
  once(eventName, callback) {
    const onceCallback = (event) => {
      this.off(eventName, onceCallback);
      return callback(event);
    };
    this.on(eventName, onceCallback);
  }
  /**
   * Removes a listener for an event.
   * Calling without a callback will remove all listeners for the event.
   */
  off(eventName, callback) {
    const handlers = this.eventHandlers[eventName] || [];
    if (callback) {
      const index = handlers.indexOf(
        callback
      );
      if (index < 0) {
        throw new Error(
          `Could not turn off specified event listener for "${eventName}": not found as a listener`
        );
      }
      handlers.splice(index, 1);
    } else {
      delete this.eventHandlers[eventName];
    }
  }
  /**
   * Waits for next event of a specific type and returns the payload.
   */
  async waitForNext(eventName, { timeoutMs } = {}) {
    return new Promise((resolve, reject) => {
      this.once(eventName, resolve);
      if (timeoutMs !== void 0) {
        setTimeout(
          () => reject(new Error(`Timeout waiting for "${eventName}"`)),
          timeoutMs
        );
      }
    });
  }
  /**
   * Executes all events handlers in the order they were added.
   */
  dispatch(eventName, event) {
    const handlers = this.eventHandlers[eventName] || [];
    for (const handler of handlers) {
      handler(event);
    }
  }
};

// src/utils.ts
import { customAlphabet } from "nanoid";
var isBrowser = !!globalThis.document;
function hasNativeWebSocket() {
  return !!globalThis.WebSocket;
}
function getEnv(name) {
  try {
    return typeof process !== "undefined" ? (
      // eslint-disable-next-line no-process-env
      process.env?.[name]
    ) : void 0;
  } catch {
    return void 0;
  }
}
function assert(value, message) {
  if (value) {
    return;
  }
  if (!message) {
    throw new Error("Assertion failed");
  }
  throw typeof message === "string" ? new Error(message) : message;
}
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
  }
  return buffer;
}
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
function arrayBufferToBase64(arrayBuffer) {
  if (arrayBuffer instanceof Float32Array) {
    arrayBuffer = floatTo16BitPCM(arrayBuffer);
  } else if (arrayBuffer instanceof Int16Array) {
    arrayBuffer = arrayBuffer.buffer;
  }
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
function mergeInt16Arrays(left, right) {
  if (left instanceof ArrayBuffer) {
    left = new Int16Array(left);
  }
  if (right instanceof ArrayBuffer) {
    right = new Int16Array(right);
  }
  if (!(left instanceof Int16Array) || !(right instanceof Int16Array)) {
    throw new TypeError(`Both items must be Int16Array`);
  }
  const newValues = new Int16Array(left.length + right.length);
  for (const [i, element] of left.entries()) {
    newValues[i] = element;
  }
  for (const [j, element] of right.entries()) {
    newValues[left.length + j] = element;
  }
  return newValues;
}
var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var generateIdImpl = customAlphabet(alphabet, 21);
function generateId(prefix, size = 21) {
  const id = generateIdImpl(size);
  return `${prefix}${id}`;
}
var sleep = (t) => new Promise((r) => setTimeout(() => r(), t));
function trimDebugEvent(event, {
  maxLimit = 200
} = {}) {
  if (!event) return event;
  const e = structuredClone(event);
  if (e.item?.content?.find((c) => c.audio)) {
    e.item.content = e.item.content.map(({ audio, c }) => {
      if (audio) {
        return {
          ...c,
          audio: "<base64 redacted...>"
        };
      } else {
        return c;
      }
    });
  }
  if (e.audio) {
    e.audio = "<audio redacted...>";
  }
  if (e.delta?.length > maxLimit) {
    e.delta = e.delta.slice(0, maxLimit) + "... (truncated)";
  }
  return e;
}

// src/api.ts
var RealtimeAPI = class extends RealtimeEventHandler {
  model;
  url;
  apiKey;
  debug;
  ws;
  /**
   * Creates a new RealtimeAPI instance.
   */
  constructor({
    model = "gpt-4o-realtime-preview-2024-10-01",
    url = "wss://api.openai.com/v1/realtime",
    apiKey = getEnv("OPENAI_API_KEY"),
    dangerouslyAllowAPIKeyInBrowser,
    debug
  } = {}) {
    super();
    this.model = model;
    this.url = url;
    this.apiKey = apiKey;
    this.debug = !!debug;
    if (isBrowser && this.apiKey) {
      if (!dangerouslyAllowAPIKeyInBrowser) {
        throw new Error(
          'Unable to provide API key in the browser without "dangerouslyAllowAPIKeyInBrowser" set to true'
        );
      }
    }
  }
  /**
   * Whether or not the WebSocket is connected.
   */
  get isConnected() {
    return !!this.ws;
  }
  /**
   * Connects to Realtime API WebSocket Server.
   */
  async connect() {
    if (this.isConnected) {
      return;
    }
    if (!this.apiKey && !isBrowser) {
      console.warn(`No apiKey provided for connection to "${this.url}"`);
    }
    const url = new URL(this.url);
    url.searchParams.set("model", this.model);
    if (hasNativeWebSocket()) {
      if (isBrowser && this.apiKey) {
        console.warn(
          "Warning: Connecting using API key in the browser, this is not recommended"
        );
      }
      const ws = new WebSocket(
        url.toString(),
        [
          "realtime",
          this.apiKey ? `openai-insecure-api-key.${this.apiKey}` : void 0,
          "openai-beta.realtime-v1"
        ].filter(Boolean)
      );
      ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        this.receive(message.type, message);
      });
      return new Promise((resolve, reject) => {
        const connectionErrorHandler = () => {
          this.disconnect(ws);
          reject(new Error(`Could not connect to "${this.url}"`));
        };
        ws.addEventListener("error", connectionErrorHandler);
        ws.addEventListener("open", () => {
          this._log(`Connected to "${this.url}"`);
          ws.removeEventListener("error", connectionErrorHandler);
          ws.addEventListener("error", () => {
            this.disconnect(ws);
            this._log(`Error, disconnected from "${this.url}"`);
            this.dispatch("close", { type: "close", error: true });
          });
          ws.addEventListener("close", () => {
            this.disconnect(ws);
            this._log(`Disconnected from "${this.url}"`);
            this.dispatch("close", { type: "close", error: false });
          });
          this.ws = ws;
          resolve(true);
        });
      });
    } else {
      const wsModule = await import("ws");
      const ws = new wsModule.WebSocket(url.toString(), [], {
        // Add auth headers
        finishRequest: (request) => {
          request.setHeader("OpenAI-Beta", "realtime=v1");
          if (this.apiKey) {
            request.setHeader("Authorization", `Bearer ${this.apiKey}`);
            request.setHeader("api-key", this.apiKey);
          }
          request.end();
        }
        // TODO: this `any` is a workaround for `@types/ws` being out-of-date.
      });
      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        this.receive(message.type, message);
      });
      return new Promise((resolve, reject) => {
        const connectionErrorHandler = () => {
          this.disconnect(ws);
          reject(new Error(`Could not connect to "${this.url}"`));
        };
        ws.on("error", connectionErrorHandler);
        ws.on("open", () => {
          this._log(`Connected to "${this.url}"`);
          ws.removeListener("error", connectionErrorHandler);
          ws.on("error", () => {
            this._log(`Error, disconnected from "${this.url}"`);
            this.disconnect(ws);
            this.dispatch("close", { type: "close", error: true });
          });
          ws.on("close", () => {
            this.disconnect(ws);
            this._log(`Disconnected from "${this.url}"`);
            this.dispatch("close", { type: "close", error: false });
          });
          this.ws = ws;
          resolve();
        });
      });
    }
  }
  /**
   * Disconnects from the Realtime API server.
   */
  disconnect(ws) {
    if (this.ws && (!ws || this.ws === ws)) {
      this.ws?.close();
      this.ws = void 0;
    }
  }
  /**
   * Receives an event from WebSocket and dispatches related events.
   */
  receive(eventName, event) {
    this._log("received:", eventName, event);
    this.dispatch(eventName, event);
    this.dispatch(`server.${eventName}`, event);
    this.dispatch("server.*", event);
  }
  /**
   * Sends an event to the underlying WebSocket and dispatches related events.
   */
  send(eventName, data = {}) {
    if (!this.isConnected) {
      throw new Error(`RealtimeAPI is not connected`);
    }
    data = data || {};
    if (typeof data !== "object") {
      throw new TypeError(`data must be an object`);
    }
    const event = {
      event_id: generateId("evt_"),
      type: eventName,
      ...data
    };
    this.dispatch(eventName, event);
    this.dispatch(`client.${eventName}`, event);
    this.dispatch("client.*", event);
    this._log("sent:", eventName, event);
    this.ws.send(JSON.stringify(event));
  }
  /**
   * Writes WebSocket logs to the console if `debug` is enabled.
   */
  _log(...args) {
    const date = (/* @__PURE__ */ new Date()).toISOString();
    const logs = [`[Websocket/${date}]`].concat(args).map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        return JSON.stringify(trimDebugEvent(arg), null, 2);
      } else {
        return arg;
      }
    });
    if (this.debug) {
      console.log(...logs);
    }
  }
};

// src/conversation.ts
var RealtimeConversation = class {
  defaultFrequency = 24e3;
  // 24,000 Hz
  frequency;
  debug;
  itemLookup = {};
  items = [];
  responseLookup = {};
  responses = [];
  queuedSpeechItems = {};
  queuedTranscriptItems = {};
  queuedInputAudio;
  constructor({
    frequency = this.defaultFrequency,
    debug = false
  } = {}) {
    if (frequency === void 0) {
      frequency = this.defaultFrequency;
    }
    assert(frequency > 0, `Invalid frequency: ${frequency}`);
    this.frequency = frequency;
    this.debug = debug;
    this.clear();
  }
  /**
   * Clears the conversation history and resets to defaults.
   */
  clear() {
    this.itemLookup = {};
    this.items = [];
    this.responseLookup = {};
    this.responses = [];
    this.queuedSpeechItems = {};
    this.queuedTranscriptItems = {};
    this.queuedInputAudio = void 0;
  }
  /**
   * Queue input audio for manual speech event.
   */
  queueInputAudio(inputAudio) {
    this.queuedInputAudio = inputAudio;
  }
  /**
   * Process an event from the WebSocket server and compose items.
   */
  processEvent(event, ...args) {
    assert(event.event_id, `Missing "event_id" on event`);
    assert(event.type, `Missing "type" on event`);
    const eventProcessor = this.EventProcessors[event.type];
    assert(eventProcessor, `Missing event processor for "${event.type}"`);
    try {
      return eventProcessor.call(this, event, ...args);
    } catch (err) {
      if (this.debug) {
        console.error(
          `Error processing event "${event.type}":`,
          err.message,
          event
        );
      }
      return {};
    }
  }
  /**
   * Retrieves an item by ID.
   */
  getItem(id) {
    return this.itemLookup[id];
  }
  /**
   * Retrieves all items in the conversation.
   */
  getItems() {
    return this.items.slice();
  }
  /** Event handlers. */
  EventProcessors = {
    "conversation.item.created": (event) => {
      const { item } = event;
      const newItem = {
        ...structuredClone(item),
        formatted: {
          audio: new Int16Array(0),
          text: "",
          transcript: ""
        }
      };
      if (!this.itemLookup[newItem.id]) {
        this.itemLookup[newItem.id] = newItem;
        this.items.push(newItem);
      }
      if (this.queuedSpeechItems[newItem.id]?.audio) {
        newItem.formatted.audio = this.queuedSpeechItems[newItem.id].audio;
        delete this.queuedSpeechItems[newItem.id];
      }
      if (newItem.content) {
        const textContent = newItem.content.filter(
          (c) => c.type === "text" || c.type === "input_text"
        );
        for (const content of textContent) {
          newItem.formatted.text += content.text;
        }
      }
      if (this.queuedTranscriptItems[newItem.id]) {
        newItem.formatted.transcript = this.queuedTranscriptItems[newItem.id].transcript;
        delete this.queuedTranscriptItems[newItem.id];
      }
      if (newItem.type === "message") {
        if (newItem.role === "user") {
          newItem.status = "completed";
          if (this.queuedInputAudio) {
            newItem.formatted.audio = this.queuedInputAudio;
            this.queuedInputAudio = void 0;
          }
        } else {
          newItem.status = "in_progress";
        }
      } else if (newItem.type === "function_call") {
        newItem.formatted.tool = {
          type: "function",
          name: newItem.name,
          call_id: newItem.call_id,
          arguments: ""
        };
        newItem.status = "in_progress";
      } else if (newItem.type === "function_call_output") {
        newItem.status = "completed";
        newItem.formatted.output = newItem.output;
      }
      return { item: newItem };
    },
    "conversation.item.truncated": (event) => {
      const { item_id, audio_end_ms } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(`item.truncated: Item "${item_id}" not found`);
      }
      const endIndex = Math.floor(audio_end_ms * this.frequency / 1e3);
      item.formatted.transcript = "";
      item.formatted.audio = item.formatted.audio.slice(0, endIndex);
      return { item };
    },
    "conversation.item.deleted": (event) => {
      const { item_id } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(`item.deleted: Item "${item_id}" not found`);
      }
      delete this.itemLookup[item.id];
      const index = this.items.indexOf(item);
      if (index >= 0) {
        this.items.splice(index, 1);
      }
      return { item };
    },
    "conversation.item.input_audio_transcription.completed": (event) => {
      const { item_id, content_index, transcript } = event;
      const item = this.itemLookup[item_id];
      const formattedTranscript = transcript || " ";
      if (!item) {
        this.queuedTranscriptItems[item_id] = {
          transcript: formattedTranscript
        };
        return {};
      } else {
        if (item.content[content_index]) {
          ;
          item.content[content_index].transcript = transcript;
        }
        item.formatted.transcript = formattedTranscript;
        return { item, delta: { transcript } };
      }
    },
    "input_audio_buffer.speech_started": (event) => {
      const { item_id, audio_start_ms } = event;
      const item = this.itemLookup[item_id];
      this.queuedSpeechItems[item_id] = { audio_start_ms };
      return { item };
    },
    "input_audio_buffer.speech_stopped": (event, inputAudioBuffer) => {
      const { item_id, audio_end_ms } = event;
      const item = this.itemLookup[item_id];
      if (!this.queuedSpeechItems[item_id]) {
        this.queuedSpeechItems[item_id] = { audio_start_ms: audio_end_ms };
      }
      const speech = this.queuedSpeechItems[item_id];
      assert(speech, `Speech item not found for "${item_id}"`);
      speech.audio_end_ms = audio_end_ms;
      if (inputAudioBuffer) {
        const startIndex = Math.floor(
          speech.audio_start_ms * this.frequency / 1e3
        );
        const endIndex = Math.floor(
          speech.audio_end_ms * this.frequency / 1e3
        );
        speech.audio = inputAudioBuffer.slice(startIndex, endIndex);
      }
      return { item };
    },
    "response.created": (event) => {
      const { response } = event;
      if (!this.responseLookup[response.id]) {
        this.responseLookup[response.id] = response;
        this.responses.push(response);
      }
      return { response };
    },
    "response.output_item.added": (event) => {
      const { response_id, item } = event;
      const response = this.responseLookup[response_id];
      if (!response) {
        throw new Error(
          `response.output_item.added: Response "${response_id}" not found`
        );
      }
      response.output.push(item);
      return { item, response };
    },
    "response.output_item.done": (event) => {
      const { item } = event;
      if (!item) {
        throw new Error(`response.output_item.done: Missing "item"`);
      }
      const foundItem = this.itemLookup[item.id];
      if (!foundItem) {
        throw new Error(
          `response.output_item.done: Item "${item.id}" not found`
        );
      }
      foundItem.status = item.status;
      return { item: foundItem };
    },
    "response.content_part.added": (event) => {
      const { item_id, part } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(
          `response.content_part.added: Item "${item_id}" not found`
        );
      }
      item.content.push(part);
      return { item };
    },
    "response.audio_transcript.delta": (event) => {
      const { item_id, content_index, delta } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(
          `response.audio_transcript.delta: Item "${item_id}" not found`
        );
      }
      ;
      item.content[content_index].transcript += delta;
      item.formatted.transcript += delta;
      return { item, delta: { transcript: delta } };
    },
    "response.audio.delta": (event) => {
      const { item_id, content_index: _, delta } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(`response.audio.delta: Item "${item_id}" not found`);
      }
      const arrayBuffer = base64ToArrayBuffer(delta);
      const appendValues = new Int16Array(arrayBuffer);
      item.formatted.audio = mergeInt16Arrays(
        item.formatted.audio,
        appendValues
      );
      return { item, delta: { audio: appendValues } };
    },
    "response.text.delta": (event) => {
      const { item_id, content_index, delta } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(`response.text.delta: Item "${item_id}" not found`);
      }
      ;
      item.content[content_index].text += delta;
      item.formatted.text += delta;
      return { item, delta: { text: delta } };
    },
    "response.function_call_arguments.delta": (event) => {
      const { item_id, delta } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        throw new Error(
          `response.function_call_arguments.delta: Item "${item_id}" not found`
        );
      }
      ;
      item.arguments += delta;
      item.formatted.tool.arguments += delta;
      return { item, delta: { arguments: delta } };
    }
  };
};

// src/client.ts
var RealtimeClient = class extends RealtimeEventHandler {
  defaultSessionConfig;
  sessionConfig;
  relay;
  realtime;
  conversation;
  inputAudioBuffer;
  sessionCreated;
  tools;
  constructor({
    sessionConfig,
    relay = false,
    ...apiParams
  } = {}) {
    super();
    this.defaultSessionConfig = {
      modalities: ["text", "audio"],
      voice: "alloy",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: "whisper-1"
      },
      turn_detection: null,
      // turn_detection: {
      //   type: 'server_vad',
      //   threshold: 0.5,
      //   prefix_padding_ms: 300,
      //   silence_duration_ms: 500
      // },
      tools: [],
      tool_choice: "auto",
      temperature: 0.8,
      max_response_output_tokens: 4096,
      ...sessionConfig
    };
    this.sessionConfig = {};
    this.sessionCreated = false;
    this.tools = {};
    this.inputAudioBuffer = new Int16Array(0);
    this.relay = !!relay;
    this.realtime = new RealtimeAPI(apiParams);
    this.conversation = new RealtimeConversation({ debug: apiParams.debug });
    this._resetConfig();
    this._addAPIEventHandlers();
  }
  /**
   * Resets sessionConfig and conversation to defaults.
   */
  _resetConfig() {
    this.sessionCreated = false;
    this.tools = {};
    this.sessionConfig = structuredClone(this.defaultSessionConfig);
    this.inputAudioBuffer = new Int16Array(0);
  }
  /**
   * Sets up event handlers for a fully-functional application control flow.
   */
  _addAPIEventHandlers() {
    this.realtime.on("client.*", (event) => {
      this.dispatch("realtime.event", {
        type: "realtime.event",
        time: (/* @__PURE__ */ new Date()).toISOString(),
        source: "client",
        event
      });
    });
    this.realtime.on("server.*", (event) => {
      this.dispatch("realtime.event", {
        type: "realtime.event",
        time: (/* @__PURE__ */ new Date()).toISOString(),
        source: "server",
        event
      });
    });
    this.realtime.on("server.session.created", () => {
      this.sessionCreated = true;
    });
    const handler = (event, ...args) => {
      if (!this.isConnected) return {};
      return this.conversation.processEvent(event, ...args);
    };
    const handlerWithDispatch = (event, ...args) => {
      const res = handler(event, ...args);
      if (res.item) {
        this.dispatch("conversation.updated", {
          type: "conversation.updated",
          ...res
        });
      }
      return res;
    };
    const callTool = async (tool) => {
      if (this.isRelay) return;
      try {
        const jsonArguments = JSON.parse(tool.arguments);
        const toolConfig = this.tools[tool.name];
        if (!toolConfig) {
          console.warn(`Tool "${tool.name}" not found`);
          return;
        }
        const result = await Promise.resolve(toolConfig.handler(jsonArguments));
        this.realtime.send("conversation.item.create", {
          item: {
            type: "function_call_output",
            call_id: tool.call_id,
            output: JSON.stringify(result)
          }
        });
      } catch (err) {
        console.warn(`Error calling tool "${tool.name}":`, err.message);
        this.realtime.send("conversation.item.create", {
          item: {
            type: "function_call_output",
            call_id: tool.call_id,
            output: JSON.stringify({ error: err.message })
          }
        });
      }
      this.createResponse();
    };
    this.realtime.on("server.response.created", handler);
    this.realtime.on("server.response.output_item.added", handler);
    this.realtime.on("server.response.content_part.added", handler);
    this.realtime.on(
      "server.input_audio_buffer.speech_started",
      (event) => {
        handler(event);
        this.dispatch("conversation.interrupted", event);
      }
    );
    this.realtime.on(
      "server.input_audio_buffer.speech_stopped",
      (event) => {
        handler(event, this.inputAudioBuffer);
      }
    );
    this.realtime.on(
      "server.conversation.item.created",
      (event) => {
        const res = handlerWithDispatch(event);
        if (!res.item) return;
        this.dispatch("conversation.item.appended", {
          type: "conversation.item.appended",
          ...res
        });
        if (res.item.status === "completed") {
          this.dispatch("conversation.item.completed", {
            type: "conversation.item.completed",
            ...res
          });
        }
      }
    );
    this.realtime.on("server.conversation.item.truncated", handlerWithDispatch);
    this.realtime.on("server.conversation.item.deleted", handlerWithDispatch);
    this.realtime.on(
      "server.conversation.item.input_audio_transcription.completed",
      handlerWithDispatch
    );
    this.realtime.on(
      "server.response.audio_transcript.delta",
      handlerWithDispatch
    );
    this.realtime.on("server.response.audio.delta", handlerWithDispatch);
    this.realtime.on("server.response.text.delta", handlerWithDispatch);
    this.realtime.on(
      "server.response.function_call_arguments.delta",
      handlerWithDispatch
    );
    this.realtime.on(
      "server.response.output_item.done",
      async (event) => {
        const res = handlerWithDispatch(event);
        if (!res.item?.formatted) return;
        if (res.item.status === "completed") {
          this.dispatch("conversation.item.completed", {
            type: "conversation.item.completed",
            ...res
          });
        }
        if (res.item.formatted.tool) {
          callTool(res.item.formatted.tool);
        }
      }
    );
  }
  /**
   * Whether the realtime socket is connected.
   */
  get isConnected() {
    return this.realtime.isConnected;
  }
  /**
   * Whether the client is in relay mode. When in relay mode, the client will
   * not attempt to invoke tools.
   */
  get isRelay() {
    return this.relay;
  }
  /**
   * Resets the client instance entirely: disconnects and clears configs.
   */
  reset() {
    this.disconnect();
    this.clearEventHandlers();
    this.realtime.clearEventHandlers();
    this._resetConfig();
    this._addAPIEventHandlers();
  }
  /**
   * Connects to the Realtime WebSocket API and updates the session config.
   */
  async connect() {
    if (this.isConnected) {
      return;
    }
    await this.realtime.connect();
    this.updateSession();
  }
  /**
   * Waits for a session.created event to be executed before proceeding.
   */
  async waitForSessionCreated() {
    assert(this.isConnected, "Not connected, use .connect() first");
    while (!this.sessionCreated) {
      await sleep(1);
    }
  }
  /**
   * Disconnects from the Realtime API and clears the conversation history.
   */
  disconnect() {
    this.sessionCreated = false;
    this.realtime.disconnect();
    this.conversation.clear();
  }
  /**
   * Gets the active turn detection mode.
   */
  getTurnDetectionType() {
    return this.sessionConfig.turn_detection?.type;
  }
  /**
   * Adds a tool to the session.
   */
  addTool(definition, handler) {
    assert(!this.isRelay, "Unable to add tools in relay mode");
    assert(definition?.name, "Missing tool name in definition");
    const { name } = definition;
    assert(
      typeof handler === "function",
      `Tool "${name}" handler must be a function`
    );
    this.tools[name] = {
      definition: {
        type: "function",
        ...definition
      },
      handler
    };
    this.updateSession();
  }
  /**
   * Removes a tool from the session.
   */
  removeTool(name) {
    assert(!this.isRelay, "Unable to add tools in relay mode");
    assert(
      this.tools[name],
      `Tool "${name}" does not exist, can not be removed.`
    );
    delete this.tools[name];
    this.updateSession();
  }
  /**
   * Deletes an item.
   */
  deleteItem(id) {
    this.realtime.send("conversation.item.delete", { item_id: id });
  }
  /**
   * Updates session configuration.
   *
   * If the client is not yet connected, the session will be updated upon connection.
   */
  updateSession(sessionConfig = {}) {
    const tools = Object.values(this.tools).map(({ definition }) => definition);
    this.sessionConfig = {
      ...this.sessionConfig,
      ...sessionConfig,
      tools
    };
    if (this.isConnected && !this.isRelay) {
      this.realtime.send("session.update", {
        session: structuredClone(this.sessionConfig)
      });
    }
  }
  /**
   * Sends user message content and generates a response.
   */
  sendUserMessageContent(content) {
    assert(!this.isRelay, "Unable to send messages directly in relay mode");
    if (content.length) {
      this.realtime.send("conversation.item.create", {
        item: {
          type: "message",
          role: "user",
          content
        }
      });
    }
    this.createResponse();
  }
  /**
   * Appends user audio to the existing audio buffer.
   */
  appendInputAudio(arrayBuffer) {
    assert(!this.isRelay, "Unable to append input audio directly in relay mode");
    if (arrayBuffer.byteLength > 0) {
      this.realtime.send("input_audio_buffer.append", {
        audio: arrayBufferToBase64(arrayBuffer)
      });
      this.inputAudioBuffer = mergeInt16Arrays(
        this.inputAudioBuffer,
        arrayBuffer
      );
    }
  }
  /**
   * Forces the model to generate a response.
   */
  createResponse() {
    assert(!this.isRelay, "Unable to create a response directly in relay mode");
    if (!this.getTurnDetectionType() && this.inputAudioBuffer.byteLength > 0) {
      this.realtime.send("input_audio_buffer.commit");
      this.conversation.queueInputAudio(this.inputAudioBuffer);
      this.inputAudioBuffer = new Int16Array(0);
    }
    this.realtime.send("response.create");
  }
  /**
   * Cancels the ongoing server generation and truncates ongoing generation, if
   * applicable.
   *
   * If no id provided, will simply call `cancel_generation` command.
   */
  cancelResponse(id, sampleCount = 0) {
    assert(!this.isRelay, "Unable to cancel a response directly in relay mode");
    if (!id) {
      this.realtime.send("response.cancel");
      return;
    }
    const item = this.conversation.getItem(id);
    assert(item, `Could not find item "${id}"`);
    assert(
      item.type === "message",
      `Can only cancelResponse messages with type "message"`
    );
    assert(
      item.role === "assistant",
      `Can only cancelResponse messages with role "assistant"`
    );
    this.realtime.send("response.cancel");
    const audioIndex = item.content.findIndex((c) => c.type === "audio");
    assert(audioIndex >= 0, `Could not find audio on item ${id} to cancel`);
    this.realtime.send("conversation.item.truncate", {
      item_id: id,
      content_index: audioIndex,
      audio_end_ms: Math.floor(
        sampleCount / this.conversation.defaultFrequency * 1e3
      )
    });
    return item;
  }
  /**
   * Utility for waiting for the next `conversation.item.appended` event to be
   * triggered by the server.
   */
  async waitForNextItem() {
    const event = await this.waitForNext("conversation.item.appended");
    return event.item;
  }
  /**
   * Utility for waiting for the next `conversation.item.completed` event to be
   * triggered by the server.
   */
  async waitForNextCompletedItem() {
    const event = await this.waitForNext("conversation.item.completed");
    return event.item;
  }
};
export {
  RealtimeAPI,
  RealtimeClient,
  RealtimeConversation,
  RealtimeEventHandler,
  arrayBufferToBase64,
  assert,
  base64ToArrayBuffer,
  floatTo16BitPCM,
  generateId,
  getEnv,
  hasNativeWebSocket,
  isBrowser,
  mergeInt16Arrays,
  sleep,
  trimDebugEvent
};
//# sourceMappingURL=index.js.map