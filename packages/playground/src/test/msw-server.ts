import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

export const defaultHandlers: HttpHandler[] = [];

export const server = setupServer(...defaultHandlers);
