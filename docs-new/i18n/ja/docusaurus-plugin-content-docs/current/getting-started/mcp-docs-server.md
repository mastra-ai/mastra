---
title: "MCP ドキュメントサーバー"
description: "IDE で Mastra MCP ドキュメントサーバーを利用して、IDE を Mastra に精通したエージェントとして活用する方法を学びましょう。"
---

import YouTube from '@site/src/components/YouTube';

# Mastra Docs Server \{#mastra-docs-server\}

`@mastra/mcp-docs-server` パッケージは、[Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro) を介して、ドキュメント、コードサンプル、ブログ記事、チェンジログなど、Mastra の全ナレッジベースへ直接アクセスできるようにします。Cursor、Windsurf、Cline、Claude Code など、MCP をサポートするあらゆるツールで利用できます。

これらのツールは、エージェントに機能を追加する場合、新規プロジェクトのスキャフォールドを作成する場合、あるいは動作を調査する場合などに、エージェントが正確でタスク特化型の情報を取得できるよう設計されています。

このガイドでは、Mastra の MCP サーバーを AI ツール群に追加する方法を説明します。

<YouTube id="vciV57lF0og" />

## インストール \{#installation\}

### create-mastra \{#create-mastra\}

対話型の [create-mastra](/docs/reference/cli/create-mastra) ウィザードで、MCP のステップにて使用するツールを選択してください。

### 手動セットアップ \{#manual-setup\}

以下に特定の手順が記載されていないツールでも、一般的なこのJSON設定でMCPサーバーを追加できる場合があります。

```json copy
{
  "mcpServers": {
    "mastra": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server"]
    }
  }
}
```

### Claude Code CLI \{#claude-code-cli\}

ターミナルで次のコマンドを実行してインストールします：

```bash copy
claude mcp add mastra -- npx -y @mastra/mcp-docs-server
```

[Claude Code での MCP サーバーの使い方の詳細](https://docs.claude.com/en/docs/claude-code/mcp)

### Cursor \{#cursor\}

以下のボタンをクリックしてインストールしてください:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=mastra\&config=eyJjb21tYW5kIjoibnB4IC15IEBtYXN0cmEvbWNwLWRvY3Mtc2VydmVyIn0%3D)

自動インストールを実行した場合は、Cursor を開くと左下に、Mastra Docs MCP Server を有効にするよう促すポップアップが表示されます。

<img src="/img/enable-mastra-docs-cursor.png" alt="Mastra Docs MCP Server を有効にするよう促す Cursor のプロンプトの図解" width={800} />

[Cursor で MCP サーバーを使用する方法の詳細](https://cursor.com/de/docs/context/mcp)

### Visual Studio Code \{#visual-studio-code\}

1. ワークスペースに `.vscode/mcp.json` ファイルを作成します
2. 次の設定を追加します:

   ```json copy
   {
     "servers": {
       "mastra": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "@mastra/mcp-docs-server"]
       }
     }
   }
   ```

MCP サーバーをインストールしたら、次の手順で使用できます。

1. VSCode の設定を開きます。
2. MCP の設定に移動します。
3. Chat &gt; MCP の項目で「enable」をクリックします。

   <img src="/img/vscode-mcp-setting.png" alt="VSCode の設定ページで MCP を有効化する" width={800} className="rounded-lg" />

MCP は VSCode の Agent モードでのみ動作します。Agent モードに入ったら、`mcp.json` を開いて「start」ボタンをクリックします。「start」ボタンは、`mcp.json` を含む `.vscode` フォルダーがワークスペースのルート、またはエディター内ファイルエクスプローラーの最上位にある場合にのみ表示されます。

<img src="/img/vscode-start-mcp.png" alt="VSCode で MCP を有効化する設定ページ" width={800} className="rounded-lg" />

MCP サーバーを起動後、Copilot ペインのツールボタンをクリックして、利用可能なツールを表示します。

<img src="/img/vscode-mcp-running.png" alt="VSCode のツールページで利用可能なツールを表示" width={800} className="rounded-lg" />

[Visual Studio Code で MCP サーバーを使用する詳細](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

### Windsurf \{#windsurf\}

1. エディタで `~/.codeium/windsurf/mcp_config.json` を開きます

2. 次の設定を貼り付けます:

   ```json copy
   {
     "mcpServers": {
       "mastra": {
         "command": "npx",
         "args": ["-y", "@mastra/mcp-docs-server"]
       }
     }
   }
   ```

3. 設定を保存し、Windsurf を再起動します

[Windsurf での MCP サーバーの使い方の詳細](https://docs.windsurf.com/windsurf/cascade/mcp#mcp-config-json)

## 使い方 \{#usage\}

設定が完了したら、AIツールに Mastra について質問したり、操作を指示できます。これらの手順では、Mastra の MCP サーバーから最新の情報が取得されます。

**機能を追加する:**

* 「エージェントに evals を追加して、テストを書いて」
* 「`[task]` を実行するワークフローを書いて」
* 「エージェントが `[3rd party API]` にアクセスできる新しいツールを作って」

**インテグレーションについて質問する:**

* 「Mastra は AI SDK と連携しますか？
  `[React/Svelte/etc]` プロジェクトでどう使えばいいですか？」
* 「MCP に関する Mastra の最新情報は何ですか？」
* 「Mastra は `[provider]` の音声・音声合成 API をサポートしていますか？ 私のコードでの使用例を見せてください。」

**既存のコードをデバッグまたは更新する:**

* 「エージェントのメモリでバグに遭遇しています。最近、関連する変更やバグ修正はありましたか？」
* 「Mastra のワーキングメモリはどのように動作し、`[task]` を行うためにどう使えばよいですか？ 期待どおりに動いていないようです。」
* 「新しいワークフロー機能があると見ました。内容を説明した上で、`[workflow]` をそれらを使うように更新してください。」

### トラブルシューティング \{#troubleshooting\}

1. **サーバーが起動しない**
   * [npx](https://docs.npmjs.com/cli/v11/commands/npx) がインストールされ、正常に動作していることを確認してください。
   * 競合する MCP サーバーがないか確認してください。
   * 設定ファイルの文法を確認してください。

2. **ツール呼び出しが失敗する**
   * MCP サーバーおよび IDE を再起動してください。
   * IDE を最新バージョンに更新してください。