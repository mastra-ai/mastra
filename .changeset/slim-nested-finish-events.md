---
'@mastra/core': patch
---

Fixed evented workflows publishing the entire run state on every `workflows-finish` event. Nested runs (such as each durable agent loop iteration) used to send their full step history, state and parent workflow history with every finish event, so a single event could reach 5–10 MB. Brokers like Redis Streams then filled up quickly, and every subscriber had to parse each event. Finish events from nested runs now only include the run's identity, its outcome and the ancestor ids. Top-level runs still include the step results and state that `run.start()` and `run.resume()` return.
