
                import { app } from './hono';
                return { MGET: handle(app), MPOST: handle(app) };
            