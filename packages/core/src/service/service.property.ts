import { prisma } from '../prisma/client';

import { PrismaClient } from '@prisma-app/client';

export class PropertyService<T extends typeof prisma> {
  db: PrismaClient;
  constructor({ db }: { db: T }) {
    this.db = db as unknown as PrismaClient;
  }

  async getPropertiesByEntityType({
    entityType,
  }: {
    entityType: string;
    // connectionId: string;
  }) {
    return this.db.property.findMany({
      where: {
        entity: {
          type: entityType,
        },
      },
    });
  }
}

export const propertyService = new PropertyService({ db: prisma });
