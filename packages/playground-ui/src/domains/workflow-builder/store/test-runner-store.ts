import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'suspended' | 'skipped';

export interface StepResult {
  stepId: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
  /** AI-specific metrics */
  aiMetrics?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

export interface TestRunResult {
  runId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  steps: Record<string, StepResult>;
  /** Suspend information if status is 'suspended' */
  suspend?: {
    stepId: string;
    payload?: unknown;
    resumeSchema?: Record<string, unknown>;
  };
  /** Total AI costs for this run */
  totalAiMetrics?: {
    totalTokens: number;
    totalCost: number;
    modelBreakdown: Record<string, { tokens: number; cost: number }>;
  };
}

export interface TestRunnerState {
  /** Whether the test runner panel is visible */
  isOpen: boolean;
  /** Whether a test is currently running */
  isRunning: boolean;
  /** Current test run result */
  currentRun: TestRunResult | null;
  /** History of past test runs (limited) */
  runHistory: TestRunResult[];
  /** Input values for the next test run */
  testInput: Record<string, unknown>;
  /** Whether input modal is open */
  showInputModal: boolean;
}

export interface TestRunnerActions {
  /** Open/close the test runner panel */
  setOpen: (open: boolean) => void;
  /** Toggle the test runner panel */
  toggleOpen: () => void;
  /** Set test input values */
  setTestInput: (input: Record<string, unknown>) => void;
  /** Update a single input field */
  updateTestInputField: (field: string, value: unknown) => void;
  /** Show/hide input modal */
  setShowInputModal: (show: boolean) => void;

  /** Start a new test run */
  startRun: (workflowId: string, input: Record<string, unknown>) => void;
  /** Update a step's status during a run */
  updateStepStatus: (stepId: string, result: Partial<StepResult>) => void;
  /** Complete the current run */
  completeRun: (output: unknown, error?: string) => void;
  /** Mark run as suspended */
  suspendRun: (stepId: string, payload: unknown, resumeSchema?: Record<string, unknown>) => void;
  /** Resume a suspended run */
  resumeRun: (resumeInput: Record<string, unknown>) => void;
  /** Cancel the current run */
  cancelRun: () => void;
  /** Clear current run */
  clearRun: () => void;

  /** Get step result by ID */
  getStepResult: (stepId: string) => StepResult | undefined;
  /** Get step status by ID */
  getStepStatus: (stepId: string) => StepStatus;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: TestRunnerState = {
  isOpen: false,
  isRunning: false,
  currentRun: null,
  runHistory: [],
  testInput: {},
  showInputModal: false,
};

// ============================================================================
// Store
// ============================================================================

export const useTestRunnerStore = create<TestRunnerState & TestRunnerActions>((set, get) => ({
  ...initialState,

  // Panel visibility
  setOpen: (open: boolean) => set({ isOpen: open }),
  toggleOpen: () => set(state => ({ isOpen: !state.isOpen })),

  // Test input
  setTestInput: (input: Record<string, unknown>) => set({ testInput: input }),
  updateTestInputField: (field: string, value: unknown) =>
    set(state => ({
      testInput: { ...state.testInput, [field]: value },
    })),
  setShowInputModal: (show: boolean) => set({ showInputModal: show }),

  // Run lifecycle
  startRun: (workflowId: string, input: Record<string, unknown>) => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const run: TestRunResult = {
      runId,
      workflowId,
      status: 'running',
      startedAt: new Date().toISOString(),
      input,
      steps: {},
    };
    set({
      isRunning: true,
      currentRun: run,
      showInputModal: false,
    });
  },

  updateStepStatus: (stepId: string, result: Partial<StepResult>) => {
    set(state => {
      if (!state.currentRun) return state;

      const existingStep = state.currentRun.steps[stepId] || { stepId, status: 'pending' };
      const updatedStep: StepResult = {
        ...existingStep,
        ...result,
        stepId,
      };

      // Calculate duration if completed
      if (result.status === 'completed' || result.status === 'failed') {
        if (existingStep.startedAt && !result.completedAt) {
          updatedStep.completedAt = new Date().toISOString();
        }
        if (updatedStep.startedAt && updatedStep.completedAt) {
          updatedStep.durationMs =
            new Date(updatedStep.completedAt).getTime() - new Date(updatedStep.startedAt).getTime();
        }
      }

      return {
        currentRun: {
          ...state.currentRun,
          steps: {
            ...state.currentRun.steps,
            [stepId]: updatedStep,
          },
        },
      };
    });
  },

  completeRun: (output: unknown, error?: string) => {
    set(state => {
      if (!state.currentRun) return state;

      const completedAt = new Date().toISOString();
      const completedRun: TestRunResult = {
        ...state.currentRun,
        status: error ? 'failed' : 'completed',
        completedAt,
        durationMs: new Date(completedAt).getTime() - new Date(state.currentRun.startedAt).getTime(),
        output,
        error,
        totalAiMetrics: calculateTotalAiMetrics(state.currentRun.steps),
      };

      // Add to history (keep last 10)
      const newHistory = [completedRun, ...state.runHistory].slice(0, 10);

      return {
        isRunning: false,
        currentRun: completedRun,
        runHistory: newHistory,
      };
    });
  },

  suspendRun: (stepId: string, payload: unknown, resumeSchema?: Record<string, unknown>) => {
    set(state => {
      if (!state.currentRun) return state;

      return {
        isRunning: false,
        currentRun: {
          ...state.currentRun,
          status: 'suspended',
          suspend: {
            stepId,
            payload,
            resumeSchema,
          },
        },
      };
    });
  },

  resumeRun: (resumeInput: Record<string, unknown>) => {
    set(state => {
      if (!state.currentRun || state.currentRun.status !== 'suspended') return state;

      return {
        isRunning: true,
        currentRun: {
          ...state.currentRun,
          status: 'running',
          suspend: undefined,
        },
      };
    });
  },

  cancelRun: () => {
    set(state => {
      if (!state.currentRun) return state;

      const cancelledRun: TestRunResult = {
        ...state.currentRun,
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Run cancelled by user',
      };

      return {
        isRunning: false,
        currentRun: cancelledRun,
        runHistory: [cancelledRun, ...state.runHistory].slice(0, 10),
      };
    });
  },

  clearRun: () => set({ currentRun: null }),

  // Getters
  getStepResult: (stepId: string) => {
    const { currentRun } = get();
    return currentRun?.steps[stepId];
  },

  getStepStatus: (stepId: string) => {
    const { currentRun } = get();
    return currentRun?.steps[stepId]?.status || 'pending';
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function calculateTotalAiMetrics(steps: Record<string, StepResult>): TestRunResult['totalAiMetrics'] | undefined {
  let totalTokens = 0;
  let totalCost = 0;
  const modelBreakdown: Record<string, { tokens: number; cost: number }> = {};

  for (const step of Object.values(steps)) {
    if (step.aiMetrics) {
      const { model, totalTokens: stepTokens, cost } = step.aiMetrics;
      if (stepTokens) totalTokens += stepTokens;
      if (cost) totalCost += cost;

      if (model) {
        if (!modelBreakdown[model]) {
          modelBreakdown[model] = { tokens: 0, cost: 0 };
        }
        if (stepTokens) modelBreakdown[model].tokens += stepTokens;
        if (cost) modelBreakdown[model].cost += cost;
      }
    }
  }

  if (totalTokens === 0 && totalCost === 0) return undefined;

  return { totalTokens, totalCost, modelBreakdown };
}

// ============================================================================
// Selectors
// ============================================================================

export const selectIsTestRunning = (state: TestRunnerState) => state.isRunning;
export const selectCurrentRun = (state: TestRunnerState) => state.currentRun;
export const selectRunHistory = (state: TestRunnerState) => state.runHistory;
export const selectTestInput = (state: TestRunnerState) => state.testInput;
export const selectIsTestPanelOpen = (state: TestRunnerState) => state.isOpen;
export const selectShowInputModal = (state: TestRunnerState) => state.showInputModal;
export const selectIsSuspended = (state: TestRunnerState) => state.currentRun?.status === 'suspended';
