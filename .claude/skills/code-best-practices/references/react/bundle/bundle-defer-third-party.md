---
title: Defer Non-Critical Third-Party Libraries
impact: CRITICAL
impactDescription: loads after hydration
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**Correct (loads after hydration):**

```tsx
import { lazy, Suspense } from 'react';

const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
```
