import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | undefined;

export interface PrismaConfig {
  databaseUrl?: string;
  logLevel?: 'query' | 'info' | 'warn' | 'error';
  connectionLimit?: number;
}

export function createPrismaClient(config?: PrismaConfig): PrismaClient {
  if (!prismaClient) {
    const logOptions = config?.logLevel ? [config.logLevel] : undefined;

    prismaClient = new PrismaClient({
      log: logOptions,
      datasources: config?.databaseUrl
        ? {
            db: {
              url: config.databaseUrl,
            },
          }
        : undefined,
    });
  }

  return prismaClient;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = undefined;
  }
}