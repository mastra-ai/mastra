import { connect } from 'node:net';
import { Agent, setGlobalDispatcher } from 'undici';

// Route the external documentation and paid Bedrock APIs over real local HTTP.
// MongoDB still uses its real driver and the separate disposable Atlas instance.
setGlobalDispatcher(
  new Agent({
    connect(options, callback) {
      if (!['mastra.ai', 'bedrock-runtime.us-east-1.amazonaws.com'].includes(options.hostname)) {
        callback(new Error(`Unexpected external request: ${options.hostname}`), null);
        return;
      }
      const socket = connect(Number(process.env.TEST_HTTP_PORT), '127.0.0.1');
      socket.once('error', callback);
      socket.once('connect', () => {
        socket.removeListener('error', callback);
        callback(null, socket);
      });
    },
  }),
);
