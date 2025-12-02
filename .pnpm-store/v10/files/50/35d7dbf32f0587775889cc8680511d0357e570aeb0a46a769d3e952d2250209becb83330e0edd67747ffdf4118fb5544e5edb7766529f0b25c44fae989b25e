import * as snippets from "./model-libraries-snippets";
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

export const MODEL_LIBRARIES_UI_ELEMENTS = {
	"adapter-transformers": {
		prettyLabel: "Adapters",
		repoName: "adapters",
		repoUrl: "https://github.com/Adapter-Hub/adapters",
		docsUrl: "https://huggingface.co/docs/hub/adapters",
		snippets: snippets.adapters,
		filter: true,
		countDownloads: `path:"adapter_config.json"`,
	},
	allennlp: {
		prettyLabel: "AllenNLP",
		repoName: "AllenNLP",
		repoUrl: "https://github.com/allenai/allennlp",
		docsUrl: "https://huggingface.co/docs/hub/allennlp",
		snippets: snippets.allennlp,
		filter: true,
	},
	asteroid: {
		prettyLabel: "Asteroid",
		repoName: "Asteroid",
		repoUrl: "https://github.com/asteroid-team/asteroid",
		docsUrl: "https://huggingface.co/docs/hub/asteroid",
		snippets: snippets.asteroid,
		filter: true,
		countDownloads: `path:"pytorch_model.bin"`,
	},
	audiocraft: {
		prettyLabel: "Audiocraft",
		repoName: "audiocraft",
		repoUrl: "https://github.com/facebookresearch/audiocraft",
		snippets: snippets.audiocraft,
		filter: false,
		countDownloads: `path:"state_dict.bin"`,
	},
	audioseal: {
		prettyLabel: "AudioSeal",
		repoName: "audioseal",
		repoUrl: "https://github.com/facebookresearch/audioseal",
		filter: false,
		countDownloads: `path_extension:"pth"`,
		snippets: snippets.audioseal,
	},
	bertopic: {
		prettyLabel: "BERTopic",
		repoName: "BERTopic",
		repoUrl: "https://github.com/MaartenGr/BERTopic",
		snippets: snippets.bertopic,
		filter: true,
	},
	big_vision: {
		prettyLabel: "Big Vision",
		repoName: "big_vision",
		repoUrl: "https://github.com/google-research/big_vision",
		filter: false,
		countDownloads: `path_extension:"npz"`,
	},
	birefnet: {
		prettyLabel: "BiRefNet",
		repoName: "BiRefNet",
		repoUrl: "https://github.com/ZhengPeng7/BiRefNet",
		snippets: snippets.birefnet,
		filter: false,
	},
	bm25s: {
		prettyLabel: "BM25S",
		repoName: "bm25s",
		repoUrl: "https://github.com/xhluca/bm25s",
		snippets: snippets.bm25s,
		filter: false,
		countDownloads: `path:"params.index.json"`,
	},
	champ: {
		prettyLabel: "Champ",
		repoName: "Champ",
		repoUrl: "https://github.com/fudan-generative-vision/champ",
		countDownloads: `path:"champ/motion_module.pth"`,
	},
	chat_tts: {
		prettyLabel: "ChatTTS",
		repoName: "ChatTTS",
		repoUrl: "https://github.com/2noise/ChatTTS.git",
		snippets: snippets.chattts,
		filter: false,
		countDownloads: `path:"asset/GPT.pt"`,
	},
	colpali: {
		prettyLabel: "ColPali",
		repoName: "ColPali",
		repoUrl: "https://github.com/ManuelFay/colpali",
		filter: false,
		countDownloads: `path:"adapter_config.json"`,
	},
	deepforest: {
		prettyLabel: "DeepForest",
		repoName: "deepforest",
		docsUrl: "https://deepforest.readthedocs.io/en/latest/",
		repoUrl: "https://github.com/weecology/DeepForest",
		countDownloads: `path_extension:"pt" OR path_extension:"pl"`,
	},
	"depth-anything-v2": {
		prettyLabel: "DepthAnythingV2",
		repoName: "Depth Anything V2",
		repoUrl: "https://github.com/DepthAnything/Depth-Anything-V2",
		snippets: snippets.depth_anything_v2,
		filter: false,
		countDownloads: `path_extension:"pth"`,
	},
	"depth-pro": {
		prettyLabel: "Depth Pro",
		repoName: "Depth Pro",
		repoUrl: "https://github.com/apple/ml-depth-pro",
		countDownloads: `path_extension:"pt"`,
		snippets: snippets.depth_pro,
		filter: false,
	},
	diffree: {
		prettyLabel: "Diffree",
		repoName: "Diffree",
		repoUrl: "https://github.com/OpenGVLab/Diffree",
		filter: false,
		countDownloads: `path:"diffree-step=000010999.ckpt"`,
	},
	diffusers: {
		prettyLabel: "Diffusers",
		repoName: "🤗/diffusers",
		repoUrl: "https://github.com/huggingface/diffusers",
		docsUrl: "https://huggingface.co/docs/hub/diffusers",
		snippets: snippets.diffusers,
		filter: true,
		/// diffusers has its own more complex "countDownloads" query
	},
	diffusionkit: {
		prettyLabel: "DiffusionKit",
		repoName: "DiffusionKit",
		repoUrl: "https://github.com/argmaxinc/DiffusionKit",
		snippets: snippets.diffusionkit,
	},
	doctr: {
		prettyLabel: "docTR",
		repoName: "doctr",
		repoUrl: "https://github.com/mindee/doctr",
	},
	cartesia_pytorch: {
		prettyLabel: "Cartesia Pytorch",
		repoName: "Cartesia Pytorch",
		repoUrl: "https://github.com/cartesia-ai/cartesia_pytorch",
		snippets: snippets.cartesia_pytorch,
	},
	cartesia_mlx: {
		prettyLabel: "Cartesia MLX",
		repoName: "Cartesia MLX",
		repoUrl: "https://github.com/cartesia-ai/cartesia_mlx",
		snippets: snippets.cartesia_mlx,
	},
	cotracker: {
		prettyLabel: "CoTracker",
		repoName: "CoTracker",
		repoUrl: "https://github.com/facebookresearch/co-tracker",
		filter: false,
		countDownloads: `path_extension:"pth"`,
	},
	edsnlp: {
		prettyLabel: "EDS-NLP",
		repoName: "edsnlp",
		repoUrl: "https://github.com/aphp/edsnlp",
		docsUrl: "https://aphp.github.io/edsnlp/latest/",
		filter: false,
		snippets: snippets.edsnlp,
		countDownloads: `path_filename:"config" AND path_extension:"cfg"`,
	},
	elm: {
		prettyLabel: "ELM",
		repoName: "elm",
		repoUrl: "https://github.com/slicex-ai/elm",
		filter: false,
		countDownloads: `path_filename:"slicex_elm_config" AND path_extension:"json"`,
	},
	espnet: {
		prettyLabel: "ESPnet",
		repoName: "ESPnet",
		repoUrl: "https://github.com/espnet/espnet",
		docsUrl: "https://huggingface.co/docs/hub/espnet",
		snippets: snippets.espnet,
		filter: true,
	},
	fairseq: {
		prettyLabel: "Fairseq",
		repoName: "fairseq",
		repoUrl: "https://github.com/pytorch/fairseq",
		snippets: snippets.fairseq,
		filter: true,
	},
	fastai: {
		prettyLabel: "fastai",
		repoName: "fastai",
		repoUrl: "https://github.com/fastai/fastai",
		docsUrl: "https://huggingface.co/docs/hub/fastai",
		snippets: snippets.fastai,
		filter: true,
	},
	fasttext: {
		prettyLabel: "fastText",
		repoName: "fastText",
		repoUrl: "https://fasttext.cc/",
		snippets: snippets.fasttext,
		filter: true,
		countDownloads: `path_extension:"bin"`,
	},
	flair: {
		prettyLabel: "Flair",
		repoName: "Flair",
		repoUrl: "https://github.com/flairNLP/flair",
		docsUrl: "https://huggingface.co/docs/hub/flair",
		snippets: snippets.flair,
		filter: true,
		countDownloads: `path:"pytorch_model.bin"`,
	},
	"gemma.cpp": {
		prettyLabel: "gemma.cpp",
		repoName: "gemma.cpp",
		repoUrl: "https://github.com/google/gemma.cpp",
		filter: false,
		countDownloads: `path_extension:"sbs"`,
	},
	gliner: {
		prettyLabel: "GLiNER",
		repoName: "GLiNER",
		repoUrl: "https://github.com/urchade/GLiNER",
		snippets: snippets.gliner,
		filter: false,
		countDownloads: `path:"gliner_config.json"`,
	},
	"glyph-byt5": {
		prettyLabel: "Glyph-ByT5",
		repoName: "Glyph-ByT5",
		repoUrl: "https://github.com/AIGText/Glyph-ByT5",
		filter: false,
		countDownloads: `path:"checkpoints/byt5_model.pt"`,
	},
	grok: {
		prettyLabel: "Grok",
		repoName: "Grok",
		repoUrl: "https://github.com/xai-org/grok-1",
		filter: false,
		countDownloads: `path:"ckpt/tensor00000_000" OR path:"ckpt-0/tensor00000_000"`,
	},
	hallo: {
		prettyLabel: "Hallo",
		repoName: "Hallo",
		repoUrl: "https://github.com/fudan-generative-vision/hallo",
		countDownloads: `path:"hallo/net.pth"`,
	},
	hezar: {
		prettyLabel: "Hezar",
		repoName: "Hezar",
		repoUrl: "https://github.com/hezarai/hezar",
		docsUrl: "https://hezarai.github.io/hezar",
		countDownloads: `path:"model_config.yaml" OR path:"embedding/embedding_config.yaml"`,
	},
	"hunyuan-dit": {
		prettyLabel: "HunyuanDiT",
		repoName: "HunyuanDiT",
		repoUrl: "https://github.com/Tencent/HunyuanDiT",
		countDownloads: `path:"pytorch_model_ema.pt" OR path:"pytorch_model_distill.pt"`,
	},
	imstoucan: {
		prettyLabel: "IMS Toucan",
		repoName: "IMS-Toucan",
		repoUrl: "https://github.com/DigitalPhonetics/IMS-Toucan",
		countDownloads: `path:"embedding_gan.pt" OR path:"Vocoder.pt" OR path:"ToucanTTS.pt"`,
	},
	keras: {
		prettyLabel: "Keras",
		repoName: "Keras",
		repoUrl: "https://github.com/keras-team/keras",
		docsUrl: "https://huggingface.co/docs/hub/keras",
		snippets: snippets.keras,
		filter: true,
		countDownloads: `path:"config.json" OR path_extension:"keras"`,
	},
	"tf-keras": {
		// Legacy "Keras 2" library (tensorflow-only)
		prettyLabel: "TF-Keras",
		repoName: "TF-Keras",
		repoUrl: "https://github.com/keras-team/tf-keras",
		docsUrl: "https://huggingface.co/docs/hub/tf-keras",
		snippets: snippets.tf_keras,
		countDownloads: `path:"saved_model.pb"`,
	},
	"keras-nlp": {
		prettyLabel: "KerasNLP",
		repoName: "KerasNLP",
		repoUrl: "https://github.com/keras-team/keras-nlp",
		docsUrl: "https://keras.io/keras_nlp/",
		snippets: snippets.keras_nlp,
	},
	"keras-hub": {
		prettyLabel: "KerasHub",
		repoName: "KerasHub",
		repoUrl: "https://github.com/keras-team/keras-hub",
		docsUrl: "https://keras.io/keras_hub/",
		snippets: snippets.keras_hub,
		filter: true,
	},
	k2: {
		prettyLabel: "K2",
		repoName: "k2",
		repoUrl: "https://github.com/k2-fsa/k2",
	},
	liveportrait: {
		prettyLabel: "LivePortrait",
		repoName: "LivePortrait",
		repoUrl: "https://github.com/KwaiVGI/LivePortrait",
		filter: false,
		countDownloads: `path:"liveportrait/landmark.onnx"`,
	},
	"llama-cpp-python": {
		prettyLabel: "llama-cpp-python",
		repoName: "llama-cpp-python",
		repoUrl: "https://github.com/abetlen/llama-cpp-python",
		snippets: snippets.llama_cpp_python,
	},
	"mini-omni2": {
		prettyLabel: "Mini-Omni2",
		repoName: "Mini-Omni2",
		repoUrl: "https://github.com/gpt-omni/mini-omni2",
		countDownloads: `path:"model_config.yaml"`,
	},
	mindspore: {
		prettyLabel: "MindSpore",
		repoName: "mindspore",
		repoUrl: "https://github.com/mindspore-ai/mindspore",
	},
	"mamba-ssm": {
		prettyLabel: "MambaSSM",
		repoName: "MambaSSM",
		repoUrl: "https://github.com/state-spaces/mamba",
		filter: false,
		snippets: snippets.mamba_ssm,
	},
	"mars5-tts": {
		prettyLabel: "MARS5-TTS",
		repoName: "MARS5-TTS",
		repoUrl: "https://github.com/Camb-ai/MARS5-TTS",
		filter: false,
		countDownloads: `path:"mars5_ar.safetensors"`,
		snippets: snippets.mars5_tts,
	},
	"mesh-anything": {
		prettyLabel: "MeshAnything",
		repoName: "MeshAnything",
		repoUrl: "https://github.com/buaacyw/MeshAnything",
		filter: false,
		countDownloads: `path:"MeshAnything_350m.pth"`,
		snippets: snippets.mesh_anything,
	},
	"ml-agents": {
		prettyLabel: "ml-agents",
		repoName: "ml-agents",
		repoUrl: "https://github.com/Unity-Technologies/ml-agents",
		docsUrl: "https://huggingface.co/docs/hub/ml-agents",
		snippets: snippets.mlAgents,
		filter: true,
		countDownloads: `path_extension:"onnx"`,
	},
	mlx: {
		prettyLabel: "MLX",
		repoName: "MLX",
		repoUrl: "https://github.com/ml-explore/mlx-examples/tree/main",
		snippets: snippets.mlx,
		filter: true,
	},
	"mlx-image": {
		prettyLabel: "mlx-image",
		repoName: "mlx-image",
		repoUrl: "https://github.com/riccardomusmeci/mlx-image",
		docsUrl: "https://huggingface.co/docs/hub/mlx-image",
		snippets: snippets.mlxim,
		filter: false,
		countDownloads: `path:"model.safetensors"`,
	},
	"mlc-llm": {
		prettyLabel: "MLC-LLM",
		repoName: "MLC-LLM",
		repoUrl: "https://github.com/mlc-ai/mlc-llm",
		docsUrl: "https://llm.mlc.ai/docs/",
		filter: false,
		countDownloads: `path:"mlc-chat-config.json"`,
	},
	model2vec: {
		prettyLabel: "Model2Vec",
		repoName: "model2vec",
		repoUrl: "https://github.com/MinishLab/model2vec",
		snippets: snippets.model2vec,
		filter: false,
	},
	moshi: {
		prettyLabel: "Moshi",
		repoName: "Moshi",
		repoUrl: "https://github.com/kyutai-labs/moshi",
		filter: false,
		countDownloads: `path:"tokenizer-e351c8d8-checkpoint125.safetensors"`,
	},
	nemo: {
		prettyLabel: "NeMo",
		repoName: "NeMo",
		repoUrl: "https://github.com/NVIDIA/NeMo",
		snippets: snippets.nemo,
		filter: true,
		countDownloads: `path_extension:"nemo" OR path:"model_config.yaml"`,
	},
	"open-oasis": {
		prettyLabel: "open-oasis",
		repoName: "open-oasis",
		repoUrl: "https://github.com/etched-ai/open-oasis",
		countDownloads: `path:"oasis500m.pt"`,
	},
	open_clip: {
		prettyLabel: "OpenCLIP",
		repoName: "OpenCLIP",
		repoUrl: "https://github.com/mlfoundations/open_clip",
		snippets: snippets.open_clip,
		filter: true,
		countDownloads: `path_extension:"bin" AND path_filename:*pytorch_model`,
	},
	paddlenlp: {
		prettyLabel: "paddlenlp",
		repoName: "PaddleNLP",
		repoUrl: "https://github.com/PaddlePaddle/PaddleNLP",
		docsUrl: "https://huggingface.co/docs/hub/paddlenlp",
		snippets: snippets.paddlenlp,
		filter: true,
		countDownloads: `path:"model_config.json"`,
	},
	peft: {
		prettyLabel: "PEFT",
		repoName: "PEFT",
		repoUrl: "https://github.com/huggingface/peft",
		snippets: snippets.peft,
		filter: true,
		countDownloads: `path:"adapter_config.json"`,
	},
	pxia: {
		prettyLabel: "pxia",
		repoName: "pxia",
		repoUrl: "https://github.com/not-lain/pxia",
		snippets: snippets.pxia,
		filter: false,
	},
	"pyannote-audio": {
		prettyLabel: "pyannote.audio",
		repoName: "pyannote-audio",
		repoUrl: "https://github.com/pyannote/pyannote-audio",
		snippets: snippets.pyannote_audio,
		filter: true,
	},
	"py-feat": {
		prettyLabel: "Py-Feat",
		repoName: "Py-Feat",
		repoUrl: "https://github.com/cosanlab/py-feat",
		docsUrl: "https://py-feat.org/",
		filter: false,
	},
	pythae: {
		prettyLabel: "pythae",
		repoName: "pythae",
		repoUrl: "https://github.com/clementchadebec/benchmark_VAE",
		snippets: snippets.pythae,
		filter: false,
	},
	recurrentgemma: {
		prettyLabel: "RecurrentGemma",
		repoName: "recurrentgemma",
		repoUrl: "https://github.com/google-deepmind/recurrentgemma",
		filter: false,
		countDownloads: `path:"tokenizer.model"`,
	},
	relik: {
		prettyLabel: "Relik",
		repoName: "Relik",
		repoUrl: "https://github.com/SapienzaNLP/relik",
		snippets: snippets.relik,
		filter: false,
	},
	refiners: {
		prettyLabel: "Refiners",
		repoName: "Refiners",
		repoUrl: "https://github.com/finegrain-ai/refiners",
		docsUrl: "https://refine.rs/",
		filter: false,
		countDownloads: `path:"model.safetensors"`,
	},
	reverb: {
		prettyLabel: "Reverb",
		repoName: "Reverb",
		repoUrl: "https://github.com/revdotcom/reverb",
		filter: false,
	},
	saelens: {
		prettyLabel: "SAELens",
		repoName: "SAELens",
		repoUrl: "https://github.com/jbloomAus/SAELens",
		snippets: snippets.saelens,
		filter: false,
	},
	sam2: {
		prettyLabel: "sam2",
		repoName: "sam2",
		repoUrl: "https://github.com/facebookresearch/segment-anything-2",
		filter: false,
		snippets: snippets.sam2,
		countDownloads: `path_extension:"pt"`,
	},
	"sample-factory": {
		prettyLabel: "sample-factory",
		repoName: "sample-factory",
		repoUrl: "https://github.com/alex-petrenko/sample-factory",
		docsUrl: "https://huggingface.co/docs/hub/sample-factory",
		snippets: snippets.sampleFactory,
		filter: true,
		countDownloads: `path:"cfg.json"`,
	},
	sapiens: {
		prettyLabel: "sapiens",
		repoName: "sapiens",
		repoUrl: "https://github.com/facebookresearch/sapiens",
		filter: false,
		countDownloads: `path_extension:"pt2" OR path_extension:"pth" OR path_extension:"onnx"`,
	},
	"sentence-transformers": {
		prettyLabel: "sentence-transformers",
		repoName: "sentence-transformers",
		repoUrl: "https://github.com/UKPLab/sentence-transformers",
		docsUrl: "https://huggingface.co/docs/hub/sentence-transformers",
		snippets: snippets.sentenceTransformers,
		filter: true,
	},
	setfit: {
		prettyLabel: "setfit",
		repoName: "setfit",
		repoUrl: "https://github.com/huggingface/setfit",
		docsUrl: "https://huggingface.co/docs/hub/setfit",
		snippets: snippets.setfit,
		filter: true,
	},
	sklearn: {
		prettyLabel: "Scikit-learn",
		repoName: "Scikit-learn",
		repoUrl: "https://github.com/scikit-learn/scikit-learn",
		snippets: snippets.sklearn,
		filter: true,
		countDownloads: `path:"sklearn_model.joblib"`,
	},
	spacy: {
		prettyLabel: "spaCy",
		repoName: "spaCy",
		repoUrl: "https://github.com/explosion/spaCy",
		docsUrl: "https://huggingface.co/docs/hub/spacy",
		snippets: snippets.spacy,
		filter: true,
		countDownloads: `path_extension:"whl"`,
	},
	"span-marker": {
		prettyLabel: "SpanMarker",
		repoName: "SpanMarkerNER",
		repoUrl: "https://github.com/tomaarsen/SpanMarkerNER",
		docsUrl: "https://huggingface.co/docs/hub/span_marker",
		snippets: snippets.span_marker,
		filter: true,
	},
	speechbrain: {
		prettyLabel: "speechbrain",
		repoName: "speechbrain",
		repoUrl: "https://github.com/speechbrain/speechbrain",
		docsUrl: "https://huggingface.co/docs/hub/speechbrain",
		snippets: snippets.speechbrain,
		filter: true,
		countDownloads: `path:"hyperparams.yaml"`,
	},
	"ssr-speech": {
		prettyLabel: "SSR-Speech",
		repoName: "SSR-Speech",
		repoUrl: "https://github.com/WangHelin1997/SSR-Speech",
		filter: false,
		countDownloads: `path_extension:".pth"`,
	},
	"stable-audio-tools": {
		prettyLabel: "Stable Audio Tools",
		repoName: "stable-audio-tools",
		repoUrl: "https://github.com/Stability-AI/stable-audio-tools.git",
		filter: false,
		countDownloads: `path:"model.safetensors"`,
		snippets: snippets.stable_audio_tools,
	},
	"diffusion-single-file": {
		prettyLabel: "Diffusion Single File",
		repoName: "diffusion-single-file",
		repoUrl: "https://github.com/comfyanonymous/ComfyUI",
		filter: false,
		countDownloads: `path_extension:"safetensors"`,
	},
	"seed-story": {
		prettyLabel: "SEED-Story",
		repoName: "SEED-Story",
		repoUrl: "https://github.com/TencentARC/SEED-Story",
		filter: false,
		countDownloads: `path:"cvlm_llama2_tokenizer/tokenizer.model"`,
		snippets: snippets.seed_story,
	},
	soloaudio: {
		prettyLabel: "SoloAudio",
		repoName: "SoloAudio",
		repoUrl: "https://github.com/WangHelin1997/SoloAudio",
		filter: false,
		countDownloads: `path:"soloaudio_v2.pt"`,
	},
	"stable-baselines3": {
		prettyLabel: "stable-baselines3",
		repoName: "stable-baselines3",
		repoUrl: "https://github.com/huggingface/huggingface_sb3",
		docsUrl: "https://huggingface.co/docs/hub/stable-baselines3",
		snippets: snippets.stableBaselines3,
		filter: true,
		countDownloads: `path_extension:"zip"`,
	},
	stanza: {
		prettyLabel: "Stanza",
		repoName: "stanza",
		repoUrl: "https://github.com/stanfordnlp/stanza",
		docsUrl: "https://huggingface.co/docs/hub/stanza",
		snippets: snippets.stanza,
		filter: true,
		countDownloads: `path:"models/default.zip"`,
	},
	"f5-tts": {
		prettyLabel: "F5-TTS",
		repoName: "F5-TTS",
		repoUrl: "https://github.com/SWivid/F5-TTS",
		filter: false,
		countDownloads: `path_extension:"safetensors" OR path_extension:"pt"`,
	},
	genmo: {
		prettyLabel: "Genmo",
		repoName: "Genmo",
		repoUrl: "https://github.com/genmoai/models",
		filter: false,
		countDownloads: `path:"vae_stats.json"`,
	},
	tensorflowtts: {
		prettyLabel: "TensorFlowTTS",
		repoName: "TensorFlowTTS",
		repoUrl: "https://github.com/TensorSpeech/TensorFlowTTS",
		snippets: snippets.tensorflowtts,
	},
	"tic-clip": {
		prettyLabel: "TiC-CLIP",
		repoName: "TiC-CLIP",
		repoUrl: "https://github.com/apple/ml-tic-clip",
		filter: false,
		countDownloads: `path_extension:"pt" AND path_prefix:"checkpoints/"`,
	},
	timesfm: {
		prettyLabel: "TimesFM",
		repoName: "timesfm",
		repoUrl: "https://github.com/google-research/timesfm",
		filter: false,
		countDownloads: `path:"checkpoints/checkpoint_1100000/state/checkpoint"`,
	},
	timm: {
		prettyLabel: "timm",
		repoName: "pytorch-image-models",
		repoUrl: "https://github.com/rwightman/pytorch-image-models",
		docsUrl: "https://huggingface.co/docs/hub/timm",
		snippets: snippets.timm,
		filter: true,
		countDownloads: `path:"pytorch_model.bin" OR path:"model.safetensors"`,
	},
	transformers: {
		prettyLabel: "Transformers",
		repoName: "🤗/transformers",
		repoUrl: "https://github.com/huggingface/transformers",
		docsUrl: "https://huggingface.co/docs/hub/transformers",
		snippets: snippets.transformers,
		filter: true,
	},
	"transformers.js": {
		prettyLabel: "Transformers.js",
		repoName: "transformers.js",
		repoUrl: "https://github.com/huggingface/transformers.js",
		docsUrl: "https://huggingface.co/docs/hub/transformers-js",
		snippets: snippets.transformersJS,
		filter: true,
	},
	"unity-sentis": {
		prettyLabel: "unity-sentis",
		repoName: "unity-sentis",
		repoUrl: "https://github.com/Unity-Technologies/sentis-samples",
		snippets: snippets.sentis,
		filter: true,
		countDownloads: `path_extension:"sentis"`,
	},
	"vfi-mamba": {
		prettyLabel: "VFIMamba",
		repoName: "VFIMamba",
		repoUrl: "https://github.com/MCG-NJU/VFIMamba",
		countDownloads: `path_extension:"pkl"`,
		snippets: snippets.vfimamba,
	},
	voicecraft: {
		prettyLabel: "VoiceCraft",
		repoName: "VoiceCraft",
		repoUrl: "https://github.com/jasonppy/VoiceCraft",
		docsUrl: "https://github.com/jasonppy/VoiceCraft",
		snippets: snippets.voicecraft,
	},
	yolov10: {
		prettyLabel: "YOLOv10",
		repoName: "yolov10",
		repoUrl: "https://github.com/THU-MIG/yolov10",
		docsUrl: "https://github.com/THU-MIG/yolov10",
		snippets: snippets.yolov10,
	},
	whisperkit: {
		prettyLabel: "WhisperKit",
		repoName: "WhisperKit",
		repoUrl: "https://github.com/argmaxinc/WhisperKit",
		docsUrl: "https://github.com/argmaxinc/WhisperKit?tab=readme-ov-file#homebrew",
		snippets: snippets.whisperkit,
		countDownloads: `path_filename:"model" AND path_extension:"mil" AND _exists_:"path_prefix"`,
	},
	"3dtopia-xl": {
		prettyLabel: "3DTopia-XL",
		repoName: "3DTopia-XL",
		repoUrl: "https://github.com/3DTopia/3DTopia-XL",
		filter: false,
		countDownloads: `path:"model_vae_fp16.pt"`,
		snippets: snippets.threedtopia_xl,
	},
} satisfies Record<string, LibraryUiElement>;

export type ModelLibraryKey = keyof typeof MODEL_LIBRARIES_UI_ELEMENTS;

export const ALL_MODEL_LIBRARY_KEYS = Object.keys(MODEL_LIBRARIES_UI_ELEMENTS) as ModelLibraryKey[];

export const ALL_DISPLAY_MODEL_LIBRARY_KEYS = (
	Object.entries(MODEL_LIBRARIES_UI_ELEMENTS as Record<ModelLibraryKey, LibraryUiElement>) as [
		ModelLibraryKey,
		LibraryUiElement,
	][]
)
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	.filter(([_, v]) => v.filter)
	.map(([k]) => k);
