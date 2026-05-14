## 15. Verification, Invariants, and Deferred Scope

This section is the claim-checking surface for the v1 spec. It does not add new
runtime APIs beyond the records and methods already specified; it ties each
durability promise to the storage row, recovery path, and test shape that must
exist before implementation is accepted.

Maintenance rule: §15 owns verification and implementation acceptance, not the
canonical definition of the mechanics it tests. Every §15.1 invariant and §15.2
test-plan entry must test the owning section's contract and stay aligned when
that owner changes; it must not introduce a parallel API, storage record,
recovery rule, event semantic, route behavior, runtime guarantee, or migration
guarantee. If a verification row needs a new rule, add that rule to the
canonical owner before relying on it here. §15.3 remains the canonical record
for the explicit v1 deferrals it lists.

Orientation diagram (verification loop only; invariant tables below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-verification-title hx-verification-desc" viewBox="0 0 1080 470" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-verification-title">Verification claim-checking loop</title>
    <desc id="hx-verification-desc">Each failure invariant is tied to an authoritative record, recovery path, storage/API contract, and focused test shape before implementation is accepted.</desc>
    <defs>
      <marker id="ah-verification" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="60" y="175" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="155" y="205" text-anchor="middle">Spec promise</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="228" text-anchor="middle">failure invariant</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="315" y="175" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="410" y="205" text-anchor="middle">Authoritative row</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="410" y="228" text-anchor="middle">storage boundary</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="570" y="175" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="665" y="205" text-anchor="middle">Recovery path</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="665" y="228" text-anchor="middle">claim / hydrate / replay</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="825" y="175" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="205" text-anchor="middle">Focused tests</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="228" text-anchor="middle">acceptance proof</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="315" y="325" width="190" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="410" y="353" text-anchor="middle">Deferred scope</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="410" y="375" text-anchor="middle">explicitly not v1</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="570" y="325" width="190" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="665" y="353" text-anchor="middle">Cross-reference</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="665" y="375" text-anchor="middle">owning section/code</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-verification);" d="M250 211 L314 211" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-verification);" d="M505 211 L569 211" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-verification);" d="M760 211 L824 211" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-verification);" d="M920 247 C875 300 765 340 761 358" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-verification);" d="M570 358 L506 358" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-verification);" d="M410 325 C365 285 290 245 251 222" />
  </svg>
  <figcaption>Verification ties every durability claim to the row that proves it, the recovery path that repairs it, and the focused test that would fail if the contract regresses.</figcaption>
</figure>
