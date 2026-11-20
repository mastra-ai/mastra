import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readBackOfficeText } from '../../src/mastra/completion/office-text.ts';

describe('readBackOfficeText', () => {
  it('reads text split across runs, including a single XML entity decode', () => {
    const slice = '<w:t>Hello</w:t> <w:t> &amp; there</w:t>';

    assert.equal(readBackOfficeText(slice), 'Hello & there');
    assert.equal(readBackOfficeText('<w:t>&amp;lt;</w:t>'), '&lt;');
  });

  it('keeps the space a single pass leaves between three tags', () => {
    assert.equal(readBackOfficeText('</a> </b> <c>'), ' ');
  });

  it('does not reassemble a tag that was split by another tag', () => {
    const read = readBackOfficeText('<scr<script>ipt>Answer</scr<script>ipt>');

    assert.equal(read, 'ipt>Answeript>');
    assert.equal(read.includes('<'), false);
  });
});
