---
'@mastra/factory': patch
---

Fixed the project feed event stream leaving every delivered event unacknowledged. On durable pub/sub backends such as Redis Streams, unacknowledged deliveries pile up in the broker's pending list and the client's in-flight tracking for as long as a feed connection stays open, growing memory with every feed update on long-lived dashboard tabs. Feed deliveries are now acknowledged as soon as they are handled.
