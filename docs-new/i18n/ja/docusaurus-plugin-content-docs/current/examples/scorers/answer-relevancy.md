---
title: "回答の妥当性"
description: Answer Relevancy スコアラーを用いて、クエリに対する回答の妥当性を評価する例。
---

# Answer Relevancy Scorer \{#answer-relevancy-scorer\}

`createAnswerRelevancyScorer` を使用して、元のクエリに対するレスポンスの関連度をスコアリングします。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> APIの完全なドキュメントと設定オプションについては、[`createAnswerRelevancyScorer`](/docs/reference/scorers/answer-relevancy)を参照してください。

## 高い関連性の例 \{#high-relevancy-example\}

この例では、応答が入力クエリに対し、具体的で関連性の高い情報を正確に示しています。

```typescript filename="src/example-high-answer-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';

const scorer = createAnswerRelevancyScorer({ model: openai('gpt-4o-mini') });

const inputMessages = [{ role: 'user', content: '定期的な運動による健康効果は何ですか?' }];
const outputMessage = {
  text: '定期的な運動は心血管系の健康を改善し、筋肉を強化し、代謝を高め、エンドルフィンの分泌により精神的な健康を向上させます。',
};

const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});

console.log(result);
```

### 関連性の高い出力 \{#high-relevancy-output\}

無関係な情報を含めずにクエリに正確に回答しているため、この出力は高いスコアを獲得します。

```typescript
{
  score: 1,
  reason: 'スコアが1であるのは、出力が定期的な運動の具体的な健康効果を複数挙げて質問に直接答えており、心血管の健康、筋力、代謝、メンタルヘルスの向上を含んでいるためです。各ポイントは関連性が高く、健康効果の包括的な理解に寄与しています。'
}
```

## 部分的な関連性の例 \{#partial-relevancy-example\}

この例では、回答が問い合わせの一部には対応している一方で、直接は関係のない追加情報も含まれています。

```typescript filename="src/example-partial-answer-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';

const scorer = createAnswerRelevancyScorer({ model: openai('gpt-4o-mini') });

const inputMessages = [{ role: 'user', content: '健康的な朝食には何を取り入れるべきですか？' }];
const outputMessage = {
  text: '栄養バランスの取れた朝食には、全粒穀物とたんぱく質を含めるとよいでしょう。一方で、朝食のタイミングも同じくらい重要です。起床後2時間以内に食べることで、一日を通して代謝やエネルギーレベルが最適化されることが研究で示されています。',
};

const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});

console.log(result);
```

### 部分的に関連する出力 \{#partial-relevancy-output\}

この出力は、クエリに対して部分的な回答にとどまっているため、スコアが低くなります。関連情報は一部含まれているものの、無関係な情報が全体の関連性を損なっています。

```typescript
{
  score: 0.25,
  reason: 'スコアが0.25であるのは、出力が健康的な朝食の要素として全粒穀物とたんぱく質に言及し、質問に対する直接的な答えになっているためで、これは妥当です。ただし、朝食のタイミングやそれが代謝・エネルギーレベルに及ぼす影響に関する付加情報は質問に直接結びつかないため、全体としての関連性スコアは低めになっています。'
}
```

## 関連性が低い例 \{#low-relevancy-example\}

この例では、回答が問い合わせに対応しておらず、完全に無関係な情報が含まれています。

```typescript filename="src/example-low-answer-relevancy.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';

const scorer = createAnswerRelevancyScorer({ model: openai('gpt-4o-mini') });

const inputMessages = [{ role: 'user', content: '瞑想の効果は何ですか?' }];
const outputMessage = {
  text: '万里の長城は全長13,000マイル以上で、明代に侵略を防ぐために建設されました。',
};

const result = await scorer.run({
  input: inputMessages,
  output: outputMessage,
});

console.log(result);
```

### 関連性の低い出力 \{#low-relevancy-output\}

この出力は、クエリに答えておらず、関連する情報も提供していないため、スコアは0となります。

```typescript
{
  score: 0,
  reason: 'スコアが0なのは、万里の長城に関する出力が瞑想の利点とまったく無関係で、入力された質問に答えるうえでの関連情報や文脈を一切提供していないためです。'
}
```

## スコアラーの設定 \{#scorer-configuration\}

オプションのパラメーターを調整して、Answer Relevancy Scorer のスコア計算方法をカスタマイズできます。たとえば、`uncertaintyWeight` は不確実な応答にどの程度の重みを与えるかを制御し、`scale` は最大スコアを設定します。

```typescript showLineNumbers copy
const scorer = createAnswerRelevancyScorer({
  model: openai('gpt-4o-mini'),
  options: { uncertaintyWeight: 0.3, scale: 1 },
});
```

> 設定オプションの全一覧は、[createAnswerRelevancyScorer](/docs/reference/scorers/answer-relevancy)をご覧ください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形式の結果を返します：

```typescript
{
  runId: string,
  score: number,
  extractPrompt: string,
  extractStepResult: { statements: string[] },
  analyzePrompt: string,
  analyzeStepResult: { results: Array<{ result: 'yes' | 'unsure' | 'no', reason: string }> },
  reasonPrompt: string,
  reason: string
}
```

### score \{#score\}

0～1 の範囲の関連度スコア:

* **1.0**: 応答は関連性が高く要点を押さえた情報で、クエリに完全に回答している。
* **0.7–0.9**: 応答は概ねクエリに回答しているが、わずかに無関係な内容を含む場合がある。
* **0.4–0.6**: 応答は部分的にクエリに回答しており、関連情報と無関係な情報が混在している。
* **0.1–0.3**: 応答は関連する内容がごくわずかで、クエリの意図を大きく外している。
* **0.0**: 応答は完全に無関係で、クエリに答えていない。

### runId \{#runid\}

このスコアラーの実行を識別する一意のIDです。

### extractPrompt \{#extractprompt\}

抽出ステップでLLMに送信するプロンプト。

### extractStepResult \{#extractstepresult\}

出力から抽出された文（statements）。例: `{ statements: string[] }`

### analyzePrompt \{#analyzeprompt\}

analyze ステップで LLM に送信されるプロンプトです。

### analyzeStepResult \{#analyzestepresult\}

分析結果。例: `{ results: Array<{ result: 'yes' | 'unsure' | 'no', reason: string }> }`。

### reasonPrompt \{#reasonprompt\}

reason ステップで LLM に送信されるプロンプト。

### 理由 \{#reason\}

スコアの説明です。整合性や焦点の評価に加え、改善の提案が含まれます。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/answer-relevancy" />