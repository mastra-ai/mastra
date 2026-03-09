export { aiV4CoreMessageToV1PromptMessage, aiV5ModelMessageToV2PromptMessage } from './to-prompt';
export { coreContentToString, messagesAreEqual } from './utils';
export {
  inputToMastraDBMessage,
  mastraMessageV1ToMastraDBMessage,
  hydrateMastraDBMessageFields,
} from './input-converter';
export type { InputConversionContext } from './input-converter';
export {
  sanitizeAIV4UIMessages,
  sanitizeV5UIMessages,
  addStartStepPartsForAIV5,
  aiV4UIMessagesToAIV4CoreMessages,
  aiV5UIMessagesToAIV5ModelMessages,
  aiV4CoreMessagesToAIV5ModelMessages,
  systemMessageToAIV4Core,
} from './output-converter';
export { StepContentExtractor } from './step-content';
