export const comments = {
  createChatCompletion: {
    comment: 'Creates a model response for the given chat conversation.',
    doc: 'Creates a model response for the given chat conversation.',
  },
  createCompletion: {
    comment: 'Creates a completion for the provided prompt and parameters.',
    doc: 'Creates a completion for the provided prompt and parameters.',
  },
  createImage: {
    comment: 'Creates an image given a prompt.',
    doc: 'Creates an image given a prompt.',
  },
  createImageEdit: {
    comment: 'Creates an edited or extended image given an original image and a prompt.',
    doc: 'Creates an edited or extended image given an original image and a prompt.',
  },
  createImageVariation: {
    comment: 'Creates a variation of a given image.',
    doc: 'Creates a variation of a given image.',
  },
  createEmbedding: {
    comment: 'Creates an embedding vector representing the input text.',
    doc: 'Creates an embedding vector representing the input text.',
  },
  createSpeech: {
    comment: 'Generates audio from the input text.',
    doc: 'Generates audio from the input text.',
  },
  createTranscription: {
    comment: 'Transcribes audio into the input language.',
    doc: 'Transcribes audio into the input language.',
  },
  createTranslation: {
    comment: 'Translates audio into English.',
    doc: 'Translates audio into English.',
  },
  listFiles: {
    comment: "Returns a list of files that belong to the user's organization.",
    doc: "Returns a list of files that belong to the user's organization.",
  },
  createFile: {
    comment:
      'Upload a file that can be used across various endpoints. Individual files can be up to 512 MB, and the size of all files uploaded by one organization can be up to 100 GB.',
    doc: 'Upload a file that can be used across various endpoints. Individual files can be up to 512 MB, and the size of all files uploaded by one organization can be up to 100 GB.\n \n  The Assistants API supports files up to 2 million tokens and of specific file types. See the [Assistants Tools guide](/docs/assistants/tools) for details.\n \n  The Fine-tuning API only supports `.jsonl` files. The input also has certain required formats for fine-tuning [chat](/docs/api-reference/fine-tuning/chat-input) or [completions](/docs/api-reference/fine-tuning/completions-input) models.\n \n  The Batch API only supports `.jsonl` files up to 100 MB in size. The input also has a specific required [format](/docs/api-reference/batch/request-input).\n \n  Please [contact us](https://help.openai.com/) if you need to increase these storage limits.',
  },
  deleteFile: {
    comment: 'Delete a file.',
    doc: 'Delete a file.',
  },
  retrieveFile: {
    comment: 'Returns information about a specific file.',
    doc: 'Returns information about a specific file.',
  },
  downloadFile: {
    comment: 'Returns the contents of the specified file.',
    doc: 'Returns the contents of the specified file.',
  },
  createUpload: {
    comment:
      'Creates an intermediate [Upload](/docs/api-reference/uploads/object) object that you can add [Parts](/docs/api-reference/uploads/part-object) to. Currently, an Upload can accept at most 8 GB in total and expires after an hour after you create it.',
    doc: 'Creates an intermediate [Upload](/docs/api-reference/uploads/object) object that you can add [Parts](/docs/api-reference/uploads/part-object) to. Currently, an Upload can accept at most 8 GB in total and expires after an hour after you create it.\n \n  Once you complete the Upload, we will create a [File](/docs/api-reference/files/object) object that contains all the parts you uploaded. This File is usable in the rest of our platform as a regular File object.\n \n  For certain `purpose`s, the correct `mime_type` must be specified. Please refer to documentation for the supported MIME types for your use case:\n  - [Assistants](/docs/assistants/tools/file-search/supported-files)\n \n  For guidance on the proper filename extensions for each purpose, please follow the documentation on [creating a File](/docs/api-reference/files/create).',
  },
  addUploadPart: {
    comment:
      'Adds a [Part](/docs/api-reference/uploads/part-object) to an [Upload](/docs/api-reference/uploads/object) object. A Part represents a chunk of bytes from the file you are trying to upload.',
    doc: 'Adds a [Part](/docs/api-reference/uploads/part-object) to an [Upload](/docs/api-reference/uploads/object) object. A Part represents a chunk of bytes from the file you are trying to upload.\n \n  Each Part can be at most 64 MB, and you can add Parts until you hit the Upload maximum of 8 GB.\n \n  It is possible to add multiple Parts in parallel. You can decide the intended order of the Parts when you [complete the Upload](/docs/api-reference/uploads/complete).',
  },
  completeUpload: {
    comment: 'Completes the [Upload](/docs/api-reference/uploads/object).',
    doc: 'Completes the [Upload](/docs/api-reference/uploads/object).\n \n  Within the returned Upload object, there is a nested [File](/docs/api-reference/files/object) object that is ready to use in the rest of the platform.\n \n  You can specify the order of the Parts by passing in an ordered list of the Part IDs.\n \n  The number of bytes uploaded upon completion must match the number of bytes initially specified when creating the Upload object. No Parts may be added after an Upload is completed.',
  },
  cancelUpload: {
    comment: 'Cancels the Upload. No Parts may be added after an Upload is cancelled.',
    doc: 'Cancels the Upload. No Parts may be added after an Upload is cancelled.',
  },
  createFineTuningJob: {
    comment: 'Creates a fine-tuning job which begins the process of creating a new model from a given dataset.',
    doc: 'Creates a fine-tuning job which begins the process of creating a new model from a given dataset.\n \n  Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.\n \n  [Learn more about fine-tuning](/docs/guides/fine-tuning)',
  },
  listPaginatedFineTuningJobs: {
    comment: "List your organization's fine-tuning jobs",
    doc: "List your organization's fine-tuning jobs",
  },
  retrieveFineTuningJob: {
    comment: 'Get info about a fine-tuning job.',
    doc: 'Get info about a fine-tuning job.\n \n  [Learn more about fine-tuning](/docs/guides/fine-tuning)',
  },
  listFineTuningEvents: {
    comment: 'Get status updates for a fine-tuning job.',
    doc: 'Get status updates for a fine-tuning job.',
  },
  cancelFineTuningJob: {
    comment: 'Immediately cancel a fine-tune job.',
    doc: 'Immediately cancel a fine-tune job.',
  },
  listFineTuningJobCheckpoints: {
    comment: 'List checkpoints for a fine-tuning job.',
    doc: 'List checkpoints for a fine-tuning job.',
  },
  listModels: {
    comment:
      'Lists the currently available models, and provides basic information about each one such as the owner and availability.',
    doc: 'Lists the currently available models, and provides basic information about each one such as the owner and availability.',
  },
  retrieveModel: {
    comment:
      'Retrieves a model instance, providing basic information about the model such as the owner and permissioning.',
    doc: 'Retrieves a model instance, providing basic information about the model such as the owner and permissioning.',
  },
  deleteModel: {
    comment: 'Delete a fine-tuned model. You must have the Owner role in your organization to delete a model.',
    doc: 'Delete a fine-tuned model. You must have the Owner role in your organization to delete a model.',
  },
  createModeration: {
    comment: 'Classifies if text is potentially harmful.',
    doc: 'Classifies if text is potentially harmful.',
  },
  listAssistants: {
    comment: 'Returns a list of assistants.',
    doc: 'Returns a list of assistants.',
  },
  createAssistant: {
    comment: 'Create an assistant with a model and instructions.',
    doc: 'Create an assistant with a model and instructions.',
  },
  getAssistant: {
    comment: 'Retrieves an assistant.',
    doc: 'Retrieves an assistant.',
  },
  modifyAssistant: {
    comment: 'Modifies an assistant.',
    doc: 'Modifies an assistant.',
  },
  deleteAssistant: {
    comment: 'Delete an assistant.',
    doc: 'Delete an assistant.',
  },
  createThread: {
    comment: 'Create a thread.',
    doc: 'Create a thread.',
  },
  getThread: {
    comment: 'Retrieves a thread.',
    doc: 'Retrieves a thread.',
  },
  modifyThread: {
    comment: 'Modifies a thread.',
    doc: 'Modifies a thread.',
  },
  deleteThread: {
    comment: 'Delete a thread.',
    doc: 'Delete a thread.',
  },
  listMessages: {
    comment: 'Returns a list of messages for a given thread.',
    doc: 'Returns a list of messages for a given thread.',
  },
  createMessage: {
    comment: 'Create a message.',
    doc: 'Create a message.',
  },
  getMessage: {
    comment: 'Retrieve a message.',
    doc: 'Retrieve a message.',
  },
  modifyMessage: {
    comment: 'Modifies a message.',
    doc: 'Modifies a message.',
  },
  deleteMessage: {
    comment: 'Deletes a message.',
    doc: 'Deletes a message.',
  },
  createThreadAndRun: {
    comment: 'Create a thread and run it in one request.',
    doc: 'Create a thread and run it in one request.',
  },
  listRuns: {
    comment: 'Returns a list of runs belonging to a thread.',
    doc: 'Returns a list of runs belonging to a thread.',
  },
  createRun: {
    comment: 'Create a run.',
    doc: 'Create a run.',
  },
  getRun: {
    comment: 'Retrieves a run.',
    doc: 'Retrieves a run.',
  },
  modifyRun: {
    comment: 'Modifies a run.',
    doc: 'Modifies a run.',
  },
  submitToolOuputsToRun: {
    comment:
      'When a run has the `status: "requires_action"` and `required_action.type` is `submit_tool_outputs`, this endpoint can be used to submit the outputs from the tool calls once they\'re all completed. All outputs must be submitted in a single request.',
    doc: 'When a run has the `status: "requires_action"` and `required_action.type` is `submit_tool_outputs`, this endpoint can be used to submit the outputs from the tool calls once they\'re all completed. All outputs must be submitted in a single request.',
  },
  cancelRun: {
    comment: 'Cancels a run that is `in_progress`.',
    doc: 'Cancels a run that is `in_progress`.',
  },
  listRunSteps: {
    comment: 'Returns a list of run steps belonging to a run.',
    doc: 'Returns a list of run steps belonging to a run.',
  },
  getRunStep: {
    comment: 'Retrieves a run step.',
    doc: 'Retrieves a run step.',
  },
  listVectorStores: {
    comment: 'Returns a list of vector stores.',
    doc: 'Returns a list of vector stores.',
  },
  createVectorStore: {
    comment: 'Create a vector store.',
    doc: 'Create a vector store.',
  },
  getVectorStore: {
    comment: 'Retrieves a vector store.',
    doc: 'Retrieves a vector store.',
  },
  modifyVectorStore: {
    comment: 'Modifies a vector store.',
    doc: 'Modifies a vector store.',
  },
  deleteVectorStore: {
    comment: 'Delete a vector store.',
    doc: 'Delete a vector store.',
  },
  listVectorStoreFiles: {
    comment: 'Returns a list of vector store files.',
    doc: 'Returns a list of vector store files.',
  },
  createVectorStoreFile: {
    comment:
      'Create a vector store file by attaching a [File](/docs/api-reference/files) to a [vector store](/docs/api-reference/vector-stores/object).',
    doc: 'Create a vector store file by attaching a [File](/docs/api-reference/files) to a [vector store](/docs/api-reference/vector-stores/object).',
  },
  getVectorStoreFile: {
    comment: 'Retrieves a vector store file.',
    doc: 'Retrieves a vector store file.',
  },
  deleteVectorStoreFile: {
    comment:
      'Delete a vector store file. This will remove the file from the vector store but the file itself will not be deleted. To delete the file, use the [delete file](/docs/api-reference/files/delete) endpoint.',
    doc: 'Delete a vector store file. This will remove the file from the vector store but the file itself will not be deleted. To delete the file, use the [delete file](/docs/api-reference/files/delete) endpoint.',
  },
  createVectorStoreFileBatch: {
    comment: 'Create a vector store file batch.',
    doc: 'Create a vector store file batch.',
  },
  getVectorStoreFileBatch: {
    comment: 'Retrieves a vector store file batch.',
    doc: 'Retrieves a vector store file batch.',
  },
  cancelVectorStoreFileBatch: {
    comment:
      'Cancel a vector store file batch. This attempts to cancel the processing of files in this batch as soon as possible.',
    doc: 'Cancel a vector store file batch. This attempts to cancel the processing of files in this batch as soon as possible.',
  },
  listFilesInVectorStoreBatch: {
    comment: 'Returns a list of vector store files in a batch.',
    doc: 'Returns a list of vector store files in a batch.',
  },
  createBatch: {
    comment: 'Creates and executes a batch from an uploaded file of requests',
    doc: 'Creates and executes a batch from an uploaded file of requests',
  },
  listBatches: {
    comment: "List your organization's batches.",
    doc: "List your organization's batches.",
  },
  retrieveBatch: {
    comment: 'Retrieves a batch.',
    doc: 'Retrieves a batch.',
  },
  cancelBatch: {
    comment:
      'Cancels an in-progress batch. The batch will be in status `cancelling` for up to 10 minutes, before changing to `cancelled`, where it will have partial results (if any) available in the output file.',
    doc: 'Cancels an in-progress batch. The batch will be in status `cancelling` for up to 10 minutes, before changing to `cancelled`, where it will have partial results (if any) available in the output file.',
  },
  listAuditLogs: {
    comment: 'List user actions and configuration changes within this organization.',
    doc: 'List user actions and configuration changes within this organization.',
  },
  listInvites: {
    comment: 'Returns a list of invites in the organization.',
    doc: 'Returns a list of invites in the organization.',
  },
  inviteUser: {
    comment:
      'Create an invite for a user to the organization. The invite must be accepted by the user before they have access to the organization.',
    doc: 'Create an invite for a user to the organization. The invite must be accepted by the user before they have access to the organization.',
  },
  retrieveInvite: {
    comment: 'Retrieves an invite.',
    doc: 'Retrieves an invite.',
  },
  deleteInvite: {
    comment: 'Delete an invite. If the invite has already been accepted, it cannot be deleted.',
    doc: 'Delete an invite. If the invite has already been accepted, it cannot be deleted.',
  },
  listUsers: {
    comment: 'Lists all of the users in the organization.',
    doc: 'Lists all of the users in the organization.',
  },
  retrieveUser: {
    comment: 'Retrieves a user by their identifier.',
    doc: 'Retrieves a user by their identifier.',
  },
  modifyUser: {
    comment: "Modifies a user's role in the organization.",
    doc: "Modifies a user's role in the organization.",
  },
  deleteUser: {
    comment: 'Deletes a user from the organization.',
    doc: 'Deletes a user from the organization.',
  },
  listProjects: {
    comment: 'Returns a list of projects.',
    doc: 'Returns a list of projects.',
  },
  createProject: {
    comment: 'Create a new project in the organization. Projects can be created and archived, but cannot be deleted.',
    doc: 'Create a new project in the organization. Projects can be created and archived, but cannot be deleted.',
  },
  retrieveProject: {
    comment: 'Retrieves a project.',
    doc: 'Retrieves a project.',
  },
  modifyProject: {
    comment: 'Modifies a project in the organization.',
    doc: 'Modifies a project in the organization.',
  },
  archiveProject: {
    comment: 'Archives a project in the organization. Archived projects cannot be used or updated.',
    doc: 'Archives a project in the organization. Archived projects cannot be used or updated.',
  },
  listProjectUsers: {
    comment: 'Returns a list of users in the project.',
    doc: 'Returns a list of users in the project.',
  },
  createProjectUser: {
    comment: 'Adds a user to the project. Users must already be members of the organization to be added to a project.',
    doc: 'Adds a user to the project. Users must already be members of the organization to be added to a project.',
  },
  retrieveProjectUser: {
    comment: 'Retrieves a user in the project.',
    doc: 'Retrieves a user in the project.',
  },
  modifyProjectUser: {
    comment: "Modifies a user's role in the project.",
    doc: "Modifies a user's role in the project.",
  },
  deleteProjectUser: {
    comment: 'Deletes a user from the project.',
    doc: 'Deletes a user from the project.',
  },
  listProjectServiceAccounts: {
    comment: 'Returns a list of service accounts in the project.',
    doc: 'Returns a list of service accounts in the project.',
  },
  createProjectServiceAccount: {
    comment:
      'Creates a new service account in the project. This also returns an unredacted API key for the service account.',
    doc: 'Creates a new service account in the project. This also returns an unredacted API key for the service account.',
  },
  retrieveProjectServiceAccount: {
    comment: 'Retrieves a service account in the project.',
    doc: 'Retrieves a service account in the project.',
  },
  deleteProjectServiceAccount: {
    comment: 'Deletes a service account from the project.',
    doc: 'Deletes a service account from the project.',
  },
  listProjectApiKeys: {
    comment: 'Returns a list of API keys in the project.',
    doc: 'Returns a list of API keys in the project.',
  },
  retrieveProjectApiKey: {
    comment: 'Retrieves an API key in the project.',
    doc: 'Retrieves an API key in the project.',
  },
  deleteProjectApiKey: {
    comment: 'Deletes an API key from the project.',
    doc: 'Deletes an API key from the project.',
  },
};
