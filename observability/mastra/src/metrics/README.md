# Embedded Pricing Model

This directory contains the pricing snapshot used by `@mastra/observability` for runtime cost estimation.

## Source of Truth

Prices come from [models.dev](https://models.dev) (`https://models.dev/api.json`), the same catalog the model router in `@mastra/core` uses.

- `scripts/generate-pricing.ts` converts the models.dev `cost` data into `pricing-data.jsonl` (see `models-dev.ts`). The "Regenerate Providers & Docs" workflow runs it every 6 hours and commits changes with an `@mastra/observability` changeset.
- At runtime, `PricingRegistry.getGlobal()` starts from the copy cached in `~/.cache/mastra/pricing-data.json`, or from this snapshot, and refreshes from models.dev in the background once a day and when a model has no price. `MASTRA_AUTO_REFRESH_PRICING=false` or `MASTRA_OFFLINE=true` turns the refresh off.
- A model with a missing or wrong price is fixed upstream, with a pull request to [models.dev](https://github.com/anomalyco/models.dev). Do not hand-edit `pricing-data.jsonl`.

models.dev data is MIT licensed, Copyright (c) 2025 models.dev.

## v0 Scope

The embedded data is intentionally narrow:

- one row per canonical `provider + model`
- token pricing only
- base pricing only unless the model has prompt-threshold pricing
- context tiers use `total_input_tokens >= <tier size>`, highest threshold first
- every kept tier includes both input and output token pricing; zero prices are dropped
- models left without both sides are excluded
- embedding-only and other input-only models are excluded

## Minified Row Shape

Each line is a single minified pricing row.

Top-level keys:

- `i` = model row id
- `p` = provider
- `m` = model
- `s` = pricing payload

Pricing payload keys:

- `s.v` = schema marker, currently `model_pricing/v1`
- `s.d.u` = currency
- `s.d.t` = tiers

Tier keys:

- `w` = optional conditions
- `r` = rates

Rate keys:

- `c` = `pricePerUnit`

Meter keys currently used:

- `it` = `input_tokens`
- `ot` = `output_tokens`
- `icrt` = `input_cache_read_tokens`
- `icwt` = `input_cache_write_tokens`
- `iat` = `input_audio_tokens`
- `oat` = `output_audio_tokens`
- `ort` = `output_reasoning_tokens`

Condition keys currently used:

- `tit` = `total_input_tokens`

## Example

```json
{
  "i": "7149feb43cf82b1f",
  "p": "google",
  "m": "gemini-2-5-pro",
  "s": {
    "v": "model_pricing/v1",
    "d": {
      "u": "USD",
      "t": [
        {
          "r": {
            "icrt": { "c": 1.25e-7 },
            "it": { "c": 0.00000125 },
            "ot": { "c": 0.00001 }
          }
        },
        {
          "w": [{ "f": "tit", "op": "gte", "value": 200000 }],
          "r": {
            "icrt": { "c": 2.5e-7 },
            "it": { "c": 0.0000025 },
            "ot": { "c": 0.000015 }
          }
        }
      ]
    }
  }
}
```

## Runtime Assumptions

The intended v0 runtime behavior is:

- match by canonical `provider + model`
- use the default tier unless a prompt-threshold condition matches
- compute cost on the existing token-related metric rows
- persist `estimatedCost`, `costUnit`, and optional costing metadata on those rows
- when pricing lookup fails, attach the same costing error metadata to the token
  metric rows that will actually be emitted for the reported usage payload
- preserve explicitly reported zero-value total token rows with `estimatedCost: 0`

This file is optimized for shipping size, not readability.
