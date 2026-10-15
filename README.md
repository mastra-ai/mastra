# Factory onboarding account presets

Before: main at ee85f76d237fd695ed47babbe79a9664cc7e320e.
After: cb5afb601ad78603f12705443151827b2ae2dc89 for the setup, provider, sign-in and desktop review images; ac9290f479ce17b3c8deec3c063470c5cd57a065 for the mobile images.

Rendered from the production components in the Vite dev server against a throwaway local API mock, light theme, 1440 × 1000. Mobile: 390 × 844. The flows were driven end to end in a real browser: an API key saved for the company account, a provider sign-in for the personal account, and Factory creation for each setup.

The baseline has no Setup screen: before-access shows the mandatory visit to an optional personal connection step. The after-setup images show the three account choices; after-setup-member shows a member without company access, where only personal accounts can be chosen. Review images compare the same selected repository and models.

These images are PR review artifacts only. No preview harness, fake authentication code, or licensed illustration assets are included in the implementation branch.
