import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import { open, rename, unlink, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { hashBytes, type OutputProvider } from '../domain/contracts.js';
import { draftOutputRequestSchema } from '../domain/output-contracts.js';
import { reportSnapshotSchema, type ReportSnapshot } from '../domain/reports.js';
import { reportLabels, termValue } from '../domain/report-presentation.js';
import { projectRoot } from '../runtime/paths.js';
import { IntakeError } from '../domain/errors.js';

export async function renderDraftPdf(report: ReportSnapshot): Promise<Buffer> {
  const r = reportSnapshotSchema.parse(report);
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 47,
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: 'Policy Checking Report',
      Author: 'Policy Checking',
      Subject: `Draft report ${r.id}, version ${r.version}`,
      Keywords: 'Insurance, policy checking, draft, pending broker review',
      CreationDate: new Date(r.createdAt),
    },
  });
  doc.registerFont('Regular', join(projectRoot(), 'assets/fonts/NotoSans-Regular.ttf'));
  doc.registerFont('Bold', join(projectRoot(), 'assets/fonts/NotoSans-Bold.ttf'));
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  let y = 0;
  let repeated = '';
  let repeatTable: (() => void) | null = null;
  const width = 518;
  const fitLine = (value: string, size: number, maxWidth: number) => {
    doc.font('Bold').fontSize(size);
    let fitted = value;
    while (doc.widthOfString(fitted) > maxWidth) fitted = fitted.slice(0, -2) + '…';
    return fitted;
  };
  const bottom = 708;
  const draw = (text: string, x: number, top: number, size = 9.5, bold = false, color = '#172B4D') =>
    doc
      .font(bold ? 'Bold' : 'Regular')
      .fontSize(size)
      .fillColor(color)
      .text(text, x, top, { lineBreak: false });
  const page = () => {
    doc.addPage();
    draw('POLICY CHECKING REPORT', 47, 25, 9, true);
    let runningPolicy = r.identity.policyNumber ?? 'Policy number not available';
    doc.font('Regular').fontSize(8.5);
    while (doc.widthOfString(runningPolicy) > 210) runningPolicy = runningPolicy.slice(0, -2) + '…';
    draw(runningPolicy, 350, 25, 8.5, false, '#64748B');
    doc.moveTo(47, 44).lineTo(565, 44).strokeColor('#CBD5E1').stroke();
    draw('Draft — pending broker review', 47, 55, 9, true, '#2563EB');
    y = 86;
    if (repeated) {
      draw(fitLine(repeated, 9, 450) + ' (continued)', 47, y, 9, true);
      y += 23;
    }
    if (repeatTable) repeatTable();
  };
  const ensure = (height: number) => {
    if (y + height > bottom) page();
  };
  const wrap = (text: string, size: number, bold: boolean, maxWidth = width) => {
    doc.font(bold ? 'Bold' : 'Regular').fontSize(size);
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        let rest = word;
        if (line && doc.widthOfString(line + ' ' + rest) > maxWidth) {
          lines.push(line);
          line = '';
        }
        while (doc.widthOfString(rest) > maxWidth) {
          let cut = 1;
          while (cut < rest.length && doc.widthOfString(rest.slice(0, cut + 1)) <= maxWidth) cut++;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line += (line ? ' ' : '') + rest;
      }
      lines.push(line);
    }
    return lines;
  };
  const text = (value: string, size = 9.5, bold = false, color = '#172B4D') => {
    for (const line of wrap(value, size, bold)) {
      ensure(size * 1.55);
      draw(line, 47, y, size, bold, color);
      y += size * 1.55;
    }
    y += 5;
  };
  const section = (title: string, firstBlockHeight = 65) => {
    repeated = '';
    ensure(39 + firstBlockHeight);
    y += 12;
    draw(title, 47, y, 13, true);
    y += 27;
    doc
      .moveTo(47, y - 6)
      .lineTo(565, y - 6)
      .strokeColor('#CBD5E1')
      .stroke();
  };
  const field = (label: string, value: string | null | undefined) => text(`${label}: ${value || 'Not available'}`);
  const findingName = (id: string) =>
    `Finding ${String(r.comparisons.findIndex(f => f.id === id) + 1).padStart(3, '0')}`;
  const sourceName = (id: string) =>
    `Source document ${String(r.sources.findIndex(s => s.sourceId === id) + 1).padStart(3, '0')}`;
  const evidence = (e: ReportSnapshot['comparisons'][number]['evidence'][number]) => {
    const parent = repeated;
    const locator = `${sourceName(e.sourceId)} • ${e.physicalPage !== null ? 'Physical page ' + e.physicalPage : 'Record ' + e.recordId + ', field ' + e.field} • Version ${e.version}`;
    ensure(58);
    text(locator, 8.5, true, '#64748B');
    repeated = (parent ? (parent.match(/^Finding \d+/)?.[0] ?? parent) + ' • ' : '') + locator;
    text('“' + e.excerpt + '”', 9.5);
    repeated = parent;
  };
  const accent = (f: ReportSnapshot['comparisons'][number]) =>
    f.classification === 'AUTHORIZED_CHANGE'
      ? '#15803D'
      : f.severity?.level === 'High'
        ? '#B91C1C'
        : f.severity?.level === 'Medium'
          ? '#A16207'
          : '#64748B';
  const summaryRows = (findings: ReportSnapshot['comparisons'], heading: string) => {
    if (!findings.length) {
      text('No items are recorded in this section.');
      return;
    }
    const columns = [
      { x: 47, width: 115, label: 'Finding / references' },
      { x: 162, width: 137, label: 'Expected terms' },
      { x: 299, width: 137, label: 'Issued / target terms' },
      { x: 436, width: 129, label: 'Assessment' },
    ];
    repeated = '';
    ensure(65);
    repeated = heading;
    repeatTable = () => {
      doc.rect(47, y, 518, 25).fill('#E2E8F0');
      columns.forEach(c => draw(c.label, c.x + 5, y + 7, 8, true));
      y += 30;
    };
    repeatTable();
    for (const f of findings) {
      const refs = [
        ...new Set(
          f.evidence.map(
            e =>
              `${sourceName(e.sourceId)}, ${e.physicalPage !== null ? 'page ' + e.physicalPage : 'record ' + e.recordId + ', field ' + e.field}`,
          ),
        ),
      ].join('; ');
      const values = [
        findingName(f.id) +
          '\n' +
          (reportLabels.category[f.category as keyof typeof reportLabels.category] ?? 'Other comparison terms') +
          '\n' +
          f.label +
          '\n' +
          refs,
        termValue(f.baseline?.value),
        termValue(f.actual?.value),
        reportLabels.classification[f.classification] +
          (f.severity ? '\n' + f.severity.level + ' severity' : '') +
          '\nAwaiting broker review',
      ];
      const lines = values.map((v, i) => wrap(v, 8.5, false, columns[i]!.width - 10));
      let row = 0;
      const total = Math.max(...lines.map(l => l.length));
      while (row < total) {
        if (y + 29 > bottom) page();
        if (row) {
          const identity = wrap(findingName(f.id) + ' (continued)', 8.5, true, 105);
          const assessment = wrap(
            reportLabels.classification[f.classification] + (f.severity ? ' • ' + f.severity.level + ' severity' : ''),
            8.5,
            false,
            119,
          );
          const height = Math.max(identity.length, assessment.length) * 13 + 9;
          if (y + height + 29 > bottom) page();
          doc.rect(47, y, 518, height).fill('#F1F5F9');
          identity.forEach((line, i) => draw(line, 52, y + 4 + i * 13, 8.5, true));
          assessment.forEach((line, i) => draw(line, 441, y + 4 + i * 13, 8.5, false, accent(f)));
          y += height;
        }
        const count = Math.min(total - row, Math.floor((bottom - y - 12) / 13));
        doc.rect(47, y, 518, count * 13 + 10).fill(row ? '#F8FAFC' : '#FFFFFF');
        doc.rect(47, y, 2, count * 13 + 10).fill(accent(f));
        columns.forEach((column, i) => {
          for (let j = 0; j < count; j++) {
            const line = lines[i]![row + j];
            if (line !== undefined)
              draw(line, column.x + 5, y + 5 + j * 13, 8.5, false, i === 3 ? accent(f) : '#172B4D');
          }
        });
        y += count * 13 + 10;
        doc.moveTo(47, y).lineTo(565, y).strokeColor('#E2E8F0').stroke();
        row += count;
        if (row < total) page();
      }
      y += 5;
    }
    repeatTable = null;
    repeated = '';
  };
  page();
  section('A. Identification');
  text('Policy Checking Report', 23, true);
  text('Draft — pending broker review', 11, true, '#2563EB');
  for (const [label, value] of [
    ['Report identifier', r.id],
    ['Report version', String(r.version)],
    ['Insured', r.identity.insuredName],
    ['Policy number', r.identity.policyNumber],
    ['Insurance product', r.identity.insuranceProduct],
    ['Insurer', 'Not available'],
    ['Policy dates', 'Not available'],
    ['Generated at', r.createdAt],
    ['Case identifier', r.caseId],
    ['Workflow run', r.workflowRunId],
    ['Comparison intent', reportLabels.intent[r.intent]],
    ['Profile identifier', r.profile.id],
    ['Profile version', r.profile.version],
  ] as const)
    field(label, value);
  text(
    'This report records comparison observations. It is not a coverage guarantee or certification.',
    9.5,
    false,
    '#64748B',
  );
  section('B. Executive summary', 340);
  text(reportLabels.status[r.status], 13, true);
  ensure(70);
  const cards = [
    ['Checked', r.counts.checked],
    ['Matches', r.counts.matches],
    ['Discrepancies', r.counts.discrepancies],
    ['Authorized', r.counts.authorized],
    ['Unresolved', r.counts.unresolved],
  ] as const;
  const top = y;
  cards.forEach(([label, value], i) => {
    const x = 47 + i * 104;
    doc.roundedRect(x, top, 97, 59, 4).fill('#F1F5F9');
    draw(String(value), x + 9, top + 8, 17, true);
    draw(label, x + 9, top + 36, 8.5);
  });
  y += 75;
  if (!r.counts.checked)
    text('No comparable terms were evaluated. Missing evidence and limitations remain visible below.');
  text(
    'Checked terms were evaluated against the complete recorded comparison scope, including established omissions. Incomplete scope is not counted as checked or matching.',
  );
  text(
    r.counts.discrepancies || r.counts.unresolved
      ? 'Review discrepancies and unresolved evidence before deciding whether correction or clarification is appropriate.'
      : 'Review the stated scope and evidence before accepting this draft.',
  );
  field(
    'Highest recorded severity',
    r.comparisons.some(f => f.severity?.level === 'High')
      ? 'High'
      : r.comparisons.some(f => f.severity?.level === 'Medium')
        ? 'Medium'
        : r.comparisons.some(f => f.severity?.level === 'Low')
          ? 'Low'
          : 'Not available',
  );
  field(
    'Required comparison documents',
    r.sources.every(s => s.complete)
      ? 'Reference and target captured; see source scope and limitations.'
      : 'Some captured sources have incomplete processing.',
  );
  const outstanding = r.comparisons
    .filter(f => ['DISCREPANCY', 'MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(f.classification))
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Low: 2 })[a.severity?.level ?? 'Low'] -
        { High: 0, Medium: 1, Low: 2 }[b.severity?.level ?? 'Low'],
    );
  section('C. Discrepancy summary');
  summaryRows(outstanding, 'Discrepancy summary');
  section('D. Detailed findings');
  if (!outstanding.length)
    text('No discrepancies or unresolved findings are recorded. The verified scope is listed in section F.');
  for (const f of outstanding) {
    repeated = '';
    ensure(65);
    const title = findingName(f.id) + ' • ' + f.label;
    text(title, 12, true, accent(f));
    repeated = title;
    field(
      'Category',
      reportLabels.category[f.category as keyof typeof reportLabels.category] ?? 'Other comparison terms',
    );
    field('Assessment', reportLabels.classification[f.classification]);
    field('Severity', f.severity ? reportLabels.severity[f.severity.level] : 'Not available');
    field('Review status', 'Awaiting broker review');
    field('Expected terms', termValue(f.baseline?.value));
    field('Issued or target terms', termValue(f.actual?.value));
    field('Observation', f.observation);
    field('Significance', f.interpretation);
    field('Recommended action', f.action);
    if (f.severity) field('Severity explanation', f.severity.rationale);
    for (const e of f.evidence) evidence(e);
    if (f.searched.length)
      for (const s of f.searched)
        text(
          `Searched ${sourceName(s.sourceId)}: ${s.pages.length ? 'physical pages ' + s.pages.join(', ') : s.records.map(item => 'record ' + item.recordId + ', field ' + item.field).join('; ')}. ${s.complete ? 'Captured scope reviewed.' : 'Review was incomplete.'}`,
          8.5,
        );
    for (const u of f.uncertainty) field('Uncertainty', u);
    field('Reviewer comments', 'Not yet recorded');
    y += 10;
  }
  repeated = '';
  section('E. Authorized changes');
  const changes = r.comparisons.filter(f => f.classification === 'AUTHORIZED_CHANGE');
  summaryRows(changes, 'Authorized changes');
  for (const f of changes) {
    repeated = '';
    ensure(65);
    const title = findingName(f.id) + ' • ' + f.label;
    text(title, 10, true);
    repeated = title;
    for (const e of f.evidence) evidence(e);
    for (const change of f.appliedChanges) {
      ensure(65);
      field('Changed term', f.label);
      field('Original value', termValue(f.baseline?.value));
      field('Authorized value', termValue(change.value));
      field('Issued value', termValue(f.actual?.value));
      field('Approval statement', change.approvalStatement);
      field('Approver recorded in source', change.approver);
      field('Effective from', change.effectiveFrom);
      field('Effective until', change.effectiveTo);
      for (const e of change.evidence) evidence(e);
    }
  }
  repeated = '';
  section('F. Verified terms');
  summaryRows(
    r.comparisons.filter(f => f.classification === 'MATCH'),
    'Verified terms',
  );
  for (const f of r.comparisons.filter(f => f.classification === 'MATCH')) {
    repeated = '';
    ensure(65);
    const title = findingName(f.id) + ' • ' + f.label;
    text(title, 10, true);
    repeated = title;
    for (const e of f.evidence) evidence(e);
  }
  repeated = '';
  section('G. Missing evidence and limitations');
  if (!r.limitations.length && !r.rules.length && !r.comparisons.some(f => f.uncertainty.length))
    text('No additional limitations were recorded. The report remains limited to the captured comparison scope.');
  for (const limitation of r.limitations) text(limitation);
  for (const f of r.comparisons) for (const u of f.uncertainty) text(findingName(f.id) + ': ' + u);
  for (const rule of r.rules)
    text(`Profile ${rule.profileId}, version ${rule.version}, rule ${rule.ruleId}: ${rule.observation}`);
  if (r.intent === 'document_comparison')
    text(
      'Selected references do not establish contractual acceptance. Differences are document comparison observations.',
    );
  section('H. Sources', 250);
  for (const s of r.sources) {
    repeated = '';
    ensure(250);
    text(sourceName(s.sourceId) + ' • ' + s.displayName, 10, true);
    repeated = sourceName(s.sourceId);
    field('Source identifier', s.sourceId);
    field('Document role', reportLabels.role[s.role]);
    field('Source version', s.version);
    field('Captured at', s.capturedAt);
    field('Physical pages', s.pageCount === null ? 'Not applicable; captured records and fields' : String(s.pageCount));
    field('SHA-256 checksum', s.hash);
    field('Processing status', s.complete ? 'Captured scope reviewed' : 'Incomplete review');
    for (const l of s.limitations) field('Limitation', l);
    y += 8;
  }
  repeated = '';
  section('I. Broker review', 200);
  field('Review status', 'Awaiting broker review');
  field('Reviewer', 'Not yet recorded');
  field('Review time', 'Not yet recorded');
  field('Approved version', 'Not yet recorded');
  field('Finding disposition', 'Not yet recorded');
  text(
    'Approval must identify the exact report version. It accepts the reviewed report, not insurer terms or coverage certification. No final report or correction request has been issued.',
  );
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(47, 734).lineTo(565, 734).strokeColor('#CBD5E1').stroke();
    draw(`${r.id} • Version ${r.version} • ${r.createdAt.slice(0, 10)}`, 47, 743, 7.5, false, '#64748B');
    draw(`Page ${i + 1} of ${range.count}`, 490, 743, 7.5, false, '#64748B');
  }
  doc.end();
  return complete;
}
export function createDraftPdfProvider(): OutputProvider<'draftOutput'> {
  return {
    id: 'local-pdf-draft',
    category: 'draftOutput',
    capabilities: ['immutable-draft', 'local-file'],
    async materialize(input, context) {
      const request = draftOutputRequestSchema.parse(input);
      const report = reportSnapshotSchema.parse(request.snapshot);
      const bytes = await renderDraftPdf(report);
      const reference = request.operationId + '.pdf';
      const target = join(context.outputDirectory, reference);
      const temporary = target + '.' + randomUUID() + '.tmp';
      try {
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, target);
        const directory = await open(context.outputDirectory, 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
      const safe = (report.identity.policyNumber ?? report.caseId).replace(/[^A-Za-z0-9-]/g, '-').slice(0, 70);
      return {
        providerId: 'local-pdf-draft',
        stage: 'draftOutput',
        operationId: request.operationId,
        snapshotId: report.id,
        snapshotHash: request.snapshotHash,
        hash: hashBytes(bytes),
        mediaType: 'application/pdf',
        displayName: `policy-check-${safe}-v${report.version}-draft.pdf`,
        retrievalReference: reference,
      };
    },
    async retrieve(artifact, context) {
      const root = await realpath(context.outputDirectory);
      const path = resolve(root, artifact.retrievalReference);
      if (
        artifact.retrievalReference !== artifact.operationId + '.pdf' ||
        !path.startsWith(root + sep) ||
        (await realpath(path)) !== path
      )
        throw new IntakeError(
          'ARTIFACT_LOCATION',
          'The draft output location is invalid.',
          'Correct the local output provider.',
        );
      const file = await open(path, 'r');
      try {
        return await file.readFile();
      } finally {
        await file.close();
      }
    },
  };
}
