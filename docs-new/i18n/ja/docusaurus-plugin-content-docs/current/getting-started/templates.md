---
title: "テンプレート"
description: 一般的な Mastra のユースケースやパターンを示す、あらかじめ用意されたプロジェクト構成
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# テンプレート \{#templates\}

テンプレートは、特定のユースケースやパターンを示す、あらかじめ用意された Mastra プロジェクトです。利用可能なテンプレートは [templates ディレクトリ](https://mastra.ai/templates)で参照できます。

## テンプレートの利用 \{#using-templates\}

`create-mastra` コマンドでテンプレートをインストールします:

<Tabs groupId="package-manager">
  <TabItem value="npx" label="npx" default>
    ```bash copy
    npx create-mastra@latest --template template-name
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn dlx create-mastra@latest --template template-name
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm create mastra@latest --template template-name
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun create mastra@latest --template template-name
    ```
  </TabItem>
</Tabs>

たとえば、text-to-SQL アプリを作成するには:

```bash copy
npx create-mastra@latest --template text-to-sql
```

## テンプレートのセットアップ \{#setting-up-a-template\}

インストール後:

1. **プロジェクトに移動**:

   ```bash copy
   cd your-project-name
   ```

2. **環境変数を設定**:

   ```bash copy
   cp .env.example .env
   ```

   テンプレートのREADMEの指示に従い、APIキーを`.env`に記入してください。

3. **開発を開始**:
   ```bash copy
   npm run dev
   ```

:::note

各テンプレートには、具体的なセットアップ手順と使用例をまとめたREADMEが同梱されています。

:::

テンプレートの作成に関する詳細は、[テンプレートリファレンス](/docs/reference/templates/overview)を参照してください。