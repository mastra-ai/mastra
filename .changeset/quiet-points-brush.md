---
'@mastra/mongodb': patch
---

Fix MongoDB connection string parameter naming inconsistency. MongoDBVector now uses uri parameter (correct MongoDB terminology). MongoDBStore now accepts both uri (recommended) and url (deprecated, for backward compatibility). Added clear error messages when connection string is missing.
