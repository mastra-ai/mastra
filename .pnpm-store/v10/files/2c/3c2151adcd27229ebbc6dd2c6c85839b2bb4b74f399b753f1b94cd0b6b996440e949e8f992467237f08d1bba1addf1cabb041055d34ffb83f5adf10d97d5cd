import { parseGGUFQuantLabel } from "./gguf";
import type { ModelData } from "./model-data";
import type { PipelineType } from "./pipelines";

export interface LocalAppSnippet {
	/**
	 * Title of the snippet
	 */
	title: string;
	/**
	 * Optional setup guide
	 */
	setup?: string;
	/**
	 * Content (or command) to be run
	 */
	content: string | string[];
}

/**
 * Elements configurable by a local app.
 */
export type LocalApp = {
	/**
	 * Name that appears in buttons
	 */
	prettyLabel: string;
	/**
	 * Link to get more info about a local app (website etc)
	 */
	docsUrl: string;
	/**
	 * main category of app
	 */
	mainTask: PipelineType;
	/**
	 * Whether to display a pill "macOS-only"
	 */
	macOSOnly?: boolean;

	comingSoon?: boolean;
	/**
	 * IMPORTANT: function to figure out whether to display the button on a model page's main "Use this model" dropdown.
	 */
	displayOnModelPage: (model: ModelData) => boolean;
} & (
	| {
			/**
			 * If the app supports deeplink, URL to open.
			 */
			deeplink: (model: ModelData, filepath?: string) => URL;
	  }
	| {
			/**
			 * And if not (mostly llama.cpp), snippet to copy/paste in your terminal
			 * Support the placeholder {{GGUF_FILE}} that will be replaced by the gguf file path or the list of available files.
			 * Support the placeholder {{OLLAMA_TAG}} that will be replaced by the list of available quant tags or will be removed if there are no multiple quant files in a same repo.
			 */
			snippet: (model: ModelData, filepath?: string) => string | string[] | LocalAppSnippet | LocalAppSnippet[];
	  }
);

function isAwqModel(model: ModelData): boolean {
	return model.config?.quantization_config?.quant_method === "awq";
}

function isGptqModel(model: ModelData): boolean {
	return model.config?.quantization_config?.quant_method === "gptq";
}

function isAqlmModel(model: ModelData): boolean {
	return model.config?.quantization_config?.quant_method === "aqlm";
}

function isMarlinModel(model: ModelData): boolean {
	return model.config?.quantization_config?.quant_method === "marlin";
}

function isTransformersModel(model: ModelData): boolean {
	return model.tags.includes("transformers");
}
function isTgiModel(model: ModelData): boolean {
	return model.tags.includes("text-generation-inference");
}

function isLlamaCppGgufModel(model: ModelData) {
	return !!model.gguf?.context_length;
}

function isMlxModel(model: ModelData) {
	return model.tags.includes("mlx");
}

const snippetLlamacpp = (model: ModelData, filepath?: string): LocalAppSnippet[] => {
	const command = (binary: string) =>
		[
			"# Load and run the model:",
			`${binary} \\`,
			`  --hf-repo "${model.id}" \\`,
			`  --hf-file ${filepath ?? "{{GGUF_FILE}}"} \\`,
			'  -p "You are a helpful assistant" \\',
			"  --conversation",
		].join("\n");
	return [
		{
			title: "Install from brew",
			setup: "brew install llama.cpp",
			content: command("llama-cli"),
		},
		{
			title: "Use pre-built binary",
			setup: [
				// prettier-ignore
				"# Download pre-built binary from:",
				"# https://github.com/ggerganov/llama.cpp/releases",
			].join("\n"),
			content: command("./llama-cli"),
		},
		{
			title: "Build from source code",
			setup: [
				"git clone https://github.com/ggerganov/llama.cpp.git",
				"cd llama.cpp",
				"LLAMA_CURL=1 make llama-cli",
			].join("\n"),
			content: command("./llama-cli"),
		},
	];
};

const snippetNodeLlamaCppCli = (model: ModelData, filepath?: string): LocalAppSnippet[] => {
	return [
		{
			title: "Chat with the model",
			content: [
				`npx -y node-llama-cpp chat \\`,
				`  --model "hf:${model.id}/${filepath ?? "{{GGUF_FILE}}"}" \\`,
				`  --prompt 'Hi there!'`,
			].join("\n"),
		},
		{
			title: "Estimate the model compatibility with your hardware",
			content: `npx -y node-llama-cpp inspect estimate "hf:${model.id}/${filepath ?? "{{GGUF_FILE}}"}"`,
		},
	];
};

const snippetOllama = (model: ModelData, filepath?: string): string => {
	if (filepath) {
		const quantLabel = parseGGUFQuantLabel(filepath);
		const ollamatag = quantLabel ? `:${quantLabel}` : "";
		return `ollama run hf.co/${model.id}${ollamatag}`;
	}
	return `ollama run hf.co/${model.id}{{OLLAMA_TAG}}`;
};

const snippetLocalAI = (model: ModelData, filepath?: string): LocalAppSnippet[] => {
	const command = (binary: string) =>
		["# Load and run the model:", `${binary} huggingface://${model.id}/${filepath ?? "{{GGUF_FILE}}"}`].join("\n");
	return [
		{
			title: "Install from binary",
			setup: "curl https://localai.io/install.sh | sh",
			content: command("local-ai run"),
		},
		{
			title: "Use Docker images",
			setup: [
				// prettier-ignore
				"# Pull the image:",
				"docker pull localai/localai:latest-cpu",
			].join("\n"),
			content: command(
				"docker run -p 8080:8080 --name localai -v $PWD/models:/build/models localai/localai:latest-cpu"
			),
		},
	];
};

const snippetVllm = (model: ModelData): LocalAppSnippet[] => {
	const runCommand = [
		"# Call the server using curl:",
		`curl -X POST "http://localhost:8000/v1/chat/completions" \\`,
		`	-H "Content-Type: application/json" \\`,
		`	--data '{`,
		`		"model": "${model.id}",`,
		`		"messages": [`,
		`			{"role": "user", "content": "Hello!"}`,
		`		]`,
		`	}'`,
	];
	return [
		{
			title: "Install from pip",
			setup: ["# Install vLLM from pip:", "pip install vllm"].join("\n"),
			content: [`# Load and run the model:\nvllm serve "${model.id}"`, runCommand.join("\n")],
		},
		{
			title: "Use Docker images",
			setup: [
				"# Deploy with docker on Linux:",
				`docker run --runtime nvidia --gpus all \\`,
				`	--name my_vllm_container \\`,
				`	-v ~/.cache/huggingface:/root/.cache/huggingface \\`,
				` 	--env "HUGGING_FACE_HUB_TOKEN=<secret>" \\`,
				`	-p 8000:8000 \\`,
				`	--ipc=host \\`,
				`	vllm/vllm-openai:latest \\`,
				`	--model ${model.id}`,
			].join("\n"),
			content: [
				`# Load and run the model:\ndocker exec -it my_vllm_container bash -c "vllm serve ${model.id}"`,
				runCommand.join("\n"),
			],
		},
	];
};
const snippetTgi = (model: ModelData): LocalAppSnippet[] => {
	const runCommand = [
		"# Call the server using curl:",
		`curl -X POST "http://localhost:8000/v1/chat/completions" \\`,
		`	-H "Content-Type: application/json" \\`,
		`	--data '{`,
		`		"model": "${model.id}",`,
		`		"messages": [`,
		`			{"role": "user", "content": "What is the capital of France?"}`,
		`		]`,
		`	}'`,
	];
	return [
		{
			title: "Use Docker images",
			setup: [
				"# Deploy with docker on Linux:",
				`docker run --gpus all \\`,
				`	-v ~/.cache/huggingface:/root/.cache/huggingface \\`,
				` 	-e HF_TOKEN="<secret>" \\`,
				`	-p 8000:80 \\`,
				`	ghcr.io/huggingface/text-generation-inference:latest \\`,
				`	--model-id ${model.id}`,
			].join("\n"),
			content: [runCommand.join("\n")],
		},
	];
};

/**
 * Add your new local app here.
 *
 * This is open to new suggestions and awesome upcoming apps.
 *
 * /!\ IMPORTANT
 *
 * If possible, you need to support deeplinks and be as cross-platform as possible.
 *
 * Ping the HF team if we can help with anything!
 */
export const LOCAL_APPS = {
	"llama.cpp": {
		prettyLabel: "llama.cpp",
		docsUrl: "https://github.com/ggerganov/llama.cpp",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		snippet: snippetLlamacpp,
	},
	"node-llama-cpp": {
		prettyLabel: "node-llama-cpp",
		docsUrl: "https://node-llama-cpp.withcat.ai",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		snippet: snippetNodeLlamaCppCli,
	},
	vllm: {
		prettyLabel: "vLLM",
		docsUrl: "https://docs.vllm.ai",
		mainTask: "text-generation",
		displayOnModelPage: (model: ModelData) =>
			(isAwqModel(model) ||
				isGptqModel(model) ||
				isAqlmModel(model) ||
				isMarlinModel(model) ||
				isLlamaCppGgufModel(model) ||
				isTransformersModel(model)) &&
			(model.pipeline_tag === "text-generation" || model.pipeline_tag === "image-text-to-text"),
		snippet: snippetVllm,
	},
	tgi: {
		prettyLabel: "TGI",
		docsUrl: "https://huggingface.co/docs/text-generation-inference/",
		mainTask: "text-generation",
		displayOnModelPage: isTgiModel,
		snippet: snippetTgi,
	},
	lmstudio: {
		prettyLabel: "LM Studio",
		docsUrl: "https://lmstudio.ai",
		mainTask: "text-generation",
		displayOnModelPage: (model) => isLlamaCppGgufModel(model) || isMlxModel(model),
		deeplink: (model, filepath) =>
			new URL(`lmstudio://open_from_hf?model=${model.id}${filepath ? `&file=${filepath}` : ""}`),
	},
	localai: {
		prettyLabel: "LocalAI",
		docsUrl: "https://github.com/mudler/LocalAI",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		snippet: snippetLocalAI,
	},
	jan: {
		prettyLabel: "Jan",
		docsUrl: "https://jan.ai",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		deeplink: (model) => new URL(`jan://models/huggingface/${model.id}`),
	},
	backyard: {
		prettyLabel: "Backyard AI",
		docsUrl: "https://backyard.ai",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		deeplink: (model) => new URL(`https://backyard.ai/hf/model/${model.id}`),
	},
	sanctum: {
		prettyLabel: "Sanctum",
		docsUrl: "https://sanctum.ai",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		deeplink: (model) => new URL(`sanctum://open_from_hf?model=${model.id}`),
	},
	jellybox: {
		prettyLabel: "Jellybox",
		docsUrl: "https://jellybox.com",
		mainTask: "text-generation",
		displayOnModelPage: (model) =>
			isLlamaCppGgufModel(model) ||
			(model.library_name === "diffusers" &&
				model.tags.includes("safetensors") &&
				(model.pipeline_tag === "text-to-image" || model.tags.includes("lora"))),
		deeplink: (model) => {
			if (isLlamaCppGgufModel(model)) {
				return new URL(`jellybox://llm/models/huggingface/LLM/${model.id}`);
			} else if (model.tags.includes("lora")) {
				return new URL(`jellybox://image/models/huggingface/ImageLora/${model.id}`);
			} else {
				return new URL(`jellybox://image/models/huggingface/Image/${model.id}`);
			}
		},
	},
	msty: {
		prettyLabel: "Msty",
		docsUrl: "https://msty.app",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		deeplink: (model) => new URL(`msty://models/search/hf/${model.id}`),
	},
	recursechat: {
		prettyLabel: "RecurseChat",
		docsUrl: "https://recurse.chat",
		mainTask: "text-generation",
		macOSOnly: true,
		displayOnModelPage: isLlamaCppGgufModel,
		deeplink: (model) => new URL(`recursechat://new-hf-gguf-model?hf-model-id=${model.id}`),
	},
	drawthings: {
		prettyLabel: "Draw Things",
		docsUrl: "https://drawthings.ai",
		mainTask: "text-to-image",
		macOSOnly: true,
		displayOnModelPage: (model) =>
			model.library_name === "diffusers" && (model.pipeline_tag === "text-to-image" || model.tags.includes("lora")),
		deeplink: (model) => {
			if (model.tags.includes("lora")) {
				return new URL(`https://drawthings.ai/import/diffusers/pipeline.load_lora_weights?repo_id=${model.id}`);
			} else {
				return new URL(`https://drawthings.ai/import/diffusers/pipeline.from_pretrained?repo_id=${model.id}`);
			}
		},
	},
	diffusionbee: {
		prettyLabel: "DiffusionBee",
		docsUrl: "https://diffusionbee.com",
		mainTask: "text-to-image",
		macOSOnly: true,
		displayOnModelPage: (model) => model.library_name === "diffusers" && model.pipeline_tag === "text-to-image",
		deeplink: (model) => new URL(`https://diffusionbee.com/huggingface_import?model_id=${model.id}`),
	},
	joyfusion: {
		prettyLabel: "JoyFusion",
		docsUrl: "https://joyfusion.app",
		mainTask: "text-to-image",
		macOSOnly: true,
		displayOnModelPage: (model) =>
			model.tags.includes("coreml") && model.tags.includes("joyfusion") && model.pipeline_tag === "text-to-image",
		deeplink: (model) => new URL(`https://joyfusion.app/import_from_hf?repo_id=${model.id}`),
	},
	invoke: {
		prettyLabel: "Invoke",
		docsUrl: "https://github.com/invoke-ai/InvokeAI",
		mainTask: "text-to-image",
		displayOnModelPage: (model) => model.library_name === "diffusers" && model.pipeline_tag === "text-to-image",
		deeplink: (model) => new URL(`https://models.invoke.ai/huggingface/${model.id}`),
	},
	ollama: {
		prettyLabel: "Ollama",
		docsUrl: "https://ollama.com",
		mainTask: "text-generation",
		displayOnModelPage: isLlamaCppGgufModel,
		snippet: snippetOllama,
	},
} satisfies Record<string, LocalApp>;

export type LocalAppKey = keyof typeof LOCAL_APPS;
