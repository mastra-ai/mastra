import { describe, expect, it } from 'vitest';

import { SignatureError, verifyWebhookSignature } from '../../src/app/webhooks/signature.js';
import { alertSecret, alertIntakeNowMs, alertIntakeTimestamp, signBody } from '../fixtures/alert-intake.js';

describe('WorkOS-compatible webhook signature', () => {
  const body = Buffer.from('{"value":"raw bytes"}', 'utf8');

  it('validates exact raw bytes and accepts rotated v1 candidates', () => {
    const valid = signBody(body);
    expect(() =>
      verifyWebhookSignature({
        header: `t=${alertIntakeTimestamp},v1=${'0'.repeat(64)},${valid.split(',')[1]}`,
        secret: alertSecret,
        rawBody: body,
        nowMs: alertIntakeNowMs,
      }),
    ).not.toThrow();
    expect(() =>
      verifyWebhookSignature({
        header: `${valid},v1=${'f'.repeat(64)}`,
        secret: alertSecret,
        rawBody: body,
        nowMs: alertIntakeNowMs,
      }),
    ).not.toThrow();
  });

  it('accepts HTTP optional whitespace around WorkOS signature members', () => {
    const valid = signBody(body);
    expect(() =>
      verifyWebhookSignature({
        header: ` \t${valid.replace(',', ' \t, \t')} \t`,
        secret: alertSecret,
        rawBody: body,
        nowMs: alertIntakeNowMs,
      }),
    ).not.toThrow();
  });

  it('rejects altered bytes and malformed members', () => {
    expect(() =>
      verifyWebhookSignature({
        header: signBody(body),
        secret: alertSecret,
        rawBody: Buffer.from('{ "value":"raw bytes"}', 'utf8'),
        nowMs: alertIntakeNowMs,
      }),
    ).toThrowError(SignatureError);
    for (const header of [
      undefined,
      `t=${alertIntakeTimestamp}`,
      `t=${alertIntakeTimestamp},t=${alertIntakeTimestamp},v1=${'a'.repeat(64)}`,
      `t=${alertIntakeTimestamp},v1=xyz`,
      `t=${alertIntakeTimestamp},v2=${'a'.repeat(64)}`,
      `t=${alertIntakeTimestamp}, v 1=${'a'.repeat(64)}`,
      `t= ${alertIntakeTimestamp},v1=${'a'.repeat(64)}`,
      `t=${alertIntakeTimestamp}, \r\nv1=${'a'.repeat(64)}`,
      `t=${alertIntakeTimestamp},\u00a0v1=${'a'.repeat(64)}`,
    ]) {
      expect(() =>
        verifyWebhookSignature({
          header,
          secret: alertSecret,
          rawBody: body,
          nowMs: alertIntakeNowMs,
        }),
      ).toThrowError(SignatureError);
    }
  });

  it('rejects past and future timestamps outside the absolute window', () => {
    for (const timestamp of [String(alertIntakeNowMs - 300_001), String(alertIntakeNowMs + 300_001)]) {
      expect(() =>
        verifyWebhookSignature({
          header: signBody(body, alertSecret, timestamp),
          secret: alertSecret,
          rawBody: body,
          nowMs: alertIntakeNowMs,
        }),
      ).toThrowError(expect.objectContaining({ code: 'SIGNATURE_EXPIRED' }));
    }
  });

  it('uses all current/previous secrets and the approved WorkOS 180s window', () => {
    const previous = 'previous-workos-secret';
    const timestamp = String(alertIntakeNowMs - 180_000);
    expect(() =>
      verifyWebhookSignature({
        header: signBody(body, previous, timestamp),
        secrets: [alertSecret, previous],
        rawBody: body,
        nowMs: alertIntakeNowMs,
        toleranceMs: 180_000,
      }),
    ).not.toThrow();
    expect(() =>
      verifyWebhookSignature({
        header: signBody(body, previous, String(alertIntakeNowMs - 180_001)),
        secrets: [alertSecret, previous],
        rawBody: body,
        nowMs: alertIntakeNowMs,
        toleranceMs: 180_000,
      }),
    ).toThrowError(expect.objectContaining({ code: 'SIGNATURE_EXPIRED' }));
  });
});
