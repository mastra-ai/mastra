import type { ModelData } from "./model-data";
import type { WidgetExampleTextInput, WidgetExampleSentenceSimilarityInput } from "./widget-example";
import { LIBRARY_TASK_MAPPING } from "./library-to-tasks";

const TAG_CUSTOM_CODE = "custom_code";

function nameWithoutNamespace(modelId: string): string {
	const splitted = modelId.split("/");
	return splitted.length === 1 ? splitted[0] : splitted[1];
}

const escapeStringForJson = (str: string): string => JSON.stringify(str).slice(1, -1); // slice is needed to remove surrounding quotes added by JSON.stringify

//#region snippets

export const adapters = (model: ModelData): string[] => [
	`from adapters import AutoAdapterModel

model = AutoAdapterModel.from_pretrained("${model.config?.adapter_transformers?.model_name}")
model.load_adapter("${model.id}", set_active=True)`,
];

const allennlpUnknown = (model: ModelData) => [
	`import allennlp_models
from allennlp.predictors.predictor import Predictor

predictor = Predictor.from_path("hf://${model.id}")`,
];

const allennlpQuestionAnswering = (model: ModelData) => [
	`import allennlp_models
from allennlp.predictors.predictor import Predictor

predictor = Predictor.from_path("hf://${model.id}")
predictor_input = {"passage": "My name is Wolfgang and I live in Berlin", "question": "Where do I live?"}
predictions = predictor.predict_json(predictor_input)`,
];

export const allennlp = (model: ModelData): string[] => {
	if (model.tags.includes("question-answering")) {
		return allennlpQuestionAnswering(model);
	}
	return allennlpUnknown(model);
};

export const asteroid = (model: ModelData): string[] => [
	`from asteroid.models import BaseModel

model = BaseModel.from_pretrained("${model.id}")`,
];

export const audioseal = (model: ModelData): string[] => {
	const watermarkSnippet = `# Watermark Generator
from audioseal import AudioSeal

model = AudioSeal.load_generator("${model.id}")
# pass a tensor (tensor_wav) of shape (batch, channels, samples) and a sample rate
wav, sr = tensor_wav, 16000
	
watermark = model.get_watermark(wav, sr)
watermarked_audio = wav + watermark`;

	const detectorSnippet = `# Watermark Detector
from audioseal import AudioSeal

detector = AudioSeal.load_detector("${model.id}")
	
result, message = detector.detect_watermark(watermarked_audio, sr)`;
	return [watermarkSnippet, detectorSnippet];
};

function get_base_diffusers_model(model: ModelData): string {
	return model.cardData?.base_model?.toString() ?? "fill-in-base-model";
}

function get_prompt_from_diffusers_model(model: ModelData): string | undefined {
	const prompt = (model.widgetData?.[0] as WidgetExampleTextInput | undefined)?.text ?? model.cardData?.instance_prompt;
	if (prompt) {
		return escapeStringForJson(prompt);
	}
}

export const bertopic = (model: ModelData): string[] => [
	`from bertopic import BERTopic

model = BERTopic.load("${model.id}")`,
];

export const bm25s = (model: ModelData): string[] => [
	`from bm25s.hf import BM25HF

retriever = BM25HF.load_from_hub("${model.id}")`,
];

export const depth_anything_v2 = (model: ModelData): string[] => {
	let encoder: string;
	let features: string;
	let out_channels: string;

	encoder = "<ENCODER>";
	features = "<NUMBER_OF_FEATURES>";
	out_channels = "<OUT_CHANNELS>";

	if (model.id === "depth-anything/Depth-Anything-V2-Small") {
		encoder = "vits";
		features = "64";
		out_channels = "[48, 96, 192, 384]";
	} else if (model.id === "depth-anything/Depth-Anything-V2-Base") {
		encoder = "vitb";
		features = "128";
		out_channels = "[96, 192, 384, 768]";
	} else if (model.id === "depth-anything/Depth-Anything-V2-Large") {
		encoder = "vitl";
		features = "256";
		out_channels = "[256, 512, 1024, 1024";
	}

	return [
		`
# Install from https://github.com/DepthAnything/Depth-Anything-V2

# Load the model and infer depth from an image
import cv2
import torch

from depth_anything_v2.dpt import DepthAnythingV2

# instantiate the model
model = DepthAnythingV2(encoder="${encoder}", features=${features}, out_channels=${out_channels})

# load the weights
filepath = hf_hub_download(repo_id="${model.id}", filename="depth_anything_v2_${encoder}.pth", repo_type="model")
state_dict = torch.load(filepath, map_location="cpu")
model.load_state_dict(state_dict).eval()

raw_img = cv2.imread("your/image/path")
depth = model.infer_image(raw_img) # HxW raw depth map in numpy
    `,
	];
};

export const depth_pro = (model: ModelData): string[] => {
	const installSnippet = `# Download checkpoint
pip install huggingface-hub
huggingface-cli download --local-dir checkpoints ${model.id}`;

	const inferenceSnippet = `import depth_pro

# Load model and preprocessing transform
model, transform = depth_pro.create_model_and_transforms()
model.eval()

# Load and preprocess an image.
image, _, f_px = depth_pro.load_rgb("example.png")
image = transform(image)

# Run inference.
prediction = model.infer(image, f_px=f_px)

# Results: 1. Depth in meters
depth = prediction["depth"]
# Results: 2. Focal length in pixels
focallength_px = prediction["focallength_px"]`;

	return [installSnippet, inferenceSnippet];
};

const diffusersDefaultPrompt = "Astronaut in a jungle, cold color palette, muted colors, detailed, 8k";

const diffusers_default = (model: ModelData) => [
	`from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained("${model.id}")

prompt = "${get_prompt_from_diffusers_model(model) ?? diffusersDefaultPrompt}"
image = pipe(prompt).images[0]`,
];

const diffusers_controlnet = (model: ModelData) => [
	`from diffusers import ControlNetModel, StableDiffusionControlNetPipeline

controlnet = ControlNetModel.from_pretrained("${model.id}")
pipe = StableDiffusionControlNetPipeline.from_pretrained(
	"${get_base_diffusers_model(model)}", controlnet=controlnet
)`,
];

const diffusers_lora = (model: ModelData) => [
	`from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained("${get_base_diffusers_model(model)}")
pipe.load_lora_weights("${model.id}")

prompt = "${get_prompt_from_diffusers_model(model) ?? diffusersDefaultPrompt}"
image = pipe(prompt).images[0]`,
];

const diffusers_textual_inversion = (model: ModelData) => [
	`from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained("${get_base_diffusers_model(model)}")
pipe.load_textual_inversion("${model.id}")`,
];

export const diffusers = (model: ModelData): string[] => {
	if (model.tags.includes("controlnet")) {
		return diffusers_controlnet(model);
	} else if (model.tags.includes("lora")) {
		return diffusers_lora(model);
	} else if (model.tags.includes("textual_inversion")) {
		return diffusers_textual_inversion(model);
	} else {
		return diffusers_default(model);
	}
};

export const diffusionkit = (model: ModelData): string[] => {
	const sd3Snippet = `# Pipeline for Stable Diffusion 3
from diffusionkit.mlx import DiffusionPipeline

pipeline = DiffusionPipeline(
	shift=3.0,
	use_t5=False,
	model_version=${model.id},
	low_memory_mode=True,
	a16=True,
	w16=True,
)`;

	const fluxSnippet = `# Pipeline for Flux
from diffusionkit.mlx import FluxPipeline

pipeline = FluxPipeline(
  shift=1.0,
  model_version=${model.id},
  low_memory_mode=True,
  a16=True,
  w16=True,
)`;

	const generateSnippet = `# Image Generation
HEIGHT = 512
WIDTH = 512
NUM_STEPS = ${model.tags.includes("flux") ? 4 : 50}
CFG_WEIGHT = ${model.tags.includes("flux") ? 0 : 5}

image, _ = pipeline.generate_image(
  "a photo of a cat",
  cfg_weight=CFG_WEIGHT,
  num_steps=NUM_STEPS,
  latent_size=(HEIGHT // 8, WIDTH // 8),
)`;

	const pipelineSnippet = model.tags.includes("flux") ? fluxSnippet : sd3Snippet;

	return [pipelineSnippet, generateSnippet];
};

export const cartesia_pytorch = (model: ModelData): string[] => [
	`# pip install --no-binary :all: cartesia-pytorch
from cartesia_pytorch import ReneLMHeadModel
from transformers import AutoTokenizer

model = ReneLMHeadModel.from_pretrained("${model.id}")
tokenizer = AutoTokenizer.from_pretrained("allenai/OLMo-1B-hf")

in_message = ["Rene Descartes was"]
inputs = tokenizer(in_message, return_tensors="pt")

outputs = model.generate(inputs.input_ids, max_length=50, top_k=100, top_p=0.99)
out_message = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]

print(out_message)
)`,
];

export const cartesia_mlx = (model: ModelData): string[] => [
	`import mlx.core as mx
import cartesia_mlx as cmx

model = cmx.from_pretrained("${model.id}")
model.set_dtype(mx.float32)   

prompt = "Rene Descartes was"

for text in model.generate(
    prompt,
    max_tokens=500,
    eval_every_n=5,
    verbose=True,
    top_p=0.99,
    temperature=0.85,
):
    print(text, end="", flush=True)
`,
];

export const edsnlp = (model: ModelData): string[] => {
	const packageName = nameWithoutNamespace(model.id).replaceAll("-", "_");
	return [
		`# Load it from the Hub directly
import edsnlp
nlp = edsnlp.load("${model.id}")
`,
		`# Or install it as a package
!pip install git+https://huggingface.co/${model.id}

# and import it as a module
import ${packageName}

nlp = ${packageName}.load()  # or edsnlp.load("${packageName}")
`,
	];
};

export const espnetTTS = (model: ModelData): string[] => [
	`from espnet2.bin.tts_inference import Text2Speech

model = Text2Speech.from_pretrained("${model.id}")

speech, *_ = model("text to generate speech from")`,
];

export const espnetASR = (model: ModelData): string[] => [
	`from espnet2.bin.asr_inference import Speech2Text

model = Speech2Text.from_pretrained(
  "${model.id}"
)

speech, rate = soundfile.read("speech.wav")
text, *_ = model(speech)[0]`,
];

const espnetUnknown = () => [`unknown model type (must be text-to-speech or automatic-speech-recognition)`];

export const espnet = (model: ModelData): string[] => {
	if (model.tags.includes("text-to-speech")) {
		return espnetTTS(model);
	} else if (model.tags.includes("automatic-speech-recognition")) {
		return espnetASR(model);
	}
	return espnetUnknown();
};

export const fairseq = (model: ModelData): string[] => [
	`from fairseq.checkpoint_utils import load_model_ensemble_and_task_from_hf_hub

models, cfg, task = load_model_ensemble_and_task_from_hf_hub(
    "${model.id}"
)`,
];

export const flair = (model: ModelData): string[] => [
	`from flair.models import SequenceTagger

tagger = SequenceTagger.load("${model.id}")`,
];

export const gliner = (model: ModelData): string[] => [
	`from gliner import GLiNER

model = GLiNER.from_pretrained("${model.id}")`,
];

export const keras = (model: ModelData): string[] => [
	`# Available backend options are: "jax", "torch", "tensorflow".
import os
os.environ["KERAS_BACKEND"] = "jax"
	
import keras

model = keras.saving.load_model("hf://${model.id}")
`,
];

export const keras_nlp = (model: ModelData): string[] => [
	`# Available backend options are: "jax", "torch", "tensorflow".
import os
os.environ["KERAS_BACKEND"] = "jax"

import keras_nlp

tokenizer = keras_nlp.models.Tokenizer.from_preset("hf://${model.id}")
backbone = keras_nlp.models.Backbone.from_preset("hf://${model.id}")
`,
];

export const keras_hub = (model: ModelData): string[] => [
	`# Available backend options are: "jax", "torch", "tensorflow".
import os
os.environ["KERAS_BACKEND"] = "jax"

import keras_hub

# Load a task-specific model (*replace CausalLM with your task*)
model = keras_hub.models.CausalLM.from_preset("hf://${model.id}", dtype="bfloat16")

# Possible tasks are CausalLM, TextToImage, ImageClassifier, ...
# full list here: https://keras.io/api/keras_hub/models/#api-documentation
`,
];

export const llama_cpp_python = (model: ModelData): string[] => [
	`from llama_cpp import Llama

llm = Llama.from_pretrained(
	repo_id="${model.id}",
	filename="{{GGUF_FILE}}",
)

llm.create_chat_completion(
	messages = [
		{
			"role": "user",
			"content": "What is the capital of France?"
		}
	]
)`,
];

export const tf_keras = (model: ModelData): string[] => [
	`# Note: 'keras<3.x' or 'tf_keras' must be installed (legacy)
# See https://github.com/keras-team/tf-keras for more details.
from huggingface_hub import from_pretrained_keras

model = from_pretrained_keras("${model.id}")
`,
];

export const mamba_ssm = (model: ModelData): string[] => [
	`from mamba_ssm import MambaLMHeadModel

model = MambaLMHeadModel.from_pretrained("${model.id}")`,
];

export const mars5_tts = (model: ModelData): string[] => [
	`# Install from https://github.com/Camb-ai/MARS5-TTS

from inference import Mars5TTS
mars5 = Mars5TTS.from_pretrained("${model.id}")`,
];

export const mesh_anything = (): string[] => [
	`# Install from https://github.com/buaacyw/MeshAnything.git

from MeshAnything.models.meshanything import MeshAnything

# refer to https://github.com/buaacyw/MeshAnything/blob/main/main.py#L91 on how to define args
# and https://github.com/buaacyw/MeshAnything/blob/main/app.py regarding usage
model = MeshAnything(args)`,
];

export const open_clip = (model: ModelData): string[] => [
	`import open_clip

model, preprocess_train, preprocess_val = open_clip.create_model_and_transforms('hf-hub:${model.id}')
tokenizer = open_clip.get_tokenizer('hf-hub:${model.id}')`,
];

export const paddlenlp = (model: ModelData): string[] => {
	if (model.config?.architectures?.[0]) {
		const architecture = model.config.architectures[0];
		return [
			[
				`from paddlenlp.transformers import AutoTokenizer, ${architecture}`,
				"",
				`tokenizer = AutoTokenizer.from_pretrained("${model.id}", from_hf_hub=True)`,
				`model = ${architecture}.from_pretrained("${model.id}", from_hf_hub=True)`,
			].join("\n"),
		];
	} else {
		return [
			[
				`# ⚠️ Type of model unknown`,
				`from paddlenlp.transformers import AutoTokenizer, AutoModel`,
				"",
				`tokenizer = AutoTokenizer.from_pretrained("${model.id}", from_hf_hub=True)`,
				`model = AutoModel.from_pretrained("${model.id}", from_hf_hub=True)`,
			].join("\n"),
		];
	}
};

export const pyannote_audio_pipeline = (model: ModelData): string[] => [
	`from pyannote.audio import Pipeline
  
pipeline = Pipeline.from_pretrained("${model.id}")

# inference on the whole file
pipeline("file.wav")

# inference on an excerpt
from pyannote.core import Segment
excerpt = Segment(start=2.0, end=5.0)

from pyannote.audio import Audio
waveform, sample_rate = Audio().crop("file.wav", excerpt)
pipeline({"waveform": waveform, "sample_rate": sample_rate})`,
];

const pyannote_audio_model = (model: ModelData): string[] => [
	`from pyannote.audio import Model, Inference

model = Model.from_pretrained("${model.id}")
inference = Inference(model)

# inference on the whole file
inference("file.wav")

# inference on an excerpt
from pyannote.core import Segment
excerpt = Segment(start=2.0, end=5.0)
inference.crop("file.wav", excerpt)`,
];

export const pyannote_audio = (model: ModelData): string[] => {
	if (model.tags.includes("pyannote-audio-pipeline")) {
		return pyannote_audio_pipeline(model);
	}
	return pyannote_audio_model(model);
};

export const relik = (model: ModelData): string[] => [
	`from relik import Relik
 
relik = Relik.from_pretrained("${model.id}")`,
];

const tensorflowttsTextToMel = (model: ModelData): string[] => [
	`from tensorflow_tts.inference import AutoProcessor, TFAutoModel

processor = AutoProcessor.from_pretrained("${model.id}")
model = TFAutoModel.from_pretrained("${model.id}")
`,
];

const tensorflowttsMelToWav = (model: ModelData): string[] => [
	`from tensorflow_tts.inference import TFAutoModel

model = TFAutoModel.from_pretrained("${model.id}")
audios = model.inference(mels)
`,
];

const tensorflowttsUnknown = (model: ModelData): string[] => [
	`from tensorflow_tts.inference import TFAutoModel

model = TFAutoModel.from_pretrained("${model.id}")
`,
];

export const tensorflowtts = (model: ModelData): string[] => {
	if (model.tags.includes("text-to-mel")) {
		return tensorflowttsTextToMel(model);
	} else if (model.tags.includes("mel-to-wav")) {
		return tensorflowttsMelToWav(model);
	}
	return tensorflowttsUnknown(model);
};

export const timm = (model: ModelData): string[] => [
	`import timm

model = timm.create_model("hf_hub:${model.id}", pretrained=True)`,
];

export const saelens = (/* model: ModelData */): string[] => [
	`# pip install sae-lens
from sae_lens import SAE

sae, cfg_dict, sparsity = SAE.from_pretrained(
    release = "RELEASE_ID", # e.g., "gpt2-small-res-jb". See other options in https://github.com/jbloomAus/SAELens/blob/main/sae_lens/pretrained_saes.yaml
    sae_id = "SAE_ID", # e.g., "blocks.8.hook_resid_pre". Won't always be a hook point
)`,
];

export const seed_story = (): string[] => [
	`# seed_story_cfg_path refers to 'https://github.com/TencentARC/SEED-Story/blob/master/configs/clm_models/agent_7b_sft.yaml'
# llm_cfg_path refers to 'https://github.com/TencentARC/SEED-Story/blob/master/configs/clm_models/llama2chat7b_lora.yaml'
from omegaconf import OmegaConf
import hydra

# load Llama2
llm_cfg = OmegaConf.load(llm_cfg_path)
llm = hydra.utils.instantiate(llm_cfg, torch_dtype="fp16")

# initialize seed_story
seed_story_cfg = OmegaConf.load(seed_story_cfg_path)
seed_story = hydra.utils.instantiate(seed_story_cfg, llm=llm) `,
];

const skopsPickle = (model: ModelData, modelFile: string) => {
	return [
		`import joblib
from skops.hub_utils import download
download("${model.id}", "path_to_folder")
model = joblib.load(
	"${modelFile}"
)
# only load pickle files from sources you trust
# read more about it here https://skops.readthedocs.io/en/stable/persistence.html`,
	];
};

const skopsFormat = (model: ModelData, modelFile: string) => {
	return [
		`from skops.hub_utils import download
from skops.io import load
download("${model.id}", "path_to_folder")
# make sure model file is in skops format
# if model is a pickle file, make sure it's from a source you trust
model = load("path_to_folder/${modelFile}")`,
	];
};

const skopsJobLib = (model: ModelData) => {
	return [
		`from huggingface_hub import hf_hub_download
import joblib
model = joblib.load(
	hf_hub_download("${model.id}", "sklearn_model.joblib")
)
# only load pickle files from sources you trust
# read more about it here https://skops.readthedocs.io/en/stable/persistence.html`,
	];
};

export const sklearn = (model: ModelData): string[] => {
	if (model.tags.includes("skops")) {
		const skopsmodelFile = model.config?.sklearn?.model?.file;
		const skopssaveFormat = model.config?.sklearn?.model_format;
		if (!skopsmodelFile) {
			return [`# ⚠️ Model filename not specified in config.json`];
		}
		if (skopssaveFormat === "pickle") {
			return skopsPickle(model, skopsmodelFile);
		} else {
			return skopsFormat(model, skopsmodelFile);
		}
	} else {
		return skopsJobLib(model);
	}
};

export const stable_audio_tools = (model: ModelData): string[] => [
	`import torch
import torchaudio
from einops import rearrange
from stable_audio_tools import get_pretrained_model
from stable_audio_tools.inference.generation import generate_diffusion_cond

device = "cuda" if torch.cuda.is_available() else "cpu"

# Download model
model, model_config = get_pretrained_model("${model.id}")
sample_rate = model_config["sample_rate"]
sample_size = model_config["sample_size"]

model = model.to(device)

# Set up text and timing conditioning
conditioning = [{
	"prompt": "128 BPM tech house drum loop",
}]

# Generate stereo audio
output = generate_diffusion_cond(
	model,
	conditioning=conditioning,
	sample_size=sample_size,
	device=device
)

# Rearrange audio batch to a single sequence
output = rearrange(output, "b d n -> d (b n)")

# Peak normalize, clip, convert to int16, and save to file
output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).mul(32767).to(torch.int16).cpu()
torchaudio.save("output.wav", output, sample_rate)`,
];

export const fastai = (model: ModelData): string[] => [
	`from huggingface_hub import from_pretrained_fastai

learn = from_pretrained_fastai("${model.id}")`,
];

export const sam2 = (model: ModelData): string[] => {
	const image_predictor = `# Use SAM2 with images
import torch
from sam2.sam2_image_predictor import SAM2ImagePredictor

predictor = SAM2ImagePredictor.from_pretrained(${model.id})

with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
    predictor.set_image(<your_image>)
    masks, _, _ = predictor.predict(<input_prompts>)`;

	const video_predictor = `# Use SAM2 with videos
import torch
from sam2.sam2_video_predictor import SAM2VideoPredictor
	
predictor = SAM2VideoPredictor.from_pretrained(${model.id})

with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
    state = predictor.init_state(<your_video>)

    # add new prompts and instantly get the output on the same frame
    frame_idx, object_ids, masks = predictor.add_new_points(state, <your_prompts>):

    # propagate the prompts to get masklets throughout the video
    for frame_idx, object_ids, masks in predictor.propagate_in_video(state):
        ...`;
	return [image_predictor, video_predictor];
};

export const sampleFactory = (model: ModelData): string[] => [
	`python -m sample_factory.huggingface.load_from_hub -r ${model.id} -d ./train_dir`,
];

function get_widget_examples_from_st_model(model: ModelData): string[] | undefined {
	const widgetExample = model.widgetData?.[0] as WidgetExampleSentenceSimilarityInput | undefined;
	if (widgetExample) {
		return [widgetExample.source_sentence, ...widgetExample.sentences];
	}
}

export const sentenceTransformers = (model: ModelData): string[] => {
	const remote_code_snippet = model.tags.includes(TAG_CUSTOM_CODE) ? ", trust_remote_code=True" : "";
	const exampleSentences = get_widget_examples_from_st_model(model) ?? [
		"The weather is lovely today.",
		"It's so sunny outside!",
		"He drove to the stadium.",
	];

	return [
		`from sentence_transformers import SentenceTransformer

model = SentenceTransformer("${model.id}"${remote_code_snippet})

sentences = ${JSON.stringify(exampleSentences, null, 4)}
embeddings = model.encode(sentences)

similarities = model.similarity(embeddings, embeddings)
print(similarities.shape)
# [${exampleSentences.length}, ${exampleSentences.length}]`,
	];
};

export const setfit = (model: ModelData): string[] => [
	`from setfit import SetFitModel

model = SetFitModel.from_pretrained("${model.id}")`,
];

export const spacy = (model: ModelData): string[] => [
	`!pip install https://huggingface.co/${model.id}/resolve/main/${nameWithoutNamespace(model.id)}-any-py3-none-any.whl

# Using spacy.load().
import spacy
nlp = spacy.load("${nameWithoutNamespace(model.id)}")

# Importing as module.
import ${nameWithoutNamespace(model.id)}
nlp = ${nameWithoutNamespace(model.id)}.load()`,
];

export const span_marker = (model: ModelData): string[] => [
	`from span_marker import SpanMarkerModel

model = SpanMarkerModel.from_pretrained("${model.id}")`,
];

export const stanza = (model: ModelData): string[] => [
	`import stanza

stanza.download("${nameWithoutNamespace(model.id).replace("stanza-", "")}")
nlp = stanza.Pipeline("${nameWithoutNamespace(model.id).replace("stanza-", "")}")`,
];

const speechBrainMethod = (speechbrainInterface: string) => {
	switch (speechbrainInterface) {
		case "EncoderClassifier":
			return "classify_file";
		case "EncoderDecoderASR":
		case "EncoderASR":
			return "transcribe_file";
		case "SpectralMaskEnhancement":
			return "enhance_file";
		case "SepformerSeparation":
			return "separate_file";
		default:
			return undefined;
	}
};

export const speechbrain = (model: ModelData): string[] => {
	const speechbrainInterface = model.config?.speechbrain?.speechbrain_interface;
	if (speechbrainInterface === undefined) {
		return [`# interface not specified in config.json`];
	}

	const speechbrainMethod = speechBrainMethod(speechbrainInterface);
	if (speechbrainMethod === undefined) {
		return [`# interface in config.json invalid`];
	}

	return [
		`from speechbrain.pretrained import ${speechbrainInterface}
model = ${speechbrainInterface}.from_hparams(
  "${model.id}"
)
model.${speechbrainMethod}("file.wav")`,
	];
};

export const transformers = (model: ModelData): string[] => {
	const info = model.transformersInfo;
	if (!info) {
		return [`# ⚠️ Type of model unknown`];
	}
	const remote_code_snippet = model.tags.includes(TAG_CUSTOM_CODE) ? ", trust_remote_code=True" : "";

	let autoSnippet: string;
	if (info.processor) {
		const varName =
			info.processor === "AutoTokenizer"
				? "tokenizer"
				: info.processor === "AutoFeatureExtractor"
				  ? "extractor"
				  : "processor";
		autoSnippet = [
			"# Load model directly",
			`from transformers import ${info.processor}, ${info.auto_model}`,
			"",
			`${varName} = ${info.processor}.from_pretrained("${model.id}"` + remote_code_snippet + ")",
			`model = ${info.auto_model}.from_pretrained("${model.id}"` + remote_code_snippet + ")",
		].join("\n");
	} else {
		autoSnippet = [
			"# Load model directly",
			`from transformers import ${info.auto_model}`,
			`model = ${info.auto_model}.from_pretrained("${model.id}"` + remote_code_snippet + ")",
		].join("\n");
	}

	if (model.pipeline_tag && LIBRARY_TASK_MAPPING.transformers?.includes(model.pipeline_tag)) {
		const pipelineSnippet = ["# Use a pipeline as a high-level helper", "from transformers import pipeline", ""];

		if (model.tags.includes("conversational") && model.config?.tokenizer_config?.chat_template) {
			pipelineSnippet.push("messages = [", '    {"role": "user", "content": "Who are you?"},', "]");
		}
		pipelineSnippet.push(`pipe = pipeline("${model.pipeline_tag}", model="${model.id}"` + remote_code_snippet + ")");
		if (model.tags.includes("conversational") && model.config?.tokenizer_config?.chat_template) {
			pipelineSnippet.push("pipe(messages)");
		}

		return [pipelineSnippet.join("\n"), autoSnippet];
	}
	return [autoSnippet];
};

export const transformersJS = (model: ModelData): string[] => {
	if (!model.pipeline_tag) {
		return [`// ⚠️ Unknown pipeline tag`];
	}

	const libName = "@huggingface/transformers";

	return [
		`// npm i ${libName}
import { pipeline } from '${libName}';

// Allocate pipeline
const pipe = await pipeline('${model.pipeline_tag}', '${model.id}');`,
	];
};

const peftTask = (peftTaskType?: string) => {
	switch (peftTaskType) {
		case "CAUSAL_LM":
			return "CausalLM";
		case "SEQ_2_SEQ_LM":
			return "Seq2SeqLM";
		case "TOKEN_CLS":
			return "TokenClassification";
		case "SEQ_CLS":
			return "SequenceClassification";
		default:
			return undefined;
	}
};

export const peft = (model: ModelData): string[] => {
	const { base_model_name_or_path: peftBaseModel, task_type: peftTaskType } = model.config?.peft ?? {};
	const pefttask = peftTask(peftTaskType);
	if (!pefttask) {
		return [`Task type is invalid.`];
	}
	if (!peftBaseModel) {
		return [`Base model is not found.`];
	}

	return [
		`from peft import PeftModel, PeftConfig
from transformers import AutoModelFor${pefttask}

config = PeftConfig.from_pretrained("${model.id}")
base_model = AutoModelFor${pefttask}.from_pretrained("${peftBaseModel}")
model = PeftModel.from_pretrained(base_model, "${model.id}")`,
	];
};

export const fasttext = (model: ModelData): string[] => [
	`from huggingface_hub import hf_hub_download
import fasttext

model = fasttext.load_model(hf_hub_download("${model.id}", "model.bin"))`,
];

export const stableBaselines3 = (model: ModelData): string[] => [
	`from huggingface_sb3 import load_from_hub
checkpoint = load_from_hub(
	repo_id="${model.id}",
	filename="{MODEL FILENAME}.zip",
)`,
];

const nemoDomainResolver = (domain: string, model: ModelData): string[] | undefined => {
	switch (domain) {
		case "ASR":
			return [
				`import nemo.collections.asr as nemo_asr
asr_model = nemo_asr.models.ASRModel.from_pretrained("${model.id}")

transcriptions = asr_model.transcribe(["file.wav"])`,
			];
		default:
			return undefined;
	}
};

export const mlAgents = (model: ModelData): string[] => [
	`mlagents-load-from-hf --repo-id="${model.id}" --local-dir="./download: string[]s"`,
];

export const sentis = (/* model: ModelData */): string[] => [
	`string modelName = "[Your model name here].sentis";
Model model = ModelLoader.Load(Application.streamingAssetsPath + "/" + modelName);
IWorker engine = WorkerFactory.CreateWorker(BackendType.GPUCompute, model);
// Please see provided C# file for more details
`,
];

export const vfimamba = (model: ModelData): string[] => [
	`from Trainer_finetune import Model

model = Model.from_pretrained("${model.id}")`,
];

export const voicecraft = (model: ModelData): string[] => [
	`from voicecraft import VoiceCraft

model = VoiceCraft.from_pretrained("${model.id}")`,
];

export const chattts = (): string[] => [
	`import ChatTTS
import torchaudio

chat = ChatTTS.Chat()
chat.load_models(compile=False) # Set to True for better performance

texts = ["PUT YOUR TEXT HERE",]

wavs = chat.infer(texts, )

torchaudio.save("output1.wav", torch.from_numpy(wavs[0]), 24000)`,
];

export const yolov10 = (model: ModelData): string[] => [
	`from ultralytics import YOLOv10

model = YOLOv10.from_pretrained("${model.id}")
source = 'http://images.cocodataset.org/val2017/000000039769.jpg'
model.predict(source=source, save=True)
`,
];

export const birefnet = (model: ModelData): string[] => [
	`# Option 1: use with transformers

from transformers import AutoModelForImageSegmentation
birefnet = AutoModelForImageSegmentation.from_pretrained("${model.id}", trust_remote_code=True)
`,
	`# Option 2: use with BiRefNet

# Install from https://github.com/ZhengPeng7/BiRefNet

from models.birefnet import BiRefNet
model = BiRefNet.from_pretrained("${model.id}")`,
];

export const mlx = (model: ModelData): string[] => [
	`pip install huggingface_hub hf_transfer

export HF_HUB_ENABLE_HF_TRANS: string[]FER=1
huggingface-cli download --local-dir ${nameWithoutNamespace(model.id)} ${model.id}`,
];

export const mlxim = (model: ModelData): string[] => [
	`from mlxim.model import create_model

model = create_model(${model.id})`,
];

export const model2vec = (model: ModelData): string[] => [
	`from model2vec import StaticModel

model = StaticModel.from_pretrained("${model.id}")`,
];

export const nemo = (model: ModelData): string[] => {
	let command: string[] | undefined = undefined;
	// Resolve the tag to a nemo domain/sub-domain
	if (model.tags.includes("automatic-speech-recognition")) {
		command = nemoDomainResolver("ASR", model);
	}

	return command ?? [`# tag did not correspond to a valid NeMo domain.`];
};

export const pxia = (model: ModelData): string[] => [
	`from pxia import AutoModel

model = AutoModel.from_pretrained("${model.id}")`,
];

export const pythae = (model: ModelData): string[] => [
	`from pythae.models import AutoModel

model = AutoModel.load_from_hf_hub("${model.id}")`,
];

const musicgen = (model: ModelData): string[] => [
	`from audiocraft.models import MusicGen

model = MusicGen.get_pretrained("${model.id}")

descriptions = ['happy rock', 'energetic EDM', 'sad jazz']
wav = model.generate(descriptions)  # generates 3 samples.`,
];

const magnet = (model: ModelData): string[] => [
	`from audiocraft.models import MAGNeT
	
model = MAGNeT.get_pretrained("${model.id}")

descriptions = ['disco beat', 'energetic EDM', 'funky groove']
wav = model.generate(descriptions)  # generates 3 samples.`,
];

const audiogen = (model: ModelData): string[] => [
	`from audiocraft.models import AudioGen
	
model = AudioGen.get_pretrained("${model.id}")
model.set_generation_params(duration=5)  # generate 5 seconds.
descriptions = ['dog barking', 'sirene of an emergency vehicle', 'footsteps in a corridor']
wav = model.generate(descriptions)  # generates 3 samples.`,
];

export const audiocraft = (model: ModelData): string[] => {
	if (model.tags.includes("musicgen")) {
		return musicgen(model);
	} else if (model.tags.includes("audiogen")) {
		return audiogen(model);
	} else if (model.tags.includes("magnet")) {
		return magnet(model);
	} else {
		return [`# Type of model unknown.`];
	}
};

export const whisperkit = (): string[] => [
	`# Install CLI with Homebrew on macOS device
brew install whisperkit-cli

# View all available inference options
whisperkit-cli transcribe --help
	
# Download and run inference using whisper base model
whisperkit-cli transcribe --audio-path /path/to/audio.mp3

# Or use your preferred model variant
whisperkit-cli transcribe --model "large-v3" --model-prefix "distil" --audio-path /path/to/audio.mp3 --verbose`,
];

export const threedtopia_xl = (model: ModelData): string[] => [
	`from threedtopia_xl.models import threedtopia_xl

model = threedtopia_xl.from_pretrained("${model.id}")
model.generate(cond="path/to/image.png")`,
];

export const hezar = (model: ModelData): string[] => [
	`from hezar import Model

model = Model.load("${model.id}")`,
];
//#endregion
