---
'@mastra/factory': minor
---

A comment mirrored to a chat platform is now a delivery that survives failure, instead of one attempt whose loss nobody hears about.

Every (comment, publisher) pair gets a row in the new `work_item_comment_mirrors` collection, written before the platform is called. The first attempt still happens inline, so the common case is unchanged; when it fails — the platform is down, the process restarts mid-post, a rate limit outlives the request — the row comes due again and a new `CommentMirrorWorker` retries it, backing off from 30s to about 16 minutes before giving up after six attempts.

Deliveries are claimed row by row inside `updateAtomic`, so replicas drain the same queue without posting a comment twice, and a process that dies holding a claim strands nothing: the claim schedules its own retry up front, so the row simply comes due again. There is no worker lease, and no reaper.

The feed says so, too. `WireComment` grows `delivery`, set only while a platform still owes the comment or has given up on it — a delivered comment carries nothing, since silence is the good case. The web feed renders "Sending to Slack…" or "Not delivered to Slack" under the body.

`CommentsDomain` now requires a `mirrors` storage domain; hosts that build it themselves must register `CommentMirrorsStorage`. `createComment`'s `mirrored` promise still resolves after the inline attempt, retries or not.

Inbound is not covered: the Slack adapter acks the webhook before the handler runs, so an `aside` lost to a storage error is never redelivered. That needs the same durability on the way in.
