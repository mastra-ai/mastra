# Add a synthetic scenario

Bundled scenarios exercise the real workflow through deterministic provider fixtures. A scenario contains a synthetic application, generated document bytes, expected extraction and provider signals; evaluation ground truth remains scorer-side and cannot influence runtime decisions.

To add one:

1. extend the scenario ID union and fixture in `src/fixtures/provider-scenarios.ts`;
2. expose it through the Studio start-tool schema only when it is safe for public use;
3. add the expected completeness, screening, risk and workflow trajectory to the eval dataset;
4. cover replay, suspend/resume and PII canaries;
5. add a small input example without real personal data.

Useful existing paths include low risk, missing fields, unreadable document, identity mismatch, address inconclusive, sanctions strong candidate and PEP candidate. Keep names and documents obviously synthetic and use reserved domains such as `.invalid`.
