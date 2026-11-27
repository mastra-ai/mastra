---
'@mastra/playground-ui': patch
---

Improved `ModelPicker` with large catalogs. Past 200 models, the unfiltered list shows each provider's newest models (and a single provider's newest 200) instead of rendering every row, which froze the picker on catalogs with thousands of models. The selected and default models always stay listed. Picking a provider lists all its models, and search still reaches every model: a model's exact ID, alone or as `provider/model`, lists it first. When more providers are connected than fit in the filter row, the providers with the newest models are kept, along with the selected and default models' providers.
