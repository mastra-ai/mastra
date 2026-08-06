import { describe, expect, it } from 'vitest';

import { redactError, redactErrorMessage } from './redact.js';

const CUSTOM_TEMPLATE = 'https://github.com/acme-corp/secret-template';
const CREDENTIALED_TEMPLATE = 'https://user:ghp_token123@github.com/acme-corp/secret-template';

describe('redactErrorMessage', () => {
  it('removes a custom template URL from a git clone failure message', () => {
    // tinyexec's NonZeroExitError embeds the full command line.
    const message = `Failed to clone repository: The command 'git clone ${CUSTOM_TEMPLATE} /tmp/x' exited with a non-zero status (128)`;

    const redacted = redactErrorMessage(message, [CUSTOM_TEMPLATE]);

    expect(redacted).not.toContain('acme-corp');
    expect(redacted).toBe(
      `Failed to clone repository: The command 'git clone [redacted] /tmp/x' exited with a non-zero status (128)`,
    );
  });

  it('strips embedded URL credentials even when the value is not in the sensitive list', () => {
    const message = `Failed to clone repository: The command 'git clone ${CREDENTIALED_TEMPLATE} /tmp/x' exited with a non-zero status (128)`;

    const redacted = redactErrorMessage(message);

    expect(redacted).not.toContain('ghp_token123');
    expect(redacted).not.toContain('user:');
    expect(redacted).toContain('//[redacted]@github.com');
  });

  it('redacts the degit variant of a custom template (github.com prefix stripped)', () => {
    const degitRepo = CUSTOM_TEMPLATE.replace('https://github.com/', '');
    const message = `The command 'npx degit ${degitRepo} /tmp/x' exited with a non-zero status (1)`;

    const redacted = redactErrorMessage(message, [CUSTOM_TEMPLATE]);

    expect(redacted).not.toContain('acme-corp');
    expect(redacted).toContain('npx degit [redacted]');
  });

  it('redacts a credentialed template even when the message echoes it without credentials', () => {
    const message = `fatal: could not read from '${CUSTOM_TEMPLATE}'`;

    const redacted = redactErrorMessage(message, [CREDENTIALED_TEMPLATE]);

    expect(redacted).not.toContain('acme-corp');
    expect(redacted).toBe(`fatal: could not read from '[redacted]'`);
  });

  it('does not leak the repo path when the message contains the credentialed URL itself', () => {
    const message = `The command 'git clone ${CREDENTIALED_TEMPLATE} /tmp/x' exited with a non-zero status (128)`;

    const redacted = redactErrorMessage(message, [CREDENTIALED_TEMPLATE]);

    expect(redacted).not.toContain('acme-corp');
    expect(redacted).not.toContain('ghp_token123');
    expect(redacted).toContain(`git clone [redacted]`);
  });

  it('redacts an invalid --region value', () => {
    const region = 'my-private-hostname';
    const message = `Invalid --region "${region}". Expected one of: eu, us.`;

    const redacted = redactErrorMessage(message, [region]);

    expect(redacted).toBe('Invalid --region "[redacted]". Expected one of: eu, us.');
  });

  it('redacts the --org value and the enumerated org list', () => {
    const message = 'No organization matched --org "Acme Inc". Available: Acme Inc (org_123), Beta LLC (org_456).';

    const redacted = redactErrorMessage(message, ['Acme Inc']);

    expect(redacted).not.toContain('Acme Inc');
    expect(redacted).not.toContain('Beta LLC');
    expect(redacted).toBe('No organization matched --org "[redacted]". Available: [redacted].');
  });

  it('leaves messages without sensitive values untouched', () => {
    const message = 'Dependency install failed.\nYou can retry manually: cd my-app && npm install';

    expect(redactErrorMessage(message, [undefined, undefined])).toBe(message);
  });
});

describe('redactError', () => {
  it('returns a new Error with the redacted message', () => {
    const raw = new Error(`Failed to clone repository: git clone ${CUSTOM_TEMPLATE} failed`);

    const redacted = redactError(raw, [CUSTOM_TEMPLATE]);

    expect(redacted).toBeInstanceOf(Error);
    expect(redacted).not.toBe(raw);
    expect(redacted.message).toBe('Failed to clone repository: git clone [redacted] failed');
    expect(raw.message).toContain(CUSTOM_TEMPLATE);
  });

  it('stringifies non-Error values before redacting', () => {
    expect(redactError(`clone of ${CUSTOM_TEMPLATE} failed`, [CUSTOM_TEMPLATE]).message).toBe(
      'clone of [redacted] failed',
    );
  });
});
