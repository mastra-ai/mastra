Use @styleguides/STYLEGUIDE.md first. @styleguides/ also includes guides for docs and reference docs

When working check src/content/docs/ and src/content/reference/ update existing docs or create new docs
@CONTRIBUTING.md for setup, local development, and components / frontmatter

main documentation src/content/docs/
step by step guides src/content/guides/
API reference docs src/content/reference/
model provider docs src/content/models/ auto-generated
tutorial content src/course/

Follow @styleguides/STYLEGUIDE.md for all docs. Use these when they apply:

src/content/docs/ - @styleguides/DOC.md
src/content/guides/ - choose the matching guide styleguide:
@docs/styleguides/GUIDE_QUICKSTART.md - quickstarts for a fast working result with a specific library or framework
@docs/styleguides/GUIDE_TUTORIAL.md - tutorials for building something specific with Mastra with deeper concepts
@docs/styleguides/GUIDE_INTEGRATION.md - integration guides for a specific external library or ecosystem
@docs/styleguides/GUIDE_DEPLOYMENT.md - deployment guides for a specific platform
src/content/reference/ - @styleguides/REFERENCE.md

E2E testing
pnpm build # Build site
pnpm test:e2e # Playwright tests desktop + tablet + mobile
pnpm test:smoke # Smoke tests only desktop
pnpm test:og # OG image meta tag tests only desktop
pnpm test:navigation # Navigation tests desktop + tablet + mobile

Tests live in tests/ helpers in tests/helpers/ and playwright.config.ts starts pnpm serve
