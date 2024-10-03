export const comments = {
  "speechhistoryGetGeneratedAudioMetadata": {
    "comment": "Get Generated Items",
    "doc": "Get Generated Items\n  Returns metadata about all your generated audio."
  },
  "speechhistoryGetHistoryItemById": {
    "comment": "Get History Item By Id",
    "doc": "Get History Item By Id\n  Returns information about an history item by its ID."
  },
  "speechhistoryDeleteHistoryItemById": {
    "comment": "Delete History Item",
    "doc": "Delete History Item\n  Delete a history item by its ID"
  },
  "speechhistoryGetHistoryItemAudio": {
    "comment": "Get Audio From History Item",
    "doc": "Get Audio From History Item\n  Returns the audio of an history item."
  },
  "speechhistoryDownloadHistoryItems": {
    "comment": "Download History Items",
    "doc": "Download History Items\n  Download one or more history items. If one history item ID is provided, we will return a single audio file. If more than one history item IDs are provided, we will provide the history items packed into a .zip file."
  },
  "samplesRemoveById": {
    "comment": "Delete Sample",
    "doc": "Delete Sample\n  Removes a sample by its ID."
  },
  "samplesGetAudioFromSample": {
    "comment": "Get Audio From Sample",
    "doc": "Get Audio From Sample\n  Returns the audio corresponding to a sample attached to a voice."
  },
  "texttospeechConvertTextToSpeech": {
    "comment": "Text To Speech",
    "doc": "Text To Speech\n  Converts text into speech using a voice of your choice and returns audio."
  },
  "texttospeechConvertTextToSpeechStream": {
    "comment": "Text To Speech",
    "doc": "Text To Speech\n  Converts text into speech using a voice of your choice and returns audio as an audio stream."
  },
  "speechtospeechCreateWithVoice": {
    "comment": "Speech To Speech",
    "doc": "Speech To Speech\n  Create speech by combining the content and emotion of the uploaded audio with a voice of your choice."
  },
  "speechtospeechCreateWithVoice1": {
    "comment": "Speech To Speech Streaming",
    "doc": "Speech To Speech Streaming\n  Create speech by combining the content and emotion of the uploaded audio with a voice of your choice and returns an audio stream."
  },
  "voicegenerationGetVoiceGenerationParameters": {
    "comment": "Voice Generation Parameters",
    "doc": "Voice Generation Parameters\n  Get possible parameters for the /v1/voice-generation/generate-voice endpoint."
  },
  "voicegenerationGenerateRandomVoice": {
    "comment": "Generate A Random Voice",
    "doc": "Generate A Random Voice\n  Generate a random voice based on parameters. This method returns a generated_voice_id in the response header, and a sample of the voice in the body. If you like the generated voice call /v1/voice-generation/create-voice with the generated_voice_id to create the voice."
  },
  "voicegenerationCreateVoice": {
    "comment": "Create A Previously Generated Voice",
    "doc": "Create A Previously Generated Voice\n  Create a previously generated voice. This endpoint should be called after you fetched a generated_voice_id using /v1/voice-generation/generate-voice."
  },
  "userGetSubscriptionInfo": {
    "comment": "Get User Subscription Info",
    "doc": "Get User Subscription Info\n  Gets extended information about the users subscription"
  },
  "userGetInfo": {
    "comment": "Get User Info",
    "doc": "Get User Info\n  Gets information about the user"
  },
  "voicesListAllVoices": {
    "comment": "Get Voices",
    "doc": "Get Voices\n  Gets a list of all available voices for a user."
  },
  "voicesGetDefaultVoiceSettings": {
    "comment": "Get Default Voice Settings.",
    "doc": "Get Default Voice Settings.\n  Gets the default settings for voices. \"similarity_boost\" corresponds to\"Clarity + Similarity Enhancement\" in the web app and \"stability\" corresponds to \"Stability\" slider in the web app."
  },
  "voicesGetSettings": {
    "comment": "Get Voice Settings",
    "doc": "Get Voice Settings\n  Returns the settings for a specific voice. \"similarity_boost\" corresponds to\"Clarity + Similarity Enhancement\" in the web app and \"stability\" corresponds to \"Stability\" slider in the web app."
  },
  "voicesGetVoiceMetadata": {
    "comment": "Get Voice",
    "doc": "Get Voice\n  Returns metadata about a specific voice."
  },
  "voicesDeleteById": {
    "comment": "Delete Voice",
    "doc": "Delete Voice\n  Deletes a voice by its ID."
  },
  "voicesEditSettingsPost": {
    "comment": "Edit Voice Settings",
    "doc": "Edit Voice Settings\n  Edit your settings for a specific voice. \"similarity_boost\" corresponds to\"Clarity + Similarity Enhancement\" in the web app and \"stability\" corresponds to \"Stability\" slider in the web app."
  },
  "voicesAddVoiceToCollection": {
    "comment": "Add Voice",
    "doc": "Add Voice\n  Add a new voice to your collection of voices in VoiceLab."
  },
  "voicesUpdateVoiceById": {
    "comment": "Edit Voice",
    "doc": "Edit Voice\n  Edit a voice created by you."
  },
  "voicesAddToCollection": {
    "comment": "Add Sharing Voice",
    "doc": "Add Sharing Voice\n  Add a sharing voice to your collection of voices in VoiceLab."
  },
  "projectsGetAllProjects": {
    "comment": "Get Projects",
    "doc": "Get Projects\n  Returns a list of your projects together and its metadata."
  },
  "projectsCreateNewProject": {
    "comment": "Add Project",
    "doc": "Add Project\n  Creates a new project, it can be either initialized as blank, from a document or from a URL."
  },
  "projectsGetById": {
    "comment": "Get Project By Id",
    "doc": "Get Project By Id\n  Returns information about a specific project. This endpoint returns more detailed information about a project than GET api.elevenlabs.io/v1/projects."
  },
  "projectsDeleteById": {
    "comment": "Delete Project",
    "doc": "Delete Project\n  Delete a project by its project_id."
  },
  "projectsStartConversion": {
    "comment": "Convert Project",
    "doc": "Convert Project\n  Starts conversion of a project and all of its chapters."
  },
  "projectsListSnapshots": {
    "comment": "Get Project Snapshots",
    "doc": "Get Project Snapshots\n  Gets the snapshots of a project."
  },
  "projectsStreamAudioFromSnapshot": {
    "comment": "Stream Project Audio",
    "doc": "Stream Project Audio\n  Stream the audio from a project snapshot."
  },
  "projectsStreamArchiveWithAudio": {
    "comment": "Streams Archive With Project Audio",
    "doc": "Streams Archive With Project Audio\n  Streams archive with project audio."
  },
  "projectsListChapters": {
    "comment": "Get Chapters",
    "doc": "Get Chapters\n  Returns a list of your chapters for a project together and its metadata."
  },
  "projectsGetChapterById": {
    "comment": "Get Chapter By Id",
    "doc": "Get Chapter By Id\n  Returns information about a specific chapter."
  },
  "projectsDeleteChapterById": {
    "comment": "Delete Chapter",
    "doc": "Delete Chapter\n  Delete a chapter by its chapter_id."
  },
  "projectsStartChapterConversion": {
    "comment": "Convert Chapter",
    "doc": "Convert Chapter\n  Starts conversion of a specific chapter."
  },
  "projectsGetChapterSnapshots": {
    "comment": "Get Chapter Snapshots",
    "doc": "Get Chapter Snapshots\n  Gets information about all the snapshots of a chapter, each snapshot corresponds can be downloaded as audio. Whenever a chapter is converted a snapshot will be automatically created."
  },
  "projectsStreamAudioFromSnapshotPost": {
    "comment": "Stream Chapter Audio",
    "doc": "Stream Chapter Audio\n  Stream the audio from a chapter snapshot. Use `GET /v1/projects/{project_id}/chapters/{chapter_id}/snapshots` to return the chapter snapshots of a chapter."
  },
  "projectsUpdatePronunciationDictionaries": {
    "comment": "Update Pronunciation Dictionaries",
    "doc": "Update Pronunciation Dictionaries\n  Updates the set of pronunciation dictionaries acting on a project. This will automatically mark text within this project as requiring reconverting where the new dictionary would apply or the old one no longer does."
  },
  "dubbingFileInLanguage": {
    "comment": "Dub A Video Or An Audio File",
    "doc": "Dub A Video Or An Audio File\n  Dubs provided audio or video file into given language."
  },
  "dubbingGetProjectMetadata": {
    "comment": "Get Dubbing Project Metadata",
    "doc": "Get Dubbing Project Metadata\n  Returns metadata about a dubbing project, including whether it's still in progress or not"
  },
  "dubbingDeleteProject": {
    "comment": "Delete Dubbing Project",
    "doc": "Delete Dubbing Project\n  Deletes a dubbing project."
  },
  "dubbingGetFile": {
    "comment": "Get Dubbed File",
    "doc": "Get Dubbed File\n  Returns dubbed file as a streamed file. Videos will be returned in MP4 format and audio only dubs will be returned in MP3."
  },
  "workspaceGetSsoProviderAdmin": {
    "comment": "Get Sso Provider Admin",
    "doc": "Get Sso Provider Admin"
  },
  "modelsListAvailableModels": {
    "comment": "Get Models",
    "doc": "Get Models\n  Gets a list of available models."
  },
  "audionativeCreateProjectWithEmbeddableHtml": {
    "comment": "Creates Audionative Enabled Project.",
    "doc": "Creates Audionative Enabled Project.\n  Creates AudioNative enabled project, optionally starts conversion and returns project id and embeddable html snippet."
  },
  "voicesGetSharedVoices": {
    "comment": "Get Voices",
    "doc": "Get Voices\n  Gets a list of shared voices."
  },
  "pronunciationDictionaryCreateFromFile": {
    "comment": "Add A Pronunciation Dictionary",
    "doc": "Add A Pronunciation Dictionary\n  Creates a new pronunciation dictionary from a lexicon .PLS file"
  },
  "pronunciationDictionaryAddRules": {
    "comment": "Add Rules To The Pronunciation Dictionary",
    "doc": "Add Rules To The Pronunciation Dictionary\n  Add rules to the pronunciation dictionary"
  },
  "pronunciationDictionaryRemoveRules": {
    "comment": "Remove Rules From The Pronunciation Dictionary",
    "doc": "Remove Rules From The Pronunciation Dictionary\n  Remove rules from the pronunciation dictionary"
  },
  "pronunciationDictionaryVersionDownload": {
    "comment": "Get Pls File With A Pronunciation Dictionary Version Rules",
    "doc": "Get Pls File With A Pronunciation Dictionary Version Rules\n  Get PLS file with a pronunciation dictionary version rules"
  },
  "redirectToMintlifyDocsGet": {
    "comment": "Redirect To Mintlify",
    "doc": "Redirect To Mintlify"
  },
  "pronunciationDictionaryGetMetadata": {
    "comment": "Get Metadata For A Pronunciation Dictionary",
    "doc": "Get Metadata For A Pronunciation Dictionary\n  Get metadata for a pronunciation dictionary"
  },
  "pronunciationDictionaryListDictionaries": {
    "comment": "Get Pronunciation Dictionaries",
    "doc": "Get Pronunciation Dictionaries\n  Get a list of the pronunciation dictionaries you have access to and their metadata"
  }
}