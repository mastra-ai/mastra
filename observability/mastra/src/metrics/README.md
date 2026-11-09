# Embedded Pricing Model

This directory contains the pricing snapshot used by `@mastra/observability` for runtime cost estimation.

## Source of Truth

Prices come from [models.dev](https://models.dev) (`https://models.dev/api.json`), the same catalog the model router in `@mastra/core` uses.

- `pricing-data.json` is the models.dev catalog with only each model's `cost` kept, in the models.dev shape. `scripts/generate-pricing.ts` writes it. The "Regenerate Providers & Docs" workflow runs the script every 6 hours and commits changes with an `@mastra/observability` changeset.
- At runtime, `PricingRegistry.getGlobal()` uses this snapshot. Refresh uses the same switches as the model router's auto-refresh: on by default only under `mastra dev` (`MASTRA_DEV=true`), on elsewhere with `MASTRA_AUTO_REFRESH_PRICING=true`, and off with `MASTRA_AUTO_REFRESH_PRICING=false` or `MASTRA_OFFLINE=true`. When refresh is on, the registry starts from the copy cached in `~/.cache/mastra/pricing-data.json` and refreshes from models.dev in the background once a day and when a model has no price. Bump `CACHE_VERSION` in `pricing-registry.ts` when the cached prices change shape or meaning.
- A model with a missing or wrong price is fixed upstream, with a pull request to [models.dev](https://github.com/anomalyco/models.dev). Do not hand-edit `pricing-data.json`.

models.dev data is MIT licensed, Copyright (c) 2025 models.dev.

## Example

models.dev prices are in USD per 1M tokens:

```json
{
  "google": {
    "models": {
      "gemini-2.5-pro": {
        "cost": {
          "input": 1.25,
          "output": 10,
          "cache_read": 0.125,
          "tiers": [{ "input": 2.5, "output": 15, "cache_read": 0.25, "tier": { "type": "context", "size": 200000 } }]
        }
      }
    }
  }
}
```

## How Prices Are Read

`models-dev.ts` turns each model's `cost` into a `PricingModel`:

- `input`, `output`, `cache_read`, `cache_write`, `input_audio`, `output_audio` and `reasoning` become per-token rates for the matching meters
- context `tiers` apply when `total_input_tokens >= <tier size>`, highest threshold first
- zero prices are dropped, and models without both an input and an output price are skipped (embedding-only and other input-only models)
- Claude models also get 5-minute and 1-hour cache write rates: models.dev lists the 5-minute rate, and 1-hour writes cost 1.6x that
- each model is found by its own id, and by an alias with region, vendor, version and date parts stripped when no other model owns that alias
- `pricing_id` in cost metadata is the models.dev `provider/model` id the price came from

## Runtime Assumptions

- match by `provider + model`, trying the lookup variants in `pricing-registry.ts`
- use the default tier unless a prompt-threshold condition matches
- compute cost on the existing token-related metric rows
- persist `estimatedCost`, `costUnit`, and optional costing metadata on those rows
- when pricing lookup fails, attach the same costing error metadata to the token
  metric rows that will actually be emitted for the reported usage payload
- preserve explicitly reported zero-value total token rows with `estimatedCost: 0`
