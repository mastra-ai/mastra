# OM cache workflows

## 1) Deterministic cache-hit e2e tests (Anthropic)

These tests compare cache-hit behavior across OM event types:

- stable prompt baseline
- OM enabled with no observation/reflection writes
- observation writes that change observer output
- reflection writes that change reflector output

### Requirements

- `ANTHROPIC_API_KEY`

### Run

```bash
cd packages/memory
pnpm vitest src/processors/observational-memory/__tests__/cache-hit-rates.e2e.test.ts --bail 1 --reporter=dot
```

### Interpreting output

Each scenario logs usage values:

- `input`
- `cachedInput`
- `output`
- `total`
- `ratio` (`cachedInput / input`)

Assertions are directional (stable scenarios should have higher ratios than rewritten-observation/reflection scenarios).

## 2) Low-cost OM seeding session (Cerebras)

This manual script creates heavy multi-round OM activity using a cheaper model.

### Defaults

- Model: `cerebras/zai-glm-4.7`
- Env var: `CEREBRAS_API_KEY`
- Prompt: deep-research instruction targeting `https://mastra.ai`

### Run

```bash
cd packages/memory
CEREBRAS_API_KEY=... pnpm tsx src/processors/observational-memory/__tests__/scripts/seed-om-session.ts
```

### Optional args

- `--threadId=...`
- `--resourceId=...`
- `--rounds=...`
- `--model=...`
- `--prompt=...`

Example:

```bash
cd packages/memory
CEREBRAS_API_KEY=... pnpm tsx src/processors/observational-memory/__tests__/scripts/seed-om-session.ts \
  --rounds=10 \
  --threadId=seed-thread-1 \
  --resourceId=seed-resource-1
```

### Output

Per-round report lines include cache ratio and token usage, followed by an OM summary with active observation size/token counters.
