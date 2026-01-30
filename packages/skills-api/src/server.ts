/**
 * Skills.sh API Server
 * A marketplace API for Agent Skills
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { skillsRouter } from './routes/index.js';

export interface SkillsApiServerOptions {
  /**
   * Enable CORS
   * @default true
   */
  cors?: boolean;
  /**
   * CORS origin
   * @default '*'
   */
  corsOrigin?: string | string[];
  /**
   * Enable request logging
   * @default true
   */
  logging?: boolean;
  /**
   * API prefix
   * @default '/api'
   */
  prefix?: string;
}

/**
 * Create the Skills API server
 */
export function createSkillsApiServer(options: SkillsApiServerOptions = {}): Hono {
  const { cors: enableCors = true, corsOrigin = '*', logging = true, prefix = '/api' } = options;

  const app = new Hono();

  // Middleware
  if (enableCors) {
    app.use(
      '*',
      cors({
        origin: corsOrigin,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400,
      }),
    );
  }

  if (logging) {
    app.use('*', logger());
  }

  app.use('*', prettyJSON());

  // Health check
  app.get('/health', c => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'skills-api',
    });
  });

  // Root endpoint
  app.get('/', c => {
    return c.json({
      name: 'Skills.sh API',
      description: 'API for the Agent Skills marketplace',
      version: '0.0.1',
      documentation: 'https://skills.sh/docs/api',
      endpoints: {
        skills: `${prefix}/skills`,
        categories: `${prefix}/skills/categories`,
        tags: `${prefix}/skills/tags`,
        authors: `${prefix}/skills/authors`,
        stats: `${prefix}/skills/stats`,
        featured: `${prefix}/skills/featured`,
      },
    });
  });

  // Mount skills routes
  app.route(`${prefix}/skills`, skillsRouter);

  // 404 handler
  app.notFound(c => {
    return c.json(
      {
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        documentation: 'https://skills.sh/docs/api',
      },
      404,
    );
  });

  // Error handler
  app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err.message,
      },
      500,
    );
  });

  return app;
}

export { skillsRouter };
