import { LLMTestCase, ConversationalTestCase, MLLMTestCase } from '../test-case';

// Common interface for shared properties across metric classes
interface BaseMetricProps {
  score?: number;
  scoreBreakdown?: Record<string, any>;
  reason?: string;
  success?: boolean;
  evaluationModel?: string;
  strictMode: boolean;
  asyncMode: boolean;
  verboseMode: boolean;
  includeReason: boolean;
  error?: string;
  evaluationCost?: number;
  verboseLogs?: string;
  skipped: boolean;
}

export abstract class BaseMetric implements BaseMetricProps {
  threshold!: number;
  score?: number = undefined;
  scoreBreakdown?: Record<string, any> = undefined;
  reason?: string = undefined;
  success?: boolean = undefined;
  evaluationModel?: string = undefined;
  strictMode: boolean = false;
  asyncMode: boolean = true;
  verboseMode: boolean = true;
  includeReason: boolean = false;
  error?: string = undefined;
  evaluationCost?: number = undefined;
  verboseLogs?: string = undefined;
  skipped: boolean = false;

  abstract measure(testCase: LLMTestCase, ...args: any[]): Promise<number> | number;

  abstract aMeasure(testCase: LLMTestCase, ...args: any[]): Promise<number>;

  abstract isSuccessful(): boolean;

  get name(): string {
    return 'Base Metric';
  }
}

export abstract class BaseConversationalMetric implements BaseMetricProps {
  threshold!: number;
  score?: number = undefined;
  scoreBreakdown?: Record<string, any> = undefined;
  reason?: string = undefined;
  success?: boolean = undefined;
  evaluationModel?: string = undefined;
  strictMode: boolean = false;
  asyncMode: boolean = true;
  verboseMode: boolean = true;
  includeReason: boolean = false;
  error?: string = undefined;
  evaluationCost?: number = undefined;
  verboseLogs?: string = undefined;
  skipped: boolean = false;

  abstract measure(testCase: ConversationalTestCase, ...args: any[]): Promise<number> | number;

  abstract aMeasure(testCase: ConversationalTestCase, ...args: any[]): Promise<number>;

  abstract isSuccessful(): boolean;

  get name(): string {
    return 'Base Conversational Metric';
  }
}

export abstract class BaseMultimodalMetric implements BaseMetricProps {
  private _threshold!: number;
  score?: number = undefined;
  scoreBreakdown?: Record<string, any> = undefined;
  reason?: string = undefined;
  success?: boolean = undefined;
  evaluationModel?: string = undefined;
  strictMode: boolean = false;
  asyncMode: boolean = true;
  verboseMode: boolean = true;
  includeReason: boolean = false;
  error?: string = undefined;
  evaluationCost?: number = undefined;
  verboseLogs?: string = undefined;
  skipped: boolean = false;

  get threshold(): number {
    return this._threshold;
  }

  set threshold(value: number) {
    this._threshold = value;
  }

  abstract measure(testCase: MLLMTestCase, ...args: any[]): Promise<number> | number;

  abstract aMeasure(testCase: MLLMTestCase, ...args: any[]): Promise<number>;

  abstract isSuccessful(): boolean;

  get name(): string {
    return 'Base Multimodal Metric';
  }
}
