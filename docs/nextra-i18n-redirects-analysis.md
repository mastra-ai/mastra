# Nextra i18n and Redirects Analysis Report

## Current Configuration Analysis

### Next.js i18n Configuration (`next.config.mjs:27-30`)

```javascript
i18n: {
  locales: ["en", "ja"],
  defaultLocale: "en",
}
```

### Nextra Theme i18n Configuration (`nextra-layout.tsx:57-60`)

```javascript
i18n={[
  { locale: "en", name: "English" },
  { locale: "ja", name: "日本語" },
]}
```

### Middleware Configuration (`middleware.ts:1-6`)

```javascript
export { middleware } from "nextra/locales";
export const config = {
  matcher: ["/(docs|examples|showcase|guides|reference)/:path*"],
};
```

## How Nextra i18n Works

Based on the Nextra documentation and codebase analysis:

1. **Locale Detection**: Nextra uses Next.js built-in i18n routing with automatic locale detection
2. **URL Structure**: Routes follow the pattern `/[locale]/path` (e.g., `/en/docs/...`, `/ja/docs/...`)
3. **Middleware**: `nextra/locales` middleware handles locale routing and redirection
4. **Content Structure**: Separate content directories for each locale (`/content/en/`, `/content/ja/`)
5. **Theme Integration**: Nextra theme provides language switcher dropdown

## Current Redirect Setup

The redirect configuration contains **768 redirect rules** with various patterns:

- Simple path redirects (e.g., `/docs/old-path` → `/docs/new-path`)
- Some locale-aware redirects using `:locale` parameter (lines 130-133, 195-197, etc.)
- Most redirects are **NOT locale-aware**

## Key Issues Identified

### 1. **Inconsistent Locale Handling in Redirects**

- Only a few redirects (5-10 out of 768) use the `:locale` parameter
- Most redirects assume English-only paths
- This creates broken redirect behavior for Japanese users

### 2. **Redirect vs. Middleware Conflict**

Next.js processes redirects **before** middleware, which means:

- Custom redirects execute before Nextra's locale middleware
- Non-locale-aware redirects may interfere with proper locale detection
- Users on `/ja/docs/old-path` may be redirected to `/docs/new-path` instead of `/ja/docs/new-path`

### 3. **Missing Locale Context in Rewrites**

Current rewrites handle some locale patterns but may not cover all edge cases:

```javascript
source: "/:locale/docs/_next/:path+",
destination: "/_next/:path+",
```

## Recommendations

### 1. **Standardize Locale-Aware Redirects**

Update all redirects to include locale parameter:

```javascript
// Instead of:
{
  source: "/docs/old-path",
  destination: "/docs/new-path",
  permanent: true,
}

// Use:
{
  source: "/:locale/docs/old-path",
  destination: "/:locale/docs/new-path",
  permanent: true,
}
```

### 2. **Add Fallback Redirects for Non-Locale URLs**

Add redirects that handle non-localized URLs by redirecting to default locale:

```javascript
{
  source: "/docs/:path*",
  destination: "/en/docs/:path*",
  permanent: false,
}
```

### 3. **Review Middleware Matcher**

Consider expanding the middleware matcher to handle edge cases:

```javascript
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/(docs|examples|showcase|guides|reference)/:path*",
  ],
};
```

### 4. **Implement Systematic Redirect Migration**

Create a script to automatically convert existing redirects to locale-aware format:

1. Identify redirects that need locale awareness
2. Generate locale-aware versions
3. Add fallback redirects for backward compatibility
4. Test with both locales

### 5. **Add Redirect Testing**

Implement automated tests to verify:

- All redirects work correctly for both `en` and `ja` locales
- No redirect loops exist
- Proper fallback behavior for non-localized URLs

### 6. **Monitor and Log Redirect Behavior**

Add logging to track redirect behavior and identify issues:

- Which redirects are being triggered most frequently
- Whether locale detection is working properly
- Any 404s that could be handled by redirects

## Priority Implementation Order

1. **High Priority**: Fix the most commonly used redirects to be locale-aware
2. **Medium Priority**: Add fallback redirects for backward compatibility
3. **Low Priority**: Migrate remaining redirects systematically
4. **Ongoing**: Monitor and test redirect behavior

## Technical Details

### Current File Structure

```
docs/
├── src/
│   ├── content/
│   │   ├── en/          # English content
│   │   └── ja/          # Japanese content
│   ├── middleware.ts    # Nextra locale middleware
│   └── components/
│       └── nextra-layout.tsx  # Theme config with i18n
└── next.config.mjs      # Next.js config with redirects
```

### Key Configuration Points

- **Next.js i18n**: Handles automatic locale detection and routing
- **Nextra middleware**: Processes locale-specific routing
- **Theme i18n**: Provides language switcher UI
- **Content structure**: Separate directories for each locale

This systematic approach will resolve the locale redirect conflicts while maintaining backward compatibility and improving the user experience for both English and Japanese users.
