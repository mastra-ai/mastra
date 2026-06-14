// Checkbook NYC — vendor payments, contracts, spending
export {
  sentinelCheckbookSpending,
  sentinelCheckbookVendorSummary,
  sentinelCheckbookSpendingTrend,
  sentinelCheckbookContracts,
} from './checkbook-nyc';

// NYC Open Data (Socrata) — payroll & spending
export {
  sentinelNycPayrollSearch,
  sentinelNycPayrollAggregation,
  sentinelNycPayrollOvertimeOutliers,
  sentinelNycDatasetQuery,
} from './nyc-opendata';

// USAspending.gov — federal awards & grants
export {
  sentinelFederalAwardsSearch,
  sentinelFederalSpendingByAgency,
  sentinelFederalAwardDetail,
  sentinelFederalRecipientProfile,
} from './usaspending';

// SAM.gov — vendor registry & exclusions
export { sentinelSamEntitySearch, sentinelSamExclusionCheck, sentinelSamEntityRiskSignals } from './sam-gov';

// NYC Comptroller — 20+ years of audit findings (FY2001–FY2023)
export { sentinelAuditFindingsSearch, sentinelAuditReportContent } from './audit-reports';

// Computation — statistical analysis
export { sentinelZscoreOutliers, sentinelPatternFlags } from './computations';
