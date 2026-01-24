import type { User } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

export class UsersPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.users] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  async createUser(data: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    return this.db.insert<Omit<User, 'id'>>(TABLES.users, data as unknown as Record<string, unknown>);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.findById<User>(TABLES.users, id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.db.findOneBy<User>(TABLES.users, { email });
  }

  async updateUser(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    return this.db.update<Omit<User, 'id'>>(TABLES.users, id, data as unknown as Record<string, unknown>);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.db.delete(TABLES.users, id);
  }

  async listUsers(options?: { limit?: number; offset?: number }): Promise<User[]> {
    return this.db.findBy<User>(TABLES.users, {}, { ...options, orderBy: 'created_at DESC' });
  }
}
