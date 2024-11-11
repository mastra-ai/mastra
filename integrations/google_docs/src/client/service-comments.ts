export const comments = {
  "docsDocumentsCreate": {
    "comment": "Creates a blank document using the title given in the request. Other fields in the request, including any provided content, are ignored. Returns the created document.",
    "doc": "Creates a blank document using the title given in the request. Other fields in the request, including any provided content, are ignored. Returns the created document."
  },
  "docsDocumentsGet": {
    "comment": "Gets the latest version of the specified document.",
    "doc": "Gets the latest version of the specified document."
  },
  "docsDocumentsBatchUpdate": {
    "comment": "Applies one or more updates to the document. Each request is validated before being applied. If any request is not valid, then the entire request will fail and nothing will be applied. Some requests have replies to give you some information about how they are applied. Other requests do not need to return information; these each return an empty reply. The order of replies matches that of the requests. For example, suppose you call batchUpdate with four updates, and only the third one returns information. The response would have two empty replies, the reply to the third request, and another empty reply, in that order. Because other users may be editing the document, the document might not exactly reflect your changes: your changes may be altered with respect to collaborator changes. If there are no collaborators, the document should reflect your changes. In any case, the updates in your request are guaranteed to be applied together atomically.",
    "doc": "Applies one or more updates to the document. Each request is validated before being applied. If any request is not valid, then the entire request will fail and nothing will be applied. Some requests have replies to give you some information about how they are applied. Other requests do not need to return information; these each return an empty reply. The order of replies matches that of the requests. For example, suppose you call batchUpdate with four updates, and only the third one returns information. The response would have two empty replies, the reply to the third request, and another empty reply, in that order. Because other users may be editing the document, the document might not exactly reflect your changes: your changes may be altered with respect to collaborator changes. If there are no collaborators, the document should reflect your changes. In any case, the updates in your request are guaranteed to be applied together atomically."
  }
}