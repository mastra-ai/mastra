import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import type {
  CaseSummary,
  DemoPersona,
  DemoSession,
  MetricsSummary,
  ReviewQueueItem,
  SubmitInformationRequest,
  UploadDocumentResult,
} from '../../src/contracts/http/public-api.js';
import { useCaseEvents } from './api/case-events.js';
import { ApiClientError, KycApiClient } from './api/client.js';

const defaultClient = new KycApiClient();
const terminalStatuses = new Set(['ACTIVE', 'REJECTED', 'PROVISIONING_FAILED']);

type Notice = Readonly<{ message: string; correlationId?: string }>;

const safeNotice = (error: unknown): Notice =>
  error instanceof ApiClientError
    ? { message: error.message, correlationId: error.correlationId }
    : { message: 'The action could not be completed. Please retry.' };

const statusLabel = (status: string): string => status.toLowerCase().replaceAll('_', ' ');
const formString = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

type InformationResponseOption = SubmitInformationRequest['responseOption'];

const correctionItems = new Set([
  'FULL_NAME',
  'DATE_OF_BIRTH',
  'DOCUMENT_NUMBER',
  'EXPIRATION_DATE',
  'RESIDENTIAL_ADDRESS',
]);

const responseOptionLabels: Record<InformationResponseOption, string> = {
  CORRECTED_APPLICATION: 'Corrected application',
  IDENTITY_DOCUMENT: 'Identity document',
  IDENTITY_DOCUMENT_BACK: 'Identity document back',
  PROOF_OF_ADDRESS: 'Proof of address',
  READABLE_DOCUMENT: 'Readable replacement',
};

const responseOptionsFor = (requestedItems: readonly string[]): InformationResponseOption[] => {
  const requested = new Set(requestedItems);
  const options: InformationResponseOption[] = [];
  if (requestedItems.some(item => correctionItems.has(item))) options.push('CORRECTED_APPLICATION');
  if (requested.has('IDENTITY_DOCUMENT')) options.push('IDENTITY_DOCUMENT');
  if (requested.has('IDENTITY_DOCUMENT_BACK')) options.push('IDENTITY_DOCUMENT_BACK');
  if (requested.has('PROOF_OF_ADDRESS')) options.push('PROOF_OF_ADDRESS');
  if (requested.has('DOCUMENT_READABILITY') || requested.has('READABLE_DOCUMENT')) {
    options.push('READABLE_DOCUMENT');
  }
  return options;
};

const PersonaPicker = ({ busy, onSelect }: Readonly<{ busy: boolean; onSelect: (persona: DemoPersona) => void }>) => (
  <section className="auth-card" aria-labelledby="session-heading">
    <p className="eyebrow">Local companion demo</p>
    <h1 id="session-heading">Choose a guided journey</h1>
    <p className="lede">
      Start as an applicant, reviewer, or senior reviewer. These personas are local demonstration roles, not production
      authentication.
    </p>
    <div className="persona-grid">
      {(['applicant', 'reviewer', 'senior-reviewer'] as const).map(persona => (
        <button disabled={busy} key={persona} onClick={() => onSelect(persona)} type="button">
          {persona === 'applicant'
            ? 'Applicant journey'
            : persona === 'reviewer'
              ? 'Reviewer workspace'
              : 'Senior review workspace'}
        </button>
      ))}
    </div>
  </section>
);

const Timeline = ({ client, caseId }: Readonly<{ client: KycApiClient; caseId: string }>) => {
  const feed = useCaseEvents(client, caseId);
  return (
    <section className="card" aria-labelledby="timeline-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Persisted audit view</p>
          <h2 id="timeline-heading">Case timeline</h2>
        </div>
        <span className={`feed-state feed-state--${feed.mode}`} role="status">
          {feed.mode === 'live'
            ? 'Live updates'
            : feed.mode === 'polling'
              ? 'Polling every 2 seconds'
              : feed.mode === 'closed'
                ? 'Timeline complete'
                : 'Connecting'}
        </span>
      </div>
      {feed.error === null ? null : <p className="inline-error">{feed.error}</p>}
      {feed.events.length === 0 ? (
        <p className="empty">Events will appear here after the case is created.</p>
      ) : (
        <ol className="timeline">
          {feed.events.map(event => (
            <li key={event.eventId}>
              <span className="timeline__marker" aria-hidden="true" />
              <div>
                <strong>{statusLabel(event.status)}</strong>
                <p>{statusLabel(event.reasonCode)}</p>
                <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const ApplicantWorkspace = ({ client }: Readonly<{ client: KycApiClient }>) => {
  const [caseId, setCaseId] = useState<string>();
  const [summary, setSummary] = useState<CaseSummary>();
  const [uploads, setUploads] = useState<UploadDocumentResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  useEffect(() => {
    const match = /^#\/cases\/([A-Za-z0-9_-]+)$/u.exec(window.location.hash);
    if (match?.[1] !== undefined) setCaseId(match[1]);
  }, []);

  useEffect(() => {
    if (caseId === undefined) return;
    let active = true;
    const refresh = async () => {
      try {
        const current = await client.getCase(caseId);
        if (active) setSummary(current);
      } catch (error) {
        if (active) setNotice(safeNotice(error));
      }
    };
    void refresh();
    if (terminalStatuses.has(summary?.status ?? ''))
      return () => {
        active = false;
      };
    const timer = setInterval(() => void refresh(), 2_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [caseId, client, summary?.status]);

  const createCase = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const created = await client.createCase({
        application: {
          fullName: formString(data, 'fullName'),
          dateOfBirth: formString(data, 'dateOfBirth'),
          nationality: formString(data, 'nationality').toUpperCase(),
          email: formString(data, 'email'),
          phone: formString(data, 'phone'),
          residentialAddress: {
            line1: formString(data, 'line1'),
            city: formString(data, 'city'),
            region: formString(data, 'region'),
            postalCode: formString(data, 'postalCode'),
            country: formString(data, 'country').toUpperCase(),
          },
        },
      });
      window.location.hash = `/cases/${created.caseId}`;
      setCaseId(created.caseId);
      setSummary(await client.getCase(created.caseId));
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  const uploadDocument = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (caseId === undefined) return;
    setBusy(true);
    setNotice(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setNotice({ message: 'Choose a PDF, JPEG, or PNG document.' });
      setBusy(false);
      return;
    }
    try {
      const uploaded = await client.uploadDocument(
        caseId,
        {
          file,
          documentType: formString(data, 'documentType'),
          side: formString(data, 'side'),
        },
        `upload:${caseId}:${String((summary?.documentReadiness.storedDocumentCount ?? 0) + 1)}`,
      );
      setUploads(current => [...current, uploaded]);
      setSummary(await client.getCase(caseId));
      form.reset();
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (caseId === undefined) return;
    setBusy(true);
    setNotice(undefined);
    try {
      setSummary(await client.startCase(caseId));
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  const submitInformation = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (caseId === undefined || summary?.pendingAction?.type !== 'MISSING_INFORMATION') return;
    const latestDocument = uploads.at(-1);
    if (latestDocument === undefined) {
      setNotice({ message: 'Upload the requested document before submitting information.' });
      return;
    }
    setBusy(true);
    setNotice(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const responseOption = formString(data, 'responseOption') as InformationResponseOption;
      const requested = new Set(summary.pendingAction.requestedItems);
      const applicationCorrections =
        responseOption === 'CORRECTED_APPLICATION'
          ? {
              ...(requested.has('FULL_NAME') ? { fullName: formString(data, 'fullName') } : {}),
              ...(requested.has('DATE_OF_BIRTH') ? { dateOfBirth: formString(data, 'dateOfBirth') } : {}),
              ...(requested.has('DOCUMENT_NUMBER') ? { documentNumber: formString(data, 'documentNumber') } : {}),
              ...(requested.has('EXPIRATION_DATE') ? { expirationDate: formString(data, 'expirationDate') } : {}),
              ...(requested.has('RESIDENTIAL_ADDRESS')
                ? {
                    residentialAddress: {
                      line1: formString(data, 'correctionLine1'),
                      city: formString(data, 'correctionCity'),
                      region: formString(data, 'correctionRegion'),
                      postalCode: formString(data, 'correctionPostalCode'),
                      country: formString(data, 'correctionCountry').toUpperCase(),
                    },
                  }
                : {}),
            }
          : undefined;
      setSummary(
        await client.submitInformation(caseId, {
          requestId: summary.pendingAction.requestId,
          responseOption,
          ...(applicationCorrections === undefined ? {} : { applicationCorrections }),
          documentIds: [latestDocument.documentId],
        }),
      );
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  if (caseId === undefined) {
    return (
      <section className="card" aria-labelledby="application-heading">
        <p className="eyebrow">Step 1</p>
        <h2 id="application-heading">Tell us about the applicant</h2>
        <form className="form-grid" onSubmit={createCase}>
          <label className="field field--wide">
            <span>Full legal name</span>
            <input autoComplete="name" name="fullName" required />
          </label>
          <label className="field">
            <span>Date of birth</span>
            <input name="dateOfBirth" required type="date" />
          </label>
          <label className="field">
            <span>Nationality</span>
            <input defaultValue="US" maxLength={2} name="nationality" required />
          </label>
          <label className="field">
            <span>Email</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input autoComplete="tel" name="phone" required type="tel" />
          </label>
          <fieldset className="address-fields">
            <legend>Residential address</legend>
            <label className="field field--wide">
              <span>Address line</span>
              <input autoComplete="street-address" name="line1" required />
            </label>
            <label className="field">
              <span>City</span>
              <input autoComplete="address-level2" name="city" required />
            </label>
            <label className="field">
              <span>State or region</span>
              <input autoComplete="address-level1" name="region" required />
            </label>
            <label className="field">
              <span>Postal code</span>
              <input autoComplete="postal-code" name="postalCode" required />
            </label>
            <label className="field">
              <span>Country</span>
              <input autoComplete="country" defaultValue="US" maxLength={2} name="country" required />
            </label>
          </fieldset>
          <button className="primary field--wide" disabled={busy} type="submit">
            {busy ? 'Creating case…' : 'Create secure case'}
          </button>
        </form>
      </section>
    );
  }

  const isFinal = terminalStatuses.has(summary?.status ?? '');
  const requestedItems =
    summary?.pendingAction?.type === 'MISSING_INFORMATION' ? summary.pendingAction.requestedItems : [];
  const requestedItemSet = new Set(requestedItems);
  const informationResponseOptions = responseOptionsFor(requestedItems);
  return (
    <div className="workspace-grid">
      <div className="workspace-stack">
        <section className="card case-header" aria-labelledby="case-heading">
          <div>
            <p className="eyebrow">Applicant case</p>
            <h2 id="case-heading">Identity verification</h2>
            <p className="opaque-id">Case {caseId}</p>
          </div>
          <span className={`status-pill status-pill--${summary?.status.toLowerCase() ?? 'loading'}`}>
            {summary === undefined ? 'Loading' : statusLabel(summary.status)}
          </span>
        </section>
        {isFinal ? (
          <section className="card outcome" aria-live="polite">
            <p className="eyebrow">Journey outcome</p>
            <h2>{summary === undefined ? 'Complete' : statusLabel(summary.status)}</h2>
            <p>The workflow has reached a durable terminal state.</p>
          </section>
        ) : null}
        {!isFinal && summary?.pendingAction?.type === 'MISSING_INFORMATION' ? (
          <section className="card" aria-labelledby="missing-heading">
            <p className="eyebrow">Action required</p>
            <h2 id="missing-heading">Additional information needed</h2>
            <p>{summary.pendingAction.safeMessage}</p>
            <ul>
              {summary.pendingAction.requestedItems.map(item => (
                <li key={item}>{statusLabel(item)}</li>
              ))}
            </ul>
            <form className="compact-form" onSubmit={submitInformation}>
              <label className="field">
                <span>Response type</span>
                <select defaultValue={informationResponseOptions[0]} name="responseOption">
                  {informationResponseOptions.map(option => (
                    <option key={option} value={option}>
                      {responseOptionLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              {requestedItemSet.has('FULL_NAME') ? (
                <label className="field field--wide">
                  <span>Corrected full name</span>
                  <input name="fullName" required />
                </label>
              ) : null}
              {requestedItemSet.has('DATE_OF_BIRTH') ? (
                <label className="field">
                  <span>Corrected date of birth</span>
                  <input name="dateOfBirth" required type="date" />
                </label>
              ) : null}
              {requestedItemSet.has('DOCUMENT_NUMBER') ? (
                <label className="field">
                  <span>Corrected document number</span>
                  <input name="documentNumber" required />
                </label>
              ) : null}
              {requestedItemSet.has('EXPIRATION_DATE') ? (
                <label className="field">
                  <span>Corrected expiration date</span>
                  <input name="expirationDate" required type="date" />
                </label>
              ) : null}
              {requestedItemSet.has('RESIDENTIAL_ADDRESS') ? (
                <>
                  <label className="field field--wide">
                    <span>Corrected address line</span>
                    <input name="correctionLine1" required />
                  </label>
                  <label className="field">
                    <span>Corrected city</span>
                    <input name="correctionCity" required />
                  </label>
                  <label className="field">
                    <span>Corrected state or region</span>
                    <input name="correctionRegion" required />
                  </label>
                  <label className="field">
                    <span>Corrected postal code</span>
                    <input name="correctionPostalCode" required />
                  </label>
                  <label className="field">
                    <span>Corrected country code</span>
                    <input maxLength={2} name="correctionCountry" required />
                  </label>
                </>
              ) : null}
              <button className="primary" disabled={busy || uploads.length === 0} type="submit">
                Submit latest upload
              </button>
            </form>
          </section>
        ) : null}
        {!isFinal ? (
          <section className="card" aria-labelledby="documents-heading">
            <p className="eyebrow">Documents</p>
            <h2 id="documents-heading">Add verification files</h2>
            <form className="compact-form" onSubmit={uploadDocument}>
              <label className="field">
                <span>Document type</span>
                <select name="documentType">
                  <option value="PASSPORT">Passport</option>
                  <option value="NATIONAL_ID">National ID</option>
                  <option value="DRIVER_LICENSE">Driver license</option>
                  <option value="PROOF_OF_ADDRESS">Proof of address</option>
                </select>
              </label>
              <label className="field">
                <span>Side</span>
                <select name="side">
                  <option value="SINGLE">Single file</option>
                  <option value="FRONT">Front</option>
                  <option value="BACK">Back</option>
                </select>
              </label>
              <label className="field field--wide">
                <span>PDF, JPEG, or PNG</span>
                <input accept="application/pdf,image/jpeg,image/png" name="file" required type="file" />
              </label>
              <button disabled={busy} type="submit">
                {busy ? 'Working…' : 'Upload document'}
              </button>
            </form>
            {(summary?.documentReadiness.storedDocumentCount ?? 0) === 0 ? (
              <p className="empty">No documents stored for this case.</p>
            ) : (
              <p className="success-note" role="status">
                {summary?.documentReadiness.storedDocumentCount} document
                {summary?.documentReadiness.storedDocumentCount === 1 ? '' : 's'} validated and stored.
              </p>
            )}
            <button
              className="primary"
              disabled={busy || summary?.documentReadiness.canStart !== true}
              onClick={start}
              type="button"
            >
              Start verification
            </button>
          </section>
        ) : null}
      </div>
      <Timeline caseId={caseId} client={client} />
      {notice === undefined ? null : <ErrorNotice notice={notice} />}
    </div>
  );
};

const MetricsStrip = ({ metrics }: Readonly<{ metrics: MetricsSummary | undefined }>) => (
  <section className="metrics" aria-label="Redacted case metrics">
    <div>
      <span>Observed cases</span>
      <strong>{metrics?.sampleCount ?? '—'}</strong>
    </div>
    <div>
      <span>Active</span>
      <strong>{metrics?.finalStatusCounts.active ?? '—'}</strong>
    </div>
    <div>
      <span>Rejected</span>
      <strong>{metrics?.finalStatusCounts.rejected ?? '—'}</strong>
    </div>
    <div>
      <span>Projection lag</span>
      <strong>{metrics?.projectionLag.pendingEvents ?? '—'}</strong>
    </div>
  </section>
);

const ReviewerWorkspace = ({
  client,
  persona,
}: Readonly<{ client: KycApiClient; persona: 'reviewer' | 'senior-reviewer' }>) => {
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [selected, setSelected] = useState<ReviewQueueItem>();
  const [outcome, setOutcome] = useState<CaseSummary>();
  const [metrics, setMetrics] = useState<MetricsSummary>();
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<Notice>();

  const refresh = async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      const [queue, summary] = await Promise.all([client.listReviews(), client.getMetrics()]);
      setReviews([...queue.reviews]);
      setMetrics(summary);
      const match = /^#\/reviews\/([A-Za-z0-9_-]+)$/u.exec(window.location.hash);
      if (match?.[1] !== undefined) setSelected(await client.getReview(match[1]));
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [client, persona]);

  const openReview = async (reviewId: string) => {
    setBusy(true);
    setNotice(undefined);
    try {
      const detail = await client.getReview(reviewId);
      window.location.hash = `/reviews/${reviewId}`;
      setSelected(detail);
      setOutcome(undefined);
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected === undefined) return;
    setBusy(true);
    setNotice(undefined);
    const data = new FormData(event.currentTarget);
    const decision = formString(data, 'decision') as 'APPROVE' | 'REJECT' | 'ESCALATE';
    const capability = selected.allowedDecisions.find(item => item.decision === decision);
    if (capability === undefined) {
      setNotice({ message: 'That decision is not authorized for this review.' });
      setBusy(false);
      return;
    }
    const safeNote = formString(data, 'safeNote').trim();
    const feedbackRating = (name: string): boolean | null => {
      const value = formString(data, name);
      return value === 'useful' ? true : value === 'incorrect' ? false : null;
    };
    try {
      const result = await client.decideReview(selected.reviewId, {
        decision,
        reasonCode: capability.reasonCode,
        ...(safeNote === '' ? {} : { safeNote }),
        feedback: {
          extractionUseful: feedbackRating('extractionUseful'),
          screeningUseful: feedbackRating('screeningUseful'),
          riskUseful: feedbackRating('riskUseful'),
          evidenceUseful: feedbackRating('evidenceUseful'),
          falsePositiveEscalation: feedbackRating('falsePositiveEscalation'),
          curatedForDataset: data.get('curatedForDataset') === 'on',
        },
      });
      setOutcome(result);
      setReviews(current => current.filter(review => review.reviewId !== selected.reviewId));
      setMetrics(await client.getMetrics());
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="review-layout">
      <div className="review-main">
        <section className="card section-heading" aria-labelledby="queue-heading">
          <div>
            <p className="eyebrow">Local demo review</p>
            <h2 id="queue-heading">
              {persona === 'senior-reviewer' ? 'Senior review queue' : 'Compliance review queue'}
            </h2>
          </div>
          <button disabled={busy} onClick={() => void refresh()} type="button">
            Refresh
          </button>
        </section>
        <MetricsStrip metrics={metrics} />
        <section className="card" aria-label="Pending reviews">
          {busy && reviews.length === 0 ? (
            <p role="status">Loading pending reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="empty">No authorized reviews are waiting.</p>
          ) : (
            <ul className="review-list">
              {reviews.map(review => (
                <li key={review.reviewId}>
                  <button onClick={() => void openReview(review.reviewId)} type="button">
                    <span>
                      <strong>{review.level === 'SENIOR' ? 'Senior review' : 'Initial review'}</strong>
                      <small>Case {review.caseId}</small>
                    </span>
                    <span className={`risk risk--${review.riskLevel.toLowerCase()}`}>{review.riskLevel} risk</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <aside className="card review-detail" aria-labelledby="review-detail-heading">
        {selected === undefined ? (
          <div>
            <p className="eyebrow">Redacted detail</p>
            <h2 id="review-detail-heading">Select a review</h2>
            <p className="empty">Only policy reasons and risk routing appear in this workspace.</p>
          </div>
        ) : outcome !== undefined ? (
          <div aria-live="polite">
            <p className="eyebrow">Decision recorded</p>
            <h2 id="review-detail-heading">
              {outcome.pendingAction?.type === 'COMPLIANCE_REVIEW' && outcome.pendingAction.level === 'SENIOR'
                ? 'senior review required'
                : statusLabel(outcome.status)}
            </h2>
            <p>
              {outcome.pendingAction?.type === 'COMPLIANCE_REVIEW' && outcome.pendingAction.level === 'SENIOR'
                ? 'A senior reviewer must complete the next decision.'
                : 'The durable workflow has accepted this decision.'}
            </p>
          </div>
        ) : (
          <div>
            <p className="eyebrow">{selected.level} authority</p>
            <h2 id="review-detail-heading">Review policy outcome</h2>
            <dl className="review-facts">
              <div>
                <dt>Risk</dt>
                <dd>{selected.riskLevel}</dd>
              </div>
              <div>
                <dt>Route</dt>
                <dd>{statusLabel(selected.riskRoute)}</dd>
              </div>
            </dl>
            <ul className="reason-list">
              {selected.reasonCodes.map(reason => (
                <li key={reason}>{statusLabel(reason)}</li>
              ))}
            </ul>
            <form className="decision-form" onSubmit={decide}>
              <fieldset>
                <legend>Decision</legend>
                {selected.allowedDecisions.map(capability => (
                  <label key={capability.decision}>
                    <input name="decision" required type="radio" value={capability.decision} />
                    {statusLabel(capability.decision)}
                  </label>
                ))}
              </fieldset>
              <label className="field">
                <span>Safe note (optional, no personal data)</span>
                <textarea maxLength={500} name="safeNote" rows={3} />
              </label>
              <fieldset className="feedback-grid">
                <legend>Structured reviewer feedback</legend>
                {[
                  ['extractionUseful', 'Extraction'],
                  ['screeningUseful', 'Screening'],
                  ['riskUseful', 'Risk'],
                  ['evidenceUseful', 'Evidence'],
                ].map(([name, label]) => (
                  <label className="field" key={name}>
                    <span>{label}</span>
                    <select defaultValue="unanswered" name={name}>
                      <option value="unanswered">Not answered</option>
                      <option value="useful">Useful</option>
                      <option value="incorrect">Incorrect</option>
                    </select>
                  </label>
                ))}
                <label className="field">
                  <span>False-positive escalation</span>
                  <select defaultValue="unanswered" name="falsePositiveEscalation">
                    <option value="unanswered">Not answered</option>
                    <option value="useful">Yes</option>
                    <option value="incorrect">No</option>
                  </select>
                </label>
                <label>
                  <input name="curatedForDataset" type="checkbox" /> Curate these structured labels for future datasets
                </label>
              </fieldset>
              <button className="primary" disabled={busy} type="submit">
                {busy ? 'Recording…' : 'Record decision'}
              </button>
            </form>
          </div>
        )}
      </aside>
      {notice === undefined ? null : <ErrorNotice notice={notice} />}
    </div>
  );
};

const ErrorNotice = ({ notice }: Readonly<{ notice: Notice }>) => (
  <div className="error-notice" role="alert">
    <strong>{notice.message}</strong>
    {notice.correlationId === undefined ? null : <small>Reference {notice.correlationId}</small>}
  </div>
);

export const App = ({ client = defaultClient }: Readonly<{ client?: KycApiClient }>) => {
  const [session, setSession] = useState<DemoSession>();
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<Notice>();

  useEffect(() => {
    let active = true;
    client
      .currentSession()
      .then(current => {
        if (active) setSession(current);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  const choosePersona = async (persona: DemoPersona) => {
    setChecking(true);
    setNotice(undefined);
    try {
      setSession(await client.createSession(persona));
      window.location.hash = '';
    } catch (error) {
      setNotice(safeNotice(error));
    } finally {
      setChecking(false);
    }
  };

  const logout = async () => {
    setChecking(true);
    try {
      await client.logout();
    } catch {
      /* A process restart already invalidates this demo session. */
    } finally {
      window.location.hash = '';
      setSession(undefined);
      setChecking(false);
    }
  };

  const workspace = useMemo(() => {
    if (session?.persona === 'applicant') return <ApplicantWorkspace client={client} />;
    if (session?.persona === 'reviewer' || session?.persona === 'senior-reviewer')
      return <ReviewerWorkspace client={client} persona={session.persona} />;
    return null;
  }, [client, session]);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Mastra KYC home">
          <span className="brand__mark" aria-hidden="true">
            M
          </span>
          <span>Mastra KYC</span>
        </a>
        {session === undefined ? null : (
          <div className="session-controls">
            <span>{statusLabel(session.persona)} demo</span>
            <button onClick={logout} type="button">
              Switch persona
            </button>
          </div>
        )}
      </header>
      {checking && session === undefined ? (
        <p className="loading" role="status">
          Checking local session…
        </p>
      ) : session === undefined ? (
        <PersonaPicker busy={checking} onSelect={persona => void choosePersona(persona)} />
      ) : (
        workspace
      )}
      {notice === undefined ? null : <ErrorNotice notice={notice} />}
      <aside className="notice" aria-label="Demonstration notice">
        Synthetic local demonstration only. This is not production authentication, a certified compliance product, or
        legal advice.
      </aside>
    </main>
  );
};
