"use client";

// rsc/streamable-value/streamable-value.ts
var STREAMABLE_VALUE_TYPE = Symbol.for("ui.streamable.value");

// rsc/streamable-value/is-streamable-value.ts
function isStreamableValue(value) {
  return value != null && typeof value === "object" && "type" in value && value.type === STREAMABLE_VALUE_TYPE;
}

// rsc/streamable-value/read-streamable-value.tsx
function readStreamableValue(streamableValue) {
  if (!isStreamableValue(streamableValue)) {
    throw new Error(
      "Invalid value: this hook only accepts values created via `createStreamableValue`."
    );
  }
  return {
    [Symbol.asyncIterator]() {
      let row = streamableValue;
      let value = row.curr;
      let isDone = false;
      let isFirstIteration = true;
      return {
        async next() {
          if (isDone)
            return { value, done: true };
          row = await row;
          if (row.error !== void 0) {
            throw row.error;
          }
          if ("curr" in row || row.diff) {
            if (row.diff) {
              if (row.diff[0] === 0) {
                if (typeof value !== "string") {
                  throw new Error(
                    "Invalid patch: can only append to string types. This is a bug in the AI SDK."
                  );
                }
                value = value + row.diff[1];
              }
            } else {
              value = row.curr;
            }
            if (!row.next) {
              isDone = true;
              return { value, done: false };
            }
          }
          if (row.next === void 0) {
            return { value, done: true };
          }
          row = row.next;
          if (isFirstIteration) {
            isFirstIteration = false;
            if (value === void 0) {
              return this.next();
            }
          }
          return { value, done: false };
        }
      };
    }
  };
}

// rsc/streamable-value/use-streamable-value.tsx
import { startTransition, useLayoutEffect, useState } from "react";
function checkStreamableValue(value) {
  const hasSignature = isStreamableValue(value);
  if (!hasSignature && value !== void 0) {
    throw new Error(
      "Invalid value: this hook only accepts values created via `createStreamableValue`."
    );
  }
  return hasSignature;
}
function useStreamableValue(streamableValue) {
  const [curr, setCurr] = useState(
    checkStreamableValue(streamableValue) ? streamableValue.curr : void 0
  );
  const [error, setError] = useState(
    checkStreamableValue(streamableValue) ? streamableValue.error : void 0
  );
  const [pending, setPending] = useState(
    checkStreamableValue(streamableValue) ? !!streamableValue.next : false
  );
  useLayoutEffect(() => {
    if (!checkStreamableValue(streamableValue))
      return;
    let cancelled = false;
    const iterator = readStreamableValue(streamableValue);
    if (streamableValue.next) {
      startTransition(() => {
        if (cancelled)
          return;
        setPending(true);
      });
    }
    (async () => {
      try {
        for await (const value of iterator) {
          if (cancelled)
            return;
          startTransition(() => {
            if (cancelled)
              return;
            setCurr(value);
          });
        }
      } catch (e) {
        if (cancelled)
          return;
        startTransition(() => {
          if (cancelled)
            return;
          setError(e);
        });
      } finally {
        if (cancelled)
          return;
        startTransition(() => {
          if (cancelled)
            return;
          setPending(false);
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamableValue]);
  return [curr, error, pending];
}

// rsc/shared-client/context.tsx
import * as React from "react";
import * as jsondiffpatch from "jsondiffpatch";

// util/is-function.ts
var isFunction = (value) => typeof value === "function";

// rsc/shared-client/context.tsx
import { jsx } from "react/jsx-runtime";
var InternalUIStateProvider = React.createContext(null);
var InternalAIStateProvider = React.createContext(void 0);
var InternalActionProvider = React.createContext(null);
var InternalSyncUIStateProvider = React.createContext(null);
function InternalAIProvider({
  children,
  initialUIState,
  initialAIState,
  initialAIStatePatch,
  wrappedActions,
  wrappedSyncUIState
}) {
  if (!("use" in React)) {
    throw new Error("Unsupported React version.");
  }
  const uiState = React.useState(initialUIState);
  const setUIState = uiState[1];
  const resolvedInitialAIStatePatch = initialAIStatePatch ? React.use(initialAIStatePatch) : void 0;
  initialAIState = React.useMemo(() => {
    if (resolvedInitialAIStatePatch) {
      return jsondiffpatch.patch(
        jsondiffpatch.clone(initialAIState),
        resolvedInitialAIStatePatch
      );
    }
    return initialAIState;
  }, [initialAIState, resolvedInitialAIStatePatch]);
  const aiState = React.useState(initialAIState);
  const setAIState = aiState[1];
  const aiStateRef = React.useRef(aiState[0]);
  React.useEffect(() => {
    aiStateRef.current = aiState[0];
  }, [aiState[0]]);
  const clientWrappedActions = React.useMemo(
    () => Object.fromEntries(
      Object.entries(wrappedActions).map(([key, action]) => [
        key,
        async (...args) => {
          const aiStateSnapshot = aiStateRef.current;
          const [aiStateDelta, result] = await action(
            aiStateSnapshot,
            ...args
          );
          (async () => {
            const delta = await aiStateDelta;
            if (delta !== void 0) {
              aiState[1](
                jsondiffpatch.patch(
                  jsondiffpatch.clone(aiStateSnapshot),
                  delta
                )
              );
            }
          })();
          return result;
        }
      ])
    ),
    [wrappedActions]
  );
  const clientWrappedSyncUIStateAction = React.useMemo(() => {
    if (!wrappedSyncUIState) {
      return () => {
      };
    }
    return async () => {
      const aiStateSnapshot = aiStateRef.current;
      const [aiStateDelta, uiState2] = await wrappedSyncUIState(aiStateSnapshot);
      if (uiState2 !== void 0) {
        setUIState(uiState2);
      }
      const delta = await aiStateDelta;
      if (delta !== void 0) {
        const patchedAiState = jsondiffpatch.patch(
          jsondiffpatch.clone(aiStateSnapshot),
          delta
        );
        setAIState(patchedAiState);
      }
    };
  }, [wrappedSyncUIState]);
  return /* @__PURE__ */ jsx(InternalAIStateProvider.Provider, { value: aiState, children: /* @__PURE__ */ jsx(InternalUIStateProvider.Provider, { value: uiState, children: /* @__PURE__ */ jsx(InternalActionProvider.Provider, { value: clientWrappedActions, children: /* @__PURE__ */ jsx(
    InternalSyncUIStateProvider.Provider,
    {
      value: clientWrappedSyncUIStateAction,
      children
    }
  ) }) }) });
}
function useUIState() {
  const state = React.useContext(InternalUIStateProvider);
  if (state === null) {
    throw new Error("`useUIState` must be used inside an <AI> provider.");
  }
  if (!Array.isArray(state)) {
    throw new Error("Invalid state");
  }
  if (state[0] === void 0) {
    throw new Error(
      "`initialUIState` must be provided to `createAI` or `<AI>`"
    );
  }
  return state;
}
function useAIState(...args) {
  const state = React.useContext(InternalAIStateProvider);
  if (state === null) {
    throw new Error("`useAIState` must be used inside an <AI> provider.");
  }
  if (!Array.isArray(state)) {
    throw new Error("Invalid state");
  }
  if (state[0] === void 0) {
    throw new Error(
      "`initialAIState` must be provided to `createAI` or `<AI>`"
    );
  }
  if (args.length >= 1 && typeof state[0] !== "object") {
    throw new Error(
      "When using `useAIState` with a key, the AI state must be an object."
    );
  }
  const key = args[0];
  const setter = React.useCallback(
    typeof key === "undefined" ? state[1] : (newState) => {
      if (isFunction(newState)) {
        return state[1]((s) => {
          return { ...s, [key]: newState(s[key]) };
        });
      } else {
        return state[1]({ ...state[0], [key]: newState });
      }
    },
    [key]
  );
  if (args.length === 0) {
    return state;
  } else {
    return [state[0][args[0]], setter];
  }
}
function useActions() {
  const actions = React.useContext(InternalActionProvider);
  return actions;
}
function useSyncUIState() {
  const syncUIState = React.useContext(
    InternalSyncUIStateProvider
  );
  if (syncUIState === null) {
    throw new Error("`useSyncUIState` must be used inside an <AI> provider.");
  }
  return syncUIState;
}
export {
  InternalAIProvider,
  readStreamableValue,
  useAIState,
  useActions,
  useStreamableValue,
  useSyncUIState,
  useUIState
};
//# sourceMappingURL=rsc-shared.mjs.map