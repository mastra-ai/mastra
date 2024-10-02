'use server';

import { default as mastra } from '@mastra/config';

import { revalidateTag } from 'next/cache';

import { getSession } from '@/app/actions/session';

export const saveRecordData = async (recordId: string, data: any) => {
  const sessionId = await getSession();
  try {
    const record = await mastra.dataLayer.db.record.findUniqueOrThrow({
      where: {
        id: recordId,
      },
    });

    const update = { ...(record.data as object), ...data };

    console.log(update);

    await mastra.dataLayer.db.record.update({
      where: {
        id: recordId,
      },
      data: {
        data: update,
      },
    });

    await mastra.triggerSystemEvent({
      key: 'record_updated',
      data: record.data,
      user: {
        connectionId: sessionId!,
      },
    });
  } finally {
    revalidateTag('contacts');
  }
};
