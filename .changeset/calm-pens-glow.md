---
'@mastra/factory': minor
---

Added model packs to the Factory UI. A model pack is a named list of up to 4 models, each with its own thinking level. The first model runs the session, and the others are fallbacks, tried in order when it can't answer. Under Settings → Models, a Factory or a person can keep up to 8 packs and mark one as the default. Packs can be created, edited, reordered, deleted, or made the default there.

The chat model picker lists the packs above the models. It marks the session's active pack with a check and shows the pack's name on the trigger. Picking a pack switches the session to its first model and thinking level. In a new draft, the picked pack is applied as soon as the session starts. When a run switches to a fallback, the reply shows one muted line such as `Claude Opus 5.5 → GPT-5.6 Sol`.

Every model picker in settings, including the Observer and Reflector models, now only saves a `provider/model` ID such as `anthropic/claude-opus-5.5`. Before, a search typed into a model picker and submitted with Enter, such as `sonnet 5.5`, was saved as the model ID.
