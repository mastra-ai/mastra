---
title: "リファレンス: MDocument"
description: Mastra の MDocument クラスに関するドキュメント。ドキュメントの処理およびチャンク分割を扱います。
---

# MDocument \{#mdocument\}

MDocument クラスは、RAG アプリケーション向けにドキュメントを処理します。主要なメソッドは `.chunk()` と `.extractMetadata()` です。

## コンストラクター \{#constructor\}

<PropertiesTable
  content={[
{
name: "docs",
type: "Array<{ text: string, metadata?: Record<string, any> }>",
description:
"テキスト内容と任意のメタデータを含むドキュメントチャンクの配列",
},
{
name: "type",
type: "'text' | 'html' | 'markdown' | 'json' | 'latex'",
description: "ドキュメント内容の種別",
},
]}
/>

## 静的メソッド \{#static-methods\}

### fromText() \{#fromtext\}

プレーンテキストの内容からドキュメントを作成します。

```typescript
static fromText(text: string, metadata?: Record<string, any>): MDocument
```

### fromHTML() \{#fromhtml\}

HTML コンテンツから文書を作成します。

```typescript
static fromHTML(html: string, metadata?: Record<string, any>): MDocument
```

### fromMarkdown() \{#frommarkdown\}

Markdown コンテンツからドキュメントを生成します。

```typescript
static fromMarkdown(markdown: string, metadata?: Record<string, any>): MDocument
```

### fromJSON() \{#fromjson\}

JSON コンテンツからドキュメントを生成します。

```typescript
static fromJSON(json: string, metadata?: Record<string, any>): MDocument
```

## インスタンスメソッド \{#instance-methods\}

### chunk() \{#chunk\}

ドキュメントをチャンクに分割し、必要に応じてメタデータを抽出します。

```typescript
async chunk(params?: ChunkParams): Promise<Chunk[]>
```

詳細なオプションについては、[chunk() リファレンス](./chunk) を参照してください。

### getDocs() \{#getdocs\}

処理済みのドキュメントチャンクを配列で返します。

```typescript
getDocs(): Chunk[]
```

### getText() \{#gettext\}

チャンク内のテキスト文字列の配列を返します。

```typescript
getText(): string[]
```

### getMetadata() \{#getmetadata\}

チャンクからメタデータオブジェクトの配列を返します。

```typescript
getMetadata(): Record<string, any>[]
```

### extractMetadata() \{#extractmetadata\}

指定したエクストラクターを使用してメタデータを抽出します。詳細は [ExtractParams のリファレンス](./extract-params) を参照してください。

```typescript
async extractMetadata(params: ExtractParams): Promise<MDocument>
```

## 例 \{#examples\}

```typescript
import { MDocument } from '@mastra/rag';

// テキストからドキュメントを作成
const doc = MDocument.fromText('Your content here');

// メタデータ抽出を含むチャンクへの分割
const chunks = await doc.chunk({
  strategy: 'markdown',
  headers: [
    ['#', 'title'],
    ['##', 'section'],
  ],
  extract: {
    summary: true, // デフォルト設定で要約を抽出
    keywords: true, // デフォルト設定でキーワードを抽出
  },
});

// 処理済みのチャンクを取得
const docs = doc.getDocs();
const texts = doc.getText();
const metadata = doc.getMetadata();
```
