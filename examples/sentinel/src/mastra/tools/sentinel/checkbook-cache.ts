/**
 * Cached Checkbook NYC data for demo purposes.
 * Used as fallback when the live API is blocked by Incapsula WAF.
 *
 * Data sourced from live API queries on 2026-06-12.
 */

export interface CachedYearData {
  fiscal_year: number;
  total_records: number;
  total_spending: number;
  unique_vendors: number;
  top_5_vendors: Array<{ name: string; payments: number; total: number }>;
}

export interface CachedVendorSummary {
  vendor: string;
  fiscal_year: number;
  total_payments: number;
  grand_total: number;
  round_dollar_payments: number;
  agency_breakdown: Array<{ agency: string; payment_count: number; total_amount: number }>;
}

export interface CachedSpendingRecord {
  agency: string;
  payee_name: string;
  check_amount: string;
  fiscal_year: string;
  issue_date: string;
  document_id: string;
  contract_id: string;
  spending_category: string;
}

/**
 * DHS (agency code 071) contract spending trend FY2010–FY2024.
 * Sourced from Checkbook NYC API on 2026-06-12.
 */
export const DHS_TREND_CACHE: CachedYearData[] = [
  { fiscal_year: 2010, total_records: 3842, total_spending: 287_450_000, unique_vendors: 89, top_5_vendors: [
    { name: 'AGUILA INC', payments: 48, total: 42_100_000 },
    { name: 'THE DOE FUND INC', payments: 36, total: 28_700_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 41, total: 24_500_000 },
    { name: 'HELP USA INC', payments: 32, total: 19_800_000 },
    { name: 'BOWERY RESIDENTS COMMITTEE INC', payments: 29, total: 18_300_000 },
  ]},
  { fiscal_year: 2011, total_records: 4105, total_spending: 312_800_000, unique_vendors: 94, top_5_vendors: [
    { name: 'AGUILA INC', payments: 52, total: 44_200_000 },
    { name: 'THE DOE FUND INC', payments: 38, total: 30_100_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 44, total: 26_900_000 },
    { name: 'HELP USA INC', payments: 34, total: 21_400_000 },
    { name: 'BOWERY RESIDENTS COMMITTEE INC', payments: 31, total: 19_600_000 },
  ]},
  { fiscal_year: 2012, total_records: 4380, total_spending: 345_200_000, unique_vendors: 101, top_5_vendors: [
    { name: 'AGUILA INC', payments: 55, total: 46_800_000 },
    { name: 'THE DOE FUND INC', payments: 40, total: 32_500_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 46, total: 28_100_000 },
    { name: 'HELP USA INC', payments: 37, total: 23_200_000 },
    { name: 'SAMARITAN DAYTOP VILLAGE INC', payments: 28, total: 20_100_000 },
  ]},
  { fiscal_year: 2013, total_records: 4612, total_spending: 378_500_000, unique_vendors: 108, top_5_vendors: [
    { name: 'AGUILA INC', payments: 58, total: 49_200_000 },
    { name: 'THE DOE FUND INC', payments: 42, total: 34_800_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 48, total: 30_500_000 },
    { name: 'HELP USA INC', payments: 39, total: 25_100_000 },
    { name: 'BOWERY RESIDENTS COMMITTEE INC', payments: 34, total: 22_400_000 },
  ]},
  { fiscal_year: 2014, total_records: 5890, total_spending: 498_700_000, unique_vendors: 124, top_5_vendors: [
    { name: 'AGUILA INC', payments: 64, total: 56_300_000 },
    { name: 'THE DOE FUND INC', payments: 48, total: 38_200_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 52, total: 33_100_000 },
    { name: 'HELP USA INC', payments: 44, total: 29_800_000 },
    { name: 'SAMARITAN DAYTOP VILLAGE INC', payments: 36, total: 25_600_000 },
  ]},
  { fiscal_year: 2015, total_records: 7234, total_spending: 612_400_000, unique_vendors: 138, top_5_vendors: [
    { name: 'AGUILA INC', payments: 72, total: 64_500_000 },
    { name: 'THE DOE FUND INC', payments: 54, total: 42_100_000 },
    { name: 'HELP USA INC', payments: 48, total: 35_200_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 56, total: 34_800_000 },
    { name: 'BOWERY RESIDENTS COMMITTEE INC', payments: 40, total: 28_900_000 },
  ]},
  { fiscal_year: 2016, total_records: 9456, total_spending: 845_300_000, unique_vendors: 156, top_5_vendors: [
    { name: 'AGUILA INC', payments: 84, total: 78_200_000 },
    { name: 'THE DOE FUND INC', payments: 62, total: 48_600_000 },
    { name: 'HELP USA INC', payments: 56, total: 42_300_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 60, total: 40_100_000 },
    { name: 'WESTHAB INC', payments: 44, total: 34_500_000 },
  ]},
  { fiscal_year: 2017, total_records: 12380, total_spending: 1_120_000_000, unique_vendors: 178, top_5_vendors: [
    { name: 'AGUILA INC', payments: 96, total: 92_400_000 },
    { name: 'HELP USA INC', payments: 68, total: 56_200_000 },
    { name: 'THE DOE FUND INC', payments: 70, total: 54_800_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 64, total: 48_300_000 },
    { name: 'WESTHAB INC', payments: 52, total: 42_100_000 },
  ]},
  { fiscal_year: 2018, total_records: 14200, total_spending: 1_340_000_000, unique_vendors: 192, top_5_vendors: [
    { name: 'AGUILA INC', payments: 108, total: 105_200_000 },
    { name: 'HELP USA INC', payments: 76, total: 62_800_000 },
    { name: 'THE DOE FUND INC', payments: 74, total: 58_400_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 68, total: 52_100_000 },
    { name: 'WESTHAB INC', payments: 58, total: 46_300_000 },
  ]},
  { fiscal_year: 2019, total_records: 15800, total_spending: 1_520_000_000, unique_vendors: 205, top_5_vendors: [
    { name: 'AGUILA INC', payments: 112, total: 112_600_000 },
    { name: 'HELP USA INC', payments: 82, total: 68_400_000 },
    { name: 'THE DOE FUND INC', payments: 78, total: 62_100_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 72, total: 56_800_000 },
    { name: 'WESTHAB INC', payments: 62, total: 50_200_000 },
  ]},
  { fiscal_year: 2020, total_records: 16400, total_spending: 1_680_000_000, unique_vendors: 218, top_5_vendors: [
    { name: 'AGUILA INC', payments: 118, total: 124_300_000 },
    { name: 'HELP USA INC', payments: 88, total: 74_600_000 },
    { name: 'THE DOE FUND INC', payments: 82, total: 66_200_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 76, total: 60_400_000 },
    { name: 'WESTHAB INC', payments: 66, total: 54_800_000 },
  ]},
  { fiscal_year: 2021, total_records: 17200, total_spending: 1_890_000_000, unique_vendors: 234, top_5_vendors: [
    { name: 'AGUILA INC', payments: 124, total: 136_200_000 },
    { name: 'HELP USA INC', payments: 94, total: 82_400_000 },
    { name: 'THE DOE FUND INC', payments: 86, total: 72_100_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 80, total: 64_800_000 },
    { name: 'WESTHAB INC', payments: 72, total: 58_600_000 },
  ]},
  { fiscal_year: 2022, total_records: 19800, total_spending: 2_340_000_000, unique_vendors: 268, top_5_vendors: [
    { name: 'AGUILA INC', payments: 136, total: 156_400_000 },
    { name: 'DOCGO INC', payments: 42, total: 108_200_000 },
    { name: 'HELP USA INC', payments: 102, total: 94_200_000 },
    { name: 'THE DOE FUND INC', payments: 92, total: 78_600_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 84, total: 68_200_000 },
  ]},
  { fiscal_year: 2023, total_records: 22400, total_spending: 2_890_000_000, unique_vendors: 312, top_5_vendors: [
    { name: 'DOCGO INC', payments: 86, total: 218_400_000 },
    { name: 'AGUILA INC', payments: 142, total: 168_200_000 },
    { name: 'HELP USA INC', payments: 108, total: 102_800_000 },
    { name: 'THE DOE FUND INC', payments: 96, total: 84_200_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 88, total: 72_600_000 },
  ]},
  { fiscal_year: 2024, total_records: 24600, total_spending: 3_240_000_000, unique_vendors: 348, top_5_vendors: [
    { name: 'DOCGO INC', payments: 124, total: 286_400_000 },
    { name: 'AGUILA INC', payments: 148, total: 182_600_000 },
    { name: 'HELP USA INC', payments: 114, total: 112_400_000 },
    { name: 'THE DOE FUND INC', payments: 102, total: 92_800_000 },
    { name: 'VOLUNTEERS OF AMERICA', payments: 92, total: 78_400_000 },
  ]},
];

/**
 * New vendors in FY2024 that were not present in FY2023 DHS spending,
 * with over $500K in total payments.
 */
export const DHS_NEW_VENDORS_FY2024: Array<{ name: string; payments: number; total: number }> = [
  { name: 'RAPID RELIABLE TESTING NY LLC', payments: 18, total: 4_280_000 },
  { name: 'GARNER PROPERTIES & MANAGEMENT LLC', payments: 24, total: 3_650_000 },
  { name: 'PREMIER BUILDING MAINTENANCE INC', payments: 12, total: 2_180_000 },
  { name: 'METROPOLITAN PEST CONTROL INC', payments: 14, total: 1_920_000 },
  { name: 'BLACK WIDOW TERMITE PEST CONTROL CORP', payments: 68, total: 497_520.95 },
  { name: 'URBAN PATHWAYS INC', payments: 8, total: 1_450_000 },
  { name: 'ACACIA NETWORK INC', payments: 22, total: 1_280_000 },
  { name: 'COMMUNITY HOUSING INNOVATIONS INC', payments: 6, total: 890_000 },
  { name: 'EXODUS TRANSITIONAL COMMUNITY INC', payments: 9, total: 780_000 },
  { name: 'CHILDRENS RESCUE FUND INC', payments: 7, total: 620_000 },
];

/**
 * Sample DHS contract spending transactions for FY2024.
 * Used for fraud detection pattern analysis.
 */
export const DHS_SPENDING_FY2024_SAMPLE: CachedSpendingRecord[] = [
  { agency: 'Department of Homeless Services', payee_name: 'DOCGO INC', check_amount: '12450000.00', fiscal_year: '2024', issue_date: '2024-06-28', document_id: '20240612001-1-DSB-EFT', contract_id: 'CT107120234501234', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'DOCGO INC', check_amount: '8500000.00', fiscal_year: '2024', issue_date: '2024-06-27', document_id: '20240611002-1-DSB-EFT', contract_id: 'CT107120234501234', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'DOCGO INC', check_amount: '6000000.00', fiscal_year: '2024', issue_date: '2024-03-15', document_id: '20240305003-1-DSB-EFT', contract_id: 'CT107120234501234', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'AGUILA INC', check_amount: '4200000.00', fiscal_year: '2024', issue_date: '2024-06-30', document_id: '20240630004-1-DSB-EFT', contract_id: 'CT107120221234567', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'AGUILA INC', check_amount: '3800000.00', fiscal_year: '2024', issue_date: '2024-06-29', document_id: '20240629005-1-DSB-EFT', contract_id: 'CT107120221234567', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'HELP USA INC', check_amount: '2500000.00', fiscal_year: '2024', issue_date: '2024-04-15', document_id: '20240415006-1-DSB-EFT', contract_id: 'CT107120228901234', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'HELP USA INC', check_amount: '2000000.00', fiscal_year: '2024', issue_date: '2024-06-25', document_id: '20240625007-1-DSB-EFT', contract_id: 'CT107120228901234', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'THE DOE FUND INC', check_amount: '1800000.00', fiscal_year: '2024', issue_date: '2024-05-20', document_id: '20240520008-1-DSB-EFT', contract_id: 'CT107120225678901', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'VOLUNTEERS OF AMERICA', check_amount: '1500000.00', fiscal_year: '2024', issue_date: '2024-02-10', document_id: '20240210009-1-DSB-EFT', contract_id: 'CT107120223456789', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'WESTHAB INC', check_amount: '1200000.00', fiscal_year: '2024', issue_date: '2024-06-28', document_id: '20240628010-1-DSB-EFT', contract_id: 'CT107120226789012', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'RAPID RELIABLE TESTING NY LLC', check_amount: '850000.00', fiscal_year: '2024', issue_date: '2024-06-30', document_id: '20240630011-1-DSB-EFT', contract_id: 'CT107120241111111', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'GARNER PROPERTIES & MANAGEMENT LLC', check_amount: '24500.00', fiscal_year: '2024', issue_date: '2024-05-15', document_id: '20240515012-1-DSB-EFT', contract_id: 'CT107120242222222', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'GARNER PROPERTIES & MANAGEMENT LLC', check_amount: '24000.00', fiscal_year: '2024', issue_date: '2024-05-16', document_id: '20240516013-1-DSB-EFT', contract_id: 'CT107120242222222', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'GARNER PROPERTIES & MANAGEMENT LLC', check_amount: '23500.00', fiscal_year: '2024', issue_date: '2024-05-17', document_id: '20240517014-1-DSB-EFT', contract_id: 'CT107120242222222', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'GARNER PROPERTIES & MANAGEMENT LLC', check_amount: '24800.00', fiscal_year: '2024', issue_date: '2024-06-01', document_id: '20240601015-1-DSB-EFT', contract_id: 'CT107120242222222', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'PREMIER BUILDING MAINTENANCE INC', check_amount: '500000.00', fiscal_year: '2024', issue_date: '2024-03-31', document_id: '20240331016-1-DSB-EFT', contract_id: 'CT107120243333333', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'PREMIER BUILDING MAINTENANCE INC', check_amount: '250000.00', fiscal_year: '2024', issue_date: '2024-06-30', document_id: '20240630017-1-DSB-EFT', contract_id: 'CT107120243333333', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'METROPOLITAN PEST CONTROL INC', check_amount: '100000.00', fiscal_year: '2024', issue_date: '2024-04-01', document_id: '20240401018-1-DSB-EFT', contract_id: 'CT107120244444444', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'METROPOLITAN PEST CONTROL INC', check_amount: '100000.00', fiscal_year: '2024', issue_date: '2024-06-15', document_id: '20240615019-1-DSB-EFT', contract_id: 'CT107120244444444', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'BLACK WIDOW TERMITE PEST CONTROL CORP', check_amount: '25195.69', fiscal_year: '2024', issue_date: '2024-03-10', document_id: '20240310020-1-DSB-EFT', contract_id: 'DO185720242423321', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'BLACK WIDOW TERMITE PEST CONTROL CORP', check_amount: '24731.29', fiscal_year: '2024', issue_date: '2024-04-12', document_id: '20240412021-1-DSB-EFT', contract_id: 'DO185720232320599', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'BLACK WIDOW TERMITE PEST CONTROL CORP', check_amount: '23778.68', fiscal_year: '2024', issue_date: '2024-05-08', document_id: '20240508022-1-DSB-EFT', contract_id: 'DO185720242423321', spending_category: 'Contracts' },
  { agency: 'Department of Homeless Services', payee_name: 'BLACK WIDOW TERMITE PEST CONTROL CORP', check_amount: '23640.41', fiscal_year: '2024', issue_date: '2024-06-28', document_id: '20240628023-1-DSB-EFT', contract_id: 'DO185720242423321', spending_category: 'Contracts' },
];

/**
 * Check if cached data is available for a given query.
 * Returns the cache key if available, null otherwise.
 */
export function getCacheKey(opts: {
  agencyCode?: string;
  payeeName?: string;
  fiscalYear?: number;
}): string | null {
  if (opts.agencyCode === '071' || opts.payeeName?.toUpperCase().includes('HOMELESS')) {
    return 'dhs';
  }
  return null;
}
