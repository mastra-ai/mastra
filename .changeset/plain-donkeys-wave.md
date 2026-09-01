---
'@mastra/factory': minor
---

Approving a proposed run now happens in the attention inbox instead of sending someone to the Rules page.

**A queue of proposals is a handful of decisions repeated, not a list of distinct ones.** A rules engine proposes the same run for every card it matches, so fifty rows reading `invokeSkill · triage` said nothing that "32 triage runs" does not. The queue sits grouped by role in a panel above the timeline, collapsed, one line per shape; expanding a group names the work item each proposal is for, so a row finally says what it would start. The banner that only counted the queue is gone, and the sidebar popover's approval link opens the inbox.

**A group can be dismissed whole**, behind a confirm step — the way out of a queue nobody wants. There is deliberately no matching "run all": that would bill dozens of agent runs from one click, with no bulk route to make it atomic.

**The queue says how much of itself it is showing.** The count in the header is the true pending total; when more proposals exist than one page holds, the panel says how many of them loaded, and the per-group "oldest" timestamp is dropped rather than reporting the oldest of a partial page as the oldest of the queue.

**An attention row says what landed as a badge** — `mention`, `comment`, `failed` — carrying the icon of its kind and dimming once read, instead of a coloured bead beside a sentence fragment, with the card as the row's title and the author ahead of the message. The sidebar popover scrolls through its preview again: its list had been capped by the popover's own height rather than the scroller's, which left the scroller measuring no overflow and the popover clipping the rows it could not show.

**The Rules page holds only what nothing else shows** now that failures and approvals both land in attention — the full effect lifecycle, decisions with no work item, and the succeeded/dismissed history — so it leaves the Factory navigation and is reached from an attention row or global search.
