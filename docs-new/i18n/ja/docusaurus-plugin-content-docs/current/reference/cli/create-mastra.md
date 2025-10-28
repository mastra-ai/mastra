---
title: "create-mastra "
description: インタラクティブなセットアップオプションで新規 Mastra プロジェクトを作成する `create-mastra` コマンドのドキュメント。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# create-mastra \{#create-mastra\}

`create-mastra` コマンドは、新しいスタンドアロンの Mastra プロジェクトを**作成**します。このコマンドを使うと、専用ディレクトリに完全な Mastra のセットアップを一式構築できます。セットアップ手順は、追加のフラグでカスタマイズできます。

## 使い方 \{#usage\}

<Tabs>
  <TabItem value="npm" label="npm">
    ```bash copy
    npx create-mastra@latest
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn dlx create-mastra@latest
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm create mastra@latest
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun create mastra@latest
    ```
  </TabItem>
</Tabs>

`create-mastra` は標準で*インタラクティブ*モードで動作しますが、コマンドライン引数でプロジェクト名やテンプレートを指定することもできます。

<Tabs>
  <TabItem value="npm-template" label="npm">
    ```bash copy
    npx create-mastra@latest my-mastra-project -- --template coding-agent
    ```
  </TabItem>

  <TabItem value="yarn-template" label="yarn">
    ```bash copy
    yarn dlx create-mastra@latest --template coding-agent
    ```
  </TabItem>

  <TabItem value="pnpm-template" label="pnpm">
    ```bash copy
    pnpm create mastra@latest --template coding-agent
    ```
  </TabItem>

  <TabItem value="bun-template" label="bun">
    ```bash copy
    bun create mastra@latest --template coding-agent
    ```
  </TabItem>
</Tabs>

テンプレートの[一覧](https://mastra.ai/api/templates.json)を参照し、`--template` CLI フラグの入力として `slug` を使用してください。

任意の GitHub リポジトリもテンプレートとして使用できます（有効な Mastra プロジェクトである必要があります）:

```bash
npx create-mastra@latest my-mastra-project -- --template mastra-ai/template-coding-agent
```

## CLI フラグ \{#cli-flags\}

対話型プロンプトの代わりに、次の CLI フラグを指定できます。

<PropertiesTable
  content={[
{
name: "--version",
type: "boolean",
description: "バージョン番号を出力",
isOptional: true,
},
{
name: "--project-name",
type: "string",
description:
"package.json とプロジェクトディレクトリ名に使用するプロジェクト名",
isOptional: true,
},
{
name: "--default",
type: "boolean",
description: "デフォルト設定でクイックスタート（src、OpenAI、サンプルなし）",
isOptional: true,
},
{
name: "--components",
type: "string",
description:
"コンマ区切りのコンポーネント一覧（agents、tools、workflows）",
isOptional: true,
},
{
name: "--llm",
type: "string",
description:
"デフォルトのモデルプロバイダー（openai、anthropic、groq、google、cerebras）",
isOptional: true,
},
{
name: "--llm-api-key",
type: "string",
description: "モデルプロバイダーの API キー",
isOptional: true,
},
{
name: "--example",
type: "boolean",
description: "サンプルコードを含める",
isOptional: true,
},
{
name: "--no-example",
type: "boolean",
description: "サンプルコードを含めない",
isOptional: true,
},
{
name: "--template",
type: "string",
description:
"テンプレートからプロジェクトを作成（テンプレート名、公開 GitHub URL、または空欄で一覧から選択）",
isOptional: true,
},
{
name: "--timeout",
type: "number",
description:
"パッケージインストールのタイムアウトを設定可能（デフォルト: 60000 ms）",
isOptional: true,
},
{
name: "--dir",
type: "string",
description: "Mastra のソースコード用の出力先ディレクトリ（デフォルト: src/）",
isOptional: true,
},
{
name: "--mcp",
type: "string",
description:
"コードエディタ向け MCP サーバー（cursor、cursor-global、windsurf、vscode）",
isOptional: true,
},
{
name: "--help",
type: "boolean",
description: "コマンドのヘルプを表示",
isOptional: true,
},
]}
/>