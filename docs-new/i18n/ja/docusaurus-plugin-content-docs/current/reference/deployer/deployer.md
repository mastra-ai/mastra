---
title: "Mastra デプロイヤー"
description: Mastra アプリケーションのパッケージ化とデプロイを担う抽象クラス Deployer のドキュメント。
slug: /reference/deployer
---

# Deployer \{#deployer\}

Deployer は、コードのパッケージング、環境ファイルの管理、そして Hono フレームワークを用いたアプリケーションの提供によって、スタンドアロンの Mastra アプリケーションのデプロイを担います。具体的な実装では、特定のデプロイ先に合わせて deploy メソッドを定義する必要があります。

## 使い方の例 \{#usage-example\}

```typescript
import { Deployer } from '@mastra/deployer';

// 抽象Deployerクラスを継承してカスタムデプロイヤーを作成
class CustomDeployer extends Deployer {
  constructor() {
    super({ name: 'custom-deployer' });
  }

  // 抽象deployメソッドを実装
  async deploy(outputDirectory: string): Promise<void> {
    // 出力ディレクトリを準備
    await this.prepare(outputDirectory);

    // アプリケーションをバンドル
    await this._bundle('server.ts', 'mastra.ts', outputDirectory);

    // カスタムデプロイメントロジック
    // ...
  }
}
```

## パラメーター \{#parameters\}

### コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "args",
type: "object",
description: "Deployer の構成オプション。",
isOptional: false,
},
{
name: "args.name",
type: "string",
description: "Deployer インスタンスの一意な名前。",
isOptional: false,
},
]}
/>

### deploy パラメータ \{#deploy-parameters\}

<PropertiesTable
  content={[
{
name: "outputDirectory",
type: "string",
description:
"バンドル済みでデプロイ準備が整ったアプリケーションの出力先ディレクトリ。",
isOptional: false,
},
]}
/>

## メソッド \{#methods\}

<PropertiesTable
  content={[
{
name: "getEnvFiles",
type: "() => Promise<string[]>",
description:
"デプロイ時に使用する環境ファイルの一覧を返します。既定では '.env.production' と '.env' を探索します。",
},
{
name: "deploy",
type: "(outputDirectory: string) => Promise<void>",
description:
"サブクラスで実装が必須の抽象メソッド。指定された出力ディレクトリへのデプロイ処理を実行します。",
},
]}
/>

## Bundler から継承されたメソッド \{#inherited-methods-from-bundler\}

Deployer クラスは、Bundler クラスから次の主要なメソッドを継承します：

<PropertiesTable
  content={[
{
name: "prepare",
type: "(outputDirectory: string) => Promise<void>",
description:
"出力ディレクトリをクリーンアップし、必要なサブディレクトリを作成して準備します。",
},
{
name: "writeInstrumentationFile",
type: "(outputDirectory: string) => Promise<void>",
description:
"テレメトリーのためのインストゥルメンテーションファイルを出力ディレクトリに書き込みます。",
},
{
name: "writePackageJson",
type: "(outputDirectory: string, dependencies: Map<string, string>) => Promise<void>",
description:
"指定された依存関係を含む package.json ファイルを出力ディレクトリに生成します。",
},
{
name: "_bundle",
type: "(serverFile: string, mastraEntryFile: string, outputDirectory: string, bundleLocation?: string) => Promise<void>",
description:
"指定されたサーバーファイルと Mastra のエントリーファイルを使用してアプリケーションをバンドルします。",
},
]}
/>

## 基本概念 \{#core-concepts\}

### デプロイライフサイクル \{#deployment-lifecycle\}

Deployer 抽象クラスは、体系的なデプロイライフサイクルを実装します。

1. **初期化**: デプロイヤーは名前で初期化され、依存関係管理のために Deps インスタンスを作成します。
2. **環境設定**: `getEnvFiles` メソッドは、デプロイ時に使用する環境ファイル（.env.production、.env）を特定します。
3. **準備**: `prepare` メソッド（Bundler から継承）は、出力ディレクトリをクリーンアップし、必要なサブディレクトリを作成します。
4. **バンドル**: `_bundle` メソッド（Bundler から継承）は、アプリケーションコードとその依存関係をパッケージ化します。
5. **デプロイ**: 抽象メソッド `deploy` は、実際のデプロイプロセスを処理するためにサブクラスによって実装されます。

### 環境ファイル管理 \{#environment-file-management\}

Deployer クラスには、`getEnvFiles` メソッドによる環境ファイル管理の標準サポートが組み込まれています。このメソッドは次の処理を行います:

* あらかじめ定義された順序（.env.production、.env）で環境ファイルを検索する
* FileService を使用して最初に存在するファイルを特定する
* 見つかった環境ファイルの配列を返す
* 環境ファイルが見つからない場合は空配列を返す

```typescript
getEnvFiles(): Promise<string[]> {
  const possibleFiles = ['.env.production', '.env.local', '.env'];

  try {
    const fileService = new FileService();
    const envFile = fileService.getFirstExistingFile(possibleFiles);

    return Promise.resolve([envFile]);
  } catch {}

  return Promise.resolve([]);
}
```

### バンドルとデプロイの関係 \{#bundling-and-deployment-relationship\}

Deployer クラスは Bundler クラスを継承し、バンドルとデプロイの関係を明確にします:

1. **前提としてのバンドル**: バンドルはデプロイの前提となる工程であり、アプリケーションコードをデプロイ可能な形式にパッケージ化します。
2. **共通インフラ**: バンドルとデプロイは、依存関係の管理やファイルシステム操作などの共通インフラを共有します。
3. **デプロイ固有のロジック**: バンドルがコードのパッケージングに特化する一方、デプロイはバンドル済みコードを展開するための環境固有のロジックを追加します。
4. **拡張性**: 抽象メソッド `deploy` により、異なるターゲット環境向けの専用デプロイヤーを作成できます。