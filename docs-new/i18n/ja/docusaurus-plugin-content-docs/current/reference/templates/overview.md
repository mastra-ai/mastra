---
title: "テンプレート リファレンス"
description: "Mastra テンプレートの作成・使用・貢献のための完全ガイド"
---

## 概要 \{#overview\}

このリファレンスでは、既存テンプレートの使い方、自作方法、コミュニティエコシステムへの貢献方法など、Mastra のテンプレートに関する包括的な情報を提供します。

Mastra のテンプレートは、特定のユースケースやパターンを示す、あらかじめ用意されたプロジェクト構成です。これらは次の内容を提供します:

* **動作サンプル** - 完成済みで実行可能な Mastra アプリケーション
* **ベストプラクティス** - 適切なプロジェクト構成とコーディング規約
* **学習リソース** - 実装例を通じて Mastra のパターンを学べる教材
* **クイックスタート** - ゼロから作るよりも素早くプロジェクトを立ち上げ

## テンプレートを使用する \{#using-templates\}

### インストール \{#installation\}

`create-mastra` コマンドでテンプレートをインストールします：

```bash copy
npx create-mastra@latest --template テンプレート名
```

これにより、必要なコードと設定がすべて揃った完全なプロジェクトが作成されます。

### セットアップ手順 \{#setup-process\}

インストール後：

1. **プロジェクトディレクトリへ移動**：

   ```bash copy
   cd your-project-name
   ```

2. **環境変数を設定**：

   ```bash copy
   cp .env.example .env
   ```

   テンプレートのREADMEの手順に従い、必要なAPIキーを `.env` に設定してください。

3. **依存関係をインストール**（自動で行われなかった場合）：

   ```bash copy
   npm install
   ```

4. **開発サーバーを起動**：

   ```bash copy
   npm run dev
   ```

### テンプレートの構成 \{#template-structure\}

すべてのテンプレートは、以下の標準構成に従います。

> ファイル構成の情報は用意されています。詳細なツリービューは原典のドキュメントをご覧ください。

## テンプレートを作成する \{#creating-templates\}

### 要件 \{#requirements\}

テンプレートは次の技術要件を満たす必要があります。

#### プロジェクト構成 \{#project-structure\}

* **Mastra のコード配置**: すべての Mastra のコードは `src/mastra/` ディレクトリに配置します
* **コンポーネント構成**:
  * エージェント: `src/mastra/agents/`
  * ツール: `src/mastra/tools/`
  * ワークフロー: `src/mastra/workflows/`
  * メイン設定: `src/mastra/index.ts`

#### TypeScript の設定 \{#typescript-configuration\}

標準の Mastra の TypeScript 設定を使用してください：

```json filename="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

#### 環境設定 \{#environment-configuration\}

必要な環境変数をすべて含む `.env.example` ファイルを用意してください:

```bash filename=".env.example"
# LLM プロバイダーの API キー（いずれかまたは複数を使用）
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# 必要に応じて使用するその他のサービスの API キー
OTHER_SERVICE_API_KEY=your_api_key_here
```

### コーディング規約 \{#code-standards\}

#### LLM プロバイダー \{#llm-provider\}

テンプレートには、OpenAI、Anthropic、または Google のモデルプロバイダーを推奨します。ユースケースに最も適したプロバイダーを選択してください。

```typescript filename="src/mastra/agents/example-agent.ts"
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
// または: import { anthropic } from '@ai-sdk/anthropic';
// または: import { google } from '@ai-sdk/google';

const agent = new Agent({
  name: 'example-agent',
  model: openai('gpt-4'), // または anthropic('')、または google('')
  instructions: 'エージェントへの指示をここに記述',
  // ... その他の設定
});
```

#### 互換性要件 \{#compatibility-requirements\}

テンプレートは次の条件を満たす必要があります:

* **単一プロジェクト** - 複数のアプリケーションを含むモノレポではないこと
* **フレームワーク非依存** - Next.js、Express、その他のウェブフレームワークのボイラープレートを含まないこと
* **Mastra に特化** - 余分なレイヤーを設けずに Mastra の機能を示すこと
* **マージ可能** - 既存プロジェクトへ容易に統合できるようコードを構成すること
* **Node.js 互換** - Node.js 18 以上をサポートすること
* **ESM モジュール** - ES モジュールを使用すること（package.json の `"type": "module"`）

### ドキュメント要件 \{#documentation-requirements\}

#### README の構成 \{#readme-structure\}

すべてのテンプレートには、内容の充実した README を必ず含めてください。

```markdown filename="README.md"
# テンプレート名

このテンプレートで実現する内容の簡潔な説明。

## 概要

テンプレートの機能と想定ユースケースの詳細な説明。

## セットアップ

1. `.env.example` を `.env` にコピーし、API キーを設定する
2. 依存関係をインストール: `npm install`
3. プロジェクトを起動: `npm run dev`

## 環境変数

- `OPENAI_API_KEY`: OpenAI の API キー。[OpenAI Platform](https://platform.openai.com/api-keys) で取得
- `ANTHROPIC_API_KEY`: Anthropic の API キー。[Anthropic Console](https://console.anthropic.com/settings/keys) で取得
- `GOOGLE_GENERATIVE_AI_API_KEY`: Google AI の API キー。[Google AI Studio](https://makersuite.google.com/app/apikey) で取得
- `OTHER_API_KEY`: このキーの用途の説明

## 使い方

テンプレートの使用方法と想定される動作例。

## カスタマイズ

さまざまなユースケース向けにテンプレートを調整するためのガイドライン。
```

#### コードコメント \{#code-comments\}

次の点を分かりやすく説明するコメントを記載してください:

* 複雑なロジックやアルゴリズム
* APIとの連携内容と目的
* 設定オプションとその効果
* 使用例・パターン

### 品質基準 \{#quality-standards\}

テンプレートは以下を満たす必要があります:

* **コード品質** - クリーンで、十分にコメントが付され、保守しやすいコード
* **エラー処理** - 外部 API やユーザー入力に対する適切な処理
* **型安全性** - Zod による検証を伴う完全な TypeScript の型付け
* **テスト** - 新規インストール環境で機能が検証済みであること

Mastra エコシステムに独自のテンプレートを投稿する方法については、コミュニティセクションの [Contributing Templates](/docs/community/contributing-templates) ガイドを参照してください。

:::note

テンプレートは、Mastra のパターンを学び、開発を加速するための優れた手段です。テンプレートへの貢献は、コミュニティ全体によるより良い AI アプリケーションの構築に役立ちます。

:::