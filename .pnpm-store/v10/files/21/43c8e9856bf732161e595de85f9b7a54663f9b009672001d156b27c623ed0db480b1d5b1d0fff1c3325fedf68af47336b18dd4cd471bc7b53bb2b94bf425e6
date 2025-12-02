[//]: # "This README.md file is auto-generated, all changes to this file will be lost."
[//]: # "To regenerate it, use `python -m synthtool`."
<img src="https://avatars2.githubusercontent.com/u/2810941?v=3&s=96" alt="Google Cloud Platform logo" title="Google Cloud Platform" align="right" height="96" width="96"/>

# [Cloud Speech: Node.js Client](https://github.com/googleapis/google-cloud-node/tree/main/packages/google-cloud-speech)

[![release level](https://img.shields.io/badge/release%20level-stable-brightgreen.svg?style=flat)](https://cloud.google.com/terms/launch-stages)
[![npm version](https://img.shields.io/npm/v/@google-cloud/speech.svg)](https://www.npmjs.org/package/@google-cloud/speech)




Cloud Speech Client Library for Node.js


A comprehensive list of changes in each version may be found in
[the CHANGELOG](https://github.com/googleapis/google-cloud-node/tree/main/packages/google-cloud-speech/CHANGELOG.md).

* [Cloud Speech Node.js Client API Reference][client-docs]
* [Cloud Speech Documentation][product-docs]
* [github.com/googleapis/google-cloud-node/packages/google-cloud-speech](https://github.com/googleapis/google-cloud-node/tree/main/packages/google-cloud-speech)

Read more about the client libraries for Cloud APIs, including the older
Google APIs Client Libraries, in [Client Libraries Explained][explained].

[explained]: https://cloud.google.com/apis/docs/client-libraries-explained

**Table of contents:**


* [Quickstart](#quickstart)
  * [Before you begin](#before-you-begin)
  * [Installing the client library](#installing-the-client-library)
  * [Using the client library](#using-the-client-library)
* [Samples](#samples)
* [Versioning](#versioning)
* [Contributing](#contributing)
* [License](#license)

## Quickstart

### Before you begin

1.  [Select or create a Cloud Platform project][projects].
1.  [Enable the Cloud Speech API][enable_api].
1.  [Set up authentication][auth] so you can access the
    API from your local workstation.

### Installing the client library

```bash
npm install @google-cloud/speech
```


### Using the client library

```javascript
// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');

// Creates a client
const client = new speech.SpeechClient();

async function quickstart() {
  // The path to the remote LINEAR16 file
  const gcsUri = 'gs://cloud-samples-data/speech/brooklyn_bridge.raw';

  // The audio file's encoding, sample rate in hertz, and BCP-47 language code
  const audio = {
    uri: gcsUri,
  };
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
  };
  const request = {
    audio: audio,
    config: config,
  };

  // Detects speech in the audio file
  const [response] = await client.recognize(request);
  const transcription = response.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');
  console.log(`Transcription: ${transcription}`);
}
quickstart();

```



## Samples

Samples are in the [`samples/`](https://github.com/googleapis/google-cloud-node/tree/main/packages/google-cloud-speech/samples) directory. Each sample's `README.md` has instructions for running its sample.

| Sample                      | Source Code                       | Try it |
| --------------------------- | --------------------------------- | ------ |
| Adaptation.create_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.create_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.create_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.create_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.create_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.create_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.delete_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.delete_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.delete_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.delete_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.delete_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.delete_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.get_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.get_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.get_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.get_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.get_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.get_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.list_custom_classes | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.list_custom_classes.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.list_custom_classes.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.list_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.list_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.list_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.update_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.update_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.update_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.update_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/adaptation.update_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/adaptation.update_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.long_running_recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/speech.long_running_recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/speech.long_running_recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/speech.recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/speech.recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.streaming_recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1/speech.streaming_recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1/speech.streaming_recognize.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.create_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.create_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.create_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.create_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.create_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.create_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.delete_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.delete_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.delete_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.delete_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.delete_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.delete_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.get_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.get_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.get_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.get_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.get_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.get_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.list_custom_classes | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.list_custom_classes.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.list_custom_classes.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.list_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.list_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.list_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.update_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.update_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.update_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Adaptation.update_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.update_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/adaptation.update_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.long_running_recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/speech.long_running_recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/speech.long_running_recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/speech.recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/speech.recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.streaming_recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v1p1beta1/speech.streaming_recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v1p1beta1/speech.streaming_recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.batch_recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.batch_recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.batch_recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.create_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.create_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.create_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Speech.create_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.create_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.create_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.create_recognizer | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.create_recognizer.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.create_recognizer.js,packages/google-cloud-speech/samples/README.md) |
| Speech.delete_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.delete_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.delete_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Speech.delete_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.delete_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.delete_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.delete_recognizer | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.delete_recognizer.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.delete_recognizer.js,packages/google-cloud-speech/samples/README.md) |
| Speech.get_config | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.get_config.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.get_config.js,packages/google-cloud-speech/samples/README.md) |
| Speech.get_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.get_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.get_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Speech.get_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.get_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.get_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.get_recognizer | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.get_recognizer.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.get_recognizer.js,packages/google-cloud-speech/samples/README.md) |
| Speech.list_custom_classes | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.list_custom_classes.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.list_custom_classes.js,packages/google-cloud-speech/samples/README.md) |
| Speech.list_phrase_sets | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.list_phrase_sets.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.list_phrase_sets.js,packages/google-cloud-speech/samples/README.md) |
| Speech.list_recognizers | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.list_recognizers.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.list_recognizers.js,packages/google-cloud-speech/samples/README.md) |
| Speech.recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.streaming_recognize | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.streaming_recognize.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.streaming_recognize.js,packages/google-cloud-speech/samples/README.md) |
| Speech.undelete_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.undelete_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.undelete_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Speech.undelete_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.undelete_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.undelete_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.undelete_recognizer | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.undelete_recognizer.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.undelete_recognizer.js,packages/google-cloud-speech/samples/README.md) |
| Speech.update_config | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.update_config.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.update_config.js,packages/google-cloud-speech/samples/README.md) |
| Speech.update_custom_class | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.update_custom_class.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.update_custom_class.js,packages/google-cloud-speech/samples/README.md) |
| Speech.update_phrase_set | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.update_phrase_set.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.update_phrase_set.js,packages/google-cloud-speech/samples/README.md) |
| Speech.update_recognizer | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/generated/v2/speech.update_recognizer.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/generated/v2/speech.update_recognizer.js,packages/google-cloud-speech/samples/README.md) |
| Quickstart | [source code](https://github.com/googleapis/google-cloud-node/blob/main/packages/google-cloud-speech/samples/quickstart.js) | [![Open in Cloud Shell][shell_img]](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/googleapis/google-cloud-node&page=editor&open_in_editor=packages/google-cloud-speech/samples/quickstart.js,packages/google-cloud-speech/samples/README.md) |



The [Cloud Speech Node.js Client API Reference][client-docs] documentation
also contains samples.

## Supported Node.js Versions

Our client libraries follow the [Node.js release schedule](https://github.com/nodejs/release#release-schedule).
Libraries are compatible with all current _active_ and _maintenance_ versions of
Node.js.
If you are using an end-of-life version of Node.js, we recommend that you update
as soon as possible to an actively supported LTS version.

Google's client libraries support legacy versions of Node.js runtimes on a
best-efforts basis with the following warnings:

* Legacy versions are not tested in continuous integration.
* Some security patches and features cannot be backported.
* Dependencies cannot be kept up-to-date.

Client libraries targeting some end-of-life versions of Node.js are available, and
can be installed through npm [dist-tags](https://docs.npmjs.com/cli/dist-tag).
The dist-tags follow the naming convention `legacy-(version)`.
For example, `npm install @google-cloud/speech@legacy-8` installs client libraries
for versions compatible with Node.js 8.

## Versioning

This library follows [Semantic Versioning](http://semver.org/).



This library is considered to be **stable**. The code surface will not change in backwards-incompatible ways
unless absolutely necessary (e.g. because of critical security issues) or with
an extensive deprecation period. Issues and requests against **stable** libraries
are addressed with the highest priority.






More Information: [Google Cloud Platform Launch Stages][launch_stages]

[launch_stages]: https://cloud.google.com/terms/launch-stages

## Contributing

Contributions welcome! See the [Contributing Guide](https://github.com/googleapis/google-cloud-node/blob/main/CONTRIBUTING.md).

Please note that this `README.md`, the `samples/README.md`,
and a variety of configuration files in this repository (including `.nycrc` and `tsconfig.json`)
are generated from a central template. To edit one of these files, make an edit
to its templates in
[directory](https://github.com/googleapis/synthtool).

## License

Apache Version 2.0

See [LICENSE](https://github.com/googleapis/google-cloud-node/blob/main/LICENSE)

[client-docs]: https://googleapis.dev/nodejs/speech/latest
[product-docs]: https://cloud.google.com/speech-to-text/docs/
[shell_img]: https://gstatic.com/cloudssh/images/open-btn.png
[projects]: https://console.cloud.google.com/project
[billing]: https://support.google.com/cloud/answer/6293499#enable-billing
[enable_api]: https://console.cloud.google.com/flows/enableapi?apiid=speech.googleapis.com
[auth]: https://cloud.google.com/docs/authentication/external/set-up-adc-local
