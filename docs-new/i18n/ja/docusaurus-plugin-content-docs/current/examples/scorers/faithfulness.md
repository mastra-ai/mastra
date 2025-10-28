---
title: "忠実性"
description: コンテキストに照らして、応答の事実の正確さを評価するために Faithfulness スコアラーを使用する例。
---

# 忠実度スコアラー \{#faithfulness-scorer\}

`createFaithfulnessScorer` を使用すると、レスポンスの主張が提供されたコンテキストに裏付けられているかを評価できます。スコアラーは `query` と `response` を受け取り、スコアと、その理由を含む `info` オブジェクトを返します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> APIの完全なドキュメントと構成オプションについては、[`createFaithfulnessScorer`](/docs/reference/scorers/faithfulness)を参照してください。

## 高い忠実性の例 \{#high-faithfulness-example\}

この例では、応答がコンテキストと緊密に一致しています。出力内の各記述は検証可能で、提供されたコンテキスト項目によって裏付けられており、高い評価につながります。

```typescript filename="src/example-high-faithfulness.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { createFaithfulnessScorer } from "@mastra/evals/scorers/llm";

const scorer = createFaithfulnessScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "Tesla Model 3は2017年に発売されました。",
    "航続距離は最大358マイルです。",
    "ベースモデルは0-60 mphを5.8秒で加速します。"
  ]
});

const query = "Tesla Model 3について教えてください。";
const response = "Tesla Model 3は2017年に発表されました。1回の充電で最大358マイル走行でき、ベースバージョンは0-60 mphを5.8秒で加速します。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 忠実度の高い出力 \{#high-faithfulness-output\}

この出力は、提示されたすべての情報が文脈に直接たどれて確認できるため、スコアは1となります。欠落や矛盾は一切ありません。

```typescript
{
  score: 1,
  reason: 'スコアが1である理由は、出力内のすべての主張が提供されたコンテキストによって裏付けられているためです。'
}
```

## 忠実性が混在する例 \{#mixed-faithfulness-example\}

この例では、裏付けのある主張と裏付けのない主張が混在しています。応答の一部は文脈によって支えられていますが、他の部分は元の資料にない新情報を持ち込んでいます。

```typescript filename="src/example-mixed-faithfulness.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { createFaithfulnessScorer } from "@mastra/evals/scorers/llm";

const scorer = createFaithfulnessScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "Pythonはグイド・ヴァンロッサムによって作成されました。",
    "最初のバージョンは1991年にリリースされました。",
    "Pythonはコードの可読性を重視しています。"
  ]
});

const query = "Pythonについて教えてください";
const response = "Pythonはグイド・ヴァンロッサムによって作成され、1991年にリリースされました。現在最も人気のあるプログラミング言語であり、世界中の数百万人の開発者に使用されています。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 忠実性が混在した出力 \{#mixed-faithfulness-output\}

応答の一部しか検証できないため、スコアが低くなっています。いくつかの主張は文脈と一致していますが、他は未確認または範囲外で、全体としての忠実性が低下しています。

```typescript
{
  score: 0.5,
  reason: "スコアが0.5である理由は、4つの主張のうち2つ(PythonはGuido van Rossumによって作成された、Pythonは1991年にリリースされた)はコンテキストで裏付けられていますが、残りの2つの主張(Pythonの人気と使用状況)はコンテキストに記載がないため検証できないためです。"
}
```

## 忠実性が低い例 \{#low-faithfulness-example\}

この例では、回答が文脈と直接矛盾しています。どの主張にも根拠がなく、いくつかは提示された事実と食い違っています。

```typescript filename="src/example-low-faithfulness.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { createFaithfulnessScorer } from "@mastra/evals/scorers/llm";

const scorer = createFaithfulnessScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "火星は太陽から4番目の惑星です。",
    "主に二酸化炭素からなる薄い大気を持っています。",
    "火星の周りには2つの小さな衛星、フォボスとダイモスが周回しています。"
  ]
});

const query = "火星について何がわかっていますか?";
const response = "火星は太陽から3番目の惑星です。酸素と窒素が豊富な厚い大気を持ち、3つの大きな衛星が周回しています。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 忠実度の低い出力 \{#low-faithfulness-output\}

各主張が不正確、または文脈と矛盾しているため、スコアは0になります。

```typescript
{
  score: 0,
  reason: "スコアが0である理由は、出力に含まれるすべての主張が提供されたコンテキストと矛盾しているためです。出力では火星が太陽から3番目の惑星であると述べていますが、コンテキストでは明確に4番目であると記載されています。さらに、火星には酸素と窒素が豊富な厚い大気があると主張していますが、これはコンテキストで説明されている主に二酸化炭素で構成される薄い大気という記述と矛盾しています。最後に、出力では火星が3つの大きな衛星に周回されていると述べていますが、コンテキストではフォボスとダイモスという2つの小さな衛星のみを持つと明記されています。したがって、裏付けられる主張が一つも存在せず、スコアは0となります。"
}
```

## 設定 \{#configuration\}

オプションのパラメーターを構成することで、`FaithfulnessScorer` がレスポンスをどのように採点するかを調整できます。たとえば、`scale` はスコアラーが返す最大スコアを指定します。

```typescript showLineNumbers copy
const scorer = createFaithfulnessScorer({ model: openai("gpt-4o-mini"), options: {
  context: [""],
  scale: 1
});
```

> 設定オプションの一覧については、[FaithfulnessScorer](/docs/reference/scorers/faithfulness) を参照してください。

## 結果の概要 \{#understanding-the-results\}

`.run()` は次の形の結果を返します：

```typescript
{
  runId: string,
  extractStepResult: string[],
  extractPrompt: string,
  analyzeStepResult: {
    verdicts: Array<{ verdict: 'yes' | 'no' | 'unsure', reason: string }>
  },
  analyzePrompt: string,
  score: number,
  reason: string,
  reasonPrompt: string
}
```

### score \{#score\}

0〜1 の範囲の忠実度スコア:

* **1.0**: すべての主張が正確で、文脈に直接裏付けられている。
* **0.7–0.9**: ほとんどの主張は正しいが、軽微な付加や省略がある。
* **0.4–0.6**: 一部の主張は裏付けられているが、他は検証不能。
* **0.1–0.3**: 内容の大半が不正確、または裏付けがない。
* **0.0**: すべての主張が誤り、または文脈と矛盾している。

### runId \{#runid\}

このスコアラーの実行を一意に識別する ID。

### extractStepResult \{#extractstepresult\}

出力から抽出されたクレーム（主張）の配列。

### extractPrompt \{#extractprompt\}

抽出ステップで LLM に送信されるプロンプト。

### analyzeStepResult \{#analyzestepresult\}

各クレームごとの判定を含むオブジェクト:

* **verdicts**: 各クレームについて、`verdict`（&#39;yes&#39;、&#39;no&#39;、または &#39;unsure&#39;）と `reason` を持つオブジェクトの配列。

### analyzePrompt \{#analyzeprompt\}

analyze ステップで LLM に送信されるプロンプト。

### reasonPrompt \{#reasonprompt\}

reason ステップで LLM に送信されるプロンプト。

### reason \{#reason\}

スコアの詳細な説明。どの主張が支持されたか、どれが反証されたか、または不確かとされたかを示します。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/faithfulness" />