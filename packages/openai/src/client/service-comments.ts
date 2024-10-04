export const comments = {
  "createAnswer": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Answers the specified question using the provided documents and examples.\n \n  The endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions)."
  },
  "createTranscription": {
    "comment": "Transcribes audio into the input language.",
    "doc": "Transcribes audio into the input language."
  },
  "createTranslation": {
    "comment": "Translates audio into into English.",
    "doc": "Translates audio into into English."
  },
  "createChatCompletion": {
    "comment": "Creates a completion for the chat message",
    "doc": "Creates a completion for the chat message"
  },
  "createClassification": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Classifies the specified `query` using provided examples.\n \n  The endpoint first [searches](/docs/api-reference/searches) over the labeled examples\n  to select the ones most relevant for the particular query. Then, the relevant examples\n  are combined with the query to construct a prompt to produce the final label via the\n  [completions](/docs/api-reference/completions) endpoint.\n \n  Labeled examples can be provided via an uploaded `file`, or explicitly listed in the\n  request using the `examples` parameter for quick tests and small scale use cases."
  },
  "createCompletion": {
    "comment": "Creates a completion for the provided prompt and parameters",
    "doc": "Creates a completion for the provided prompt and parameters"
  },
  "createEdit": {
    "comment": "Creates a new edit for the provided input, instruction, and parameters.",
    "doc": "Creates a new edit for the provided input, instruction, and parameters."
  },
  "createEmbedding": {
    "comment": "Creates an embedding vector representing the input text.",
    "doc": "Creates an embedding vector representing the input text."
  },
  "listEngines": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability."
  },
  "retrieveEngine": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  Retrieves a model instance, providing basic information about it such as the owner and availability."
  },
  "createSearch": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.\n \n  To go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.\n \n  The similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query."
  },
  "listFiles": {
    "comment": "Returns a list of files that belong to the user's organization.",
    "doc": "Returns a list of files that belong to the user's organization."
  },
  "createFile": {
    "comment": "Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.",
    "doc": "Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit."
  },
  "deleteFile": {
    "comment": "Delete a file.",
    "doc": "Delete a file."
  },
  "retrieveFile": {
    "comment": "Returns information about a specific file.",
    "doc": "Returns information about a specific file."
  },
  "downloadFile": {
    "comment": "Returns the contents of the specified file",
    "doc": "Returns the contents of the specified file"
  },
  "listFineTunes": {
    "comment": "List your organization's fine-tuning jobs",
    "doc": "List your organization's fine-tuning jobs"
  },
  "createFineTune": {
    "comment": "Creates a job that fine-tunes a specified model from a given dataset.",
    "doc": "Creates a job that fine-tunes a specified model from a given dataset.\n \n  Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.\n \n  [Learn more about Fine-tuning](/docs/guides/fine-tuning)"
  },
  "retrieveFineTune": {
    "comment": "Gets info about the fine-tune job.",
    "doc": "Gets info about the fine-tune job.\n \n  [Learn more about Fine-tuning](/docs/guides/fine-tuning)"
  },
  "cancelFineTune": {
    "comment": "Immediately cancel a fine-tune job.",
    "doc": "Immediately cancel a fine-tune job."
  },
  "listFineTuneEvents": {
    "comment": "Get fine-grained status updates for a fine-tune job.",
    "doc": "Get fine-grained status updates for a fine-tune job."
  },
  "createImageEdit": {
    "comment": "Creates an edited or extended image given an original image and a prompt.",
    "doc": "Creates an edited or extended image given an original image and a prompt."
  },
  "createImage": {
    "comment": "Creates an image given a prompt.",
    "doc": "Creates an image given a prompt."
  },
  "createImageVariation": {
    "comment": "Creates a variation of a given image.",
    "doc": "Creates a variation of a given image."
  },
  "listModels": {
    "comment": "Lists the currently available models, and provides basic information about each one such as the owner and availability.",
    "doc": "Lists the currently available models, and provides basic information about each one such as the owner and availability."
  },
  "deleteModel": {
    "comment": "Delete a fine-tuned model. You must have the Owner role in your organization.",
    "doc": "Delete a fine-tuned model. You must have the Owner role in your organization."
  },
  "retrieveModel": {
    "comment": "Retrieves a model instance, providing basic information about the model such as the owner and permissioning.",
    "doc": "Retrieves a model instance, providing basic information about the model such as the owner and permissioning."
  },
  "createModeration": {
    "comment": "Classifies if text violates OpenAI's Content Policy",
    "doc": "Classifies if text violates OpenAI's Content Policy"
  }
}