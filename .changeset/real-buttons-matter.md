---
'@mastra/mongodb': patch
---

Fixed the type of `documentFilter` on `MongoDBVector.query()`. It is applied to the single `document` field, so it now accepts a condition such as `{ $regex: /astronaut/ }` or a plain value. Previously it was typed as a whole filter, which rejected those correct calls and accepted a field-map shape that produced a query against a field inside the document text.
