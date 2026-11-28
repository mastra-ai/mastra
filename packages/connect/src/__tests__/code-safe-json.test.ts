import { describe, expect, it } from 'vitest';

import { codeSafeJson } from '../../scripts/generate-provider.js';

describe('codeSafeJson', () => {
  it('leaves ordinary identifier lists unchanged so generated schemas stay the same', () => {
    expect(codeSafeJson(['project_id', 'issue_iid'])).toBe('["project_id","issue_iid"]');
  });

  it('embeds a value that would break out of generated source as the same data', () => {
    const value = ['</script><script>alert(1)</script>', 'a/b', 'line\u2028sep', 'para\u2029sep', 'ok'];
    const embedded = codeSafeJson(value);

    expect(embedded).not.toContain('<');
    expect(embedded).not.toContain('>');
    expect(embedded).not.toContain('/');
    expect(embedded).not.toContain('\u2028');
    expect(embedded).not.toContain('\u2029');
    expect(JSON.parse(embedded)).toEqual(value);
  });
});
