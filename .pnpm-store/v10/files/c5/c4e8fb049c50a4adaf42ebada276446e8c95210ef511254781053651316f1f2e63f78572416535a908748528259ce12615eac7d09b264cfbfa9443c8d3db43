import http from "node:http";
import { Context } from "../../../bundler/context.js";
import { logVerbose } from "../../../bundler/log.js";

// The below is adapted from https://github.com/vercel/serve/blob/main/source/utilities/server.ts
// MIT License -- https://github.com/vercel/serve/blob/main/license.md
// Copyright (c) 2023 Vercel, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// This has been pared down to only support running locally. It removed options
// we're not using, and added Convex-CLI specific cleanup handling.
export const startServer = async (
  ctx: Context,
  port: number,
  handler: (
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) => Promise<void>,
  options: {
    cors?: boolean;
  },
): Promise<{ cleanupHandle: string }> => {
  // Define the request handler for the server.
  const serverHandler = (request: any, response: any): void => {
    // We can't return a promise in a HTTP request handler, so we run our code
    // inside an async function instead.
    const run = async () => {
      if (options.cors) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      // TODO -- consider adding support for compression
      // if (!args['--no-compression'])
      //   await compress(request as ExpressRequest, response as ExpressResponse);

      await handler(request, response);
    };

    // Then we run the async function, and log any errors.
    // TODO: consider adding a `onError` callback in case we want different error
    // handling.
    run().catch((error: Error) => {
      logVerbose(
        `Failed to serve: ${error.stack?.toString() ?? error.message}`,
      );
    });
  };

  const server = http.createServer(serverHandler);
  const cleanupHandle = ctx.registerCleanup(async () => {
    logVerbose(`Stopping server on port ${port}`);
    await server.close();
  });

  // Listen for any error that occurs while serving, and throw an error
  // if any errors are received.
  server.on("error", (error) => {
    logVerbose(`Failed to serve: ${error.stack?.toString() ?? error.message}`);
  });

  // Finally, start the server -- this promise resolves once the server has started.
  await new Promise((resolve, _reject) => {
    server.listen(port, `127.0.0.1`, () => resolve(`http://127.0.0.1:${port}`));
  });
  return { cleanupHandle };
};
