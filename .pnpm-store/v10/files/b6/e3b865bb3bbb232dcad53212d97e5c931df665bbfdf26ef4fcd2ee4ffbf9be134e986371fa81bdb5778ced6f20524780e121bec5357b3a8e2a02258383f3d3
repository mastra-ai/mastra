import type { HonoRequest } from 'hono';
import { MastraAuthProvider } from './auth.js';
export declare class CompositeAuth extends MastraAuthProvider {
    private providers;
    constructor(providers: MastraAuthProvider[]);
    authenticateToken(token: string, request: HonoRequest): Promise<unknown | null>;
    authorizeUser(user: unknown, request: HonoRequest): Promise<boolean>;
}
//# sourceMappingURL=composite-auth.d.ts.map