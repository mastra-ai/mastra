---
'@mastra/playground-ui': patch
---

Improved the span details panel in Studio traces so each span says what it did before showing its raw payloads.

**Summary**

- Each nested span opens with a one-sentence summary naming the agent, model, tool or processor involved, for example "gpt-5-mini called weatherInfo, then wrote the answer" or "Moderation left the system prompt and the conversation unchanged". Its color matches the result.
- A failed span, root included, shows its error once, in that summary at the top of the panel.
- The root span skips the summary unless the run failed or was stopped, since its input and output already say what happened.

**Section order**

- Every span reads in the same order: what it changed, its input, its output, then its tools, metadata and attributes.
- Memory, workspace, skill and processor spans show what they changed inside the summary.

**Tool calls**

- A model span that called tools lists those calls in its summary. Each call opens on its input and result, like in the chat.
- The tools that were available stay listed next to the calls.

**Processor spans**

- Phase, executor, pipeline position, hook duration and tripwire (full reason, retry and metadata) appear as labelled values right under the summary, like the model facts of a model span.
- A processor that edits the system prompt shows exactly which system messages it added or removed.
- A processor that failed or tripped a tripwire still shows the changes it made before stopping.

**JSON views**

- Metadata and attributes are folded by default at the end of every span.
- JSON is no longer clipped behind an Expand button: it opens with each top-level value folded, so the keys are visible at a glance.
- An output with nothing to preview, like a model step that only called tools, goes straight to its JSON.
- The Preview, JSON and copy actions of a section appear when you hover or focus it.

**`SpanProcessorAttributes` changes**

`SpanProcessorAttributes` now renders only the processor's labelled values, with no section frame, and accepts a `className`. Message-list changes moved to the new `SpanProcessorMutations` component, so render it next to `SpanProcessorAttributes` if you showed those changes.

Before:

```tsx
<SpanProcessorAttributes span={span} />
```

After:

```tsx
<SpanProcessorAttributes span={span} className="mb-4" />
<SpanProcessorMutations span={span} />
```
