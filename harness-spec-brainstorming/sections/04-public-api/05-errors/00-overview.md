### 4.5 Errors

Orientation diagram (error families only; class definitions below remain
authoritative):

<figure>
<svg role="img" aria-labelledby="hx-errors-title hx-errors-desc" viewBox="0 0 900 300" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-errors-title">Harness error families</title>
  <desc id="hx-errors-desc">Harness errors group into admission, lifecycle, storage, security, recovery, and channel families. Wire-representable classes map into the wire error envelope.</desc>
  <defs>
    <marker id="ah-errors" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(35,110)">
    <rect width="135" height="70" rx="10" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="67.5" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Harness</text>
    <text x="67.5" y="49" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">errors</text>
  </g>

  <g transform="translate(245,30)">
    <rect width="130" height="52" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="65" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Admission</text>
  </g>
  <g transform="translate(245,100)">
    <rect width="130" height="52" rx="8" fill="#fff7ed" stroke="#f97316" stroke-width="1.5"/>
    <text x="65" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Lifecycle</text>
  </g>
  <g transform="translate(245,170)">
    <rect width="130" height="52" rx="8" fill="#fef2f2" stroke="#ef4444" stroke-width="1.5"/>
    <text x="65" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#7f1d1d" font-family="Inter, system-ui, sans-serif">Storage</text>
  </g>
  <g transform="translate(445,30)">
    <rect width="130" height="52" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="65" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Security</text>
  </g>
  <g transform="translate(445,100)">
    <rect width="130" height="52" rx="8" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="65" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Recovery</text>
  </g>
  <g transform="translate(445,170)">
    <rect width="130" height="52" rx="8" fill="#ecfeff" stroke="#06b6d4" stroke-width="1.5"/>
    <text x="65" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#164e63" font-family="Inter, system-ui, sans-serif">Channel</text>
  </g>

  <g transform="translate(715,110)">
    <rect width="145" height="70" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="72.5" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Wire envelope</text>
    <text x="72.5" y="49" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">code + details</text>
  </g>

  <path d="M 170 145 C 205 75, 220 56, 245 56" fill="none" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#ah-errors)"/>
  <path d="M 170 145 C 205 130, 220 126, 245 126" fill="none" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#ah-errors)"/>
  <path d="M 170 145 C 205 190, 220 196, 245 196" fill="none" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#ah-errors)"/>
  <path d="M 170 145 C 310 60, 390 56, 445 56" fill="none" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#ah-errors)"/>
  <path d="M 170 145 C 310 130, 390 126, 445 126" fill="none" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#ah-errors)"/>
  <path d="M 170 145 C 310 190, 390 196, 445 196" fill="none" stroke="#94a3b8" stroke-width="1.3" marker-end="url(#ah-errors)"/>
  <path d="M 575 126 L 715 145" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-errors)"/>
  <path d="M 375 126 L 715 145" fill="none" stroke="#94a3b8" stroke-width="1.1" stroke-dasharray="4 2" marker-end="url(#ah-errors)"/>

  <text x="450" y="280" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">4.5 — Error families</text>
</svg>
<figcaption>Harness error families and how wire-representable classes reach the wire envelope; §4.5 owns the typed class definitions and §13.3 owns the wire code and details mapping.</figcaption>
</figure>

§4.5 is the canonical owner of typed Harness error classes and shared error
detail fields. §13.3 owns wire error codes, public detail shapes,
status-family/default mapping guidance, server-layer generic codes, and SDK
rehydration rules; §13.2 owns route-specific emitted HTTP statuses and codes.
Every Harness-layer wire code and public `details` shape in §13.3 mirrors a
§4.5 typed class unless §13.3 explicitly marks that class local/operator-only
because no public auto-mounted route can emit it.
