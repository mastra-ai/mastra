import {
  ConvexClient,
  setDefaultWebSocketConstructor,
} from "./simple_client.js";

// This file is compiled with `bundle: true` with an exception for
// `./simple_client.js` so this "ws" import will be inlined.
import ws from "ws";
const nodeWebSocket = ws as unknown as typeof WebSocket;

setDefaultWebSocketConstructor(nodeWebSocket);

export { ConvexClient };
