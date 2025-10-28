---
title: "カスタム判定"
description: createScorer とプロンプトオブジェクトを使って、カスタムのスコアラーを作成する例。
---

# カスタムジャッジ用スコアラー \{#custom-judge-scorer\}

この例では、`createScorer` をプロンプトオブジェクトと組み合わせて、カスタムスコアラーを作成する方法を示します。言語モデルを判定役として用い、レシピにグルテンが含まれているかを評価する「Gluten Checker」を作成します。

## インストール \{#installation\}

```bash copy
npm install @mastra/core
```

> API の完全なドキュメントと設定オプションについては、[`createScorer`](/docs/reference/scorers/create-scorer)を参照してください。

## カスタムスコアラーを作成する \{#create-a-custom-scorer\}

Mastra のカスタムスコアラーは、4つの中核コンポーネントを備えた `createScorer` を使用します：

1. [**Judge 設定**](#judge-configuration)
2. [**分析ステップ**](#analysis-step)
3. [**スコア生成**](#score-generation)
4. [**理由生成**](#reason-generation)

これらのコンポーネントを組み合わせることで、LLM を審査員として用いたカスタム評価ロジックを定義できます。

> API 全体と設定オプションについては [createScorer](/docs/reference/scorers/create-scorer) を参照してください。

```typescript filename="src/mastra/scorers/gluten-checker.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';

export const GLUTEN_INSTRUCTIONS = `あなたは、レシピにグルテンが含まれているかを判定するシェフです。`;

export const generateGlutenPrompt = ({ output }: { output: string }) => `このレシピがグルテンフリーかどうかを確認してください。

チェック項目:
- 小麦
- 大麦
- ライ麦
- 小麦粉、パスタ、パンなどの一般的な原材料

グルテンを含む例:
"小麦粉と水を混ぜて生地を作る"
回答: {
  "isGlutenFree": false,
  "glutenSources": ["小麦粉"]
}

グルテンフリーの例:
"米、豆、野菜を混ぜる"
回答: {
  "isGlutenFree": true,
  "glutenSources": []
}

分析対象のレシピ:
${output}

次の形式で回答を返してください:
{
  "isGlutenFree": boolean,
  "glutenSources": ["グルテンを含む原材料のリスト"]
}`;

export const generateReasonPrompt = ({
  isGlutenFree,
  glutenSources,
}: {
  isGlutenFree: boolean;
  glutenSources: string[];
}) => `このレシピがグルテンフリー${isGlutenFree ? '' : 'ではない'}理由を説明してください。

${glutenSources.length > 0 ? `グルテンの原因: ${glutenSources.join(', ')}` : 'グルテンを含む原材料は見つかりませんでした'}

次の形式で回答を返してください:
"このレシピは[グルテンフリーである/グルテンを含む]。理由: [説明]"`;

export const glutenCheckerScorer = createScorer({
  name: 'Gluten Checker',
  description: '出力にグルテンが含まれているかを確認します',
  judge: {
    model: openai('gpt-4o'),
    instructions: GLUTEN_INSTRUCTIONS,
  },
})
  .analyze({
    description: '出力をグルテンの観点から分析します',
    outputSchema: z.object({
      isGlutenFree: z.boolean(),
      glutenSources: z.array(z.string()),
    }),
    createPrompt: ({ run }) => {
      const { output } = run;
      return generateGlutenPrompt({ output: output.text });
    },
  })
  .generateScore(({ results }) => {
    return results.analyzeStepResult.isGlutenFree ? 1 : 0;
  })
  .generateReason({
    description: 'スコアの根拠を生成します',
    createPrompt: ({ results }) => {
      return generateReasonPrompt({
        glutenSources: results.analyzeStepResult.glutenSources,
        isGlutenFree: results.analyzeStepResult.isGlutenFree,
      });
    },
  });
```

### ジャッジの設定 \{#judge-configuration\}

LLMモデルを設定し、その役割をドメインの専門家として定義します。

```typescript
judge: {
  model: openai('gpt-4o'),
  instructions: GLUTEN_INSTRUCTIONS,
}
```

### 分析ステップ \{#analysis-step\}

LLM が入力をどう分析し、どのような構造化出力を返すかを定義します。

```typescript
.analyze({
  description: 'グルテンの有無を分析',
  outputSchema: z.object({
    isGlutenFree: z.boolean(),
    glutenSources: z.array(z.string()),
  }),
  createPrompt: ({ run }) => {
    const { output } = run;
    return generateGlutenPrompt({ output: output.text });
  },
})
```

分析ステップでは、プロンプトオブジェクトを使用して次を行います:

* 分析タスクを明確に記述する
* 期待される出力構造を Zod スキーマで定義する（真偽値の結果とグルテン源のリストの両方）
* 入力内容に基づいて動的なプロンプトを生成する

### スコア生成 \{#score-generation\}

LLM の構造化分析を数値スコアに変換します。

```typescript
.generateScore(({ results }) => {
  return results.analyzeStepResult.isGlutenFree ? 1 : 0;
})
```

スコア生成関数は分析結果を受け取り、ビジネスロジックを適用してスコアを算出します。今回の場合は、LLM がレシピがグルテンフリーかどうかを直接判定するため、その真偽値の結果を用います。グルテンフリーなら 1、グルテンを含むなら 0 とします。

### 理由生成 \{#reason-generation\}

別の LLM 呼び出しによって、スコアの根拠を人間にわかりやすく説明します。

```typescript
.generateReason({
  description: 'スコアの理由を生成する',
  createPrompt: ({ results }) => {
    return generateReasonPrompt({
      glutenSources: results.analyzeStepResult.glutenSources,
      isGlutenFree: results.analyzeStepResult.isGlutenFree,
    });
  },
})
```

理由生成ステップでは、ブール結果と分析ステップで特定された具体的なグルテン源の両方を用いて、特定のスコアが割り当てられた理由をユーザーが理解できるように説明を作成します。

````

## グルテンフリー度が高い例

```typescript filename="src/example-high-gluten-free.ts" showLineNumbers copy
const result = await glutenCheckerScorer.run({
  input: [{ role: 'user', content: '米、豆、野菜を混ぜる' }],
  output: { text: '米、豆、野菜を混ぜる' },
});

console.log('スコア:', result.score);
console.log('グルテン源:', result.analyzeStepResult.glutenSources);
console.log('理由:', result.reason);
````

### 高いグルテン不含有の出力 \{#high-gluten-free-output\}

```typescript
{
  score: 1,
  analyzeStepResult: {
    isGlutenFree: true,
    glutenSources: []
  },
  reason: 'このレシピはグルテンフリーです。米、豆、野菜は天然のグルテンフリー食材であり、セリアック病の方も安心してお召し上がりいただけます。'
}
```

## グルテンの部分例 \{#partial-gluten-example\}

```typescript filename="src/example-partial-gluten.ts" showLineNumbers copy
const result = await glutenCheckerScorer.run({
  input: [{ role: 'user', content: '小麦粉と水を混ぜて生地を作る' }],
  output: { text: '小麦粉と水を混ぜて生地を作る' },
});

console.log('スコア:', result.score);
console.log('グルテン源:', result.analyzeStepResult.glutenSources);
console.log('理由:', result.reason);
```

### グルテンの部分出力 \{#partial-gluten-output\}

```typescript
{
  score: 0,
  analyzeStepResult: {
    isGlutenFree: false,
    glutenSources: ['flour']
  },
  reason: 'このレシピは小麦粉を含むため、グルテンフリーではありません。一般的な小麦粉は小麦由来でグルテンを含むため、セリアック病やグルテン過敏症の方には安全ではありません。'
}
```

## 低グルテンの例 \{#low-gluten-free-example\}

```typescript filename="src/example-low-gluten-free.ts" showLineNumbers copy
const result = await glutenCheckerScorer.run({
  input: [{ role: 'user', content: '醤油と麺を加える' }],
  output: { text: '醤油と麺を加える' },
});

console.log('スコア:', result.score);
console.log('グルテン源:', result.analyzeStepResult.glutenSources);
console.log('理由:', result.reason);
```

### 低グルテンフリー出力 \{#low-gluten-free-output\}

```typescript
{
  score: 0,
  analyzeStepResult: {
    isGlutenFree: false,
    glutenSources: ['しょうゆ', '麺']
  },
  reason: 'このレシピは、しょうゆと麺を含むためグルテンフリーではありません。一般的なしょうゆには小麦が含まれ、ほとんどの麺は小麦粉で作られています。いずれにもグルテンが含まれており、グルテン過敏症の方には安全ではありません。'
}
```

## 結果の概要 \{#understanding-the-results\}

`.run()` は次の形式の結果を返します：

```typescript
{
  runId: string,
  analyzeStepResult: {
    isGlutenFree: boolean,
    glutenSources: string[]
  },
  score: number,
  reason: string,
  analyzePrompt?: string,
  generateReasonPrompt?: string
}
```

### score \{#score\}

スコアが1なら、そのレシピはグルテンフリーです。スコアが0なら、グルテンが検出されたことを意味します。

### runId \{#runid\}

このスコアラー実行の一意の識別子。

### analyzeStepResult \{#analyzestepresult\}

グルテン分析を表すオブジェクト:

* **isGlutenFree**: レシピがグルテンフリーの食事に適しているかを示すブール値
* **glutenSources**: レシピ内で見つかったグルテン含有食材の配列

### 理由 \{#reason\}

そのレシピがグルテンフリーかどうかの説明。LLM によって生成されます。

### プロンプト項目 \{#prompt-fields\}

* **analyzePrompt**: 解析のために LLM に送信される実際のプロンプト
* **generateReasonPrompt**: 推論のために LLM に送信される実際のプロンプト

<GithubLink marginTop="mt-16" link="https://github.com/mastra-ai/mastra/blob/main/examples/basics/scorers/custom-scorer" />