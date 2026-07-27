---
'@mastra/core': patch
---

Keep deprecated provider models in the model registry instead of dropping them

The models.dev gateway filtered out every model marked `status: 'deprecated'` upstream. That status means "still served, scheduled for retirement" rather than "removed", so filtering it silently degraded models that still work.

A dropped model lost its capability data: `modelSupportsAttachments`, `modelSupportsTemperature`, and `modelSupportsStructuredOutput` return `false` for a model that is missing from a known provider's capability file, rather than `undefined`. A model that genuinely supports attachments therefore reported that it does not. Dropped models also lost their per-model endpoint/shape/SDK overrides, so a model that needs a non-default endpoint or SDK routed with provider defaults instead. They also disappeared from the generated model-id union used for editor autocomplete, and from any surface that lists a provider's models.

Deprecated models are now retained in `models`, in the generated types, and in the capability and override data. They are additionally reported through a new optional `deprecatedModels` field on `ProviderConfig`, so surfaces that offer models for new selection can hide or mark them.
