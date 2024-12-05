import { MastraMemory, MessageType, ThreadType } from '@mastra/core';
import { ToolResultPart } from 'ai';
import { TextPart } from 'ai';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

export class PgMemory extends MastraMemory {
  private pool: pg.Pool;
  private MAX_CONTEXT_TOKENS: number;

  constructor(config: { connectionString: string; maxTokens?: number }) {
    super();
    this.pool = new Pool({ connectionString: config.connectionString });
    this.MAX_CONTEXT_TOKENS = config.maxTokens || 16000;
  }

  async drop() {
    const client = await this.pool.connect();
    await client.query('DELETE FROM mastra_messages');
    await client.query('DELETE FROM mastra_threads');
    client.release();
    await this.pool.end();
  }

  // Simplified token estimation
  private estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  private processMessages(messages: MessageType[]): MessageType[] {
    return messages.map(mssg => ({
      ...mssg,
      content: typeof mssg.content === 'string' ? JSON.parse((mssg as MessageType).content as string) : mssg.content,
    }));
  }

  async ensureTablesExist(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Check if the threads table exists
      const threadsResult = await client.query<{ exists: boolean }>(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'mastra_threads'
                );
            `);

      if (!threadsResult?.rows?.[0]?.exists) {
        await client.query(`
                    CREATE TABLE IF NOT EXISTS mastra_threads (
                        id UUID PRIMARY KEY,
                        resourceid TEXT,
                        title TEXT,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        metadata JSONB
                    );
                `);
      }

      // Check if the messages table exists
      const messagesResult = await client.query<{ exists: boolean }>(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'mastra_messages'
                );
            `);

      if (!messagesResult?.rows?.[0]?.exists) {
        await client.query(`
                    CREATE TABLE IF NOT EXISTS mastra_messages (
                        id UUID PRIMARY KEY,
                        content TEXT NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        tool_call_ids TEXT DEFAULT NULL,
                        tool_call_args TEXT DEFAULT NULL,
                        tool_call_args_expire_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
                        tool_names TEXT DEFAULT NULL,
                        type VARCHAR(20) NOT NULL,
                        tokens INTEGER DEFAULT NULL,
                        thread_id UUID NOT NULL,
                        FOREIGN KEY (thread_id) REFERENCES mastra_threads(id)
                    );
                `);
      }

      // Check if tool_names column exists in mastra_messages
      const toolNamesColumnResult = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'mastra_messages'
          AND column_name = 'tool_names'
        );
      `);

      if (!toolNamesColumnResult?.rows?.[0]?.exists) {
        await client.query(`
          ALTER TABLE mastra_messages
          ADD COLUMN tool_names TEXT DEFAULT NULL;
        `);
      }
    } finally {
      client.release();
    }
  }

  async updateThread(id: string, title: string, metadata: Record<string, unknown>): Promise<ThreadType> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
                UPDATE mastra_threads
                SET title = $1, metadata = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING *
                `,
        [title, JSON.stringify(metadata), id],
      );
      return result?.rows?.[0]!;
    } finally {
      client.release();
    }
  }

  async deleteThread(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `
                DELETE FROM mastra_messages
                WHERE thread_id = $1
                `,
        [id],
      );

      await client.query(
        `
                DELETE FROM mastra_threads
                WHERE id = $1
                `,
        [id],
      );
    } finally {
      client.release();
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `
                DELETE FROM mastra_messages
                WHERE id = $1
                `,
        [id],
      );
    } finally {
      client.release();
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    console.log('getThreadById', threadId);
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
                SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, resourceid, metadata
                FROM mastra_threads
                WHERE id = $1
            `,
        [threadId],
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getThreadsByResourceId({ resourceid }: { resourceid: string }): Promise<ThreadType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
                SELECT id, title, resourceid, created_at AS createdAt, updated_at AS updatedAt, metadata
                FROM mastra_threads
                WHERE resourceid = $1
            `,
        [resourceid],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const { id, title, createdAt, updatedAt, resourceid, metadata } = thread;
      const result = await client.query<ThreadType>(
        `
                INSERT INTO mastra_threads (id, title, created_at, updated_at, resourceid, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = $4, resourceid = $5, metadata = $6
                RETURNING id, title, created_at AS createdAt, updated_at AS updatedAt, resourceid, metadata
            `,
        [id, title, createdAt, updatedAt, resourceid, JSON.stringify(metadata)],
      );
      return result?.rows?.[0]!;
    } finally {
      client.release();
    }
  }

  async checkIfValidArgExists({
    threadId,
    hashedToolCallArgs,
    toolName,
  }: {
    threadId: string;
    hashedToolCallArgs: string;
    toolName: string;
  }): Promise<boolean> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();

    try {
      const toolArgsResult = await client.query<{ toolCallIds: string; toolCallArgs: string; createdAt: string }>(
        ` SELECT tool_call_ids as toolCallIds, 
                tool_call_args as toolCallArgs,
                created_at AS createdAt
         FROM mastra_messages
         WHERE thread_id = $1
         AND tool_call_args ILIKE $2
         AND tool_call_args_expire_at > $3
         AND tool_names ILIKE $4
         AND type = 'tool-call'
         ORDER BY created_at ASC
         LIMIT 1`,
        [threadId, `%${hashedToolCallArgs}%`, new Date().toISOString(), `%${toolName}%`],
      );

      return toolArgsResult.rows.length > 0;
    } catch (error) {
      console.log('error checking if valid arg exists====', error);
      return false;
    } finally {
      client.release();
    }
  }

  async getCachedToolResult({
    threadId,
    toolArgs,
    toolName,
  }: {
    threadId: string;
    toolArgs: Record<string, unknown>;
    toolName: string;
  }): Promise<ToolResultPart['result'] | null> {
    await this.ensureTablesExist();
    console.log('checking for cached tool result====', JSON.stringify(toolArgs, null, 2));

    const client = await this.pool.connect();

    try {
      const hashedToolArgs = crypto.createHash('sha256').update(JSON.stringify(toolArgs)).digest('hex');

      console.log('hashedToolArgs====', hashedToolArgs);

      const toolArgsResult = await client.query<{ tool_call_ids: string; tool_call_args: string; created_at: string }>(
        ` SELECT tool_call_ids, 
                tool_call_args,
                created_at
         FROM mastra_messages
         WHERE thread_id = $1
         AND tool_call_args ILIKE $2
         AND tool_call_args_expire_at > $3
         AND tool_names ILIKE $4
         AND type = 'tool-call'
         ORDER BY created_at ASC
         LIMIT 1`,
        [threadId, `%${hashedToolArgs}%`, new Date().toISOString(), `%${toolName}%`],
      );

      if (toolArgsResult.rows.length > 0) {
        console.log('toolArgsResult====', JSON.stringify(toolArgsResult.rows[0], null, 2));
        const toolCallArgs = JSON.parse(toolArgsResult.rows[0]?.tool_call_args!) as string[];
        const toolCallIds = JSON.parse(toolArgsResult.rows[0]?.tool_call_ids!) as string[];
        const createdAt = toolArgsResult.rows[0]?.created_at!;

        console.log('toolCallArgs====', JSON.stringify(toolCallArgs, null, 2));
        console.log('toolCallIds====', JSON.stringify(toolCallIds, null, 2));
        console.log('createdAt====', createdAt);

        const toolCallArgsIndex = toolCallArgs.findIndex(arg => arg === hashedToolArgs);
        const correspondingToolCallId = toolCallIds[toolCallArgsIndex];

        console.log('correspondingToolCallId====', { correspondingToolCallId, toolCallArgsIndex });

        const toolResult = await client.query<{ content: string }>(
          `SELECT content 
         FROM mastra_messages 
         WHERE thread_id = $1
         AND tool_call_ids ILIKE $2
         AND type = 'tool-result'
         AND created_at = $3
         LIMIT 1`,
          [threadId, `%${correspondingToolCallId}%`, new Date(createdAt).toISOString()],
        );

        console.log('called toolResult');

        if (toolResult.rows.length === 0) {
          console.log('no tool result found');
          return null;
        }

        const toolResultContent = JSON.parse(toolResult.rows[0]?.content!) as Array<ToolResultPart>;
        const requiredToolResult = toolResultContent.find(part => part.toolCallId === correspondingToolCallId);

        console.log('requiredToolResult====', JSON.stringify(requiredToolResult, null, 2));

        if (requiredToolResult) {
          return requiredToolResult.result;
        }
      }

      return null;
    } catch (error) {
      console.log('error getting cached tool result====', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getContextWindow({
    threadId,
    time,
    keyword,
  }: {
    threadId: string;
    time?: Date;
    keyword?: string;
  }): Promise<MessageType[]> {
    await this.ensureTablesExist();
    console.log('table exists');
    const client = await this.pool.connect();

    try {
      let timeFilter = '';

      // If keyword exists, find the matching user message time
      if (keyword) {
        console.log('using keyword===', keyword);
        let keywordQuery = `SELECT created_at
           FROM mastra_messages
           WHERE thread_id = $1
           AND role = 'user'
           AND type = 'text'
           AND content ILIKE $2`;

        if (time) {
          console.log('using time===', time.toISOString());
          keywordQuery += `\nAND created_at >= '${time.toISOString()}'`;
        }
        const oneMinuteAgo = new Date(new Date().getTime() - 1 * 60 * 1000);
        keywordQuery += `
          AND created_at < '${oneMinuteAgo.toISOString()}'
          ORDER BY created_at ASC
          LIMIT 1`;

        console.log('keywordQuery===', keywordQuery);
        const keywordResult = await client.query<{ created_at: Date }>(keywordQuery, [threadId, `%${keyword}%`]);

        if (keywordResult.rows[0]) {
          console.log('keywordResult===', JSON.stringify(keywordResult.rows[0], null, 2));
          timeFilter = `AND created_at >= '${keywordResult.rows[0].created_at.toISOString()}'`;
        }
      }

      if (time && !timeFilter) {
        // Add time filter if strategy type is time and there is no keyword
        timeFilter = `AND created_at >= '${time.toISOString()}'`;
      }

      console.log('final timeFilter===', timeFilter);

      // Get messages with token limit and time filter
      const result = await client.query<MessageType>(
        `WITH RankedMessages AS (
           SELECT *,
                  SUM(tokens) OVER (ORDER BY created_at DESC) as running_total
           FROM mastra_messages
           WHERE thread_id = $1
           AND type = 'text'
           ${timeFilter}
           ORDER BY created_at DESC
         )
         SELECT id, 
                content, 
                role, 
                type,
                created_at AS createdAt, 
                thread_id AS threadId
         FROM RankedMessages
         WHERE running_total <= $2
         ORDER BY created_at ASC`,
        [threadId, this.MAX_CONTEXT_TOKENS],
      );

      // console.log('result===', JSON.stringify(result.rows, null, 2));

      return this.processMessages(result.rows);
    } catch (error) {
      console.log('error getting context window====', error);
      return [];
    } finally {
      client.release();
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const message of messages) {
        const { id, content, role, createdAt, threadId, toolCallIds, toolCallArgs, type, toolNames } = message;
        let tokens = null;
        if (type === 'text') {
          const contentMssg = role === 'assistant' ? (content as Array<TextPart>)[0]?.text || '' : (content as string);
          tokens = this.estimateTokens(contentMssg);
        }

        // Hash the toolCallArgs if they exist
        const hashedToolCallArgs = toolCallArgs
          ? toolCallArgs.map(args => crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex'))
          : null;

        let validArgExists = false;
        if (hashedToolCallArgs?.length) {
          // Check all args sequentially
          validArgExists = true; // Start true and set to false if any check fails
          for (let i = 0; i < hashedToolCallArgs.length; i++) {
            const isValid = await this.checkIfValidArgExists({
              threadId,
              hashedToolCallArgs: hashedToolCallArgs[i]!,
              toolName: toolNames?.[i]!,
            });
            if (!isValid) {
              validArgExists = false;
              break;
            }
          }
        }

        const toolCallArgsExpireAt = !toolCallArgs
          ? null
          : validArgExists
            ? createdAt
            : new Date(createdAt.getTime() + 5 * 60 * 1000); // 5 minutes

        await client.query(
          `
                    INSERT INTO mastra_messages (id, content, role, created_at, thread_id, tool_call_ids, tool_call_args, type, tokens, tool_call_args_expire_at, tool_names)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `,
          [
            id,
            JSON.stringify(content),
            role,
            createdAt.toISOString(),
            threadId,
            JSON.stringify(toolCallIds),
            JSON.stringify(hashedToolCallArgs),
            type,
            tokens,
            toolCallArgsExpireAt?.toISOString(),
            JSON.stringify(toolNames),
          ],
        );
      }
      await client.query('COMMIT');
      return messages;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMessages({ threadId }: { threadId: string }): Promise<MessageType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<MessageType>(
        `
                SELECT 
                    id, 
                    content, 
                    role, 
                    type,
                    created_at AS createdAt, 
                    thread_id AS threadId
                FROM mastra_messages
                WHERE thread_id = $1
                ORDER BY created_at ASC
            `,
        [threadId],
      );

      return this.processMessages(result.rows);
    } finally {
      client.release();
    }
  }
}
