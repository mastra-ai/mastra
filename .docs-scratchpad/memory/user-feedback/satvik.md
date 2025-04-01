https://discord.com/channels/1309558646228779139/1352420714845835378
Im calling client sdk from my node backend. Why does it have react in the path?
Image
satvik
OP
— 2025-03-20, 4:35 PM
is it cuz of monorepo?
Im using the client sdk, why would it require tokenizer? It wouldn't need to download the model right? and im running mastra on the cloud
Tyler — 2025-03-20, 5:52 PM
React being in the path is a pnpm thing - for the error though I'm not really sure. @Ward could this be from recent bundling changes?
satvik
OP
— 2025-03-20, 7:01 PM
Lemme know if you get any info. I remember dero is working on the client sdk. Pulling him in just incase he knows anything. @dero
Ward — 2025-03-21, 2:22 AM
i think we have react hooks in our client sdk, i'll sync with @dero
dero — 2025-03-21, 2:39 AM
hmm, we actually don't have react hooks directly in the SDK, i'lll investigate
satvik
OP
— 2025-03-21, 7:47 AM
ahhhh, I lowkey don't get this. its all api calls it self. the error says its from agent.response
Image
satvik
OP
— 2025-03-21, 8:28 AM
Can i manually put the tokenizer into the path?
a quick fix for now?
dero — 2025-03-21, 8:38 AM
Yeah "Tokenizer not found" seems to be from the server
Looks like an issue with the default embedder
maybe it's still something with the build like @Tyler said, cc @Ward
satvik
OP
— 2025-03-21, 8:46 AM
Im hosting the model in the mastra cloud. I don't see any logs of it but could you check it once
satvik
OP
— 2025-03-21, 9:12 AM
is it cuz im using mastra cloud in memory?
Ward — 2025-03-21, 9:39 AM
need to check, memory was working fine for me
Tyler — 2025-03-21, 10:52 AM
This would be when using default embedder w/ memory. @satvik as a workaround you can use new Memory({ embedder: openai.embedding('text-embedding-3-small') })
satvik
OP
— 2025-03-21, 11:18 AM
will that be local?
Tyler — 2025-03-21, 11:34 AM
No, it wont
Mentioning it incase you need to get unblocked in the meantime 😄
satvik
OP
— 2025-03-21, 11:37 AM
sick! alrighty
satvik
OP
— 2025-03-21, 3:59 PM
works like this? how exactly do i make the embedding?
Image
the input and encoding_formte? what do i put for it?
NVM, im dumb. I got it
