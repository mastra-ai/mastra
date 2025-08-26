import { createWorkflow } from '@mastra/core/workflows';
import { sendEmailStep, sendEmailInputSchema, sendEmailOutputSchema } from './send-email-step';

export const sendEmailWorkflow = createWorkflow({
  id: 'send_email_workflow',
  inputSchema: sendEmailInputSchema,
  outputSchema: sendEmailOutputSchema,
})
  .then(sendEmailStep)
  .commit();

export { sendEmailWorkflow };
