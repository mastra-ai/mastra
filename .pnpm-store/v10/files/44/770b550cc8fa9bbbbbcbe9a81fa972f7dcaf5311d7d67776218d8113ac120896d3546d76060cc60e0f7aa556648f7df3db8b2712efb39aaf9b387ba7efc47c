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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  experimental_useObject: () => experimental_useObject,
  useAssistant: () => useAssistant,
  useChat: () => useChat,
  useCompletion: () => useCompletion
});
module.exports = __toCommonJS(src_exports);

// src/use-assistant.ts
var import_provider_utils = require("@ai-sdk/provider-utils");
var import_ui_utils = require("@ai-sdk/ui-utils");
var import_react = require("react");
var getOriginalFetch = () => fetch;
function useAssistant({
  api,
  threadId: threadIdParam,
  credentials,
  headers,
  body,
  onError,
  fetch: fetch2
}) {
  const [messages, setMessages] = (0, import_react.useState)([]);
  const [input, setInput] = (0, import_react.useState)("");
  const [currentThreadId, setCurrentThreadId] = (0, import_react.useState)(
    void 0
  );
  const [status, setStatus] = (0, import_react.useState)("awaiting_message");
  const [error, setError] = (0, import_react.useState)(void 0);
  const handleInputChange = (event) => {
    setInput(event.target.value);
  };
  const abortControllerRef = (0, import_react.useRef)(null);
  const stop = (0, import_react.useCallback)(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  const append = async (message, requestOptions) => {
    var _a, _b;
    setStatus("in_progress");
    setMessages((messages2) => {
      var _a2;
      return [
        ...messages2,
        {
          ...message,
          id: (_a2 = message.id) != null ? _a2 : (0, import_ui_utils.generateId)()
        }
      ];
    });
    setInput("");
    const abortController = new AbortController();
    try {
      abortControllerRef.current = abortController;
      const actualFetch = fetch2 != null ? fetch2 : getOriginalFetch();
      const response = await actualFetch(api, {
        method: "POST",
        credentials,
        signal: abortController.signal,
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          ...body,
          // always use user-provided threadId when available:
          threadId: (_a = threadIdParam != null ? threadIdParam : currentThreadId) != null ? _a : null,
          message: message.content,
          // optional request data:
          data: requestOptions == null ? void 0 : requestOptions.data
        })
      });
      if (!response.ok) {
        throw new Error(
          (_b = await response.text()) != null ? _b : "Failed to fetch the assistant response."
        );
      }
      if (response.body == null) {
        throw new Error("The response body is empty.");
      }
      await (0, import_ui_utils.processAssistantStream)({
        stream: response.body,
        onAssistantMessagePart(value) {
          setMessages((messages2) => [
            ...messages2,
            {
              id: value.id,
              role: value.role,
              content: value.content[0].text.value,
              parts: []
            }
          ]);
        },
        onTextPart(value) {
          setMessages((messages2) => {
            const lastMessage = messages2[messages2.length - 1];
            return [
              ...messages2.slice(0, messages2.length - 1),
              {
                id: lastMessage.id,
                role: lastMessage.role,
                content: lastMessage.content + value,
                parts: lastMessage.parts
              }
            ];
          });
        },
        onAssistantControlDataPart(value) {
          setCurrentThreadId(value.threadId);
          setMessages((messages2) => {
            const lastMessage = messages2[messages2.length - 1];
            lastMessage.id = value.messageId;
            return [...messages2.slice(0, messages2.length - 1), lastMessage];
          });
        },
        onDataMessagePart(value) {
          setMessages((messages2) => {
            var _a2;
            return [
              ...messages2,
              {
                id: (_a2 = value.id) != null ? _a2 : (0, import_ui_utils.generateId)(),
                role: "data",
                content: "",
                data: value.data,
                parts: []
              }
            ];
          });
        },
        onErrorPart(value) {
          setError(new Error(value));
        }
      });
    } catch (error2) {
      if ((0, import_provider_utils.isAbortError)(error2) && abortController.signal.aborted) {
        abortControllerRef.current = null;
        return;
      }
      if (onError && error2 instanceof Error) {
        onError(error2);
      }
      setError(error2);
    } finally {
      abortControllerRef.current = null;
      setStatus("awaiting_message");
    }
  };
  const submitMessage = async (event, requestOptions) => {
    var _a;
    (_a = event == null ? void 0 : event.preventDefault) == null ? void 0 : _a.call(event);
    if (input === "") {
      return;
    }
    append({ role: "user", content: input, parts: [] }, requestOptions);
  };
  const setThreadId = (threadId) => {
    setCurrentThreadId(threadId);
    setMessages([]);
  };
  return {
    append,
    messages,
    setMessages,
    threadId: currentThreadId,
    setThreadId,
    input,
    setInput,
    handleInputChange,
    submitMessage,
    status,
    error,
    stop
  };
}

// src/use-chat.ts
var import_ui_utils3 = require("@ai-sdk/ui-utils");
var import_react3 = require("react");
var import_swr = __toESM(require("swr"));

// src/throttle.ts
var import_throttleit = __toESM(require("throttleit"));
function throttle(fn, waitMs) {
  return waitMs != null ? (0, import_throttleit.default)(fn, waitMs) : fn;
}

// src/util/use-stable-value.ts
var import_ui_utils2 = require("@ai-sdk/ui-utils");
var import_react2 = require("react");
function useStableValue(latestValue) {
  const [value, setValue] = (0, import_react2.useState)(latestValue);
  (0, import_react2.useEffect)(() => {
    if (!(0, import_ui_utils2.isDeepEqualData)(latestValue, value)) {
      setValue(latestValue);
    }
  }, [latestValue, value]);
  return value;
}

// src/use-chat.ts
function useChat({
  api = "/api/chat",
  id,
  initialMessages,
  initialInput = "",
  sendExtraMessageFields,
  onToolCall,
  experimental_prepareRequestBody,
  maxSteps = 1,
  streamProtocol = "data",
  onResponse,
  onFinish,
  onError,
  credentials,
  headers,
  body,
  generateId: generateId2 = import_ui_utils3.generateId,
  fetch: fetch2,
  keepLastMessageOnError = true,
  experimental_throttle: throttleWaitMs
} = {}) {
  const [hookId] = (0, import_react3.useState)(generateId2);
  const chatId = id != null ? id : hookId;
  const chatKey = typeof api === "string" ? [api, chatId] : chatId;
  const stableInitialMessages = useStableValue(initialMessages != null ? initialMessages : []);
  const processedInitialMessages = (0, import_react3.useMemo)(
    () => (0, import_ui_utils3.fillMessageParts)(stableInitialMessages),
    [stableInitialMessages]
  );
  const { data: messages, mutate } = (0, import_swr.default)(
    [chatKey, "messages"],
    null,
    { fallbackData: processedInitialMessages }
  );
  const messagesRef = (0, import_react3.useRef)(messages || []);
  (0, import_react3.useEffect)(() => {
    messagesRef.current = messages || [];
  }, [messages]);
  const { data: streamData, mutate: mutateStreamData } = (0, import_swr.default)([chatKey, "streamData"], null);
  const streamDataRef = (0, import_react3.useRef)(streamData);
  (0, import_react3.useEffect)(() => {
    streamDataRef.current = streamData;
  }, [streamData]);
  const { data: status = "ready", mutate: mutateStatus } = (0, import_swr.default)([chatKey, "status"], null);
  const { data: error = void 0, mutate: setError } = (0, import_swr.default)([chatKey, "error"], null);
  const abortControllerRef = (0, import_react3.useRef)(null);
  const extraMetadataRef = (0, import_react3.useRef)({
    credentials,
    headers,
    body
  });
  (0, import_react3.useEffect)(() => {
    extraMetadataRef.current = {
      credentials,
      headers,
      body
    };
  }, [credentials, headers, body]);
  const triggerRequest = (0, import_react3.useCallback)(
    async (chatRequest, requestType = "generate") => {
      var _a, _b;
      mutateStatus("submitted");
      setError(void 0);
      const chatMessages = (0, import_ui_utils3.fillMessageParts)(chatRequest.messages);
      const messageCount = chatMessages.length;
      const maxStep = (0, import_ui_utils3.extractMaxToolInvocationStep)(
        (_a = chatMessages[chatMessages.length - 1]) == null ? void 0 : _a.toolInvocations
      );
      try {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const throttledMutate = throttle(mutate, throttleWaitMs);
        const throttledMutateStreamData = throttle(
          mutateStreamData,
          throttleWaitMs
        );
        const previousMessages = messagesRef.current;
        throttledMutate(chatMessages, false);
        const constructedMessagesPayload = sendExtraMessageFields ? chatMessages : chatMessages.map(
          ({
            role,
            content,
            experimental_attachments,
            data,
            annotations,
            toolInvocations,
            parts
          }) => ({
            role,
            content,
            ...experimental_attachments !== void 0 && {
              experimental_attachments
            },
            ...data !== void 0 && { data },
            ...annotations !== void 0 && { annotations },
            ...toolInvocations !== void 0 && { toolInvocations },
            ...parts !== void 0 && { parts }
          })
        );
        const existingData = streamDataRef.current;
        await (0, import_ui_utils3.callChatApi)({
          api,
          body: (_b = experimental_prepareRequestBody == null ? void 0 : experimental_prepareRequestBody({
            id: chatId,
            messages: chatMessages,
            requestData: chatRequest.data,
            requestBody: chatRequest.body
          })) != null ? _b : {
            id: chatId,
            messages: constructedMessagesPayload,
            data: chatRequest.data,
            ...extraMetadataRef.current.body,
            ...chatRequest.body
          },
          streamProtocol,
          credentials: extraMetadataRef.current.credentials,
          headers: {
            ...extraMetadataRef.current.headers,
            ...chatRequest.headers
          },
          abortController: () => abortControllerRef.current,
          restoreMessagesOnFailure() {
            if (!keepLastMessageOnError) {
              throttledMutate(previousMessages, false);
            }
          },
          onResponse,
          onUpdate({ message, data, replaceLastMessage }) {
            mutateStatus("streaming");
            throttledMutate(
              [
                ...replaceLastMessage ? chatMessages.slice(0, chatMessages.length - 1) : chatMessages,
                message
              ],
              false
            );
            if (data == null ? void 0 : data.length) {
              throttledMutateStreamData(
                [...existingData != null ? existingData : [], ...data],
                false
              );
            }
          },
          onToolCall,
          onFinish,
          generateId: generateId2,
          fetch: fetch2,
          lastMessage: chatMessages[chatMessages.length - 1],
          requestType
        });
        abortControllerRef.current = null;
        mutateStatus("ready");
      } catch (err) {
        if (err.name === "AbortError") {
          abortControllerRef.current = null;
          mutateStatus("ready");
          return null;
        }
        if (onError && err instanceof Error) {
          onError(err);
        }
        setError(err);
        mutateStatus("error");
      }
      const messages2 = messagesRef.current;
      if ((0, import_ui_utils3.shouldResubmitMessages)({
        originalMaxToolInvocationStep: maxStep,
        originalMessageCount: messageCount,
        maxSteps,
        messages: messages2
      })) {
        await triggerRequest({ messages: messages2 });
      }
    },
    [
      mutate,
      mutateStatus,
      api,
      extraMetadataRef,
      onResponse,
      onFinish,
      onError,
      setError,
      mutateStreamData,
      streamDataRef,
      streamProtocol,
      sendExtraMessageFields,
      experimental_prepareRequestBody,
      onToolCall,
      maxSteps,
      messagesRef,
      abortControllerRef,
      generateId2,
      fetch2,
      keepLastMessageOnError,
      throttleWaitMs,
      chatId
    ]
  );
  const append = (0, import_react3.useCallback)(
    async (message, {
      data,
      headers: headers2,
      body: body2,
      experimental_attachments = message.experimental_attachments
    } = {}) => {
      var _a, _b;
      const attachmentsForRequest = await (0, import_ui_utils3.prepareAttachmentsForRequest)(
        experimental_attachments
      );
      const messages2 = messagesRef.current.concat({
        ...message,
        id: (_a = message.id) != null ? _a : generateId2(),
        createdAt: (_b = message.createdAt) != null ? _b : /* @__PURE__ */ new Date(),
        experimental_attachments: attachmentsForRequest.length > 0 ? attachmentsForRequest : void 0,
        parts: (0, import_ui_utils3.getMessageParts)(message)
      });
      return triggerRequest({ messages: messages2, headers: headers2, body: body2, data });
    },
    [triggerRequest, generateId2]
  );
  const reload = (0, import_react3.useCallback)(
    async ({ data, headers: headers2, body: body2 } = {}) => {
      const messages2 = messagesRef.current;
      if (messages2.length === 0) {
        return null;
      }
      const lastMessage = messages2[messages2.length - 1];
      return triggerRequest({
        messages: lastMessage.role === "assistant" ? messages2.slice(0, -1) : messages2,
        headers: headers2,
        body: body2,
        data
      });
    },
    [triggerRequest]
  );
  const stop = (0, import_react3.useCallback)(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  const experimental_resume = (0, import_react3.useCallback)(async () => {
    const messages2 = messagesRef.current;
    triggerRequest({ messages: messages2 }, "resume");
  }, [triggerRequest]);
  const setMessages = (0, import_react3.useCallback)(
    (messages2) => {
      if (typeof messages2 === "function") {
        messages2 = messages2(messagesRef.current);
      }
      const messagesWithParts = (0, import_ui_utils3.fillMessageParts)(messages2);
      mutate(messagesWithParts, false);
      messagesRef.current = messagesWithParts;
    },
    [mutate]
  );
  const setData = (0, import_react3.useCallback)(
    (data) => {
      if (typeof data === "function") {
        data = data(streamDataRef.current);
      }
      mutateStreamData(data, false);
      streamDataRef.current = data;
    },
    [mutateStreamData]
  );
  const [input, setInput] = (0, import_react3.useState)(initialInput);
  const handleSubmit = (0, import_react3.useCallback)(
    async (event, options = {}, metadata) => {
      var _a;
      (_a = event == null ? void 0 : event.preventDefault) == null ? void 0 : _a.call(event);
      if (!input && !options.allowEmptySubmit)
        return;
      if (metadata) {
        extraMetadataRef.current = {
          ...extraMetadataRef.current,
          ...metadata
        };
      }
      const attachmentsForRequest = await (0, import_ui_utils3.prepareAttachmentsForRequest)(
        options.experimental_attachments
      );
      const messages2 = messagesRef.current.concat({
        id: generateId2(),
        createdAt: /* @__PURE__ */ new Date(),
        role: "user",
        content: input,
        experimental_attachments: attachmentsForRequest.length > 0 ? attachmentsForRequest : void 0,
        parts: [{ type: "text", text: input }]
      });
      const chatRequest = {
        messages: messages2,
        headers: options.headers,
        body: options.body,
        data: options.data
      };
      triggerRequest(chatRequest);
      setInput("");
    },
    [input, generateId2, triggerRequest]
  );
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };
  const addToolResult = (0, import_react3.useCallback)(
    ({ toolCallId, result }) => {
      const currentMessages = messagesRef.current;
      (0, import_ui_utils3.updateToolCallResult)({
        messages: currentMessages,
        toolCallId,
        toolResult: result
      });
      mutate(
        [
          ...currentMessages.slice(0, currentMessages.length - 1),
          { ...currentMessages[currentMessages.length - 1] }
        ],
        false
      );
      if (status === "submitted" || status === "streaming") {
        return;
      }
      const lastMessage = currentMessages[currentMessages.length - 1];
      if ((0, import_ui_utils3.isAssistantMessageWithCompletedToolCalls)(lastMessage)) {
        triggerRequest({ messages: currentMessages });
      }
    },
    [mutate, status, triggerRequest]
  );
  return {
    messages: messages != null ? messages : [],
    id: chatId,
    setMessages,
    data: streamData,
    setData,
    error,
    append,
    reload,
    stop,
    experimental_resume,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: status === "submitted" || status === "streaming",
    status,
    addToolResult
  };
}

// src/use-completion.ts
var import_ui_utils4 = require("@ai-sdk/ui-utils");
var import_react4 = require("react");
var import_swr2 = __toESM(require("swr"));
function useCompletion({
  api = "/api/completion",
  id,
  initialCompletion = "",
  initialInput = "",
  credentials,
  headers,
  body,
  streamProtocol = "data",
  fetch: fetch2,
  onResponse,
  onFinish,
  onError,
  experimental_throttle: throttleWaitMs
} = {}) {
  const hookId = (0, import_react4.useId)();
  const completionId = id || hookId;
  const { data, mutate } = (0, import_swr2.default)([api, completionId], null, {
    fallbackData: initialCompletion
  });
  const { data: isLoading = false, mutate: mutateLoading } = (0, import_swr2.default)(
    [completionId, "loading"],
    null
  );
  const { data: streamData, mutate: mutateStreamData } = (0, import_swr2.default)([completionId, "streamData"], null);
  const [error, setError] = (0, import_react4.useState)(void 0);
  const completion = data;
  const [abortController, setAbortController] = (0, import_react4.useState)(null);
  const extraMetadataRef = (0, import_react4.useRef)({
    credentials,
    headers,
    body
  });
  (0, import_react4.useEffect)(() => {
    extraMetadataRef.current = {
      credentials,
      headers,
      body
    };
  }, [credentials, headers, body]);
  const triggerRequest = (0, import_react4.useCallback)(
    async (prompt, options) => (0, import_ui_utils4.callCompletionApi)({
      api,
      prompt,
      credentials: extraMetadataRef.current.credentials,
      headers: { ...extraMetadataRef.current.headers, ...options == null ? void 0 : options.headers },
      body: {
        ...extraMetadataRef.current.body,
        ...options == null ? void 0 : options.body
      },
      streamProtocol,
      fetch: fetch2,
      // throttle streamed ui updates:
      setCompletion: throttle(
        (completion2) => mutate(completion2, false),
        throttleWaitMs
      ),
      onData: throttle(
        (data2) => mutateStreamData([...streamData != null ? streamData : [], ...data2 != null ? data2 : []], false),
        throttleWaitMs
      ),
      setLoading: mutateLoading,
      setError,
      setAbortController,
      onResponse,
      onFinish,
      onError
    }),
    [
      mutate,
      mutateLoading,
      api,
      extraMetadataRef,
      setAbortController,
      onResponse,
      onFinish,
      onError,
      setError,
      streamData,
      streamProtocol,
      fetch2,
      mutateStreamData,
      throttleWaitMs
    ]
  );
  const stop = (0, import_react4.useCallback)(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  }, [abortController]);
  const setCompletion = (0, import_react4.useCallback)(
    (completion2) => {
      mutate(completion2, false);
    },
    [mutate]
  );
  const complete = (0, import_react4.useCallback)(
    async (prompt, options) => {
      return triggerRequest(prompt, options);
    },
    [triggerRequest]
  );
  const [input, setInput] = (0, import_react4.useState)(initialInput);
  const handleSubmit = (0, import_react4.useCallback)(
    (event) => {
      var _a;
      (_a = event == null ? void 0 : event.preventDefault) == null ? void 0 : _a.call(event);
      return input ? complete(input) : void 0;
    },
    [input, complete]
  );
  const handleInputChange = (0, import_react4.useCallback)(
    (e) => {
      setInput(e.target.value);
    },
    [setInput]
  );
  return {
    completion,
    complete,
    error,
    setCompletion,
    stop,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    data: streamData
  };
}

// src/use-object.ts
var import_provider_utils2 = require("@ai-sdk/provider-utils");
var import_ui_utils5 = require("@ai-sdk/ui-utils");
var import_react5 = require("react");
var import_swr3 = __toESM(require("swr"));
var getOriginalFetch2 = () => fetch;
function useObject({
  api,
  id,
  schema,
  // required, in the future we will use it for validation
  initialValue,
  fetch: fetch2,
  onError,
  onFinish,
  headers,
  credentials
}) {
  const hookId = (0, import_react5.useId)();
  const completionId = id != null ? id : hookId;
  const { data, mutate } = (0, import_swr3.default)(
    [api, completionId],
    null,
    { fallbackData: initialValue }
  );
  const [error, setError] = (0, import_react5.useState)(void 0);
  const [isLoading, setIsLoading] = (0, import_react5.useState)(false);
  const abortControllerRef = (0, import_react5.useRef)(null);
  const stop = (0, import_react5.useCallback)(() => {
    var _a;
    try {
      (_a = abortControllerRef.current) == null ? void 0 : _a.abort();
    } catch (ignored) {
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);
  const submit = async (input) => {
    var _a;
    try {
      mutate(void 0);
      setIsLoading(true);
      setError(void 0);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const actualFetch = fetch2 != null ? fetch2 : getOriginalFetch2();
      const response = await actualFetch(api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        credentials,
        signal: abortController.signal,
        body: JSON.stringify(input)
      });
      if (!response.ok) {
        throw new Error(
          (_a = await response.text()) != null ? _a : "Failed to fetch the response."
        );
      }
      if (response.body == null) {
        throw new Error("The response body is empty.");
      }
      let accumulatedText = "";
      let latestObject = void 0;
      await response.body.pipeThrough(new TextDecoderStream()).pipeTo(
        new WritableStream({
          write(chunk) {
            accumulatedText += chunk;
            const { value } = (0, import_ui_utils5.parsePartialJson)(accumulatedText);
            const currentObject = value;
            if (!(0, import_ui_utils5.isDeepEqualData)(latestObject, currentObject)) {
              latestObject = currentObject;
              mutate(currentObject);
            }
          },
          close() {
            setIsLoading(false);
            abortControllerRef.current = null;
            if (onFinish != null) {
              const validationResult = (0, import_provider_utils2.safeValidateTypes)({
                value: latestObject,
                schema: (0, import_ui_utils5.asSchema)(schema)
              });
              onFinish(
                validationResult.success ? { object: validationResult.value, error: void 0 } : { object: void 0, error: validationResult.error }
              );
            }
          }
        })
      );
    } catch (error2) {
      if ((0, import_provider_utils2.isAbortError)(error2)) {
        return;
      }
      if (onError && error2 instanceof Error) {
        onError(error2);
      }
      setIsLoading(false);
      setError(error2 instanceof Error ? error2 : new Error(String(error2)));
    }
  };
  return {
    submit,
    object: data,
    error,
    isLoading,
    stop
  };
}
var experimental_useObject = useObject;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  experimental_useObject,
  useAssistant,
  useChat,
  useCompletion
});
//# sourceMappingURL=index.js.map