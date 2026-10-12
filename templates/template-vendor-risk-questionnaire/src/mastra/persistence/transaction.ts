import type { Client, Transaction } from '@libsql/client';

export async function writeTransaction<T>(
  client: Pick<Client, 'transaction'>,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  const transaction = await client.transaction('write');
  try {
    const result = await operation(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
