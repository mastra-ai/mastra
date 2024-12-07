import { check } from 'tcp-port-used';

export const isPortOpen = async (port: number): Promise<boolean> => {
  return new Promise(resolve => {
    check(port).then((inUse: boolean) => {
      resolve(!inUse);
    });
  });
};

const getNextOpenPort = async (startFrom: number = 2222): Promise<number> => {
  for (const port of Array.from({ length: 20 }, (_, i) => startFrom + i)) {
    const isOpen = await isPortOpen(port);
    if (isOpen) {
      return port;
    }
  }
  throw new Error('No open ports found after 20 attempts');
};

export async function getInfraPorts({
  defaultPostgresPort,
}: { defaultAdminPort?: number; defaultInngestPort?: number; defaultPostgresPort?: number } = {}) {
  let postgresPort = defaultPostgresPort || 5432;
  const dbPortOpen = await isPortOpen(postgresPort);

  if (!dbPortOpen) {
    postgresPort = (await getNextOpenPort(postgresPort)) as number;
  }

  return { postgresPort };
}
