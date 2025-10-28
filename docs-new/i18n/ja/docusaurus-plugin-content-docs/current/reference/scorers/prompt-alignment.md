---
title: "リファレンス: Prompt Alignment Scorer"
description: Mastra の Prompt Alignment Scorer に関するドキュメント。エージェントの応答がユーザーのプロンプトの意図、要件、網羅性、適切性にどの程度整合しているかを、多面的な分析で評価します。
---

# プロンプト整合性スコアラー \{#prompt-alignment-scorer\}

`createPromptAlignmentScorerLLM()` 関数は、エージェントの応答がユーザープロンプトにどの程度合致しているかを、意図の理解、要件の満たし具合、応答の完整性、形式の適切性といった複数の観点から評価するスコアラーを作成します。

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel",
description: "プロンプトと応答の整合性を評価するために使用する言語モデル",
required: true,
},
{
name: "options",
type: "PromptAlignmentOptions",
description: "スコアリングの設定オプション",
required: false,
children: [
{
name: "scale",
type: "number",
description: "最終スコアに掛けるスケール係数（既定値: 1）",
required: false,
},
{
name: "evaluationMode",
type: "'user' | 'system' | 'both'",
description: "評価モード — 'user' はユーザープロンプトとの整合性のみ、'system' はシステム要件の遵守のみ、'both' は重み付きスコアで両方を評価（既定値: 'both'）",
required: false,
},
],
},
]}
/>

## .run() の戻り値 \{#run-returns\}

<PropertiesTable
  content={[
{
name: "score",
type: "number",
description: "0 から scale（既定では 0〜1）までの多次元アラインメント・スコア",
},
{
name: "reason",
type: "string",
description: "プロンプトのアラインメント評価に関する、人間が読める詳細な説明と内訳",
},
]}
/>

## スコアリングの詳細 \{#scoring-details\}

### 多次元分析 \{#multi-dimensional-analysis\}

Prompt Alignment は、評価モードに応じて変化する重み付きスコアリングにより、4つの主要な観点で応答を評価します。

#### ユーザーモード（&quot;user&quot;） \{#user-mode-user\}

ユーザーのプロンプトとの整合性のみを評価します：

1. **意図の整合性**（重み 40%）- 応答がユーザーの核心的な要望に応えているか
2. **要件の充足**（重み 30%）- すべてのユーザー要件が満たされているか
3. **完全性**（重み 20%）- ユーザーのニーズに対して十分に網羅的か
4. **応答の適切性**（重み 10%）- 形式とトーンがユーザーの期待に合っているか

#### システムモード（&quot;system&quot;） \{#system-mode-system\}

システムガイドラインへの準拠のみを評価します：

1. **意図整合性**（重み35%）- 応答がシステムの行動ガイドラインに従っているか
2. **要件充足**（重み35%）- すべてのシステム制約が守られているか
3. **完全性**（重み15%）- 応答がすべてのシステム規則に準拠しているか
4. **応答の適切性**（重み15%）- 形式とトーンがシステム仕様に適合しているか

#### 両方モード（&quot;both&quot; - デフォルト） \{#both-mode-both-default\}

ユーザーとシステムの両方のアラインメントを評価して統合します:

* **ユーザーアラインメント**: 最終スコアの70%（ユーザーモードの重みを使用）
* **システムコンプライアンス**: 最終スコアの30%（システムモードの重みを使用）
* ユーザー満足度とシステム準拠の両立をバランスよく評価

### スコア計算式 \{#scoring-formula\}

**ユーザーモード：**

```
重み付きスコア = (intent_score × 0.4) + (requirements_score × 0.3) +
                 (completeness_score × 0.2) + (appropriateness_score × 0.1)
最終スコア = 重み付きスコア × scale
```

**システム モード:**

```
重み付けスコア = (intent_score × 0.35) + (requirements_score × 0.35) +
                 (completeness_score × 0.15) + (appropriateness_score × 0.15)
最終スコア = 重み付けスコア × scale
```

**両方モード（既定）：**

```
ユーザースコア = （ユーザーの各指標にユーザーの重みを適用）
システムスコア = （システムの各指標にシステムの重みを適用）
加重スコア = （ユーザースコア × 0.7）+（システムスコア × 0.3）
最終スコア = 加重スコア × スケール
```

**重み付けの根拠**:

* **User Mode**: ユーザー満足のため、意図（40%）と要件（30%）を優先
* **System Mode**: 行動順守（35%）と制約（35%）を同等に重視
* **Both Mode**: 70/30 の配分で、システム順守を維持しつつユーザーのニーズを優先

### スコアの解釈 \{#score-interpretation\}

* **0.9-1.0** = すべての側面で極めて高い整合性
* **0.8-0.9** = わずかな不足はあるが非常に高い整合性
* **0.7-0.8** = 良好だが、一部の要件や網羅性に欠ける
* **0.6-0.7** = 目立つ不足がある中程度の整合性
* **0.4-0.6** = 重大な問題がある不十分な整合性
* **0.0-0.4** = 極めて低い整合性で、回答がプロンプトに十分対応していない

### 他のスコアラーとの比較 \{#comparison-with-other-scorers\}

| 側面           | Prompt Alignment                           | Answer Relevancy             | Faithfulness                     |
| -------------- | ------------------------------------------ | ---------------------------- | -------------------------------- |
| **焦点**       | 多面的なプロンプト遵守                     | クエリと応答の関連性         | コンテキストに基づく根拠性       |
| **評価**       | 意図、要件、網羅性、形式                   | クエリとの意味的類似性       | コンテキストとの事実整合性       |
| **ユースケース** | 一般的なプロンプト追従                   | 情報検索                     | RAG／コンテキストベースのシステム |
| **次元**       | 重み付きの4次元                            | 単一の関連性次元             | 単一の忠実性次元                 |

### 各モードを使うタイミング \{#when-to-use-each-mode\}

**User モード (`'user'`)** - 次のような場合に使用:

* カスタマーサポートの回答をユーザー満足度の観点で評価する
* ユーザー視点でコンテンツ生成の品質をテストする
* 回答がユーザーの質問にどれだけ適切に対処しているかを測定する
* システム上の制約を意識せず、リクエストの充足に専念する

**System モード (`'system'`)** - 次のような場合に使用:

* 行動ガイドラインへの適合性と AI セーフティを監査する
* エージェントがブランドの声・トーン要件に従っているかを確保する
* コンテンツポリシーや各種制約の順守を検証する
* システムレベルの行動一貫性をテストする

**Both モード (`'both'`)** - 次のような場合に使用（デフォルト・推奨）:

* AI エージェントの総合的なパフォーマンスを評価する
* ユーザー満足度とシステム順守のバランスを取る
* ユーザー要件とシステム要件の双方が重要な本番監視
* プロンプトとレスポンスの整合性を包括的に評価する

## 使い方の例 \{#usage-examples\}

### 基本構成 \{#basic-configuration\}

```typescript
import { openai } from '@ai-sdk/openai';
import { createPromptAlignmentScorerLLM } from '@mastra/evals';

const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o'),
});

// コード生成タスクを評価
const result = await scorer.run({
  input: [
    {
      role: 'user',
      content: 'エラー処理付きで階乗を計算する Python 関数を書いてください',
    },
  ],
  output: {
    role: 'assistant',
    text: `def factorial(n):
    if n < 0:
        raise ValueError("負の数の階乗は定義されていません")
    if n == 0:
        return 1
    return n * factorial(n-1)`,
  },
});
// 結果: { score: 0.95, reason: "整合性が非常に高い - 関数は意図に沿っており、エラー処理も含まれています..." }
```

### カスタム構成の例 \{#custom-configuration-examples\}

```typescript
// スケールと評価モードを設定
const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o'),
  options: {
    scale: 10, // スコアを 0–1 ではなく 0–10 で評価
    evaluationMode: 'both', // 'user'、'system'、または 'both'（デフォルト）
  },
});

// ユーザー評価のみ - ユーザー満足度を重視
const userScorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o'),
  options: { evaluationMode: 'user' },
});

// システム評価のみ - ルール順守を重視
const systemScorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o'),
  options: { evaluationMode: 'system' },
});

const result = await scorer.run(testRun);
// 結果: { score: 8.5, reason: "10 点満点中 8.5 点 - ユーザーの意図とシステムのガイドラインの双方に良好に整合しています..." }
```

### フォーマット固有の評価 \{#format-specific-evaluation\}

```typescript
// 箇条書きのフォーマットを評価する
const result = await scorer.run({
  input: [
    {
      role: 'user',
      content: 'TypeScript の利点を箇条書きで挙げてください',
    },
  ],
  output: {
    role: 'assistant',
    text: 'TypeScript は静的型付け、優れた IDE サポート、そしてコードの信頼性の向上に寄与します。',
  },
});
// 結果: フォーマットの不一致（段落 vs 箇条書き）により適合度スコアが低下
```

## 使い方のパターン \{#usage-patterns\}

### コード生成の評価 \{#code-generation-evaluation\}

次の評価に最適です:

* プログラミングタスクの達成度
* コードの品質と完全性
* コーディング要件の遵守
* 形式要件（関数、クラスなど）

```typescript
// 例: API エンドポイントの作成
const codePrompt = '認証とレート制限を備えた REST API エンドポイントを作成する';
// スコアラーが評価する項目: 意図（API の作成）、要件（認証 + レート制限）、
// 完全性（実装が一通り揃っているか）、形式（コード構造）
```

### 指示追従評価 \{#instruction-following-assessment\}

最適な用途:

* タスク完了の確認
* 複数手順の指示への準拠
* 要件の遵守確認
* 教育コンテンツの評価

```typescript
// 例: 複数の要件があるタスク
const taskPrompt = '初期化、検証、エラー処理、ドキュメンテーションを備えた Python クラスを書いてください';
// スコアラーは各要件を個別に追跡し、詳細な内訳を提供します
```

### コンテンツ形式の検証 \{#content-format-validation\}

活用シーン:

* 形式仕様の順守
* スタイルガイドの順守
* 出力構造の確認
* 応答の適切性の確認

```typescript
// 例: 構造化出力
const formatPrompt = '箇条書きで、JavaScript における let と const の違いを説明してください';
// スコアラーは内容の正確性と形式順守の両方を評価します
```

## 主なユースケース \{#common-use-cases\}

### 1. エージェントの応答品質 \{#1-agent-response-quality\}

AIエージェントがユーザーの指示にどれだけ適切に従っているかを測定します。

```typescript
const agent = new Agent({
  name: 'CodingAssistant',
  instructions: 'あなたは頼りになるコーディングアシスタントです。必ず動作するコード例を提示してください。',
  model: openai('gpt-4o'),
});

// 包括的な整合性を評価（デフォルト）
const scorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: { evaluationMode: 'both' }, // ユーザーの意図とシステム指針の両方を評価
});

// ユーザー満足のみを評価
const userScorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: { evaluationMode: 'user' }, // ユーザーの要望の達成にのみ注力
});

// システムへの準拠を評価
const systemScorer = createPromptAlignmentScorerLLM({
  model: openai('gpt-4o-mini'),
  options: { evaluationMode: 'system' }, // システム指示への準拠を確認
});

const result = await scorer.run(agentRun);
```

### 2. プロンプトエンジニアリングの最適化 \{#2-prompt-engineering-optimization\}

アライメントを改善するために、さまざまなプロンプトを試験します。

```typescript
const prompts = [
  '階乗を計算する関数を書いてください',
  '負の入力を考慮したエラーハンドリング付きの、階乗を計算するPython関数を作成してください',
  '入力検証・エラーハンドリング・docstringを備えたPythonの階乗計算プログラムを実装してください',
];

// アラインメントスコアを比較して最適なプロンプトを見つける
for (const prompt of prompts) {
  const result = await scorer.run(createTestRun(prompt, response));
  console.log(`プロンプトのアラインメント: ${result.score}`);
}
```

### 3. マルチエージェントシステムの評価 \{#3-multi-agent-system-evaluation\}

異なるエージェントやモデルを比較します。

```typescript
const agents = [agent1, agent2, agent3];
const testPrompts = [...]; // テスト用プロンプトの配列

for (const agent of agents) {
  let totalScore = 0;
  for (const prompt of testPrompts) {
    const response = await agent.run(prompt);
    const evaluation = await scorer.run({ input: prompt, output: response });
    totalScore += evaluation.score;
  }
  console.log(`${agent.name} の平均アラインメント: ${totalScore / testPrompts.length}`);
}
```

## エラー処理 \{#error-handling\}

このスコアラーは、さまざまな端境的なケースも含め、想定外の状況を適切に処理します。

```typescript
// ユーザーのプロンプトが不足しています
try {
  await scorer.run({ input: [], output: response });
} catch (error) {
  // エラー: 「プロンプト整合性のスコアリングには、ユーザーのプロンプトとエージェントの応答の両方が必要です」
}

// 空の応答
const result = await scorer.run({
  input: [userMessage],
  output: { role: 'assistant', text: '' },
});
// 不完全である旨の詳細な理由付きで低スコアを返します
```

## 関連 \{#related\}

* [Answer Relevancy Scorer](/docs/reference/scorers/answer-relevancy) - クエリと応答の関連性を評価
* [Faithfulness Scorer](/docs/reference/scorers/faithfulness) - 文脈への忠実性を測定
* [Tool Call Accuracy Scorer](/docs/reference/scorers/tool-call-accuracy) - ツール選択の適切さを評価
* [Custom Scorers](/docs/scorers/custom-scorers) - 独自の評価指標を作成