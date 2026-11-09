import fs from 'node:fs';
for (const base of ['.artifacts/pr3', '.artifacts/pr3/merged-runtime/.artifacts/pr3']) {
  const results = base.includes('merged-runtime') ? '.artifacts/pr3/results-merged-pr1' : `${base}/results`;
  const ids = [...new Set(fs.readFileSync(`${results}/modules.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l).id))];
  console.log(base, ids.length, 'modules', ids.filter(x => x.includes('/dist/')));
  for (const name of ['normal-text', 'normal-approval', 'normal-serialized-approval', 'durable-approval', 'evented-approval']) {
    const s = JSON.parse(fs.readFileSync(`${results}/${name}.summary.json`, 'utf8'));
    console.log(name, JSON.stringify({
      callerIndexes: s.caller.indexes,
      live: s.live.lifecycle.map(x => ({ type: x.type, keys: Object.keys(x.payload), steps: x.payload.output?.steps?.length })),
      replay: s.replay.lifecycle.map(x => ({ type: x.type, steps: x.payload.output?.steps?.length })),
      topicTypes: s.topicTypes,
    }));
  }
}
