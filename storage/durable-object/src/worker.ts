import { DurableObjectState } from '@cloudflare/workers-types';

export class WorkflowStorageDurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    try {
      switch (segments[0]) {
        case 'snapshot': {
          const key = segments.slice(1).join('/');

          switch (request.method) {
            case 'GET': {
              const data = await this.state.storage.get(key);
              if (!data) {
                return new Response(null, { status: 404 });
              }
              return Response.json(data);
            }

            case 'PUT': {
              const data = await request.json();
              await this.state.storage.put(key, data);
              return new Response(null, { status: 204 });
            }

            default:
              return new Response('Method not allowed', { status: 405 });
          }
        }

        case 'clear': {
          if (request.method !== 'DELETE') {
            return new Response('Method not allowed', { status: 405 });
          }

          const tableName = segments[1];
          if (!tableName) {
            return new Response('Table name required', { status: 400 });
          }

          let cursor: string | undefined;
          do {
            const list = await this.state.storage.list({ prefix: `${tableName}:`, cursor });
            await Promise.all(Array.from(list.keys()).map(key => this.state.storage.delete(key)));
            cursor = list.cursor;
          } while (cursor);

          return new Response(null, { status: 204 });
        }

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('WorkflowStorageDurableObject error:', error);
      return new Response(error instanceof Error ? error.message : 'Internal error', {
        status: 500,
      });
    }
  }
}
