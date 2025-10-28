---
title: "トーンの一貫性"
description: テキストの感情トーンの傾向や感情表現の一貫性を評価するために、Tone Consistency 指標を用いる例。
---

# トーン一貫性の評価 \{#tone-consistency-evaluation\}

:::info New Scorer API

新しい評価用API「Scorers」をリリースしました。より使いやすいAPIで、エラー分析に役立つメタデータがより多く保存され、データ構造の評価に対する柔軟性も向上しています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ToneConsistencyMetric` を使用して、テキストの感情的なトーンのパターンとセンチメントの一貫性を評価します。このメトリクスは `query` と `response` を受け取り、スコアと、センチメントスコアおよびその差分を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## ポジティブなトーンの例 \{#positive-tone-example\}

この例では、テキストはいずれも同様にポジティブなトーンを示しています。指標はトーンの一致度を測定し、その結果、スコアは高くなります。

```typescript filename="src/example-positive-tone.ts" showLineNumbers copy
import { ToneConsistencyMetric } from '@mastra/evals/nlp';

const metric = new ToneConsistencyMetric();

const query = 'この製品は素晴らしくて最高です!';
const response = 'この製品は優れていて素敵です!';

const result = await metric.measure(query, response);

console.log(result);
```

### ポジティブなトーンの出力 \{#positive-tone-output\}

このメトリックは、感情の整合性が高いことを示す高スコアを返します。`info` フィールドには、感情の値とそれらの差分が含まれます。

```typescript
{
  score: 0.8333333333333335,
  info: {
    responseSentiment: 1.3333333333333333,
    referenceSentiment: 1.1666666666666667,
    difference: 0.16666666666666652
  }
}
```

## 安定したトーンの例 \{#stable-tone-example\}

この例では、空のレスポンスを渡してテキスト内のトーンの一貫性を分析します。これにより、単一の入力テキストにおける感情の安定性を評価するようメトリックに指示され、テキスト全体でトーンの均一性を示すスコアが得られます。

```typescript filename="src/example-stable-tone.ts" showLineNumbers copy
import { ToneConsistencyMetric } from '@mastra/evals/nlp';

const metric = new ToneConsistencyMetric();

const query = '素晴らしいサービス!親切なスタッフ。完璧な雰囲気。';
const response = '';

const result = await metric.measure(query, response);

console.log(result);
```

### 安定したトーン出力 \{#stable-tone-output\}

このメトリックは、入力テキスト全体で感情が一貫していることを示す高いスコアを返します。`info` フィールドには平均感情と感情分散が含まれ、トーンの安定性を反映します。

```typescript
{
  score: 0.9444444444444444,
  info: {
    avgSentiment: 1.3333333333333333,
    sentimentVariance: 0.05555555555555556
  }
}
```

## トーンが混ざった例 \{#mixed-tone-example\}

この例では、入力と応答の感情的なトーンが異なります。指標はこうした差異を捉え、一貫性スコアを低く評価します。

```typescript filename="src/example-mixed-tone.ts" showLineNumbers copy
import { ToneConsistencyMetric } from '@mastra/evals/nlp';

const metric = new ToneConsistencyMetric();

const query = 'インターフェースは使いづらく分かりにくいが、可能性はある。';
const response = 'デザインには将来性があるが、使いやすくするには大幅な改善が必要だ。';

const result = await metric.measure(query, response);

console.log(result);
```

### トーンが混在した出力 \{#mixed-tone-output\}

感情トーンに明確な差があるため、このメトリクスは低いスコアを返します。`info` フィールドには、感情の値とそれらのばらつきの度合いが示されています。

```typescript
{
  score: 0.4181818181818182,
  info: {
    responseSentiment: -0.4,
    referenceSentiment: 0.18181818181818182,
    difference: 0.5818181818181818
  }
}
```

## メトリックの設定 \{#metric-configuration\}

`ToneConsistencyMetric` インスタンスはデフォルト設定のままで作成できます。追加の設定は不要です。

```typescript
const metric = new ToneConsistencyMetric();
```

> 設定オプションの一覧は [ToneConsistencyMetric](/docs/reference/evals/tone-consistency) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`ToneConsistencyMetric` は次の形の結果を返します:

```typescript
{
  score: number,
  info: {
    responseSentiment?: number,
    referenceSentiment?: number,
    difference?: number,
    avgSentiment?: number,
    sentimentVariance?: number
  }
}
```

### トーン一貫性スコア \{#tone-consistency-score\}

トーン一貫性スコアは 0〜1 の範囲です：

* **0.8〜1.0**：トーンが非常に一貫している
* **0.6〜0.7**：トーンが概ね一貫している
* **0.4〜0.5**：トーンにばらつきがある
* **0.0〜0.3**：トーンに矛盾がある

### トーン一貫性に関する情報 \{#tone-consistency-info\}

スコアの説明（以下を含む）:

* 入力と応答の感情の整合
* ひとつのテキスト内でのトーンの安定性
* 感情の差異・ばらつきの程度

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/tone-consistency" />