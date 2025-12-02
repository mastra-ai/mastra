import { convertGenAISpanAttributesToOpenInferenceSpanAttributes as unsafeConvertGenAISpanAttributesToOpenInferenceSpanAttributes } from "./attributes.js";
import { withSafety } from "./utils.js";

export const convertGenAISpanAttributesToOpenInferenceSpanAttributes =
  withSafety({
    fn: unsafeConvertGenAISpanAttributesToOpenInferenceSpanAttributes,
    onError(error) {
      // eslint-disable-next-line no-console
      console.error(
        "Unable to convert GenAI span attributes to OpenInference span attributes",
        error,
      );
    },
  });
