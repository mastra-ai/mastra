# Contributing

This template lives in the Mastra monorepo at `templates/template-customer-refund-agent`. Start from a fork and open pull requests against [mastra-ai/mastra](https://github.com/mastra-ai/mastra), following the [authoritative Mastra contribution guide](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md). Link the issue that tracks the change.

Do not open a pull request while its linked issue has the `status: needs triage` or `status: needs approval` label. Address automated review feedback from CodeRabbit or Mastra Platform and any maintainer review comments, then keep the pull request focused on the linked issue. Accepted changes are synced from the monorepo to the standalone template repository. Submit contributions to the monorepo; pull requests to the generated standalone repository are not reviewed. A Mastra maintainer performs the final merge.

Before requesting review, run `npm run verify:pre-push`. It builds a clean, allowlisted temporary snapshot, excludes `.env` files and local data, installs from the lockfile, and runs the local preflight suite. If Chromium is not already installed for Playwright, run `npx playwright install chromium`; on Linux systems that need browser libraries, run `npx playwright install --with-deps chromium`.
