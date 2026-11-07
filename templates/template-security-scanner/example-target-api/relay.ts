import { connect, createServer } from 'node:net';

const target = process.argv[2];
if (!target || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(target)) throw new Error('EXAMPLE_RELAY_TARGET_INVALID');
const listener = createServer(client => {
  const upstream = connect({ host: target, port: 18080 });
  client.pipe(upstream);
  upstream.pipe(client);
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
});
listener.listen(18080, '0.0.0.0');
process.once('SIGTERM', () => listener.close());
process.once('SIGINT', () => listener.close());
