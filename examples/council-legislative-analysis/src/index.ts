import { mastra } from './mastra';

const sampleLegislation = {
  title: 'The American Innovation and Digital Infrastructure Act of 2026',
  text: `
SECTION 1. SHORT TITLE.
This Act may be cited as the "American Innovation and Digital Infrastructure Act of 2026".

SECTION 2. FINDINGS.
Congress finds that—
(1) universal high-speed broadband access is essential for economic competitiveness;
(2) artificial intelligence presents both opportunities and risks requiring regulatory frameworks;
(3) the United States must maintain technological leadership while ensuring equitable access.

SECTION 3. NATIONAL BROADBAND EXPANSION.
(a) FUNDING.—The Secretary of Commerce shall allocate $50 billion over 5 years for broadband
infrastructure deployment in underserved rural and urban areas.
(b) REQUIREMENTS.—All funded projects must deliver minimum speeds of 100 Mbps download
and 20 Mbps upload.
(c) WORKFORCE.—Projects must use domestic labor and materials where available, with a
preference for hiring from local communities.

SECTION 4. ARTIFICIAL INTELLIGENCE GOVERNANCE FRAMEWORK.
(a) ESTABLISHMENT.—There is established within the Department of Commerce an Office of
AI Policy responsible for developing risk-based AI regulations.
(b) HIGH-RISK AI SYSTEMS.—AI systems used in healthcare diagnostics, criminal justice,
employment decisions, and financial lending shall be classified as high-risk and subject to:
  (1) mandatory bias audits conducted annually by independent third parties;
  (2) transparency requirements including disclosure of training data sources;
  (3) human oversight mandates for consequential decisions.
(c) EXEMPTIONS.—Open-source AI models with fewer than 10 billion parameters and AI systems
used solely for internal research are exempt from high-risk classification.

SECTION 5. DATA PRIVACY AND CYBERSECURITY.
(a) FEDERAL PRIVACY STANDARD.—This Act establishes a national data privacy standard
preempting state-level privacy laws.
(b) CONSUMER RIGHTS.—Individuals shall have the right to access, correct, delete, and port
their personal data held by covered entities.
(c) CYBERSECURITY REQUIREMENTS.—Critical infrastructure operators must implement
NIST-aligned cybersecurity frameworks within 2 years.
(d) PENALTIES.—Violations are subject to fines of up to $50,000 per incident or 4% of
annual global revenue, whichever is greater.

SECTION 6. RESEARCH AND DEVELOPMENT TAX INCENTIVES.
(a) ENHANCED R&D CREDIT.—The research and experimentation tax credit under section 41
of the Internal Revenue Code is increased from 20% to 30% for qualified AI and quantum
computing research.
(b) STARTUP PROVISIONS.—Small businesses with less than $5 million in gross receipts may
apply the credit against payroll taxes for up to 5 years.

SECTION 7. DIGITAL EQUITY AND INCLUSION.
(a) DIGITAL LITERACY.—$2 billion shall be appropriated for digital literacy programs
targeting seniors, veterans, and low-income communities.
(b) ACCESSIBLE TECHNOLOGY.—All federally funded technology projects must comply with
WCAG 2.2 AA accessibility standards.
(c) TRIBAL CONNECTIVITY.—$3 billion is designated for broadband deployment on Tribal lands.

SECTION 8. ENVIRONMENTAL CONSIDERATIONS.
(a) ENERGY STANDARDS.—Data centers receiving federal contracts must achieve carbon
neutrality by 2030 or utilize at least 80% renewable energy sources.
(b) E-WASTE.—Manufacturers of computing equipment must establish take-back programs
for electronic waste recycling.

SECTION 9. AUTHORIZATION OF APPROPRIATIONS.
There are authorized to be appropriated $65 billion for fiscal years 2026 through 2031
to carry out this Act.
  `.trim(),
};

async function main() {
  console.log('='.repeat(80));
  console.log('LEGISLATIVE COUNCIL — Multi-Agent Policy Analysis');
  console.log('='.repeat(80));
  console.log(`\nAnalyzing: "${sampleLegislation.title}"\n`);
  console.log('Convening expert committees in parallel...');
  console.log('Committees will analyze, then deliberate on each others findings.\n');

  const workflow = mastra.getWorkflow('legislativeCouncilWorkflow');
  const run = await workflow.createRun();
  const result = await run.start({ inputData: sampleLegislation });

  if (result.status === 'success') {
    console.log('\n' + '='.repeat(80));
    console.log('UNIFIED LEGISLATIVE ANALYSIS REPORT');
    console.log('='.repeat(80));
    console.log(result.result.report);
  } else {
    console.error('Workflow failed:', result);
  }
}

main().catch(console.error);
