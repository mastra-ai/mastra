import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { KnowledgeFilesystemStorage, Knowledge } from '@mastra/skills';

/**
 * Resolve knowledge path - works from both project root and src/mastra/public/
 */
function resolveKnowledgePath(): string {
  const cwd = process.cwd();

  // Try project root first (for demo scripts)
  const fromRoot = resolve(cwd, '.mastra-knowledge/knowledge/support');
  if (existsSync(fromRoot)) {
    return fromRoot;
  }

  // Try from src/mastra/public/ (for mastra dev - 3 levels up)
  const fromOutput = resolve(cwd, '../../../.mastra-knowledge/knowledge/support');
  if (existsSync(fromOutput)) {
    return fromOutput;
  }

  // Fallback to project root path
  return fromRoot;
}

/**
 * Knowledge base for the support agent.
 * Uses BM25 for fast keyword search - no vector database or embeddings needed.
 */
export const supportKnowledge = new Knowledge({
  id: 'support-knowledge',
  storage: new KnowledgeFilesystemStorage({ paths: [resolveKnowledgePath()] }),
  bm25: true,
});

/**
 * Sample FAQ documents for the support knowledge base.
 */
export const sampleFAQDocuments = [
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
export const companyPolicies = `
COMPANY POLICIES (Always Active):
- All support requests are logged for quality assurance
- Personal data is handled according to GDPR guidelines
- Response time SLA: 24 hours for email, 2 hours for chat
- Escalation: Use "escalate" command to transfer to human agent
`.trim();

/**
 * Initialize the support knowledge base with sample documents.
 */
export async function initializeSupportKnowledge(): Promise<void> {
  console.log('Initializing support knowledge base...');

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
}
