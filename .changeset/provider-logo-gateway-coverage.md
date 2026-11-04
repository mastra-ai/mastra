---
'@mastra/playground-ui': patch
---

`ProviderLogo` now shows a real brand mark or a neutral monogram for every vendor in the Gateway model catalog. Vendors without a logo no longer render the generic models.dev placeholder.

- Added colored bundled marks for Tencent, ByteDance (including `bytedance-seed`), Sakana, Microsoft, Amazon (Nova), Cohere, Perplexity, Fireworks, StepFun, Meituan (LongCat), Upstage, Morph, and a Nous Research mark.
- Only models.dev logos verified to be real are requested. Any other provider shows a monogram sized by the same icon tokens.

```tsx
<ProviderLogo providerId="tencent" size="md" />
<ProviderLogo providerId="aion-labs" size="md" />
```
