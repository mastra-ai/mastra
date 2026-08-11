---
'@mastra/memory': patch
---

Remove the `image-size` dependency from `@mastra/memory` and measure image dimensions with the already-present `probe-image-size` instead.

Every published version of `image-size` carries unfixed denial-of-service advisories (GHSA-w3rx-r6r6-pgpr / CVE-2025-71330 and GHSA-5p2g-fcmc-qvqq): a malformed image could hang its parse loop and exhaust the heap. The repository is archived, so no fixed release is coming, and the previous pin to `1.2.1` moved between two equally affected releases rather than remediating the flaw. Because image bytes reaching agent memory are untrusted, a crafted 32-byte image was enough to crash the process.

Dimension detection still covers the formats models accept (PNG, JPEG, WebP, GIF, AVIF, BMP, ICO, PSD, SVG, TIFF). Unrecognized formats now report unknown dimensions, which token counting already handled.
