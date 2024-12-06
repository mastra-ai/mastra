export const comments = {
  createDocument: {
    comment: 'Create Document',
    doc: 'Create Document\n  On ingest, the document goes through a series of steps before it is ready for retrieval. Each step is reflected in the status of the document which can be one of [`pending`, `partitioning`, `partitioned`, `refined`, `chunked`, `indexed`, `summary_indexed`, `ready`, `failed`]. The document is available for retrieval once it is in ready state. The summary index step can take a few seconds. You can optionally use the document for retrieval once it is in `indexed` state. However the summary will only be available once the state has changed to `summary_indexed` or `ready`.',
  },
  listDocuments: {
    comment: 'List Documents',
    doc: 'List Documents\n  List all documents sorted by created_at in descending order. Results are paginated with a max limit of 100. When more documents are available, a `cursor` will be provided. Use the `cursor` parameter to retrieve the subsequent page.',
  },
  createDocumentRaw: {
    comment: 'Create Document Raw',
    doc: 'Create Document Raw\n  Ingest a document as raw text. On ingest, the document goes through a series of steps before it is ready for retrieval. Each step is reflected in the status of the document which can be one of [`pending`, `partitioning`, `partitioned`, `refined`, `chunked`, `indexed`, `summary_indexed`, `ready`, `failed`]. The document is available for retrieval once it is in ready state. The summary index step can take a few seconds. You can optionally use the document for retrieval once it is in `indexed` state. However the summary will only be available once the state has changed to `summary_indexed` or `ready`.',
  },
  createDocumentFromUrl: {
    comment: 'Create Document From Url',
    doc: 'Create Document From Url',
  },
  getDocument: {
    comment: 'Get Document',
    doc: 'Get Document',
  },
  deleteDocument: {
    comment: 'Delete Document',
    doc: 'Delete Document',
  },
  updateDocumentFile: {
    comment: 'Update Document File',
    doc: 'Update Document File',
  },
  updateDocumentRaw: {
    comment: 'Update Document Raw',
    doc: 'Update Document Raw',
  },
  patchDocumentMetadata: {
    comment: 'Patch Document Metadata',
    doc: 'Patch Document Metadata',
  },
  retrieve: {
    comment: 'Retrieve',
    doc: 'Retrieve',
  },
  getDocumentSummary: {
    comment: 'Get Document Summary',
    doc: "Get Document Summary\n  Get a LLM generated summary of the document. The summary is created when the document is first created or updated. Documents of types ['xls', 'xlsx', 'csv', 'json'] are not supported for summarization. Documents greater than 1M in token length are not supported. This feature is in beta and may change in the future.",
  },
  listInstructions: {
    comment: 'List Instructions',
    doc: 'List Instructions\n  List all instructions.',
  },
  createInstruction: {
    comment: 'Create Instruction',
    doc: 'Create Instruction\n  Create a new instruction. Instructions are applied to documents as they are created or updated. The results of the instruction are stored as structured data in the schema defined by the `entity_schema` parameter. The `prompt` parameter is a natural language instruction which will be applied to documents. This feature is in beta and may change in the future.',
  },
  updateInstruction: {
    comment: 'Update Instruction',
    doc: 'Update Instruction',
  },
  listEntitiesByInstruction: {
    comment: 'Get Instruction Extracted Entities',
    doc: 'Get Instruction Extracted Entities',
  },
  listEntitiesByDocument: {
    comment: 'Get Document Extracted Entities',
    doc: 'Get Document Extracted Entities',
  },
  listConnectionsConnectionsGet: {
    comment: 'List Connections',
    doc: 'List Connections\n  List all connections sorted by created_at in descending order. Results are paginated with a max limit of 100. When more documents are available, a `cursor` will be provided. Use the `cursor` parameter to retrieve the subsequent page.',
  },
  setConnectionEnabledConnectionsConnectionIdEnabledPut: {
    comment: 'Set Connection Enabled',
    doc: "Set Connection Enabled\n  Enable or disable the connection. A disabled connection won't sync.",
  },
  updateConnectionConnectionsConnectionIdPut: {
    comment: 'Update Connection',
    doc: 'Update Connection\n  Updates a connections metadata or mode. These changes will be seen after the next sync.',
  },
  getConnectionStatsConnectionsConnectionIdStatsGet: {
    comment: 'Get Connection Stats',
    doc: 'Get Connection Stats\n  Lists connection stats: total documents synced.',
  },
  deleteConnectionConnectionsConnectionIdDeletePost: {
    comment: 'Delete Connection',
    doc: 'Delete Connection\n  Schedules a connection to be deleted. You can choose to keep the files from the connection or delete them all. If you keep the files, they will no longer be associated to the connection. Deleting can take some time, so you will still see files for a bit after this is called.',
  },
};
