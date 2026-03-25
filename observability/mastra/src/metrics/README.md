# Embedded Pricing Model

This directory contains the embedded pricing snapshot used by `@mastra/observability` for v0 runtime cost estimation.

## Source of Truth

- `pricing-data.jsonl` is generated externally

The upstream generation process:

- fetches provider and aggregator pricing snapshots
- normalizes them into per-source pricing rules
- applies source precedence and provider overrides
- writes the final minified pricing model JSONL artifact

The copy in this directory is the embedded runtime snapshot, not the place where pricing data is authored or rolled up.

## v0 Scope

The embedded data is intentionally narrow:

- one row per canonical `provider + model`
- token pricing only
- base pricing only unless the model has prompt-threshold pricing
- prompt-threshold tiers currently use `total_input_tokens > 200000`
- every kept tier includes both input and output token pricing
- if a source only exposes `output_reasoning_tokens` for a tier, that value is promoted to `output_tokens` for v0
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
          "w": [{ "f": "tit", "op": "gt", "value": 200000 }],
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

This file is optimized for shipping size, not readability. If a human-readable data or provenance-oriented lineage file is needed, use the upstream costing pipeline outputs instead of editing or expanding the embedded snapshot here.
