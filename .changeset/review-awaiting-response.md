---
'@mastra/factory': minor
---

Agents in a user session can now find Work items whose Factory review asked for changes and get them answered. `factory_list_work_items` takes a `review` filter: `changes-requested` lists every such item, and `awaiting-response` lists only those with no push since the review. Each result includes the review verdict, the reviewed and current head SHAs, and the Work session to message, so you can ask "respond to any reviews that haven't been addressed" and the agent messages each Work session with `factory_signal_session`.

A truncated `factory_list_work_items` result now includes `nextCursor`. Pass it back as `cursor`, with the same filters, to list the items after it, so items past the first 50 are reachable.

```ts
factory_list_work_items({ review: "awaiting-response" });
// each item: review.verdict, review.reviewedHeadSha, review.headSha, review.workSessionId
factory_list_work_items({ review: "awaiting-response", cursor: previous.nextCursor });
```
