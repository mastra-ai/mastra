const fs = require('fs');
const { execSync } = require('child_process');

const files = fs.readdirSync('./prs').filter(f => f.match(/^\d+\.json$/));
const toClose = [];

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(`./prs/${f}`, 'utf8'));
  if (d.suggestedAction === 'close') {
    toClose.push(d);
  }
}

function cleanNotes(notes) {
  if (!notes) return '';
  // Strip PR/issue references (e.g. #12400, PR #12400) — those are linked separately
  let cleaned = notes.replace(/\b(PR\s*)?#\d{4,6}\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  // Strip leading "This PR" starters to avoid sounding authoritative
  cleaned = cleaned.replace(/^This PR (is|has been|was|should be)\s+/i, '');
  return cleaned;
}

function buildComment(pr) {
  const cat = pr.triage?.category;
  const similarPRs = pr.similarOrDuplicatePRs || pr.triage?.similarOrDuplicatePRs || [];
  const mergedSimilar = similarPRs.filter(s => s.state === 'MERGED');
  const login = pr.author?.login || '';
  const isBot = pr.author?.isBot || login.includes('[bot]') || login.startsWith('app/');
  const mention = isBot ? '' : ` @${login}`;
  const notes = cleanNotes(pr.maintainerNotes);

  if (cat === 'likely-superseded') {
    // Collect all referenced PRs — from similarOrDuplicatePRs and from maintainerNotes
    const simRefs = mergedSimilar.map(s => s.number);
    const noteRefs = [...(pr.maintainerNotes || '').matchAll(/#(\d{4,6})/g)].map(m => Number(m[1]));
    const allRefs = [...new Set([...simRefs, ...noteRefs])].filter(n => n !== pr.number);

    let refsBlock = '';
    if (allRefs.length > 0) {
      refsBlock = `\n\nIt looks like this may have been covered by ${allRefs.map(n => '#' + n).join(', ')}.\n`;
    }

    let notesBlock = '';
    if (notes) {
      notesBlock = `\n\n<details>\n<summary>Context from triage</summary>\n\n${notes}\n</details>\n`;
    }

    return `Hey${mention}, thanks for this contribution! 🙏

We're doing a triage pass on open PRs and it looks like this one may have been superseded by other work that's landed since it was opened.${refsBlock}${notesBlock}
If you think there's still something here that isn't covered, feel free to open a fresh PR against the latest \`main\` branch — happy to take another look.

Thanks again for your time and effort!`;
  }

  if (cat === 'stale') {
    const age = pr.dates?.ageInDays;
    const ageStr = age > 90 ? `over ${Math.floor(age / 30)} months` : `${age} days`;

    let notesBlock = '';
    if (notes) {
      notesBlock = `\n\n<details>\n<summary>Context from triage</summary>\n\n${notes}\n</details>\n`;
    }

    return `Hey${mention}, thanks for this contribution! 🙏

This PR has been open for ${ageStr} without recent activity, so we're closing it as part of a triage pass to keep things manageable.${notesBlock}
If this is still something you'd like to pursue, feel free to open a fresh PR against the latest \`main\` — the codebase has moved on a bit and a fresh start will make things easier to review.

Thanks for your time and effort!`;
  }

  if (cat === 'close-candidate') {
    let notesBlock = '';
    if (notes) {
      notesBlock = `\n\n<details>\n<summary>Context from triage</summary>\n\n${notes}\n</details>\n`;
    }

    return `Hey${mention}, thanks for opening this! 🙏

We're doing a triage pass on open PRs and we don't think this one is the right fit at the moment.${notesBlock}
If you'd like to discuss further or rework the approach, feel free to open an issue first so we can align on direction before a new PR.

Thanks again!`;
  }

  if (cat === 'auto-dependency-update') {
    return `Closing this dependency update as part of a triage pass — it looks like it's been superseded by newer versions. A fresh update will be picked up automatically.`;
  }

  // Fallback
  let notesBlock = '';
  if (notes) {
    notesBlock = `\n\n<details>\n<summary>Context from triage</summary>\n\n${notes}\n</details>\n`;
  }

  return `Hey${mention}, thanks for this contribution! 🙏

We're closing this PR as part of a triage pass on open PRs.${notesBlock}
If you'd like to revisit this, feel free to open a fresh PR against the latest \`main\` branch.

Thanks for your time!`;
}

// Process each PR
console.log(`Closing ${toClose.length} PRs...\n`);

let closed = 0;
let failed = 0;

for (const pr of toClose) {
  const comment = buildComment(pr);
  const num = pr.number;
  
  try {
    // Add comment
    execSync(`gh pr comment ${num} --body ${JSON.stringify(comment)}`, {
      cwd: '..',
      stdio: 'pipe',
      timeout: 30000,
    });
    
    // Close the PR
    execSync(`gh pr close ${num}`, {
      cwd: '..',
      stdio: 'pipe',
      timeout: 30000,
    });
    
    closed++;
    console.log(`✓ #${num} (${pr.triage?.category})`);
  } catch (err) {
    failed++;
    console.error(`✗ #${num}: ${err.message.split('\n')[0]}`);
  }
}

console.log(`\nDone: ${closed} closed, ${failed} failed`);
