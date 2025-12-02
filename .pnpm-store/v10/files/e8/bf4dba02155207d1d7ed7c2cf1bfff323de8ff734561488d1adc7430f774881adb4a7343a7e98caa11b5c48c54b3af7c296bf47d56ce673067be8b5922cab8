# Apply Release Plan

[![npm package](https://img.shields.io/npm/v/@changesets/apply-release-plan)](https://npmjs.com/package/@changesets/apply-release-plan)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

This takes a `releasePlan` object for changesets and applies the expected changes from that
release. This includes updating package versions, and updating changelogs.

```ts
import applyReleasePlan from "@changesets/apply-release-plan";
import { ReleasePlan, Config } from "@changesets/types";
import { Packages } from '@manypkg/get-packages'

await applyReleasePlan(
    // The release plan to be applied - see @changesets/types for information about its shape
    aReleasePlan: ReleasePlan,
    // The packages that applyReleasePlan should be run for from @manypkg/get-packages
    packages: Packages,
    // A valid @changesets/config config - see @changesets/types for information about its shape
    config: Config
);
```

Note that `apply-release-plan` does not validate the release plan's accuracy.

To generate a release plan from written changesets use `@changesets/get-release-plan`
