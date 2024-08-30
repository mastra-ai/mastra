'use server';

import { default as arkw } from '@arkw/config';

import { revalidateTag } from 'next/cache';

export const saveRecordData = async (recordId: string, data: any) => {
  try {
    console.log(recordId, data);
  } finally {
    console.log('Record data updated');
    revalidateTag('contacts');
  }
};
