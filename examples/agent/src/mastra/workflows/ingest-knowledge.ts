import { createStep, createWorkflow } from '@mastra/core/workflows';
import z from 'zod';
/**
 * Sample FAQ documents for the support knowledge base.
 * In production, you would load these from a database or file system.
 */
const sampleFAQDocuments = [
  {
    id: 'password-reset',
    content: `How to reset your password:
1. Go to the login page and click "Forgot Password"
2. Enter your email address
3. Check your inbox for a reset link (check spam folder if not found)
4. Click the link and create a new password
5. Your new password must be at least 8 characters with one number and one special character

Note: Password reset links expire after 24 hours.`,
    metadata: { category: 'account', topic: 'password' },
  },
  {
    id: 'billing-cycle',
    content: `Understanding your billing cycle:
- Billing occurs on the same day each month (your signup date)
- You can view your billing date in Settings > Billing
- Invoices are sent via email 3 days before billing
- You can download past invoices from the billing portal

To change your billing date, contact support at billing@example.com.`,
    metadata: { category: 'billing', topic: 'cycle' },
  },
  {
    id: 'plan-upgrade',
    content: `How to upgrade your plan:
1. Go to Settings > Subscription
2. Click "Change Plan"
3. Select your new plan (Pro, Team, or Enterprise)
4. Confirm the upgrade

Upgrades take effect immediately. You'll be charged a prorated amount for the remainder of your billing cycle. Downgrades take effect at the start of your next billing cycle.`,
    metadata: { category: 'billing', topic: 'upgrade' },
  },
  {
    id: 'api-rate-limits',
    content: `API Rate Limits by Plan:
- Free: 100 requests/minute, 1,000 requests/day
- Pro: 1,000 requests/minute, 50,000 requests/day  
- Team: 5,000 requests/minute, 500,000 requests/day
- Enterprise: Custom limits

When you hit a rate limit, you'll receive a 429 error. Implement exponential backoff in your code to handle this gracefully.`,
    metadata: { category: 'api', topic: 'limits' },
  },
  {
    id: 'two-factor-auth',
    content: `Setting up Two-Factor Authentication (2FA):
1. Go to Settings > Security
2. Click "Enable 2FA"
3. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password)
4. Enter the 6-digit code to verify
5. Save your backup codes in a secure location

If you lose access to your authenticator, use a backup code to sign in, then reconfigure 2FA.`,
    metadata: { category: 'account', topic: 'security' },
  },
  {
    id: 'data-export',
    content: `Exporting your data:
1. Go to Settings > Data & Privacy
2. Click "Request Data Export"
3. Select what data to include (profile, content, analytics)
4. Click "Generate Export"
5. You'll receive an email with a download link within 24 hours

Exports are available in JSON or CSV format. Large exports may take longer to process.`,
    metadata: { category: 'account', topic: 'data' },
  },
  {
    id: 'team-invite',
    content: `Inviting team members:
1. Go to Settings > Team
2. Click "Invite Member"
3. Enter their email address
4. Select their role (Admin, Editor, or Viewer)
5. Click "Send Invite"

Invitations expire after 7 days. Team members can be managed from the Team settings page. Only Admins can invite new members.`,
    metadata: { category: 'team', topic: 'invite' },
  },
  {
    id: 'refund-policy',
    content: `Refund Policy:
- Full refund available within 14 days of purchase
- Prorated refunds for annual plans within 30 days
- No refunds after 30 days for annual plans
- Monthly plans: cancel anytime, no refund for current period

To request a refund:
1. Contact support@example.com
2. Include your account email and reason for refund
3. Refunds are processed within 5-7 business days`,
    metadata: { category: 'billing', topic: 'refund' },
  },
  {
    id: 'webhook-setup',
    content: `Setting up webhooks:
1. Go to Settings > Integrations > Webhooks
2. Click "Add Webhook"
3. Enter your endpoint URL (must be HTTPS)
4. Select events to subscribe to
5. Save and note the signing secret

All webhook payloads include a signature header (X-Signature) for verification. Use the signing secret to verify the payload hasn't been tampered with.`,
    metadata: { category: 'api', topic: 'webhooks' },
  },
  {
    id: 'support-hours',
    content: `Support availability:
- Email support: 24/7 (response within 24 hours)
- Live chat: Monday-Friday, 9am-6pm EST
- Phone support (Enterprise only): Monday-Friday, 9am-5pm EST

For urgent issues outside business hours, email urgent@example.com with "URGENT" in the subject line.`,
    metadata: { category: 'support', topic: 'hours' },
  },
];

/**
 * Company policies that are always included in agent responses.
 */
const companyPolicies = `
COMPANY POLICIES (Always Active):
- All support requests are logged for quality assurance
- Personal data is handled according to GDPR guidelines
- Response time SLA: 24 hours for email, 2 hours for chat
- Escalation: Use "escalate" command to transfer to human agent
`.trim();

const ingestStep = createStep({
  id: 'ingest-step',
  description: 'Ingest knowledge into the knowledge base',
  inputSchema: z.any(),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ mastra }) => {
    console.log('Initializing support knowledge base...');

    const supportKnowledge = mastra.getKnowledge();

    if (!supportKnowledge) {
      throw new Error('Knowledge not found');
    }

    // Add company policies as static knowledge (always included)
    await supportKnowledge.add('default', {
      type: 'text',
      key: 'static/company-policies',
      content: companyPolicies,
    });

    // Add FAQ documents (dynamically retrieved based on query)
    for (const doc of sampleFAQDocuments) {
      await supportKnowledge.add('default', {
        type: 'text',
        key: doc.id,
        content: doc.content,
      });
    }

    console.log(`Added ${sampleFAQDocuments.length + 1} documents to knowledge base`);

    return {
      success: true,
    };
  },
});

export const ingestKnowledgeWorkflow = createWorkflow({
  id: 'ingest-knowledge',
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
  }),
})
  .then(ingestStep)
  .commit();
