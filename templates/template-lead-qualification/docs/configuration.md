# Qualification configuration

Edit `src/mastra/config/qualification.ts` to change the ideal customer profile (ICP). Each accepted lead captures the current configuration; edits apply to new assessments, including explicit requalification.

## Criteria and scoring

| Rule           | Default                                                                                | Points |
| -------------- | -------------------------------------------------------------------------------------- | ------ |
| Business model | B2B SaaS, including hosted APIs for business customers                                 | 30     |
| Employees      | 20–500, inclusive                                                                      | 25     |
| Headquarters   | Brazil, United States, EU, United Kingdom, Iceland, Liechtenstein, Norway, Switzerland | 15     |
| Buying intent  | Demo, sales contact, or purchase inquiry within 90 days                                | 30     |

Points must total 100. They explain fit, rather than set a qualification threshold. A confirmed firmographic mismatch disqualifies the lead even when other rules earn points. Supported fit with an old inquiry becomes Nurture. Missing or conflicting decisive facts require review.

For a different business model, update `policy.rules.businessModel.categories` and `accepted` together. Each category needs factual criteria; absence of evidence isn't a negative category. Change the country list, employee bounds, or intent window in the corresponding rule, then bump `policy.version`.

Employee intervals earn points only when the whole interval fits. Supported estimates are labeled inferred and count by default. Set `policy.rules.employeeCount.estimates` to `review` to keep them advisory.

## Review and research

- `routing`: move an outcome from `automaticOutcomes` to `reviewOutcomes` to require approval. The lists must cover every outcome without overlap; `needs_review` always requires review.
- `src/mastra/config/review.ts`: change review expiry, which defaults to seven days.
- `sources`: select evidence provider IDs, allow additional source domains, authorize trusted API/CRM references, and set evidence freshness (30 days by default).
- `prompts`: adapt extraction and verification instructions together and update their version. Verification establishes factual support; deterministic rules decide qualification.
- `research.targeted`: change the ordered targets and search instructions. The default prioritizes business model, workforce, headquarters, then a workforce follow-up. Submitted inquiries supply intent; public intent search isn't in the default plan.
- `research`: bound searches (4), page requests (4), aggregate output tokens (12,000), and processing time (180 seconds). Retries share these limits.

Select input and output in [provider configuration](crm-adapters.md). To change queue capacity, concurrency, body size, or polling, edit `src/mastra/config/lead-ingestion.ts`. Retention settings are applied through explicit [maintenance](operations.md#maintenance), not a background schedule.
