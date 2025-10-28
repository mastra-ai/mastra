---
title: "概要"
description: Mastra に用意されているツールの種類、エージェントへの追加方法、効果的なツール設計のベストプラクティスを理解しましょう。
sidebar_position: 1
---

# 概要 \{#overview\}

ツールは、エージェントが特定のタスクを実行したり外部情報にアクセスしたりするために呼び出せる関数です。これにより、単なるテキスト生成を超えて、API、データベース、その他のシステムとのやり取りが可能になります。

各ツールは通常、次の要素を定義します:

* **入力:** ツールの実行に必要な情報（`inputSchema` で定義され、Zod がよく用いられます）。
* **出力:** ツールが返すデータの構造（`outputSchema` で定義）。
* **実行ロジック:** ツールの処理を行うコード。
* **説明:** ツールの機能と使用タイミングをエージェントが理解するのに役立つテキスト。

## ツールの作成 \{#creating-tools\}

Mastra では、`@mastra/core/tools` パッケージの [`createTool`](/docs/reference/tools/create-tool) 関数を使ってツールを作成します。

```typescript filename="src/mastra/tools/weatherInfo.ts" copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const getWeatherInfo = async (city: string) => {
  // 実際の天気サービスAPIの呼び出しに置き換えてください
  console.log(`${city}の天気情報を取得中...`);
  // データ構造の例
  return { temperature: 20, conditions: '晴れ' };
};

export const weatherTool = createTool({
  id: '天気情報取得',
  description: `指定された都市の現在の天気情報を取得します`,
  inputSchema: z.object({
    city: z.string().describe('都市名'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context: { city } }) => {
    console.log('ツールを使用して天気情報を取得中:', city);
    return await getWeatherInfo(city);
  },
});
```

この例では、都市名の入力スキーマ、天気データの出力スキーマ、そしてツールのロジックを実装する `execute` 関数を備えた `weatherTool` を定義しています。

ツールを作成する際は、ツールの説明はシンプルに保ち、ツールが**何を**行い、**いつ**使うべきかという点に絞り、主要なユースケースを強調してください。技術的な詳細はパラメータスキーマに記述し、わかりやすい名前、明確な説明、デフォルト値の説明によって、エージェントがツールを正しく*どのように*使うかを導きます。

## エージェントにツールを追加する \{#adding-tools-to-an-agent\}

エージェントでツールを利用できるようにするには、エージェントの定義でツールを設定します。エージェントのシステムプロンプトに、利用可能なツールとその概要を記載しておくと、ツールの活用が改善される場合があります。詳しい手順や例については、[Using Tools and MCP with Agents](/docs/agents/using-tools-and-mcp#adding-tools-to-an-agent)のガイドを参照してください。

## ツールスキーマの互換レイヤー \{#compatibility-layer-for-tool-schemas\}

モデルによってスキーマの解釈は異なります。特定のスキーマプロパティが渡されるとエラーになるものもあれば、エラーは出さずに無視するものもあります。Mastra はツールスキーマに互換レイヤーを追加し、異なるモデルプロバイダー間でツールが一貫して動作し、スキーマの制約が順守されるようにします。

このレイヤーを適用している主なプロバイダー:

* **Google Gemini と Anthropic:** 非対応のスキーマプロパティを削除し、関連する制約をツールの説明に追記します。
* **OpenAI（推論モデルを含む）:** 無視される、または非対応のスキーマフィールドを削除または調整し、エージェントの指針となる説明への指示を追加します。
* **DeepSeek と Meta:** スキーマ整合性とツールの使い勝手を確保するため、同様の互換ロジックを適用します。

このアプローチにより、カスタムおよび MCP ツールのいずれにおいても、ツールの利用がより信頼性が高く、モデルに依存しないものになります。

## ローカルでのツールのテスト \{#testing-tools-locally\}

ツールを実行してテストする方法は、2つあります。

### Mastra Playground \{#mastra-playground\}

Mastra Dev Server を起動した状態で、ブラウザで [http://localhost:4111/tools](http://localhost:4111/tools) にアクセスすると、Mastra Playground からツールをテストできます。

> くわしくは、[Local Dev Playground](/docs/getting-started/local-dev-playground) のドキュメントをご覧ください。

### コマンドライン \{#command-line\}

`.execute()` を使ってツールを呼び出します。

```typescript filename="src/test-tool.ts" showLineNumbers copy
import { RuntimeContext } from '@mastra/core/runtime-context';
import { testTool } from './mastra/tools/test-tool';

const runtimeContext = new RuntimeContext();

const result = await testTool.execute({
  context: {
    value: 'foo',
  },
  runtimeContext,
});

console.log(result);
```

> 詳細は [createTool()](/docs/reference/tools/create-tool) を参照してください。

このツールをテストするには、次を実行してください:

```bash copy
npx tsx src/test-tool.ts
```
