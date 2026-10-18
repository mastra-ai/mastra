# Runbooks

A runbook is the organization’s reviewed procedure for investigating and responding to a known class of security incident. It is policy input to the workflow, not text generated for an incident.

## Customizing the reference policies

Keep the frontmatter, nine section headings and action IDs valid when editing a runbook. Changes to a reviewed procedure need a new version and reindexing; they do not change an existing incident's recorded procedure.

The current policy registry also checks specific English phrases in the evidence and severity sections. Even an equivalent paraphrase can fail that check. Review `requiredPhrases`, `severityPhrases`, evidence requirements and claim requirements in `src/triage/policy-registry.ts` together with those sections. Adding a provider also requires registering its trusted evidence origin there.

`npm run runbooks:validate` checks document structure. After a policy edit, also run `npm test` and `npm run eval:check -- --output /tmp/security-policy-check` with a fresh output directory. A structurally valid document alone does not prove it agrees with the executable policy.

## When runbooks are written

Core runbooks are written **before** an incident. Security engineering, SOC leadership, identity or infrastructure owners, legal/compliance stakeholders, and service owners agree on:

- the conditions under which the procedure applies;
- evidence that must be available before a conclusion;
- severity and escalation rules;
- actions responders may and may not take;
- who can approve containment;
- validation, recovery, communication, and audit obligations.

Teams exercise these procedures through tabletop exercises and controlled provider environments. After an incident, the review feeds lessons learned back into a new runbook version. The post-incident update does not rewrite the historical procedure used by an existing incident.

NIST SP 800-61 Revision 3 places incident response across preparation, detection, response, recovery, and lessons learned within CSF 2.0. CISA’s incident response playbook provides an additional operational reference. Use them as governance baselines, then adapt the procedure to your organization, systems, contractual duties, and regulatory requirements:

- [NIST SP 800-61 Revision 3](https://www.nist.gov/publications/incident-response-recommendations-and-considerations-cybersecurity-risk-management-csf)
- [CISA Cybersecurity Incident and Vulnerability Response Playbooks](https://www.cisa.gov/sites/default/files/publications/Cybersecurity_Incident_Vulnerability_Response_Playbooks_508C_0.pdf)

## Project layout

The project intentionally separates governed content from implementation code:

```text
runbooks/                    # versioned procedures owned by the security team
src/mastra/knowledge/        # validation, indexing, retrieval, and integrity code
```

The root `runbooks/` directory is content. Its Markdown files can be reviewed by security stakeholders in pull requests without navigating application internals.

`src/mastra/knowledge/` is the retrieval engine. It parses frontmatter, enforces the document structure, creates deterministic chunks and hashes, generates embeddings, stores indexed generations, retrieves relevant sections, verifies readback integrity, and records the exact citations selected for each incident.

These directories have different ownership and release concerns, so they should not share the same name or be merged.

## Required document structure

Each procedure has versioned frontmatter with an ID, semantic version, supported incident kinds, owner, activation status, and mandatory rules. The body uses nine ordered sections:

1. Purpose and Preconditions
2. Signals and Known False Positives
3. Required and Optional Evidence
4. Severity Rules
5. Investigation
6. Allowed and Prohibited Actions
7. Approval Requirements
8. Post-Containment Validation
9. Rollback and Escalation

This is a strong operational structure because it covers applicability, uncertainty, evidence quality, decision rules, bounded actions, authority, validation, and recovery. There is no single universal Markdown schema for incident runbooks, however. Before using the supplied procedures in a company, add the organization-specific owners, service-level objectives, communication tree, legal/privacy obligations, evidence-retention requirements, business continuity dependencies, and external notification thresholds.

The three included identity procedures are therefore implementation-ready reference policies, not a claim of universal compliance.

## Why embeddings and a vector store are involved

An incident description and a runbook rarely use identical wording. Embeddings represent their semantic meaning, allowing retrieval to find the most relevant sections even when vocabulary differs. The vector store holds those section vectors and returns ranked candidates.

That semantic search does **not** decide policy and does not grant authority. The implementation narrows retrieval by incident kind and active version, checks metadata and content hashes, applies a score threshold, validates allowed actions deterministically, and persists the selected citations. If the index, active generation, or integrity checks are unavailable, retrieval fails closed.

The result combines useful RAG behavior with controls expected from a security system:

```text
incident context
      │
      ├─ exact incident-kind and active-version filters
      ▼
semantic section retrieval
      │
      ├─ score, metadata, hash, and action-allowlist checks
      ▼
persisted citations available to agents and auditors
```

## Publishing workflow

A practical release process is:

1. A security owner authors or updates a procedure in a branch and increments its semantic version.
2. Service owners and an independent security reviewer approve the policy and action boundaries.
3. CI runs `npm run runbooks:validate` and the security evaluation suite.
4. The release job runs `npm run runbooks:index`, which creates immutable chunks and vectors, verifies readback, and activates the generation with compare-and-set protection.
5. Operators inspect active generations with `npm run runbooks:inspect` and observe retrieval quality before wider rollout.
6. If the new generation is unsuitable, an authorized operator rolls back to an eligible prior generation. Old, inactive generations are removed only through bounded cleanup after retention requirements are satisfied.

In a hosted deployment, indexing and activation should run as a controlled release job rather than on every application start. Preserve the source revision, approvals, evaluation result, generation ID, activation revision, and rollback record in the audit system.
