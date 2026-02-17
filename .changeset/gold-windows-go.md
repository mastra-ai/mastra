---
'@mastra/mongodb': patch
---

MongoDBStorage.saveMessages() overwrites the createdAt field every time a message is upserted, even for existing messages. This causes message ordering to break when messages are recalled via memory.recall(), which sorts by createdAt.
