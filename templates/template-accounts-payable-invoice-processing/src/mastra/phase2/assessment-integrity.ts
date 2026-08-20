import { createHmac, timingSafeEqual } from 'node:crypto';

const signingKey = () => {
  const key = process.env.AP_ASSESSMENT_SIGNING_KEY?.trim();
  const knownValues = new Set(['replace-with-a-long-random-secret', 'local-development-assessment-key']);
  if (key && !knownValues.has(key) && key.length >= 32) return key;
  if (process.env.NODE_ENV === 'production' || process.env.QBO_MCP_ENABLE_POSTING?.trim().toLowerCase() === 'true')
    throw new Error('A server-only AP_ASSESSMENT_SIGNING_KEY is required for production or QuickBooks posting');
  return 'local-development-assessment-key';
};

const payload = (assessment: Record<string, unknown>) => {
  const { assessmentSignature: _signature, ...unsigned } = assessment;
  return JSON.stringify(unsigned);
};

export const signAssessment = (assessment: Record<string, unknown>) =>
  createHmac('sha256', signingKey()).update(payload(assessment)).digest('hex');
export const verifyAssessment = (assessment: Record<string, unknown>) => {
  const actual = typeof assessment.assessmentSignature === 'string' ? assessment.assessmentSignature : '';
  const expected = signAssessment(assessment);
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};
