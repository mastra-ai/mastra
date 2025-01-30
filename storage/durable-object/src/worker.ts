import { DurableObjectState } from '@cloudflare/workers-types';

interface StoredValue {
  resourceId?: string;
  threadId?: string;
  [key: string]: unknown;
}

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
        case 'data': {
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

            case 'DELETE': {
              await this.state.storage.delete(key);
              return new Response(null, { status: 204 });
            }

            default:
              return new Response('Method not allowed', { status: 405 });
          }
        }

        case 'schema': {
          const key = segments.slice(1).join('/');

          switch (request.method) {
            case 'PUT': {
              const schema = await request.json();
              await this.state.storage.put(key, schema);
              return new Response(null, { status: 204 });
            }

            default:
              return new Response('Method not allowed', { status: 405 });
          }
        }

        case 'query': {
          if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405 });
          }

          const [tableName, queryValue] = segments.slice(1);
          
          if (!tableName || !queryValue) {
            return new Response('Invalid query parameters', { status: 400 });
          }

          // List all keys with the given prefix
          const results: StoredValue[] = [];
          let prefix = `${tableName}:`;
          let moreToLoad = true;
          
          while (moreToLoad) {
            const list = await this.state.storage.list({ prefix });

            // Get all values
            const values = await Promise.all(
              Array.from(list.keys()).map(async key => {
                const value = await this.state.storage.get(key);
                return value as StoredValue;
              })
            );

            // Filter based on the query type
            const filteredValues = values.filter(value => {
              if (tableName === 'threads') {
                return value.resourceId === queryValue;
              } else if (tableName === 'messages') {
                return value.threadId === queryValue;
              }
              return false;
            });

            results.push(...filteredValues);
            
            // Check if there are more items to load
            const entries = Array.from(list.entries());
            if (entries.length > 0) {
              const lastKey = entries[entries.length - 1]?.[0];
              if (lastKey) {
                // Start after the last key we've seen
                prefix = lastKey;
              } else {
                moreToLoad = false;
              }
            } else {
              moreToLoad = false;
            }
          }

          return Response.json(results);
        }

        case 'clear': {
          if (request.method !== 'DELETE') {
            return new Response('Method not allowed', { status: 405 });
          }

          const tableName = segments[1];
          if (!tableName) {
            return new Response('Table name required', { status: 400 });
          }

          let prefix = `${tableName}:`;
          let moreToDelete = true;
          
          while (moreToDelete) {
            const list = await this.state.storage.list({ prefix });
            await Promise.all(Array.from(list.keys()).map(key => this.state.storage.delete(key)));
            
            // Check if there are more items to delete
            const entries = Array.from(list.entries());
            if (entries.length > 0) {
              const lastKey = entries[entries.length - 1]?.[0];
              if (lastKey) {
                // Start after the last key we've seen
                prefix = lastKey;
              } else {
                moreToDelete = false;
              }
            } else {
              moreToDelete = false;
            }
          }

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
