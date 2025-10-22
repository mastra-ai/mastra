import { ReadableStream } from 'stream/web';
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { RuntimeContext } from '../../../runtime-context';
import { MastraModelOutput } from '../../../stream';
import { createStreamStep } from './stream-step';

type TestProcessor = { type: string };
type MockFn = ReturnType<typeof vi.fn>;
type TestCapabilities = {
  llm: { stream: MockFn };
  logger: { debug: MockFn };
  generateMessageId: MockFn;
  agentName: string;
  outputProcessors?: TestProcessor[] | MockFn;
};

describe('createStreamStep', () => {
  let capabilities: TestCapabilities;

  const expectStreamCalledWithProcessors = (capabilities: TestCapabilities, processors: TestProcessor[]) => {
    expect(capabilities.llm.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        outputProcessors: processors,
      }),
    );
  };

  beforeEach(() => {
    const streamResult = {
      mastra: new MastraModelOutput({
        model: { modelId: 'test', provider: 'test', version: 'v1' },
        stream: new ReadableStream(),
        messageList: { get: { response: { aiV5: { model: () => [] } } } },
        options: {},
        messageId: 'test',
      }),
    };

    capabilities = {
      llm: {
        stream: vi.fn().mockReturnValue(streamResult),
      },
      logger: {
        debug: vi.fn(),
      },
      generateMessageId: vi.fn(),
      agentName: 'test-agent',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call outputProcessors function with runtime context when it is a function', async () => {
    // Arrange
    const runtimeContext = new RuntimeContext();
    const processorArray: TestProcessor[] = [{ type: 'test-processor' }];
    const processorFn = vi.fn().mockResolvedValue(processorArray);
    capabilities.outputProcessors = processorFn;

    const step = createStreamStep({ capabilities });

    // Act
    await step.execute({
      inputData: {
        runtimeContext,
      },
    });

    // Assert
    expect(processorFn).toHaveBeenCalledWith({
      runtimeContext,
    });
    expectStreamCalledWithProcessors(capabilities, processorArray);
  });

  it('should create new RuntimeContext when capabilities.outputProcessors is function but no runtimeContext provided', async () => {
    // Arrange: Create test processors and mock outputProcessors function
    const processorArray: TestProcessor[] = [{ type: 'test-processor' }];
    let capturedContext: RuntimeContext | undefined;
    const processorFn = vi.fn().mockImplementation(({ runtimeContext }) => {
      expect(runtimeContext).toBeInstanceOf(RuntimeContext);
      capturedContext = runtimeContext;
      return processorArray;
    });
    capabilities.outputProcessors = processorFn;

    const step = createStreamStep({ capabilities });

    // Act: Execute stream step without providing runtimeContext
    await step.execute({
      inputData: {},
    });

    // Assert: Verify outputProcessors called with new context and stream called with processors
    expect(processorFn).toHaveBeenCalled();
    expect(capturedContext).toBeInstanceOf(RuntimeContext);
    expectStreamCalledWithProcessors(capabilities, processorArray);
  });

  it('should use outputProcessors directly when it exists but is not a function', async () => {
    // Arrange
    const processorArray: TestProcessor[] = [{ type: 'test-processor' }];
    capabilities.outputProcessors = processorArray;

    const step = createStreamStep({ capabilities });

    // Act
    await step.execute({
      inputData: {},
    });

    // Assert
    expectStreamCalledWithProcessors(capabilities, processorArray);
  });

  it('should use empty array for outputProcessors when neither inputData.outputProcessors nor capabilities.outputProcessors exist', async () => {
    // Arrange
    const step = createStreamStep({ capabilities });

    // Act
    await step.execute({
      inputData: {},
    });

    // Assert
    expectStreamCalledWithProcessors(capabilities, []);
  });

  it('should use inputData.outputProcessors when provided, ignoring capabilities.outputProcessors', async () => {
    // Arrange
    const capabilitiesProcessors: TestProcessor[] = [{ type: 'capabilities-processor' }];
    const inputDataProcessors: TestProcessor[] = [{ type: 'input-data-processor' }];
    capabilities.outputProcessors = capabilitiesProcessors;
    const step = createStreamStep({ capabilities });

    // Act
    await step.execute({
      inputData: {
        outputProcessors: inputDataProcessors,
      },
    });

    // Assert
    expectStreamCalledWithProcessors(capabilities, inputDataProcessors);
  });
});
