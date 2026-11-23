---
'@mastra/factory': minor
---

Added fallback models to the Factory UI. Under Settings → Models, a project or a person can list up to 3 fallback models after their default model, and reorder or remove them.

Before: a rate-limited run failed and its card showed a generic failure.
After: the run finishes on a fallback, and the reply shows one muted line with the cause, for example `Claude Opus 5.5 is rate-limited, switched to GPT-5.6 Sol`. Expand it to see that the next message starts on the session model again. The chat model picker marks the session's fallback models with a `Fallback` badge next to `Default`, and updates as soon as the fallbacks change in settings.

When every model is limited, the card says why:

- **Rate limit:** `Model rate-limited. Retrying at 14:05`. Once Factory stops retrying, the card shows `Model still rate-limited` with a Retry button.
- **Out of credits or quota:** `Model out of credits or quota`, with a Retry button.

Every model picker in settings, including the Observer and Reflector models, now only saves a `provider/model` ID such as `anthropic/claude-opus-5.5`. Before, a search typed into a model picker and submitted with Enter, such as `sonnet 5.5`, was saved as the model ID.
