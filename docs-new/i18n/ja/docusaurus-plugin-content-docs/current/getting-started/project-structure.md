---
title: "プロジェクト構成"
description: Mastra におけるフォルダやファイルの整理方法を、ベストプラクティスや推奨構成とともに解説するガイド。
sidebar_position: 2
---

# プロジェクト構成 \{#project-structure\}

このページでは、Mastra におけるフォルダーやファイルの整理方法を案内します。Mastra はモジュール型のフレームワークで、各モジュールを単体でも組み合わせても利用できます。

すべてを1つのファイルにまとめても、エージェント、ツール、ワークフローごとに別々のファイルへ分割しても構いません。

特定のフォルダー構成を強制はしませんが、いくつかのベストプラクティスを推奨しており、CLI は妥当な構成でプロジェクトのスキャフォールドを作成します。

## プロジェクト構成の例 \{#example-project-structure\}

CLI で作成したデフォルトのプロジェクトは次のようになります。

```
root/
├── src/
│   └── mastra/
│       ├── agents/
│       │   └── agent-name.ts
│       ├── tools/
│       │   └── tool-name.ts
│       ├── workflows/
│       │   └── workflow-name.ts
│       └── index.ts
├── .env
├── package.json
└── tsconfig.json
```

### トップレベルのフォルダ \{#top-level-folders\}

| フォルダ               | 説明                             |
| ---------------------- | -------------------------------- |
| `src/mastra`           | コアアプリケーションのフォルダ   |
| `src/mastra/agents`    | エージェントの設定と定義         |
| `src/mastra/tools`     | カスタムツールの定義             |
| `src/mastra/workflows` | ワークフローの定義               |

### ルートレベルのファイル \{#top-level-files\}

| ファイル              | 説明                                           |
| --------------------- | ---------------------------------------------- |
| `src/mastra/index.ts` | Mastra の主要な設定ファイル                    |
| `.env`                | 環境変数                                       |
| `package.json`        | Node.js プロジェクトのメタデータ、スクリプト、依存関係 |
| `tsconfig.json`       | TypeScript コンパイラの設定                    |