---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed reconnecting to a run on an agent created with `new Agent({ durable: { executionEngine } })`. After another worker took over the run, the observe endpoint could send output from the execution that lost it and end the stream early. It now drops that output, the same way it already did for `createDurableAgent` agents. Inngest agents keep reading their own stream.
