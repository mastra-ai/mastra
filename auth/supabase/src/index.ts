import type { MastraUser } from '@internal/auth';
import type { MastraAuthProviderOptions } from '@internal/auth/provider';
import { MastraAuthProvider, normalizeMastraUser } from '@internal/auth/provider';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

interface MastraAuthSupabaseOptions extends MastraAuthProviderOptions<User> {
  url?: string;
  anonKey?: string;
}

export class MastraAuthSupabase extends MastraAuthProvider<User> {
  protected supabase: SupabaseClient;

  constructor(options?: MastraAuthSupabaseOptions) {
    super({ name: options?.name ?? 'supabase' });

    const supabaseUrl = options?.url ?? process.env.SUPABASE_URL;
    const supabaseAnonKey = options?.anonKey ?? process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase URL and anon key are required, please provide them in the options or set the environment variables SUPABASE_URL and SUPABASE_ANON_KEY',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error) {
      return null;
    }

    return data.user;
  }

  async authorizeUser(user: User) {
    // Get user data from Supabase
    const { data, error } = await this.supabase.from('users').select('isAdmin').eq('id', user?.id).single();

    if (error) {
      return false;
    }

    const isAdmin = data?.isAdmin;

    // Check permissions based on role
    return isAdmin;
  }

  /**
   * Normalize the Supabase user; display name and avatar live in
   * `user_metadata`, which the default normalization does not inspect.
   * Supabase's `role` is the Postgres role (e.g. `authenticated`), not an
   * application role, so it is dropped to let RBAC supply the role instead.
   */
  override toMastraUser(user: User): MastraUser {
    const { role: _postgresRole, ...normalized } = normalizeMastraUser(user);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const pick = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value : undefined;
    if (!normalized.name) {
      const name = pick(metadata.full_name) ?? pick(metadata.name);
      if (name) normalized.name = name;
    }
    if (!normalized.avatarUrl) {
      const avatarUrl = pick(metadata.avatar_url) ?? pick(metadata.picture);
      if (avatarUrl) normalized.avatarUrl = avatarUrl;
    }
    return normalized;
  }
}
