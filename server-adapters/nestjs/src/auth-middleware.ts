/**
 * Authentication and authorization middleware for NestJS.
 *
 * Re-exports platform-specific middleware for both Express and Fastify.
 * The appropriate middleware is automatically used by the MastraServer
 * based on the detected platform.
 */

// Express middleware
export { expressAuthenticationMiddleware, expressAuthorizationMiddleware } from './platform/express-auth';

// Fastify middleware
export { fastifyAuthenticationMiddleware, fastifyAuthorizationMiddleware } from './platform/fastify-auth';
