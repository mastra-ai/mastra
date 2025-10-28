---
title: "忠実性"
description: コンテキストに照らして応答の事実性を評価するために、Faithfulness 指標を用いる例。
---

## 忠実度評価 \{#faithfulness-evaluation\}

:::info 新しい Scorer API

使いやすいAPI、エラー解析のためのより多くのメタデータ、データ構造を柔軟に評価できる機能を備えた、新しい評価API「Scorers」をリリースしました。移行は比較的簡単ですが、既存の Evals API も引き続きサポートします。

:::

`FaithfulnessMetric` を使用して、レスポンスの主張が提供されたコンテキストによって裏付けられているかを評価します。このメトリックは `query` と `response` を受け取り、スコアと理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 高い忠実度の例 \{#high-faithfulness-example\}

この例では、回答がコンテキストと密接に一致しています。出力内の各記述は検証可能で、提供されたコンテキスト項目に裏付けられているため、高いスコアが得られます。

```typescript filename="src/example-high-faithfulness.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { FaithfulnessMetric } from '@mastra/evals/llm';

const metric = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: [
    'Tesla Model 3 は 2017 年に発売されました。',
    '航続距離は最大 358 マイルです。',
    'ベースモデルは 0～60 mph を 5.8 秒で加速します。',
  ],
});

const query = 'Tesla Model 3 について教えてください。';
const response =
  'Tesla Model 3 は 2017 年に発表されました。フル充電で最大 358 マイル走行でき、ベースバージョンは 0～60 mph を 5.8 秒で達成します。';

const result = await metric.measure(query, response);

console.log(result);
```

### 忠実度の高い出力 \{#high-faithfulness-output\}

この出力は、提供されている情報のすべてが文脈に直接裏づけられるため、スコアは1となります。欠落している事実や矛盾はありません。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1である理由は、出力内のすべての主張が提供されたコンテキストによってサポートされているためです。'
  }
}
```

## 忠実性が混在する例 \{#mixed-faithfulness-example\}

この例では、根拠のある主張と根拠のない主張が混在しています。応答の一部は文脈によって裏付けられていますが、他の部分は出典にない新たな情報を持ち込んでいます。

```typescript filename="src/example-mixed-faithfulness.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { FaithfulnessMetric } from '@mastra/evals/llm';

const metric = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: [
    'PythonはGuido van Rossumによって作られました。',
    '最初のバージョンは1991年にリリースされました。',
    'Pythonはコードの可読性を重視しています。',
  ],
});

const query = 'Pythonについて教えてください。';
const response =
  'PythonはGuido van Rossumによって作られ、1991年にリリースされました。現在最も人気のあるプログラミング言語の一つであり、世界中の何百万人もの開発者に利用されています。';

const result = await metric.measure(query, response);

console.log(result);
```

### 忠実性が混在した出力 \{#mixed-faithfulness-output\}

応答の一部しか検証できないため、スコアは低くなります。いくつかの主張は文脈に合致していますが、他は未確認または対象外のため、全体としての忠実性が低下しています。

```typescript
{
  score: 0.5,
  info: {
    reason: "スコアが0.5なのは、2つの主張がコンテキストで裏付けられている(PythonはGuido van Rossumによって作成され、1991年にリリースされた)一方、Pythonの人気と使用状況に関する残りの2つの主張はコンテキストに記載がないため検証できないためです。"
  }
}
```

## 信頼性の低い例 \{#low-faithfulness-example\}

この例では、応答が文脈と明確に矛盾しています。いずれの主張にも根拠がなく、いくつかは提示された事実と食い違っています。

```typescript filename="src/example-low-faithfulness.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { FaithfulnessMetric } from '@mastra/evals/llm';

const metric = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: [
    '火星は太陽から4番目の惑星です。',
    '主に二酸化炭素からなる薄い大気を持っています。',
    'フォボスとダイモスという2つの小さな衛星が火星の周囲を公転しています。',
  ],
});

const query = '火星について何が分かっていますか？';
const response =
  '火星は太陽から3番目の惑星です。酸素と窒素が豊富な厚い大気を持ち、3つの大きな衛星が周回しています。';

const result = await metric.measure(query, response);

console.log(result);
```

### 忠実度の低い出力 \{#low-faithfulness-output\}

各主張が不正確、または文脈と矛盾しているため、スコアは0となります。

```typescript
{
  score: 0,
  info: {
    reason: "スコアが0なのは、出力内の主張がすべて提供されたコンテキストと矛盾しているためです。出力では火星が太陽から3番目の惑星だと述べていますが、コンテキストでは明確に4番目だとしています。さらに、火星は酸素と窒素に富む厚い大気を持つとしていますが、コンテキストでは主に二酸化炭素から成る薄い大気だと説明しています。最後に、出力は火星に3つの大きな衛星があると述べていますが、コンテキストでは小さな衛星はフォボスとダイモスの2つだけだとしています。したがって、裏づけられる主張はなく、スコアは0になります。"
  }
}
```

## メトリクスの構成 \{#metric-configuration\}

評価の事実となるソース資料を定義する `context` 配列を渡すことで、`FaithfulnessMetric` インスタンスを作成できます。最大スコアを制御するための `scale` など、オプションのパラメータも設定できます。

```typescript showLineNumbers copy
const metric = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: [''],
  scale: 1,
});
```

> 設定オプションの全一覧は [FaithfulnessMetric](/docs/reference/evals/faithfulness) をご覧ください。

## 結果の理解 \{#understanding-the-results\}

`FaithfulnessMetric` は次の形の結果を返します:

```typescript
{
  score: number,
  info: {
    reason: string
  }
}
```

### 忠実性スコア \{#faithfulness-score\}

0〜1 の範囲の忠実性スコア:

* **1.0**: すべての主張が正確で、文脈によって直接裏付けられている。
* **0.7–0.9**: ほとんどの主張は正しいが、軽微な付加や省略がある。
* **0.4–0.6**: 一部の主張は裏付けられているが、他は検証不能。
* **0.1–0.3**: 内容の大半が不正確、または裏付けがない。
* **0.0**: すべての主張が虚偽であるか、文脈と矛盾している。

### 忠実性に関する情報 \{#faithfulness-info\}

スコアの説明。詳細は以下を含みます：

* 検証済みまたは反証された主張
* 事実との整合度
* 欠落や捏造された詳細に関する所見
* 全体的な応答の信頼性の要約

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/faithfulness" />