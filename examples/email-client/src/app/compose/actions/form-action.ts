'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { framework } from '@/lib/framework-utils';

export async function sendEmailAction(formData: FormData) {
  try {
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;

    const emails = to.split(',').map(email => email.trim());

    await framework.executeAction({
      integrationName: 'GOOGLE',
      action: 'SEND_EMAIL',
      payload: {
        data: {
          to: emails,
          subject,
          body,
        },
        ctx: {
          referenceId: 'user-1',
        },
      },
    });
    revalidatePath('/emails');
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error };
  }
}
