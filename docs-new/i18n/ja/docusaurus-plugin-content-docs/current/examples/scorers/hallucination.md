---
title: "ハルシネーション"
description: 応答内の事実矛盾を評価するために Hallucination スコアラーを用いる例。
---

# ハルシネーションスコアラー \{#hallucination-scorer\}

`createHallucinationScorer` を使用して、応答が提供されたコンテキストのいずれかの部分と矛盾していないかを評価します。

## インストール \{#installation\}

```bash copy
npm install @mastra/evals
```

> API の完全なドキュメントおよび設定オプションについては、[`createHallucinationScorer`](/docs/reference/scorers/hallucination)を参照してください。

## 幻覚なしの例 \{#no-hallucination-example\}

この例では、応答は提供されたコンテキストと完全に整合しています。すべての主張は事実に基づいて正しく、ソース資料によって直接裏付けられているため、幻覚スコアは低くなります。

```typescript filename="src/example-no-hallucination.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { createHallucinationScorer } from "@mastra/evals/scorers/llm";

const scorer = createHallucinationScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "iPhoneは2007年に初めて発売されました。",
    "Steve JobsがMacworldで発表しました。",
    "初代モデルは3.5インチの画面を搭載していました。"
  ]
});

const query = "初代iPhoneはいつ発売されましたか?";
const response = "iPhoneは2007年に初めて発売され、Steve JobsがMacworldで発表しました。初代iPhoneは3.5インチの画面を搭載していました。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 幻覚のない出力 \{#no-hallucination-output\}

矛盾がないため、この回答のスコアは0です。すべての記述が文脈に整合しており、新たな情報や捏造された情報は付け加えられていません。

```typescript
{
  score: 0,
  reason: 'スコアが0なのは、コンテキストのいずれの記述も出力と矛盾していないためです。'
}
```

## 混合型ハルシネーションの例 \{#mixed-hallucination-example\}

この例では、応答には正確な主張と不正確な主張が併存しています。いくつかの詳細はコンテキストと一致している一方で、誇張された数値や誤った場所など、他の点はそれと明確に矛盾しています。こうした矛盾により、ハルシネーションスコアが上昇します。

```typescript filename="src/example-mixed-hallucination.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { createHallucinationScorer } from "@mastra/evals/scorers/llm";

const scorer = createHallucinationScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "最初のスター・ウォーズ映画は1977年に公開されました。",
    "ジョージ・ルーカス監督作品です。",
    "この映画は世界興行収入7億7500万ドルを記録しました。",
    "撮影はチュニジアとイングランドで行われました。"
  ]
});

const query = "最初のスター・ウォーズ映画について教えてください。";
const response = "最初のスター・ウォーズ映画は1977年に公開され、ジョージ・ルーカス監督作品です。興行収入は10億ドル以上を記録し、全編カリフォルニアで撮影されました。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);
```

### 混在型ハルシネーション出力 \{#mixed-hallucination-output\}

Scorer は、応答の一部が文脈と矛盾しているため、中程度のスコアを付与します。いくつかの事実は正しい一方で、ほかは不正確または作為的であり、全体としての信頼性を損ないます。

```typescript
{
  score: 0.5,
  reason: 'スコアが0.5である理由は、出力の4つの記述のうち2つがコンテキストの主張と矛盾しており、正確な情報と不正確な情報が均衡していることを示しているためです。'
}
```

## 完全なハルシネーションの例 \{#complete-hallucination-example\}

この例では、応答がコンテキスト内のあらゆる重要な事実と矛盾しています。どの主張も裏付けが取れず、示された詳細はすべて事実と異なります。

```typescript filename="src/example-complete-hallucination.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { createHallucinationScorer } from "@mastra/evals/scorers/llm";

const scorer = createHallucinationScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "ライト兄弟は1903年に初飛行を行った。",
    "飛行時間は12秒だった。",
    "飛行距離は120フィートだった。"
  ]
});

const query = "ライト兄弟が初めて飛行したのはいつですか?";
const response = "ライト兄弟は1908年に歴史的な初飛行を達成しました。飛行時間は約2分で、距離はほぼ1マイルでした。";

const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});

console.log(result);

```

### 完全なハルシネーション出力 \{#complete-hallucination-output\}

Scorer は、応答内のあらゆる記述がコンテキストと矛盾しているため、スコア 1 を付与します。詳細は一貫して捏造されているか、不正確です。

```typescript
{
  score: 1,
  reason: 'スコアが1.0である理由は、出力の3つの記述すべてがコンテキストと直接矛盾しているためです：初飛行は1908年ではなく1903年、飛行時間は約2分ではなく12秒、飛行距離はほぼ1マイルではなく120フィートでした。'
}
```

## 設定 \{#configuration\}

任意のパラメーターを設定して、`HallucinationScorer` がレスポンスをどのように採点するかを調整できます。たとえば、`scale` はスコアラーが返すスコアの最大値を設定します。

```typescript
const scorer = createHallucinationScorer({ model: openai("gpt-4o-mini"), options: {
  context: [""],
  scale: 1
});
```

> 設定オプションの一覧は [HallucinationScorer](/docs/reference/scorers/hallucination) を参照してください。

## 結果の理解 \{#understanding-the-results\}

`.run()` は次の形の結果を返します：

```typescript
{
  runId: string,
  extractStepResult: { claims: string[] },
  extractPrompt: string,
  analyzeStepResult: {
    verdicts: Array<{ statement: string, verdict: 'yes' | 'no', reason: string }>
  },
  analyzePrompt: string,
  score: number,
  reason: string,
  reasonPrompt: string
}
```

### score \{#score\}

0〜1 の範囲のハルシネーション・スコア:

* **0.0**: ハルシネーションなし — すべての主張が文脈と一致。
* **0.3–0.4**: 低レベルのハルシネーション — いくつかの矛盾。
* **0.5–0.6**: 混在したハルシネーション — 複数の矛盾。
* **0.7–0.8**: 高レベルのハルシネーション — 多くの矛盾。
* **0.9–1.0**: 完全なハルシネーション — ほとんど、あるいはすべての主張が文脈と矛盾。

### runId \{#runid\}

このスコアラーの実行に固有の識別子。

### extractStepResult \{#extractstepresult\}

出力から抽出された主張を含むオブジェクト:

* **claims**: コンテキストと照合して検証する事実の記述の配列。

### extractPrompt \{#extractprompt\}

抽出ステップでLLMに送信するプロンプト。

### analyzeStepResult \{#analyzestepresult\}

各主張に対する判定を含むオブジェクト:

* **verdicts**: 各主張について、`statement`、`verdict`（「yes」または「no」）、`reason` を含むオブジェクトの配列。

### analyzePrompt \{#analyzeprompt\}

analyze ステップで LLM に送信されるプロンプト。

### reasonPrompt \{#reasonprompt\}

reason ステップで LLM に送信されるプロンプト。

### 理由 \{#reason\}

スコアの詳細な説明と、特定された矛盾の内容。

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/hallucination" />