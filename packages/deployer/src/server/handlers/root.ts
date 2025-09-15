import type { Context } from 'hono';

// Root handler
export async function rootHandler(c: Context) {
  const baseUrl = new URL(c.req.url).origin;

  return c.html(
    /* html */
    `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Mastra API</title>
          <style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }</style>
        </head>
        <body>
          <h1>Welcome to the Mastra API!</h1>
          <p>
            You can discover all available endpoints on the 
            <a href="${baseUrl}/swagger-ui" target="_blank">Swagger UI</a> page.
          </p>
          <p>By default Mastra automatically exposes registered agents and workflows via the server. For additional behavior you can define your own <a href="https://mastra.ai/en/docs/server-db/custom-api-routes" target="_blank">HTTP routes</a>.</p>
        </body>
      </html>
    `,
  );
}
