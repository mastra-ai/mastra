'use server';

import { default as arkw } from '@arkw/config';

import { revalidateTag } from 'next/cache';

import { getSession } from '@/app/actions/session';

export const saveRecordData = async (recordId: string, data: any) => {
  const sessionId = await getSession();
  try {
    const record = await arkw.dataLayer.db.record.findUniqueOrThrow({
      where: {
        id: recordId,
      },
    });

    const update = { ...(record.data as object), ...data };

    console.log(update);

    await arkw.dataLayer.db.record.update({
      where: {
        id: recordId,
      },
      data: {
        data: update,
      },
    });

    await arkw.triggerSystemEvent({
      key: 'record_updated',
      data: record.data,
      user: {
        referenceId: sessionId!,
      },
    });
  } finally {
    revalidateTag('contacts');
  }
};
