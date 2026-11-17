---
'@mastra/server': patch
---

Reduced memory and CPU use when clients stream agent controller sessions. Each display-state update is now copied and serialized once and shared by every client of the session, instead of once per client, and the copy no longer duplicates message text or tool results. Display state is now serialized the same way as other stream events, so the bytes change for three kinds of value: an object with a `toJSON` method is sent as that method's result, an error keeps its own enumerable fields such as `statusCode`, and a value that cannot be cloned, such as a function, is left out and no longer closes the stream.
