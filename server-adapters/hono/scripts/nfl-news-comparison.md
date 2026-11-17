# Live NFL news comparison

This opt-in scenario runs two real Mastra agents with the same model (`openai/gpt-6-luna`), instructions, user turns, and fixed rolling 24-hour news window. The only configuration difference is their search tool: OpenAI's hosted web search versus an Exa search tool that returns article text and publication metadata.

Each candidate researches five distinct NFL stories, then uses its own isolated memory to write one broadcast opening sentence. Both outputs, sources, tool calls, timings, and traces are retained. A failed turn stays visible as a failure. The script does not replace unsuccessful results with sample content.

## Run

From the repository root, after building the Hono adapter's workspace dependencies:

```sh
node --env-file=/absolute/path/to/private.env --import tsx \
  server-adapters/hono/scripts/nfl-news-comparison.ts
```

The private environment file needs `OPENAI_API_KEY` and `EXA_API_KEY`. This command makes paid live requests to both providers. Keep credentials outside tracked files.

In a second terminal:

```sh
cd packages/playground
PORT=4183 HOST=localhost pnpm dev --port 5179 --host 127.0.0.1
```

Open the comparison URL printed by the script, then choose **Replay conversation**. Turn 1 compares story selection and sources; turn 2 compares the final broadcast sentences. Playback uses saved output and makes no new model or search requests.

## Reopen saved results

```sh
node --import tsx server-adapters/hono/scripts/nfl-news-comparison.ts --serve
```

Results and the SQLite database persist in the ignored `.artifacts/nfl-news` directory. `--directory` selects another location; `--port` changes the API port, and the Studio command must then use the same value for `PORT` because Studio proxies API requests to it. Each live run creates a new dataset and pair of experiments, and `latest.json` records the latest comparison URL. `--serve` requires no API keys and performs no research.

## Existing infrastructure

The local script uses `Agent.generate`, memory, observability, LibSQL, and the existing `createExperiment`, `submitExperimentResult`, and `finalizeExperiment` APIs. It submits a saved conversation envelope that the current Studio playback already understands. No endpoints, product services, tables, or UI changes are added.

This is live research followed by visual playback, distinct from executing an imported production conversation against recorded tool mocks. The replay runner's lookup and deny policies remain intact.

Compare source quality, recency, story coverage, factual agreement, and the one-sentence requirement. Different wording alone is not a regression, and one live trial cannot establish a winning search provider. Publication timestamps returned by search providers can be incomplete; the agents are instructed to disclose uncertainty. Rerunning later also changes the news and search indexes.
