import { createServer } from 'node:net';
import { LOCALHOST } from './defaults';

function closeServer(server: ReturnType<typeof createServer>) {
  return new Promise<boolean>(resolve => {
    server.close(error => resolve(!error));
  });
}

function canListenOn(port: number, host?: string) {
  return new Promise<boolean>(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));

    const onListening = async () => resolve(await closeServer(server));
    if (host) {
      server.listen(port, host, onListening);
      return;
    }

    server.listen(port, onListening);
  });
}

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
  return (await canListenOn(port, LOCALHOST)) && (await canListenOn(port));
}

async function reserveEphemeralPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
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

async function getEphemeralPort() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await reserveEphemeralPort();
    if (await canListen(port)) return port;
  }

  throw new Error('Unable to find an available local port');
}

export async function findAvailablePort(preferredPort: number) {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await canListen(port)) return port;
  }

  return getEphemeralPort();
}
