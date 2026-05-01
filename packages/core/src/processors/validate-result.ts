import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import { isSupportedLanguageModel, supportedLanguageModelSpecifications } from '../agent/utils';
import { MastraError } from '../error';
import { resolveModelConfig } from '../llm';
import type {
  ProcessInputResult,
  ProcessInputStepResult,
  Processor,
  ProcessorMessageResult,
  RunProcessInputStepResult,
} from './index';

export type ProcessInputValidationResult = {
  messages?: MastraDBMessage[];
  messageList?: MessageList;
  modelContextMessages?: MastraDBMessage[];
  systemMessages?: CoreMessageV4[];
};

export function validateProcessorResultExclusivity({
  result,
  processorId,
  domain = 'AGENT',
}: {
  result: object;
  processorId: string;
  domain?: 'AGENT' | 'MASTRA_WORKFLOW';
}): void {
  if ('messages' in result && 'modelContextMessages' in result) {
    throw new MastraError({
      category: 'USER',
      domain,
      id: 'PROCESSOR_RETURNED_MESSAGES_AND_MODEL_CONTEXT_MESSAGES',
      text: `Processor ${processorId} returned both messages and modelContextMessages. Only one of these is allowed.`,
    });
  }
}

function assertReturnedMessageListIsLocal({
  returnedMessageList,
  messageList,
  processorId,
}: {
  returnedMessageList: MessageList;
  messageList: MessageList;
  processorId: string;
}): void {
  if (returnedMessageList !== messageList) {
    throw new MastraError({
      category: 'USER',
      domain: 'AGENT',
      id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
      text: `Processor ${processorId} returned a MessageList instance other than the one that was passed in as an argument. New external message list instances are not supported. Use the messageList argument instead.`,
    });
  }
}

export function validateAndFormatProcessInputResult(
  result: ProcessInputResult | undefined | void,
  {
    messageList,
    processor,
  }: {
    messageList: MessageList;
    processor: Processor;
  },
): ProcessInputValidationResult {
  if (result instanceof MessageList) {
    assertReturnedMessageListIsLocal({
      returnedMessageList: result as MessageList,
      messageList,
      processorId: processor.id,
    });
    return {
      messageList: result as MessageList,
    };
  } else if (Array.isArray(result)) {
    return {
      messages: result,
    };
  } else if (result) {
    const resultWithMessageList = result as typeof result & { messageList?: MessageList };
    if ('messageList' in resultWithMessageList && resultWithMessageList.messageList) {
      assertReturnedMessageListIsLocal({
        returnedMessageList: resultWithMessageList.messageList,
        messageList,
        processorId: processor.id,
      });
    }
    if ('messages' in result && 'messageList' in resultWithMessageList) {
      throw new MastraError({
        category: 'USER',
        domain: 'AGENT',
        id: 'PROCESSOR_RETURNED_MESSAGES_AND_MESSAGE_LIST',
        text: `Processor ${processor.id} returned both messages and messageList. Only one of these is allowed.`,
      });
    }
    validateProcessorResultExclusivity({ result, processorId: processor.id });
    return result;
  }

  return {};
}

export async function validateAndFormatProcessInputStepResult(
  result: ProcessInputStepResult | Awaited<ProcessorMessageResult> | undefined | void,
  {
    messageList,
    processor,
    stepNumber,
  }: {
    messageList: MessageList;
    processor: Processor;
    stepNumber: number;
  },
): Promise<RunProcessInputStepResult> {
  if (result instanceof MessageList) {
    assertReturnedMessageListIsLocal({
      returnedMessageList: result as MessageList,
      messageList,
      processorId: processor.id,
    });
    return {
      messageList: result as MessageList,
    };
  } else if (Array.isArray(result)) {
    return {
      messages: result,
    };
  } else if (result) {
    if ('messageList' in result && result.messageList) {
      assertReturnedMessageListIsLocal({
        returnedMessageList: result.messageList,
        messageList,
        processorId: processor.id,
      });
    }
    if ('messages' in result && 'messageList' in result) {
      throw new MastraError({
        category: 'USER',
        domain: 'AGENT',
        id: 'PROCESSOR_RETURNED_MESSAGES_AND_MESSAGE_LIST',
        text: `Processor ${processor.id} returned both messages and messageList. Only one of these is allowed.`,
      });
    }
    validateProcessorResultExclusivity({ result, processorId: processor.id });
    const { model: _model, ...rest } = result;
    if (result.model) {
      const resolvedModel = await resolveModelConfig(result.model);
      const isSupported = isSupportedLanguageModel(resolvedModel);
      if (!isSupported) {
        throw new MastraError({
          category: 'USER',
          domain: 'AGENT',
          id: 'PROCESSOR_RETURNED_UNSUPPORTED_MODEL',
          text: `Processor ${processor.id} returned an unsupported model version ${resolvedModel.specificationVersion} in step ${stepNumber}. Only ${supportedLanguageModelSpecifications.join(', ')} models are supported in processInputStep.`,
        });
      }

      return {
        model: resolvedModel,
        ...rest,
      };
    }

    return rest;
  }

  return {};
}
