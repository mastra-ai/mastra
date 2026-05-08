### 13.6 Lifecycle and deployment

Mastra Server takes responsibility for `init` and `shutdown`. Consumers don't call `harness.init()` directly when running under the server — `mastra.init()` does it.

The eviction policy (§5.4) applies normally. Sessions that haven't been touched over their idle timeout are flushed and dropped from memory; subsequent SDK calls hydrate them transparently from storage. Clients see no difference.

For zero-downtime deploys, drain the server before shutdown: stop accepting new connections, let in-flight turns settle (with a timeout), then call `mastra.shutdown()`. Sessions persist; clients reconnect to the new server instance and resume.
