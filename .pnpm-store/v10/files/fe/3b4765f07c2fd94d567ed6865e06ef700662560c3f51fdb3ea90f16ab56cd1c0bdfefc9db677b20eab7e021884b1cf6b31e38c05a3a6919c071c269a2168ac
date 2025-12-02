import { ThreadState } from "../../api";
import { ThreadMessage } from "../../types";

export const symbolInnerMessage = Symbol("innerMessage");
const symbolInnerMessages = Symbol("innerMessages");

type WithInnerMessages<T> = {
  [symbolInnerMessage]?: T | T[];
  [symbolInnerMessages]?: T[];
};

/**
 * @deprecated Use `getExternalStoreMessages` (plural) instead. This function will be removed in 0.8.0.
 */
export const getExternalStoreMessage = <T,>(input: ThreadMessage) => {
  const withInnerMessages = input as WithInnerMessages<T>;
  return withInnerMessages[symbolInnerMessage];
};

const EMPTY_ARRAY: never[] = [];

export const getExternalStoreMessages = <T,>(
  input: ThreadState | ThreadMessage | ThreadMessage["content"][number],
) => {
  // TODO temp until 0.8.0 (migrate useExternalStoreRuntime to always set an array)

  const container = (
    "messages" in input ? input.messages : input
  ) as WithInnerMessages<T>;
  const value = container[symbolInnerMessages] || container[symbolInnerMessage];
  if (!value) return EMPTY_ARRAY;
  if (Array.isArray(value)) {
    return value;
  }
  container[symbolInnerMessages] = [value];
  return container[symbolInnerMessages];
};
