---
'@mastra/client-js': patch
---

Stop reporting successful responses as client failures when the response body is empty or is not JSON. A `204 No Content`, a `205 Reset Content`, and any empty `2xx` body now resolve to `undefined` instead of throwing a JSON parse error, so a `DELETE` that the server completed is no longer repeated and then rejected. A request the server already accepted is no longer retried when its body fails to parse: the parse error surfaces once, instead of sending the same state-changing request again.
