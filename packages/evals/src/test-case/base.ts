export abstract class BaseTestCase {
  private datasetRank?: number;
  private datasetAlias?: string;
  private datasetId?: string;

  // Dataset-related getters and setters
  getDatasetRank(): number | undefined {
    return this.datasetRank;
  }

  setDatasetRank(rank: number): void {
    this.datasetRank = rank;
  }

  getDatasetAlias(): string | undefined {
    return this.datasetAlias;
  }

  setDatasetAlias(alias: string): void {
    this.datasetAlias = alias;
  }

  getDatasetId(): string | undefined {
    return this.datasetId;
  }

  setDatasetId(id: string): void {
    this.datasetId = id;
  }
}
