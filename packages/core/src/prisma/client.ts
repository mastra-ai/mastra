import { PrismaClient, Prisma } from '@prisma-app/client';

const globalForPrisma = globalThis as unknown as {
  standardPrisma: PrismaClient;
};

const logLevels = ['error', 'warn', 'info'] as Prisma.LogLevel[];

if (process.env.SHOW_SQL_QUERY === 'true') {
  logLevels.push('query');
}

export const prisma = (url: string): PrismaClient => {
  let prismaInstance;

  if (globalForPrisma.standardPrisma) {
    console.log('Reusing Global Prisma Client...');
    prismaInstance = globalForPrisma.standardPrisma;
  } else {
    prismaInstance = new PrismaClient({
      datasourceUrl: url,
      log: logLevels,
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.standardPrisma = prismaInstance;
  }

  return prismaInstance;
};
