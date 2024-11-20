export const comments = {
  "createMessage": {
    "comment": "Create a Message",
    "doc": "Create a Message\n  Send a structured list of input messages with text and/or image content, and the\n  model will generate the next message in the conversation.\n \n  The Messages API can be used for either single queries or stateless multi-turn\n  conversations."
  },
  "createMessageBatch": {
    "comment": "Create a Message Batch",
    "doc": "Create a Message Batch\n  Send a batch of Message creation requests."
  },
  "retrieveMessageBatch": {
    "comment": "Retrieve a Message Batch",
    "doc": "Retrieve a Message Batch\n  This endpoint is idempotent and can be used to poll for Message Batch\n  completion. To access the results of a Message Batch, make a request to the\n  `results_url` field in the response."
  }
}