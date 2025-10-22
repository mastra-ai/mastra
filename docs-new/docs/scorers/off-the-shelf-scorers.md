---
title: 'Built-in Scorers'
description: "Overview of Mastra's ready-to-use scorers for evaluating AI outputs across quality, safety, and performance dimensions."
---

# Built-in Scorers

Mastra provides a comprehensive set of built-in scorers for evaluating AI outputs. These scorers are optimized for common evaluation scenarios and are ready to use in your agents and workflows.

## Available Scorers

### Accuracy and Reliability

These scorers evaluate how correct, truthful, and complete your agent's answers are:

- [`answer-relevancy`](/docs/reference/scorers/answer-relevancy): Evaluates how well responses address the input query (`0-1`, higher is better)
- [`answer-similarity`](/docs/reference/scorers/answer-similarity): Compares agent outputs against ground truth answers for CI/CD testing using semantic analysis (`0-1`, higher is better)
- [`faithfulness`](/docs/reference/scorers/faithfulness): Measures how accurately responses represent provided context (`0-1`, higher is better)
- [`hallucination`](/docs/reference/scorers/hallucination): Detects factual contradictions and unsupported claims (`0-1`, lower is better)
- [`completeness`](/docs/reference/scorers/completeness): Checks if responses include all necessary information (`0-1`, higher is better)
- [`content-similarity`](/docs/reference/scorers/content-similarity): Measures textual similarity using character-level matching (`0-1`, higher is better)
- [`textual-difference`](/docs/reference/scorers/textual-difference): Measures textual differences between strings (`0-1`, higher means more similar)
- [`tool-call-accuracy`](/docs/reference/scorers/tool-call-accuracy): Evaluates whether the LLM selects the correct tool from available options (`0-1`, higher is better)
- [`prompt-alignment`](/docs/reference/scorers/prompt-alignment): Measures how well agent responses align with user prompt intent, requirements, completeness, and format (`0-1`, higher is better)

### Context Quality

These scorers evaluate the quality and relevance of context used in generating responses:

- [`context-precision`](/docs/reference/scorers/context-precision): Evaluates context relevance and ranking using Mean Average Precision, rewarding early placement of relevant context (`0-1`, higher is better)
- [`context-relevance`](/docs/reference/scorers/context-relevance): Measures context utility with nuanced relevance levels, usage tracking, and missing context detection (`0-1`, higher is better)

> tip Context Scorer Selection

- Use **Context Precision** when context ordering matters and you need standard IR metrics (ideal for RAG ranking evaluation)
- Use **Context Relevance** when you need detailed relevance assessment and want to track context usage and identify gaps

Both context scorers support:

- **Static context**: Pre-defined context arrays
- **Dynamic context extraction**: Extract context from runs using custom functions (ideal for RAG systems, vector databases, etc.)

### Output Quality

These scorers evaluate adherence to format, style, and safety requirements:

- [`tone-consistency`](/docs/reference/scorers/tone-consistency): Measures consistency in formality, complexity, and style (`0-1`, higher is better)
- [`toxicity`](/docs/reference/scorers/toxicity): Detects harmful or inappropriate content (`0-1`, lower is better)
- [`bias`](/docs/reference/scorers/bias): Detects potential biases in the output (`0-1`, lower is better)
- [`keyword-coverage`](/docs/reference/scorers/keyword-coverage): Assesses technical terminology usage (`0-1`, higher is better)
