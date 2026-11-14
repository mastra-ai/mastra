import type { BolaAssessment } from './api';
import { Status, Time } from './ui';

const outcomes: Record<string, { title: string; description: string }> = {
  CONFIRMED: {
    title: 'Unauthorized access confirmed',
    description: 'The alternate account received the same private response as the owner in this comparison.',
  },
  NOT_REPRODUCED: {
    title: 'Unauthorized access not reproduced',
    description: 'The alternate account received a protected response. This comparison did not create a finding.',
  },
  INCONCLUSIVE: {
    title: 'No conclusive result',
    description: 'The available evidence and review did not establish a confirmed finding.',
  },
};
const lifecycleTitles: Record<string, string> = {
  DISCOVERING: 'Discovering API routes',
  PLANNING: 'Selecting a comparison',
  VERIFYING: 'Verifying account access',
  CANCEL_REQUESTED: 'Cancellation requested',
  CANCELLED: 'Assessment cancelled',
  BLOCKED: 'Assessment blocked',
};
const labels: Record<string, string> = {
  single_object: 'Single object',
  two_accounts: 'Two accounts',
  bounded_get_only: 'Bounded GET requests only',
  collection_detail: 'Collection → detail',
  detail_receipt: 'Detail → receipt',
  OBSERVED_OWNER_DETAIL: 'Owner-only detail observed',
  OBSERVED_DETAIL_RECEIPT: 'Receipt linked from an observed detail',
  alternate_account_reads_owner_object: 'An alternate account can read an owner-only object.',
};
const booleanLabel = (value: boolean | null | undefined) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Unknown';
};

/** Present the persisted conclusion separately from its proof, scope and model metadata. */
export function AssessmentDetail({ assessment }: { assessment: BolaAssessment }) {
  const { proof, selection } = assessment;
  const result = assessment.outcome ? outcomes[assessment.outcome] : undefined;
  const expired = assessment.evidenceAvailability === 'expired';
  const unavailable = expired ? 'Expired' : 'Not available';

  return (
    <div className="assessment-detail">
      <section className="assessment-result" aria-label="Assessment result" data-outcome={assessment.outcome}>
        <div className="assessment-result-heading">
          <div>
            <p className="eyebrow">REST authorization assessment</p>
            <h3>{result?.title ?? lifecycleTitles[assessment.state] ?? 'Assessment result'}</h3>
          </div>
          <Status value={assessment.outcome ?? assessment.state} />
        </div>
        {expired ? (
          <p>The comparison evidence has expired and is no longer available.</p>
        ) : result ? (
          <p>{result.description}</p>
        ) : (
          <p>No final comparison result is available yet.</p>
        )}
        <div className="assessment-route">
          <span className="muted">Selected route</span>
          {assessment.selected ? <code>GET {assessment.selected.routeTemplate}</code> : <span>{unavailable}</span>}
        </div>
      </section>

      <section className="assessment-panel" aria-label="Account comparison">
        <h3>Account comparison</h3>
        <p className="hint">Expected: an alternate account cannot read an owner-only resource.</p>
        <dl className="assessment-accounts">
          <div>
            <dt>Owner account</dt>
            <dd>{proof?.ownerStatus == null ? 'Unknown' : `HTTP ${proof.ownerStatus}`}</dd>
          </div>
          <div data-outcome={assessment.outcome}>
            <dt>Alternate account</dt>
            <dd>{proof?.alternateStatus == null ? 'Unknown' : `HTTP ${proof.alternateStatus}`}</dd>
          </div>
        </dl>
        <dl className="assessment-facts">
          <div>
            <dt>Same private response</dt>
            <dd>{booleanLabel(proof?.bodyMatches)}</dd>
          </div>
          <div>
            <dt>Proof complete</dt>
            <dd>{booleanLabel(proof?.completed)}</dd>
          </div>
          <div>
            <dt>Gateway requests</dt>
            <dd>{proof?.requestCount ?? 'Unknown'}</dd>
          </div>
        </dl>
        <p className="hint assessment-note">
          An incomplete comparison is inconclusive. A protected response does not create a finding.
        </p>
      </section>

      <div className="assessment-columns">
        <section className="assessment-panel" aria-label="Evidence and cleanup">
          <h3>Evidence & cleanup</h3>
          <dl className="assessment-properties">
            <div>
              <dt>Evidence</dt>
              <dd className="assessment-capitalize">{assessment.evidenceAvailability ?? 'Unknown'}</dd>
            </div>
            {assessment.evidenceAvailability === 'available' && assessment.expiresAt && (
              <div>
                <dt>Available until</dt>
                <dd>
                  <Time value={assessment.expiresAt} />
                </dd>
              </div>
            )}
            <div>
              <dt>Verifier cleanup</dt>
              <dd>
                <Status value={assessment.verificationCleanup ?? 'Unknown'} />
              </dd>
            </div>
          </dl>
        </section>
        <section className="assessment-panel" aria-label="Test scope">
          <h3>Test scope</h3>
          <dl className="assessment-properties">
            <div>
              <dt>Checker</dt>
              <dd className="mono">{assessment.selected ? 'bola_rest_read' : unavailable}</dd>
            </div>
          </dl>
          {selection?.limitations.length ? (
            <ul className="assessment-limits" aria-label="Limitations">
              {selection.limitations.map((limit, index) => (
                <li key={`${limit}-${index}`}>{labels[limit] ?? limit}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">Scope details: {unavailable.toLowerCase()}.</p>
          )}
        </section>
      </div>

      {assessment.findingId && (
        <div className="assessment-finding">
          <strong>Finding recorded</strong>
          <span className="mono">{assessment.findingId}</span>
        </div>
      )}

      <details className="assessment-disclosure">
        <summary>Analysis & model details</summary>
        <div className="assessment-disclosure-body">
          <dl className="assessment-properties">
            <div>
              <dt>Sherlock hypothesis</dt>
              <dd>{selection ? (labels[selection.hypothesis] ?? selection.hypothesis) : unavailable}</dd>
            </div>
            <div>
              <dt>Selection rationale</dt>
              <dd>{selection ? (labels[selection.rationaleCode] ?? selection.rationaleCode) : unavailable}</dd>
            </div>
            <div>
              <dt>Hypothesis confidence</dt>
              <dd className="assessment-capitalize">{selection?.confidence ?? unavailable}</dd>
            </div>
            <div>
              <dt>Result reason</dt>
              <dd className="mono">{assessment.reason ?? 'Not available'}</dd>
            </div>
            <div>
              <dt>Reserved model tokens</dt>
              <dd>{assessment.usedTokens.toLocaleString()}</dd>
            </div>
          </dl>
          <h4>Model roles</h4>
          {assessment.modelEvents.length ? (
            <dl className="assessment-models">
              {assessment.modelEvents.map((event, index) => (
                <div key={`${event.role}-${index}`}>
                  <dt className="assessment-capitalize">{event.role}</dt>
                  <dd className="mono">{event.modelId}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="hint">No model activity recorded.</p>
          )}
        </div>
      </details>

      <details className="assessment-disclosure">
        <summary>Observed candidates ({assessment.candidates.length})</summary>
        <div className="assessment-disclosure-body">
          {assessment.candidates.length ? (
            <>
              <p className="hint">
                Each candidate is a separate observation. Routes may repeat across objects or accounts.
              </p>
              <ol className="assessment-candidates">
                {assessment.candidates.map(candidate => (
                  <li key={candidate.id}>
                    <div>
                      <code>{candidate.routeTemplate}</code>
                      <span className="hint">{labels[candidate.prerequisite] ?? candidate.prerequisite}</span>
                    </div>
                    {candidate.id === assessment.selected?.id && <span className="status">Selected</span>}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="hint">Candidate observations: {unavailable.toLowerCase()}.</p>
          )}
        </div>
      </details>
    </div>
  );
}
