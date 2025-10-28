---
sidebar_position: 5
title: "MCP サーバー：Notes MCP サーバー"
description: "Mastra フレームワークを用いてノートを管理する、フル機能の MCP（Model Context Protocol）サーバーを構築するためのステップバイステップガイド。"
---

# Notes MCP サーバーを構築する \{#building-a-notes-mcp-server\}

このガイドでは、ゼロから完全な MCP（Model Context Protocol）サーバーを構築する方法を学びます。このサーバーは Markdown のノートコレクションを管理し、次の機能を備えています。

1. **ノートの一覧と閲覧**: クライアントがサーバーに保存された Markdown ファイルを参照・表示できるようにします
2. **ノートの作成・更新**: ノートを作成または更新するためのツールを提供します
3. **スマートプロンプトの提供**: デイリーノートのテンプレート作成や既存コンテンツの要約など、文脈に応じたプロンプトを生成します

## 前提条件 \{#prerequisites\}

* Node.js `v20.0` 以降がインストールされていること
* 対応する[モデルプロバイダー](/docs/models/providers)の API キー
* 既存の Mastra プロジェクト（新規プロジェクトのセットアップは[インストールガイド](/docs/getting-started/installation)を参照）

## 必要な依存関係とファイルの追加 \{#adding-necessary-dependencies-files\}

MCP サーバーを作成する前に、追加の依存関係をインストールし、雛形となるフォルダ構成をセットアップする必要があります。

### `@mastra/mcp` をインストールする \{#install-mastramcp\}

プロジェクトに `@mastra/mcp` を追加します：

```bash copy
npm install @mastra/mcp
```

### 既定のプロジェクトをクリーンアップする \{#clean-up-the-default-project\}

既定の[インストールガイド](/docs/getting-started/installation)に従った後、プロジェクトには本ガイドに不要なファイルが含まれています。これらは安全に削除して構いません。

```bash copy
rm -rf src/mastra/agents src/mastra/workflows src/mastra/tools/weather-tool.ts
```

`src/mastra/index.ts` ファイルも次のように変更してください：

```ts copy filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    // テレメトリや評価などをメモリストレージに保存します。永続化する必要がある場合は file:../mastra.db に変更してください
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

### ディレクトリ構成を設定する \{#set-up-the-directory-structure\}

MCP サーバーのロジック用に専用のディレクトリと、ノート用の `notes` ディレクトリを作成します。

```bash copy
mkdir notes src/mastra/mcp
```

次のファイルを作成してください:

```bash copy
touch src/mastra/mcp/{server,resources,prompts}.ts
```

* `server.ts`: メインの MCP サーバー設定を含みます
* `resources.ts`: ノートファイルの一覧取得と読み取りを担当します
* `prompts.ts`: スマートプロンプトのロジックを含みます

最終的なディレクトリ構成は次のようになります:

> ファイル構成情報は利用可能です。詳細なツリービューは元のドキュメントを参照してください。

## MCP サーバーの作成 \{#creating-the-mcp-server\}

MCP サーバーを追加してみましょう！

### MCP サーバーを作成して登録する \{#create-and-register-the-mcp-server\}

`src/mastra/mcp/server.ts` で MCP サーバーのインスタンスを定義します：

```typescript copy filename="src/mastra/mcp/server.ts"
import { MCPServer } from '@mastra/mcp';

export const notes = new MCPServer({
  name: 'notes',
  version: '0.1.0',
  tools: {},
});
```

`src/mastra/index.ts` で、この MCP サーバーを Mastra インスタンスに登録します。キー `notes` は、この MCP サーバーの公開識別子です。

```typescript copy filename="src/mastra/index.ts" {4, 15-17}
import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { notes } from './mcp/server';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    // テレメトリ、評価などをメモリストレージに保存します。永続化する場合は file:../mastra.db に変更してください
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  mcpServers: {
    notes,
  },
});
```

### リソースハンドラーを実装して登録する \{#implement-and-register-resource-handlers\}

リソースハンドラーを使用すると、クライアントはサーバーが管理するコンテンツを発見し、読み取れるようになります。`notes` ディレクトリ内の Markdown ファイルに対応するハンドラーを実装します。`src/mastra/mcp/resources.ts` ファイルに以下を追加します:

```typescript copy filename="src/mastra/mcp/resources.ts"
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MCPServerResources, Resource } from '@mastra/mcp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTES_DIR = path.resolve(__dirname, '../../notes'); // デフォルトの出力ディレクトリからの相対パス

const listNoteFiles = async (): Promise<Resource[]> => {
  try {
    await fs.mkdir(NOTES_DIR, { recursive: true });
    const files = await fs.readdir(NOTES_DIR);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const title = file.replace('.md', '');
        return {
          uri: `notes://${title}`,
          name: title,
          description: `${title}についてのノート`,
          mime_type: 'text/markdown',
        };
      });
  } catch (error) {
    console.error('ノートリソースの一覧取得エラー:', error);
    return [];
  }
};

const readNoteFile = async (uri: string): Promise<string | null> => {
  const title = uri.replace('notes://', '');
  const notePath = path.join(NOTES_DIR, `${title}.md`);
  try {
    return await fs.readFile(notePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`リソース ${uri} の読み取りエラー:`, error);
    }
    return null;
  }
};

export const resourceHandlers: MCPServerResources = {
  listResources: listNoteFiles,
  getResourceContent: async ({ uri }: { uri: string }) => {
    const content = await readNoteFile(uri);
    if (content === null) return { text: '' };
    return { text: content };
  },
};
```

`src/mastra/mcp/server.ts` にこれらのリソースハンドラーを登録します：

```typescript copy filename="src/mastra/mcp/server.ts" {2, 8}
import { MCPServer } from '@mastra/mcp';
import { resourceHandlers } from './resources';

export const notes = new MCPServer({
  name: 'notes',
  version: '0.1.0',
  tools: {},
  resources: resourceHandlers,
});
```

### ツールを実装して登録する \{#implement-and-register-a-tool\}

ツールはサーバーが実行できるアクションです。ここでは `write` ツールを作成します。
まずは `src/mastra/tools/write-note.ts` にツールを定義します。

```typescript copy filename="src/mastra/tools/write-note.ts"
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import path from 'node:path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTES_DIR = path.resolve(__dirname, '../../../notes');

export const writeNoteTool = createTool({
  id: 'write',
  description: '新しいノートを作成、または既存のノートを上書きします。',
  inputSchema: z.object({
    title: z.string().nonempty().describe('ノートのタイトル。ファイル名として使用されます。'),
    content: z.string().nonempty().describe('ノートのMarkdown形式の内容。'),
  }),
  outputSchema: z.string().nonempty(),
  execute: async ({ context }) => {
    try {
      const { title, content } = context;
      const filePath = path.join(NOTES_DIR, `${title}.md`);
      await fs.mkdir(NOTES_DIR, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `ノート「${title}」の書き込みに成功しました。`;
    } catch (error: any) {
      return `ノートの書き込みエラー: ${error.message}`;
    }
  },
});
```

このツールを `src/mastra/mcp/server.ts` に登録してください:

```typescript copy filename="src/mastra/mcp/server.ts"
import { MCPServer } from '@mastra/mcp';
import { resourceHandlers } from './resources';
import { writeNoteTool } from '../tools/write-note';

export const notes = new MCPServer({
  name: 'notes',
  version: '0.1.0',
  resources: resourceHandlers,
  tools: {
    write: writeNoteTool,
  },
});
```

### プロンプトの実装と登録 \{#implement-and-register-prompts\}

プロンプトハンドラーは、クライアントでそのまま使えるプロンプトを提供します。次の3つを追加します:

* デイリーノート
* ノートの要約
* アイデアのブレインストーミング

これには、インストールが必要なMarkdownパーサー関連のライブラリがいくつか必要です:

```bash copy
npm install unified remark-parse gray-matter @types/unist
```

`src/mastra/mcp/prompts.ts` にあるプロンプトを実装してください:

```typescript copy filename="src/mastra/mcp/prompts.ts"
import type { MCPServerPrompts } from '@mastra/mcp';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import matter from 'gray-matter';
import type { Node } from 'unist';

const prompts = [
  {
    name: 'new_daily_note',
    description: '新しい日次ノートを作成してください。',
    version: '1.0.0',
  },
  {
    name: 'summarize_note',
    description: 'そのノートの要点（TL;DR）を教えてください。',
    version: '1.0.0',
  },
  {
    name: 'brainstorm_ideas',
    description: 'ノートに基づいて新しいアイデアを発想してください。',
    version: '1.0.0',
  },
];

function stringifyNode(node: Node): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node && Array.isArray(node.children)) return node.children.map(stringifyNode).join('');
  return '';
}

export async function analyzeMarkdown(md: string) {
  const { content } = matter(md);
  const tree = unified().use(remarkParse).parse(content);
  const headings: string[] = [];
  const wordCounts: Record<string, number> = {};
  let currentHeading = '無題';
  wordCounts[currentHeading] = 0;
  tree.children.forEach(node => {
    if (node.type === 'heading' && node.depth === 2) {
      currentHeading = stringifyNode(node);
      headings.push(currentHeading);
      wordCounts[currentHeading] = 0;
    } else {
      const textContent = stringifyNode(node);
      if (textContent.trim()) {
        wordCounts[currentHeading] = (wordCounts[currentHeading] || 0) + textContent.split(/\\s+/).length;
      }
    }
  });
  return { headings, wordCounts };
}

const getPromptMessages: MCPServerPrompts['getPromptMessages'] = async ({ name, args }) => {
  switch (name) {
    case 'new_daily_note':
      const today = new Date().toISOString().split('T')[0];
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `タイトルを「${today}」とする新しいノートを作成し、セクションは「## Tasks」「## Meetings」「## Notes」としてください。`,
          },
        },
      ];
    case 'summarize_note':
      if (!args?.noteContent) throw new Error('内容が指定されていません');
      const metaSum = await analyzeMarkdown(args.noteContent as string);
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `各セクションを3項目以内の箇条書きで要約してください。\\n\\n### アウトライン\\n${metaSum.headings.map(h => `- ${h}（${metaSum.wordCounts[h] || 0}語）`).join('\\n')}`.trim(),
          },
        },
      ];
    case 'brainstorm_ideas':
      if (!args?.noteContent) throw new Error('内容が指定されていません');
      const metaBrain = await analyzeMarkdown(args.noteContent as string);
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `以下の不足しているセクションについて、${args?.topic ? `「${args.topic}」に関する` : ''}アイデアを3つ挙げてください。\\n\\n不足しているセクション:\\n${metaBrain.headings.length ? metaBrain.headings.map(h => `- ${h}`).join('\\n') : '- （なし。任意に選んでください）'}`,
          },
        },
      ];
    default:
      throw new Error(`プロンプト「${name}」が見つかりません`);
  }
};

export const promptHandlers: MCPServerPrompts = {
  listPrompts: async () => prompts,
  getPromptMessages,
};
```

`src/mastra/mcp/server.ts` にこれらのプロンプトハンドラーを登録してください:

```typescript copy filename="src/mastra/mcp/server.ts"
import { MCPServer } from '@mastra/mcp';
import { resourceHandlers } from './resources';
import { writeNoteTool } from '../tools/write-note';
import { promptHandlers } from './prompts';

export const notes = new MCPServer({
  name: 'notes',
  version: '0.1.0',
  resources: resourceHandlers,
  prompts: promptHandlers,
  tools: {
    write: writeNoteTool,
  },
});
```

## サーバーを起動する \{#run-the-server\}

やりました。最初の MCP サーバーを作成できましたね！ それでは、[playground](/docs/getting-started/local-dev-playground) を起動して試してみましょう。

```bash copy
npm run dev
```

ブラウザで [`http://localhost:4111`](http://localhost:4111) を開きます。左側のサイドバーで **MCP Servers** を選択し、**notes** MCP サーバーを選びます。

IDE に MCP サーバーを追加する手順が表示されます。この MCP サーバーは任意の MCP クライアントで利用できます。右側の **Available Tools** セクションでは、**write** ツールも選択できます。

**write** ツールで、名前に `test`、Markdown コンテンツに `this is a test` と入力して試してみてください。**Submit** をクリックすると、`notes` 内に新しい `test.md` ファイルが作成されます。
