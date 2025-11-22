import type { HonoRequest } from 'hono';
import { MastraAuthProvider } from './auth';

export class CompositeAuth extends MastraAuthProvider {
  private providers: MastraAuthProvider[];

  constructor(providers: MastraAuthProvider[]) {
    super();
    this.providers = providers;
  }

  async authenticateToken(token: string, request: HonoRequest): Promise<unknown | null> {
    for (const provider of this.providers) {
      try {
        const user = await provider.authenticateToken(token, request);
        if (user) {
          return user;
        }
      } catch {
        // ignore error, try next provider
      }
    }
    return null;
  }

  async authorizeUser(user: unknown, request: HonoRequest): Promise<boolean> {
    for (const provider of this.providers) {
      const authorized = await provider.authorizeUser(user, request);
      if (authorized) {
        return true;
      }
    }
    return false;
  }
}
