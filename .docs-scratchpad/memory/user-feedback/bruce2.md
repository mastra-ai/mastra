https://discord.com/channels/1309558646228779139/1355789955451982025/1355984085671084184
bruce
OP
— 3/29/25, 11:25 PM
has anyone seen this when attempting to import memory in your agent?

import { Memory } from "@mastra/memory";
Franz — 3/30/25, 9:21 AM
I had lots of issues with the memory library, most were fixed when I switch from npm to pnpm
bruce
OP
— 3/30/25, 11:20 AM
okay saw that. not familiar with pnpm, but will try things out. I saw the thread on llamaindex was already imported. This breaks constructor checks and will lead to issues! whick i'm getting too.
bruce
OP
— 3/30/25, 12:16 PM
that made the llamaindex error go away, but to get the memory usage to work i had to run the following. Documentation does not refer to having to do this? pnpm install @mastra/memory
