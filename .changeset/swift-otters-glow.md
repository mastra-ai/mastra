---
'mastra': patch
---

Agent Builder errors are friendlier and easier to recover from. On a stream error, the chat shows a readable error banner instead of raw JSON, with the full payload behind a Details toggle. The "Reasoning…" indicator stays visible during retry pauses, and a new Try again button resubmits your last prompt in the same conversation.

Agent Builder also writes complete, in-budget system prompts more reliably. Builder-generated instructions have a hard 4,000-character limit; over-limit drafts are rejected instead of silently clipped, so the agent never ships a half-truncated prompt.
