import { MastraServerBase } from '@mastra/core/server';
import type { Application } from 'express';

/**
 * Minimal Mastra server adapter wrapper for NestJS.
 * Provides MastraServerBase compatibility so getServerApp() works.
 */
export class NestMastraServer extends MastraServerBase<Application> {
  constructor(app: Application) {
    super({ app, name: 'NestMastraServer' });
  }
}
