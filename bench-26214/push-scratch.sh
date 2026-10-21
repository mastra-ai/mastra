#!/bin/bash
# Push harness, scripts and results to scratch/26214-checkpoint-storage-bench without touching the working tree.
set -e
cd /workspace/mastra
export GIT_INDEX_FILE=/tmp/bench-idx
git read-tree HEAD
git update-index --add --cacheinfo 100644,$(git hash-object -w packages/core/src/workflows/bench-26214.test.ts),packages/core/src/workflows/bench-26214.test.ts
for f in /workspace/bench/*.sh /workspace/bench/*.jsonl /workspace/bench/*.md /workspace/bench/dnf-*.log; do
  [ -f "$f" ] || continue
  git update-index --add --cacheinfo 100644,$(git hash-object -w "$f"),bench-26214/$(basename "$f")
done
tree=$(git write-tree)
parent=$(git ls-remote origin refs/heads/scratch/26214-checkpoint-storage-bench | cut -f1)
[ -n "$parent" ] && git cat-file -e "$parent" 2>/dev/null || { git fetch -q origin scratch/26214-checkpoint-storage-bench 2>/dev/null || true; }
[ -n "$parent" ] && git cat-file -e "$parent" 2>/dev/null && P="-p $parent" || P="-p HEAD"
c=$(GIT_AUTHOR_NAME="mastra-platform[bot]" GIT_AUTHOR_EMAIL="284800079+mastra-platform[bot]@users.noreply.github.com" GIT_COMMITTER_NAME="mastra-platform[bot]" GIT_COMMITTER_EMAIL="284800079+mastra-platform[bot]@users.noreply.github.com" \
  git commit-tree $tree $P -m "scratch: foreach checkpoint storage benchmark for #26214 ($1)

Co-Authored-By: mastra-platform[bot] <284800079+mastra-platform[bot]@users.noreply.github.com>")
git push -q origin $c:refs/heads/scratch/26214-checkpoint-storage-bench
git ls-remote origin refs/heads/scratch/26214-checkpoint-storage-bench
