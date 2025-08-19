# LongMemEval Usage Guide

## Quick Start

### 1. Prepare Data (Required First)

The prepare step processes the dataset through mock agents to populate the storage:

```bash
# Quick test with 5 questions
pnpm prepare:quick

# Full dataset with different memory configs
pnpm prepare:s              # Small dataset, semantic-recall (default)
pnpm prepare:s:lastk        # Small dataset, last-k messages
pnpm prepare:s:working      # Small dataset, working-memory
pnpm prepare:s:combined     # Small dataset, combined (semantic + working memory)
pnpm prepare:m              # Medium dataset, semantic-recall
```

### 2. Run Benchmark

After preparing data, run the benchmark:

```bash
# Quick test
pnpm run:quick

# Full runs
pnpm run:s              # Small dataset with semantic-recall (default)
pnpm run:s:lastk        # Small dataset with last-k
pnpm run:s:working      # Small dataset with working-memory
pnpm run:s:combined     # Small dataset with combined
```

## Full CLI Options

### Prepare Command

```bash
pnpm cli prepare \
  -d <dataset>              # longmemeval_s, longmemeval_m, longmemeval_oracle
  -c <memory-config>        # full-history, last-k, semantic-recall, working-memory, combined
  [--subset <n>]            # Process only n questions
  [--output <dir>]          # Output directory (default: ./prepared-data)
```

### Run Command

```bash
pnpm cli run \
  -d <dataset>              # longmemeval_s, longmemeval_m, longmemeval_oracle
  -m <model>                # Model name (e.g., gpt-4o)
  -c <memory-config>        # full-history, last-k, semantic-recall, working-memory, combined
  [--subset <n>]            # Run only n questions
  [--concurrency <n>]       # Parallel requests (default: 5)
  [--prepared-data <dir>]   # Prepared data directory
  [--output <dir>]          # Results directory
```

## Memory Configurations

- **semantic-recall** (default): Uses embeddings to find relevant messages (requires OPENAI_API_KEY)
- **last-k**: Loads last 50 messages only
- **working-memory**: Maintains a summary of user context
- **combined**: Semantic recall + working memory

Note: `full-history` is available but not recommended for testing memory systems as it defeats the purpose by loading everything into context.

## Environment Variables

```bash
# Required for running benchmarks
export OPENAI_API_KEY=your-key-here

# Optional for downloading datasets
export HF_TOKEN=your-huggingface-token
```

## Example Workflow

```bash
# 1. Test with small subset first
pnpm prepare:quick
pnpm run:quick

# 2. Run full benchmark with semantic recall
pnpm prepare:s
pnpm run:s
```

## Viewing Results

Results are saved in `./results/run_<timestamp>/`:

- `results.jsonl`: Raw evaluation results
- `metrics.json`: Aggregated metrics

```bash
# View all runs
pnpm cli report -r ./results

# Check specific metrics
cat results/run_*/metrics.json | jq '.overall_accuracy'
```
