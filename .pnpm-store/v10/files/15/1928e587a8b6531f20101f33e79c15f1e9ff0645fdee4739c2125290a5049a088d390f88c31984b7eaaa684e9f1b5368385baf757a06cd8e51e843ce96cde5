import type { ModelData } from "./model-data";
import type { ElasticSearchQuery } from "./model-libraries-downloads";
/**
 * Elements configurable by a model library.
 */
export interface LibraryUiElement {
    /**
     * Pretty name of the library.
     * displayed in tags, and on the main
     * call-to-action button on the model page.
     */
    prettyLabel: string;
    /**
     * Repo name of the library's (usually on GitHub) code repo
     */
    repoName: string;
    /**
     * URL to library's (usually on GitHub) code repo
     */
    repoUrl: string;
    /**
     * URL to library's docs
     */
    docsUrl?: string;
    /**
     * Code snippet(s) displayed on model page
     */
    snippets?: (model: ModelData) => string[];
    /**
     * Elastic query used to count this library's model downloads
     *
     * By default, those files are counted:
     * "config.json", "config.yaml", "hyperparams.yaml", "meta.yaml"
     */
    countDownloads?: ElasticSearchQuery;
    /**
     * should we display this library in hf.co/models filter
     * (only for popular libraries with > 100 models)
     */
    filter?: boolean;
}
/**
 * Add your new library here.
 *
 * This is for modeling (= architectures) libraries, not for file formats (like ONNX, etc).
 * (unlike libraries, file formats live in an enum inside the internal codebase.)
 *
 * Doc on how to add a library to the Hub:
 *
 * https://huggingface.co/docs/hub/models-adding-libraries
 *
 * /!\ IMPORTANT
 *
 * The key you choose is the tag your models have in their library_name on the Hub.
 */
export declare const MODEL_LIBRARIES_UI_ELEMENTS: {
    "adapter-transformers": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    allennlp: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    asteroid: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    audiocraft: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
        countDownloads: string;
    };
    audioseal: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
        snippets: (model: ModelData) => string[];
    };
    bertopic: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    big_vision: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    birefnet: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
    };
    bm25s: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
        countDownloads: string;
    };
    champ: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
    };
    chat_tts: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: () => string[];
        filter: false;
        countDownloads: string;
    };
    colpali: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    deepforest: {
        prettyLabel: string;
        repoName: string;
        docsUrl: string;
        repoUrl: string;
        countDownloads: string;
    };
    "depth-anything-v2": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
        countDownloads: string;
    };
    "depth-pro": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
        snippets: (model: ModelData) => string[];
        filter: false;
    };
    diffree: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    diffusers: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    diffusionkit: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
    };
    doctr: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
    };
    cartesia_pytorch: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
    };
    cartesia_mlx: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
    };
    cotracker: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    edsnlp: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        filter: false;
        snippets: (model: ModelData) => string[];
        countDownloads: string;
    };
    elm: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    espnet: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    fairseq: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    fastai: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    fasttext: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    flair: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    "gemma.cpp": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    gliner: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
        countDownloads: string;
    };
    "glyph-byt5": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    grok: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    hallo: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
    };
    hezar: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        countDownloads: string;
    };
    "hunyuan-dit": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
    };
    imstoucan: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
    };
    keras: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    "tf-keras": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        countDownloads: string;
    };
    "keras-nlp": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
    };
    "keras-hub": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    k2: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
    };
    liveportrait: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    "llama-cpp-python": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
    };
    "mini-omni2": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
    };
    mindspore: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
    };
    "mamba-ssm": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        snippets: (model: ModelData) => string[];
    };
    "mars5-tts": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
        snippets: (model: ModelData) => string[];
    };
    "mesh-anything": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
        snippets: () => string[];
    };
    "ml-agents": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    mlx: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    "mlx-image": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
        countDownloads: string;
    };
    "mlc-llm": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        filter: false;
        countDownloads: string;
    };
    model2vec: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
    };
    moshi: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    nemo: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    "open-oasis": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
    };
    open_clip: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    paddlenlp: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    peft: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    pxia: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
    };
    "pyannote-audio": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    "py-feat": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        filter: false;
    };
    pythae: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
    };
    recurrentgemma: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    relik: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: false;
    };
    refiners: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        filter: false;
        countDownloads: string;
    };
    reverb: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
    };
    saelens: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: () => string[];
        filter: false;
    };
    sam2: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        snippets: (model: ModelData) => string[];
        countDownloads: string;
    };
    "sample-factory": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    sapiens: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    "sentence-transformers": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    setfit: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    sklearn: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    spacy: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    "span-marker": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    speechbrain: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    "ssr-speech": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    "stable-audio-tools": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
        snippets: (model: ModelData) => string[];
    };
    "diffusion-single-file": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    "seed-story": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
        snippets: () => string[];
    };
    soloaudio: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    "stable-baselines3": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    stanza: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    "f5-tts": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    genmo: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    tensorflowtts: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: (model: ModelData) => string[];
    };
    "tic-clip": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    timesfm: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
    };
    timm: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
        countDownloads: string;
    };
    transformers: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    "transformers.js": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
        filter: true;
    };
    "unity-sentis": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        snippets: () => string[];
        filter: true;
        countDownloads: string;
    };
    "vfi-mamba": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        countDownloads: string;
        snippets: (model: ModelData) => string[];
    };
    voicecraft: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
    };
    yolov10: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: (model: ModelData) => string[];
    };
    whisperkit: {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        docsUrl: string;
        snippets: () => string[];
        countDownloads: string;
    };
    "3dtopia-xl": {
        prettyLabel: string;
        repoName: string;
        repoUrl: string;
        filter: false;
        countDownloads: string;
        snippets: (model: ModelData) => string[];
    };
};
export type ModelLibraryKey = keyof typeof MODEL_LIBRARIES_UI_ELEMENTS;
export declare const ALL_MODEL_LIBRARY_KEYS: ("adapter-transformers" | "allennlp" | "asteroid" | "audiocraft" | "audioseal" | "bertopic" | "big_vision" | "birefnet" | "bm25s" | "champ" | "chat_tts" | "colpali" | "deepforest" | "depth-anything-v2" | "depth-pro" | "diffree" | "diffusers" | "diffusionkit" | "doctr" | "cartesia_pytorch" | "cartesia_mlx" | "cotracker" | "edsnlp" | "elm" | "espnet" | "fairseq" | "fastai" | "fasttext" | "flair" | "gemma.cpp" | "gliner" | "glyph-byt5" | "grok" | "hallo" | "hezar" | "hunyuan-dit" | "imstoucan" | "keras" | "tf-keras" | "keras-nlp" | "keras-hub" | "k2" | "liveportrait" | "llama-cpp-python" | "mini-omni2" | "mindspore" | "mamba-ssm" | "mars5-tts" | "mesh-anything" | "ml-agents" | "mlx" | "mlx-image" | "mlc-llm" | "model2vec" | "moshi" | "nemo" | "open-oasis" | "open_clip" | "paddlenlp" | "peft" | "pxia" | "pyannote-audio" | "py-feat" | "pythae" | "recurrentgemma" | "relik" | "refiners" | "reverb" | "saelens" | "sam2" | "sample-factory" | "sapiens" | "sentence-transformers" | "setfit" | "sklearn" | "spacy" | "span-marker" | "speechbrain" | "ssr-speech" | "stable-audio-tools" | "diffusion-single-file" | "seed-story" | "soloaudio" | "stable-baselines3" | "stanza" | "f5-tts" | "genmo" | "tensorflowtts" | "tic-clip" | "timesfm" | "timm" | "transformers" | "transformers.js" | "unity-sentis" | "vfi-mamba" | "voicecraft" | "yolov10" | "whisperkit" | "3dtopia-xl")[];
export declare const ALL_DISPLAY_MODEL_LIBRARY_KEYS: ("adapter-transformers" | "allennlp" | "asteroid" | "audiocraft" | "audioseal" | "bertopic" | "big_vision" | "birefnet" | "bm25s" | "champ" | "chat_tts" | "colpali" | "deepforest" | "depth-anything-v2" | "depth-pro" | "diffree" | "diffusers" | "diffusionkit" | "doctr" | "cartesia_pytorch" | "cartesia_mlx" | "cotracker" | "edsnlp" | "elm" | "espnet" | "fairseq" | "fastai" | "fasttext" | "flair" | "gemma.cpp" | "gliner" | "glyph-byt5" | "grok" | "hallo" | "hezar" | "hunyuan-dit" | "imstoucan" | "keras" | "tf-keras" | "keras-nlp" | "keras-hub" | "k2" | "liveportrait" | "llama-cpp-python" | "mini-omni2" | "mindspore" | "mamba-ssm" | "mars5-tts" | "mesh-anything" | "ml-agents" | "mlx" | "mlx-image" | "mlc-llm" | "model2vec" | "moshi" | "nemo" | "open-oasis" | "open_clip" | "paddlenlp" | "peft" | "pxia" | "pyannote-audio" | "py-feat" | "pythae" | "recurrentgemma" | "relik" | "refiners" | "reverb" | "saelens" | "sam2" | "sample-factory" | "sapiens" | "sentence-transformers" | "setfit" | "sklearn" | "spacy" | "span-marker" | "speechbrain" | "ssr-speech" | "stable-audio-tools" | "diffusion-single-file" | "seed-story" | "soloaudio" | "stable-baselines3" | "stanza" | "f5-tts" | "genmo" | "tensorflowtts" | "tic-clip" | "timesfm" | "timm" | "transformers" | "transformers.js" | "unity-sentis" | "vfi-mamba" | "voicecraft" | "yolov10" | "whisperkit" | "3dtopia-xl")[];
//# sourceMappingURL=model-libraries.d.ts.map