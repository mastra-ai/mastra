import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

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
}
