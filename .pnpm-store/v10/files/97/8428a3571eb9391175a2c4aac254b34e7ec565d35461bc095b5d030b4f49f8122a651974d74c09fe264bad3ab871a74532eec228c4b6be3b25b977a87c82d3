# Deepgram Captions

This package is the JavaScript implementation of Deepgram's WebVTT and SRT formatting. Given a transcription, this package can return a valid string to store as WebVTT or SRT caption files.

> Works with ANY transcription format.

## Installation

```bash
npm install @deepgram/captions
# - or -
# yarn add @deepgram/captions
```

## WebVTT from Deepgram Transcriptions

```ts
import { webvtt } from "@deepgram/captions";

const result = webvtt(deepgram_transcription_result);
```

## SRT from Deepgram Transcriptions

```ts
import { srt } from "@deepgram/captions";

const result = srt(deepgram_transcription_result);
```

## Converters

This package has been built to convert any transcription format. You only need to provide a `converter` class to provide the formatters with the correct data.

### Example Converter

A generic converter would look like this:

```ts
import { chunkArray, WordBase, IConverter } from "@deepgram/captions";

export class GenericConverter implements IConverter {
  constructor(public transcriptionData: any) {}

  getLines(lineLength: number = 8): WordBase[][] {
    const results = this.transcriptionData;
    let content: WordBase[][] = [];

    results.paragraphs.forEach((paragraph) => {
      if (paragraph.words.length > lineLength) {
        content.push(...chunkArray(paragraph.words, lineLength));
      } else {
        content.push(paragraph.words);
      }
    });

    return content;
  }
}
```

It requires that `getLines` return the following data structure:

```ts
// const transcriptionData: WordBase[][] = [
const transcriptionData = [
  [
    {
      word: string;
      start: number;
      end: number;
      punctuated_word: string; // optional
    }
  ]
]
```

Using your converter will look like this:

```ts
import { srt } from "@deepgram/captions";

const result = srt(new GenericConverter(transcription_result));
```

### Included Converters

#### Assembly AI

```ts
import { webvtt, AssemblyAiConverter } from "@deepgram/captions";

const result = webvtt(new AssemblyAiConverter(assembly_result));
```

## Output WebVTT

When transcribing https://dpgr.am/spacewalk.wav, and running it through our library, this is the WebVTT output.

```ts
import { webvtt } from "@deepgram/captions";

const result = webvtt(deepgram_transcription_result);

console.log(result);
```

This is the result:

```text
WEBVTT

NOTE
Transcription provided by Deepgram
Request Id: 686278aa-d315-4aeb-b2a9-713615544366
Created: 2023-10-27T15:35:56.637Z
Duration: 25.933313
Channels: 1

00:00:00.080 --> 00:00:03.220
Yeah. As as much as, it's worth celebrating,

00:00:04.400 --> 00:00:05.779
the first, spacewalk,

00:00:06.319 --> 00:00:07.859
with an all female team,

00:00:08.475 --> 00:00:10.715
I think many of us are looking forward

00:00:10.715 --> 00:00:13.215
to it just being normal and

00:00:13.835 --> 00:00:16.480
I think if it signifies anything, It is

00:00:16.779 --> 00:00:18.700
to honor the the women who came before

00:00:18.700 --> 00:00:21.680
us who, were skilled and qualified,

00:00:22.300 --> 00:00:24.779
and didn't get the same opportunities that we

00:00:24.779 --> 00:00:25.439
have today.
```

## Output SRT

When transcribing https://dpgr.am/spacewalk.wav, and running it through our library, this is the SRT output.

```ts
import { srt } from "@deepgram/captions";

const result = srt(deepgram_transcription_result);

console.log(result);
```

This is the result:

```text
1
00:00:00,080 --> 00:00:03,220
Yeah. As as much as, it's worth celebrating,

2
00:00:04,400 --> 00:00:07,859
the first, spacewalk, with an all female team,

3
00:00:08,475 --> 00:00:10,715
I think many of us are looking forward

4
00:00:10,715 --> 00:00:14,235
to it just being normal and I think

5
00:00:14,235 --> 00:00:17,340
if it signifies anything, It is to honor

6
00:00:17,340 --> 00:00:19,820
the the women who came before us who,

7
00:00:20,140 --> 00:00:23,580
were skilled and qualified, and didn't get the

8
00:00:23,580 --> 00:00:25,439
same opportunities that we have today.
```

## Documentation

You can learn more about the Deepgram API at [developers.deepgram.com](https://developers.deepgram.com/docs).

## Development and Contributing

Interested in contributing? We ❤️ pull requests!

To make sure our community is safe for all, be sure to review and agree to our
[Code of Conduct](./.github/CODE_OF_CONDUCT.md). Then see the
[Contribution](./.github/CONTRIBUTING.md) guidelines for more information.

## Getting Help

We love to hear from you so if you have questions, comments or find a bug in the
project, let us know! You can either:

- [Open an issue in this repository](https://github.com/deepgram/[reponame]/issues/new)
- [Join the Deepgram Github Discussions Community](https://github.com/orgs/deepgram/discussions)
- [Join the Deepgram Discord Community](https://discord.gg/xWRaCDBtW4)

[license]: LICENSE.txt
