import { PrismaClient } from '@prisma/client';

export class DataLayer {
  db: PrismaClient;

  constructor({ db }: { db: PrismaClient }) {
    this.db = db;
  }

  async getConnectionById({
    connectionId,
    name,
  }: {
    name: string;
    connectionId: string;
  }) {
    return this.db.dataIntegration.findUnique({
      where: {
        connectionId_name: {
          connectionId,
          name,
        },
      },
    });
  }
}
