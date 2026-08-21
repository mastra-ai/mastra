import { createHmac, timingSafeEqual } from 'node:crypto';
import { isLocalFixtureDemo } from '../auth.ts';

const signingKey = () => {
  const key = process.env.AP_ASSESSMENT_SIGNING_KEY?.trim(),
    authToken = process.env.MASTRA_AUTH_TOKEN?.trim();
  const knownValues = new Set(['replace-with-a-long-random-secret', 'local-development-assessment-key']);
  if (key && key !== authToken && !knownValues.has(key) && key.length >= 32) return key;
  if (!isLocalFixtureDemo())
    throw new Error('A server-only AP_ASSESSMENT_SIGNING_KEY is required outside the local fixture demo');
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
