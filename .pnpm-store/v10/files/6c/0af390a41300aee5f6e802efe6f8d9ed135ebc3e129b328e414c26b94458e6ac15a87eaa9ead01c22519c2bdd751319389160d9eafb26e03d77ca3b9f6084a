// src/use-assistant.ts
import { isAbortError } from "@ai-sdk/provider-utils";
import {
  generateId,
  processAssistantStream
} from "@ai-sdk/ui-utils";
import { useCallback, useRef, useState } from "react";
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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentThreadId, setCurrentThreadId] = useState(
    void 0
  );
  const [status, setStatus] = useState("awaiting_message");
  const [error, setError] = useState(void 0);
  const handleInputChange = (event) => {
    setInput(event.target.value);
  };
  const abortControllerRef = useRef(null);
  const stop = useCallback(() => {
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
          id: (_a2 = message.id) != null ? _a2 : generateId()
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
      await processAssistantStream({
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
                id: (_a2 = value.id) != null ? _a2 : generateId(),
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
      if (isAbortError(error2) && abortController.signal.aborted) {
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
import {
  callChatApi,
  extractMaxToolInvocationStep,
  fillMessageParts,
  generateId as generateIdFunc,
  getMessageParts,
  isAssistantMessageWithCompletedToolCalls,
  prepareAttachmentsForRequest,
  shouldResubmitMessages,
  updateToolCallResult
} from "@ai-sdk/ui-utils";
import { useCallback as useCallback2, useEffect as useEffect2, useMemo, useRef as useRef2, useState as useState3 } from "react";
import useSWR from "swr";

// src/throttle.ts
import throttleFunction from "throttleit";
function throttle(fn, waitMs) {
  return waitMs != null ? throttleFunction(fn, waitMs) : fn;
}

// src/util/use-stable-value.ts
import { isDeepEqualData } from "@ai-sdk/ui-utils";
import { useEffect, useState as useState2 } from "react";
function useStableValue(latestValue) {
  const [value, setValue] = useState2(latestValue);
  useEffect(() => {
    if (!isDeepEqualData(latestValue, value)) {
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
  generateId: generateId2 = generateIdFunc,
  fetch: fetch2,
  keepLastMessageOnError = true,
  experimental_throttle: throttleWaitMs
} = {}) {
  const [hookId] = useState3(generateId2);
  const chatId = id != null ? id : hookId;
  const chatKey = typeof api === "string" ? [api, chatId] : chatId;
  const stableInitialMessages = useStableValue(initialMessages != null ? initialMessages : []);
  const processedInitialMessages = useMemo(
    () => fillMessageParts(stableInitialMessages),
    [stableInitialMessages]
  );
  const { data: messages, mutate } = useSWR(
    [chatKey, "messages"],
    null,
    { fallbackData: processedInitialMessages }
  );
  const messagesRef = useRef2(messages || []);
  useEffect2(() => {
    messagesRef.current = messages || [];
  }, [messages]);
  const { data: streamData, mutate: mutateStreamData } = useSWR([chatKey, "streamData"], null);
  const streamDataRef = useRef2(streamData);
  useEffect2(() => {
    streamDataRef.current = streamData;
  }, [streamData]);
  const { data: status = "ready", mutate: mutateStatus } = useSWR([chatKey, "status"], null);
  const { data: error = void 0, mutate: setError } = useSWR([chatKey, "error"], null);
  const abortControllerRef = useRef2(null);
  const extraMetadataRef = useRef2({
    credentials,
    headers,
    body
  });
  useEffect2(() => {
    extraMetadataRef.current = {
      credentials,
      headers,
      body
    };
  }, [credentials, headers, body]);
  const triggerRequest = useCallback2(
    async (chatRequest, requestType = "generate") => {
      var _a, _b;
      mutateStatus("submitted");
      setError(void 0);
      const chatMessages = fillMessageParts(chatRequest.messages);
      const messageCount = chatMessages.length;
      const maxStep = extractMaxToolInvocationStep(
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
        await callChatApi({
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
      if (shouldResubmitMessages({
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
  const append = useCallback2(
    async (message, {
      data,
      headers: headers2,
      body: body2,
      experimental_attachments = message.experimental_attachments
    } = {}) => {
      var _a, _b;
      const attachmentsForRequest = await prepareAttachmentsForRequest(
        experimental_attachments
      );
      const messages2 = messagesRef.current.concat({
        ...message,
        id: (_a = message.id) != null ? _a : generateId2(),
        createdAt: (_b = message.createdAt) != null ? _b : /* @__PURE__ */ new Date(),
        experimental_attachments: attachmentsForRequest.length > 0 ? attachmentsForRequest : void 0,
        parts: getMessageParts(message)
      });
      return triggerRequest({ messages: messages2, headers: headers2, body: body2, data });
    },
    [triggerRequest, generateId2]
  );
  const reload = useCallback2(
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
  const stop = useCallback2(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  const experimental_resume = useCallback2(async () => {
    const messages2 = messagesRef.current;
    triggerRequest({ messages: messages2 }, "resume");
  }, [triggerRequest]);
  const setMessages = useCallback2(
    (messages2) => {
      if (typeof messages2 === "function") {
        messages2 = messages2(messagesRef.current);
      }
      const messagesWithParts = fillMessageParts(messages2);
      mutate(messagesWithParts, false);
      messagesRef.current = messagesWithParts;
    },
    [mutate]
  );
  const setData = useCallback2(
    (data) => {
      if (typeof data === "function") {
        data = data(streamDataRef.current);
      }
      mutateStreamData(data, false);
      streamDataRef.current = data;
    },
    [mutateStreamData]
  );
  const [input, setInput] = useState3(initialInput);
  const handleSubmit = useCallback2(
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
      const attachmentsForRequest = await prepareAttachmentsForRequest(
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
  const addToolResult = useCallback2(
    ({ toolCallId, result }) => {
      const currentMessages = messagesRef.current;
      updateToolCallResult({
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
      if (isAssistantMessageWithCompletedToolCalls(lastMessage)) {
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
import {
  callCompletionApi
} from "@ai-sdk/ui-utils";
import { useCallback as useCallback3, useEffect as useEffect3, useId, useRef as useRef3, useState as useState4 } from "react";
import useSWR2 from "swr";
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
  const hookId = useId();
  const completionId = id || hookId;
  const { data, mutate } = useSWR2([api, completionId], null, {
    fallbackData: initialCompletion
  });
  const { data: isLoading = false, mutate: mutateLoading } = useSWR2(
    [completionId, "loading"],
    null
  );
  const { data: streamData, mutate: mutateStreamData } = useSWR2([completionId, "streamData"], null);
  const [error, setError] = useState4(void 0);
  const completion = data;
  const [abortController, setAbortController] = useState4(null);
  const extraMetadataRef = useRef3({
    credentials,
    headers,
    body
  });
  useEffect3(() => {
    extraMetadataRef.current = {
      credentials,
      headers,
      body
    };
  }, [credentials, headers, body]);
  const triggerRequest = useCallback3(
    async (prompt, options) => callCompletionApi({
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
  const stop = useCallback3(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  }, [abortController]);
  const setCompletion = useCallback3(
    (completion2) => {
      mutate(completion2, false);
    },
    [mutate]
  );
  const complete = useCallback3(
    async (prompt, options) => {
      return triggerRequest(prompt, options);
    },
    [triggerRequest]
  );
  const [input, setInput] = useState4(initialInput);
  const handleSubmit = useCallback3(
    (event) => {
      var _a;
      (_a = event == null ? void 0 : event.preventDefault) == null ? void 0 : _a.call(event);
      return input ? complete(input) : void 0;
    },
    [input, complete]
  );
  const handleInputChange = useCallback3(
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
import {
  isAbortError as isAbortError2,
  safeValidateTypes
} from "@ai-sdk/provider-utils";
import {
  asSchema,
  isDeepEqualData as isDeepEqualData2,
  parsePartialJson
} from "@ai-sdk/ui-utils";
import { useCallback as useCallback4, useId as useId2, useRef as useRef4, useState as useState5 } from "react";
import useSWR3 from "swr";
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
  const hookId = useId2();
  const completionId = id != null ? id : hookId;
  const { data, mutate } = useSWR3(
    [api, completionId],
    null,
    { fallbackData: initialValue }
  );
  const [error, setError] = useState5(void 0);
  const [isLoading, setIsLoading] = useState5(false);
  const abortControllerRef = useRef4(null);
  const stop = useCallback4(() => {
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
            const { value } = parsePartialJson(accumulatedText);
            const currentObject = value;
            if (!isDeepEqualData2(latestObject, currentObject)) {
              latestObject = currentObject;
              mutate(currentObject);
            }
          },
          close() {
            setIsLoading(false);
            abortControllerRef.current = null;
            if (onFinish != null) {
              const validationResult = safeValidateTypes({
                value: latestObject,
                schema: asSchema(schema)
              });
              onFinish(
                validationResult.success ? { object: validationResult.value, error: void 0 } : { object: void 0, error: validationResult.error }
              );
            }
          }
        })
      );
    } catch (error2) {
      if (isAbortError2(error2)) {
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
export {
  experimental_useObject,
  useAssistant,
  useChat,
  useCompletion
};
//# sourceMappingURL=index.mjs.map