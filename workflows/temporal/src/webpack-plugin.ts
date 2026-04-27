export class WorkflowExportRegistry {
  private readonly exportsByFile = new Map<string, string[]>();

  register(filePath: string, exportNames: string[]): void {
    if (exportNames.length === 0) {
      return;
    }

    this.exportsByFile.set(filePath, [...new Set(exportNames)]);
  }

  get(filePath: string): string[] | undefined {
    return this.exportsByFile.get(filePath);
  }

  asMap(): Map<string, string[]> {
    return this.exportsByFile;
  }
}
