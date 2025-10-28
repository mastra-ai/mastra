---
title: "コンテキスト再現率"
description: 応答がどの程度うまくコンテキスト情報を取り入れているかを評価するために、コンテキスト再現率という評価指標を用いる例。
---

# コンテキスト再現率の評価 \{#contextual-recall-evaluation\}

:::info New Scorer API

新しい評価用 API「Scorers」をリリースしました。より扱いやすい API、エラー分析に役立つより豊富なメタデータ、データ構造を柔軟に評価できる機能を備えています。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`ContextualRecallMetric` を使用すると、提供されたコンテキストから関連情報がどの程度うまくレスポンスに取り込まれているかを評価できます。このメトリクスは `query` と `response` を受け取り、スコアと、その理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 高リコールの例 \{#high-recall-example\}

この例では、コンテキストに含まれる情報がすべて応答に反映されています。各要素が正確に再現され、出力で表現されているため、リコールスコアは満点となります。

```typescript filename="src/example-high-recall.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextualRecallMetric } from '@mastra/evals/llm';

const metric = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: ['製品機能にはクラウド同期が含まれます。', 'オフラインモードが利用可能です。', '複数のデバイスをサポートしています。'],
});

const query = '製品の主な機能は何ですか?';
const response =
  '製品にはクラウド同期、オフラインモードのサポート、複数のデバイスで動作する機能があります。';

const result = await metric.measure(query, response);

console.log(result);
```

### 高リコールの出力 \{#high-recall-output\}

出力は、応答にすべてのコンテキスト要素が含まれているため満点となります。コンテキストで言及された各機能が正確に再現され、統合されており、欠落や不要な情報は一切ありません。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1である理由は、期待される出力のすべての要素が、検索コンテキスト内の対応するノード（具体的には、クラウド同期、オフラインモードのサポート、マルチデバイス機能について詳述しているノード）によって完全にサポートされているためです。'
  }
}
```

## 混在リコールの例 \{#mixed-recall-example\}

この例では、応答に一部の文脈要素が含まれている一方で、無関係な内容も混ざっています。不要な情報が含まれることで、全体のリコールスコアが下がります。

```typescript filename="src/example-mixed-recall.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextualRecallMetric } from '@mastra/evals/llm';

const metric = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: [
    'Pythonは高水準プログラミング言語です。',
    'Pythonはコードの可読性を重視しています。',
    'Pythonは複数のプログラミングパラダイムをサポートしています。',
    'Pythonはデータサイエンスで広く使用されています。',
  ],
});

const query = "Pythonの主な特徴は何ですか?";
const response = 'Pythonは高水準プログラミング言語です。また、ヘビの一種でもあります。';

const result = await metric.measure(query, response);

console.log(result);
```

### 混合リコール出力 \{#mixed-recall-output\}

この出力は、関連するコンテキストの記述が1つ含まれている一方、元のコンテキストで裏付けられていない無関係な内容も含まれているため、中程度のスコアとなります。

```typescript
{
  score: 0.25,
  info: {
    reason: "スコアが0.25なのは、「Pythonは高水準プログラミング言語である」という文が検索コンテキストのノード1と一致しているものの、ノード2、3、4の関連情報に言及がないため、全体的なコンテキストに大きな欠落があることを示しているからです。"
  }
}
```

## リコールが低い例 \{#low-recall-example\}

この例では、応答に関連するコンテキストがほとんど、またはまったく含まれていません。応答内の情報の大半が根拠に欠けているため、リコールスコアが低くなります。

```typescript filename="src/example-low-recall.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { ContextualRecallMetric } from '@mastra/evals/llm';

const metric = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: [
    '太陽系には8つの惑星があります。',
    '水星は太陽に最も近い惑星です。',
    '金星は最も高温の惑星です。',
    '火星は赤い惑星と呼ばれています。',
  ],
});

const query = '太陽系について教えてください。';
const response = '木星は太陽系で最も大きな惑星です。';

const result = await metric.measure(query, response);

console.log(result);
```

### リコール率が低い出力 \{#low-recall-output\}

この出力は、コンテキストにない情報を含み、提供された詳細を無視しているため、スコアが低くなります。コンテキスト項目は回答にまったく反映されていません。

```typescript
{
  score: 0,
  info: {
    reason: "スコアが0である理由は、出力に検索コンテキスト内のノードからの関連情報が全く含まれておらず、惑星の数、水星の位置、金星の温度、火星の通称などの重要な要素に対応できていないためです。"
  }
}
```

## メトリクスの設定 \{#metric-configuration\}

`ContextualRecallMetric` のインスタンスは、応答に関連する背景情報を表す `context` 配列を指定して作成できます。スコアの範囲を定義するための `scale` など、任意のパラメーターも設定できます。

```typescript showLineNumbers copy
const metric = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: [''],
  scale: 1,
});
```

> 設定オプションの全一覧は [ContextualRecallMetric](/docs/reference/evals/contextual-recall) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`ContextualRecallMetric` は、次の形式の結果を返します：

```typescript
{
  score: number,
  info: {
    reason: string
  }
}
```

### リコールスコア \{#recall-score\}

リコールスコアは 0 から 1 の範囲:

* **1.0**: 完全に再現 – すべてのコンテキスト情報を使用。
* **0.7–0.9**: 高い再現 – ほとんどのコンテキスト情報を使用。
* **0.4–0.6**: ばらつきあり – 一部のコンテキスト情報を使用。
* **0.1–0.3**: 低い再現 – ごく一部のコンテキスト情報を使用。
* **0.0**: 再現なし – コンテキスト情報は未使用。

### リコール情報 \{#recall-info\}

スコアの説明。次の項目を含みます:

* 情報の取り込み状況
* 文脈の欠落
* 応答の網羅性
* リコール全体の品質

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/contextual-recall" />