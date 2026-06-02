---
'mastra': patch
---

Agent Builder errors are now much friendlier and easier to recover from. When a build run hits a transient or terminal stream error, the chat shows a clear, human-readable error banner instead of a wall of raw JSON, with the full payload tucked behind a Details toggle. The "Reasoning…" indicator stays visible during retry pauses so the chat no longer looks frozen between steps, and a new Try again button on the error banner resubmits your last prompt against the same conversation in one click.

Agent Builder is also better at writing complete, in-budget system prompts on the first try. Builder-generated instructions have a hard 4,000 character limit; over-limit drafts are rejected instead of silently clipped, so the agent never ships a half-truncated prompt. The builder is also coached to plan and count before submitting, which cuts down the number of rewrites needed.
