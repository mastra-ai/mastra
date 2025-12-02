# 🤗 Hugging Face Hub API

Official utilities to use the Hugging Face Hub API.

## Install

```console
pnpm add @huggingface/hub

npm add @huggingface/hub

yarn add @huggingface/hub
```

### Deno

```ts
// esm.sh
import { uploadFiles, listModels } from "https://esm.sh/@huggingface/hub"
// or npm:
import { uploadFiles, listModels } from "npm:@huggingface/hub"
```

Check out the [full documentation](https://huggingface.co/docs/huggingface.js/hub/README).

## Usage

For some of the calls, you need to create an account and generate an [access token](https://huggingface.co/settings/tokens).

Learn how to find free models using the hub package in this [interactive tutorial](https://scrimba.com/scrim/c7BbVPcd?pl=pkVnrP7uP).

```ts
import { createRepo, uploadFiles, uploadFilesWithProgress, deleteFile, deleteRepo, listFiles, whoAmI } from "@huggingface/hub";
import type { RepoDesignation, Credentials } from "@huggingface/hub";

const repo: RepoDesignation = { type: "model", name: "myname/some-model" };
const credentials: Credentials = { accessToken: "hf_..." };

const {name: username} = await whoAmI({credentials});

for await (const model of listModels({search: {owner: username}, credentials})) {
  console.log("My model:", model);
}

await createRepo({ repo, credentials, license: "mit" });

await uploadFiles({
  repo,
  credentials,
  files: [
    // path + blob content
    {
      path: "file.txt",
      content: new Blob(["Hello World"]),
    },
    // Local file URL
    pathToFileURL("./pytorch-model.bin"),
    // Web URL
    new URL("https://huggingface.co/xlm-roberta-base/resolve/main/tokenizer.json"),
    // Path + Web URL
    {
      path: "myfile.bin",
      content: new URL("https://huggingface.co/bert-base-uncased/resolve/main/pytorch_model.bin")
    }
    // Can also work with native File in browsers
  ],
});

// or

for await (const progressEvent of await uploadFilesWithProgress({
  repo,
  credentials,
  files: [
    ...
  ],
})) {
  console.log(progressEvent);
}

await deleteFile({repo, credentials, path: "myfile.bin"});

await (await downloadFile({ repo, path: "README.md" })).text();

for await (const fileInfo of listFiles({repo})) {
  console.log(fileInfo);
}

await deleteRepo({ repo, credentials });
```

## OAuth Login

It's possible to login using OAuth (["Sign in with HF"](https://huggingface.co/docs/hub/oauth)).

This will allow you get an access token to use some of the API, depending on the scopes set inside the Space or the OAuth App.

```ts
import { oauthLoginUrl, oauthHandleRedirectIfPresent } from "@huggingface/hub";

const oauthResult = await oauthHandleRedirectIfPresent();

if (!oauthResult) {
  // If the user is not logged in, redirect to the login page
  window.location.href = await oauthLoginUrl();
}

// You can use oauthResult.accessToken, oauthResult.accessTokenExpiresAt and oauthResult.userInfo
console.log(oauthResult);
```

Checkout the demo: https://huggingface.co/spaces/huggingfacejs/client-side-oauth

## Performance considerations

When uploading large files, you may want to run the `commit` calls inside a worker, to offload the sha256 computations.

Remote resources and local files should be passed as `URL` whenever it's possible so they can be lazy loaded in chunks to reduce RAM usage. Passing a `File` inside the browser's context is fine, because it natively behaves as a `Blob`.

Under the hood, `@huggingface/hub` uses a lazy blob implementation to load the file.

## Dependencies

- `@huggingface/tasks` : Typings only
