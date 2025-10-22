---
title: 'Create a custom eval'
description: 'Mastra allows you to create your own evals, here is how.'
---

# Create a Custom Eval

:::info New Scorer API

We just released a new evals API called Scorers, with a more ergonomic API and more metadata stored for error analysis, and more flexibility to evaluate data structures. It's fairly simple to migrate, but we will continue to support the existing Evals API.

:::

Create a custom eval by extending the `Metric` class and implementing the `measure` method. This gives you full control over how scores are calculated and what information is returned. For LLM-based evaluations, extend the `MastraAgentJudge` class to define how the model reasons and scores output.

## Native JavaScript evaluation

You can write lightweight custom metrics using plain JavaScript/TypeScript. These are ideal for simple string comparisons, pattern checks, or other rule-based logic.

See our [Word Inclusion example](/examples/evals/custom-native-javascript-eval), which scores responses based on the number of reference words found in the output.

## LLM as a judge evaluation

For more complex evaluations, you can build a judge powered by an LLM. This lets you capture more nuanced criteria, like factual accuracy, tone, or reasoning.

See the [Real World Countries example](/examples/evals/custom-llm-judge-eval) for a complete walkthrough of building a custom judge and metric that evaluates real-world factual accuracy.
