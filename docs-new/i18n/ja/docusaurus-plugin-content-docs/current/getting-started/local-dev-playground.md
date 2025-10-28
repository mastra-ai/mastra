---
title: プレイグラウンド
description: Mastra アプリのローカル開発環境に関するドキュメント。
sidebar_position: 2
---

import YouTube from '@site/src/components/YouTube';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { VideoPlayer } from '@site/src/components/video-player';

# プレイグラウンド \{#playground\}

Mastra は、開発中にエージェント、ワークフロー、ツールをテストできるローカル開発環境を提供します。

次のコマンドを実行してローカル開発サーバーを起動します:

<Tabs>
  <TabItem value="npm" label="npm">
    ```bash copy
    npm run dev
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn run dev
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm run dev
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun run dev
    ```
  </TabItem>

  <TabItem value="mastra" label="mastra">
    ```bash copy
    mastra dev
    ```
  </TabItem>
</Tabs>

ローカル開発サーバーでは、以下のインターフェースにアクセスできます:

* プレイグラウンド: [http://localhost:4111/](http://localhost:4111/)
* Mastra API: [http://localhost:4111/api](http://localhost:4111/api)
* OpenAPI 仕様: [http://localhost:4111/openapi.json](http://localhost:4111/openapi.json)
* Swagger UI（API エクスプローラー）: [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui)

## ローカル開発用 Playground \{#local-development-playground\}

Playground では、エージェント、ワークフロー、ツールと対話できます。開発中の Mastra アプリの各コンポーネントをテストするための専用インターフェースを提供しており、次の URL で利用できます: [http://localhost:4111/](http://localhost:4111/)。

<YouTube id="spGlcTEjuXY" startTime={126} />

### エージェント \{#agents\}

Agent Playground のインタラクティブなチャットインターフェースを使って、開発中のエージェントを素早くテスト・デバッグできます。

<VideoPlayer src="https://res.cloudinary.com/mastra-assets/video/upload/v1751406022/local-dev-agents-playground_100_m3begx.mp4" />

主な機能:

* **チャットインターフェース**: エージェントと対話し、リアルタイムの応答を確認できます。
* **モデル設定**: temperature や top-p などのパラメータを調整し、出力への影響を確かめられます。
* **エージェントエンドポイント**: エージェントが公開している利用可能な REST API のルートと、その使い方を確認できます。
* **エージェントトレース**: バックグラウンドでエージェントが行った処理、ツール呼び出し、意思決定などを段階的に追跡できます。
* **エージェント評価**: エージェントに対してテストを実行し、性能を確認できます。

### Workflows \{#workflows\}

定義済みの入力を用意し、Workflow Playground 内で各ステップを可視化してワークフローを検証します。

<VideoPlayer src="https://res.cloudinary.com/mastra-assets/video/upload/v1751406027/local-dev-workflows-playground_100_rbc466.mp4" />

主な機能:

* **Workflow Visualization**: ワークフローを視覚的なグラフで表示し、ステップや分岐を一目で追えます。
* **Step Inputs &amp; Outputs**: 各ステップに入るデータと出るデータを確認し、全体の流れを把握できます。
* **Run Workflows**: 実際の入力でワークフローをテストしてロジックを検証し、不具合をデバッグできます。
* **Execution JSON**: 実行の全体像を生の JSON で取得（入力、出力、エラー、結果を含む）。
* **Workflow Traces**: 各ステップの詳細な内訳を確認し、データフロー、ツール呼び出し、途中で発生したエラーを追跡します。

### ツール \{#tools\}

Tools Playground を使えば、エージェントやワークフロー全体を動かさずに、カスタムツールを単体で素早くテスト・デバッグできます。

<VideoPlayer src="https://res.cloudinary.com/mastra-assets/video/upload/v1751406316/local-dev-agents-tools_100_fe1jdt.mp4" />

主な機能:

* **ツールを単体でテスト**: エージェントやワークフロー全体を実行せず、個々のツールだけを試せます。
* **入力と応答**: サンプル入力を送って、ツールの応答を確認できます。
* **ツールの利用状況**: どのエージェントがこのツールに依存し、どのように使っているかを確認できます。

### MCP サーバー \{#mcp-servers\}

ローカルでの MCP サーバー開発に向けて、接続情報、ツールの利用状況、IDE の設定を確認できます。

![MCP Servers Playground](/img/local-dev/local-dev-mcp-server-playground.jpg)

主な機能:

* **接続情報**: MCP 環境を構成するために必要なエンドポイントや設定にアクセスできます。
* **利用可能なツール**: 現在公開されているすべてのツールの名前、バージョン、使用しているエージェントを確認できます。
* **IDE 設定**: テストやツールの公開にそのまま使える設定を、ローカル環境にそのまま適用できます。

## REST API エンドポイント \{#rest-api-endpoints\}

ローカル開発サーバーは [Mastra Server](/docs/deployment/server-deployment) を介して複数の REST API ルートを公開しており、デプロイ前にエージェントやワークフローをテスト・操作できます。

エージェント、ツール、ワークフローを含む利用可能な API ルートの全体像については、`mastra dev` 実行中に [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui) を参照してください。

## OpenAPI 仕様 \{#openapi-specification\}

ローカル開発サーバーには、次の URL で参照できる OpenAPI 仕様が含まれています: [http://localhost:4111/openapi.json](http://localhost:4111/openapi.json)。

本番サーバーで OpenAPI ドキュメントを提供するには、Mastra インスタンスで有効化してください:

```typescript {6} filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    build: {
      openAPIDocs: true,
    },
  },
});
```

## Swagger UI \{#swagger-ui\}

ローカル開発サーバーにはインタラクティブな Swagger UI（API エクスプローラー）が同梱されており、次の URL で利用できます: [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui)。

本番サーバーで Swagger UI を利用するには、Mastra インスタンスで有効化してください。

```typescript {6} filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    build: {
      swaggerUI: true,
    },
  },
});
```

## アーキテクチャ \{#architecture\}

ローカル開発サーバーは、外部の依存関係やコンテナに頼らず、完全に自己完結して動作します。以下を活用します:

* コアの [Mastra Server](/docs/deployment/server-deployment) のため、[Hono](https://hono.dev) を基盤とする**Dev Server**。
* エージェントのメモリ、トレース、評価、ワークフローのスナップショット用に、[LibSQL](https://libsql.org/) アダプターを用いた**インメモリストレージ**。
* 埋め込み、ベクトル検索、セマンティック検索に [FastEmbed](https://github.com/qdrant/fastembed) を用いた**ベクトルストレージ**。

この構成により、データベースやベクトルストアのセットアップは不要で、本番環境に近い挙動のまま、すぐに開発を始められます。

## 設定 \{#configuration\}

既定では、サーバーはポート `4111` で実行されます。Mastra サーバーの設定で `host` と `port` をカスタマイズできます。

```typescript {5,6} filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    port: 8080,
    host: '0.0.0.0',
  },
});
```

### ローカル HTTPS \{#local-https\}

Mastra は、`mastra dev` でローカルの HTTPS サーバーを使用する方法を提供します（[expo/devcert](https://github.com/expo/devcert) を利用）。`--https` フラグを使用すると、秘密鍵と証明書が作成され、プロジェクトで使用されます。デフォルトでは、別の `host` 値を指定しない限り、証明書は `localhost` に対して発行されます。

```bash
mastra dev --https
```

Mastra のサーバー設定で `server.https` オプションを指定すると、独自のキーと証明書ファイルを使用できます。

```typescript {2,6-9} filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';
import fs from 'node:fs';

export const mastra = new Mastra({
  server: {
    https: {
      key: fs.readFileSync('path/to/key.pem'),
      cert: fs.readFileSync('path/to/cert.pem'),
    },
  },
});
```

`--https` と `server.https` の両方を指定した場合、後者が優先されます。

## バンドラーのオプション \{#bundler-options\}

TypeScript のパッケージやライブラリをコンパイルするには `transpilePackages` を使用します。実行時に解決される依存関係を除外するには `externals`、可読性の高いスタックトレースを出力するには `sourcemap` を使用します。

```typescript filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  bundler: {
    transpilePackages: ['utils'],
    externals: ['ui'],
    sourcemap: true,
  },
});
```

> さらに詳しい設定オプションは [Mastra Class](/docs/reference/core/mastra-class) を参照してください。

## 次のステップ \{#next-steps\}

* [Mastra Cloud](/docs/mastra-cloud/overview)
* [デプロイの概要](/docs/deployment/overview)
* [Mastra クライアント SDK](/docs/server-db/mastra-client)