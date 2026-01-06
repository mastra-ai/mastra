/**
 * Shared ModelSettings properties for agent methods (generate, stream, network)
 * These settings control how the language model generates responses.
 * Based on AI SDK v5 CallSettings type.
 */
export const MODEL_SETTINGS_PROPERTIES = [
  {
    parameters: [
      {
        name: "temperature",
        type: "number",
        isOptional: true,
        description:
          "Controls randomness in generation (0-2). Higher values make output more random.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "maxOutputTokens",
        type: "number",
        isOptional: true,
        description:
          "Maximum number of tokens to generate in the response. Note: Use maxOutputTokens (not maxTokens) as per AI SDK v5 convention.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "maxRetries",
        type: "number",
        isOptional: true,
        description: "Maximum number of retry attempts for failed requests.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "topP",
        type: "number",
        isOptional: true,
        description:
          "Nucleus sampling parameter (0-1). Controls diversity of generated text.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "topK",
        type: "number",
        isOptional: true,
        description:
          "Top-k sampling parameter. Limits vocabulary to k most likely tokens.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "presencePenalty",
        type: "number",
        isOptional: true,
        description:
          "Penalty for token presence (-2 to 2). Reduces repetition.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "frequencyPenalty",
        type: "number",
        isOptional: true,
        description:
          "Penalty for token frequency (-2 to 2). Reduces repetition of frequent tokens.",
      },
    ],
  },
  {
    parameters: [
      {
        name: "stopSequences",
        type: "string[]",
        isOptional: true,
        description:
          "Stop sequences. If set, the model will stop generating text when one of the stop sequences is generated.",
      },
    ],
  },
];

/**
 * ModelSettings object for use in PropertiesTable components
 * Can be spread into the content array of PropertiesTable
 */
export const MODEL_SETTINGS_OBJECT = {
  name: "modelSettings",
  type: "CallSettings",
  isOptional: true,
  description:
    "Model-specific settings like temperature, maxOutputTokens, topP, etc. These settings control how the language model generates responses.",
  properties: MODEL_SETTINGS_PROPERTIES,
};
