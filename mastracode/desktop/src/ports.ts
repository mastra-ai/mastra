import { createServer } from 'node:net';

export const DESKTOP_HOST = '127.0.0.1';

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer();
    server.unref();
    server.once('error', () => {
      resolve(false);
    });
    server.listen({ host, port }, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

export async function findAvailablePort(start: number, host: string = DESKTOP_HOST): Promise<number> {
  for (let port = start; port < start + 100; port += 1) {
    if (await canListen(port, host)) return port;
  }
  throw new Error(`No available port found from ${start} to ${start + 99}`);
}
