// src/runtimes/external-store/getExternalStoreMessage.tsx
var symbolInnerMessage = Symbol("innerMessage");
var symbolInnerMessages = Symbol("innerMessages");
var getExternalStoreMessage = (input) => {
  const withInnerMessages = input;
  return withInnerMessages[symbolInnerMessage];
};
var EMPTY_ARRAY = [];
var getExternalStoreMessages = (input) => {
  const container = "messages" in input ? input.messages : input;
  const value = container[symbolInnerMessages] || container[symbolInnerMessage];
  if (!value) return EMPTY_ARRAY;
  if (Array.isArray(value)) {
    return value;
  }
  container[symbolInnerMessages] = [value];
  return container[symbolInnerMessages];
};
export {
  getExternalStoreMessage,
  getExternalStoreMessages,
  symbolInnerMessage
};
//# sourceMappingURL=getExternalStoreMessage.js.map