---
title: "幻覚"
description: 応答に含まれる事実誤りや矛盾を評価するために、Hallucination指標を用いる例。
---

## ハルシネーション評価 \{#hallucination-evaluation\}

:::info New Scorer API

より扱いやすいAPI、エラー分析向けのより豊富なメタデータ保存、そしてデータ構造を評価するための柔軟性を備えた新しい評価API「Scorers」をリリースしました。移行は比較的簡単ですが、既存のEvals APIのサポートは継続します。

:::

提供されたコンテキストのいずれかと矛盾していないかを評価するには、`HallucinationMetric` を使用します。このメトリックは `query` と `response` を受け取り、スコアと理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 幻覚なしの例 \{#no-hallucination-example\}

この例では、応答は提供されたコンテキストと完全に一致しています。すべての主張は事実に即して正しく、出典に直接裏づけられているため、幻覚スコアは低くなります。

```typescript filename="src/example-no-hallucination.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { HallucinationMetric } from '@mastra/evals/llm';

const metric = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: [
    'iPhone は 2007年に初めて発売されました。',
    'Steve Jobs が Macworld で発表しました。',
    '初代モデルは 3.5インチの画面を搭載していました。',
  ],
});

const query = '初代 iPhone はいつ発売されましたか？';
const response =
  'iPhone は 2007年に初めて発売され、Steve Jobs が Macworld で発表しました。初代 iPhone は 3.5インチの画面を搭載していました。';

const result = await metric.measure(query, response);

console.log(result);
```

### 幻覚のない出力 \{#no-hallucination-output\}

矛盾がないため、この回答のスコアは0です。すべての記述は文脈と整合しており、新たな情報や捏造された情報は一切含まれていません。

```typescript
{
  score: 0,
  info: {
    reason: 'スコアが0なのは、コンテキストのステートメントがいずれも出力と矛盾していないためです。'
  }
}
```

## 混在ハルシネーションの例 \{#mixed-hallucination-example\}

この例では、回答には正確な主張と不正確な主張が両方含まれています。いくつかの詳細は文脈と一致していますが、誇張された数値や誤った場所など、文脈と明確に矛盾するものもあります。こうした矛盾により、ハルシネーション・スコアが上がります。

```typescript filename="src/example-mixed-hallucination.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { HallucinationMetric } from '@mastra/evals/llm';

const metric = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: [
    '最初のスター・ウォーズ映画は1977年に公開されました。',
    '監督はジョージ・ルーカスでした。',
    'この作品の世界興行収入は7億7,500万ドルでした。',
    '映画はチュニジアとイングランドで撮影されました。',
  ],
});

const query = '最初のスター・ウォーズ映画について教えて。';
const response =
  '最初のスター・ウォーズ映画は1977年に公開され、監督はジョージ・ルーカスでした。興行収入は10億ドルを超え、撮影はすべてカリフォルニアで行われました。';

const result = await metric.measure(query, response);

console.log(result);
```

### 混合型ハルシネーションの出力 \{#mixed-hallucination-output\}

回答の一部が文脈と矛盾しているため、この指標は中程度のスコアを付与します。正しい事実も含まれているものの、不正確または捏造された情報もあり、全体的な信頼性が損なわれます。

```typescript
{
  score: 0.5,
  info: {
    reason: 'スコアが0.5なのは、出力の4つの記述のうち2つがコンテキストの主張と矛盾しており、正確な情報と不正確な情報が均衡していることを示しているためです。'
  }
}
```

## 完全なハルシネーションの例 \{#complete-hallucination-example\}

この例では、応答がコンテキスト内のすべての重要な事実に反しています。どの主張も裏付けが取れず、提示された詳細はすべて事実誤認です。

```typescript filename="src/example-complete-hallucination.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { HallucinationMetric } from '@mastra/evals/llm';

const metric = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: [
    'ライト兄弟が初飛行を行ったのは1903年です。',
    'その飛行は12秒続きました。',
    '飛行距離は120フィートでした。',
  ],
});

const query = 'ライト兄弟が初めて飛行したのはいつですか？';
const response =
  'ライト兄弟が歴史的な初飛行を達成したのは1908年でした。飛行は約2分続き、距離はほぼ1マイルでした。';

const result = await metric.measure(query, response);

console.log(result);
```

### 完全な幻覚出力 \{#complete-hallucination-output\}

この指標は、応答内のすべての記述が文脈と矛盾しているため、スコアを1とします。詳細は全体的に捏造されているか、不正確です。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1.0なのは、出力の3つの記述がいずれも文脈と直接矛盾しているためです。初飛行は1908年ではなく1903年、所要時間は約2分ではなく12秒、飛行距離はほぼ1マイルではなく120フィートです。'
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

事実に基づくソース資料を表す `context` 配列を指定して、`HallucinationMetric` インスタンスを作成できます。最大スコアを制御するために、`scale` などのオプションパラメータを設定することもできます。

```typescript
const metric = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: [''],
  scale: 1,
});
```

> 構成オプションの全一覧は [HallucinationMetric](/docs/reference/evals/hallucination) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`HallucinationMetric` は次の形式の結果を返します：

```typescript
{
  score: 数値,
  info: {
    reason: 文字列
  }
}
```

### 幻覚スコア \{#hallucination-score\}

0〜1の範囲の幻覚スコア:

* **0.0**: 幻覚なし — すべての主張が文脈と一致。
* **0.3–0.4**: 低い幻覚 — いくつか矛盾がある。
* **0.5–0.6**: 中程度の幻覚 — 複数の矛盾がある。
* **0.7–0.8**: 高い幻覚 — 多くの矛盾がある。
* **0.9–1.0**: 完全な幻覚 — ほとんどまたはすべての主張が文脈と矛盾。

### ハルシネーション情報 \{#hallucination-info\}

スコアの説明。詳細は以下を含みます:

* どの記述がコンテキストと整合するか、または矛盾するか
* 矛盾の深刻度と発生頻度
* 事実からの乖離の程度
* 応答の総合的な正確性と信頼性

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/hallucination" />