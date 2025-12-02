export interface GetProjectUsageSummaryResponse {
  start: string;
  end: string;
  resolution: {
    units: string;
    amount: number;
  };
  results: UsageSummary[];
}

interface UsageSummary {
  start: string;
  end: string;
  hours: number;
  total_hours: number;
  requests: number;
}
