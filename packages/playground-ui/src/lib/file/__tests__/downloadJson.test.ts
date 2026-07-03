// @vitest-environment jsdom

import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { downloadJson } from '../downloadJson';

// jsdom's Blob exposes no `.text()`, and the global `Response` doesn't recognize it.
// Read it the way the rest of this package does — via FileReader.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadJson', () => {
  it('serializes data to a pretty-printed application/json blob and triggers a download', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const data = { traceId: 'abc', spans: [{ spanId: 's1', input: { prompt: 'hi' } }] };
    downloadJson('trace-abc.json', data);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const firstCall = createObjectURL.mock.calls[0];
    assert(firstCall, 'Expected createObjectURL call');
    const [blob] = firstCall as [Blob];
    expect(blob.type).toBe('application/json');
    await expect(readBlobText(blob)).resolves.toBe(JSON.stringify(data, null, 2));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('sets the download filename and removes the anchor afterwards', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let downloadAttr: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadAttr = this.download;
    });

    downloadJson('trace-xyz.json', {});

    expect(downloadAttr).toBe('trace-xyz.json');
    // Anchor is appended only for the click, then removed — none should linger in the DOM.
    expect(document.querySelector('a')).toBeNull();
  });
});
