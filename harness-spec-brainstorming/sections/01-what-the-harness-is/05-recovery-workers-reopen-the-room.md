### 1.5 Recovery: workers reopen the room

After a crash, inbound recovery workers claim durable rows from the logbook, re-enter the harness, and rehydrate the session — they never bypass the front desk:

<figure>
<svg role="img" aria-labelledby="hx-recovery-title hx-recovery-desc" viewBox="0 0 900 340" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-recovery-title">Recovery: workers reopen the room</title>
  <desc id="hx-recovery-desc">Inbound recovery workers claim inbox/action and wakeup rows from the logbook, re-enter the Harness, and rehydrate the Session. Outbox dispatch recovery follows the outbound path.</desc>
  <defs>
    <marker id="ah-recovery" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(15,70)">
    <rect width="200" height="200" rx="12" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
    <text x="10" y="-10" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="bold" fill="#f97316" style="text-transform: uppercase; letter-spacing: 0.05em;">Logbook</text>
  </g>

  <g transform="translate(35,105)">
    <rect width="160" height="60" rx="8" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Inbox / action</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">action row</text>
  </g>
  <g transform="translate(35,195)">
    <rect width="160" height="60" rx="8" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Wakeup</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">row</text>
  </g>

  <g transform="translate(290,150)">
    <rect width="160" height="80" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="80" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Recovery workers</text>
    <text x="80" y="54" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">claim &amp; renew</text>
  </g>

  <g transform="translate(550,150)">
    <rect width="140" height="80" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="70" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Harness</text>
    <text x="70" y="54" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">Front desk</text>
  </g>

  <g transform="translate(730,150)">
    <rect width="140" height="80" rx="8" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="70" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Session</text>
    <text x="70" y="54" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">rehydrated</text>
  </g>

  <path d="M 195 135 C 240 135, 270 180, 290 180" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#ah-recovery)"/>
  <path d="M 195 225 C 240 225, 270 200, 290 200" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#ah-recovery)"/>
  <text x="242" y="158" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">claim</text>

  <path d="M 450 190 L 550 190" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#ah-recovery)"/>
  <text x="500" y="180" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">re-enter</text>

  <path d="M 690 190 L 730 190" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-recovery)"/>
  <text x="710" y="180" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">rehydrate</text>

  <text x="450" y="328" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">1.5 — Recovery: workers reopen the room</text>
</svg>
<figcaption>After a crash, recovery workers claim durable rows and re-enter the harness so sessions rehydrate through normal admission; §5 owns recovery and §15 owns the verification rules.</figcaption>
</figure>

Outbox recovery follows the outbound dispatch path in §1.4 at a diagram level;
§14.4 owns the dispatch/outbox contract, and §5/§15 own the durable recovery
and verification rules behind it.

End-to-end flow, as an orientation map:

1. An app, channel provider, or schedule/proactive source reaches a
   Harness-owned ingress path.
2. Restart-sensitive work crosses the durable boundary owned by its source:
   session operation, channel, wakeup, or outbox (§3, §5, §14).
3. Live handlers and workers re-enter Harness to resolve or hydrate the target
   Session before mutating conversation state.
4. The Session admits the operation through the primitive selected by §3/§4.
5. The Session assembles memory, request context, workspace state, model/tools,
   and agent/workflow runtime.
6. The runtime produces state changes, pending responses, messages, or
   provider-visible output through the owning event/storage/channel surfaces.
7. On restart, recovery reads the durable owner rows and follows the contracts
   in §5, §13, §14, and §15.

For the easily confused `message(...)` and `queue(...)` paths, §3 is the
canonical behavioral owner. This overview only shows that both paths enter
through Harness and are admitted by the target Session.

Reading matrix for the diagrams:

| Block | Reader rule |
| --- | --- |
| Storage logbook | §5 owns shared persistence and cross-source crash-recovery boundaries; source-specific mechanics stay with their owning sections. |
| Durable record families | §5 owns shared record shapes and serialization rules; §14 owns channel row/claim/dispatch mechanics. |
| Memory/context | Memory is advisory agent context; §5 and §6 own persistence and request-context details. |
| Replayable context | §5 owns what can be replayed or recovered from durable state. |
| Workers | §13.6 owns readiness and server lifecycle; §5.7 owns cross-source recovery; §14.4 owns channel outbox claim/dispatch mechanics (§14.1 owns binding lifecycle, §14.5 owns action receipts); §15 verifies these promises. |
| Channel dispatch | §14.1 owns binding, §14.4 owns outbox and provider-delivery, §14.5 owns action receipts. |
| Request context | §6 and §13 own local and wire request-context semantics. |

---
