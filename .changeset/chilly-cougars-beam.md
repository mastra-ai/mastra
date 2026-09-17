---
'@mastra/core': minor
---

Added shared-history branch contracts for memory implementations.

Custom memory implementations can expose branch support through `supportsThreadBranching` and implement the branch navigation methods. Implementations that do not opt in continue returning `BRANCHING_UNSUPPORTED`.

    const input: BranchThreadInput = {
      threadId: 'conversation-1',
      branchPointMessageId: 'message-3',
    };
    const { thread, branch } = await customMemory.branchThread(input);
