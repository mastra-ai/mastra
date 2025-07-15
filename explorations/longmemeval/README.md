# LongMemEval Benchmark for Mastra

This package implements the [LongMemEval benchmark](https://arxiv.org/abs/2410.10813) ([+Github](https://github.com/xiaowu0162/LongMemEval)) for testing Mastra's long-term memory capabilities.

## About LongMemEval

LongMemEval is a comprehensive benchmark designed by researchers to evaluate the long-term memory capabilities of chat assistants. It was introduced in the paper:

**"LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory"**  
_Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu (ICLR 2025)_  
📄 [Paper](https://arxiv.org/abs/2410.10813) | 🌐 [Website](https://xiaowu0162.github.io/long-mem-eval/) | 🤗 [Dataset](https://huggingface.co/datasets/xiaowu0162/longmemeval)

### What LongMemEval Tests

The benchmark evaluates five core long-term memory abilities through 500 meticulously curated questions:

1. **Information Extraction** - Recalling specific information from extensive interactive histories
2. **Multi-Session Reasoning** - Synthesizing information across multiple history sessions
3. **Knowledge Updates** - Handling information that changes over time
4. **Temporal Reasoning** - Understanding time-based relationships in conversations
5. **Abstention** - Recognizing when information is not available

### Why This Matters

Current LLMs show a 30-60% performance drop when tested on LongMemEval, revealing significant challenges in maintaining coherent long-term memory. This benchmark helps identify and improve these limitations.

## Quick Start

```bash
# From packages/longmemeval directory

# 1. Set your API keys
export OPENAI_API_KEY=your_openai_key_here
export HF_TOKEN=your_huggingface_token_here  # For automatic dataset download

# 2. Run a benchmark (downloads datasets automatically if needed)
pnpm bench:s          # Run small dataset (10 parallel requests)
pnpm bench:m          # Run medium dataset (10 parallel requests)
pnpm bench:oracle     # Run oracle dataset (10 parallel requests)

# Or run quick 10-question tests
pnpm bench:s:quick    # Test with 10 questions from small dataset
pnpm bench:m:quick    # Test with 10 questions from medium dataset
pnpm bench:oracle:quick # Test with 10 questions from oracle dataset
```

**Note:** The benchmark will automatically download datasets on first run. Get your HuggingFace token from https://huggingface.co/settings/tokens

## Manual Setup

### 1. Install Dependencies

```bash
# From the monorepo root
pnpm install
pnpm build
```

### 2. Download Dataset

```bash
# Set your HuggingFace token
export HF_TOKEN=your_token_here

# Download datasets (no Python or Git LFS required)
pnpm download
```

If automatic download fails, see [DOWNLOAD_GUIDE.md](./DOWNLOAD_GUIDE.md) for manual download instructions.

## Usage

### Run Benchmark

```bash
# From packages/longmemeval directory

# Quick commands for each dataset (10 parallel requests)
pnpm bench:s          # Small dataset (full run)
pnpm bench:m          # Medium dataset (full run)
pnpm bench:oracle     # Oracle dataset (full run)

# Quick test runs (10 questions only, 5 parallel)
pnpm bench:s:quick    # Small dataset (quick test)
pnpm bench:m:quick    # Medium dataset (quick test)
pnpm bench:oracle:quick # Oracle dataset (quick test)

# Advanced: Use full CLI with custom options
pnpm cli run --dataset longmemeval_s --model gpt-4o

# Adjust parallelization (default: 5)
pnpm cli run --dataset longmemeval_s --model gpt-4o --concurrency 20

# Graceful shutdown: Press Ctrl+C to stop and save progress

# Run with specific memory configuration
pnpm cli run --dataset longmemeval_s --memory-config last-k --model gpt-4o
pnpm cli run --dataset longmemeval_s --memory-config semantic-recall --model gpt-4o
pnpm cli run --dataset longmemeval_s --memory-config working-memory --model gpt-4o

# Custom subset size
pnpm cli run --dataset longmemeval_oracle --model gpt-4o --subset 25
```

### View Dataset Statistics

```bash
pnpm cli stats --dataset longmemeval_s
```

### Evaluate Existing Results

```bash
pnpm cli evaluate --results ./results/run_12345/results.jsonl --dataset longmemeval_s
```

### Generate Report

```bash
pnpm cli report --results ./results/
```

## Memory Configurations

- **full-history**: Provide complete chat history (baseline)
- **last-k**: Use Mastra's lastMessages configuration (last 20 messages)
- **semantic-recall**: Use Mastra's semantic recall feature (requires vector store)
- **working-memory**: Use Mastra's working memory with template
- **combined**: Combination of last-k and semantic recall

## Output

Results are saved in the `results/` directory with:

- `results.jsonl`: Individual question results
- `hypotheses.json`: Model responses
- `questions.json`: Questions for reference
- `metrics.json`: Aggregated metrics and configuration

## Benchmark Datasets

LongMemEval provides three dataset variants:

- **longmemeval_s (Small)**: ~115k tokens per question (30-40 sessions)
  - Designed to fit within 128k context windows
  - Tests memory across dozens of conversation sessions
- **longmemeval_m (Medium)**: ~1.5M tokens per question (500 sessions)
  - Challenges even the largest context windows
  - Tests memory across hundreds of sessions
- **longmemeval_oracle**: Only evidence sessions included
  - Used as a control to verify models can answer when given only relevant context
  - Helps isolate memory retrieval issues from comprehension issues

## Citation

If you use this benchmark in your research, please cite the original paper:

```bibtex
@article{wu2024longmemeval,
  title={LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory},
  author={Wu, Di and Wang, Hongwei and Yu, Wenhao and Zhang, Yuwei and Chang, Kai-Wei and Yu, Dong},
  journal={arXiv preprint arXiv:2410.10813},
  year={2024}
}
```

## Extending the Benchmark

To add custom memory configurations:

1. Edit `src/benchmark/runner.ts` and add your configuration to `getMemoryConfig()`
2. Update the `MemoryConfigType` in `src/data/types.ts`
3. Implement the configuration logic in `src/memory-adapters/mastra-adapter.ts`
