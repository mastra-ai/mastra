# Billed images

The `image-agent` generates one private PNG for one credit. The `image-kit` prepares three prompts for the same subject as book and website illustrations and saves them in its suspended approval state. The fixed order is Notion-inspired (minimal black-and-white hand-drawn line art on a light background), 3D (volume and soft lighting), and vector illustration (flat shapes and crisp edges). All three outputs are PNG images. Approval generates three images under one three-credit parent reservation. Rejection, cancellation and partial failure release the hold; a lost financial acknowledgement remains pending until matching provider evidence confirms the outcome.

## Generate and approve

Run `npm run setup` to create fresh John/Emma/Alex personal profiles (or preserve existing profiles), configure `OPENAI_API_KEY` in `.env`, then start `npm run dev`. Local billing requires no payment credentials. OpenAI model access and generation costs belong to the operator.

```sh
npm run images -- generate --json '{"brief":"A blue bird in a quiet forest"}' --key bird-one
npm run images -- start --json '{"brief":"A blue bird perched on a branch in a quiet forest"}' --key bird-kit
npm run images -- status EXECUTION_ID
npm run images -- resume EXECUTION_ID --json '{"approved":true}' --key approve-kit
npm run images -- cancel EXECUTION_ID --key cancel-kit
npm run images -- account
```

Read `npm run images -- account` before a take and call its current available balance B. A successful image leaves B − 1. Starting the kit then holds three credits, leaving B − 4 available while confirmed consumption remains one. Full approval keeps B − 4 available and confirms a total of four; replay adds zero. Fresh local accounts start at 30; repeated setup preserves existing spending.

The agent accepts at most 2,000 characters; the kit brief accepts 1,800. The default server profile is `gpt-image-2.5-flare`, one image per call, `1024x1024`, low quality, PNG. The text model remains `openai/gpt-6-luna`. Image requests have a 120-second timeout, an 8 MiB PNG limit and a 12 MiB response limit. The persisted application deadline can stop work earlier. The kit's suspension budget is 30 minutes. Review `result.pending.approval.prompts` before resuming. A restart preserves these exact prompts, and approval sends them unchanged to the image model in the saved order. The text Agent only orchestrates the image tool. The three styles preserve the subject and content, without guaranteeing identical composition or pixels.

### Configure the image profile

Set optional `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` (`low`, `medium`, `high`, `auto`) and `OPENAI_IMAGE_SIZE` (`1024x1024`, `1536x1024`, `1024x1536`) on the server. Omitted variables retain the defaults in `src/images/profile.ts`. The resolved profile is captured in each durable dispatch identity. Billing always permits one PNG per slot; request bodies and model tool arguments cannot alter those invariants. Invalid profile settings fail during configuration before compute. The selected model must support the requested image generation options.

`png-validation.ts` validates image bytes returned by OpenAI: signature, chunk checksums, dimensions and bounded decompression. It does not generate or draw an image. The text agent orchestrates the tool, the image model generates the PNG, and the validator prevents corrupt or mismatched output from certifying successful billable work.

The style kit uses workflow and policy version `image-kit-v2`. Saved prompts are never rewritten. A kit saved under an incompatible older definition cannot be read or resumed through the updated workflow. Use its original compatible definition to review or cancel an older suspended kit before starting a new one.

Reusing an operation's exact key and input returns its saved result. A different input with the same key conflicts. A repeated image tool call reuses its durable slot. A timeout or lost response never permits automatic generation again. Whole-kit success requires three owned, intact files; partial images remain private and unavailable for download.

## Download a private artifact

Agent output contains `result.object.artifacts`; a completed kit contains `result.output.artifacts`. Each reference includes an opaque ID, safe filename, dimensions, byte count and SHA-256 digest. Binary image data stays outside billing JSON.

From the template directory, replace `ARTIFACT_ID` with the reference's `id` and run this command. It reads the synthetic local owner's private profile without printing its credential, downloads from the running local server, and creates `bird.png` with owner-only permissions. Choose a new output filename for each download; an existing file is never overwritten. The optional third argument sets the local server URL when its port differs. For the [Autumn sandbox walkthrough](autumn.md#test-autumn-sandbox-in-studio), append `data/autumn-sandbox/profile.json` as a fourth argument on the first line, before `<<'NODE'`.

```sh
node --input-type=module - ARTIFACT_ID bird.png http://127.0.0.1:4111 <<'NODE'
import { readFile, open } from 'node:fs/promises';

const [artifactId, output, baseUrl = 'http://127.0.0.1:4111', profileFile = 'data/local-profiles.json'] = process.argv.slice(2);
if (!/^[a-f0-9-]{36}$/i.test(artifactId ?? '') || !output) {
  throw new Error('Provide an artifact ID and a new output filename.');
}
const base = new URL(baseUrl);
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.username || base.password) {
  throw new Error('Use the local server at http://127.0.0.1:PORT.');
}
const manifest = JSON.parse(await readFile(profileFile, 'utf8'));
const owner = manifest.profiles?.owner ?? manifest;
const response = await fetch(new URL(
  `/billing/workspaces/${encodeURIComponent(owner.workspaceId)}/artifacts/${artifactId}`,
  base,
), {
  headers: { Authorization: `Bearer ${owner.credential}` },
  redirect: 'error',
});
if (!response.ok || response.headers.get('content-type') !== 'image/png') {
  throw new Error(`Artifact unavailable: ${response.status}`);
}
const png = new Uint8Array(await response.arrayBuffer());
const file = await open(output, 'wx', 0o600);
try {
  await file.writeFile(png);
} finally {
  await file.close();
}
console.log(`Saved ${png.length} bytes to ${output}`);
NODE
```

Open the saved PNG with your image viewer. For an artifact created by another profile, use that creator's authenticated credential in trusted code. Production integrations use their configured authenticated creator credential rather than this local profile command.

Current membership and creator ownership are checked on every read. Other workspace members cannot download another person's image. Reads send private, no-store headers and never bill. Missing, corrupt or unsafe linked files return `410` with `artifact_unavailable`; replay keeps its saved financial identity and never regenerates the file. Pending financial settlement does not expose image bytes.

The bundled entry point stores private PNGs in `data/private-images/` under the project root, with generated filenames and restrictive permissions. A custom `ImageService` directory can override that location. Retain the billing database, native workflow/conversation database and image directory together when moving state. In the Autumn sandbox walkthrough the databases are under `data/autumn-sandbox/`, while images remain in `data/private-images/`. No automatic destructive cleanup runs.

## Existing local state

The generic `credits` meter funds both example resources. Local schema upgrades preserve historical financial data. Idle legacy `image-credits` balances transition once to `credits` with their exact remaining/consumed quantities. Unresolved reservations and financial operations block that transition until reconciled. Old source meters cannot spend copied credit again, and repeated setup never refills lost or spent target balances. See [existing state](billing.md#existing-state) for the full transition rules. Autumn remote balances are not migrated or seeded by this local transition.

## Verification

`npm run test:images` uses real Mastra, SQL, files and authenticated HTTP with controlled external image/model and Autumn boundaries. `npm run test:openai` is opt-in and makes one image request with the configured server profile and at most two text calls, each with a 200-output-token limit. It uses a temporary local billing database, validates and retrieves the PNG, verifies its digest and replays the same request. Its JSON output identifies the artifact digest before temporary files are removed. Live OpenAI access and monetary cost remain unverified until that command succeeds with your account.
