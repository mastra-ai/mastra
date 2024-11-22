/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy src/index.ts --name my-worker` to deploy your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { stringify } from 'superjson';

export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log({
      env,
      run: env.AI.run,
    });
    return new Response(
      stringify({
        AI: {
          ...env.AI,
          run: env.AI.run,
        },
      }),
    );
  },
};
