import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import sgMail from '@sendgrid/mail';

// Input schema for sending email
export const sendEmailInputSchema = z.object({
  to: z.string().email().describe('Recipient email address'),
  subject: z.string().min(1).describe('Email subject'),
  body: z.string().min(1).describe('Email message body'),
});

// Output schema for sending email
export const sendEmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

// Step definition
export const sendEmailStep = createStep({
  id: 'send-email',
  description: 'Sends an email using SendGrid',
  inputSchema: sendEmailInputSchema,
  outputSchema: sendEmailOutputSchema,
  execute: async ({ inputData }) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    try {
      await sgMail.send({
        to: inputData.to,
        from: process.env.SENDGRID_FROM_EMAIL!,
        subject: inputData.subject,
        text: inputData.body,
      });
      return { success: true, message: 'Email sent successfully' };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to send email',
        error: error?.message || String(error),
      };
    }
  },
});
