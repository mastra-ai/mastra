import { createServer } from 'node:net';
import { LOCALHOST } from './defaults';

export async function assertPortAcceptsConnections(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, LOCALHOST, () => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

async function canListen(port: number) {
  return new Promise<boolean>(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, LOCALHOST, () => {
      server.close(error => resolve(!error));
    });
  });
}

async function getEphemeralPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, LOCALHOST, () => {
      const address = server.address();
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }

        if (!address || typeof address === 'string') {
          reject(new Error('Expected TCP address'));
          return;
        }

        resolve(address.port);
      });
    });
  });
}

export async function findAvailablePort(preferredPort: number) {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await canListen(port)) return port;
  }

  return getEphemeralPort();
}
