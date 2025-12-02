"use strict";
import http from "node:http";
import { logVerbose } from "../../../bundler/log.js";
export const startServer = async (ctx, port, handler, options) => {
  const serverHandler = (request, response) => {
    const run = async () => {
      if (options.cors) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      await handler(request, response);
    };
    run().catch((error) => {
      logVerbose(
        `Failed to serve: ${error.stack?.toString() ?? error.message}`
      );
    });
  };
  const server = http.createServer(serverHandler);
  const cleanupHandle = ctx.registerCleanup(async () => {
    logVerbose(`Stopping server on port ${port}`);
    await server.close();
  });
  server.on("error", (error) => {
    logVerbose(`Failed to serve: ${error.stack?.toString() ?? error.message}`);
  });
  await new Promise((resolve, _reject) => {
    server.listen(port, `127.0.0.1`, () => resolve(`http://127.0.0.1:${port}`));
  });
  return { cleanupHandle };
};
//# sourceMappingURL=serve.js.map
