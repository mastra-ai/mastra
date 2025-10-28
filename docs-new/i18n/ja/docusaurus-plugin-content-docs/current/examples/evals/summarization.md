---
title: "要約"
description: 事実性を保ちながら、LLM が生成した要約が内容をどれだけ適切に捉えているかを評価するために、Summarization 指標を用いる例。
---

# 要約評価 \{#summarization-evaluation\}

:::info 新しい Scorer API

使いやすいAPI設計、エラー分析のためのより豊富なメタデータ、データ構造の評価における柔軟性を備えた新しい評価API「Scorers」をリリースしました。移行は比較的容易ですが、既存の Evals API も引き続きサポートします。

:::

`SummarizationMetric` を使うと、ソースの重要情報をどれだけ適切に捉えつつ、事実関係の正確性を保っているかを評価できます。このメトリクスは `query` と `response` を受け取り、スコアと、理由・アラインメントスコア・カバレッジスコアを含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

## 正確な要約の例 \{#accurate-summary-example\}

この例では、要約がソースの重要な事実をすべて正確に保持し、表現も忠実です。スコアは、網羅性の完全さと事実の完全な一致を反映しています。

```typescript filename="src/example-accurate-summary.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';

const metric = new SummarizationMetric(openai('gpt-4o-mini'));

const query =
  "電気自動車メーカーのTeslaは、2003年にMartin EberhardとMarc Tarpenningによって設立されました。Elon Muskは2004年に最大の投資家として参加し、2008年にCEOに就任しました。同社初の車種であるRoadsterは、2008年に発売されました。";
const response =
  'Teslaは、2003年にMartin EberhardとMarc Tarpenningによって設立され、2008年に初の車種であるRoadsterを発売しました。Elon Muskは2004年に最大の投資家として参加し、2008年にCEOに就任しました。';

const result = await metric.measure(query, response);
```

### 正確な要約の出力 \{#accurate-summary-output\}

高いスコアは、要約が入力の重要な点をすべて押さえ、誤りを生んでいないことを示します。`info` フィールドは、完全な整合性と網羅的なカバレッジを確認します。

```typescript
{
  score: 1,
  info: {
    reason: 'スコアが1である理由は、要約が完全に事実に基づいており、元のテキストの重要な情報をすべて網羅しているためです。',
    alignmentScore: 1,
    coverageScore: 1
  }
}
```

## 部分的な要約の例 \{#partial-summary-example\}

この例では、要約は事実関係として正確ですが、元の内容からいくつかの重要な点が欠けています。スコアは、整合性は高い一方で、カバレッジが不十分であることを反映しています。

```typescript filename="src/example-partial-summary.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';

const metric = new SummarizationMetric(openai('gpt-4o-mini'));

const query =
  'Pythonプログラミング言語はGuido van Rossumによって作成され、1991年に初めてリリースされました。特徴的なインデント(空白)の使用により、コードの可読性を重視しています。Pythonは動的型付けでガベージコレクションを備えています。構造化プログラミング、オブジェクト指向プログラミング、関数型プログラミングなど、複数のプログラミングパラダイムをサポートしています。';
const response =
  'Guido van Rossumによって作成されたPythonは、読みやすいコードとインデント(空白)の使用で知られるプログラミング言語です。1991年にリリースされました。';

const result = await metric.measure(query, response);

console.log(result);
```

### 部分的な要約の出力 \{#partial-summary-output\}

この要約は、入力に含まれる重要な情報が欠落しているため、評価は中程度となります。`info` フィールドは事実関係の一致を確認していますが、内容のカバレッジに不足があることを示しています。

```typescript
{
  score: 0.7,
  info: {
    reason: "スコアが0.7なのは、要約がPythonの作成、リリース日、可読性の重視といった重要な事実を正確に捉えており、完璧な整合性スコアを達成しているためです。しかし、Pythonが動的型付けであること、ガベージコレクションを備えていること、複数のプログラミングパラダイムをサポートしていることに言及していないため、カバレッジスコアに影響が出ています。",
    alignmentScore: 1,
    coverageScore: 0.7
  }
}
```

## 不正確な要約の例 \{#inaccurate-summary-example\}

この例では、要約に事実誤認が含まれ、元のソースの重要な詳細が誤って伝えられています。情報の一部が部分的に触れられていても、スコアは整合性の低さを反映します。

```typescript filename="src/example-inaccurate-summary.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';

const metric = new SummarizationMetric(openai('gpt-4o-mini'));

const query =
  'World Wide WebはTim Berners-Leeが1989年にCERNで働いていた際に発明しました。彼は1991年に最初のウェブサイトを公開しました。Berners-Leeは特許やロイヤリティを求めることなく、Webを自由に利用可能にしました。';
const response =
  'インターネットはTim Berners-Leeが1990年代初頭にMITで作成し、彼は特許を通じてその技術を商業化しました。';

const result = await metric.measure(query, response);

console.log(result);
```

### 不正確な要約の出力 \{#inaccurate-summary-output\}

この要約は、事実関係の誤りや入力との不整合により、低いスコアとなります。`info` フィールドでは、どの点が不正確だったか、また要約がどのように元の入力から逸脱したかが説明されています。

```typescript
{
  score: 0,
  info: {
    reason: 'スコアが0である理由は、要約に事実誤認が含まれており、元のテキストの重要な詳細が網羅されていないためです。インターネットが1990年代初頭にMITで作成されたという主張は元のテキストと矛盾しています。元のテキストでは、World Wide Webが1989年にCERNで発明されたと記載されています。さらに、要約ではBerners-Leeが特許を通じて技術を商業化したと誤って述べていますが、元のテキストでは彼がWebを特許やロイヤリティなしで自由に利用可能にしたことが明記されています。',
    alignmentScore: 0,
    coverageScore: 0.17
  }
}
```

## 指標の設定 \{#metric-configuration\}

モデルを指定するだけで `SummarizationMetric` インスタンスを作成できます。追加の設定は不要です。

```typescript showLineNumbers copy
const metric = new SummarizationMetric(openai('gpt-4o-mini'));
```

> 設定オプションの全一覧については、[SummarizationMetric](/docs/reference/evals/summarization) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`SummarizationMetric` は次の形の結果を返します:

```typescript
{
  score: number,
  info: {
    reason: string,
    alignmentScore: number,
    coverageScore: number
  }
}
```

### 要約スコア \{#summarization-score\}

0〜1の範囲の要約スコア:

* **1.0**: 完璧な要約 – 完全に正確で抜けがない。
* **0.7–0.9**: 良好な要約 – 軽微な抜けやわずかな不正確さがある。
* **0.4–0.6**: まずまずの要約 – 一部は正確だが不完全。
* **0.1–0.3**: 弱い要約 – 重要な抜けや誤りが多い。
* **0.0**: 失敗した要約 – ほとんど不正確、または重要な内容が欠落している。

### 要約に関する情報 \{#summarization-info\}

スコアの説明。詳細は以下を含みます:

* 入力の事実内容との整合性
* ソースの主要ポイントの網羅状況
* 整合性と網羅性の個別スコア
* 何が維持され、何が省かれ、何が誤って記述されたかの根拠

<GithubLink outdated={true} marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/evals/summarization" />