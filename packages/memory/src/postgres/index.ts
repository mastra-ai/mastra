import { MastraMemory, MessageType, ThreadType } from '@mastra/core';
import { randomUUID } from 'crypto';
import pg from 'pg';

const { Pool } = pg;

export class PgMemory extends MastraMemory {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    super();
    this.pool = new Pool({ connectionString });
  }

  async drop() {
    const client = await this.pool.connect();
    await client.query('DELETE FROM mastra_messages');
    await client.query('DELETE FROM mastra_threads');
    client.release();
    await this.pool.end();
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
                        thread_id UUID NOT NULL,
                        FOREIGN KEY (thread_id) REFERENCES mastra_threads(id)
                    );
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

  async getThreadById(threadId: string): Promise<ThreadType | null> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<ThreadType>(
        `
                SELECT id, title, created_at AS createdAt, updated_at AS updatedAt, metadata
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

  async saveThread(thread: ThreadType): Promise<ThreadType> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const { id, title, createdAt, updatedAt, metadata } = thread;
      const result = await client.query<ThreadType>(
        `
                INSERT INTO mastra_threads (id, title, created_at, updated_at, metadata)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = $4, metadata = $5
                RETURNING id, title, created_at AS createdAt, updated_at AS updatedAt, metadata
            `,
        [id, title, createdAt, updatedAt, JSON.stringify(metadata)],
      );
      return result?.rows?.[0]!;
    } finally {
      client.release();
    }
  }

  async saveMessages(messages: MessageType[]): Promise<MessageType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const message of messages) {
        const { id, content, role, createdAt, threadId } = message;
        await client.query(
          `
                    INSERT INTO mastra_messages (id, content, role, created_at, thread_id)
                    VALUES ($1, $2, $3, $4, $5)
                `,
          [id, content, role, createdAt.toISOString(), threadId],
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

  async getMessages(threadId: string): Promise<MessageType[]> {
    await this.ensureTablesExist();

    const client = await this.pool.connect();
    try {
      const result = await client.query<MessageType>(
        `
                SELECT 
                    id, 
                    content, 
                    role, 
                    created_at AS createdAt, 
                    thread_id AS threadId
                FROM mastra_messages
                WHERE thread_id = $1
                ORDER BY created_at ASC
            `,
        [threadId],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async createThread(title?: string, metadata?: Record<string, unknown>): Promise<ThreadType> {
    await this.ensureTablesExist();

    const id = randomUUID();
    const now = new Date();
    const thread: ThreadType = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
    return this.saveThread(thread);
  }

  async addMessage(threadId: string, content: string, role: 'user' | 'assistant'): Promise<MessageType> {
    await this.ensureTablesExist();

    const thread = await this.getThreadById(threadId);
    if (!thread) {
      throw new Error(`Thread with ID ${threadId} does not exist.`);
    }

    const id = randomUUID();
    const message: MessageType = {
      id,
      content,
      role,
      createdAt: new Date(),
      threadId,
    };

    const [savedMessage] = await this.saveMessages([message]);

    return savedMessage!;
  }
}
