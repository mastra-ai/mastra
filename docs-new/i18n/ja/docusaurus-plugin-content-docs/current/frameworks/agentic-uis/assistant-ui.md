---
title: Assistant UI の利用
description: "Mastra と Assistant UI を統合する方法を学ぶ"
sidebar_position: 3
---

# Assistant UI と併用する \{#using-with-assistant-ui\}

[Assistant UI](https://assistant-ui.com) は、AIチャット向けの TypeScript/React ライブラリです。
shadcn/ui と Tailwind CSS を基盤としており、開発者が数分で美しく、エンタープライズ級のチャット体験を構築できます。

:::tip 別のアプローチ

Mastra を Next.js の API ルートで直接動かすフルスタック統合については、Assistant UI のドキュメントサイトにある [Full-Stack Integration Guide](https://www.assistant-ui.com/docs/runtimes/mastra/full-stack-integration) をご覧ください。

:::

## 統合ガイド \{#integration-guide\}

Mastra を単体のサーバーとして稼働させ、Next.js フロントエンド（Assistant UI 使用）をその API エンドポイントに接続します。

### スタンドアロンの Mastra サーバーを作成する \{#create-standalone-mastra-server\}

ディレクトリ構成を用意します。想定されるディレクトリ構成の例は次のとおりです:

> ファイル構成の情報は利用可能です。詳しいツリー表示は元のドキュメントを参照してください。

Mastra サーバーを初期セットアップします:

```bash copy
npx create-mastra@latest
```

このコマンドは対話型ウィザードを起動し、新しい Mastra プロジェクトの雛形作成を支援します。プロジェクト名の入力や基本設定のセットアップが行われます。
表示される指示に従ってサーバープロジェクトを作成してください。

これで基本的な Mastra サーバープロジェクトの準備ができました。次のファイルとフォルダが用意されているはずです:

> ファイル構成情報は利用可能です。詳細なツリー表示は元のドキュメントを参照してください。

:::note

`.env` ファイルで、利用する LLM プロバイダー向けの適切な環境変数が設定されていることを確認してください。

:::

### Mastra サーバーを起動する \{#run-the-mastra-server\}

以下のコマンドで Mastra サーバーを起動します:

```bash copy
npm run dev
```

デフォルトでは、Mastra サーバーは `http://localhost:4111` で起動します。`weatherAgent` は通常、POST リクエストのエンドポイント `http://localhost:4111/api/agents/weatherAgent/stream` からアクセスできます。続く手順で Assistant UI のフロントエンドをこのサーバーに接続するため、サーバーはこのまま起動しておいてください。

### Assistant UI を初期化する \{#initialize-assistant-ui\}

次のコマンドで新しい `assistant-ui` プロジェクトを作成します。

```bash copy
npx assistant-ui@latest create
```

:::note
API キーの追加、基本設定、手動セットアップ手順などの詳しい手順については、[assistant-ui の公式ドキュメント](https://assistant-ui.com/docs)をご参照ください。
:::

### フロントエンドの API エンドポイントを設定する \{#configure-frontend-api-endpoint\}

デフォルトの Assistant UI のセットアップでは、Next.js プロジェクト内のローカル API ルート（`/api/chat`）を使用するようにチャットランタイムが構成されています。Mastra エージェントが別サーバーで動作しているため、フロントエンドをそのサーバーのエンドポイントを指すように更新する必要があります。

`assistant-ui` プロジェクト内の `useChatRuntime` フック（通常は `app/assistant.tsx` にあります）を見つけ、`api` プロパティを Mastra エージェントのストリームエンドポイントのフル URL に変更してください。

```typescript showLineNumbers copy filename="app/assistant.tsx" {6}
import { useChatRuntime, AssistantChatTransport } from '@assistant-ui/react-ai-sdk';

const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: 'MASTRA_ENDPOINT',
  }),
});
```

これで、Assistant UI のフロントエンドは実行中の Mastra サーバーにチャットリクエストを直接送信するようになります。

### アプリケーションを実行する \{#run-the-application\}

準備は整いました。Mastra サーバーと Assistant UI のフロントエンドがどちらも動作していることを確認し、Next.js の開発サーバーを起動します：

```bash copy
npm run dev
```

これでブラウザ上でエージェントとチャットできるようになりました。

おめでとうございます！別サーバー方式で Mastra を Assistant UI に正常に統合できました。これにより、Assistant UI のフロントエンドはスタンドアロンの Mastra エージェントサーバーと通信するようになりました。
