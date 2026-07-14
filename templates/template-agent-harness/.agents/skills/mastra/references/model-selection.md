# Model Selection Reference

Use this reference when choosing or validating Mastra model strings.

## Model format

Always use `"provider/model-name"` when defining models with Mastra's model router.

## Verify provider keys and model names

Use the provider registry script to look up available providers and models:

```bash
# List all available providers
node scripts/provider-registry.mjs --list

# List all models for a specific provider, sorted newest first
node scripts/provider-registry.mjs --provider openai
node scripts/provider-registry.mjs --provider anthropic
```

When the user asks to use a model or provider, run the script first to verify the provider key and model name are valid. Do not guess model names from memory because they change frequently.

If you need examples in a new-project scaffold, see [`create-mastra.md`](create-mastra.md), then verify the chosen model with the provider registry script.
