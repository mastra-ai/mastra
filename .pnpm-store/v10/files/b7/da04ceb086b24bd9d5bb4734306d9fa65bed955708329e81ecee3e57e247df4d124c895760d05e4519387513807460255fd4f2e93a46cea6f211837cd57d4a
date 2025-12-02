"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  ALL_DISPLAY_MODEL_LIBRARY_KEYS: () => ALL_DISPLAY_MODEL_LIBRARY_KEYS,
  ALL_MODEL_LIBRARY_KEYS: () => ALL_MODEL_LIBRARY_KEYS,
  DATASET_LIBRARIES_UI_ELEMENTS: () => DATASET_LIBRARIES_UI_ELEMENTS,
  DEFAULT_MEMORY_OPTIONS: () => DEFAULT_MEMORY_OPTIONS,
  GGMLQuantizationType: () => GGMLQuantizationType,
  GGUF_QUANT_RE: () => GGUF_QUANT_RE,
  GGUF_QUANT_RE_GLOBAL: () => GGUF_QUANT_RE_GLOBAL,
  LIBRARY_TASK_MAPPING: () => LIBRARY_TASK_MAPPING,
  LOCAL_APPS: () => LOCAL_APPS,
  MAPPING_DEFAULT_WIDGET: () => MAPPING_DEFAULT_WIDGET,
  MODALITIES: () => MODALITIES,
  MODALITY_LABELS: () => MODALITY_LABELS,
  MODEL_LIBRARIES_UI_ELEMENTS: () => MODEL_LIBRARIES_UI_ELEMENTS,
  PIPELINE_DATA: () => PIPELINE_DATA,
  PIPELINE_TYPES: () => PIPELINE_TYPES,
  PIPELINE_TYPES_SET: () => PIPELINE_TYPES_SET,
  SKUS: () => SKUS,
  SPECIAL_TOKENS_ATTRIBUTES: () => SPECIAL_TOKENS_ATTRIBUTES,
  SUBTASK_TYPES: () => SUBTASK_TYPES,
  TASKS_DATA: () => TASKS_DATA,
  TASKS_MODEL_LIBRARIES: () => TASKS_MODEL_LIBRARIES,
  parseGGUFQuantLabel: () => parseGGUFQuantLabel,
  snippets: () => snippets_exports
});
module.exports = __toCommonJS(src_exports);

// src/library-to-tasks.ts
var LIBRARY_TASK_MAPPING = {
  "adapter-transformers": ["question-answering", "text-classification", "token-classification"],
  allennlp: ["question-answering"],
  asteroid: [
    // "audio-source-separation",
    "audio-to-audio"
  ],
  bertopic: ["text-classification"],
  diffusers: ["image-to-image", "text-to-image"],
  doctr: ["object-detection"],
  espnet: ["text-to-speech", "automatic-speech-recognition"],
  fairseq: ["text-to-speech", "audio-to-audio"],
  fastai: ["image-classification"],
  fasttext: ["feature-extraction", "text-classification"],
  flair: ["token-classification"],
  k2: ["automatic-speech-recognition"],
  keras: ["image-classification"],
  nemo: ["automatic-speech-recognition"],
  open_clip: ["zero-shot-classification", "zero-shot-image-classification"],
  paddlenlp: ["fill-mask", "summarization", "zero-shot-classification"],
  peft: ["text-generation"],
  "pyannote-audio": ["automatic-speech-recognition"],
  "sentence-transformers": ["feature-extraction", "sentence-similarity"],
  setfit: ["text-classification"],
  sklearn: ["tabular-classification", "tabular-regression", "text-classification"],
  spacy: ["token-classification", "text-classification", "sentence-similarity"],
  "span-marker": ["token-classification"],
  speechbrain: [
    "audio-classification",
    "audio-to-audio",
    "automatic-speech-recognition",
    "text-to-speech",
    "text2text-generation"
  ],
  stanza: ["token-classification"],
  timm: ["image-classification"],
  transformers: [
    "audio-classification",
    "automatic-speech-recognition",
    "depth-estimation",
    "document-question-answering",
    "feature-extraction",
    "fill-mask",
    "image-classification",
    "image-segmentation",
    "image-to-image",
    "image-to-text",
    "object-detection",
    "question-answering",
    "summarization",
    "table-question-answering",
    "text2text-generation",
    "text-classification",
    "text-generation",
    "text-to-audio",
    "text-to-speech",
    "token-classification",
    "translation",
    "video-classification",
    "visual-question-answering",
    "zero-shot-classification",
    "zero-shot-image-classification",
    "zero-shot-object-detection"
  ],
  mindspore: ["image-classification"]
};

// src/default-widget-inputs.ts
var MAPPING_EN = /* @__PURE__ */ new Map([
  ["text-classification", [`I like you. I love you`]],
  [
    "token-classification",
    [
      `My name is Wolfgang and I live in Berlin`,
      `My name is Sarah and I live in London`,
      `My name is Clara and I live in Berkeley, California.`
    ]
  ],
  [
    "table-question-answering",
    [
      {
        text: `How many stars does the transformers repository have?`,
        table: {
          Repository: ["Transformers", "Datasets", "Tokenizers"],
          Stars: [36542, 4512, 3934],
          Contributors: [651, 77, 34],
          "Programming language": ["Python", "Python", "Rust, Python and NodeJS"]
        }
      }
    ]
  ],
  [
    "question-answering",
    [
      {
        text: `Where do I live?`,
        context: `My name is Wolfgang and I live in Berlin`
      },
      {
        text: `Where do I live?`,
        context: `My name is Sarah and I live in London`
      },
      {
        text: `What's my name?`,
        context: `My name is Clara and I live in Berkeley.`
      },
      {
        text: `Which name is also used to describe the Amazon rainforest in English?`,
        context: `The Amazon rainforest (Portuguese: Floresta Amaz\xF4nica or Amaz\xF4nia; Spanish: Selva Amaz\xF3nica, Amazon\xEDa or usually Amazonia; French: For\xEAt amazonienne; Dutch: Amazoneregenwoud), also known in English as Amazonia or the Amazon Jungle, is a moist broadleaf forest that covers most of the Amazon basin of South America. This basin encompasses 7,000,000 square kilometres (2,700,000 sq mi), of which 5,500,000 square kilometres (2,100,000 sq mi) are covered by the rainforest. This region includes territory belonging to nine nations. The majority of the forest is contained within Brazil, with 60% of the rainforest, followed by Peru with 13%, Colombia with 10%, and with minor amounts in Venezuela, Ecuador, Bolivia, Guyana, Suriname and French Guiana. States or departments in four nations contain "Amazonas" in their names. The Amazon represents over half of the planet's remaining rainforests, and comprises the largest and most biodiverse tract of tropical rainforest in the world, with an estimated 390 billion individual trees divided into 16,000 species.`
      }
    ]
  ],
  [
    "zero-shot-classification",
    [
      {
        text: "I have a problem with my iphone that needs to be resolved asap!!",
        candidate_labels: "urgent, not urgent, phone, tablet, computer",
        multi_class: true
      },
      {
        text: "Last week I upgraded my iOS version and ever since then my phone has been overheating whenever I use your app.",
        candidate_labels: "mobile, website, billing, account access",
        multi_class: false
      },
      {
        text: "A new model offers an explanation for how the Galilean satellites formed around the solar system\u2019s largest world. Konstantin Batygin did not set out to solve one of the solar system\u2019s most puzzling mysteries when he went for a run up a hill in Nice, France. Dr. Batygin, a Caltech researcher, best known for his contributions to the search for the solar system\u2019s missing \u201CPlanet Nine,\u201D spotted a beer bottle. At a steep, 20 degree grade, he wondered why it wasn\u2019t rolling down the hill. He realized there was a breeze at his back holding the bottle in place. Then he had a thought that would only pop into the mind of a theoretical astrophysicist: \u201COh! This is how Europa formed.\u201D Europa is one of Jupiter\u2019s four large Galilean moons. And in a paper published Monday in the Astrophysical Journal, Dr. Batygin and a co-author, Alessandro Morbidelli, a planetary scientist at the C\xF4te d\u2019Azur Observatory in France, present a theory explaining how some moons form around gas giants like Jupiter and Saturn, suggesting that millimeter-sized grains of hail produced during the solar system\u2019s formation became trapped around these massive worlds, taking shape one at a time into the potentially habitable moons we know today.",
        candidate_labels: "space & cosmos, scientific discovery, microbiology, robots, archeology",
        multi_class: true
      }
    ]
  ],
  ["translation", [`My name is Wolfgang and I live in Berlin`, `My name is Sarah and I live in London`]],
  [
    "summarization",
    [
      `The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 metres. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 metres (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct.`
    ]
  ],
  [
    "conversational",
    [
      `Hey my name is Julien! How are you?`,
      `Hey my name is Thomas! How are you?`,
      `Hey my name is Mariama! How are you?`,
      `Hey my name is Clara! How are you?`,
      `Hey my name is Julien! How are you?`,
      `Hi.`
    ]
  ],
  [
    "text-generation",
    [
      `My name is Julien and I like to`,
      `My name is Thomas and my main`,
      `My name is Mariama, my favorite`,
      `My name is Clara and I am`,
      `My name is Lewis and I like to`,
      `My name is Merve and my favorite`,
      `My name is Teven and I am`,
      `Once upon a time,`
    ]
  ],
  ["fill-mask", [`Paris is the <mask> of France.`, `The goal of life is <mask>.`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "That is a happy person",
        sentences: ["That is a happy dog", "That is a very happy person", "Today is a sunny day"]
      }
    ]
  ]
]);
var MAPPING_ZH = /* @__PURE__ */ new Map([
  ["text-classification", [`\u6211\u559C\u6B22\u4F60\u3002 \u6211\u7231\u4F60`]],
  ["token-classification", [`\u6211\u53EB\u6C83\u5C14\u592B\u5188\uFF0C\u6211\u4F4F\u5728\u67CF\u6797\u3002`, `\u6211\u53EB\u8428\u62C9\uFF0C\u6211\u4F4F\u5728\u4F26\u6566\u3002`, `\u6211\u53EB\u514B\u62C9\u62C9\uFF0C\u6211\u4F4F\u5728\u52A0\u5DDE\u4F2F\u514B\u5229\u3002`]],
  [
    "question-answering",
    [
      {
        text: `\u6211\u4F4F\u5728\u54EA\u91CC\uFF1F`,
        context: `\u6211\u53EB\u6C83\u5C14\u592B\u5188\uFF0C\u6211\u4F4F\u5728\u67CF\u6797\u3002`
      },
      {
        text: `\u6211\u4F4F\u5728\u54EA\u91CC\uFF1F`,
        context: `\u6211\u53EB\u8428\u62C9\uFF0C\u6211\u4F4F\u5728\u4F26\u6566\u3002`
      },
      {
        text: `\u6211\u7684\u540D\u5B57\u662F\u4EC0\u4E48\uFF1F`,
        context: `\u6211\u53EB\u514B\u62C9\u62C9\uFF0C\u6211\u4F4F\u5728\u4F2F\u514B\u5229\u3002`
      }
    ]
  ],
  ["translation", [`\u6211\u53EB\u6C83\u5C14\u592B\u5188\uFF0C\u6211\u4F4F\u5728\u67CF\u6797\u3002`, `\u6211\u53EB\u8428\u62C9\uFF0C\u6211\u4F4F\u5728\u4F26\u6566\u3002`]],
  [
    "zero-shot-classification",
    [
      {
        text: "\u623F\u95F4\u5E72\u51C0\u660E\u4EAE\uFF0C\u975E\u5E38\u4E0D\u9519",
        candidate_labels: "\u8FD9\u662F\u4E00\u6761\u5DEE\u8BC4, \u8FD9\u662F\u4E00\u6761\u597D\u8BC4"
      }
    ]
  ],
  [
    "summarization",
    [
      `\u8BE5\u5854\u9AD8324\u7C73\uFF081063\u82F1\u5C3A\uFF09\uFF0C\u4E0E\u4E00\u5E6281\u5C42\u7684\u5EFA\u7B51\u7269\u4E00\u6837\u9AD8\uFF0C\u662F\u5DF4\u9ECE\u6700\u9AD8\u7684\u5EFA\u7B51\u7269\u3002 \u5B83\u7684\u5E95\u5EA7\u662F\u65B9\u5F62\u7684\uFF0C\u6BCF\u8FB9\u957F125\u7C73\uFF08410\u82F1\u5C3A\uFF09\u3002 \u5728\u5EFA\u9020\u8FC7\u7A0B\u4E2D\uFF0C\u827E\u83F2\u5C14\u94C1\u5854\u8D85\u8FC7\u4E86\u534E\u76DB\u987F\u7EAA\u5FF5\u7891\uFF0C\u6210\u4E3A\u4E16\u754C\u4E0A\u6700\u9AD8\u7684\u4EBA\u9020\u7ED3\u6784\uFF0C\u5B83\u4FDD\u6301\u4E8641\u5E74\u7684\u5934\u8854\uFF0C\u76F4\u52301930\u5E74\u7EBD\u7EA6\u5E02\u7684\u514B\u83B1\u65AF\u52D2\u5927\u697C\u7AE3\u5DE5\u3002\u8FD9\u662F\u7B2C\u4E00\u4E2A\u5230\u8FBE300\u7C73\u9AD8\u5EA6\u7684\u7ED3\u6784\u3002 \u7531\u4E8E1957\u5E74\u5728\u5854\u9876\u589E\u52A0\u4E86\u5E7F\u64AD\u5929\u7EBF\uFF0C\u56E0\u6B64\u5B83\u73B0\u5728\u6BD4\u514B\u83B1\u65AF\u52D2\u5927\u53A6\u9AD85.2\u7C73\uFF0817\u82F1\u5C3A\uFF09\u3002 \u9664\u53D1\u5C04\u5668\u5916\uFF0C\u827E\u83F2\u5C14\u94C1\u5854\u662F\u6CD5\u56FD\u7B2C\u4E8C\u9AD8\u7684\u72EC\u7ACB\u5F0F\u5EFA\u7B51\uFF0C\u4EC5\u6B21\u4E8E\u7C73\u52B3\u9AD8\u67B6\u6865\u3002`
    ]
  ],
  [
    "text-generation",
    [`\u6211\u53EB\u6731\u5229\u5B89\uFF0C\u6211\u559C\u6B22`, `\u6211\u53EB\u6258\u9A6C\u65AF\uFF0C\u6211\u7684\u4E3B\u8981`, `\u6211\u53EB\u739B\u4E3D\u4E9A\uFF0C\u6211\u6700\u559C\u6B22\u7684`, `\u6211\u53EB\u514B\u62C9\u62C9\uFF0C\u6211\u662F`, `\u4ECE\u524D\uFF0C`]
  ],
  ["fill-mask", [`\u5DF4\u9ECE\u662F<mask>\u56FD\u7684\u9996\u90FD\u3002`, `\u751F\u6D3B\u7684\u771F\u8C1B\u662F<mask>\u3002`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "\u90A3\u662F \u500B\u5FEB\u6A02\u7684\u4EBA",
        sentences: ["\u90A3\u662F \u689D\u5FEB\u6A02\u7684\u72D7", "\u90A3\u662F \u500B\u975E\u5E38\u5E78\u798F\u7684\u4EBA", "\u4ECA\u5929\u662F\u6674\u5929"]
      }
    ]
  ]
]);
var MAPPING_FR = /* @__PURE__ */ new Map([
  ["text-classification", [`Je t'appr\xE9cie beaucoup. Je t'aime.`]],
  ["token-classification", [`Mon nom est Wolfgang et je vis \xE0 Berlin`]],
  [
    "question-answering",
    [
      {
        text: `O\xF9 est-ce que je vis?`,
        context: `Mon nom est Wolfgang et je vis \xE0 Berlin`
      }
    ]
  ],
  ["translation", [`Mon nom est Wolfgang et je vis \xE0 Berlin`]],
  [
    "summarization",
    [
      `La tour fait 324 m\xE8tres (1,063 pieds) de haut, environ la m\xEAme hauteur qu'un immeuble de 81 \xE9tages, et est la plus haute structure de Paris. Sa base est carr\xE9e, mesurant 125 m\xE8tres (410 pieds) sur chaque c\xF4t\xE9. Durant sa construction, la tour Eiffel surpassa le Washington Monument pour devenir la plus haute structure construite par l'homme dans le monde, un titre qu'elle conserva pendant 41 ans jusqu'\xE0 l'ach\xE8vement du Chrysler Building \xE0 New-York City en 1930. Ce fut la premi\xE8re structure \xE0 atteindre une hauteur de 300 m\xE8tres. Avec l'ajout d'une antenne de radiodiffusion au sommet de la tour Eiffel en 1957, celle-ci redevint plus haute que le Chrysler Building de 5,2 m\xE8tres (17 pieds). En excluant les transmetteurs, elle est la seconde plus haute stucture autoportante de France apr\xE8s le viaduc de Millau.`
    ]
  ],
  ["text-generation", [`Mon nom est Julien et j'aime`, `Mon nom est Thomas et mon principal`, `Il \xE9tait une fois`]],
  ["fill-mask", [`Paris est la <mask> de la France.`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "C'est une personne heureuse",
        sentences: [
          "C'est un chien heureux",
          "C'est une personne tr\xE8s heureuse",
          "Aujourd'hui est une journ\xE9e ensoleill\xE9e"
        ]
      }
    ]
  ]
]);
var MAPPING_ES = /* @__PURE__ */ new Map([
  ["text-classification", [`Te quiero. Te amo.`]],
  ["token-classification", [`Me llamo Wolfgang y vivo en Berlin`]],
  [
    "question-answering",
    [
      {
        text: `\xBFD\xF3nde vivo?`,
        context: `Me llamo Wolfgang y vivo en Berlin`
      },
      {
        text: `\xBFQui\xE9n invent\xF3 el submarino?`,
        context: `Isaac Peral fue un murciano que invent\xF3 el submarino`
      },
      {
        text: `\xBFCu\xE1ntas personas hablan espa\xF1ol?`,
        context: `El espa\xF1ol es el segundo idioma m\xE1s hablado del mundo con m\xE1s de 442 millones de hablantes`
      }
    ]
  ],
  [
    "translation",
    [
      `Me llamo Wolfgang y vivo en Berlin`,
      `Los ingredientes de una tortilla de patatas son: huevos, patatas y cebolla`
    ]
  ],
  [
    "summarization",
    [
      `La torre tiene 324 metros (1.063 pies) de altura, aproximadamente la misma altura que un edificio de 81 pisos y la estructura m\xE1s alta de Par\xEDs. Su base es cuadrada, mide 125 metros (410 pies) a cada lado. Durante su construcci\xF3n, la Torre Eiffel super\xF3 al Washington Monument para convertirse en la estructura artificial m\xE1s alta del mundo, un t\xEDtulo que mantuvo durante 41 a\xF1os hasta que el Chrysler Building en la ciudad de Nueva York se termin\xF3 en 1930. Fue la primera estructura en llegar Una altura de 300 metros. Debido a la adici\xF3n de una antena de transmisi\xF3n en la parte superior de la torre en 1957, ahora es m\xE1s alta que el Chrysler Building en 5,2 metros (17 pies). Excluyendo los transmisores, la Torre Eiffel es la segunda estructura independiente m\xE1s alta de Francia despu\xE9s del Viaducto de Millau.`
    ]
  ],
  [
    "text-generation",
    [
      `Me llamo Julien y me gusta`,
      `Me llamo Thomas y mi principal`,
      `Me llamo Manuel y trabajo en`,
      `\xC9rase una vez,`,
      `Si t\xFA me dices ven, `
    ]
  ],
  ["fill-mask", [`Mi nombre es <mask> y vivo en Nueva York.`, `El espa\xF1ol es un idioma muy <mask> en el mundo.`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "Esa es una persona feliz",
        sentences: ["Ese es un perro feliz", "Esa es una persona muy feliz", "Hoy es un d\xEDa soleado"]
      }
    ]
  ]
]);
var MAPPING_RU = /* @__PURE__ */ new Map([
  ["text-classification", [`\u0422\u044B \u043C\u043D\u0435 \u043D\u0440\u0430\u0432\u0438\u0448\u044C\u0441\u044F. \u042F \u0442\u0435\u0431\u044F \u043B\u044E\u0431\u043B\u044E`]],
  ["token-classification", [`\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 \u0412\u043E\u043B\u044C\u0444\u0433\u0430\u043D\u0433 \u0438 \u044F \u0436\u0438\u0432\u0443 \u0432 \u0411\u0435\u0440\u043B\u0438\u043D\u0435`]],
  [
    "question-answering",
    [
      {
        text: `\u0413\u0434\u0435 \u0436\u0438\u0432\u0443?`,
        context: `\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 \u0412\u043E\u043B\u044C\u0444\u0433\u0430\u043D\u0433 \u0438 \u044F \u0436\u0438\u0432\u0443 \u0432 \u0411\u0435\u0440\u043B\u0438\u043D\u0435`
      }
    ]
  ],
  ["translation", [`\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 \u0412\u043E\u043B\u044C\u0444\u0433\u0430\u043D\u0433 \u0438 \u044F \u0436\u0438\u0432\u0443 \u0432 \u0411\u0435\u0440\u043B\u0438\u043D\u0435`]],
  [
    "summarization",
    [
      `\u0412\u044B\u0441\u043E\u0442\u0430 \u0431\u0430\u0448\u043D\u0438 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 324 \u043C\u0435\u0442\u0440\u0430 (1063 \u0444\u0443\u0442\u0430), \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E \u0442\u0430\u043A\u0430\u044F \u0436\u0435 \u0432\u044B\u0441\u043E\u0442\u0430, \u043A\u0430\u043A \u0443 81-\u044D\u0442\u0430\u0436\u043D\u043E\u0433\u043E \u0437\u0434\u0430\u043D\u0438\u044F, \u0438 \u0441\u0430\u043C\u043E\u0435 \u0432\u044B\u0441\u043E\u043A\u043E\u0435 \u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435 \u0432 \u041F\u0430\u0440\u0438\u0436\u0435. \u0415\u0433\u043E \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u043E, \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C 125 \u043C\u0435\u0442\u0440\u043E\u0432 (410 \u0444\u0443\u0442\u043E\u0432) \u0441 \u043B\u044E\u0431\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u044B. \u0412\u043E \u0432\u0440\u0435\u043C\u044F \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430 \u042D\u0439\u0444\u0435\u043B\u0435\u0432\u0430 \u0431\u0430\u0448\u043D\u044F \u043F\u0440\u0435\u0432\u0437\u043E\u0448\u043B\u0430 \u043C\u043E\u043D\u0443\u043C\u0435\u043D\u0442 \u0412\u0430\u0448\u0438\u043D\u0433\u0442\u043E\u043D\u0430, \u0441\u0442\u0430\u0432 \u0441\u0430\u043C\u044B\u043C \u0432\u044B\u0441\u043E\u043A\u0438\u043C \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u043C \u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435\u043C \u0432 \u043C\u0438\u0440\u0435, \u0438 \u044D\u0442\u043E\u0442 \u0442\u0438\u0442\u0443\u043B \u043E\u043D\u0430 \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u043B\u0430 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 41 \u0433\u043E\u0434\u0430 \u0434\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E \u0437\u0434\u0430\u043D\u0438\u044F \u041A\u0440\u0430\u0439\u0441\u043B\u0435\u0440 \u0432 \u041D\u044C\u044E-\u0419\u043E\u0440\u043A\u0435 \u0432 1930 \u0433\u043E\u0434\u0443. \u042D\u0442\u043E \u043F\u0435\u0440\u0432\u043E\u0435 \u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435 \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0434\u043E\u0441\u0442\u0438\u0433\u043B\u043E \u0432\u044B\u0441\u043E\u0442\u044B 300 \u043C\u0435\u0442\u0440\u043E\u0432. \u0418\u0437-\u0437\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0430\u043D\u0442\u0435\u043D\u043D\u044B \u043D\u0430 \u0432\u0435\u0440\u0448\u0438\u043D\u0435 \u0431\u0430\u0448\u043D\u0438 \u0432 1957 \u0433\u043E\u0434\u0443 \u043E\u043D\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u0432\u044B\u0448\u0435 \u0437\u0434\u0430\u043D\u0438\u044F \u041A\u0440\u0430\u0439\u0441\u043B\u0435\u0440 \u043D\u0430 5,2 \u043C\u0435\u0442\u0440\u0430 (17 \u0444\u0443\u0442\u043E\u0432). \u0417\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u043F\u0435\u0440\u0435\u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432, \u042D\u0439\u0444\u0435\u043B\u0435\u0432\u0430 \u0431\u0430\u0448\u043D\u044F \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0432\u0442\u043E\u0440\u043E\u0439 \u0441\u0430\u043C\u043E\u0439 \u0432\u044B\u0441\u043E\u043A\u043E\u0439 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0441\u0442\u043E\u044F\u0449\u0435\u0439 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u043E\u0439 \u0432\u043E \u0424\u0440\u0430\u043D\u0446\u0438\u0438 \u043F\u043E\u0441\u043B\u0435 \u0432\u0438\u0430\u0434\u0443\u043A\u0430 \u041C\u0438\u0439\u043E.`
    ]
  ],
  ["text-generation", [`\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 \u0416\u044E\u043B\u044C\u0435\u043D \u0438`, `\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 \u0422\u043E\u043C\u0430\u0441 \u0438 \u043C\u043E\u0439 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439`, `\u041E\u0434\u043D\u0430\u0436\u0434\u044B`]],
  ["fill-mask", [`\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 <mask> \u0438 \u044F \u0438\u043D\u0436\u0435\u043D\u0435\u0440 \u0436\u0438\u0432\u0443\u0449\u0438\u0439 \u0432 \u041D\u044C\u044E-\u0419\u043E\u0440\u043A\u0435.`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "\u042D\u0442\u043E \u0441\u0447\u0430\u0441\u0442\u043B\u0438\u0432\u044B\u0439 \u0447\u0435\u043B\u043E\u0432\u0435\u043A",
        sentences: ["\u042D\u0442\u043E \u0441\u0447\u0430\u0441\u0442\u043B\u0438\u0432\u0430\u044F \u0441\u043E\u0431\u0430\u043A\u0430", "\u042D\u0442\u043E \u043E\u0447\u0435\u043D\u044C \u0441\u0447\u0430\u0441\u0442\u043B\u0438\u0432\u044B\u0439 \u0447\u0435\u043B\u043E\u0432\u0435\u043A", "\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0439 \u0434\u0435\u043D\u044C"]
      }
    ]
  ]
]);
var MAPPING_UK = /* @__PURE__ */ new Map([
  ["translation", [`\u041C\u0435\u043D\u0435 \u0437\u0432\u0430\u0442\u0438 \u0412\u043E\u043B\u044C\u0444\u0491\u0430\u043D\u0491 \u0456 \u044F \u0436\u0438\u0432\u0443 \u0432 \u0411\u0435\u0440\u043B\u0456\u043D\u0456.`]],
  ["fill-mask", [`\u041C\u0435\u043D\u0435 \u0437\u0432\u0430\u0442\u0438 <mask>.`]]
]);
var MAPPING_IT = /* @__PURE__ */ new Map([
  ["text-classification", [`Mi piaci. Ti amo`]],
  [
    "token-classification",
    [
      `Mi chiamo Wolfgang e vivo a Berlino`,
      `Mi chiamo Sarah e vivo a Londra`,
      `Mi chiamo Clara e vivo a Berkeley in California.`
    ]
  ],
  [
    "question-answering",
    [
      {
        text: `Dove vivo?`,
        context: `Mi chiamo Wolfgang e vivo a Berlino`
      },
      {
        text: `Dove vivo?`,
        context: `Mi chiamo Sarah e vivo a Londra`
      },
      {
        text: `Come mio chiamo?`,
        context: `Mi chiamo Clara e vivo a Berkeley.`
      }
    ]
  ],
  ["translation", [`Mi chiamo Wolfgang e vivo a Berlino`, `Mi chiamo Sarah e vivo a Londra`]],
  [
    "summarization",
    [
      `La torre degli Asinelli \xE8 una delle cosiddette due torri di Bologna, simbolo della citt\xE0, situate in piazza di porta Ravegnana, all'incrocio tra le antiche strade San Donato (ora via Zamboni), San Vitale, Maggiore e Castiglione. Eretta, secondo la tradizione, fra il 1109 e il 1119 dal nobile Gherardo Asinelli, la torre \xE8 alta 97,20 metri, pende verso ovest per 2,23 metri e presenta all'interno una scalinata composta da 498 gradini. Ancora non si pu\xF2 dire con certezza quando e da chi fu costruita la torre degli Asinelli. Si presume che la torre debba il proprio nome a Gherardo Asinelli, il nobile cavaliere di fazione ghibellina al quale se ne attribuisce la costruzione, iniziata secondo una consolidata tradizione l'11 ottobre 1109 e terminata dieci anni dopo, nel 1119.`
    ]
  ],
  [
    "text-generation",
    [
      `Mi chiamo Loreto e mi piace`,
      `Mi chiamo Thomas e il mio principale`,
      `Mi chiamo Marianna, la mia cosa preferita`,
      `Mi chiamo Clara e sono`,
      `C'era una volta`
    ]
  ],
  ["fill-mask", [`Roma \xE8 la <mask> d'Italia.`, `Lo scopo della vita \xE8 <mask>.`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "Questa \xE8 una persona felice",
        sentences: ["Questo \xE8 un cane felice", "Questa \xE8 una persona molto felice", "Oggi \xE8 una giornata di sole"]
      }
    ]
  ]
]);
var MAPPING_FA = /* @__PURE__ */ new Map([
  [
    "text-classification",
    [`\u067E\u0631\u0648\u0698\u0647 \u0628\u0647 \u0645\u0648\u0642\u0639 \u062A\u062D\u0648\u06CC\u0644 \u0634\u062F \u0648 \u0647\u0645\u0647 \u0686\u06CC\u0632 \u062E\u0648\u0628 \u0628\u0648\u062F.`, `\u0633\u06CC\u0628\u200C\u0632\u0645\u06CC\u0646\u06CC \u0628\u06CC\u200C\u06A9\u06CC\u0641\u06CC\u062A \u0628\u0648\u062F.`, `\u0642\u06CC\u0645\u062A \u0648 \u06A9\u06CC\u0641\u06CC\u062A \u0639\u0627\u0644\u06CC`, `\u062E\u0648\u0628 \u0646\u0628\u0648\u062F \u0627\u0635\u0644\u0627`]
  ],
  [
    "token-classification",
    [
      `\u0627\u06CC\u0646 \u0633\u0631\u06CC\u0627\u0644 \u0628\u0647 \u0635\u0648\u0631\u062A \u0631\u0633\u0645\u06CC \u062F\u0631 \u062A\u0627\u0631\u06CC\u062E \u062F\u0647\u0645 \u0645\u06CC \u06F2\u06F0\u06F1\u06F1 \u062A\u0648\u0633\u0637 \u0634\u0628\u06A9\u0647 \u0641\u0627\u06A9\u0633 \u0628\u0631\u0627\u06CC \u067E\u062E\u0634 \u0631\u0632\u0631\u0648 \u0634\u062F.`,
      `\u062F\u0641\u062A\u0631 \u0645\u0631\u06A9\u0632\u06CC \u0634\u0631\u06A9\u062A \u067E\u0627\u0631\u0633\u200C\u0645\u06CC\u0646\u0648 \u062F\u0631 \u0634\u0647\u0631 \u0627\u0631\u0627\u06A9 \u062F\u0631 \u0627\u0633\u062A\u0627\u0646 \u0645\u0631\u06A9\u0632\u06CC \u0642\u0631\u0627\u0631 \u062F\u0627\u0631\u062F.`,
      `\u0648\u06CC \u062F\u0631 \u0633\u0627\u0644 \u06F2\u06F0\u06F1\u06F3 \u062F\u0631\u06AF\u0630\u0634\u062A \u0648 \u0645\u0633\u0626\u0648\u0644 \u062E\u0627\u06A9\u0633\u067E\u0627\u0631\u06CC \u0648 \u0627\u0642\u0648\u0627\u0645\u0634 \u0628\u0631\u0627\u06CC \u0627\u0648 \u0645\u0631\u0627\u0633\u0645 \u06CC\u0627\u062F\u0628\u0648\u062F \u06AF\u0631\u0641\u062A\u0646\u062F.`
    ]
  ],
  [
    "question-answering",
    [
      {
        text: `\u0645\u0646 \u06A9\u062C\u0627 \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u06A9\u0646\u0645\u061F`,
        context: `\u0646\u0627\u0645 \u0645\u0646 \u067E\u0698\u0645\u0627\u0646 \u0627\u0633\u062A \u0648 \u062F\u0631 \u06AF\u0631\u06AF\u0627\u0646 \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u06A9\u0646\u0645.`
      },
      {
        text: `\u0646\u0627\u0645\u0645 \u0686\u06CC\u0633\u062A \u0648 \u06A9\u062C\u0627 \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u200C\u06A9\u0646\u0645\u061F`,
        context: `\u0627\u0633\u0645\u0645 \u0633\u0627\u0631\u0627 \u0627\u0633\u062A \u0648 \u062F\u0631 \u0622\u0641\u0631\u06CC\u0642\u0627\u06CC \u062C\u0646\u0648\u0628\u06CC \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u06A9\u0646\u0645.`
      },
      {
        text: `\u0646\u0627\u0645 \u0645\u0646 \u0686\u06CC\u0633\u062A\u061F`,
        context: `\u0645\u0646 \u0645\u0631\u06CC\u0645 \u0647\u0633\u062A\u0645 \u0648 \u062F\u0631 \u062A\u0628\u0631\u06CC\u0632 \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u200C\u06A9\u0646\u0645.`
      },
      {
        text: `\u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0645\u0633\u0627\u062D\u062A \u062C\u0646\u06AF\u0644 \u0622\u0645\u0627\u0632\u0648\u0646 \u062F\u0631 \u06A9\u062F\u0627\u0645 \u06A9\u0634\u0648\u0631 \u0627\u0633\u062A\u061F`,
        context: [
          "\u0622\u0645\u0627\u0632\u0648\u0646 \u0646\u0627\u0645 \u0628\u0632\u0631\u06AF\u200C\u062A\u0631\u06CC\u0646 \u062C\u0646\u06AF\u0644 \u0628\u0627\u0631\u0627\u0646\u06CC \u062C\u0647\u0627\u0646 \u0627\u0633\u062A \u06A9\u0647 \u062F\u0631 \u0634\u0645\u0627\u0644 \u0622\u0645\u0631\u06CC\u06A9\u0627\u06CC \u062C\u0646\u0648\u0628\u06CC \u0642\u0631\u0627\u0631 \u06AF\u0631\u0641\u062A\u0647 \u0648 \u0628\u06CC\u0634\u062A\u0631 \u0622\u0646 \u062F\u0631 \u062E\u0627\u06A9 \u0628\u0631\u0632\u06CC\u0644 \u0648 \u067E\u0631\u0648",
          "\u062C\u0627\u06CC \u062F\u0627\u0631\u062F. \u0628\u06CC\u0634 \u0627\u0632 \u0646\u06CC\u0645\u06CC \u0627\u0632 \u0647\u0645\u0647 \u062C\u0646\u06AF\u0644\u200C\u0647\u0627\u06CC \u0628\u0627\u0631\u0627\u0646\u06CC \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647 \u062F\u0631 \u062C\u0647\u0627\u0646 \u062F\u0631 \u0622\u0645\u0627\u0632\u0648\u0646 \u0642\u0631\u0627\u0631 \u062F\u0627\u0631\u062F.",
          "\u0645\u0633\u0627\u062D\u062A \u062C\u0646\u06AF\u0644\u200C\u0647\u0627\u06CC \u0622\u0645\u0627\u0632\u0648\u0646 \u06F5\u066B\u06F5 \u0645\u06CC\u0644\u06CC\u0648\u0646 \u06A9\u06CC\u0644\u0648\u0645\u062A\u0631 \u0645\u0631\u0628\u0639 \u0627\u0633\u062A \u06A9\u0647 \u0628\u06CC\u0646 \u06F9 \u06A9\u0634\u0648\u0631 \u062A\u0642\u0633\u06CC\u0645 \u0634\u062F\u0647\u200C\u0627\u0633\u062A."
        ].join("\n")
      }
    ]
  ],
  [
    "translation",
    [
      "\u0628\u06CC\u0634\u062A\u0631 \u0645\u0633\u0627\u062D\u062A \u062C\u0646\u06AF\u0644\u200C\u0647\u0627\u06CC \u0622\u0645\u0627\u0632\u0648\u0646 \u062F\u0631 \u062D\u0648\u0636\u0647 \u0622\u0628\u0631\u06CC\u0632 \u0631\u0648\u062F \u0622\u0645\u0627\u0632\u0648\u0646 \u0648 \u06F1\u06F1\u06F0\u06F0 \u0634\u0627\u062E\u0647 \u0622\u0646 \u0648\u0627\u0642\u0639 \u0634\u062F\u0647\u200C\u0627\u0633\u062A.",
      "\u0645\u0631\u062F\u0645\u0627\u0646 \u0646\u064E\u0628\u064E\u0637\u06CC \u0627\u0632 \u0647\u0632\u0627\u0631\u0647\u200C\u0647\u0627\u06CC \u06CC\u06A9\u0645 \u0648 \u062F\u0648\u0645 \u067E\u06CC\u0634 \u0627\u0632 \u0645\u06CC\u0644\u0627\u062F \u062F\u0631 \u0627\u06CC\u0646 \u0645\u0646\u0637\u0642\u0647 \u0632\u0646\u062F\u06AF\u06CC \u0645\u06CC\u200C\u06A9\u0631\u062F\u0646\u062F."
    ]
  ],
  [
    "summarization",
    [
      [
        "\u0634\u0627\u0647\u0646\u0627\u0645\u0647 \u0627\u062B\u0631 \u062D\u06A9\u06CC\u0645 \u0627\u0628\u0648\u0627\u0644\u0642\u0627\u0633\u0645 \u0641\u0631\u062F\u0648\u0633\u06CC \u062A\u0648\u0633\u06CC\u060C \u062D\u0645\u0627\u0633\u0647\u200C\u0627\u06CC \u0645\u0646\u0638\u0648\u0645\u060C \u0628\u0631 \u062D\u0633\u0628 \u062F\u0633\u062A \u0646\u0648\u0634\u062A\u0647\u200C\u0647\u0627\u06CC ",
        "\u0645\u0648\u062C\u0648\u062F \u062F\u0631\u0628\u0631\u06AF\u06CC\u0631\u0646\u062F\u0647 \u0646\u0632\u062F\u06CC\u06A9 \u0628\u0647 \u06F5\u06F0\u066C\u06F0\u06F0\u06F0 \u0628\u06CC\u062A \u062A\u0627 \u0646\u0632\u062F\u06CC\u06A9 \u0628\u0647 \u06F6\u06F1\u066C\u06F0\u06F0\u06F0 \u0628\u06CC\u062A \u0648 \u06CC\u06A9\u06CC \u0627\u0632 ",
        "\u0628\u0632\u0631\u06AF\u200C\u062A\u0631\u06CC\u0646 \u0648 \u0628\u0631\u062C\u0633\u062A\u0647\u200C\u062A\u0631\u06CC\u0646 \u0633\u0631\u0648\u062F\u0647\u200C\u0647\u0627\u06CC \u062D\u0645\u0627\u0633\u06CC \u062C\u0647\u0627\u0646 \u0627\u0633\u062A \u06A9\u0647 \u0633\u0631\u0627\u06CC\u0634 \u0622\u0646 \u062F\u0633\u062A\u200C\u0622\u0648\u0631\u062F\u0650 ",
        "\u062F\u0633\u062A\u200C\u06A9\u0645 \u0633\u06CC \u0633\u0627\u0644 \u06A9\u0627\u0631\u0650 \u067E\u06CC\u0648\u0633\u062A\u0647\u0654 \u0627\u06CC\u0646 \u0633\u062E\u0646\u200C\u0633\u0631\u0627\u06CC \u0646\u0627\u0645\u062F\u0627\u0631 \u0627\u06CC\u0631\u0627\u0646\u06CC \u0627\u0633\u062A. \u0645\u0648\u0636\u0648\u0639 \u0627\u06CC\u0646 \u0634\u0627\u0647\u06A9\u0627\u0631 \u0627\u062F\u0628\u06CC\u060C",
        " \u0627\u0641\u0633\u0627\u0646\u0647\u200C\u0647\u0627 \u0648 \u062A\u0627\u0631\u06CC\u062E \u0627\u06CC\u0631\u0627\u0646 \u0627\u0632 \u0622\u063A\u0627\u0632 \u062A\u0627 \u062D\u0645\u0644\u0647\u0654 \u0639\u0631\u0628\u200C\u0647\u0627 \u0628\u0647 \u0627\u06CC\u0631\u0627\u0646 \u062F\u0631 \u0633\u062F\u0647\u0654 \u0647\u0641\u062A\u0645 \u0645\u06CC\u0644\u0627\u062F\u06CC \u0627\u0633\u062A",
        "  (\u0634\u0627\u0647\u0646\u0627\u0645\u0647 \u0627\u0632 \u0633\u0647 \u0628\u062E\u0634 \u0627\u0633\u0637\u0648\u0631\u0647\u060C \u067E\u0647\u0644\u0648\u0627\u0646\u06CC \u0648 \u062A\u0627\u0631\u06CC\u062E\u06CC \u062A\u0634\u06A9\u06CC\u0644 \u0634\u062F\u0647\u200C\u0627\u0633\u062A) \u06A9\u0647 \u062F\u0631 \u0686\u0647\u0627\u0631",
        "   \u062F\u0648\u062F\u0645\u0627\u0646 \u067E\u0627\u062F\u0634\u0627\u0647\u06CC\u0650 \u067E\u06CC\u0634\u062F\u0627\u062F\u06CC\u0627\u0646\u060C \u06A9\u06CC\u0627\u0646\u06CC\u0627\u0646\u060C \u0627\u0634\u06A9\u0627\u0646\u06CC\u0627\u0646 \u0648 \u0633\u0627\u0633\u0627\u0646\u06CC\u0627\u0646 \u06AF\u0646\u062C\u0627\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
        "    \u0634\u0627\u0647\u0646\u0627\u0645\u0647 \u0628\u0631 \u0648\u0632\u0646 \xAB\u0641\u064E\u0639\u0648\u0644\u064F\u0646 \u0641\u0639\u0648\u0644\u0646 \u0641\u0639\u0648\u0644\u0646 \u0641\u064E\u0639\u064E\u0644\u0652\xBB\u060C \u062F\u0631 \u0628\u062D\u0631\u0650 \u0645\u064F\u062A\u064E\u0642\u0627\u0631\u0650\u0628\u0650 \u0645\u062B\u0645\u064E\u0651\u0646\u0650 \u0645\u062D\u0630\u0648\u0641 \u0646\u06AF\u0627\u0634\u062A\u0647 \u0634\u062F\u0647\u200C\u0627\u0633\u062A.",
        "\u0647\u0646\u06AF\u0627\u0645\u06CC \u06A9\u0647 \u0632\u0628\u0627\u0646 \u062F\u0627\u0646\u0634 \u0648 \u0627\u062F\u0628\u06CC\u0627\u062A \u062F\u0631 \u0627\u06CC\u0631\u0627\u0646 \u0632\u0628\u0627\u0646 \u0639\u0631\u0628\u06CC \u0628\u0648\u062F\u060C \u0641\u0631\u062F\u0648\u0633\u06CC\u060C \u0628\u0627 \u0633\u0631\u0648\u062F\u0646 \u0634\u0627\u0647\u0646\u0627\u0645\u0647",
        " \u0628\u0627 \u0648\u06CC\u0698\u06AF\u06CC\u200C\u0647\u0627\u06CC \u0647\u062F\u0641\u200C\u0645\u0646\u062F\u06CC \u06A9\u0647 \u062F\u0627\u0634\u062A\u060C \u0632\u0628\u0627\u0646 \u067E\u0627\u0631\u0633\u06CC \u0631\u0627 \u0632\u0646\u062F\u0647 \u0648 \u067E\u0627\u06CC\u062F\u0627\u0631 \u06A9\u0631\u062F. \u06CC\u06A9\u06CC \u0627\u0632 ",
        " \u0628\u0646\u200C\u0645\u0627\u06CC\u0647\u200C\u0647\u0627\u06CC \u0645\u0647\u0645\u06CC \u06A9\u0647 \u0641\u0631\u062F\u0648\u0633\u06CC \u0628\u0631\u0627\u06CC \u0633\u0631\u0648\u062F\u0646 \u0634\u0627\u0647\u0646\u0627\u0645\u0647 \u0627\u0632 \u0622\u0646 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0631\u062F\u060C",
        "  \u0634\u0627\u0647\u0646\u0627\u0645\u0647\u0654 \u0627\u0628\u0648\u0645\u0646\u0635\u0648\u0631\u06CC \u0628\u0648\u062F. \u0634\u0627\u0647\u0646\u0627\u0645\u0647 \u0646\u0641\u0648\u0630 \u0628\u0633\u06CC\u0627\u0631\u06CC \u062F\u0631 \u062C\u0647\u062A\u200C\u06AF\u06CC\u0631\u06CC ",
        "  \u0641\u0631\u0647\u0646\u06AF \u0641\u0627\u0631\u0633\u06CC \u0648 \u0646\u06CC\u0632 \u0628\u0627\u0632\u062A\u0627\u0628\u200C\u0647\u0627\u06CC \u0634\u06A9\u0648\u0647\u200C\u0645\u0646\u062F\u06CC \u062F\u0631 \u0627\u062F\u0628\u06CC\u0627\u062A \u062C\u0647\u0627\u0646 \u062F\u0627\u0634\u062A\u0647\u200C\u0627\u0633\u062A \u0648 \u0634\u0627\u0639\u0631\u0627\u0646 ",
        "  \u0628\u0632\u0631\u06AF\u06CC \u0645\u0627\u0646\u0646\u062F \u06AF\u0648\u062A\u0647 \u0648 \u0648\u06CC\u06A9\u062A\u0648\u0631 \u0647\u0648\u06AF\u0648 \u0627\u0632 \u0622\u0646 \u0628\u0647 \u0646\u06CC\u06A9\u06CC \u06CC\u0627\u062F \u06A9\u0631\u062F\u0647\u200C\u0627\u0646\u062F."
      ].join("\n")
    ]
  ],
  ["text-generation", ["\u0627\u0633\u0645 \u0645\u0646 \u0646\u0627\u0632\u0646\u06CC\u0646 \u0627\u0633\u062A \u0648 \u0645\u0646", "\u0631\u0648\u0632\u06CC \u0631\u0648\u0632\u06AF\u0627\u0631\u06CC"]],
  [
    "fill-mask",
    [
      `\u0632\u0646\u062F\u06AF\u06CC \u06CC\u06A9 \u0633\u0648\u0627\u0644 \u0627\u0633\u062A \u0648 \u0627\u06CC\u0646 \u06A9\u0647 \u0686\u06AF\u0648\u0646\u0647 <mask> \u06A9\u0646\u06CC\u0645 \u067E\u0627\u0633\u062E \u0627\u06CC\u0646 \u0633\u0648\u0627\u0644!`,
      `\u0632\u0646\u062F\u06AF\u06CC \u0627\u0632 \u0645\u0631\u06AF \u067E\u0631\u0633\u06CC\u062F: \u0686\u0631\u0627 \u0647\u0645\u0647 \u0645\u0646 \u0631\u0627 <mask> \u062F\u0627\u0631\u0646\u062F \u0627\u0645\u0627 \u0627\u0632 \u062A\u0648 \u0645\u062A\u0646\u0641\u0631\u0646\u062F\u061F`
    ]
  ]
]);
var MAPPING_AR = /* @__PURE__ */ new Map([
  ["text-classification", [`\u0623\u062D\u0628\u0643. \u0623\u0647\u0648\u0627\u0643`]],
  [
    "token-classification",
    [`\u0625\u0633\u0645\u064A \u0645\u062D\u0645\u062F \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0628\u0631\u0644\u064A\u0646`, `\u0625\u0633\u0645\u064A \u0633\u0627\u0631\u0647 \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0644\u0646\u062F\u0646`, `\u0625\u0633\u0645\u064A \u0633\u0627\u0645\u064A \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0627\u0644\u0642\u062F\u0633 \u0641\u064A \u0641\u0644\u0633\u0637\u064A\u0646.`]
  ],
  [
    "question-answering",
    [
      {
        text: `\u0623\u064A\u0646 \u0623\u0633\u0643\u0646\u061F`,
        context: `\u0625\u0633\u0645\u064A \u0645\u062D\u0645\u062F \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0628\u064A\u0631\u0648\u062A`
      },
      {
        text: `\u0623\u064A\u0646 \u0623\u0633\u0643\u0646\u061F`,
        context: `\u0625\u0633\u0645\u064A \u0633\u0627\u0631\u0647 \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0644\u0646\u062F\u0646`
      },
      {
        text: `\u0645\u0627 \u0627\u0633\u0645\u064A\u061F`,
        context: `\u0627\u0633\u0645\u064A \u0633\u0639\u064A\u062F \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u062D\u064A\u0641\u0627.`
      },
      {
        text: `\u0645\u0627 \u0644\u0642\u0628 \u062E\u0627\u0644\u062F \u0628\u0646 \u0627\u0644\u0648\u0644\u064A\u062F \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629\u061F`,
        context: `\u062E\u0627\u0644\u062F \u0628\u0646 \u0627\u0644\u0648\u0644\u064A\u062F \u0645\u0646 \u0623\u0628\u0637\u0627\u0644 \u0648\u0642\u0627\u062F\u0629 \u0627\u0644\u0641\u062A\u062D \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A \u0648\u0642\u062F \u062A\u062D\u062F\u062B\u062A \u0639\u0646\u0647 \u0627\u0644\u0644\u063A\u0627\u062A \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0648\u0627\u0644\u0641\u0631\u0646\u0633\u064A\u0629 \u0648\u0627\u0644\u0625\u0633\u0628\u0627\u0646\u064A\u0629 \u0648\u0644\u0642\u0628 \u0628\u0633\u064A\u0641 \u0627\u0644\u0644\u0647 \u0627\u0644\u0645\u0633\u0644\u0648\u0644.`
      }
    ]
  ],
  ["translation", [`\u0625\u0633\u0645\u064A \u0645\u062D\u0645\u062F \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0628\u0631\u0644\u064A\u0646`, `\u0625\u0633\u0645\u064A \u0633\u0627\u0631\u0647 \u0648\u0623\u0633\u0643\u0646 \u0641\u064A \u0644\u0646\u062F\u0646`]],
  [
    "summarization",
    [
      `\u062A\u0642\u0639 \u0627\u0644\u0623\u0647\u0631\u0627\u0645\u0627\u062A \u0641\u064A \u0627\u0644\u062C\u064A\u0632\u0629 \u0642\u0631\u0628 \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0641\u064A \u0645\u0635\u0631 \u0648\u0642\u062F \u0628\u0646\u064A\u062A \u0645\u0646\u0630 \u0639\u062F\u0629 \u0642\u0631\u0648\u0646\u060C \u0648\u0642\u064A\u0644 \u0625\u0646\u0647\u0627 \u0643\u0627\u0646\u062A \u0642\u0628\u0648\u0631\u0627 \u0644\u0644\u0641\u0631\u0627\u0639\u0646\u0629 \u0648\u062A\u0645 \u0628\u0646\u0627\u0624\u0647\u0627 \u0628\u0639\u0645\u0644\u064A\u0629 \u0647\u0646\u062F\u0633\u064A\u0629 \u0631\u0627\u0626\u0639\u0629 \u0648\u0627\u0633\u062A\u0642\u062F\u0645\u062A \u062D\u062C\u0627\u0631\u062A\u0647\u0627 \u0645\u0646 \u062C\u0628\u0644 \u0627\u0644\u0645\u0642\u0637\u0645 \u0648\u062A\u0645 \u0646\u0642\u0644\u0647\u0627 \u0628\u0627\u0644\u0633\u0641\u0646 \u0623\u0648 \u0639\u0644\u0649 \u0627\u0644\u0631\u0645\u0644\u060C \u0648\u0645\u0627 \u062A\u0632\u0627\u0644 \u0634\u0627\u0645\u062E\u0629 \u0648\u064A\u0642\u0635\u062F\u0647\u0627 \u0627\u0644\u0633\u064A\u0627\u062D \u0645\u0646 \u0643\u0627\u0641\u0629 \u0623\u0631\u062C\u0627\u0621 \u0627\u0644\u0645\u0639\u0645\u0648\u0631\u0629.`
    ]
  ],
  [
    "text-generation",
    [
      `\u0625\u0633\u0645\u064A \u0645\u062D\u0645\u062F \u0648\u0623\u062D\u0628 \u0623\u0646`,
      `\u062F\u0639 \u0627\u0644\u0645\u0643\u0627\u0631\u0645 \u0644\u0627 \u062A\u0631\u062D\u0644 \u0644\u0628\u063A\u064A\u062A\u0647\u0627 - \u0648\u0627\u0642\u0639\u062F \u0641\u0625\u0646\u0643 \u0623\u0646\u062A \u0627\u0644\u0637\u0627\u0639\u0645 \u0627\u0644\u0643\u0627\u0633\u064A.`,
      `\u0644\u0645\u0627\u0630\u0627 \u0646\u062D\u0646 \u0647\u0646\u0627\u061F`,
      `\u0627\u0644\u0642\u062F\u0633 \u0645\u062F\u064A\u0646\u0629 \u062A\u0627\u0631\u064A\u062E\u064A\u0629\u060C \u0628\u0646\u0627\u0647\u0627 \u0627\u0644\u0643\u0646\u0639\u0627\u0646\u064A\u0648\u0646 \u0641\u064A`,
      `\u0643\u0627\u0646 \u064A\u0627 \u0645\u0627 \u0643\u0627\u0646 \u0641\u064A \u0642\u062F\u064A\u0645 \u0627\u0644\u0632\u0645\u0627\u0646`
    ]
  ],
  ["fill-mask", [`\u0628\u0627\u0631\u064A\u0633 <mask> \u0641\u0631\u0646\u0633\u0627.`, `\u0641\u0644\u0633\u0641\u0629 \u0627\u0644\u062D\u064A\u0627\u0629 \u0647\u064A <mask>.`]],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "\u0647\u0630\u0627 \u0634\u062E\u0635 \u0633\u0639\u064A\u062F",
        sentences: ["\u0647\u0630\u0627 \u0643\u0644\u0628 \u0633\u0639\u064A\u062F", "\u0647\u0630\u0627 \u0634\u062E\u0635 \u0633\u0639\u064A\u062F \u062C\u062F\u0627", "\u0627\u0644\u064A\u0648\u0645 \u0647\u0648 \u064A\u0648\u0645 \u0645\u0634\u0645\u0633"]
      }
    ]
  ]
]);
var MAPPING_BN = /* @__PURE__ */ new Map([
  ["text-classification", [`\u09AC\u09BE\u0999\u09BE\u09B2\u09BF\u09B0 \u0998\u09B0\u09C7 \u0998\u09B0\u09C7 \u0986\u099C \u09A8\u09AC\u09BE\u09A8\u09CD\u09A8 \u0989\u09CE\u09B8\u09AC\u0964`]],
  [
    "token-classification",
    [`\u0986\u09AE\u09BE\u09B0 \u09A8\u09BE\u09AE \u099C\u09BE\u09B9\u09BF\u09A6 \u098F\u09AC\u0982 \u0986\u09AE\u09BF \u09A2\u09BE\u0995\u09BE\u09DF \u09AC\u09BE\u09B8 \u0995\u09B0\u09BF\u0964`, `\u09A4\u09BF\u09A8\u09BF \u0997\u09C1\u0997\u09B2\u09C7 \u099A\u09BE\u0995\u09B0\u09C0 \u0995\u09B0\u09C7\u09A8\u0964`, `\u0986\u09AE\u09BE\u09B0 \u09A8\u09BE\u09AE \u09B8\u09C1\u09B8\u09CD\u09AE\u09BF\u09A4\u09BE \u098F\u09AC\u0982 \u0986\u09AE\u09BF \u0995\u09B2\u0995\u09BE\u09A4\u09BE\u09DF \u09AC\u09BE\u09B8 \u0995\u09B0\u09BF\u0964`]
  ],
  ["translation", [`\u0986\u09AE\u09BE\u09B0 \u09A8\u09BE\u09AE \u099C\u09BE\u09B9\u09BF\u09A6, \u0986\u09AE\u09BF \u09B0\u0982\u09AA\u09C1\u09B0\u09C7 \u09AC\u09BE\u09B8 \u0995\u09B0\u09BF\u0964`, `\u0986\u09AA\u09A8\u09BF \u0995\u09C0 \u0986\u099C\u0995\u09C7 \u09AC\u09BE\u09B8\u09BE\u09DF \u0986\u09B8\u09AC\u09C7\u09A8?`]],
  [
    "summarization",
    [
      `\u2018\u0987\u0995\u09CB\u09A8\u09AE\u09BF\u09B8\u09CD\u099F\u2019 \u09B2\u09BF\u0996\u09C7\u099B\u09C7, \u0985\u09CD\u09AF\u09BE\u09A8\u09CD\u099F\u09BF\u09AC\u09A1\u09BF\u09B0 \u099A\u09BE\u09B0 \u09AE\u09BE\u09B8 \u09B8\u09CD\u09A5\u09BE\u09DF\u09C0 \u09B9\u0993\u09DF\u09BE\u09B0 \u0996\u09AC\u09B0\u099F\u09BF \u09A6\u09C1\u0987 \u0995\u09BE\u09B0\u09A3\u09C7 \u0986\u09A8\u09A8\u09CD\u09A6\u09C7\u09B0\u0964 \u0985\u09CD\u09AF\u09BE\u09A8\u09CD\u099F\u09BF\u09AC\u09A1\u09BF \u09AF\u09A4 \u09A6\u09BF\u09A8 \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4 \u09B6\u09B0\u09C0\u09B0\u09C7 \u099F\u09BF\u0995\u09AC\u09C7, \u09A4\u09A4 \u09A6\u09BF\u09A8 \u09B8\u0982\u0995\u09CD\u09B0\u09AE\u09A3 \u09A5\u09C7\u0995\u09C7 \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BF\u09A4 \u09A5\u09BE\u0995\u09BE \u09B8\u09AE\u09CD\u09AD\u09AC\u0964 \u0985\u09B0\u09CD\u09A5\u09BE\u09CE, \u098F\u09AE\u09A8 \u098F\u0995 \u099F\u09BF\u0995\u09BE\u09B0 \u09AA\u09CD\u09B0\u09DF\u09CB\u099C\u09A8 \u09B9\u09AC\u09C7, \u09AF\u09BE \u0985\u09CD\u09AF\u09BE\u09A8\u09CD\u099F\u09BF\u09AC\u09A1\u09BF\u09B0 \u0989\u09A4\u09CD\u09AA\u09BE\u09A6\u09A8\u0995\u09C7 \u09AA\u09CD\u09B0\u09B0\u09CB\u099A\u09BF\u09A4 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7 \u098F\u09AC\u0982 \u09A6\u09C0\u09B0\u09CD\u0998\u09B8\u09CD\u09A5\u09BE\u09DF\u09C0 \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BE \u09A6\u09BF\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u0964 \u098F\u0997\u09C1\u09B2\u09CB \u0996\u09C1\u0981\u099C\u09C7 \u09AC\u09C7\u09B0 \u0995\u09B0\u09BE\u0993 \u09B8\u09B9\u099C\u0964 \u098F\u099F\u09BF \u0986\u09AD\u09BE\u09B8 \u09A6\u09C7\u09DF, \u09AC\u09CD\u09AF\u09BE\u09AA\u0995 \u09B9\u09BE\u09B0\u09C7 \u0985\u09CD\u09AF\u09BE\u09A8\u09CD\u099F\u09BF\u09AC\u09A1\u09BF \u09B6\u09A8\u09BE\u0995\u09CD\u09A4\u0995\u09B0\u09A3 \u09AB\u09B2\u09BE\u09AB\u09B2 \u09AE\u09CB\u099F\u09BE\u09AE\u09C1\u099F\u09BF \u09A8\u09BF\u09B0\u09CD\u09AD\u09C1\u09B2 \u09B9\u0993\u09DF\u09BE \u0989\u099A\u09BF\u09A4\u0964 \u09A6\u09CD\u09AC\u09BF\u09A4\u09C0\u09DF \u0986\u09B0\u09C7\u0995\u099F\u09BF \u0997\u09AC\u09C7\u09B7\u09A3\u09BE\u09B0 \u09A8\u09C7\u09A4\u09C3\u09A4\u09CD\u09AC \u09A6\u09BF\u09DF\u09C7\u099B\u09C7\u09A8 \u09AF\u09C1\u0995\u09CD\u09A4\u09B0\u09BE\u099C\u09CD\u09AF\u09C7\u09B0 \u09AE\u09C7\u09A1\u09BF\u0995\u09C7\u09B2 \u09B0\u09BF\u09B8\u09BE\u09B0\u09CD\u099A \u0995\u09BE\u0989\u09A8\u09CD\u09B8\u09BF\u09B2\u09C7\u09B0 (\u098F\u09AE\u0986\u09B0\u09B8\u09BF) \u0987\u09AE\u09BF\u0989\u09A8\u09CB\u09B2\u099C\u09BF\u09B8\u09CD\u099F \u09A4\u09BE\u0993 \u09A6\u0982\u0964 \u09A4\u09BF\u09A8\u09BF \u099F\u09BF-\u09B8\u09C7\u09B2 \u09B6\u09A8\u09BE\u0995\u09CD\u09A4\u0995\u09B0\u09A3\u09C7 \u0995\u09BE\u099C \u0995\u09B0\u09C7\u099B\u09C7\u09A8\u0964 \u099F\u09BF-\u09B8\u09C7\u09B2 \u09B6\u09A8\u09BE\u0995\u09CD\u09A4\u0995\u09B0\u09A3\u09C7\u09B0 \u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09DF\u09BE \u0985\u09AC\u09B6\u09CD\u09AF \u0985\u09CD\u09AF\u09BE\u09A8\u09CD\u099F\u09BF\u09AC\u09A1\u09BF\u09B0 \u09AE\u09A4\u09CB \u098F\u09A4 \u0986\u09B2\u09CB\u099A\u09BF\u09A4 \u09A8\u09DF\u0964 \u09A4\u09AC\u09C7 \u09B8\u0982\u0995\u09CD\u09B0\u09AE\u09A3\u09C7\u09B0 \u09AC\u09BF\u09B0\u09C1\u09A6\u09CD\u09A7\u09C7 \u09B2\u09DC\u09BE\u0987 \u098F\u09AC\u0982 \u09A6\u09C0\u09B0\u09CD\u0998\u09AE\u09C7\u09DF\u09BE\u09A6\u09BF \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BE\u09DF \u09B8\u09AE\u09BE\u09A8 \u0997\u09C1\u09B0\u09C1\u09A4\u09CD\u09AC\u09AA\u09C2\u09B0\u09CD\u09A3 \u09AD\u09C2\u09AE\u09BF\u0995\u09BE \u09AA\u09BE\u09B2\u09A8 \u0995\u09B0\u09C7\u0964 \u0997\u09AC\u09C7\u09B7\u09A3\u09BE\u09B8\u0982\u0995\u09CD\u09B0\u09BE\u09A8\u09CD\u09A4 \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7 \u09AA\u09CD\u09B0\u0995\u09BE\u09B6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7 \u2018\u09A8\u09C7\u099A\u09BE\u09B0 \u0987\u09AE\u09BF\u0989\u09A8\u09CB\u09B2\u099C\u09BF\u2019 \u09B8\u09BE\u09AE\u09DF\u09BF\u0995\u09C0\u09A4\u09C7\u0964 \u09A4\u09BE\u0981\u09B0\u09BE \u09AC\u09B2\u099B\u09C7\u09A8, \u0997\u09AC\u09C7\u09B7\u09A3\u09BE\u09B0 \u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09B0\u09C7 \u0995\u09CB\u09AD\u09BF\u09A1-\u09E7\u09EF \u09AE\u09C3\u09A6\u09C1 \u09B8\u0982\u0995\u09CD\u09B0\u09AE\u09A3\u09C7\u09B0 \u09B6\u09BF\u0995\u09BE\u09B0 \u09E8\u09EE \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u09B0 \u09B0\u0995\u09CD\u09A4\u09C7\u09B0 \u09A8\u09AE\u09C1\u09A8\u09BE, \u09E7\u09EA \u099C\u09A8 \u0997\u09C1\u09B0\u09C1\u09A4\u09B0 \u0985\u09B8\u09C1\u09B8\u09CD\u09A5 \u0993 \u09E7\u09EC \u099C\u09A8 \u09B8\u09C1\u09B8\u09CD\u09A5 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u09B0 \u09B0\u0995\u09CD\u09A4\u09C7\u09B0 \u09A8\u09AE\u09C1\u09A8\u09BE \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE \u0995\u09B0\u09C7\u099B\u09C7\u09A8\u0964 \u0997\u09AC\u09C7\u09B7\u09A3\u09BE \u09A8\u09BF\u09AC\u09A8\u09CD\u09A7\u09C7 \u09AC\u09B2\u09BE \u09B9\u09DF, \u09B8\u0982\u0995\u09CD\u09B0\u09AE\u09BF\u09A4 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u09A6\u09C7\u09B0 \u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09B0\u09C7 \u099F\u09BF-\u09B8\u09C7\u09B2\u09C7\u09B0 \u09A4\u09C0\u09AC\u09CD\u09B0 \u09AA\u09CD\u09B0\u09A4\u09BF\u0995\u09CD\u09B0\u09BF\u09DF\u09BE \u09A4\u09BE\u0981\u09B0\u09BE \u09A6\u09C7\u0996\u09C7\u099B\u09C7\u09A8\u0964 \u098F \u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09B0\u09C7 \u09AE\u09C3\u09A6\u09C1 \u0993 \u0997\u09C1\u09B0\u09C1\u09A4\u09B0 \u0985\u09B8\u09C1\u09B8\u09CD\u09A5 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF\u09A6\u09C7\u09B0 \u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09B0\u09C7 \u09AA\u09CD\u09B0\u09A4\u09BF\u0995\u09CD\u09B0\u09BF\u09DF\u09BE\u09B0 \u09AD\u09BF\u09A8\u09CD\u09A8\u09A4\u09BE \u09AA\u09BE\u0993\u09DF\u09BE \u0997\u09C7\u099B\u09C7\u0964`
    ]
  ],
  ["text-generation", [`\u0986\u09AE\u09BF \u09B0\u09A4\u09A8 \u098F\u09AC\u0982 \u0986\u09AE\u09BF`, `\u09A4\u09C1\u09AE\u09BF \u09AF\u09A6\u09BF \u099A\u09BE\u0993 \u09A4\u09AC\u09C7`, `\u09AE\u09BF\u09A5\u09BF\u09B2\u09BE \u0986\u099C\u0995\u09C7 \u09AC\u09A1\u09CD\u09A1`]],
  ["fill-mask", [`\u0986\u09AE\u09BF \u09AC\u09BE\u0982\u09B2\u09BE\u09DF <mask> \u0997\u09BE\u0987\u0964`, `\u0986\u09AE\u09BF <mask> \u0996\u09C1\u09AC \u09AD\u09BE\u09B2\u09CB\u09AC\u09BE\u09B8\u09BF\u0964 `]],
  [
    "question-answering",
    [
      {
        text: `\u09AA\u09CD\u09B0\u09A5\u09AE \u098F\u09B6\u09BF\u09AF\u09BC\u09BE \u0995\u09BE\u09AA \u0995\u09CD\u09B0\u09BF\u0995\u09C7\u099F \u099F\u09C1\u09B0\u09CD\u09A8\u09BE\u09AE\u09C7\u09A8\u09CD\u099F \u0995\u09CB\u09A5\u09BE\u09DF \u0985\u09A8\u09C1\u09B7\u09CD\u09A0\u09BF\u09A4 \u09B9\u09DF ?`,
        context: `\u09AA\u09CD\u09B0\u09A5\u09AE \u099F\u09C1\u09B0\u09CD\u09A8\u09BE\u09AE\u09C7\u09A8\u09CD\u099F \u0985\u09A8\u09C1\u09B7\u09CD\u09A0\u09BF\u09A4 \u09B9\u09AF\u09BC \u09E7\u09EF\u09EE\u09EA \u09B8\u09BE\u09B2\u09C7 \u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4 \u0986\u09B0\u09AC \u0986\u09AE\u09BF\u09B0\u09BE\u09A4 \u098F\u09B0 \u09B6\u09BE\u09B0\u099C\u09BE\u09B9 \u09A4\u09C7 \u09AF\u09C7\u0996\u09BE\u09A8\u09C7 \u0995\u09BE\u0989\u09A8\u09CD\u09B8\u09BF\u09B2\u09C7\u09B0 \u09AE\u09C2\u09B2 \u0985\u09AB\u09BF\u09B8 \u099B\u09BF\u09B2 (\u09E7\u09EF\u09EF\u09EB \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4)\u0964 \u09AD\u09BE\u09B0\u09A4 \u09B6\u09CD\u09B0\u09C0\u09B2\u0999\u09CD\u0995\u09BE\u09B0 \u09B8\u09BE\u09A5\u09C7 \u0986\u09A8\u09CD\u09A4\u09B0\u09BF\u0995\u09A4\u09BE\u09B9\u09C0\u09A8 \u0995\u09CD\u09B0\u09BF\u0995\u09C7\u099F \u09B8\u09AE\u09CD\u09AA\u09B0\u09CD\u0995\u09C7\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u09E7\u09EF\u09EE\u09EC \u09B8\u09BE\u09B2\u09C7\u09B0 \u099F\u09C1\u09B0\u09CD\u09A8\u09BE\u09AE\u09C7\u09A8\u09CD\u099F \u09AC\u09B0\u09CD\u099C\u09A8 \u0995\u09B0\u09C7\u0964 \u09E7\u09EF\u09EF\u09E9 \u09B8\u09BE\u09B2\u09C7 \u09AD\u09BE\u09B0\u09A4 \u0993 \u09AA\u09BE\u0995\u09BF\u09B8\u09CD\u09A4\u09BE\u09A8 \u098F\u09B0 \u09AE\u09A7\u09CD\u09AF\u09C7 \u09B0\u09BE\u099C\u09A8\u09C8\u09A4\u09BF\u0995 \u0985\u09B8\u09CD\u09A5\u09BF\u09B0\u09A4\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u098F\u099F\u09BF \u09AC\u09BE\u09A4\u09BF\u09B2 \u09B9\u09AF\u09BC\u09C7 \u09AF\u09BE\u09AF\u09BC\u0964 \u09B6\u09CD\u09B0\u09C0\u09B2\u0999\u09CD\u0995\u09BE \u098F\u09B6\u09BF\u09AF\u09BC\u09BE \u0995\u09BE\u09AA \u09B6\u09C1\u09B0\u09C1 \u09A5\u09C7\u0995\u09C7 \u0985\u0982\u09B6 \u0997\u09CD\u09B0\u09B9\u09A3 \u0995\u09B0\u09C7 \u0986\u09B8\u099B\u09C7\u0964 \u0986\u09A8\u09CD\u09A4\u09B0\u09CD\u099C\u09BE\u09A4\u09BF\u0995 \u0995\u09CD\u09B0\u09BF\u0995\u09C7\u099F \u0995\u09BE\u0989\u09A8\u09CD\u09B8\u09BF\u09B2 \u09A8\u09BF\u09AF\u09BC\u09AE \u0995\u09B0\u09C7 \u09A6\u09BF\u09AF\u09BC\u09C7\u099B\u09C7 \u09AF\u09C7 \u098F\u09B6\u09BF\u09AF\u09BC\u09BE \u0995\u09BE\u09AA\u09C7\u09B0 \u09B8\u0995\u09B2 \u0996\u09C7\u09B2\u09BE \u0985\u09A8\u09C1\u09B7\u09CD\u09A0\u09BF\u09A4 \u09B9\u09AC\u09C7 \u0985\u09AB\u09BF\u09B8\u09BF\u09AF\u09BC\u09BE\u09B2 \u098F\u0995\u09A6\u09BF\u09A8\u09C7\u09B0 \u0986\u09A8\u09CD\u09A4\u09B0\u09CD\u099C\u09BE\u09A4\u09BF\u0995 \u0995\u09CD\u09B0\u09BF\u0995\u09C7\u099F \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7\u0964 \u098F\u09B8\u09BF\u09B8\u09BF \u0998\u09CB\u09B7\u09A8\u09BE \u0985\u09A8\u09C1\u09AF\u09BE\u09AF\u09BC\u09C0 \u09AA\u09CD\u09B0\u09A4\u09BF \u09A6\u09C1\u0987 \u09AC\u099B\u09B0 \u09AA\u09B0 \u09AA\u09B0 \u099F\u09C1\u09B0\u09CD\u09A8\u09BE\u09AE\u09C7\u09A8\u09CD\u099F \u0985\u09A8\u09C1\u09B7\u09CD\u09A0\u09BF\u09A4 \u09B9\u09AF\u09BC \u09E8\u09E6\u09E6\u09EE \u09B8\u09BE\u09B2 \u09A5\u09C7\u0995\u09C7\u0964`
      },
      {
        text: `\u09AD\u09BE\u09B0\u09A4\u09C0\u09AF\u09BC \u09AC\u09BE\u0999\u09BE\u09B2\u09BF \u0995\u09A5\u09BE\u09B8\u09BE\u09B9\u09BF\u09A4\u09CD\u09AF\u09BF\u0995 \u09AE\u09B9\u09BE\u09B6\u09CD\u09AC\u09C7\u09A4\u09BE \u09A6\u09C7\u09AC\u09C0\u09B0 \u09AE\u09C3\u09A4\u09CD\u09AF\u09C1 \u0995\u09AC\u09C7 \u09B9\u09DF ?`,
        context: `\u09E8\u09E6\u09E7\u09EC \u09B8\u09BE\u09B2\u09C7\u09B0 \u09E8\u09E9 \u099C\u09C1\u09B2\u09BE\u0987 \u09B9\u09C3\u09A6\u09B0\u09CB\u0997\u09C7 \u0986\u0995\u09CD\u09B0\u09BE\u09A8\u09CD\u09A4 \u09B9\u09AF\u09BC\u09C7 \u09AE\u09B9\u09BE\u09B6\u09CD\u09AC\u09C7\u09A4\u09BE \u09A6\u09C7\u09AC\u09C0 \u0995\u09B2\u0995\u09BE\u09A4\u09BE\u09B0 \u09AC\u09C7\u09B2 \u09AD\u09BF\u0989 \u0995\u09CD\u09B2\u09BF\u09A8\u09BF\u0995\u09C7 \u09AD\u09B0\u09CD\u09A4\u09BF \u09B9\u09A8\u0964 \u09B8\u09C7\u0987 \u09AC\u099B\u09B0\u0987 \u09E8\u09EE \u099C\u09C1\u09B2\u09BE\u0987 \u098F\u0995\u09BE\u09A7\u09BF\u0995 \u0985\u0999\u09CD\u0997 \u09AC\u09BF\u0995\u09B2 \u09B9\u09AF\u09BC\u09C7 \u09A4\u09BE\u0981\u09B0 \u09AE\u09C3\u09A4\u09CD\u09AF\u09C1 \u0998\u099F\u09C7\u0964 \u09A4\u09BF\u09A8\u09BF \u09AE\u09A7\u09C1\u09AE\u09C7\u09B9, \u09B8\u09C7\u09AA\u09CD\u099F\u09BF\u09B8\u09C7\u09AE\u09BF\u09AF\u09BC\u09BE \u0993 \u09AE\u09C2\u09A4\u09CD\u09B0 \u09B8\u0982\u0995\u09CD\u09B0\u09AE\u09A3 \u09B0\u09CB\u0997\u09C7\u0993 \u09AD\u09C1\u0997\u099B\u09BF\u09B2\u09C7\u09A8\u0964`
      },
      {
        text: `\u09AE\u09BE\u09B8\u09CD\u099F\u09BE\u09B0\u09A6\u09BE \u09B8\u09C2\u09B0\u09CD\u09AF\u0995\u09C1\u09AE\u09BE\u09B0 \u09B8\u09C7\u09A8\u09C7\u09B0 \u09AC\u09BE\u09AC\u09BE\u09B0 \u09A8\u09BE\u09AE \u0995\u09C0 \u099B\u09BF\u09B2 ?`,
        context: `\u09B8\u09C2\u09B0\u09CD\u09AF \u09B8\u09C7\u09A8 \u09E7\u09EE\u09EF\u09EA \u09B8\u09BE\u09B2\u09C7\u09B0 \u09E8\u09E8 \u09AE\u09BE\u09B0\u09CD\u099A \u099A\u099F\u09CD\u099F\u0997\u09CD\u09B0\u09BE\u09AE\u09C7\u09B0 \u09B0\u09BE\u0989\u099C\u09BE\u09A8 \u09A5\u09BE\u09A8\u09BE\u09B0 \u09A8\u09CB\u09AF\u09BC\u09BE\u09AA\u09BE\u09A1\u09BC\u09BE\u09AF\u09BC \u0985\u09B0\u09CD\u09A5\u09A8\u09C8\u09A4\u09BF\u0995 \u09AD\u09BE\u09AC\u09C7 \u0985\u09B8\u09CD\u09AC\u099A\u09CD\u099B\u09B2 \u09AA\u09B0\u09BF\u09AC\u09BE\u09B0\u09C7 \u099C\u09A8\u09CD\u09AE\u0997\u09CD\u09B0\u09B9\u09A3 \u0995\u09B0\u09C7\u09A8\u0964 \u09A4\u09BE\u0981\u09B0 \u09AA\u09BF\u09A4\u09BE\u09B0 \u09A8\u09BE\u09AE \u09B0\u09BE\u099C\u09AE\u09A8\u09BF \u09B8\u09C7\u09A8 \u098F\u09AC\u0982 \u09AE\u09BE\u09A4\u09BE\u09B0 \u09A8\u09BE\u09AE \u09B6\u09B6\u09C0 \u09AC\u09BE\u09B2\u09BE \u09B8\u09C7\u09A8\u0964 \u09B0\u09BE\u099C\u09AE\u09A8\u09BF \u09B8\u09C7\u09A8\u09C7\u09B0 \u09A6\u09C1\u0987 \u099B\u09C7\u09B2\u09C7 \u0986\u09B0 \u099A\u09BE\u09B0 \u09AE\u09C7\u09AF\u09BC\u09C7\u0964 \u09B8\u09C2\u09B0\u09CD\u09AF \u09B8\u09C7\u09A8 \u09A4\u09BE\u0981\u09A6\u09C7\u09B0 \u09AA\u09B0\u09BF\u09AC\u09BE\u09B0\u09C7\u09B0 \u099A\u09A4\u09C1\u09B0\u09CD\u09A5 \u09B8\u09A8\u09CD\u09A4\u09BE\u09A8\u0964 \u09A6\u09C1\u0987 \u099B\u09C7\u09B2\u09C7\u09B0 \u09A8\u09BE\u09AE \u09B8\u09C2\u09B0\u09CD\u09AF \u0993 \u0995\u09AE\u09B2\u0964 \u099A\u09BE\u09B0 \u09AE\u09C7\u09AF\u09BC\u09C7\u09B0 \u09A8\u09BE\u09AE \u09AC\u09B0\u09A6\u09BE\u09B8\u09C1\u09A8\u09CD\u09A6\u09B0\u09C0, \u09B8\u09BE\u09AC\u09BF\u09A4\u09CD\u09B0\u09C0, \u09AD\u09BE\u09A8\u09C1\u09AE\u09A4\u09C0 \u0993 \u09AA\u09CD\u09B0\u09AE\u09BF\u09B2\u09BE\u0964 \u09B6\u09C8\u09B6\u09AC\u09C7 \u09AA\u09BF\u09A4\u09BE \u09AE\u09BE\u09A4\u09BE\u0995\u09C7 \u09B9\u09BE\u09B0\u09BE\u09A8\u09CB \u09B8\u09C2\u09B0\u09CD\u09AF \u09B8\u09C7\u09A8 \u0995\u09BE\u0995\u09BE \u0997\u09CC\u09B0\u09AE\u09A8\u09BF \u09B8\u09C7\u09A8\u09C7\u09B0 \u0995\u09BE\u099B\u09C7 \u09AE\u09BE\u09A8\u09C1\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u09A8\u0964 \u09B8\u09C2\u09B0\u09CD\u09AF \u09B8\u09C7\u09A8 \u099B\u09C7\u09B2\u09C7\u09AC\u09C7\u09B2\u09BE \u09A5\u09C7\u0995\u09C7\u0987 \u0996\u09C1\u09AC \u09AE\u09A8\u09CB\u09AF\u09CB\u0997\u09C0 \u09AD\u09BE\u09B2 \u099B\u09BE\u09A4\u09CD\u09B0 \u099B\u09BF\u09B2\u09C7\u09A8 \u098F\u09AC\u0982 \u09A7\u09B0\u09CD\u09AE\u09AD\u09BE\u09AC\u09BE\u09AA\u09A8\u09CD\u09A8 \u0997\u09AE\u09CD\u09AD\u09C0\u09B0 \u09AA\u09CD\u09B0\u0995\u09C3\u09A4\u09BF\u09B0 \u099B\u09BF\u09B2\u09C7\u09A8\u0964`
      }
    ]
  ],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "\u09B8\u09C7 \u098F\u0995\u099C\u09A8 \u09B8\u09C1\u0996\u09C0 \u09AC\u09CD\u09AF\u0995\u09CD\u09A4\u09BF",
        sentences: ["\u09B8\u09C7 \u09B9\u09CD\u09AF\u09BE\u09AA\u09BF \u0995\u09C1\u0995\u09C1\u09B0", "\u09B8\u09C7 \u0996\u09C1\u09AC \u09B8\u09C1\u0996\u09C0 \u09AE\u09BE\u09A8\u09C1\u09B7", "\u0986\u099C \u098F\u0995\u099F\u09BF \u09B0\u09CC\u09A6\u09CD\u09B0\u09CB\u099C\u09CD\u099C\u09CD\u09AC\u09B2 \u09A6\u09BF\u09A8"]
      }
    ]
  ]
]);
var MAPPING_MN = /* @__PURE__ */ new Map([
  ["text-classification", [`\u0411\u0438 \u0447\u0430\u043C\u0434 \u0445\u0430\u0439\u0440\u0442\u0430\u0439`]],
  [
    "token-classification",
    [
      `\u041D\u0430\u043C\u0430\u0439\u0433 \u0414\u043E\u0440\u0436 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u043B\u0430\u0430\u043D\u0431\u0430\u0430\u0442\u0430\u0440\u0442 \u0430\u043C\u044C\u0434\u0430\u0440\u0434\u0430\u0433.`,
      `\u041D\u0430\u043C\u0430\u0439\u0433 \u0413\u0430\u043D\u0431\u0430\u0442 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u0432\u0441 \u0430\u0439\u043C\u0430\u0433\u0442 \u0442\u04E9\u0440\u0441\u04E9\u043D.`,
      `\u041C\u0430\u043D\u0430\u0439 \u0443\u043B\u0441 \u0442\u0430\u0432\u0430\u043D \u0445\u043E\u0448\u0443\u0443 \u043C\u0430\u043B\u0442\u0430\u0439.`
    ]
  ],
  [
    "question-answering",
    [
      {
        text: `\u0422\u0430 \u0445\u0430\u0430\u043D\u0430 \u0430\u043C\u044C\u0434\u0430\u0440\u0434\u0430\u0433 \u0432\u044D?`,
        context: `\u041D\u0430\u043C\u0430\u0439\u0433 \u0414\u043E\u0440\u0436 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u043B\u0430\u0430\u043D\u0431\u0430\u0430\u0442\u0430\u0440\u0442 \u0430\u043C\u044C\u0434\u0430\u0440\u0434\u0430\u0433.`
      },
      {
        text: `\u0422\u0430\u043D\u044B\u0433 \u0445\u044D\u043D \u0433\u044D\u0434\u044D\u0433 \u0432\u044D?`,
        context: `\u041D\u0430\u043C\u0430\u0439\u0433 \u0414\u043E\u0440\u0436 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u043B\u0430\u0430\u043D\u0431\u0430\u0430\u0442\u0430\u0440\u0442 \u0430\u043C\u044C\u0434\u0430\u0440\u0434\u0430\u0433.`
      },
      {
        text: `\u041C\u0438\u043D\u0438\u0439 \u043D\u044D\u0440\u0438\u0439\u0433 \u0445\u044D\u043D \u0433\u044D\u0434\u044D\u0433 \u0432\u044D?`,
        context: `\u041D\u0430\u043C\u0430\u0439\u0433 \u0413\u0430\u043D\u0431\u0430\u0442 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u0432\u0441 \u0430\u0439\u043C\u0430\u0433\u0442 \u0442\u04E9\u0440\u0441\u04E9\u043D.`
      }
    ]
  ],
  ["translation", [`\u041D\u0430\u043C\u0430\u0439\u0433 \u0414\u043E\u0440\u0436 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u043B\u0430\u0430\u043D\u0431\u0430\u0430\u0442\u0430\u0440\u0442 \u0430\u043C\u044C\u0434\u0430\u0440\u0434\u0430\u0433.`, `\u041D\u0430\u043C\u0430\u0439\u0433 \u0413\u0430\u043D\u0431\u0430\u0442 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438 \u0423\u0432\u0441 \u0430\u0439\u043C\u0430\u0433\u0442 \u0442\u04E9\u0440\u0441\u04E9\u043D.`]],
  [
    "summarization",
    [
      `\u041C\u043E\u043D\u0433\u043E\u043B \u0423\u043B\u0441 (1992 \u043E\u043D\u043E\u043E\u0441 \u0445\u043E\u0439\u0448) \u2014 \u0434\u043E\u0440\u043D\u043E \u0431\u043E\u043B\u043E\u043D \u0442\u04E9\u0432 \u0410\u0437\u0438\u0434 \u043E\u0440\u0448\u0434\u043E\u0433 \u0431\u04AF\u0440\u044D\u043D \u044D\u0440\u0445\u0442 \u0443\u043B\u0441. \u0425\u043E\u0439\u0434 \u0442\u0430\u043B\u0430\u0430\u0440\u0430\u0430 \u041E\u0440\u043E\u0441, \u0431\u0443\u0441\u0430\u0434 \u0442\u0430\u043B\u0430\u0430\u0440\u0430\u0430 \u0425\u044F\u0442\u0430\u0434 \u0443\u043B\u0441\u0442\u0430\u0439 \u0445\u0438\u043B\u043B\u044D\u0434\u044D\u0433 \u0434\u0430\u043B\u0430\u0439\u0434 \u0433\u0430\u0440\u0446\u0433\u04AF\u0439 \u043E\u0440\u043E\u043D. \u041D\u0438\u0439\u0441\u043B\u044D\u043B \u2014 \u0423\u043B\u0430\u0430\u043D\u0431\u0430\u0430\u0442\u0430\u0440 \u0445\u043E\u0442. \u0410\u043B\u0442\u0430\u0439\u043D \u043D\u0443\u0440\u0443\u0443\u043D\u0430\u0430\u0441 \u0425\u044F\u043D\u0433\u0430\u043D, \u0421\u043E\u0451\u043D\u043E\u043E\u0441 \u0413\u043E\u0432\u044C \u0445\u04AF\u0440\u0441\u044D\u043D 1 \u0441\u0430\u044F 566 \u043C\u044F\u043D\u0433\u0430\u043D \u043A\u043C2 \u0443\u0443\u0434\u0430\u043C \u043D\u0443\u0442\u0430\u0433\u0442\u0430\u0439, \u0434\u044D\u043B\u0445\u0438\u0439\u0434 \u043D\u0443\u0442\u0430\u0433 \u0434\u044D\u0432\u0441\u0433\u044D\u0440\u0438\u0439\u043D \u0445\u044D\u043C\u0436\u044D\u044D\u0433\u044D\u044D\u0440 19-\u0440\u0442 \u0436\u0430\u0433\u0441\u0434\u0430\u0433. 2015 \u043E\u043D\u044B \u044D\u0445\u044D\u043D\u0434 \u041C\u043E\u043D\u0433\u043E\u043B \u0423\u043B\u0441\u044B\u043D \u0445\u04AF\u043D \u0430\u043C 3 \u0441\u0430\u044F \u0445\u04AF\u0440\u0441\u044D\u043D (135-\u0440 \u043E\u043B\u043E\u043D). \u04AE\u043D\u0434\u0441\u044D\u043D\u0434\u044D\u044D \u043C\u043E\u043D\u0433\u043E\u043B \u04AF\u043D\u0434\u044D\u0441\u0442\u044D\u043D (95 \u0445\u0443\u0432\u044C), \u043C\u04E9\u043D \u0445\u0430\u0441\u0430\u0433, \u0442\u0443\u0432\u0430 \u0445\u04AF\u043D \u0431\u0430\u0439\u043D\u0430. 16-\u0440 \u0437\u0443\u0443\u043D\u0430\u0430\u0441 \u0445\u043E\u0439\u0448 \u0431\u0443\u0434\u0434\u044B\u043D \u0448\u0430\u0448\u0438\u043D, 20-\u0440 \u0437\u0443\u0443\u043D\u0430\u0430\u0441 \u0448\u0430\u0448\u0438\u043D\u0433\u04AF\u0439 \u0431\u0430\u0439\u0434\u0430\u043B \u0434\u044D\u043B\u0433\u044D\u0440\u0441\u044D\u043D \u0431\u0430 \u0430\u043B\u0431\u0430\u043D \u0445\u044D\u0440\u044D\u0433\u0442 \u043C\u043E\u043D\u0433\u043E\u043B \u0445\u044D\u043B\u044D\u044D\u0440 \u0445\u0430\u0440\u0438\u043B\u0446\u0430\u043D\u0430.`
    ]
  ],
  [
    "text-generation",
    [`\u041D\u0430\u043C\u0430\u0439\u0433 \u0414\u043E\u0440\u0436 \u0433\u044D\u0434\u044D\u0433. \u0411\u0438`, `\u0425\u0430\u043C\u0433\u0438\u0439\u043D \u0441\u0430\u0439\u043D \u0434\u0443\u0443\u0447\u0438\u043D \u0431\u043E\u043B`, `\u041C\u0438\u043D\u0438\u0439 \u0434\u0443\u0440\u0442\u0430\u0439 \u0445\u0430\u043C\u0442\u043B\u0430\u0433 \u0431\u043E\u043B`, `\u042D\u0440\u0442 \u0443\u0440\u044C\u0434\u044B\u043D \u0446\u0430\u0433\u0442`]
  ],
  ["fill-mask", [`\u041C\u043E\u043D\u0433\u043E\u043B \u0443\u043B\u0441\u044B\u043D <mask> \u0423\u043B\u0430\u0430\u043D\u0431\u0430\u0430\u0442\u0430\u0440 \u0445\u043E\u0442\u043E\u043E\u0441 \u044F\u0440\u044C\u0436 \u0431\u0430\u0439\u043D\u0430.`, `\u041C\u0438\u043D\u0438\u0439 \u0430\u043C\u044C\u0434\u0440\u0430\u043B\u044B\u043D \u0437\u043E\u0440\u0438\u043B\u0433\u043E \u0431\u043E\u043B <mask>.`]],
  [
    "automatic-speech-recognition",
    [
      {
        label: `Common Voice Train Example`,
        src: `https://cdn-media.huggingface.co/common_voice/train/common_voice_mn_18577472.wav`
      },
      {
        label: `Common Voice Test Example`,
        src: `https://cdn-media.huggingface.co/common_voice/test/common_voice_mn_18577346.wav`
      }
    ]
  ],
  [
    "text-to-speech",
    [
      `\u0411\u0438 \u041C\u043E\u043D\u0433\u043E\u043B \u0443\u043B\u0441\u044B\u043D \u0438\u0440\u0433\u044D\u043D.`,
      `\u042D\u043D\u044D\u0445\u04AF\u04AF \u0436\u0438\u0448\u044D\u044D \u043D\u044C \u0446\u0430\u0430\u043D\u0430\u0430 \u044F\u043C\u0430\u0440 \u0447 \u0443\u0442\u0433\u0430 \u0430\u0433\u0443\u0443\u043B\u0430\u0430\u0433\u04AF\u0439 \u0431\u043E\u043B\u043D\u043E`,
      `\u0421\u0430\u0440 \u0448\u0438\u043D\u044D\u0434\u044D\u044D \u0441\u0430\u0439\u0445\u0430\u043D \u0448\u0438\u043D\u044D\u043B\u044D\u0436 \u0431\u0430\u0439\u043D\u0430 \u0443\u0443?`
    ]
  ],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "\u042D\u043D\u044D \u0431\u043E\u043B \u0430\u0437 \u0436\u0430\u0440\u0433\u0430\u043B\u0442\u0430\u0439 \u0445\u04AF\u043D \u044E\u043C",
        sentences: ["\u042D\u043D\u044D \u0431\u043E\u043B \u0430\u0437 \u0436\u0430\u0440\u0433\u0430\u043B\u0442\u0430\u0439 \u043D\u043E\u0445\u043E\u0439 \u044E\u043C", "\u042D\u043D\u044D \u0431\u043E\u043B \u043C\u0430\u0448 \u0438\u0445 \u0430\u0437 \u0436\u0430\u0440\u0433\u0430\u043B\u0442\u0430\u0439 \u0445\u04AF\u043D \u044E\u043C", "\u04E8\u043D\u04E9\u04E9\u0434\u04E9\u0440 \u043D\u0430\u0440\u043B\u0430\u0433 \u04E9\u0434\u04E9\u0440 \u0431\u0430\u0439\u043D\u0430"]
      }
    ]
  ]
]);
var MAPPING_SI = /* @__PURE__ */ new Map([
  ["translation", [`\u0DC3\u0DD2\u0D82\u0DC4\u0DBD \u0D89\u0DAD\u0DCF \u0D85\u0DBD\u0D82\u0D9A\u0DCF\u0DBB \u0DB7\u0DCF\u0DC2\u0DCF\u0DC0\u0D9A\u0DD2.`, `\u0DB8\u0DD9\u0DB8 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA \u0DB7\u0DCF\u0DC0\u0DD2\u0DAD\u0DCF \u0D9A\u0DBB\u0DB1 \u0D94\u0DB6\u0DA7 \u0DC3\u0DCA\u0DAD\u0DD6\u0DAD\u0DD2\u0DBA\u0DD2.`]],
  ["fill-mask", [`\u0DB8\u0DB8 \u0D9C\u0DD9\u0DAF\u0DBB <mask>.`, `<mask> \u0D89\u0D9C\u0DD9\u0DB1\u0DD3\u0DB8\u0DA7 \u0D9C\u0DD2\u0DBA\u0DCF\u0DBA.`]]
]);
var MAPPING_DE = /* @__PURE__ */ new Map([
  [
    "question-answering",
    [
      {
        text: `Wo wohne ich?`,
        context: `Mein Name ist Wolfgang und ich lebe in Berlin`
      },
      {
        text: `Welcher Name wird auch verwendet, um den Amazonas-Regenwald auf Englisch zu beschreiben?`,
        context: `Der Amazonas-Regenwald, auf Englisch auch als Amazonien oder Amazonas-Dschungel bekannt, ist ein feuchter Laubwald, der den gr\xF6\xDFten Teil des Amazonas-Beckens S\xFCdamerikas bedeckt. Dieses Becken umfasst 7.000.000 Quadratkilometer (2.700.000 Quadratmeilen), von denen 5.500.000 Quadratkilometer (2.100.000 Quadratmeilen) vom Regenwald bedeckt sind. Diese Region umfasst Gebiete von neun Nationen. Der gr\xF6\xDFte Teil des Waldes befindet sich in Brasilien mit 60% des Regenwaldes, gefolgt von Peru mit 13%, Kolumbien mit 10% und geringen Mengen in Venezuela, Ecuador, Bolivien, Guyana, Suriname und Franz\xF6sisch-Guayana. Staaten oder Abteilungen in vier Nationen enthalten "Amazonas" in ihren Namen. Der Amazonas repr\xE4sentiert mehr als die H\xE4lfte der verbleibenden Regenw\xE4lder des Planeten und umfasst den gr\xF6\xDFten und artenreichsten tropischen Regenwald der Welt mit gesch\xE4tzten 390 Milliarden Einzelb\xE4umen, die in 16.000 Arten unterteilt sind.`
      }
    ]
  ],
  [
    "sentence-similarity",
    [
      {
        source_sentence: "Das ist eine gl\xFCckliche Person",
        sentences: [
          "Das ist ein gl\xFCcklicher Hund",
          "Das ist eine sehr gl\xFCckliche Person",
          "Heute ist ein sonniger Tag"
        ]
      }
    ]
  ]
]);
var MAPPING_DV = /* @__PURE__ */ new Map([
  ["text-classification", [`\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078E\u07A6\u0794\u07A7\u0788\u07AD. \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078D\u07AF\u0784\u07A8\u0788\u07AD`]],
  [
    "token-classification",
    [
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0787\u07A6\u0780\u07AA\u0789\u07A6\u078B\u07AA \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0789\u07A7\u078D\u07AD\u078E\u07A6`,
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0790\u07A7\u0783\u07A7 \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0787\u07AA\u078C\u07A9\u0789\u07AA\u078E\u07A6`,
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0787\u07A6\u0787\u07A8\u079D\u07A7 \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u078A\u07AD\u078B\u07AB\u060C \u0787\u07A6\u0787\u07B0\u0791\u07AB\u078E\u07A6`
    ]
  ],
  [
    "question-answering",
    [
      {
        text: `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0786\u07AE\u0782\u07B0\u078C\u07A7\u0786\u07AA\u061F`,
        context: `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0787\u07A6\u0780\u07AA\u0789\u07A6\u078B\u07AA \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0789\u07A7\u078D\u07AD\u078E\u07A6`
      },
      {
        text: `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0786\u07AE\u0782\u07B0\u078C\u07A7\u0786\u07AA\u061F`,
        context: `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0790\u07A7\u0783\u07A7 \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0787\u07AA\u078C\u07A9\u0789\u07AA\u078E\u07A6`
      },
      {
        text: `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0786\u07AE\u0784\u07A7\u061F`,
        context: `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0787\u07A6\u0787\u07A8\u079D\u07A7 \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u078A\u07AD\u078B\u07AB\u078E\u07A6`
      },
      {
        text: `\u0787\u07AC\u0789\u07AD\u0792\u07A6\u0782\u07B0 \u0783\u07AC\u0787\u07A8\u0782\u07B0\u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07B0 \u0790\u07A8\u078A\u07A6\u0786\u07AE\u0781\u07B0\u078B\u07A8\u0782\u07AA\u0789\u07A6\u0781\u07B0 \u0787\u07A8\u0782\u078E\u07A8\u0783\u07AD\u0790\u07A8 \u0784\u07A6\u0780\u07AA\u0782\u07B0 \u0784\u07AD\u0782\u07AA\u0782\u07B0\u0786\u07AA\u0783\u07A7\u0782\u07A9 \u0786\u07AE\u0782\u07B0\u0782\u07A6\u0789\u07AC\u0787\u07B0\u061F`,
        context: `\u0787\u07AC\u0789\u07AD\u0792\u07A6\u0782\u07B0 \u0783\u07AC\u0787\u07A8\u0782\u07B0\u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07B0 (\u0795\u07AF\u0797\u07AA\u0796\u07A9\u0792\u07B0: \u078A\u07B0\u078D\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07A7 \u0787\u07AC\u0789\u07A6\u0790\u07AE\u0782\u07A8\u0786\u07A7 \u0782\u07AA\u0788\u07A6\u078C\u07A6 \u0787\u07AC\u0789\u07A6\u0790\u07AE\u0782\u07A8\u0787\u07A7\u061B \u0790\u07B0\u0795\u07AC\u0782\u07A8\u079D\u07B0: \u0790\u07AC\u078D\u07B0\u0788\u07A7 \u0787\u07AC\u0789\u07A6\u0790\u07AE\u0782\u07A8\u0786\u07A7, \u0787\u07AC\u0789\u07A6\u0790\u07AE\u0782\u07A8\u0787\u07A7 \u0782\u07AB\u0782\u07A9 \u0787\u07A7\u0782\u07B0\u0789\u07AA\u0786\u07AE\u0781\u07B0 \u0787\u07AC\u0789\u07A6\u0792\u07AF\u0782\u07A8\u0787\u07A7\u061B \u078A\u07B0\u0783\u07AC\u0782\u07B0\u0797\u07B0: \u078A\u07AE\u0783\u07AD \u0787\u07AC\u0789\u07AC\u0792\u07AE\u0782\u07A8\u0787\u07AC\u0782\u07B0\u061B \u0791\u07A6\u0797\u07B0: \u0787\u07AC\u0789\u07AC\u0792\u07AF\u0782\u07B0\u0783\u07AD\u078E\u07AC\u0788\u07A6\u0787\u07AA\u0791\u07B0)\u060C \u0787\u07A8\u078E\u07A8\u0783\u07AD\u0790\u07A8 \u0784\u07A6\u0780\u07AA\u0782\u07B0 \u0784\u07AA\u0782\u07A7 \u0787\u07AC\u0789\u07AC\u0792\u07AF\u0782\u07A8\u0787\u07A7 \u0782\u07AA\u0788\u07A6\u078C\u07A6 \u078B\u07A6 \u0787\u07AC\u0789\u07AD\u0792\u07A6\u0782\u07B0 \u0796\u07A6\u0782\u07B0\u078E\u07A6\u078D\u07B0 \u0787\u07A6\u0786\u07A9, \u0790\u07A6\u0787\u07AA\u078C\u07AA \u0787\u07AC\u0789\u07AC\u0783\u07A8\u0786\u07A7\u078E\u07AC \u0787\u07AC\u0789\u07AD\u0792\u07A6\u0782\u07B0 \u0784\u07AD\u0790\u07A8\u0782\u07B0 \u0790\u07A6\u0783\u07A6\u0780\u07A6\u0787\u07B0\u078B\u07AA\u078E\u07AC \u0784\u07AE\u0791\u07AA\u0784\u07A6\u0787\u07AC\u0787\u07B0\u078E\u07A6\u0787\u07A8 \u0780\u07A8\u0789\u07AC\u0782\u07AD \u0789\u07AE\u0787\u07A8\u0790\u07B0\u0793\u07B0 \u0784\u07AE\u0783\u07AF\u0791\u07B0\u078D\u07A9\u078A\u07B0 \u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07AC\u0787\u07AC\u0786\u07AC\u0788\u07AC. \u0787\u07AC\u0789\u07AD\u0792\u07A6\u0782\u07B0 \u0784\u07AD\u0790\u07A8\u0782\u07B0 \u0790\u07A6\u0783\u07A6\u0780\u07A6\u0787\u07B0\u078B\u07AA\u078E\u07AC \u0784\u07AE\u0791\u07AA \u0789\u07A8\u0782\u07A6\u0786\u07A9 7 \u0789\u07A8\u078D\u07A8\u0787\u07A6\u0782\u07B0 \u0787\u07A6\u0786\u07A6 \u0786\u07A8\u078D\u07AF\u0789\u07A9\u0793\u07A6\u0783 (2.7 \u0789\u07A8\u078D\u07A8\u0787\u07A6\u0782\u07B0 \u0787\u07A6\u0786\u07A6 \u0789\u07A6\u0787\u07A8\u078D\u07B0(. \u0789\u07A9\u078E\u07AC \u078C\u07AC\u0783\u07AC\u0787\u07A8\u0782\u07B0 5.5 \u0789\u07A8\u078D\u07A8\u0787\u07A6\u0782\u07B0 \u0787\u07A6\u0786\u07A6 \u0786\u07A8\u078D\u07AF\u0789\u07A9\u0793\u07A6\u0783 (2.1 \u0789\u07A8\u078D\u07A8\u0787\u07A6\u0782\u07B0 \u0787\u07A6\u0786\u07A6 \u0789\u07A6\u0787\u07A8\u078D\u07B0) \u0787\u07A6\u0786\u07A9 \u0789\u07A8 \u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07AC\u0788\u07AC. \u0789\u07A8 \u0790\u07A6\u0783\u07A6\u0780\u07A6\u0787\u07B0\u078B\u07AA\u078E\u07A6\u0787\u07A8 9 \u078E\u07A6\u0787\u07AA\u0789\u07A6\u0786\u07A6\u0781\u07B0 \u0782\u07A8\u0790\u07B0\u0784\u07A6\u078C\u07B0\u0788\u07A7 \u0793\u07AC\u0783\u07A8\u0793\u07A6\u0783\u07A9 \u0780\u07A8\u0789\u07AC\u0782\u07AC\u0787\u07AC\u0788\u07AC.  60% \u0787\u07A7\u0787\u07A8\u0787\u07AC\u0786\u07AC \u0787\u07AC\u0782\u07B0\u0789\u07AC \u0784\u07AE\u0791\u07AA \u0784\u07A6\u0787\u07AC\u0787\u07B0 \u0782\u07A8\u0790\u07B0\u0784\u07A6\u078C\u07B0\u0788\u07A6\u0782\u07A9 \u0784\u07B0\u0783\u07AC\u0792\u07A8\u078D\u07B0\u0787\u07A6\u0781\u07AC\u0788\u07AC. \u0787\u07AD\u078E\u07AC \u078A\u07A6\u0780\u07AA\u078C\u07AA\u0782\u07B0 13% \u0787\u07A7\u0787\u07AC\u0786\u07AA \u0795\u07AC\u0783\u07AB \u0787\u07A7\u0787\u07A8 10% \u0787\u07A7\u0787\u07AC\u0786\u07AA \u0786\u07AE\u078D\u07A6\u0789\u07B0\u0784\u07A8\u0787\u07A7 \u0787\u07A6\u078B\u07A8 \u0786\u07AA\u0791\u07A6 \u0784\u07A6\u0787\u07AC\u0787\u07B0 \u0780\u07A8\u0789\u07AC\u0782\u07AD \u078E\u07AE\u078C\u07AA\u0782\u07B0 \u0788\u07AC\u0782\u07AC\u0792\u07AA\u0787\u07AC\u078D\u07A7, \u0787\u07AC\u0786\u07B0\u0787\u07A6\u0791\u07AF, \u0784\u07AE\u078D\u07A8\u0788\u07A8\u0787\u07A7, \u078E\u07AA\u0794\u07A7\u0782\u07A7, \u0790\u07AA\u0783\u07A8\u0782\u07A7\u0789\u07B0 \u0787\u07A6\u078B\u07A8 \u078A\u07B0\u0783\u07AC\u0782\u07B0\u0797\u07B0 \u078E\u07B0\u0787\u07A7\u0782\u07A7 \u0787\u07A6\u0781\u07B0 \u0788\u07AC\u0790\u07B0 \u0782\u07A8\u0790\u07B0\u0784\u07A6\u078C\u07B0\u0788\u07AC\u0787\u07AC\u0788\u07AC. \u0789\u07A9\u078E\u07AC \u078C\u07AC\u0783\u07AC\u0787\u07A8\u0782\u07B0 4 \u078E\u07A6\u0787\u07AA\u0789\u07AC\u0787\u07B0\u078E\u07A6\u0787\u07A8 "\u0787\u07AC\u0789\u07AC\u0792\u07AE\u0782\u07A7\u0790\u07B0" \u0780\u07A8\u0789\u07A6\u0782\u07A6\u0787\u07A8\u078E\u07AC\u0782\u07B0 \u0790\u07B0\u0793\u07AD\u0793\u07B0 \u0782\u07AA\u0788\u07A6\u078C\u07A6 \u0791\u07A8\u0795\u07A7\u0793\u07B0\u0789\u07A6\u0782\u07B0\u0793\u07B0 \u0787\u07A6\u0786\u07A6\u0781\u07B0 \u0782\u07A6\u0782\u07B0\u078B\u07A9\u078A\u07A6\u0787\u07A8\u0788\u07AC\u0787\u07AC\u0788\u07AC. \u0789\u07AA\u0785\u07A8 \u078B\u07AA\u0782\u07A8\u0794\u07AD\u078E\u07A6\u0787\u07A8 \u0784\u07A7\u0786\u07A9 \u0780\u07AA\u0783\u07A8 \u0783\u07AC\u0787\u07A8\u0782\u07B0\u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07B0\u078E\u07AC \u078C\u07AC\u0783\u07AC\u0787\u07A8\u0782\u07B0 \u078B\u07AC\u0784\u07A6\u0787\u07A8\u0786\u07AA\u0785\u07A6 \u0787\u07AC\u0787\u07B0\u0784\u07A6\u0794\u07A6\u0781\u07B0\u0788\u07AA\u0783\u07AC\u0784\u07AE\u0791\u07AA\u0788\u07A6\u0783\u07AC\u0787\u07B0 \u0787\u07AC\u0789\u07AD\u0792\u07AE\u0782\u07B0 \u0783\u07AC\u0787\u07A8\u0782\u07B0\u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07B0 \u0780\u07A8\u0787\u07B0\u0790\u07A7\u0786\u07AA\u0783\u07AC\u0787\u07AC\u0788\u07AC. \u0789\u07A8\u0787\u07A9 \u0789\u07AA\u0785\u07A8 \u078B\u07AA\u0782\u07A8\u0794\u07AC\u0787\u07A8\u0782\u07B0 \u0787\u07AC\u0782\u07B0\u0789\u07AE \u0784\u07AE\u0791\u07AA \u0787\u07A6\u078B\u07A8 \u0787\u07AC\u0782\u07B0\u0789\u07AC \u0784\u07A6\u0787\u07AE\u0791\u07A6\u0787\u07A8\u0788\u07A6\u0783\u0790\u07B0 \u0783\u07AC\u0787\u07A8\u0782\u07B0\u078A\u07AE\u0783\u07AC\u0790\u07B0\u0793\u07B0 \u0793\u07B0\u0783\u07AC\u0786\u07B0\u0793\u07AC\u0788\u07AC. \u078D\u07A6\u078A\u07A7\u0786\u07AA\u0783\u07AC\u0788\u07AD \u078E\u07AE\u078C\u07AA\u0782\u07B0 16 \u0780\u07A7\u0790\u07B0 \u0790\u07B0\u0795\u07A9\u079D\u07A9\u0790\u07B0\u0787\u07A6\u0781\u07B0 \u0784\u07AC\u0780\u07A8\u078E\u07AC\u0782\u07B0\u0788\u07A7 390 \u0789\u07A8\u078D\u07A8\u0787\u07A6\u0782\u07B0 \u0788\u07A6\u0787\u07B0\u078C\u07A6\u0783\u07AA\u078E\u07AC \u078E\u07A6\u0790\u07B0 \u0789\u07A8\u078C\u07A7\u078E\u07A6\u0787\u07A8 \u0780\u07A8\u0789\u07AC\u0782\u07AC\u0787\u07AC\u0788\u07AC`
      }
    ]
  ],
  [
    "translation",
    [
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0787\u07A6\u0780\u07AA\u0789\u07A6\u078B\u07AA \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0789\u07A7\u078D\u07AD\u078E\u07A6`,
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0790\u07A7\u0783\u07A7 \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u078B\u07A8\u0783\u07A8\u0787\u07AA\u0785\u07AC\u0782\u07A9 \u0787\u07AA\u078C\u07A9\u0789\u07AA\u078E\u07A6`
    ]
  ],
  [
    "summarization",
    [
      `\u0793\u07A6\u0788\u07A6\u0783\u07AA\u078E\u07AC \u0787\u07AA\u0790\u07B0\u0789\u07A8\u0782\u07A6\u0786\u07A9 324 \u0789\u07A9\u0793\u07A6\u0783\u07AA\u060C \u0787\u07AC\u0787\u07A9 \u078E\u07A7\u078C\u07B0\u078E\u07A6\u0782\u0791\u07A6\u0786\u07A6\u0781\u07B0 81 \u0784\u07AA\u0783\u07A9\u078E\u07AC \u0787\u07A8\u0789\u07A7\u0783\u07A7\u078C\u07A6\u0786\u07A7\u0787\u07A8 \u0787\u07AC\u0787\u07B0\u0788\u07A6\u0783\u07AC\u0788\u07AC. \u0787\u07AC\u0787\u07A9 \u0795\u07AC\u0783\u07A8\u0790\u07B0\u078E\u07A6\u0787\u07A8 \u0780\u07AA\u0783\u07A8 \u0787\u07AC\u0782\u07B0\u0789\u07AC \u0787\u07AA\u0790\u07B0 \u0787\u07A8\u0789\u07A7\u0783\u07A7\u078C\u07AC\u0788\u07AC. \u0787\u07AD\u078E\u07AC \u0780\u07A6\u078C\u07A6\u0783\u07AC\u0790\u07B0\u0786\u07A6\u0782\u07A6\u0781\u07B0 \u0780\u07AA\u0783\u07A8 \u0784\u07AA\u0791\u07AA\u078E\u07AC \u078B\u07A8\u078E\u07AA\u0789\u07A8\u0782\u07A6\u0786\u07A9 \u0786\u07AE\u0782\u07B0\u0789\u07AC \u078A\u07A6\u0783\u07A7\u078C\u07A6\u0786\u07AA\u0782\u07B0 125 \u0789\u07A9\u0793\u07A6\u0783\u07AC\u0788\u07AC. (410 \u078A\u07AB\u0793\u07AA) \u0787\u07A6\u0787\u07A8\u078A\u07A8\u078D\u07B0 \u0793\u07A6\u0788\u07A6\u0783\u07AA \u0784\u07A8\u0782\u07A7\u0786\u07AA\u0783\u07A8 \u0787\u07A8\u0783\u07AA\u060C \u0788\u07AE\u079D\u07A8\u0782\u07B0\u078E\u07B0\u0793\u07A6\u0782\u07B0 \u0789\u07AE\u0782\u07A8\u0787\u07AA\u0789\u07AC\u0782\u07B0\u0793\u07B0\u078E\u07AC \u0787\u07AA\u0790\u07B0\u0789\u07A8\u0782\u07B0 \u078A\u07A6\u0780\u07A6\u0782\u07A6\u0787\u07A6\u0785\u07A7 \u078E\u07AE\u0790\u07B0\u060C \u078B\u07AA\u0782\u07A8\u0794\u07AD\u078E\u07A6\u0787\u07A8 \u0789\u07A9\u0780\u07AA\u0782\u07B0 \u0787\u07AA\u078A\u07AC\u0787\u07B0\u078B\u07A8 \u078C\u07A6\u0782\u07B0\u078C\u07A6\u0782\u07AA\u078E\u07AC \u078C\u07AC\u0783\u07AC\u0787\u07A8\u0782\u07B0 \u0787\u07AC\u0782\u07B0\u0789\u07AC \u0787\u07AA\u0790\u07B0 \u078C\u07A6\u0782\u07AA\u078E\u07AC \u078D\u07A6\u078E\u07A6\u0784\u07AA \u078D\u07A8\u0784\u07AA\u0782\u07AC\u0788\u07AC. \u0787\u07A6\u078B\u07A8 1930 \u078E\u07A6\u0787\u07A8 \u0782\u07A8\u0787\u07AA \u0794\u07AF\u0786\u07B0\u078E\u07AC \u0786\u07B0\u0783\u07A6\u0787\u07A8\u0790\u07B0\u078D\u07A6\u0783 \u0784\u07A8\u078D\u07B0\u0791\u07A8\u0782\u07B0\u078E\u07B0 \u0784\u07A8\u0782\u07A7\u0786\u07AA\u0783\u07AA\u0789\u07A7\u0787\u07A8 \u0780\u07A6\u0789\u07A6\u0787\u07A6\u0781\u07B0 41 \u0787\u07A6\u0780\u07A6\u0783\u07AA \u0788\u07A6\u0782\u07B0\u078B\u07AC\u0782\u07B0 \u0789\u07A8\u078D\u07A6\u078E\u07A6\u0784\u07AA \u0780\u07A8\u078A\u07AC\u0780\u07AC\u0787\u07B0\u0793\u07A8\u0787\u07AC\u0788\u07AC. \u0789\u07A8\u0787\u07A9 300 \u0789\u07A9\u0793\u07A6\u0783\u07A6\u0781\u07B0 \u0788\u07AA\u0783\u07AC \u0787\u07AA\u0790\u07B0\u0786\u07AE\u0781\u07B0 \u0787\u07A8\u0789\u07A7\u0783\u07A7\u078C\u07B0\u0786\u07AA\u0783\u07AC\u0788\u07AA\u0782\u07AA \u078A\u07AA\u0783\u07A6\u078C\u07A6\u0789\u07A6 \u078C\u07A6\u0782\u07AC\u0788\u07AC. 1957 \u078E\u07A6\u0787\u07A8 \u0793\u07A6\u0788\u07A6\u0783\u07AA\u078E\u07AC \u0787\u07AC\u0782\u07B0\u0789\u07AC \u0789\u07A6\u078C\u07A9\u078E\u07A6\u0787\u07A8 \u0780\u07A6\u0783\u07AA\u0786\u07AA\u0783\u07AC\u0788\u07AA\u0782\u07AA \u0784\u07B0\u0783\u07AF\u0791\u07B0\u0786\u07A7\u0790\u07B0\u0793\u07A8\u0782\u07B0\u078E \u0787\u07AD\u0783\u07A8\u0787\u07A6\u078D\u07B0\u078E\u07AC \u0790\u07A6\u0784\u07A6\u0784\u07AA\u0782\u07B0 \u0789\u07A8\u0780\u07A7\u0783\u07AA \u0789\u07A8 \u0793\u07A6\u0788\u07A6\u0783\u07AA \u0786\u07B0\u0783\u07A6\u0787\u07A8\u0790\u07B0\u078D\u07A6\u0783 \u0784\u07A8\u078D\u07B0\u0791\u07A8\u0782\u07B0\u078E\u0787\u07A6\u0781\u07B0 \u0788\u07AA\u0783\u07AC 5.2 \u0789\u07A9\u0793\u07A6\u0783 (17 \u078A\u07AB\u0793\u07AA) \u0787\u07AA\u0780\u07AC\u0788\u07AC. \u0789\u07A8 \u0793\u07B0\u0783\u07A7\u0782\u07B0\u0790\u07B0\u0789\u07A8\u0793\u07A6\u0783\u07AA \u0782\u07AA\u078D\u07A7\u060C \u0787\u07A6\u0787\u07A8\u078A\u07A8\u078D\u07B0 \u0793\u07A6\u0788\u07A6\u0783\u07A6\u0786\u07A9\u060C \u0789\u07A8\u078D\u07A7\u0787\u07AA \u0788\u07A8\u0787\u07A7\u0791\u07A6\u0786\u07B0\u0793\u07A6\u0781\u07B0 \u078A\u07A6\u0780\u07AA \u078A\u07B0\u0783\u07A7\u0782\u07B0\u0790\u07B0\u078E\u07A6\u0787\u07A8 \u0780\u07AA\u0783\u07A8 2 \u0788\u07A6\u0782\u07A6\u0787\u07A6\u0781\u07B0 \u0787\u07AC\u0782\u07B0\u0789\u07AC \u0787\u07AA\u0790\u07B0 \u078A\u07B0\u0783\u07A9\u0790\u07B0\u0793\u07AD\u0782\u07B0\u0791\u07A8\u0782\u07B0\u078E \u0787\u07A8\u0789\u07A7\u0783\u07A7\u078C\u07AC\u0788\u07AC`
    ]
  ],
  [
    "text-generation",
    [
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0794\u07AB\u0790\u07AA\u078A\u07B0 \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0789\u07A6\u0787\u07A8\u078E\u07A6\u0782\u0791\u07AA`,
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u0789\u07A6\u0783\u07A8\u0787\u07A6\u0789\u07B0\u060C \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0 \u0787\u07AC\u0782\u07B0\u0789\u07AC \u078E\u07A6\u0794\u07A7\u0788\u07A7`,
      `\u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0\u078E\u07AC \u0782\u07A6\u0789\u07A6\u0786\u07A9 \u078A\u07A7\u078C\u07AA\u0789\u07A6\u078C\u07AA \u0787\u07A6\u078B\u07A8 \u0787\u07A6\u0780\u07A6\u0783\u07AC\u0782\u07B0`,
      `\u060C\u0787\u07AC\u0787\u07B0 \u0792\u07A6\u0789\u07A7\u0782\u07AC\u0787\u07B0\u078E\u07A6\u0787\u07A8`
    ]
  ],
  ["fill-mask", [`.<mask> \u0789\u07A7\u078D\u07AC \u0787\u07A6\u0786\u07A9 \u078B\u07A8\u0788\u07AC\u0780\u07A8\u0783\u07A7\u0787\u07B0\u0796\u07AD\u078E\u07AC`, `\u078E\u07A6\u0783\u07AA\u078B\u07A8\u0794\u07A6\u0787\u07A6\u0786\u07A9 \u078B\u07A8\u0788\u07AC\u0780\u07A8\u0782\u07B0\u078E\u07AC \u0789\u07AC\u078B\u07AA\u078E\u07A6\u0787\u07A8 <mask> \u0786\u07AC\u0787\u07AA\u0789\u07AC\u0787\u07B0.`]]
]);
var MAPPING_DEFAULT_WIDGET = /* @__PURE__ */ new Map([
  ["en", MAPPING_EN],
  ["zh", MAPPING_ZH],
  ["fr", MAPPING_FR],
  ["es", MAPPING_ES],
  ["ru", MAPPING_RU],
  ["uk", MAPPING_UK],
  ["it", MAPPING_IT],
  ["fa", MAPPING_FA],
  ["ar", MAPPING_AR],
  ["bn", MAPPING_BN],
  ["mn", MAPPING_MN],
  ["si", MAPPING_SI],
  ["de", MAPPING_DE],
  ["dv", MAPPING_DV]
]);

// src/pipelines.ts
var MODALITIES = ["multimodal", "nlp", "cv", "audio", "tabular", "rl", "other"];
var MODALITY_LABELS = {
  multimodal: "Multimodal",
  nlp: "Natural Language Processing",
  audio: "Audio",
  cv: "Computer Vision",
  rl: "Reinforcement Learning",
  tabular: "Tabular",
  other: "Other"
};
var PIPELINE_DATA = {
  "text-classification": {
    name: "Text Classification",
    subtasks: [
      {
        type: "acceptability-classification",
        name: "Acceptability Classification"
      },
      {
        type: "entity-linking-classification",
        name: "Entity Linking Classification"
      },
      {
        type: "fact-checking",
        name: "Fact Checking"
      },
      {
        type: "intent-classification",
        name: "Intent Classification"
      },
      {
        type: "language-identification",
        name: "Language Identification"
      },
      {
        type: "multi-class-classification",
        name: "Multi Class Classification"
      },
      {
        type: "multi-label-classification",
        name: "Multi Label Classification"
      },
      {
        type: "multi-input-text-classification",
        name: "Multi-input Text Classification"
      },
      {
        type: "natural-language-inference",
        name: "Natural Language Inference"
      },
      {
        type: "semantic-similarity-classification",
        name: "Semantic Similarity Classification"
      },
      {
        type: "sentiment-classification",
        name: "Sentiment Classification"
      },
      {
        type: "topic-classification",
        name: "Topic Classification"
      },
      {
        type: "semantic-similarity-scoring",
        name: "Semantic Similarity Scoring"
      },
      {
        type: "sentiment-scoring",
        name: "Sentiment Scoring"
      },
      {
        type: "sentiment-analysis",
        name: "Sentiment Analysis"
      },
      {
        type: "hate-speech-detection",
        name: "Hate Speech Detection"
      },
      {
        type: "text-scoring",
        name: "Text Scoring"
      }
    ],
    modality: "nlp",
    color: "orange"
  },
  "token-classification": {
    name: "Token Classification",
    subtasks: [
      {
        type: "named-entity-recognition",
        name: "Named Entity Recognition"
      },
      {
        type: "part-of-speech",
        name: "Part of Speech"
      },
      {
        type: "parsing",
        name: "Parsing"
      },
      {
        type: "lemmatization",
        name: "Lemmatization"
      },
      {
        type: "word-sense-disambiguation",
        name: "Word Sense Disambiguation"
      },
      {
        type: "coreference-resolution",
        name: "Coreference-resolution"
      }
    ],
    modality: "nlp",
    color: "blue"
  },
  "table-question-answering": {
    name: "Table Question Answering",
    modality: "nlp",
    color: "green"
  },
  "question-answering": {
    name: "Question Answering",
    subtasks: [
      {
        type: "extractive-qa",
        name: "Extractive QA"
      },
      {
        type: "open-domain-qa",
        name: "Open Domain QA"
      },
      {
        type: "closed-domain-qa",
        name: "Closed Domain QA"
      }
    ],
    modality: "nlp",
    color: "blue"
  },
  "zero-shot-classification": {
    name: "Zero-Shot Classification",
    modality: "nlp",
    color: "yellow"
  },
  translation: {
    name: "Translation",
    modality: "nlp",
    color: "green"
  },
  summarization: {
    name: "Summarization",
    subtasks: [
      {
        type: "news-articles-summarization",
        name: "News Articles Summarization"
      },
      {
        type: "news-articles-headline-generation",
        name: "News Articles Headline Generation"
      }
    ],
    modality: "nlp",
    color: "indigo"
  },
  "feature-extraction": {
    name: "Feature Extraction",
    modality: "nlp",
    color: "red"
  },
  "text-generation": {
    name: "Text Generation",
    subtasks: [
      {
        type: "dialogue-modeling",
        name: "Dialogue Modeling"
      },
      {
        type: "dialogue-generation",
        name: "Dialogue Generation"
      },
      {
        type: "conversational",
        name: "Conversational"
      },
      {
        type: "language-modeling",
        name: "Language Modeling"
      }
    ],
    modality: "nlp",
    color: "indigo"
  },
  "text2text-generation": {
    name: "Text2Text Generation",
    subtasks: [
      {
        type: "text-simplification",
        name: "Text simplification"
      },
      {
        type: "explanation-generation",
        name: "Explanation Generation"
      },
      {
        type: "abstractive-qa",
        name: "Abstractive QA"
      },
      {
        type: "open-domain-abstractive-qa",
        name: "Open Domain Abstractive QA"
      },
      {
        type: "closed-domain-qa",
        name: "Closed Domain QA"
      },
      {
        type: "open-book-qa",
        name: "Open Book QA"
      },
      {
        type: "closed-book-qa",
        name: "Closed Book QA"
      }
    ],
    modality: "nlp",
    color: "indigo"
  },
  "fill-mask": {
    name: "Fill-Mask",
    subtasks: [
      {
        type: "slot-filling",
        name: "Slot Filling"
      },
      {
        type: "masked-language-modeling",
        name: "Masked Language Modeling"
      }
    ],
    modality: "nlp",
    color: "red"
  },
  "sentence-similarity": {
    name: "Sentence Similarity",
    modality: "nlp",
    color: "yellow"
  },
  "text-to-speech": {
    name: "Text-to-Speech",
    modality: "audio",
    color: "yellow"
  },
  "text-to-audio": {
    name: "Text-to-Audio",
    modality: "audio",
    color: "yellow"
  },
  "automatic-speech-recognition": {
    name: "Automatic Speech Recognition",
    modality: "audio",
    color: "yellow"
  },
  "audio-to-audio": {
    name: "Audio-to-Audio",
    modality: "audio",
    color: "blue"
  },
  "audio-classification": {
    name: "Audio Classification",
    subtasks: [
      {
        type: "keyword-spotting",
        name: "Keyword Spotting"
      },
      {
        type: "speaker-identification",
        name: "Speaker Identification"
      },
      {
        type: "audio-intent-classification",
        name: "Audio Intent Classification"
      },
      {
        type: "audio-emotion-recognition",
        name: "Audio Emotion Recognition"
      },
      {
        type: "audio-language-identification",
        name: "Audio Language Identification"
      }
    ],
    modality: "audio",
    color: "green"
  },
  "voice-activity-detection": {
    name: "Voice Activity Detection",
    modality: "audio",
    color: "red"
  },
  "depth-estimation": {
    name: "Depth Estimation",
    modality: "cv",
    color: "yellow"
  },
  "image-classification": {
    name: "Image Classification",
    subtasks: [
      {
        type: "multi-label-image-classification",
        name: "Multi Label Image Classification"
      },
      {
        type: "multi-class-image-classification",
        name: "Multi Class Image Classification"
      }
    ],
    modality: "cv",
    color: "blue"
  },
  "object-detection": {
    name: "Object Detection",
    subtasks: [
      {
        type: "face-detection",
        name: "Face Detection"
      },
      {
        type: "vehicle-detection",
        name: "Vehicle Detection"
      }
    ],
    modality: "cv",
    color: "yellow"
  },
  "image-segmentation": {
    name: "Image Segmentation",
    subtasks: [
      {
        type: "instance-segmentation",
        name: "Instance Segmentation"
      },
      {
        type: "semantic-segmentation",
        name: "Semantic Segmentation"
      },
      {
        type: "panoptic-segmentation",
        name: "Panoptic Segmentation"
      }
    ],
    modality: "cv",
    color: "green"
  },
  "text-to-image": {
    name: "Text-to-Image",
    modality: "cv",
    color: "yellow"
  },
  "image-to-text": {
    name: "Image-to-Text",
    subtasks: [
      {
        type: "image-captioning",
        name: "Image Captioning"
      }
    ],
    modality: "cv",
    color: "red"
  },
  "image-to-image": {
    name: "Image-to-Image",
    subtasks: [
      {
        type: "image-inpainting",
        name: "Image Inpainting"
      },
      {
        type: "image-colorization",
        name: "Image Colorization"
      },
      {
        type: "super-resolution",
        name: "Super Resolution"
      }
    ],
    modality: "cv",
    color: "indigo"
  },
  "image-to-video": {
    name: "Image-to-Video",
    modality: "cv",
    color: "indigo"
  },
  "unconditional-image-generation": {
    name: "Unconditional Image Generation",
    modality: "cv",
    color: "green"
  },
  "video-classification": {
    name: "Video Classification",
    modality: "cv",
    color: "blue"
  },
  "reinforcement-learning": {
    name: "Reinforcement Learning",
    modality: "rl",
    color: "red"
  },
  robotics: {
    name: "Robotics",
    modality: "rl",
    subtasks: [
      {
        type: "grasping",
        name: "Grasping"
      },
      {
        type: "task-planning",
        name: "Task Planning"
      }
    ],
    color: "blue"
  },
  "tabular-classification": {
    name: "Tabular Classification",
    modality: "tabular",
    subtasks: [
      {
        type: "tabular-multi-class-classification",
        name: "Tabular Multi Class Classification"
      },
      {
        type: "tabular-multi-label-classification",
        name: "Tabular Multi Label Classification"
      }
    ],
    color: "blue"
  },
  "tabular-regression": {
    name: "Tabular Regression",
    modality: "tabular",
    subtasks: [
      {
        type: "tabular-single-column-regression",
        name: "Tabular Single Column Regression"
      }
    ],
    color: "blue"
  },
  "tabular-to-text": {
    name: "Tabular to Text",
    modality: "tabular",
    subtasks: [
      {
        type: "rdf-to-text",
        name: "RDF to text"
      }
    ],
    color: "blue",
    hideInModels: true
  },
  "table-to-text": {
    name: "Table to Text",
    modality: "nlp",
    color: "blue",
    hideInModels: true
  },
  "multiple-choice": {
    name: "Multiple Choice",
    subtasks: [
      {
        type: "multiple-choice-qa",
        name: "Multiple Choice QA"
      },
      {
        type: "multiple-choice-coreference-resolution",
        name: "Multiple Choice Coreference Resolution"
      }
    ],
    modality: "nlp",
    color: "blue",
    hideInModels: true
  },
  "text-retrieval": {
    name: "Text Retrieval",
    subtasks: [
      {
        type: "document-retrieval",
        name: "Document Retrieval"
      },
      {
        type: "utterance-retrieval",
        name: "Utterance Retrieval"
      },
      {
        type: "entity-linking-retrieval",
        name: "Entity Linking Retrieval"
      },
      {
        type: "fact-checking-retrieval",
        name: "Fact Checking Retrieval"
      }
    ],
    modality: "nlp",
    color: "indigo",
    hideInModels: true
  },
  "time-series-forecasting": {
    name: "Time Series Forecasting",
    modality: "tabular",
    subtasks: [
      {
        type: "univariate-time-series-forecasting",
        name: "Univariate Time Series Forecasting"
      },
      {
        type: "multivariate-time-series-forecasting",
        name: "Multivariate Time Series Forecasting"
      }
    ],
    color: "blue"
  },
  "text-to-video": {
    name: "Text-to-Video",
    modality: "cv",
    color: "green"
  },
  "image-text-to-text": {
    name: "Image-Text-to-Text",
    modality: "multimodal",
    color: "red",
    hideInDatasets: true
  },
  "visual-question-answering": {
    name: "Visual Question Answering",
    subtasks: [
      {
        type: "visual-question-answering",
        name: "Visual Question Answering"
      }
    ],
    modality: "multimodal",
    color: "red"
  },
  "document-question-answering": {
    name: "Document Question Answering",
    subtasks: [
      {
        type: "document-question-answering",
        name: "Document Question Answering"
      }
    ],
    modality: "multimodal",
    color: "blue",
    hideInDatasets: true
  },
  "zero-shot-image-classification": {
    name: "Zero-Shot Image Classification",
    modality: "cv",
    color: "yellow"
  },
  "graph-ml": {
    name: "Graph Machine Learning",
    modality: "other",
    color: "green"
  },
  "mask-generation": {
    name: "Mask Generation",
    modality: "cv",
    color: "indigo"
  },
  "zero-shot-object-detection": {
    name: "Zero-Shot Object Detection",
    modality: "cv",
    color: "yellow"
  },
  "text-to-3d": {
    name: "Text-to-3D",
    modality: "cv",
    color: "yellow"
  },
  "image-to-3d": {
    name: "Image-to-3D",
    modality: "cv",
    color: "green"
  },
  "image-feature-extraction": {
    name: "Image Feature Extraction",
    modality: "cv",
    color: "indigo"
  },
  "video-text-to-text": {
    name: "Video-Text-to-Text",
    modality: "multimodal",
    color: "blue",
    hideInDatasets: false
  },
  "keypoint-detection": {
    name: "Keypoint Detection",
    subtasks: [
      {
        type: "pose-estimation",
        name: "Pose Estimation"
      }
    ],
    modality: "cv",
    color: "red",
    hideInDatasets: true
  },
  "any-to-any": {
    name: "Any-to-Any",
    modality: "multimodal",
    color: "yellow",
    hideInDatasets: true
  },
  other: {
    name: "Other",
    modality: "other",
    color: "blue",
    hideInModels: true,
    hideInDatasets: true
  }
};
var PIPELINE_TYPES = Object.keys(PIPELINE_DATA);
var SUBTASK_TYPES = Object.values(PIPELINE_DATA).flatMap((data) => "subtasks" in data ? data.subtasks : []).map((s) => s.type);
var PIPELINE_TYPES_SET = new Set(PIPELINE_TYPES);

// src/tasks/audio-classification/data.ts
var taskData = {
  datasets: [
    {
      description: "A benchmark of 10 different audio tasks.",
      id: "s3prl/superb"
    },
    {
      description: "A dataset of YouTube clips and their sound categories.",
      id: "agkphysics/AudioSet"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "audio.wav",
        type: "audio"
      }
    ],
    outputs: [
      {
        data: [
          {
            label: "Up",
            score: 0.2
          },
          {
            label: "Down",
            score: 0.8
          }
        ],
        type: "chart"
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "",
      id: "recall"
    },
    {
      description: "",
      id: "precision"
    },
    {
      description: "",
      id: "f1"
    }
  ],
  models: [
    {
      description: "An easy-to-use model for command recognition.",
      id: "speechbrain/google_speech_command_xvector"
    },
    {
      description: "An emotion recognition model.",
      id: "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
    },
    {
      description: "A language identification model.",
      id: "facebook/mms-lid-126"
    }
  ],
  spaces: [
    {
      description: "An application that can classify music into different genre.",
      id: "kurianbenoy/audioclassification"
    }
  ],
  summary: "Audio classification is the task of assigning a label or class to a given audio. It can be used for recognizing which command a user is giving or the emotion of a statement, as well as identifying a speaker.",
  widgetModels: ["MIT/ast-finetuned-audioset-10-10-0.4593"],
  youtubeId: "KWwzcmG98Ds"
};
var data_default = taskData;

// src/tasks/audio-to-audio/data.ts
var taskData2 = {
  datasets: [
    {
      description: "512-element X-vector embeddings of speakers from CMU ARCTIC dataset.",
      id: "Matthijs/cmu-arctic-xvectors"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "input.wav",
        type: "audio"
      }
    ],
    outputs: [
      {
        filename: "label-0.wav",
        type: "audio"
      },
      {
        filename: "label-1.wav",
        type: "audio"
      }
    ]
  },
  metrics: [
    {
      description: "The Signal-to-Noise ratio is the relationship between the target signal level and the background noise level. It is calculated as the logarithm of the target signal divided by the background noise, in decibels.",
      id: "snri"
    },
    {
      description: "The Signal-to-Distortion ratio is the relationship between the target signal and the sum of noise, interference, and artifact errors",
      id: "sdri"
    }
  ],
  models: [
    {
      description: "A solid model of audio source separation.",
      id: "speechbrain/sepformer-wham"
    },
    {
      description: "A speech enhancement model.",
      id: "ResembleAI/resemble-enhance"
    },
    {
      description: "A model that can change the voice in a speech recording.",
      id: "microsoft/speecht5_vc"
    }
  ],
  spaces: [
    {
      description: "An application for speech separation.",
      id: "younver/speechbrain-speech-separation"
    },
    {
      description: "An application for audio style transfer.",
      id: "nakas/audio-diffusion_style_transfer"
    }
  ],
  summary: "Audio-to-Audio is a family of tasks in which the input is an audio and the output is one or multiple generated audios. Some example tasks are speech enhancement and source separation.",
  widgetModels: ["speechbrain/sepformer-wham"],
  youtubeId: "iohj7nCCYoM"
};
var data_default2 = taskData2;

// src/tasks/automatic-speech-recognition/data.ts
var taskData3 = {
  datasets: [
    {
      description: "31,175 hours of multilingual audio-text dataset in 108 languages.",
      id: "mozilla-foundation/common_voice_17_0"
    },
    {
      description: "A dataset with 44.6k hours of English speaker data and 6k hours of other language speakers.",
      id: "parler-tts/mls_eng"
    },
    {
      description: "A multi-lingual audio dataset with 370K hours of audio.",
      id: "espnet/yodas"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "input.flac",
        type: "audio"
      }
    ],
    outputs: [
      {
        /// GOING ALONG SLUSHY COUNTRY ROADS AND SPEAKING TO DAMP AUDIENCES I
        label: "Transcript",
        content: "Going along slushy country roads and speaking to damp audiences in...",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "wer"
    },
    {
      description: "",
      id: "cer"
    }
  ],
  models: [
    {
      description: "A powerful ASR model by OpenAI.",
      id: "openai/whisper-large-v3"
    },
    {
      description: "A good generic speech model by MetaAI for fine-tuning.",
      id: "facebook/w2v-bert-2.0"
    },
    {
      description: "An end-to-end model that performs ASR and Speech Translation by MetaAI.",
      id: "facebook/seamless-m4t-v2-large"
    },
    {
      description: "Powerful speaker diarization model.",
      id: "pyannote/speaker-diarization-3.1"
    }
  ],
  spaces: [
    {
      description: "A powerful general-purpose speech recognition application.",
      id: "hf-audio/whisper-large-v3"
    },
    {
      description: "Fastest speech recognition application.",
      id: "sanchit-gandhi/whisper-jax"
    },
    {
      description: "A high quality speech and text translation model by Meta.",
      id: "facebook/seamless_m4t"
    }
  ],
  summary: "Automatic Speech Recognition (ASR), also known as Speech to Text (STT), is the task of transcribing a given audio to text. It has many applications, such as voice user interfaces.",
  widgetModels: ["openai/whisper-large-v3"],
  youtubeId: "TksaY_FDgnk"
};
var data_default3 = taskData3;

// src/tasks/document-question-answering/data.ts
var taskData4 = {
  datasets: [
    {
      description: "Largest document understanding dataset.",
      id: "HuggingFaceM4/Docmatix"
    },
    {
      description: "Dataset from the 2020 DocVQA challenge. The documents are taken from the UCSF Industry Documents Library.",
      id: "eliolio/docvqa"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Question",
        content: "What is the idea behind the consumer relations efficiency team?",
        type: "text"
      },
      {
        filename: "document-question-answering-input.png",
        type: "img"
      }
    ],
    outputs: [
      {
        label: "Answer",
        content: "Balance cost efficiency with quality customer service",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "The evaluation metric for the DocVQA challenge is the Average Normalized Levenshtein Similarity (ANLS). This metric is flexible to character regognition errors and compares the predicted answer with the ground truth answer.",
      id: "anls"
    },
    {
      description: "Exact Match is a metric based on the strict character match of the predicted answer and the right answer. For answers predicted correctly, the Exact Match will be 1. Even if only one character is different, Exact Match will be 0",
      id: "exact-match"
    }
  ],
  models: [
    {
      description: "A robust document question answering model.",
      id: "impira/layoutlm-document-qa"
    },
    {
      description: "A document question answering model specialized in invoices.",
      id: "impira/layoutlm-invoices"
    },
    {
      description: "A special model for OCR-free document question answering.",
      id: "microsoft/udop-large"
    },
    {
      description: "A powerful model for document question answering.",
      id: "google/pix2struct-docvqa-large"
    }
  ],
  spaces: [
    {
      description: "A robust document question answering application.",
      id: "impira/docquery"
    },
    {
      description: "An application that can answer questions from invoices.",
      id: "impira/invoices"
    },
    {
      description: "An application to compare different document question answering models.",
      id: "merve/compare_docvqa_models"
    }
  ],
  summary: "Document Question Answering (also known as Document Visual Question Answering) is the task of answering questions on document images. Document question answering models take a (document, question) pair as input and return an answer in natural language. Models usually rely on multi-modal features, combining text, position of words (bounding-boxes) and image.",
  widgetModels: ["impira/layoutlm-invoices"],
  youtubeId: ""
};
var data_default4 = taskData4;

// src/tasks/feature-extraction/data.ts
var taskData5 = {
  datasets: [
    {
      description: "Wikipedia dataset containing cleaned articles of all languages. Can be used to train `feature-extraction` models.",
      id: "wikipedia"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "India, officially the Republic of India, is a country in South Asia.",
        type: "text"
      }
    ],
    outputs: [
      {
        table: [
          ["Dimension 1", "Dimension 2", "Dimension 3"],
          ["2.583383083343506", "2.757075071334839", "0.9023529887199402"],
          ["8.29393482208252", "1.1071064472198486", "2.03399395942688"],
          ["-0.7754912972450256", "-1.647324562072754", "-0.6113331913948059"],
          ["0.07087723910808563", "1.5942802429199219", "1.4610432386398315"]
        ],
        type: "tabular"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "A powerful feature extraction model for natural language processing tasks.",
      id: "thenlper/gte-large"
    },
    {
      description: "A strong feature extraction model for retrieval.",
      id: "Alibaba-NLP/gte-Qwen1.5-7B-instruct"
    }
  ],
  spaces: [
    {
      description: "A leaderboard to rank text feature extraction models based on a benchmark.",
      id: "mteb/leaderboard"
    },
    {
      description: "A leaderboard to rank best feature extraction models based on human feedback.",
      id: "mteb/arena"
    }
  ],
  summary: "Feature extraction is the task of extracting features learnt in a model.",
  widgetModels: ["facebook/bart-base"]
};
var data_default5 = taskData5;

// src/tasks/fill-mask/data.ts
var taskData6 = {
  datasets: [
    {
      description: "A common dataset that is used to train models for many languages.",
      id: "wikipedia"
    },
    {
      description: "A large English dataset with text crawled from the web.",
      id: "c4"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "The <mask> barked at me",
        type: "text"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "wolf",
            score: 0.487
          },
          {
            label: "dog",
            score: 0.061
          },
          {
            label: "cat",
            score: 0.058
          },
          {
            label: "fox",
            score: 0.047
          },
          {
            label: "squirrel",
            score: 0.025
          }
        ]
      }
    ]
  },
  metrics: [
    {
      description: "Cross Entropy is a metric that calculates the difference between two probability distributions. Each probability distribution is the distribution of predicted words",
      id: "cross_entropy"
    },
    {
      description: "Perplexity is the exponential of the cross-entropy loss. It evaluates the probabilities assigned to the next word by the model. Lower perplexity indicates better performance",
      id: "perplexity"
    }
  ],
  models: [
    {
      description: "The famous BERT model.",
      id: "google-bert/bert-base-uncased"
    },
    {
      description: "A multilingual model trained on 100 languages.",
      id: "FacebookAI/xlm-roberta-base"
    }
  ],
  spaces: [],
  summary: "Masked language modeling is the task of masking some of the words in a sentence and predicting which words should replace those masks. These models are useful when we want to get a statistical understanding of the language in which the model is trained in.",
  widgetModels: ["distilroberta-base"],
  youtubeId: "mqElG5QJWUg"
};
var data_default6 = taskData6;

// src/tasks/image-classification/data.ts
var taskData7 = {
  datasets: [
    {
      // TODO write proper description
      description: "Benchmark dataset used for image classification with images that belong to 100 classes.",
      id: "cifar100"
    },
    {
      // TODO write proper description
      description: "Dataset consisting of images of garments.",
      id: "fashion_mnist"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "image-classification-input.jpeg",
        type: "img"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "Egyptian cat",
            score: 0.514
          },
          {
            label: "Tabby cat",
            score: 0.193
          },
          {
            label: "Tiger cat",
            score: 0.068
          }
        ]
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "",
      id: "recall"
    },
    {
      description: "",
      id: "precision"
    },
    {
      description: "",
      id: "f1"
    }
  ],
  models: [
    {
      description: "A strong image classification model.",
      id: "google/vit-base-patch16-224"
    },
    {
      description: "A robust image classification model.",
      id: "facebook/deit-base-distilled-patch16-224"
    },
    {
      description: "A strong image classification model.",
      id: "facebook/convnext-large-224"
    }
  ],
  spaces: [
    {
      // TO DO: write description
      description: "An application that classifies what a given image is about.",
      id: "nielsr/perceiver-image-classification"
    }
  ],
  summary: "Image classification is the task of assigning a label or class to an entire image. Images are expected to have only one class for each image. Image classification models take an image as input and return a prediction about which class the image belongs to.",
  widgetModels: ["google/vit-base-patch16-224"],
  youtubeId: "tjAIM7BOYhw"
};
var data_default7 = taskData7;

// src/tasks/image-feature-extraction/data.ts
var taskData8 = {
  datasets: [
    {
      description: "ImageNet-1K is a image classification dataset in which images are used to train image-feature-extraction models.",
      id: "imagenet-1k"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "mask-generation-input.png",
        type: "img"
      }
    ],
    outputs: [
      {
        table: [
          ["Dimension 1", "Dimension 2", "Dimension 3"],
          ["0.21236686408519745", "1.0919708013534546", "0.8512550592422485"],
          ["0.809657871723175", "-0.18544459342956543", "-0.7851548194885254"],
          ["1.3103108406066895", "-0.2479034662246704", "-0.9107287526130676"],
          ["1.8536205291748047", "-0.36419737339019775", "0.09717650711536407"]
        ],
        type: "tabular"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "A powerful image feature extraction model.",
      id: "timm/vit_large_patch14_dinov2.lvd142m"
    },
    {
      description: "A strong image feature extraction model.",
      id: "nvidia/MambaVision-T-1K"
    },
    {
      description: "A robust image feature extraction model.",
      id: "facebook/dino-vitb16"
    },
    {
      description: "Strong image feature extraction model made for information retrieval from documents.",
      id: "vidore/colpali"
    },
    {
      description: "Strong image feature extraction model that can be used on images and documents.",
      id: "OpenGVLab/InternViT-6B-448px-V1-2"
    }
  ],
  spaces: [],
  summary: "Image feature extraction is the task of extracting features learnt in a computer vision model.",
  widgetModels: []
};
var data_default8 = taskData8;

// src/tasks/image-to-image/data.ts
var taskData9 = {
  datasets: [
    {
      description: "Synthetic dataset, for image relighting",
      id: "VIDIT"
    },
    {
      description: "Multiple images of celebrities, used for facial expression translation",
      id: "huggan/CelebA-faces"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "image-to-image-input.jpeg",
        type: "img"
      }
    ],
    outputs: [
      {
        filename: "image-to-image-output.png",
        type: "img"
      }
    ]
  },
  isPlaceholder: false,
  metrics: [
    {
      description: "Peak Signal to Noise Ratio (PSNR) is an approximation of the human perception, considering the ratio of the absolute intensity with respect to the variations. Measured in dB, a high value indicates a high fidelity.",
      id: "PSNR"
    },
    {
      description: "Structural Similarity Index (SSIM) is a perceptual metric which compares the luminance, contrast and structure of two images. The values of SSIM range between -1 and 1, and higher values indicate closer resemblance to the original image.",
      id: "SSIM"
    },
    {
      description: "Inception Score (IS) is an analysis of the labels predicted by an image classification model when presented with a sample of the generated images.",
      id: "IS"
    }
  ],
  models: [
    {
      description: "An image-to-image model to improve image resolution.",
      id: "fal/AuraSR-v2"
    },
    {
      description: "A model that increases the resolution of an image.",
      id: "keras-io/super-resolution"
    },
    {
      description: "A model that creates a set of variations of the input image in the style of DALL-E using Stable Diffusion.",
      id: "lambdalabs/sd-image-variations-diffusers"
    },
    {
      description: "A model that generates images based on segments in the input image and the text prompt.",
      id: "mfidabel/controlnet-segment-anything"
    },
    {
      description: "A model that takes an image and an instruction to edit the image.",
      id: "timbrooks/instruct-pix2pix"
    }
  ],
  spaces: [
    {
      description: "Image enhancer application for low light.",
      id: "keras-io/low-light-image-enhancement"
    },
    {
      description: "Style transfer application.",
      id: "keras-io/neural-style-transfer"
    },
    {
      description: "An application that generates images based on segment control.",
      id: "mfidabel/controlnet-segment-anything"
    },
    {
      description: "Image generation application that takes image control and text prompt.",
      id: "hysts/ControlNet"
    },
    {
      description: "Colorize any image using this app.",
      id: "ioclab/brightness-controlnet"
    },
    {
      description: "Edit images with instructions.",
      id: "timbrooks/instruct-pix2pix"
    }
  ],
  summary: "Image-to-image is the task of transforming an input image through a variety of possible manipulations and enhancements, such as super-resolution, image inpainting, colorization, and more.",
  widgetModels: ["stabilityai/stable-diffusion-2-inpainting"],
  youtubeId: ""
};
var data_default9 = taskData9;

// src/tasks/image-to-text/data.ts
var taskData10 = {
  datasets: [
    {
      // TODO write proper description
      description: "Dataset from 12M image-text of Reddit",
      id: "red_caps"
    },
    {
      // TODO write proper description
      description: "Dataset from 3.3M images of Google",
      id: "datasets/conceptual_captions"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "savanna.jpg",
        type: "img"
      }
    ],
    outputs: [
      {
        label: "Detailed description",
        content: "a herd of giraffes and zebras grazing in a field",
        type: "text"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "A robust image captioning model.",
      id: "Salesforce/blip2-opt-2.7b"
    },
    {
      description: "A powerful and accurate image-to-text model that can also localize concepts in images.",
      id: "microsoft/kosmos-2-patch14-224"
    },
    {
      description: "A strong optical character recognition model.",
      id: "facebook/nougat-base"
    },
    {
      description: "A powerful model that lets you have a conversation with the image.",
      id: "llava-hf/llava-1.5-7b-hf"
    }
  ],
  spaces: [
    {
      description: "An application that compares various image captioning models.",
      id: "nielsr/comparing-captioning-models"
    },
    {
      description: "A robust image captioning application.",
      id: "flax-community/image-captioning"
    },
    {
      description: "An application that transcribes handwritings into text.",
      id: "nielsr/TrOCR-handwritten"
    },
    {
      description: "An application that can caption images and answer questions about a given image.",
      id: "Salesforce/BLIP"
    },
    {
      description: "An application that can caption images and answer questions with a conversational agent.",
      id: "Salesforce/BLIP2"
    },
    {
      description: "An image captioning application that demonstrates the effect of noise on captions.",
      id: "johko/capdec-image-captioning"
    }
  ],
  summary: "Image to text models output a text from a given image. Image captioning or optical character recognition can be considered as the most common applications of image to text.",
  widgetModels: ["Salesforce/blip-image-captioning-large"],
  youtubeId: ""
};
var data_default10 = taskData10;

// src/tasks/image-text-to-text/data.ts
var taskData11 = {
  datasets: [
    {
      description: "Instructions composed of image and text.",
      id: "liuhaotian/LLaVA-Instruct-150K"
    },
    {
      description: "Conversation turns where questions involve image and text.",
      id: "liuhaotian/LLaVA-Pretrain"
    },
    {
      description: "A collection of datasets made for model fine-tuning.",
      id: "HuggingFaceM4/the_cauldron"
    },
    {
      description: "Screenshots of websites with their HTML/CSS codes.",
      id: "HuggingFaceM4/WebSight"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "image-text-to-text-input.png",
        type: "img"
      },
      {
        label: "Text Prompt",
        content: "Describe the position of the bee in detail.",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Answer",
        content: "The bee is sitting on a pink flower, surrounded by other flowers. The bee is positioned in the center of the flower, with its head and front legs sticking out.",
        type: "text"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "Powerful vision language model with great visual understanding and reasoning capabilities.",
      id: "meta-llama/Llama-3.2-11B-Vision-Instruct"
    },
    {
      description: "Cutting-edge vision language models.",
      id: "allenai/Molmo-7B-D-0924"
    },
    {
      description: "Small yet powerful model.",
      id: "vikhyatk/moondream2"
    },
    {
      description: "Strong image-text-to-text model.",
      id: "Qwen/Qwen2-VL-7B-Instruct"
    },
    {
      description: "Strong image-text-to-text model.",
      id: "mistralai/Pixtral-12B-2409"
    },
    {
      description: "Strong image-text-to-text model focused on documents.",
      id: "stepfun-ai/GOT-OCR2_0"
    }
  ],
  spaces: [
    {
      description: "Leaderboard to evaluate vision language models.",
      id: "opencompass/open_vlm_leaderboard"
    },
    {
      description: "Vision language models arena, where models are ranked by votes of users.",
      id: "WildVision/vision-arena"
    },
    {
      description: "Powerful vision-language model assistant.",
      id: "akhaliq/Molmo-7B-D-0924"
    },
    {
      description: "An image-text-to-text application focused on documents.",
      id: "stepfun-ai/GOT_official_online_demo"
    },
    {
      description: "An application to compare outputs of different vision language models.",
      id: "merve/compare_VLMs"
    },
    {
      description: "An application for chatting with an image-text-to-text model.",
      id: "GanymedeNil/Qwen2-VL-7B"
    }
  ],
  summary: "Image-text-to-text models take in an image and text prompt and output text. These models are also called vision-language models, or VLMs. The difference from image-to-text models is that these models take an additional text input, not restricting the model to certain use cases like image captioning, and may also be trained to accept a conversation as input.",
  widgetModels: ["meta-llama/Llama-3.2-11B-Vision-Instruct"],
  youtubeId: "IoGaGfU1CIg"
};
var data_default11 = taskData11;

// src/tasks/image-segmentation/data.ts
var taskData12 = {
  datasets: [
    {
      description: "Scene segmentation dataset.",
      id: "scene_parse_150"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "image-segmentation-input.jpeg",
        type: "img"
      }
    ],
    outputs: [
      {
        filename: "image-segmentation-output.png",
        type: "img"
      }
    ]
  },
  metrics: [
    {
      description: "Average Precision (AP) is the Area Under the PR Curve (AUC-PR). It is calculated for each semantic class separately",
      id: "Average Precision"
    },
    {
      description: "Mean Average Precision (mAP) is the overall average of the AP values",
      id: "Mean Average Precision"
    },
    {
      description: "Intersection over Union (IoU) is the overlap of segmentation masks. Mean IoU is the average of the IoU of all semantic classes",
      id: "Mean Intersection over Union"
    },
    {
      description: "AP\u03B1 is the Average Precision at the IoU threshold of a \u03B1 value, for example, AP50 and AP75",
      id: "AP\u03B1"
    }
  ],
  models: [
    {
      // TO DO: write description
      description: "Solid semantic segmentation model trained on ADE20k.",
      id: "openmmlab/upernet-convnext-small"
    },
    {
      description: "Background removal model.",
      id: "briaai/RMBG-1.4"
    },
    {
      description: "A multipurpose image segmentation model for high resolution images.",
      id: "ZhengPeng7/BiRefNet"
    },
    {
      description: "Powerful human-centric image segmentation model.",
      id: "facebook/sapiens-seg-1b"
    },
    {
      description: "Panoptic segmentation model trained on the COCO (common objects) dataset.",
      id: "facebook/mask2former-swin-large-coco-panoptic"
    }
  ],
  spaces: [
    {
      description: "A semantic segmentation application that can predict unseen instances out of the box.",
      id: "facebook/ov-seg"
    },
    {
      description: "One of the strongest segmentation applications.",
      id: "jbrinkma/segment-anything"
    },
    {
      description: "A human-centric segmentation model.",
      id: "facebook/sapiens-pose"
    },
    {
      description: "An instance segmentation application to predict neuronal cell types from microscopy images.",
      id: "rashmi/sartorius-cell-instance-segmentation"
    },
    {
      description: "An application that segments videos.",
      id: "ArtGAN/Segment-Anything-Video"
    },
    {
      description: "An panoptic segmentation application built for outdoor environments.",
      id: "segments/panoptic-segment-anything"
    }
  ],
  summary: "Image Segmentation divides an image into segments where each pixel in the image is mapped to an object. This task has multiple variants such as instance segmentation, panoptic segmentation and semantic segmentation.",
  widgetModels: ["nvidia/segformer-b0-finetuned-ade-512-512"],
  youtubeId: "dKE8SIt9C-w"
};
var data_default12 = taskData12;

// src/tasks/mask-generation/data.ts
var taskData13 = {
  datasets: [],
  demo: {
    inputs: [
      {
        filename: "mask-generation-input.png",
        type: "img"
      }
    ],
    outputs: [
      {
        filename: "mask-generation-output.png",
        type: "img"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "Small yet powerful mask generation model.",
      id: "Zigeng/SlimSAM-uniform-50"
    },
    {
      description: "Very strong mask generation model.",
      id: "facebook/sam2-hiera-large"
    }
  ],
  spaces: [
    {
      description: "An application that combines a mask generation model with a zero-shot object detection model for text-guided image segmentation.",
      id: "merve/OWLSAM2"
    },
    {
      description: "An application that compares the performance of a large and a small mask generation model.",
      id: "merve/slimsam"
    },
    {
      description: "An application based on an improved mask generation model.",
      id: "SkalskiP/segment-anything-model-2"
    },
    {
      description: "An application to remove objects from videos using mask generation models.",
      id: "SkalskiP/SAM_and_ProPainter"
    }
  ],
  summary: "Mask generation is the task of generating masks that identify a specific object or region of interest in a given image. Masks are often used in segmentation tasks, where they provide a precise way to isolate the object of interest for further processing or analysis.",
  widgetModels: [],
  youtubeId: ""
};
var data_default13 = taskData13;

// src/tasks/object-detection/data.ts
var taskData14 = {
  datasets: [
    {
      description: "Widely used benchmark dataset for multiple vision tasks.",
      id: "merve/coco2017"
    },
    {
      description: "Multi-task computer vision benchmark.",
      id: "merve/pascal-voc"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "object-detection-input.jpg",
        type: "img"
      }
    ],
    outputs: [
      {
        filename: "object-detection-output.jpg",
        type: "img"
      }
    ]
  },
  metrics: [
    {
      description: "The Average Precision (AP) metric is the Area Under the PR Curve (AUC-PR). It is calculated for each class separately",
      id: "Average Precision"
    },
    {
      description: "The Mean Average Precision (mAP) metric is the overall average of the AP values",
      id: "Mean Average Precision"
    },
    {
      description: "The AP\u03B1 metric is the Average Precision at the IoU threshold of a \u03B1 value, for example, AP50 and AP75",
      id: "AP\u03B1"
    }
  ],
  models: [
    {
      description: "Solid object detection model pre-trained on the COCO 2017 dataset.",
      id: "facebook/detr-resnet-50"
    },
    {
      description: "Real-time and accurate object detection model.",
      id: "jameslahm/yolov10x"
    },
    {
      description: "Fast and accurate object detection model trained on COCO and Object365 datasets.",
      id: "PekingU/rtdetr_r18vd_coco_o365"
    }
  ],
  spaces: [
    {
      description: "Leaderboard to compare various object detection models across several metrics.",
      id: "hf-vision/object_detection_leaderboard"
    },
    {
      description: "An application that contains various object detection models to try from.",
      id: "Gradio-Blocks/Object-Detection-With-DETR-and-YOLOS"
    },
    {
      description: "An application that shows multiple cutting edge techniques for object detection and tracking.",
      id: "kadirnar/torchyolo"
    },
    {
      description: "An object tracking, segmentation and inpainting application.",
      id: "VIPLab/Track-Anything"
    },
    {
      description: "Very fast object tracking application based on object detection.",
      id: "merve/RT-DETR-tracking-coco"
    }
  ],
  summary: "Object Detection models allow users to identify objects of certain defined classes. Object detection models receive an image as input and output the images with bounding boxes and labels on detected objects.",
  widgetModels: ["facebook/detr-resnet-50"],
  youtubeId: "WdAeKSOpxhw"
};
var data_default14 = taskData14;

// src/tasks/depth-estimation/data.ts
var taskData15 = {
  datasets: [
    {
      description: "NYU Depth V2 Dataset: Video dataset containing both RGB and depth sensor data.",
      id: "sayakpaul/nyu_depth_v2"
    },
    {
      description: "Monocular depth estimation benchmark based without noise and errors.",
      id: "depth-anything/DA-2K"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "depth-estimation-input.jpg",
        type: "img"
      }
    ],
    outputs: [
      {
        filename: "depth-estimation-output.png",
        type: "img"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "Cutting-edge depth estimation model.",
      id: "depth-anything/Depth-Anything-V2-Large"
    },
    {
      description: "A strong monocular depth estimation model.",
      id: "jingheya/lotus-depth-g-v1-0"
    },
    {
      description: "A depth estimation model that predicts depth in videos.",
      id: "tencent/DepthCrafter"
    },
    {
      description: "A robust depth estimation model.",
      id: "apple/DepthPro"
    }
  ],
  spaces: [
    {
      description: "An application that predicts the depth of an image and then reconstruct the 3D model as voxels.",
      id: "radames/dpt-depth-estimation-3d-voxels"
    },
    {
      description: "An application for bleeding-edge depth estimation.",
      id: "akhaliq/depth-pro"
    },
    {
      description: "An application on cutting-edge depth estimation in videos.",
      id: "tencent/DepthCrafter"
    },
    {
      description: "A human-centric depth estimation application.",
      id: "facebook/sapiens-depth"
    }
  ],
  summary: "Depth estimation is the task of predicting depth of the objects present in an image.",
  widgetModels: [""],
  youtubeId: ""
};
var data_default15 = taskData15;

// src/tasks/placeholder/data.ts
var taskData16 = {
  datasets: [],
  demo: {
    inputs: [],
    outputs: []
  },
  isPlaceholder: true,
  metrics: [],
  models: [],
  spaces: [],
  summary: "",
  widgetModels: [],
  youtubeId: void 0,
  /// If this is a subtask, link to the most general task ID
  /// (eg, text2text-generation is the canonical ID of translation)
  canonicalId: void 0
};
var data_default16 = taskData16;

// src/tasks/reinforcement-learning/data.ts
var taskData17 = {
  datasets: [
    {
      description: "A curation of widely used datasets for Data Driven Deep Reinforcement Learning (D4RL)",
      id: "edbeeching/decision_transformer_gym_replay"
    }
  ],
  demo: {
    inputs: [
      {
        label: "State",
        content: "Red traffic light, pedestrians are about to pass.",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Action",
        content: "Stop the car.",
        type: "text"
      },
      {
        label: "Next State",
        content: "Yellow light, pedestrians have crossed.",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "Accumulated reward across all time steps discounted by a factor that ranges between 0 and 1 and determines how much the agent optimizes for future relative to immediate rewards. Measures how good is the policy ultimately found by a given algorithm considering uncertainty over the future.",
      id: "Discounted Total Reward"
    },
    {
      description: "Average return obtained after running the policy for a certain number of evaluation episodes. As opposed to total reward, mean reward considers how much reward a given algorithm receives while learning.",
      id: "Mean Reward"
    },
    {
      description: "Measures how good a given algorithm is after a predefined time. Some algorithms may be guaranteed to converge to optimal behavior across many time steps. However, an agent that reaches an acceptable level of optimality after a given time horizon may be preferable to one that ultimately reaches optimality but takes a long time.",
      id: "Level of Performance After Some Time"
    }
  ],
  models: [
    {
      description: "A Reinforcement Learning model trained on expert data from the Gym Hopper environment",
      id: "edbeeching/decision-transformer-gym-hopper-expert"
    },
    {
      description: "A PPO agent playing seals/CartPole-v0 using the stable-baselines3 library and the RL Zoo.",
      id: "HumanCompatibleAI/ppo-seals-CartPole-v0"
    }
  ],
  spaces: [
    {
      description: "An application for a cute puppy agent learning to catch a stick.",
      id: "ThomasSimonini/Huggy"
    },
    {
      description: "An application to play Snowball Fight with a reinforcement learning agent.",
      id: "ThomasSimonini/SnowballFight"
    }
  ],
  summary: "Reinforcement learning is the computational approach of learning from action by interacting with an environment through trial and error and receiving rewards (negative or positive) as feedback",
  widgetModels: [],
  youtubeId: "q0BiUn5LiBc"
};
var data_default17 = taskData17;

// src/tasks/question-answering/data.ts
var taskData18 = {
  datasets: [
    {
      // TODO write proper description
      description: "A famous question answering dataset based on English articles from Wikipedia.",
      id: "squad_v2"
    },
    {
      // TODO write proper description
      description: "A dataset of aggregated anonymized actual queries issued to the Google search engine.",
      id: "natural_questions"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Question",
        content: "Which name is also used to describe the Amazon rainforest in English?",
        type: "text"
      },
      {
        label: "Context",
        content: "The Amazon rainforest, also known in English as Amazonia or the Amazon Jungle",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Answer",
        content: "Amazonia",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "Exact Match is a metric based on the strict character match of the predicted answer and the right answer. For answers predicted correctly, the Exact Match will be 1. Even if only one character is different, Exact Match will be 0",
      id: "exact-match"
    },
    {
      description: " The F1-Score metric is useful if we value both false positives and false negatives equally. The F1-Score is calculated on each word in the predicted sequence against the correct answer",
      id: "f1"
    }
  ],
  models: [
    {
      description: "A robust baseline model for most question answering domains.",
      id: "deepset/roberta-base-squad2"
    },
    {
      description: "Small yet robust model that can answer questions.",
      id: "distilbert/distilbert-base-cased-distilled-squad"
    },
    {
      description: "A special model that can answer questions from tables.",
      id: "google/tapas-base-finetuned-wtq"
    }
  ],
  spaces: [
    {
      description: "An application that can answer a long question from Wikipedia.",
      id: "deepset/wikipedia-assistant"
    }
  ],
  summary: "Question Answering models can retrieve the answer to a question from a given text, which is useful for searching for an answer in a document. Some question answering models can generate answers without context!",
  widgetModels: ["deepset/roberta-base-squad2"],
  youtubeId: "ajPx5LwJD-I"
};
var data_default18 = taskData18;

// src/tasks/sentence-similarity/data.ts
var taskData19 = {
  datasets: [
    {
      description: "Bing queries with relevant passages from various web sources.",
      id: "ms_marco"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Source sentence",
        content: "Machine learning is so easy.",
        type: "text"
      },
      {
        label: "Sentences to compare to",
        content: "Deep learning is so straightforward.",
        type: "text"
      },
      {
        label: "",
        content: "This is so difficult, like rocket science.",
        type: "text"
      },
      {
        label: "",
        content: "I can't believe how much I struggled with this.",
        type: "text"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "Deep learning is so straightforward.",
            score: 0.623
          },
          {
            label: "This is so difficult, like rocket science.",
            score: 0.413
          },
          {
            label: "I can't believe how much I struggled with this.",
            score: 0.256
          }
        ]
      }
    ]
  },
  metrics: [
    {
      description: "Reciprocal Rank is a measure used to rank the relevancy of documents given a set of documents. Reciprocal Rank is the reciprocal of the rank of the document retrieved, meaning, if the rank is 3, the Reciprocal Rank is 0.33. If the rank is 1, the Reciprocal Rank is 1",
      id: "Mean Reciprocal Rank"
    },
    {
      description: "The similarity of the embeddings is evaluated mainly on cosine similarity. It is calculated as the cosine of the angle between two vectors. It is particularly useful when your texts are not the same length",
      id: "Cosine Similarity"
    }
  ],
  models: [
    {
      description: "This model works well for sentences and paragraphs and can be used for clustering/grouping and semantic searches.",
      id: "sentence-transformers/all-mpnet-base-v2"
    },
    {
      description: "A multilingual robust sentence similarity model..",
      id: "BAAI/bge-m3"
    }
  ],
  spaces: [
    {
      description: "An application that leverages sentence similarity to answer questions from YouTube videos.",
      id: "Gradio-Blocks/Ask_Questions_To_YouTube_Videos"
    },
    {
      description: "An application that retrieves relevant PubMed abstracts for a given online article which can be used as further references.",
      id: "Gradio-Blocks/pubmed-abstract-retriever"
    },
    {
      description: "An application that leverages sentence similarity to summarize text.",
      id: "nickmuchi/article-text-summarizer"
    },
    {
      description: "A guide that explains how Sentence Transformers can be used for semantic search.",
      id: "sentence-transformers/Sentence_Transformers_for_semantic_search"
    }
  ],
  summary: "Sentence Similarity is the task of determining how similar two texts are. Sentence similarity models convert input texts into vectors (embeddings) that capture semantic information and calculate how close (similar) they are between them. This task is particularly useful for information retrieval and clustering/grouping.",
  widgetModels: ["BAAI/bge-small-en-v1.5"],
  youtubeId: "VCZq5AkbNEU"
};
var data_default19 = taskData19;

// src/tasks/summarization/data.ts
var taskData20 = {
  canonicalId: "text2text-generation",
  datasets: [
    {
      description: "News articles in five different languages along with their summaries. Widely used for benchmarking multilingual summarization models.",
      id: "mlsum"
    },
    {
      description: "English conversations and their summaries. Useful for benchmarking conversational agents.",
      id: "samsum"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. It was the first structure to reach a height of 300 metres. Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct.",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Output",
        content: "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building. It was the first structure to reach a height of 300 metres.",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "The generated sequence is compared against its summary, and the overlap of tokens are counted. ROUGE-N refers to overlap of N subsequent tokens, ROUGE-1 refers to overlap of single tokens and ROUGE-2 is the overlap of two subsequent tokens.",
      id: "rouge"
    }
  ],
  models: [
    {
      description: "A strong summarization model trained on English news articles. Excels at generating factual summaries.",
      id: "facebook/bart-large-cnn"
    },
    {
      description: "A summarization model trained on medical articles.",
      id: "Falconsai/medical_summarization"
    }
  ],
  spaces: [
    {
      description: "An application that can summarize long paragraphs.",
      id: "pszemraj/summarize-long-text"
    },
    {
      description: "A much needed summarization application for terms and conditions.",
      id: "ml6team/distilbart-tos-summarizer-tosdr"
    },
    {
      description: "An application that summarizes long documents.",
      id: "pszemraj/document-summarization"
    },
    {
      description: "An application that can detect errors in abstractive summarization.",
      id: "ml6team/post-processing-summarization"
    }
  ],
  summary: "Summarization is the task of producing a shorter version of a document while preserving its important information. Some models can extract text from the original input, while other models can generate entirely new text.",
  widgetModels: ["facebook/bart-large-cnn"],
  youtubeId: "yHnr5Dk2zCI"
};
var data_default20 = taskData20;

// src/tasks/table-question-answering/data.ts
var taskData21 = {
  datasets: [
    {
      description: "The WikiTableQuestions dataset is a large-scale dataset for the task of question answering on semi-structured tables.",
      id: "wikitablequestions"
    },
    {
      description: "WikiSQL is a dataset of 80654 hand-annotated examples of questions and SQL queries distributed across 24241 tables from Wikipedia.",
      id: "wikisql"
    }
  ],
  demo: {
    inputs: [
      {
        table: [
          ["Rank", "Name", "No.of reigns", "Combined days"],
          ["1", "lou Thesz", "3", "3749"],
          ["2", "Ric Flair", "8", "3103"],
          ["3", "Harley Race", "7", "1799"]
        ],
        type: "tabular"
      },
      { label: "Question", content: "What is the number of reigns for Harley Race?", type: "text" }
    ],
    outputs: [{ label: "Result", content: "7", type: "text" }]
  },
  metrics: [
    {
      description: "Checks whether the predicted answer(s) is the same as the ground-truth answer(s).",
      id: "Denotation Accuracy"
    }
  ],
  models: [
    {
      description: "A table question answering model that is capable of neural SQL execution, i.e., employ TAPEX to execute a SQL query on a given table.",
      id: "microsoft/tapex-base"
    },
    {
      description: "A robust table question answering model.",
      id: "google/tapas-base-finetuned-wtq"
    }
  ],
  spaces: [
    {
      description: "An application that answers questions based on table CSV files.",
      id: "katanaml/table-query"
    }
  ],
  summary: "Table Question Answering (Table QA) is the answering a question about an information on a given table.",
  widgetModels: ["google/tapas-base-finetuned-wtq"]
};
var data_default21 = taskData21;

// src/tasks/tabular-classification/data.ts
var taskData22 = {
  datasets: [
    {
      description: "A comprehensive curation of datasets covering all benchmarks.",
      id: "inria-soda/tabular-benchmark"
    }
  ],
  demo: {
    inputs: [
      {
        table: [
          ["Glucose", "Blood Pressure ", "Skin Thickness", "Insulin", "BMI"],
          ["148", "72", "35", "0", "33.6"],
          ["150", "50", "30", "0", "35.1"],
          ["141", "60", "29", "1", "39.2"]
        ],
        type: "tabular"
      }
    ],
    outputs: [
      {
        table: [["Diabetes"], ["1"], ["1"], ["0"]],
        type: "tabular"
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "",
      id: "recall"
    },
    {
      description: "",
      id: "precision"
    },
    {
      description: "",
      id: "f1"
    }
  ],
  models: [
    {
      description: "Breast cancer prediction model based on decision trees.",
      id: "scikit-learn/cancer-prediction-trees"
    }
  ],
  spaces: [
    {
      description: "An application that can predict defective products on a production line.",
      id: "scikit-learn/tabular-playground"
    },
    {
      description: "An application that compares various tabular classification techniques on different datasets.",
      id: "scikit-learn/classification"
    }
  ],
  summary: "Tabular classification is the task of classifying a target category (a group) based on set of attributes.",
  widgetModels: ["scikit-learn/tabular-playground"],
  youtubeId: ""
};
var data_default22 = taskData22;

// src/tasks/tabular-regression/data.ts
var taskData23 = {
  datasets: [
    {
      description: "A comprehensive curation of datasets covering all benchmarks.",
      id: "inria-soda/tabular-benchmark"
    }
  ],
  demo: {
    inputs: [
      {
        table: [
          ["Car Name", "Horsepower", "Weight"],
          ["ford torino", "140", "3,449"],
          ["amc hornet", "97", "2,774"],
          ["toyota corolla", "65", "1,773"]
        ],
        type: "tabular"
      }
    ],
    outputs: [
      {
        table: [["MPG (miles per gallon)"], ["17"], ["18"], ["31"]],
        type: "tabular"
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "mse"
    },
    {
      description: "Coefficient of determination (or R-squared) is a measure of how well the model fits the data. Higher R-squared is considered a better fit.",
      id: "r-squared"
    }
  ],
  models: [
    {
      description: "Fish weight prediction based on length measurements and species.",
      id: "scikit-learn/Fish-Weight"
    }
  ],
  spaces: [
    {
      description: "An application that can predict weight of a fish based on set of attributes.",
      id: "scikit-learn/fish-weight-prediction"
    }
  ],
  summary: "Tabular regression is the task of predicting a numerical value given a set of attributes.",
  widgetModels: ["scikit-learn/Fish-Weight"],
  youtubeId: ""
};
var data_default23 = taskData23;

// src/tasks/text-to-image/data.ts
var taskData24 = {
  datasets: [
    {
      description: "RedCaps is a large-scale dataset of 12M image-text pairs collected from Reddit.",
      id: "red_caps"
    },
    {
      description: "Conceptual Captions is a dataset consisting of ~3.3M images annotated with captions.",
      id: "conceptual_captions"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "A city above clouds, pastel colors, Victorian style",
        type: "text"
      }
    ],
    outputs: [
      {
        filename: "image.jpeg",
        type: "img"
      }
    ]
  },
  metrics: [
    {
      description: "The Inception Score (IS) measure assesses diversity and meaningfulness. It uses a generated image sample to predict its label. A higher score signifies more diverse and meaningful images.",
      id: "IS"
    },
    {
      description: "The Fr\xE9chet Inception Distance (FID) calculates the distance between distributions between synthetic and real samples. A lower FID score indicates better similarity between the distributions of real and generated images.",
      id: "FID"
    },
    {
      description: "R-precision assesses how the generated image aligns with the provided text description. It uses the generated images as queries to retrieve relevant text descriptions. The top 'r' relevant descriptions are selected and used to calculate R-precision as r/R, where 'R' is the number of ground truth descriptions associated with the generated images. A higher R-precision value indicates a better model.",
      id: "R-Precision"
    }
  ],
  models: [
    {
      description: "One of the most powerful image generation models that can generate realistic outputs.",
      id: "black-forest-labs/FLUX.1-dev"
    },
    {
      description: "A powerful yet fast image generation model.",
      id: "latent-consistency/lcm-lora-sdxl"
    },
    {
      description: "Text-to-image model for photorealistic generation.",
      id: "Kwai-Kolors/Kolors"
    },
    {
      description: "A powerful text-to-image model.",
      id: "stabilityai/stable-diffusion-3-medium-diffusers"
    }
  ],
  spaces: [
    {
      description: "A powerful text-to-image application.",
      id: "stabilityai/stable-diffusion-3-medium"
    },
    {
      description: "A text-to-image application to generate comics.",
      id: "jbilcke-hf/ai-comic-factory"
    },
    {
      description: "An application to match multiple custom image generation models.",
      id: "multimodalart/flux-lora-lab"
    },
    {
      description: "A powerful yet very fast image generation application.",
      id: "latent-consistency/lcm-lora-for-sdxl"
    },
    {
      description: "A gallery to explore various text-to-image models.",
      id: "multimodalart/LoraTheExplorer"
    },
    {
      description: "An application for `text-to-image`, `image-to-image` and image inpainting.",
      id: "ArtGAN/Stable-Diffusion-ControlNet-WebUI"
    },
    {
      description: "An application to generate realistic images given photos of a person and a prompt.",
      id: "InstantX/InstantID"
    }
  ],
  summary: "Text-to-image is the task of generating images from input text. These pipelines can also be used to modify and edit images based on text prompts.",
  widgetModels: ["black-forest-labs/FLUX.1-dev"],
  youtubeId: ""
};
var data_default24 = taskData24;

// src/tasks/text-to-speech/data.ts
var taskData25 = {
  canonicalId: "text-to-audio",
  datasets: [
    {
      description: "10K hours of multi-speaker English dataset.",
      id: "parler-tts/mls_eng_10k"
    },
    {
      description: "Multi-speaker English dataset.",
      id: "mythicinfinity/libritts_r"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "I love audio models on the Hub!",
        type: "text"
      }
    ],
    outputs: [
      {
        filename: "audio.wav",
        type: "audio"
      }
    ]
  },
  metrics: [
    {
      description: "The Mel Cepstral Distortion (MCD) metric is used to calculate the quality of generated speech.",
      id: "mel cepstral distortion"
    }
  ],
  models: [
    {
      description: "A powerful TTS model.",
      id: "parler-tts/parler-tts-large-v1"
    },
    {
      description: "A massively multi-lingual TTS model.",
      id: "coqui/XTTS-v2"
    },
    {
      description: "Robust TTS model.",
      id: "metavoiceio/metavoice-1B-v0.1"
    },
    {
      description: "A prompt based, powerful TTS model.",
      id: "parler-tts/parler_tts_mini_v0.1"
    }
  ],
  spaces: [
    {
      description: "An application for generate highly realistic, multilingual speech.",
      id: "suno/bark"
    },
    {
      description: "An application on XTTS, a voice generation model that lets you clone voices into different languages.",
      id: "coqui/xtts"
    },
    {
      description: "An application that generates speech in different styles in English and Chinese.",
      id: "mrfakename/E2-F5-TTS"
    },
    {
      description: "An application that synthesizes speech for diverse speaker prompts.",
      id: "parler-tts/parler_tts_mini"
    }
  ],
  summary: "Text-to-Speech (TTS) is the task of generating natural sounding speech given text input. TTS models can be extended to have a single model that generates speech for multiple speakers and multiple languages.",
  widgetModels: ["suno/bark"],
  youtubeId: "NW62DpzJ274"
};
var data_default25 = taskData25;

// src/tasks/token-classification/data.ts
var taskData26 = {
  datasets: [
    {
      description: "A widely used dataset useful to benchmark named entity recognition models.",
      id: "eriktks/conll2003"
    },
    {
      description: "A multilingual dataset of Wikipedia articles annotated for named entity recognition in over 150 different languages.",
      id: "unimelb-nlp/wikiann"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "My name is Omar and I live in Z\xFCrich.",
        type: "text"
      }
    ],
    outputs: [
      {
        text: "My name is Omar and I live in Z\xFCrich.",
        tokens: [
          {
            type: "PERSON",
            start: 11,
            end: 15
          },
          {
            type: "GPE",
            start: 30,
            end: 36
          }
        ],
        type: "text-with-tokens"
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "",
      id: "recall"
    },
    {
      description: "",
      id: "precision"
    },
    {
      description: "",
      id: "f1"
    }
  ],
  models: [
    {
      description: "A robust performance model to identify people, locations, organizations and names of miscellaneous entities.",
      id: "dslim/bert-base-NER"
    },
    {
      description: "A strong model to identify people, locations, organizations and names in multiple languages.",
      id: "FacebookAI/xlm-roberta-large-finetuned-conll03-english"
    },
    {
      description: "A token classification model specialized on medical entity recognition.",
      id: "blaze999/Medical-NER"
    },
    {
      description: "Flair models are typically the state of the art in named entity recognition tasks.",
      id: "flair/ner-english"
    }
  ],
  spaces: [
    {
      description: "An application that can recognizes entities, extracts noun chunks and recognizes various linguistic features of each token.",
      id: "spacy/gradio_pipeline_visualizer"
    }
  ],
  summary: "Token classification is a natural language understanding task in which a label is assigned to some tokens in a text. Some popular token classification subtasks are Named Entity Recognition (NER) and Part-of-Speech (PoS) tagging. NER models could be trained to identify specific entities in a text, such as dates, individuals and places; and PoS tagging would identify, for example, which words in a text are verbs, nouns, and punctuation marks.",
  widgetModels: ["FacebookAI/xlm-roberta-large-finetuned-conll03-english"],
  youtubeId: "wVHdVlPScxA"
};
var data_default26 = taskData26;

// src/tasks/translation/data.ts
var taskData27 = {
  canonicalId: "text2text-generation",
  datasets: [
    {
      description: "A dataset of copyright-free books translated into 16 different languages.",
      id: "Helsinki-NLP/opus_books"
    },
    {
      description: "An example of translation between programming languages. This dataset consists of functions in Java and C#.",
      id: "google/code_x_glue_cc_code_to_code_trans"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "My name is Omar and I live in Z\xFCrich.",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Output",
        content: "Mein Name ist Omar und ich wohne in Z\xFCrich.",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "BLEU score is calculated by counting the number of shared single or subsequent tokens between the generated sequence and the reference. Subsequent n tokens are called \u201Cn-grams\u201D. Unigram refers to a single token while bi-gram refers to token pairs and n-grams refer to n subsequent tokens. The score ranges from 0 to 1, where 1 means the translation perfectly matched and 0 did not match at all",
      id: "bleu"
    },
    {
      description: "",
      id: "sacrebleu"
    }
  ],
  models: [
    {
      description: "Very powerful model that can translate many languages between each other, especially low-resource languages.",
      id: "facebook/nllb-200-1.3B"
    },
    {
      description: "A general-purpose Transformer that can be used to translate from English to German, French, or Romanian.",
      id: "google-t5/t5-base"
    }
  ],
  spaces: [
    {
      description: "An application that can translate between 100 languages.",
      id: "Iker/Translate-100-languages"
    },
    {
      description: "An application that can translate between many languages.",
      id: "Geonmo/nllb-translation-demo"
    }
  ],
  summary: "Translation is the task of converting text from one language to another.",
  widgetModels: ["facebook/mbart-large-50-many-to-many-mmt"],
  youtubeId: "1JvfrvZgi6c"
};
var data_default27 = taskData27;

// src/tasks/text-classification/data.ts
var taskData28 = {
  datasets: [
    {
      description: "A widely used dataset used to benchmark multiple variants of text classification.",
      id: "nyu-mll/glue"
    },
    {
      description: "A text classification dataset used to benchmark natural language inference models",
      id: "stanfordnlp/snli"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "I love Hugging Face!",
        type: "text"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "POSITIVE",
            score: 0.9
          },
          {
            label: "NEUTRAL",
            score: 0.1
          },
          {
            label: "NEGATIVE",
            score: 0
          }
        ]
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "",
      id: "recall"
    },
    {
      description: "",
      id: "precision"
    },
    {
      description: "The F1 metric is the harmonic mean of the precision and recall. It can be calculated as: F1 = 2 * (precision * recall) / (precision + recall)",
      id: "f1"
    }
  ],
  models: [
    {
      description: "A robust model trained for sentiment analysis.",
      id: "distilbert/distilbert-base-uncased-finetuned-sst-2-english"
    },
    {
      description: "A sentiment analysis model specialized in financial sentiment.",
      id: "ProsusAI/finbert"
    },
    {
      description: "A sentiment analysis model specialized in analyzing tweets.",
      id: "cardiffnlp/twitter-roberta-base-sentiment-latest"
    },
    {
      description: "A model that can classify languages.",
      id: "papluca/xlm-roberta-base-language-detection"
    },
    {
      description: "A model that can classify text generation attacks.",
      id: "meta-llama/Prompt-Guard-86M"
    }
  ],
  spaces: [
    {
      description: "An application that can classify financial sentiment.",
      id: "IoannisTr/Tech_Stocks_Trading_Assistant"
    },
    {
      description: "A dashboard that contains various text classification tasks.",
      id: "miesnerjacob/Multi-task-NLP"
    },
    {
      description: "An application that analyzes user reviews in healthcare.",
      id: "spacy/healthsea-demo"
    }
  ],
  summary: "Text Classification is the task of assigning a label or class to a given text. Some use cases are sentiment analysis, natural language inference, and assessing grammatical correctness.",
  widgetModels: ["distilbert/distilbert-base-uncased-finetuned-sst-2-english"],
  youtubeId: "leNG9fN9FQU"
};
var data_default28 = taskData28;

// src/tasks/text-generation/data.ts
var taskData29 = {
  datasets: [
    {
      description: "A large multilingual dataset of text crawled from the web.",
      id: "mc4"
    },
    {
      description: "Diverse open-source data consisting of 22 smaller high-quality datasets. It was used to train GPT-Neo.",
      id: "the_pile"
    },
    {
      description: "Truly open-source, curated and cleaned dialogue dataset.",
      id: "HuggingFaceH4/ultrachat_200k"
    },
    {
      description: "An instruction dataset with preference ratings on responses.",
      id: "openbmb/UltraFeedback"
    },
    {
      description: "A large synthetic dataset for alignment of text generation models.",
      id: "argilla/magpie-ultra-v0.1"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "Once upon a time,",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Output",
        content: "Once upon a time, we knew that our ancestors were on the verge of extinction. The great explorers and poets of the Old World, from Alexander the Great to Chaucer, are dead and gone. A good many of our ancient explorers and poets have",
        type: "text"
      }
    ]
  },
  metrics: [
    {
      description: "Cross Entropy is a metric that calculates the difference between two probability distributions. Each probability distribution is the distribution of predicted words",
      id: "Cross Entropy"
    },
    {
      description: "The Perplexity metric is the exponential of the cross-entropy loss. It evaluates the probabilities assigned to the next word by the model. Lower perplexity indicates better performance",
      id: "Perplexity"
    }
  ],
  models: [
    {
      description: "A text-generation model trained to follow instructions.",
      id: "google/gemma-2-2b-it"
    },
    {
      description: "Very powerful text generation model trained to follow instructions.",
      id: "meta-llama/Meta-Llama-3.1-8B-Instruct"
    },
    {
      description: "Small yet powerful text generation model.",
      id: "microsoft/Phi-3-mini-4k-instruct"
    },
    {
      description: "A very powerful model that can solve mathematical problems.",
      id: "AI-MO/NuminaMath-7B-TIR"
    },
    {
      description: "Strong text generation model to follow instructions.",
      id: "Qwen/Qwen2.5-7B-Instruct"
    },
    {
      description: "Very strong open-source large language model.",
      id: "nvidia/Llama-3.1-Nemotron-70B-Instruct"
    }
  ],
  spaces: [
    {
      description: "A leaderboard to compare different open-source text generation models based on various benchmarks.",
      id: "open-llm-leaderboard/open_llm_leaderboard"
    },
    {
      description: "A leaderboard for comparing chain-of-thought performance of models.",
      id: "logikon/open_cot_leaderboard"
    },
    {
      description: "An text generation based application based on a very powerful LLaMA2 model.",
      id: "ysharma/Explore_llamav2_with_TGI"
    },
    {
      description: "An text generation based application to converse with Zephyr model.",
      id: "HuggingFaceH4/zephyr-chat"
    },
    {
      description: "A leaderboard that ranks text generation models based on blind votes from people.",
      id: "lmsys/chatbot-arena-leaderboard"
    },
    {
      description: "An chatbot to converse with a very powerful text generation model.",
      id: "mlabonne/phixtral-chat"
    }
  ],
  summary: "Generating text is the task of generating new text given another text. These models can, for example, fill in incomplete text or paraphrase.",
  widgetModels: ["mistralai/Mistral-Nemo-Instruct-2407"],
  youtubeId: "e9gNEAlsOvU"
};
var data_default29 = taskData29;

// src/tasks/text-to-video/data.ts
var taskData30 = {
  datasets: [
    {
      description: "Microsoft Research Video to Text is a large-scale dataset for open domain video captioning",
      id: "iejMac/CLIP-MSR-VTT"
    },
    {
      description: "UCF101 Human Actions dataset consists of 13,320 video clips from YouTube, with 101 classes.",
      id: "quchenyuan/UCF101-ZIP"
    },
    {
      description: "A high-quality dataset for human action recognition in YouTube videos.",
      id: "nateraw/kinetics"
    },
    {
      description: "A dataset of video clips of humans performing pre-defined basic actions with everyday objects.",
      id: "HuggingFaceM4/something_something_v2"
    },
    {
      description: "This dataset consists of text-video pairs and contains noisy samples with irrelevant video descriptions",
      id: "HuggingFaceM4/webvid"
    },
    {
      description: "A dataset of short Flickr videos for the temporal localization of events with descriptions.",
      id: "iejMac/CLIP-DiDeMo"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Input",
        content: "Darth Vader is surfing on the waves.",
        type: "text"
      }
    ],
    outputs: [
      {
        filename: "text-to-video-output.gif",
        type: "img"
      }
    ]
  },
  metrics: [
    {
      description: "Inception Score uses an image classification model that predicts class labels and evaluates how distinct and diverse the images are. A higher score indicates better video generation.",
      id: "is"
    },
    {
      description: "Frechet Inception Distance uses an image classification model to obtain image embeddings. The metric compares mean and standard deviation of the embeddings of real and generated images. A smaller score indicates better video generation.",
      id: "fid"
    },
    {
      description: "Frechet Video Distance uses a model that captures coherence for changes in frames and the quality of each frame. A smaller score indicates better video generation.",
      id: "fvd"
    },
    {
      description: "CLIPSIM measures similarity between video frames and text using an image-text similarity model. A higher score indicates better video generation.",
      id: "clipsim"
    }
  ],
  models: [
    {
      description: "A strong model for consistent video generation.",
      id: "rain1011/pyramid-flow-sd3"
    },
    {
      description: "A robust model for text-to-video generation.",
      id: "VideoCrafter/VideoCrafter2"
    },
    {
      description: "A cutting-edge text-to-video generation model.",
      id: "TIGER-Lab/T2V-Turbo-V2"
    }
  ],
  spaces: [
    {
      description: "An application that generates video from text.",
      id: "VideoCrafter/VideoCrafter"
    },
    {
      description: "Consistent video generation application.",
      id: "TIGER-Lab/T2V-Turbo-V2"
    },
    {
      description: "A cutting edge video generation application.",
      id: "Pyramid-Flow/pyramid-flow"
    }
  ],
  summary: "Text-to-video models can be used in any application that requires generating consistent sequence of images from text. ",
  widgetModels: [],
  youtubeId: void 0
};
var data_default30 = taskData30;

// src/tasks/unconditional-image-generation/data.ts
var taskData31 = {
  datasets: [
    {
      description: "The CIFAR-100 dataset consists of 60000 32x32 colour images in 100 classes, with 600 images per class.",
      id: "cifar100"
    },
    {
      description: "Multiple images of celebrities, used for facial expression translation.",
      id: "CelebA"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Seed",
        content: "42",
        type: "text"
      },
      {
        label: "Number of images to generate:",
        content: "4",
        type: "text"
      }
    ],
    outputs: [
      {
        filename: "unconditional-image-generation-output.jpeg",
        type: "img"
      }
    ]
  },
  metrics: [
    {
      description: "The inception score (IS) evaluates the quality of generated images. It measures the diversity of the generated images (the model predictions are evenly distributed across all possible labels) and their 'distinction' or 'sharpness' (the model confidently predicts a single label for each image).",
      id: "Inception score (IS)"
    },
    {
      description: "The Fr\xE9chet Inception Distance (FID) evaluates the quality of images created by a generative model by calculating the distance between feature vectors for real and generated images.",
      id: "Fre\u0107het Inception Distance (FID)"
    }
  ],
  models: [
    {
      description: "High-quality image generation model trained on the CIFAR-10 dataset. It synthesizes images of the ten classes presented in the dataset using diffusion probabilistic models, a class of latent variable models inspired by considerations from nonequilibrium thermodynamics.",
      id: "google/ddpm-cifar10-32"
    },
    {
      description: "High-quality image generation model trained on the 256x256 CelebA-HQ dataset. It synthesizes images of faces using diffusion probabilistic models, a class of latent variable models inspired by considerations from nonequilibrium thermodynamics.",
      id: "google/ddpm-celebahq-256"
    }
  ],
  spaces: [
    {
      description: "An application that can generate realistic faces.",
      id: "CompVis/celeba-latent-diffusion"
    }
  ],
  summary: "Unconditional image generation is the task of generating images with no condition in any context (like a prompt text or another image). Once trained, the model will create images that resemble its training data distribution.",
  widgetModels: [""],
  // TODO: Add related video
  youtubeId: ""
};
var data_default31 = taskData31;

// src/tasks/video-classification/data.ts
var taskData32 = {
  datasets: [
    {
      // TODO write proper description
      description: "Benchmark dataset used for video classification with videos that belong to 400 classes.",
      id: "kinetics400"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "video-classification-input.gif",
        type: "img"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "Playing Guitar",
            score: 0.514
          },
          {
            label: "Playing Tennis",
            score: 0.193
          },
          {
            label: "Cooking",
            score: 0.068
          }
        ]
      }
    ]
  },
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "",
      id: "recall"
    },
    {
      description: "",
      id: "precision"
    },
    {
      description: "",
      id: "f1"
    }
  ],
  models: [
    {
      // TO DO: write description
      description: "Strong Video Classification model trained on the Kinetics 400 dataset.",
      id: "google/vivit-b-16x2-kinetics400"
    },
    {
      // TO DO: write description
      description: "Strong Video Classification model trained on the Kinetics 400 dataset.",
      id: "microsoft/xclip-base-patch32"
    }
  ],
  spaces: [
    {
      description: "An application that classifies video at different timestamps.",
      id: "nateraw/lavila"
    },
    {
      description: "An application that classifies video.",
      id: "fcakyon/video-classification"
    }
  ],
  summary: "Video classification is the task of assigning a label or class to an entire video. Videos are expected to have only one class for each video. Video classification models take a video as input and return a prediction about which class the video belongs to.",
  widgetModels: [],
  youtubeId: ""
};
var data_default32 = taskData32;

// src/tasks/visual-question-answering/data.ts
var taskData33 = {
  datasets: [
    {
      description: "A widely used dataset containing questions (with answers) about images.",
      id: "Graphcore/vqa"
    },
    {
      description: "A dataset to benchmark visual reasoning based on text in images.",
      id: "facebook/textvqa"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "elephant.jpeg",
        type: "img"
      },
      {
        label: "Question",
        content: "What is in this image?",
        type: "text"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "elephant",
            score: 0.97
          },
          {
            label: "elephants",
            score: 0.06
          },
          {
            label: "animal",
            score: 3e-3
          }
        ]
      }
    ]
  },
  isPlaceholder: false,
  metrics: [
    {
      description: "",
      id: "accuracy"
    },
    {
      description: "Measures how much a predicted answer differs from the ground truth based on the difference in their semantic meaning.",
      id: "wu-palmer similarity"
    }
  ],
  models: [
    {
      description: "A visual question answering model trained to convert charts and plots to text.",
      id: "google/deplot"
    },
    {
      description: "A visual question answering model trained for mathematical reasoning and chart derendering from images.",
      id: "google/matcha-base"
    },
    {
      description: "A strong visual question answering that answers questions from book covers.",
      id: "google/pix2struct-ocrvqa-large"
    }
  ],
  spaces: [
    {
      description: "An application that compares visual question answering models across different tasks.",
      id: "merve/pix2struct"
    },
    {
      description: "An application that can answer questions based on images.",
      id: "nielsr/vilt-vqa"
    },
    {
      description: "An application that can caption images and answer questions about a given image. ",
      id: "Salesforce/BLIP"
    },
    {
      description: "An application that can caption images and answer questions about a given image. ",
      id: "vumichien/Img2Prompt"
    }
  ],
  summary: "Visual Question Answering is the task of answering open-ended questions based on an image. They output natural language responses to natural language questions.",
  widgetModels: ["dandelin/vilt-b32-finetuned-vqa"],
  youtubeId: ""
};
var data_default33 = taskData33;

// src/tasks/zero-shot-classification/data.ts
var taskData34 = {
  datasets: [
    {
      description: "A widely used dataset used to benchmark multiple variants of text classification.",
      id: "nyu-mll/glue"
    },
    {
      description: "The Multi-Genre Natural Language Inference (MultiNLI) corpus is a crowd-sourced collection of 433k sentence pairs annotated with textual entailment information.",
      id: "nyu-mll/multi_nli"
    },
    {
      description: "FEVER is a publicly available dataset for fact extraction and verification against textual sources.",
      id: "fever/fever"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Text Input",
        content: "Dune is the best movie ever.",
        type: "text"
      },
      {
        label: "Candidate Labels",
        content: "CINEMA, ART, MUSIC",
        type: "text"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "CINEMA",
            score: 0.9
          },
          {
            label: "ART",
            score: 0.1
          },
          {
            label: "MUSIC",
            score: 0
          }
        ]
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "Powerful zero-shot text classification model.",
      id: "facebook/bart-large-mnli"
    },
    {
      description: "Powerful zero-shot multilingual text classification model that can accomplish multiple tasks.",
      id: "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"
    }
  ],
  spaces: [],
  summary: "Zero-shot text classification is a task in natural language processing where a model is trained on a set of labeled examples but is then able to classify new examples from previously unseen classes.",
  widgetModels: ["facebook/bart-large-mnli"]
};
var data_default34 = taskData34;

// src/tasks/zero-shot-image-classification/data.ts
var taskData35 = {
  datasets: [
    {
      // TODO write proper description
      description: "",
      id: ""
    }
  ],
  demo: {
    inputs: [
      {
        filename: "image-classification-input.jpeg",
        type: "img"
      },
      {
        label: "Classes",
        content: "cat, dog, bird",
        type: "text"
      }
    ],
    outputs: [
      {
        type: "chart",
        data: [
          {
            label: "Cat",
            score: 0.664
          },
          {
            label: "Dog",
            score: 0.329
          },
          {
            label: "Bird",
            score: 8e-3
          }
        ]
      }
    ]
  },
  metrics: [
    {
      description: "Computes the number of times the correct label appears in top K labels predicted",
      id: "top-K accuracy"
    }
  ],
  models: [
    {
      description: "Robust image classification model trained on publicly available image-caption data.",
      id: "openai/clip-vit-base-patch16"
    },
    {
      description: "Strong zero-shot image classification model.",
      id: "google/siglip-so400m-patch14-224"
    },
    {
      description: "Small yet powerful zero-shot image classification model that can run on edge devices.",
      id: "apple/MobileCLIP-S1-OpenCLIP"
    },
    {
      description: "Strong image classification model for biomedical domain.",
      id: "microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224"
    }
  ],
  spaces: [
    {
      description: "An application that leverages zero-shot image classification to find best captions to generate an image. ",
      id: "pharma/CLIP-Interrogator"
    },
    {
      description: "An application to compare different zero-shot image classification models. ",
      id: "merve/compare_clip_siglip"
    }
  ],
  summary: "Zero-shot image classification is the task of classifying previously unseen classes during training of a model.",
  widgetModels: ["google/siglip-so400m-patch14-224"],
  youtubeId: ""
};
var data_default35 = taskData35;

// src/tasks/zero-shot-object-detection/data.ts
var taskData36 = {
  datasets: [],
  demo: {
    inputs: [
      {
        filename: "zero-shot-object-detection-input.jpg",
        type: "img"
      },
      {
        label: "Classes",
        content: "cat, dog, bird",
        type: "text"
      }
    ],
    outputs: [
      {
        filename: "zero-shot-object-detection-output.jpg",
        type: "img"
      }
    ]
  },
  metrics: [
    {
      description: "The Average Precision (AP) metric is the Area Under the PR Curve (AUC-PR). It is calculated for each class separately",
      id: "Average Precision"
    },
    {
      description: "The Mean Average Precision (mAP) metric is the overall average of the AP values",
      id: "Mean Average Precision"
    },
    {
      description: "The AP\u03B1 metric is the Average Precision at the IoU threshold of a \u03B1 value, for example, AP50 and AP75",
      id: "AP\u03B1"
    }
  ],
  models: [
    {
      description: "Solid zero-shot object detection model.",
      id: "IDEA-Research/grounding-dino-base"
    },
    {
      description: "Cutting-edge zero-shot object detection model.",
      id: "google/owlv2-base-patch16-ensemble"
    }
  ],
  spaces: [
    {
      description: "A demo to try the state-of-the-art zero-shot object detection model, OWLv2.",
      id: "merve/owlv2"
    },
    {
      description: "A demo that combines a zero-shot object detection and mask generation model for zero-shot segmentation.",
      id: "merve/OWLSAM"
    }
  ],
  summary: "Zero-shot object detection is a computer vision task to detect objects and their classes in images, without any prior training or knowledge of the classes. Zero-shot object detection models receive an image as input, as well as a list of candidate classes, and output the bounding boxes and labels where the objects have been detected.",
  widgetModels: [],
  youtubeId: ""
};
var data_default36 = taskData36;

// src/tasks/image-to-3d/data.ts
var taskData37 = {
  datasets: [
    {
      description: "A large dataset of over 10 million 3D objects.",
      id: "allenai/objaverse-xl"
    },
    {
      description: "A dataset of isolated object images for evaluating image-to-3D models.",
      id: "dylanebert/iso3d"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "image-to-3d-image-input.png",
        type: "img"
      }
    ],
    outputs: [
      {
        label: "Result",
        content: "image-to-3d-3d-output-filename.glb",
        type: "text"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "Fast image-to-3D mesh model by Tencent.",
      id: "TencentARC/InstantMesh"
    },
    {
      description: "Fast image-to-3D mesh model by StabilityAI",
      id: "stabilityai/TripoSR"
    },
    {
      description: "A scaled up image-to-3D mesh model derived from TripoSR.",
      id: "hwjiang/Real3D"
    },
    {
      description: "Generative 3D gaussian splatting model.",
      id: "ashawkey/LGM"
    }
  ],
  spaces: [
    {
      description: "Leaderboard to evaluate image-to-3D models.",
      id: "dylanebert/3d-arena"
    },
    {
      description: "Image-to-3D demo with mesh outputs.",
      id: "TencentARC/InstantMesh"
    },
    {
      description: "Image-to-3D demo with mesh outputs.",
      id: "stabilityai/TripoSR"
    },
    {
      description: "Image-to-3D demo with mesh outputs.",
      id: "hwjiang/Real3D"
    },
    {
      description: "Image-to-3D demo with splat outputs.",
      id: "dylanebert/LGM-mini"
    }
  ],
  summary: "Image-to-3D models take in image input and produce 3D output.",
  widgetModels: [],
  youtubeId: ""
};
var data_default37 = taskData37;

// src/tasks/text-to-3d/data.ts
var taskData38 = {
  datasets: [
    {
      description: "A large dataset of over 10 million 3D objects.",
      id: "allenai/objaverse-xl"
    },
    {
      description: "Descriptive captions for 3D objects in Objaverse.",
      id: "tiange/Cap3D"
    }
  ],
  demo: {
    inputs: [
      {
        label: "Prompt",
        content: "a cat statue",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Result",
        content: "text-to-3d-3d-output-filename.glb",
        type: "text"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "Text-to-3D mesh model by OpenAI",
      id: "openai/shap-e"
    },
    {
      description: "Generative 3D gaussian splatting model.",
      id: "ashawkey/LGM"
    }
  ],
  spaces: [
    {
      description: "Text-to-3D demo with mesh outputs.",
      id: "hysts/Shap-E"
    },
    {
      description: "Text/image-to-3D demo with splat outputs.",
      id: "ashawkey/LGM"
    }
  ],
  summary: "Text-to-3D models take in text input and produce 3D output.",
  widgetModels: [],
  youtubeId: ""
};
var data_default38 = taskData38;

// src/tasks/keypoint-detection/data.ts
var taskData39 = {
  datasets: [
    {
      description: "A dataset of hand keypoints of over 500k examples.",
      id: "Vincent-luo/hagrid-mediapipe-hands"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "keypoint-detection-input.png",
        type: "img"
      }
    ],
    outputs: [
      {
        filename: "keypoint-detection-output.png",
        type: "img"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "A robust keypoint detection model.",
      id: "magic-leap-community/superpoint"
    },
    {
      description: "Strong keypoint detection model used to detect human pose.",
      id: "facebook/sapiens-pose-1b"
    }
  ],
  spaces: [
    {
      description: "An application that detects hand keypoints in real-time.",
      id: "datasciencedojo/Hand-Keypoint-Detection-Realtime"
    },
    {
      description: "An application to try a universal keypoint detection model.",
      id: "merve/SuperPoint"
    }
  ],
  summary: "Keypoint detection is the task of identifying meaningful distinctive points or features in an image.",
  widgetModels: [],
  youtubeId: ""
};
var data_default39 = taskData39;

// src/tasks/video-text-to-text/data.ts
var taskData40 = {
  datasets: [
    {
      description: "Multiple-choice questions and answers about videos.",
      id: "lmms-lab/Video-MME"
    },
    {
      description: "A dataset of instructions and question-answer pairs about videos.",
      id: "lmms-lab/VideoChatGPT"
    },
    {
      description: "Large video understanding dataset.",
      id: "HuggingFaceFV/finevideo"
    }
  ],
  demo: {
    inputs: [
      {
        filename: "video-text-to-text-input.gif",
        type: "img"
      },
      {
        label: "Text Prompt",
        content: "What is happening in this video?",
        type: "text"
      }
    ],
    outputs: [
      {
        label: "Answer",
        content: "The video shows a series of images showing a fountain with water jets and a variety of colorful flowers and butterflies in the background.",
        type: "text"
      }
    ]
  },
  metrics: [],
  models: [
    {
      description: "A robust video-text-to-text model that can take in image and video inputs.",
      id: "llava-hf/llava-onevision-qwen2-72b-ov-hf"
    },
    {
      description: "Large and powerful video-text-to-text model that can take in image and video inputs.",
      id: "llava-hf/LLaVA-NeXT-Video-34B-hf"
    }
  ],
  spaces: [
    {
      description: "An application to chat with a video-text-to-text model.",
      id: "llava-hf/video-llava"
    },
    {
      description: "A leaderboard for various video-text-to-text models.",
      id: "opencompass/openvlm_video_leaderboard"
    }
  ],
  summary: "Video-text-to-text models take in a video and a text prompt and output text. These models are also called video-language models.",
  widgetModels: [""],
  youtubeId: ""
};
var data_default40 = taskData40;

// src/tasks/index.ts
var TASKS_MODEL_LIBRARIES = {
  "audio-classification": ["speechbrain", "transformers", "transformers.js"],
  "audio-to-audio": ["asteroid", "fairseq", "speechbrain"],
  "automatic-speech-recognition": ["espnet", "nemo", "speechbrain", "transformers", "transformers.js"],
  "depth-estimation": ["transformers", "transformers.js"],
  "document-question-answering": ["transformers", "transformers.js"],
  "feature-extraction": ["sentence-transformers", "transformers", "transformers.js"],
  "fill-mask": ["transformers", "transformers.js"],
  "graph-ml": ["transformers"],
  "image-classification": ["keras", "timm", "transformers", "transformers.js"],
  "image-feature-extraction": ["timm", "transformers"],
  "image-segmentation": ["transformers", "transformers.js"],
  "image-text-to-text": ["transformers"],
  "image-to-image": ["diffusers", "transformers", "transformers.js"],
  "image-to-text": ["transformers", "transformers.js"],
  "image-to-video": ["diffusers"],
  "keypoint-detection": ["transformers"],
  "video-classification": ["transformers"],
  "mask-generation": ["transformers"],
  "multiple-choice": ["transformers"],
  "object-detection": ["transformers", "transformers.js"],
  other: [],
  "question-answering": ["adapter-transformers", "allennlp", "transformers", "transformers.js"],
  robotics: [],
  "reinforcement-learning": ["transformers", "stable-baselines3", "ml-agents", "sample-factory"],
  "sentence-similarity": ["sentence-transformers", "spacy", "transformers.js"],
  summarization: ["transformers", "transformers.js"],
  "table-question-answering": ["transformers"],
  "table-to-text": ["transformers"],
  "tabular-classification": ["sklearn"],
  "tabular-regression": ["sklearn"],
  "tabular-to-text": ["transformers"],
  "text-classification": ["adapter-transformers", "setfit", "spacy", "transformers", "transformers.js"],
  "text-generation": ["transformers", "transformers.js"],
  "text-retrieval": [],
  "text-to-image": ["diffusers"],
  "text-to-speech": ["espnet", "tensorflowtts", "transformers", "transformers.js"],
  "text-to-audio": ["transformers", "transformers.js"],
  "text-to-video": ["diffusers"],
  "text2text-generation": ["transformers", "transformers.js"],
  "time-series-forecasting": [],
  "token-classification": [
    "adapter-transformers",
    "flair",
    "spacy",
    "span-marker",
    "stanza",
    "transformers",
    "transformers.js"
  ],
  translation: ["transformers", "transformers.js"],
  "unconditional-image-generation": ["diffusers"],
  "video-text-to-text": ["transformers"],
  "visual-question-answering": ["transformers", "transformers.js"],
  "voice-activity-detection": [],
  "zero-shot-classification": ["transformers", "transformers.js"],
  "zero-shot-image-classification": ["transformers", "transformers.js"],
  "zero-shot-object-detection": ["transformers", "transformers.js"],
  "text-to-3d": ["diffusers"],
  "image-to-3d": ["diffusers"],
  "any-to-any": ["transformers"]
};
function getData(type, partialTaskData = data_default16) {
  return {
    ...partialTaskData,
    id: type,
    label: PIPELINE_DATA[type].name,
    libraries: TASKS_MODEL_LIBRARIES[type]
  };
}
var TASKS_DATA = {
  "any-to-any": getData("any-to-any", data_default16),
  "audio-classification": getData("audio-classification", data_default),
  "audio-to-audio": getData("audio-to-audio", data_default2),
  "automatic-speech-recognition": getData("automatic-speech-recognition", data_default3),
  "depth-estimation": getData("depth-estimation", data_default15),
  "document-question-answering": getData("document-question-answering", data_default4),
  "feature-extraction": getData("feature-extraction", data_default5),
  "fill-mask": getData("fill-mask", data_default6),
  "graph-ml": void 0,
  "image-classification": getData("image-classification", data_default7),
  "image-feature-extraction": getData("image-feature-extraction", data_default8),
  "image-segmentation": getData("image-segmentation", data_default12),
  "image-to-image": getData("image-to-image", data_default9),
  "image-text-to-text": getData("image-text-to-text", data_default11),
  "image-to-text": getData("image-to-text", data_default10),
  "image-to-video": void 0,
  "keypoint-detection": getData("keypoint-detection", data_default39),
  "mask-generation": getData("mask-generation", data_default13),
  "multiple-choice": void 0,
  "object-detection": getData("object-detection", data_default14),
  "video-classification": getData("video-classification", data_default32),
  other: void 0,
  "question-answering": getData("question-answering", data_default18),
  "reinforcement-learning": getData("reinforcement-learning", data_default17),
  robotics: void 0,
  "sentence-similarity": getData("sentence-similarity", data_default19),
  summarization: getData("summarization", data_default20),
  "table-question-answering": getData("table-question-answering", data_default21),
  "table-to-text": void 0,
  "tabular-classification": getData("tabular-classification", data_default22),
  "tabular-regression": getData("tabular-regression", data_default23),
  "tabular-to-text": void 0,
  "text-classification": getData("text-classification", data_default28),
  "text-generation": getData("text-generation", data_default29),
  "text-retrieval": void 0,
  "text-to-image": getData("text-to-image", data_default24),
  "text-to-speech": getData("text-to-speech", data_default25),
  "text-to-audio": void 0,
  "text-to-video": getData("text-to-video", data_default30),
  "text2text-generation": void 0,
  "time-series-forecasting": void 0,
  "token-classification": getData("token-classification", data_default26),
  translation: getData("translation", data_default27),
  "unconditional-image-generation": getData("unconditional-image-generation", data_default31),
  "video-text-to-text": getData("video-text-to-text", data_default40),
  "visual-question-answering": getData("visual-question-answering", data_default33),
  "voice-activity-detection": void 0,
  "zero-shot-classification": getData("zero-shot-classification", data_default34),
  "zero-shot-image-classification": getData("zero-shot-image-classification", data_default35),
  "zero-shot-object-detection": getData("zero-shot-object-detection", data_default36),
  "text-to-3d": getData("text-to-3d", data_default38),
  "image-to-3d": getData("image-to-3d", data_default37)
};

// src/model-libraries-snippets.ts
var TAG_CUSTOM_CODE = "custom_code";
function nameWithoutNamespace(modelId) {
  const splitted = modelId.split("/");
  return splitted.length === 1 ? splitted[0] : splitted[1];
}
var escapeStringForJson = (str) => JSON.stringify(str).slice(1, -1);
var adapters = (model) => [
  `from adapters import AutoAdapterModel

model = AutoAdapterModel.from_pretrained("${model.config?.adapter_transformers?.model_name}")
model.load_adapter("${model.id}", set_active=True)`
];
var allennlpUnknown = (model) => [
  `import allennlp_models
from allennlp.predictors.predictor import Predictor

predictor = Predictor.from_path("hf://${model.id}")`
];
var allennlpQuestionAnswering = (model) => [
  `import allennlp_models
from allennlp.predictors.predictor import Predictor

predictor = Predictor.from_path("hf://${model.id}")
predictor_input = {"passage": "My name is Wolfgang and I live in Berlin", "question": "Where do I live?"}
predictions = predictor.predict_json(predictor_input)`
];
var allennlp = (model) => {
  if (model.tags.includes("question-answering")) {
    return allennlpQuestionAnswering(model);
  }
  return allennlpUnknown(model);
};
var asteroid = (model) => [
  `from asteroid.models import BaseModel

model = BaseModel.from_pretrained("${model.id}")`
];
var audioseal = (model) => {
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
function get_base_diffusers_model(model) {
  return model.cardData?.base_model?.toString() ?? "fill-in-base-model";
}
function get_prompt_from_diffusers_model(model) {
  const prompt = model.widgetData?.[0]?.text ?? model.cardData?.instance_prompt;
  if (prompt) {
    return escapeStringForJson(prompt);
  }
}
var bertopic = (model) => [
  `from bertopic import BERTopic

model = BERTopic.load("${model.id}")`
];
var bm25s = (model) => [
  `from bm25s.hf import BM25HF

retriever = BM25HF.load_from_hub("${model.id}")`
];
var depth_anything_v2 = (model) => {
  let encoder;
  let features;
  let out_channels;
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
    `
  ];
};
var depth_pro = (model) => {
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
var diffusersDefaultPrompt = "Astronaut in a jungle, cold color palette, muted colors, detailed, 8k";
var diffusers_default = (model) => [
  `from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained("${model.id}")

prompt = "${get_prompt_from_diffusers_model(model) ?? diffusersDefaultPrompt}"
image = pipe(prompt).images[0]`
];
var diffusers_controlnet = (model) => [
  `from diffusers import ControlNetModel, StableDiffusionControlNetPipeline

controlnet = ControlNetModel.from_pretrained("${model.id}")
pipe = StableDiffusionControlNetPipeline.from_pretrained(
	"${get_base_diffusers_model(model)}", controlnet=controlnet
)`
];
var diffusers_lora = (model) => [
  `from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained("${get_base_diffusers_model(model)}")
pipe.load_lora_weights("${model.id}")

prompt = "${get_prompt_from_diffusers_model(model) ?? diffusersDefaultPrompt}"
image = pipe(prompt).images[0]`
];
var diffusers_textual_inversion = (model) => [
  `from diffusers import DiffusionPipeline

pipe = DiffusionPipeline.from_pretrained("${get_base_diffusers_model(model)}")
pipe.load_textual_inversion("${model.id}")`
];
var diffusers = (model) => {
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
var diffusionkit = (model) => {
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
var cartesia_pytorch = (model) => [
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
)`
];
var cartesia_mlx = (model) => [
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
`
];
var edsnlp = (model) => {
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
`
  ];
};
var espnetTTS = (model) => [
  `from espnet2.bin.tts_inference import Text2Speech

model = Text2Speech.from_pretrained("${model.id}")

speech, *_ = model("text to generate speech from")`
];
var espnetASR = (model) => [
  `from espnet2.bin.asr_inference import Speech2Text

model = Speech2Text.from_pretrained(
  "${model.id}"
)

speech, rate = soundfile.read("speech.wav")
text, *_ = model(speech)[0]`
];
var espnetUnknown = () => [`unknown model type (must be text-to-speech or automatic-speech-recognition)`];
var espnet = (model) => {
  if (model.tags.includes("text-to-speech")) {
    return espnetTTS(model);
  } else if (model.tags.includes("automatic-speech-recognition")) {
    return espnetASR(model);
  }
  return espnetUnknown();
};
var fairseq = (model) => [
  `from fairseq.checkpoint_utils import load_model_ensemble_and_task_from_hf_hub

models, cfg, task = load_model_ensemble_and_task_from_hf_hub(
    "${model.id}"
)`
];
var flair = (model) => [
  `from flair.models import SequenceTagger

tagger = SequenceTagger.load("${model.id}")`
];
var gliner = (model) => [
  `from gliner import GLiNER

model = GLiNER.from_pretrained("${model.id}")`
];
var keras = (model) => [
  `# Available backend options are: "jax", "torch", "tensorflow".
import os
os.environ["KERAS_BACKEND"] = "jax"
	
import keras

model = keras.saving.load_model("hf://${model.id}")
`
];
var keras_nlp = (model) => [
  `# Available backend options are: "jax", "torch", "tensorflow".
import os
os.environ["KERAS_BACKEND"] = "jax"

import keras_nlp

tokenizer = keras_nlp.models.Tokenizer.from_preset("hf://${model.id}")
backbone = keras_nlp.models.Backbone.from_preset("hf://${model.id}")
`
];
var keras_hub = (model) => [
  `# Available backend options are: "jax", "torch", "tensorflow".
import os
os.environ["KERAS_BACKEND"] = "jax"

import keras_hub

# Load a task-specific model (*replace CausalLM with your task*)
model = keras_hub.models.CausalLM.from_preset("hf://${model.id}", dtype="bfloat16")

# Possible tasks are CausalLM, TextToImage, ImageClassifier, ...
# full list here: https://keras.io/api/keras_hub/models/#api-documentation
`
];
var llama_cpp_python = (model) => [
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
)`
];
var tf_keras = (model) => [
  `# Note: 'keras<3.x' or 'tf_keras' must be installed (legacy)
# See https://github.com/keras-team/tf-keras for more details.
from huggingface_hub import from_pretrained_keras

model = from_pretrained_keras("${model.id}")
`
];
var mamba_ssm = (model) => [
  `from mamba_ssm import MambaLMHeadModel

model = MambaLMHeadModel.from_pretrained("${model.id}")`
];
var mars5_tts = (model) => [
  `# Install from https://github.com/Camb-ai/MARS5-TTS

from inference import Mars5TTS
mars5 = Mars5TTS.from_pretrained("${model.id}")`
];
var mesh_anything = () => [
  `# Install from https://github.com/buaacyw/MeshAnything.git

from MeshAnything.models.meshanything import MeshAnything

# refer to https://github.com/buaacyw/MeshAnything/blob/main/main.py#L91 on how to define args
# and https://github.com/buaacyw/MeshAnything/blob/main/app.py regarding usage
model = MeshAnything(args)`
];
var open_clip = (model) => [
  `import open_clip

model, preprocess_train, preprocess_val = open_clip.create_model_and_transforms('hf-hub:${model.id}')
tokenizer = open_clip.get_tokenizer('hf-hub:${model.id}')`
];
var paddlenlp = (model) => {
  if (model.config?.architectures?.[0]) {
    const architecture = model.config.architectures[0];
    return [
      [
        `from paddlenlp.transformers import AutoTokenizer, ${architecture}`,
        "",
        `tokenizer = AutoTokenizer.from_pretrained("${model.id}", from_hf_hub=True)`,
        `model = ${architecture}.from_pretrained("${model.id}", from_hf_hub=True)`
      ].join("\n")
    ];
  } else {
    return [
      [
        `# \u26A0\uFE0F Type of model unknown`,
        `from paddlenlp.transformers import AutoTokenizer, AutoModel`,
        "",
        `tokenizer = AutoTokenizer.from_pretrained("${model.id}", from_hf_hub=True)`,
        `model = AutoModel.from_pretrained("${model.id}", from_hf_hub=True)`
      ].join("\n")
    ];
  }
};
var pyannote_audio_pipeline = (model) => [
  `from pyannote.audio import Pipeline
  
pipeline = Pipeline.from_pretrained("${model.id}")

# inference on the whole file
pipeline("file.wav")

# inference on an excerpt
from pyannote.core import Segment
excerpt = Segment(start=2.0, end=5.0)

from pyannote.audio import Audio
waveform, sample_rate = Audio().crop("file.wav", excerpt)
pipeline({"waveform": waveform, "sample_rate": sample_rate})`
];
var pyannote_audio_model = (model) => [
  `from pyannote.audio import Model, Inference

model = Model.from_pretrained("${model.id}")
inference = Inference(model)

# inference on the whole file
inference("file.wav")

# inference on an excerpt
from pyannote.core import Segment
excerpt = Segment(start=2.0, end=5.0)
inference.crop("file.wav", excerpt)`
];
var pyannote_audio = (model) => {
  if (model.tags.includes("pyannote-audio-pipeline")) {
    return pyannote_audio_pipeline(model);
  }
  return pyannote_audio_model(model);
};
var relik = (model) => [
  `from relik import Relik
 
relik = Relik.from_pretrained("${model.id}")`
];
var tensorflowttsTextToMel = (model) => [
  `from tensorflow_tts.inference import AutoProcessor, TFAutoModel

processor = AutoProcessor.from_pretrained("${model.id}")
model = TFAutoModel.from_pretrained("${model.id}")
`
];
var tensorflowttsMelToWav = (model) => [
  `from tensorflow_tts.inference import TFAutoModel

model = TFAutoModel.from_pretrained("${model.id}")
audios = model.inference(mels)
`
];
var tensorflowttsUnknown = (model) => [
  `from tensorflow_tts.inference import TFAutoModel

model = TFAutoModel.from_pretrained("${model.id}")
`
];
var tensorflowtts = (model) => {
  if (model.tags.includes("text-to-mel")) {
    return tensorflowttsTextToMel(model);
  } else if (model.tags.includes("mel-to-wav")) {
    return tensorflowttsMelToWav(model);
  }
  return tensorflowttsUnknown(model);
};
var timm = (model) => [
  `import timm

model = timm.create_model("hf_hub:${model.id}", pretrained=True)`
];
var saelens = () => [
  `# pip install sae-lens
from sae_lens import SAE

sae, cfg_dict, sparsity = SAE.from_pretrained(
    release = "RELEASE_ID", # e.g., "gpt2-small-res-jb". See other options in https://github.com/jbloomAus/SAELens/blob/main/sae_lens/pretrained_saes.yaml
    sae_id = "SAE_ID", # e.g., "blocks.8.hook_resid_pre". Won't always be a hook point
)`
];
var seed_story = () => [
  `# seed_story_cfg_path refers to 'https://github.com/TencentARC/SEED-Story/blob/master/configs/clm_models/agent_7b_sft.yaml'
# llm_cfg_path refers to 'https://github.com/TencentARC/SEED-Story/blob/master/configs/clm_models/llama2chat7b_lora.yaml'
from omegaconf import OmegaConf
import hydra

# load Llama2
llm_cfg = OmegaConf.load(llm_cfg_path)
llm = hydra.utils.instantiate(llm_cfg, torch_dtype="fp16")

# initialize seed_story
seed_story_cfg = OmegaConf.load(seed_story_cfg_path)
seed_story = hydra.utils.instantiate(seed_story_cfg, llm=llm) `
];
var skopsPickle = (model, modelFile) => {
  return [
    `import joblib
from skops.hub_utils import download
download("${model.id}", "path_to_folder")
model = joblib.load(
	"${modelFile}"
)
# only load pickle files from sources you trust
# read more about it here https://skops.readthedocs.io/en/stable/persistence.html`
  ];
};
var skopsFormat = (model, modelFile) => {
  return [
    `from skops.hub_utils import download
from skops.io import load
download("${model.id}", "path_to_folder")
# make sure model file is in skops format
# if model is a pickle file, make sure it's from a source you trust
model = load("path_to_folder/${modelFile}")`
  ];
};
var skopsJobLib = (model) => {
  return [
    `from huggingface_hub import hf_hub_download
import joblib
model = joblib.load(
	hf_hub_download("${model.id}", "sklearn_model.joblib")
)
# only load pickle files from sources you trust
# read more about it here https://skops.readthedocs.io/en/stable/persistence.html`
  ];
};
var sklearn = (model) => {
  if (model.tags.includes("skops")) {
    const skopsmodelFile = model.config?.sklearn?.model?.file;
    const skopssaveFormat = model.config?.sklearn?.model_format;
    if (!skopsmodelFile) {
      return [`# \u26A0\uFE0F Model filename not specified in config.json`];
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
var stable_audio_tools = (model) => [
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
torchaudio.save("output.wav", output, sample_rate)`
];
var fastai = (model) => [
  `from huggingface_hub import from_pretrained_fastai

learn = from_pretrained_fastai("${model.id}")`
];
var sam2 = (model) => {
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
var sampleFactory = (model) => [
  `python -m sample_factory.huggingface.load_from_hub -r ${model.id} -d ./train_dir`
];
function get_widget_examples_from_st_model(model) {
  const widgetExample = model.widgetData?.[0];
  if (widgetExample) {
    return [widgetExample.source_sentence, ...widgetExample.sentences];
  }
}
var sentenceTransformers = (model) => {
  const remote_code_snippet = model.tags.includes(TAG_CUSTOM_CODE) ? ", trust_remote_code=True" : "";
  const exampleSentences = get_widget_examples_from_st_model(model) ?? [
    "The weather is lovely today.",
    "It's so sunny outside!",
    "He drove to the stadium."
  ];
  return [
    `from sentence_transformers import SentenceTransformer

model = SentenceTransformer("${model.id}"${remote_code_snippet})

sentences = ${JSON.stringify(exampleSentences, null, 4)}
embeddings = model.encode(sentences)

similarities = model.similarity(embeddings, embeddings)
print(similarities.shape)
# [${exampleSentences.length}, ${exampleSentences.length}]`
  ];
};
var setfit = (model) => [
  `from setfit import SetFitModel

model = SetFitModel.from_pretrained("${model.id}")`
];
var spacy = (model) => [
  `!pip install https://huggingface.co/${model.id}/resolve/main/${nameWithoutNamespace(model.id)}-any-py3-none-any.whl

# Using spacy.load().
import spacy
nlp = spacy.load("${nameWithoutNamespace(model.id)}")

# Importing as module.
import ${nameWithoutNamespace(model.id)}
nlp = ${nameWithoutNamespace(model.id)}.load()`
];
var span_marker = (model) => [
  `from span_marker import SpanMarkerModel

model = SpanMarkerModel.from_pretrained("${model.id}")`
];
var stanza = (model) => [
  `import stanza

stanza.download("${nameWithoutNamespace(model.id).replace("stanza-", "")}")
nlp = stanza.Pipeline("${nameWithoutNamespace(model.id).replace("stanza-", "")}")`
];
var speechBrainMethod = (speechbrainInterface) => {
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
      return void 0;
  }
};
var speechbrain = (model) => {
  const speechbrainInterface = model.config?.speechbrain?.speechbrain_interface;
  if (speechbrainInterface === void 0) {
    return [`# interface not specified in config.json`];
  }
  const speechbrainMethod = speechBrainMethod(speechbrainInterface);
  if (speechbrainMethod === void 0) {
    return [`# interface in config.json invalid`];
  }
  return [
    `from speechbrain.pretrained import ${speechbrainInterface}
model = ${speechbrainInterface}.from_hparams(
  "${model.id}"
)
model.${speechbrainMethod}("file.wav")`
  ];
};
var transformers = (model) => {
  const info = model.transformersInfo;
  if (!info) {
    return [`# \u26A0\uFE0F Type of model unknown`];
  }
  const remote_code_snippet = model.tags.includes(TAG_CUSTOM_CODE) ? ", trust_remote_code=True" : "";
  let autoSnippet;
  if (info.processor) {
    const varName = info.processor === "AutoTokenizer" ? "tokenizer" : info.processor === "AutoFeatureExtractor" ? "extractor" : "processor";
    autoSnippet = [
      "# Load model directly",
      `from transformers import ${info.processor}, ${info.auto_model}`,
      "",
      `${varName} = ${info.processor}.from_pretrained("${model.id}"` + remote_code_snippet + ")",
      `model = ${info.auto_model}.from_pretrained("${model.id}"` + remote_code_snippet + ")"
    ].join("\n");
  } else {
    autoSnippet = [
      "# Load model directly",
      `from transformers import ${info.auto_model}`,
      `model = ${info.auto_model}.from_pretrained("${model.id}"` + remote_code_snippet + ")"
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
var transformersJS = (model) => {
  if (!model.pipeline_tag) {
    return [`// \u26A0\uFE0F Unknown pipeline tag`];
  }
  const libName = "@huggingface/transformers";
  return [
    `// npm i ${libName}
import { pipeline } from '${libName}';

// Allocate pipeline
const pipe = await pipeline('${model.pipeline_tag}', '${model.id}');`
  ];
};
var peftTask = (peftTaskType) => {
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
      return void 0;
  }
};
var peft = (model) => {
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
model = PeftModel.from_pretrained(base_model, "${model.id}")`
  ];
};
var fasttext = (model) => [
  `from huggingface_hub import hf_hub_download
import fasttext

model = fasttext.load_model(hf_hub_download("${model.id}", "model.bin"))`
];
var stableBaselines3 = (model) => [
  `from huggingface_sb3 import load_from_hub
checkpoint = load_from_hub(
	repo_id="${model.id}",
	filename="{MODEL FILENAME}.zip",
)`
];
var nemoDomainResolver = (domain, model) => {
  switch (domain) {
    case "ASR":
      return [
        `import nemo.collections.asr as nemo_asr
asr_model = nemo_asr.models.ASRModel.from_pretrained("${model.id}")

transcriptions = asr_model.transcribe(["file.wav"])`
      ];
    default:
      return void 0;
  }
};
var mlAgents = (model) => [
  `mlagents-load-from-hf --repo-id="${model.id}" --local-dir="./download: string[]s"`
];
var sentis = () => [
  `string modelName = "[Your model name here].sentis";
Model model = ModelLoader.Load(Application.streamingAssetsPath + "/" + modelName);
IWorker engine = WorkerFactory.CreateWorker(BackendType.GPUCompute, model);
// Please see provided C# file for more details
`
];
var vfimamba = (model) => [
  `from Trainer_finetune import Model

model = Model.from_pretrained("${model.id}")`
];
var voicecraft = (model) => [
  `from voicecraft import VoiceCraft

model = VoiceCraft.from_pretrained("${model.id}")`
];
var chattts = () => [
  `import ChatTTS
import torchaudio

chat = ChatTTS.Chat()
chat.load_models(compile=False) # Set to True for better performance

texts = ["PUT YOUR TEXT HERE",]

wavs = chat.infer(texts, )

torchaudio.save("output1.wav", torch.from_numpy(wavs[0]), 24000)`
];
var yolov10 = (model) => [
  `from ultralytics import YOLOv10

model = YOLOv10.from_pretrained("${model.id}")
source = 'http://images.cocodataset.org/val2017/000000039769.jpg'
model.predict(source=source, save=True)
`
];
var birefnet = (model) => [
  `# Option 1: use with transformers

from transformers import AutoModelForImageSegmentation
birefnet = AutoModelForImageSegmentation.from_pretrained("${model.id}", trust_remote_code=True)
`,
  `# Option 2: use with BiRefNet

# Install from https://github.com/ZhengPeng7/BiRefNet

from models.birefnet import BiRefNet
model = BiRefNet.from_pretrained("${model.id}")`
];
var mlx = (model) => [
  `pip install huggingface_hub hf_transfer

export HF_HUB_ENABLE_HF_TRANS: string[]FER=1
huggingface-cli download --local-dir ${nameWithoutNamespace(model.id)} ${model.id}`
];
var mlxim = (model) => [
  `from mlxim.model import create_model

model = create_model(${model.id})`
];
var model2vec = (model) => [
  `from model2vec import StaticModel

model = StaticModel.from_pretrained("${model.id}")`
];
var nemo = (model) => {
  let command = void 0;
  if (model.tags.includes("automatic-speech-recognition")) {
    command = nemoDomainResolver("ASR", model);
  }
  return command ?? [`# tag did not correspond to a valid NeMo domain.`];
};
var pxia = (model) => [
  `from pxia import AutoModel

model = AutoModel.from_pretrained("${model.id}")`
];
var pythae = (model) => [
  `from pythae.models import AutoModel

model = AutoModel.load_from_hf_hub("${model.id}")`
];
var musicgen = (model) => [
  `from audiocraft.models import MusicGen

model = MusicGen.get_pretrained("${model.id}")

descriptions = ['happy rock', 'energetic EDM', 'sad jazz']
wav = model.generate(descriptions)  # generates 3 samples.`
];
var magnet = (model) => [
  `from audiocraft.models import MAGNeT
	
model = MAGNeT.get_pretrained("${model.id}")

descriptions = ['disco beat', 'energetic EDM', 'funky groove']
wav = model.generate(descriptions)  # generates 3 samples.`
];
var audiogen = (model) => [
  `from audiocraft.models import AudioGen
	
model = AudioGen.get_pretrained("${model.id}")
model.set_generation_params(duration=5)  # generate 5 seconds.
descriptions = ['dog barking', 'sirene of an emergency vehicle', 'footsteps in a corridor']
wav = model.generate(descriptions)  # generates 3 samples.`
];
var audiocraft = (model) => {
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
var whisperkit = () => [
  `# Install CLI with Homebrew on macOS device
brew install whisperkit-cli

# View all available inference options
whisperkit-cli transcribe --help
	
# Download and run inference using whisper base model
whisperkit-cli transcribe --audio-path /path/to/audio.mp3

# Or use your preferred model variant
whisperkit-cli transcribe --model "large-v3" --model-prefix "distil" --audio-path /path/to/audio.mp3 --verbose`
];
var threedtopia_xl = (model) => [
  `from threedtopia_xl.models import threedtopia_xl

model = threedtopia_xl.from_pretrained("${model.id}")
model.generate(cond="path/to/image.png")`
];

// src/model-libraries.ts
var MODEL_LIBRARIES_UI_ELEMENTS = {
  "adapter-transformers": {
    prettyLabel: "Adapters",
    repoName: "adapters",
    repoUrl: "https://github.com/Adapter-Hub/adapters",
    docsUrl: "https://huggingface.co/docs/hub/adapters",
    snippets: adapters,
    filter: true,
    countDownloads: `path:"adapter_config.json"`
  },
  allennlp: {
    prettyLabel: "AllenNLP",
    repoName: "AllenNLP",
    repoUrl: "https://github.com/allenai/allennlp",
    docsUrl: "https://huggingface.co/docs/hub/allennlp",
    snippets: allennlp,
    filter: true
  },
  asteroid: {
    prettyLabel: "Asteroid",
    repoName: "Asteroid",
    repoUrl: "https://github.com/asteroid-team/asteroid",
    docsUrl: "https://huggingface.co/docs/hub/asteroid",
    snippets: asteroid,
    filter: true,
    countDownloads: `path:"pytorch_model.bin"`
  },
  audiocraft: {
    prettyLabel: "Audiocraft",
    repoName: "audiocraft",
    repoUrl: "https://github.com/facebookresearch/audiocraft",
    snippets: audiocraft,
    filter: false,
    countDownloads: `path:"state_dict.bin"`
  },
  audioseal: {
    prettyLabel: "AudioSeal",
    repoName: "audioseal",
    repoUrl: "https://github.com/facebookresearch/audioseal",
    filter: false,
    countDownloads: `path_extension:"pth"`,
    snippets: audioseal
  },
  bertopic: {
    prettyLabel: "BERTopic",
    repoName: "BERTopic",
    repoUrl: "https://github.com/MaartenGr/BERTopic",
    snippets: bertopic,
    filter: true
  },
  big_vision: {
    prettyLabel: "Big Vision",
    repoName: "big_vision",
    repoUrl: "https://github.com/google-research/big_vision",
    filter: false,
    countDownloads: `path_extension:"npz"`
  },
  birefnet: {
    prettyLabel: "BiRefNet",
    repoName: "BiRefNet",
    repoUrl: "https://github.com/ZhengPeng7/BiRefNet",
    snippets: birefnet,
    filter: false
  },
  bm25s: {
    prettyLabel: "BM25S",
    repoName: "bm25s",
    repoUrl: "https://github.com/xhluca/bm25s",
    snippets: bm25s,
    filter: false,
    countDownloads: `path:"params.index.json"`
  },
  champ: {
    prettyLabel: "Champ",
    repoName: "Champ",
    repoUrl: "https://github.com/fudan-generative-vision/champ",
    countDownloads: `path:"champ/motion_module.pth"`
  },
  chat_tts: {
    prettyLabel: "ChatTTS",
    repoName: "ChatTTS",
    repoUrl: "https://github.com/2noise/ChatTTS.git",
    snippets: chattts,
    filter: false,
    countDownloads: `path:"asset/GPT.pt"`
  },
  colpali: {
    prettyLabel: "ColPali",
    repoName: "ColPali",
    repoUrl: "https://github.com/ManuelFay/colpali",
    filter: false,
    countDownloads: `path:"adapter_config.json"`
  },
  deepforest: {
    prettyLabel: "DeepForest",
    repoName: "deepforest",
    docsUrl: "https://deepforest.readthedocs.io/en/latest/",
    repoUrl: "https://github.com/weecology/DeepForest",
    countDownloads: `path_extension:"pt" OR path_extension:"pl"`
  },
  "depth-anything-v2": {
    prettyLabel: "DepthAnythingV2",
    repoName: "Depth Anything V2",
    repoUrl: "https://github.com/DepthAnything/Depth-Anything-V2",
    snippets: depth_anything_v2,
    filter: false,
    countDownloads: `path_extension:"pth"`
  },
  "depth-pro": {
    prettyLabel: "Depth Pro",
    repoName: "Depth Pro",
    repoUrl: "https://github.com/apple/ml-depth-pro",
    countDownloads: `path_extension:"pt"`,
    snippets: depth_pro,
    filter: false
  },
  diffree: {
    prettyLabel: "Diffree",
    repoName: "Diffree",
    repoUrl: "https://github.com/OpenGVLab/Diffree",
    filter: false,
    countDownloads: `path:"diffree-step=000010999.ckpt"`
  },
  diffusers: {
    prettyLabel: "Diffusers",
    repoName: "\u{1F917}/diffusers",
    repoUrl: "https://github.com/huggingface/diffusers",
    docsUrl: "https://huggingface.co/docs/hub/diffusers",
    snippets: diffusers,
    filter: true
    /// diffusers has its own more complex "countDownloads" query
  },
  diffusionkit: {
    prettyLabel: "DiffusionKit",
    repoName: "DiffusionKit",
    repoUrl: "https://github.com/argmaxinc/DiffusionKit",
    snippets: diffusionkit
  },
  doctr: {
    prettyLabel: "docTR",
    repoName: "doctr",
    repoUrl: "https://github.com/mindee/doctr"
  },
  cartesia_pytorch: {
    prettyLabel: "Cartesia Pytorch",
    repoName: "Cartesia Pytorch",
    repoUrl: "https://github.com/cartesia-ai/cartesia_pytorch",
    snippets: cartesia_pytorch
  },
  cartesia_mlx: {
    prettyLabel: "Cartesia MLX",
    repoName: "Cartesia MLX",
    repoUrl: "https://github.com/cartesia-ai/cartesia_mlx",
    snippets: cartesia_mlx
  },
  cotracker: {
    prettyLabel: "CoTracker",
    repoName: "CoTracker",
    repoUrl: "https://github.com/facebookresearch/co-tracker",
    filter: false,
    countDownloads: `path_extension:"pth"`
  },
  edsnlp: {
    prettyLabel: "EDS-NLP",
    repoName: "edsnlp",
    repoUrl: "https://github.com/aphp/edsnlp",
    docsUrl: "https://aphp.github.io/edsnlp/latest/",
    filter: false,
    snippets: edsnlp,
    countDownloads: `path_filename:"config" AND path_extension:"cfg"`
  },
  elm: {
    prettyLabel: "ELM",
    repoName: "elm",
    repoUrl: "https://github.com/slicex-ai/elm",
    filter: false,
    countDownloads: `path_filename:"slicex_elm_config" AND path_extension:"json"`
  },
  espnet: {
    prettyLabel: "ESPnet",
    repoName: "ESPnet",
    repoUrl: "https://github.com/espnet/espnet",
    docsUrl: "https://huggingface.co/docs/hub/espnet",
    snippets: espnet,
    filter: true
  },
  fairseq: {
    prettyLabel: "Fairseq",
    repoName: "fairseq",
    repoUrl: "https://github.com/pytorch/fairseq",
    snippets: fairseq,
    filter: true
  },
  fastai: {
    prettyLabel: "fastai",
    repoName: "fastai",
    repoUrl: "https://github.com/fastai/fastai",
    docsUrl: "https://huggingface.co/docs/hub/fastai",
    snippets: fastai,
    filter: true
  },
  fasttext: {
    prettyLabel: "fastText",
    repoName: "fastText",
    repoUrl: "https://fasttext.cc/",
    snippets: fasttext,
    filter: true,
    countDownloads: `path_extension:"bin"`
  },
  flair: {
    prettyLabel: "Flair",
    repoName: "Flair",
    repoUrl: "https://github.com/flairNLP/flair",
    docsUrl: "https://huggingface.co/docs/hub/flair",
    snippets: flair,
    filter: true,
    countDownloads: `path:"pytorch_model.bin"`
  },
  "gemma.cpp": {
    prettyLabel: "gemma.cpp",
    repoName: "gemma.cpp",
    repoUrl: "https://github.com/google/gemma.cpp",
    filter: false,
    countDownloads: `path_extension:"sbs"`
  },
  gliner: {
    prettyLabel: "GLiNER",
    repoName: "GLiNER",
    repoUrl: "https://github.com/urchade/GLiNER",
    snippets: gliner,
    filter: false,
    countDownloads: `path:"gliner_config.json"`
  },
  "glyph-byt5": {
    prettyLabel: "Glyph-ByT5",
    repoName: "Glyph-ByT5",
    repoUrl: "https://github.com/AIGText/Glyph-ByT5",
    filter: false,
    countDownloads: `path:"checkpoints/byt5_model.pt"`
  },
  grok: {
    prettyLabel: "Grok",
    repoName: "Grok",
    repoUrl: "https://github.com/xai-org/grok-1",
    filter: false,
    countDownloads: `path:"ckpt/tensor00000_000" OR path:"ckpt-0/tensor00000_000"`
  },
  hallo: {
    prettyLabel: "Hallo",
    repoName: "Hallo",
    repoUrl: "https://github.com/fudan-generative-vision/hallo",
    countDownloads: `path:"hallo/net.pth"`
  },
  hezar: {
    prettyLabel: "Hezar",
    repoName: "Hezar",
    repoUrl: "https://github.com/hezarai/hezar",
    docsUrl: "https://hezarai.github.io/hezar",
    countDownloads: `path:"model_config.yaml" OR path:"embedding/embedding_config.yaml"`
  },
  "hunyuan-dit": {
    prettyLabel: "HunyuanDiT",
    repoName: "HunyuanDiT",
    repoUrl: "https://github.com/Tencent/HunyuanDiT",
    countDownloads: `path:"pytorch_model_ema.pt" OR path:"pytorch_model_distill.pt"`
  },
  imstoucan: {
    prettyLabel: "IMS Toucan",
    repoName: "IMS-Toucan",
    repoUrl: "https://github.com/DigitalPhonetics/IMS-Toucan",
    countDownloads: `path:"embedding_gan.pt" OR path:"Vocoder.pt" OR path:"ToucanTTS.pt"`
  },
  keras: {
    prettyLabel: "Keras",
    repoName: "Keras",
    repoUrl: "https://github.com/keras-team/keras",
    docsUrl: "https://huggingface.co/docs/hub/keras",
    snippets: keras,
    filter: true,
    countDownloads: `path:"config.json" OR path_extension:"keras"`
  },
  "tf-keras": {
    // Legacy "Keras 2" library (tensorflow-only)
    prettyLabel: "TF-Keras",
    repoName: "TF-Keras",
    repoUrl: "https://github.com/keras-team/tf-keras",
    docsUrl: "https://huggingface.co/docs/hub/tf-keras",
    snippets: tf_keras,
    countDownloads: `path:"saved_model.pb"`
  },
  "keras-nlp": {
    prettyLabel: "KerasNLP",
    repoName: "KerasNLP",
    repoUrl: "https://github.com/keras-team/keras-nlp",
    docsUrl: "https://keras.io/keras_nlp/",
    snippets: keras_nlp
  },
  "keras-hub": {
    prettyLabel: "KerasHub",
    repoName: "KerasHub",
    repoUrl: "https://github.com/keras-team/keras-hub",
    docsUrl: "https://keras.io/keras_hub/",
    snippets: keras_hub,
    filter: true
  },
  k2: {
    prettyLabel: "K2",
    repoName: "k2",
    repoUrl: "https://github.com/k2-fsa/k2"
  },
  liveportrait: {
    prettyLabel: "LivePortrait",
    repoName: "LivePortrait",
    repoUrl: "https://github.com/KwaiVGI/LivePortrait",
    filter: false,
    countDownloads: `path:"liveportrait/landmark.onnx"`
  },
  "llama-cpp-python": {
    prettyLabel: "llama-cpp-python",
    repoName: "llama-cpp-python",
    repoUrl: "https://github.com/abetlen/llama-cpp-python",
    snippets: llama_cpp_python
  },
  "mini-omni2": {
    prettyLabel: "Mini-Omni2",
    repoName: "Mini-Omni2",
    repoUrl: "https://github.com/gpt-omni/mini-omni2",
    countDownloads: `path:"model_config.yaml"`
  },
  mindspore: {
    prettyLabel: "MindSpore",
    repoName: "mindspore",
    repoUrl: "https://github.com/mindspore-ai/mindspore"
  },
  "mamba-ssm": {
    prettyLabel: "MambaSSM",
    repoName: "MambaSSM",
    repoUrl: "https://github.com/state-spaces/mamba",
    filter: false,
    snippets: mamba_ssm
  },
  "mars5-tts": {
    prettyLabel: "MARS5-TTS",
    repoName: "MARS5-TTS",
    repoUrl: "https://github.com/Camb-ai/MARS5-TTS",
    filter: false,
    countDownloads: `path:"mars5_ar.safetensors"`,
    snippets: mars5_tts
  },
  "mesh-anything": {
    prettyLabel: "MeshAnything",
    repoName: "MeshAnything",
    repoUrl: "https://github.com/buaacyw/MeshAnything",
    filter: false,
    countDownloads: `path:"MeshAnything_350m.pth"`,
    snippets: mesh_anything
  },
  "ml-agents": {
    prettyLabel: "ml-agents",
    repoName: "ml-agents",
    repoUrl: "https://github.com/Unity-Technologies/ml-agents",
    docsUrl: "https://huggingface.co/docs/hub/ml-agents",
    snippets: mlAgents,
    filter: true,
    countDownloads: `path_extension:"onnx"`
  },
  mlx: {
    prettyLabel: "MLX",
    repoName: "MLX",
    repoUrl: "https://github.com/ml-explore/mlx-examples/tree/main",
    snippets: mlx,
    filter: true
  },
  "mlx-image": {
    prettyLabel: "mlx-image",
    repoName: "mlx-image",
    repoUrl: "https://github.com/riccardomusmeci/mlx-image",
    docsUrl: "https://huggingface.co/docs/hub/mlx-image",
    snippets: mlxim,
    filter: false,
    countDownloads: `path:"model.safetensors"`
  },
  "mlc-llm": {
    prettyLabel: "MLC-LLM",
    repoName: "MLC-LLM",
    repoUrl: "https://github.com/mlc-ai/mlc-llm",
    docsUrl: "https://llm.mlc.ai/docs/",
    filter: false,
    countDownloads: `path:"mlc-chat-config.json"`
  },
  model2vec: {
    prettyLabel: "Model2Vec",
    repoName: "model2vec",
    repoUrl: "https://github.com/MinishLab/model2vec",
    snippets: model2vec,
    filter: false
  },
  moshi: {
    prettyLabel: "Moshi",
    repoName: "Moshi",
    repoUrl: "https://github.com/kyutai-labs/moshi",
    filter: false,
    countDownloads: `path:"tokenizer-e351c8d8-checkpoint125.safetensors"`
  },
  nemo: {
    prettyLabel: "NeMo",
    repoName: "NeMo",
    repoUrl: "https://github.com/NVIDIA/NeMo",
    snippets: nemo,
    filter: true,
    countDownloads: `path_extension:"nemo" OR path:"model_config.yaml"`
  },
  "open-oasis": {
    prettyLabel: "open-oasis",
    repoName: "open-oasis",
    repoUrl: "https://github.com/etched-ai/open-oasis",
    countDownloads: `path:"oasis500m.pt"`
  },
  open_clip: {
    prettyLabel: "OpenCLIP",
    repoName: "OpenCLIP",
    repoUrl: "https://github.com/mlfoundations/open_clip",
    snippets: open_clip,
    filter: true,
    countDownloads: `path_extension:"bin" AND path_filename:*pytorch_model`
  },
  paddlenlp: {
    prettyLabel: "paddlenlp",
    repoName: "PaddleNLP",
    repoUrl: "https://github.com/PaddlePaddle/PaddleNLP",
    docsUrl: "https://huggingface.co/docs/hub/paddlenlp",
    snippets: paddlenlp,
    filter: true,
    countDownloads: `path:"model_config.json"`
  },
  peft: {
    prettyLabel: "PEFT",
    repoName: "PEFT",
    repoUrl: "https://github.com/huggingface/peft",
    snippets: peft,
    filter: true,
    countDownloads: `path:"adapter_config.json"`
  },
  pxia: {
    prettyLabel: "pxia",
    repoName: "pxia",
    repoUrl: "https://github.com/not-lain/pxia",
    snippets: pxia,
    filter: false
  },
  "pyannote-audio": {
    prettyLabel: "pyannote.audio",
    repoName: "pyannote-audio",
    repoUrl: "https://github.com/pyannote/pyannote-audio",
    snippets: pyannote_audio,
    filter: true
  },
  "py-feat": {
    prettyLabel: "Py-Feat",
    repoName: "Py-Feat",
    repoUrl: "https://github.com/cosanlab/py-feat",
    docsUrl: "https://py-feat.org/",
    filter: false
  },
  pythae: {
    prettyLabel: "pythae",
    repoName: "pythae",
    repoUrl: "https://github.com/clementchadebec/benchmark_VAE",
    snippets: pythae,
    filter: false
  },
  recurrentgemma: {
    prettyLabel: "RecurrentGemma",
    repoName: "recurrentgemma",
    repoUrl: "https://github.com/google-deepmind/recurrentgemma",
    filter: false,
    countDownloads: `path:"tokenizer.model"`
  },
  relik: {
    prettyLabel: "Relik",
    repoName: "Relik",
    repoUrl: "https://github.com/SapienzaNLP/relik",
    snippets: relik,
    filter: false
  },
  refiners: {
    prettyLabel: "Refiners",
    repoName: "Refiners",
    repoUrl: "https://github.com/finegrain-ai/refiners",
    docsUrl: "https://refine.rs/",
    filter: false,
    countDownloads: `path:"model.safetensors"`
  },
  reverb: {
    prettyLabel: "Reverb",
    repoName: "Reverb",
    repoUrl: "https://github.com/revdotcom/reverb",
    filter: false
  },
  saelens: {
    prettyLabel: "SAELens",
    repoName: "SAELens",
    repoUrl: "https://github.com/jbloomAus/SAELens",
    snippets: saelens,
    filter: false
  },
  sam2: {
    prettyLabel: "sam2",
    repoName: "sam2",
    repoUrl: "https://github.com/facebookresearch/segment-anything-2",
    filter: false,
    snippets: sam2,
    countDownloads: `path_extension:"pt"`
  },
  "sample-factory": {
    prettyLabel: "sample-factory",
    repoName: "sample-factory",
    repoUrl: "https://github.com/alex-petrenko/sample-factory",
    docsUrl: "https://huggingface.co/docs/hub/sample-factory",
    snippets: sampleFactory,
    filter: true,
    countDownloads: `path:"cfg.json"`
  },
  sapiens: {
    prettyLabel: "sapiens",
    repoName: "sapiens",
    repoUrl: "https://github.com/facebookresearch/sapiens",
    filter: false,
    countDownloads: `path_extension:"pt2" OR path_extension:"pth" OR path_extension:"onnx"`
  },
  "sentence-transformers": {
    prettyLabel: "sentence-transformers",
    repoName: "sentence-transformers",
    repoUrl: "https://github.com/UKPLab/sentence-transformers",
    docsUrl: "https://huggingface.co/docs/hub/sentence-transformers",
    snippets: sentenceTransformers,
    filter: true
  },
  setfit: {
    prettyLabel: "setfit",
    repoName: "setfit",
    repoUrl: "https://github.com/huggingface/setfit",
    docsUrl: "https://huggingface.co/docs/hub/setfit",
    snippets: setfit,
    filter: true
  },
  sklearn: {
    prettyLabel: "Scikit-learn",
    repoName: "Scikit-learn",
    repoUrl: "https://github.com/scikit-learn/scikit-learn",
    snippets: sklearn,
    filter: true,
    countDownloads: `path:"sklearn_model.joblib"`
  },
  spacy: {
    prettyLabel: "spaCy",
    repoName: "spaCy",
    repoUrl: "https://github.com/explosion/spaCy",
    docsUrl: "https://huggingface.co/docs/hub/spacy",
    snippets: spacy,
    filter: true,
    countDownloads: `path_extension:"whl"`
  },
  "span-marker": {
    prettyLabel: "SpanMarker",
    repoName: "SpanMarkerNER",
    repoUrl: "https://github.com/tomaarsen/SpanMarkerNER",
    docsUrl: "https://huggingface.co/docs/hub/span_marker",
    snippets: span_marker,
    filter: true
  },
  speechbrain: {
    prettyLabel: "speechbrain",
    repoName: "speechbrain",
    repoUrl: "https://github.com/speechbrain/speechbrain",
    docsUrl: "https://huggingface.co/docs/hub/speechbrain",
    snippets: speechbrain,
    filter: true,
    countDownloads: `path:"hyperparams.yaml"`
  },
  "ssr-speech": {
    prettyLabel: "SSR-Speech",
    repoName: "SSR-Speech",
    repoUrl: "https://github.com/WangHelin1997/SSR-Speech",
    filter: false,
    countDownloads: `path_extension:".pth"`
  },
  "stable-audio-tools": {
    prettyLabel: "Stable Audio Tools",
    repoName: "stable-audio-tools",
    repoUrl: "https://github.com/Stability-AI/stable-audio-tools.git",
    filter: false,
    countDownloads: `path:"model.safetensors"`,
    snippets: stable_audio_tools
  },
  "diffusion-single-file": {
    prettyLabel: "Diffusion Single File",
    repoName: "diffusion-single-file",
    repoUrl: "https://github.com/comfyanonymous/ComfyUI",
    filter: false,
    countDownloads: `path_extension:"safetensors"`
  },
  "seed-story": {
    prettyLabel: "SEED-Story",
    repoName: "SEED-Story",
    repoUrl: "https://github.com/TencentARC/SEED-Story",
    filter: false,
    countDownloads: `path:"cvlm_llama2_tokenizer/tokenizer.model"`,
    snippets: seed_story
  },
  soloaudio: {
    prettyLabel: "SoloAudio",
    repoName: "SoloAudio",
    repoUrl: "https://github.com/WangHelin1997/SoloAudio",
    filter: false,
    countDownloads: `path:"soloaudio_v2.pt"`
  },
  "stable-baselines3": {
    prettyLabel: "stable-baselines3",
    repoName: "stable-baselines3",
    repoUrl: "https://github.com/huggingface/huggingface_sb3",
    docsUrl: "https://huggingface.co/docs/hub/stable-baselines3",
    snippets: stableBaselines3,
    filter: true,
    countDownloads: `path_extension:"zip"`
  },
  stanza: {
    prettyLabel: "Stanza",
    repoName: "stanza",
    repoUrl: "https://github.com/stanfordnlp/stanza",
    docsUrl: "https://huggingface.co/docs/hub/stanza",
    snippets: stanza,
    filter: true,
    countDownloads: `path:"models/default.zip"`
  },
  "f5-tts": {
    prettyLabel: "F5-TTS",
    repoName: "F5-TTS",
    repoUrl: "https://github.com/SWivid/F5-TTS",
    filter: false,
    countDownloads: `path_extension:"safetensors" OR path_extension:"pt"`
  },
  genmo: {
    prettyLabel: "Genmo",
    repoName: "Genmo",
    repoUrl: "https://github.com/genmoai/models",
    filter: false,
    countDownloads: `path:"vae_stats.json"`
  },
  tensorflowtts: {
    prettyLabel: "TensorFlowTTS",
    repoName: "TensorFlowTTS",
    repoUrl: "https://github.com/TensorSpeech/TensorFlowTTS",
    snippets: tensorflowtts
  },
  "tic-clip": {
    prettyLabel: "TiC-CLIP",
    repoName: "TiC-CLIP",
    repoUrl: "https://github.com/apple/ml-tic-clip",
    filter: false,
    countDownloads: `path_extension:"pt" AND path_prefix:"checkpoints/"`
  },
  timesfm: {
    prettyLabel: "TimesFM",
    repoName: "timesfm",
    repoUrl: "https://github.com/google-research/timesfm",
    filter: false,
    countDownloads: `path:"checkpoints/checkpoint_1100000/state/checkpoint"`
  },
  timm: {
    prettyLabel: "timm",
    repoName: "pytorch-image-models",
    repoUrl: "https://github.com/rwightman/pytorch-image-models",
    docsUrl: "https://huggingface.co/docs/hub/timm",
    snippets: timm,
    filter: true,
    countDownloads: `path:"pytorch_model.bin" OR path:"model.safetensors"`
  },
  transformers: {
    prettyLabel: "Transformers",
    repoName: "\u{1F917}/transformers",
    repoUrl: "https://github.com/huggingface/transformers",
    docsUrl: "https://huggingface.co/docs/hub/transformers",
    snippets: transformers,
    filter: true
  },
  "transformers.js": {
    prettyLabel: "Transformers.js",
    repoName: "transformers.js",
    repoUrl: "https://github.com/huggingface/transformers.js",
    docsUrl: "https://huggingface.co/docs/hub/transformers-js",
    snippets: transformersJS,
    filter: true
  },
  "unity-sentis": {
    prettyLabel: "unity-sentis",
    repoName: "unity-sentis",
    repoUrl: "https://github.com/Unity-Technologies/sentis-samples",
    snippets: sentis,
    filter: true,
    countDownloads: `path_extension:"sentis"`
  },
  "vfi-mamba": {
    prettyLabel: "VFIMamba",
    repoName: "VFIMamba",
    repoUrl: "https://github.com/MCG-NJU/VFIMamba",
    countDownloads: `path_extension:"pkl"`,
    snippets: vfimamba
  },
  voicecraft: {
    prettyLabel: "VoiceCraft",
    repoName: "VoiceCraft",
    repoUrl: "https://github.com/jasonppy/VoiceCraft",
    docsUrl: "https://github.com/jasonppy/VoiceCraft",
    snippets: voicecraft
  },
  yolov10: {
    prettyLabel: "YOLOv10",
    repoName: "yolov10",
    repoUrl: "https://github.com/THU-MIG/yolov10",
    docsUrl: "https://github.com/THU-MIG/yolov10",
    snippets: yolov10
  },
  whisperkit: {
    prettyLabel: "WhisperKit",
    repoName: "WhisperKit",
    repoUrl: "https://github.com/argmaxinc/WhisperKit",
    docsUrl: "https://github.com/argmaxinc/WhisperKit?tab=readme-ov-file#homebrew",
    snippets: whisperkit,
    countDownloads: `path_filename:"model" AND path_extension:"mil" AND _exists_:"path_prefix"`
  },
  "3dtopia-xl": {
    prettyLabel: "3DTopia-XL",
    repoName: "3DTopia-XL",
    repoUrl: "https://github.com/3DTopia/3DTopia-XL",
    filter: false,
    countDownloads: `path:"model_vae_fp16.pt"`,
    snippets: threedtopia_xl
  }
};
var ALL_MODEL_LIBRARY_KEYS = Object.keys(MODEL_LIBRARIES_UI_ELEMENTS);
var ALL_DISPLAY_MODEL_LIBRARY_KEYS = Object.entries(MODEL_LIBRARIES_UI_ELEMENTS).filter(([_, v]) => v.filter).map(([k]) => k);

// src/tokenizer-data.ts
var SPECIAL_TOKENS_ATTRIBUTES = [
  "bos_token",
  "eos_token",
  "unk_token",
  "sep_token",
  "pad_token",
  "cls_token",
  "mask_token"
  // additional_special_tokens (TODO)
];

// src/snippets/index.ts
var snippets_exports = {};
__export(snippets_exports, {
  curl: () => curl_exports,
  inputs: () => inputs_exports,
  js: () => js_exports,
  python: () => python_exports
});

// src/snippets/inputs.ts
var inputs_exports = {};
__export(inputs_exports, {
  getModelInputSnippet: () => getModelInputSnippet
});
var inputsZeroShotClassification = () => `"Hi, I recently bought a device from your company but it is not working as advertised and I would like to get reimbursed!"`;
var inputsTranslation = () => `"\u041C\u0435\u043D\u044F \u0437\u043E\u0432\u0443\u0442 \u0412\u043E\u043B\u044C\u0444\u0433\u0430\u043D\u0433 \u0438 \u044F \u0436\u0438\u0432\u0443 \u0432 \u0411\u0435\u0440\u043B\u0438\u043D\u0435"`;
var inputsSummarization = () => `"The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York City was finished in 1930. It was the first structure to reach a height of 300 metres. Due to the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the Chrysler Building by 5.2 metres (17 ft). Excluding transmitters, the Eiffel Tower is the second tallest free-standing structure in France after the Millau Viaduct."`;
var inputsTableQuestionAnswering = () => `{
	"query": "How many stars does the transformers repository have?",
	"table": {
		"Repository": ["Transformers", "Datasets", "Tokenizers"],
		"Stars": ["36542", "4512", "3934"],
		"Contributors": ["651", "77", "34"],
		"Programming language": [
			"Python",
			"Python",
			"Rust, Python and NodeJS"
		]
	}
}`;
var inputsVisualQuestionAnswering = () => `{
	"image": "cat.png",
	"question": "What is in this image?"
}`;
var inputsQuestionAnswering = () => `{
	"question": "What is my name?",
	"context": "My name is Clara and I live in Berkeley."
}`;
var inputsTextClassification = () => `"I like you. I love you"`;
var inputsTokenClassification = () => `"My name is Sarah Jessica Parker but you can call me Jessica"`;
var inputsTextGeneration = (model) => {
  if (model.tags.includes("conversational")) {
    return model.pipeline_tag === "text-generation" ? [{ role: "user", content: "What is the capital of France?" }] : [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image in one sentence."
          },
          {
            type: "image_url",
            image_url: {
              url: "https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg"
            }
          }
        ]
      }
    ];
  }
  return `"Can you please let us know more details about your "`;
};
var inputsText2TextGeneration = () => `"The answer to the universe is"`;
var inputsFillMask = (model) => `"The answer to the universe is ${model.mask_token}."`;
var inputsSentenceSimilarity = () => `{
	"source_sentence": "That is a happy person",
	"sentences": [
		"That is a happy dog",
		"That is a very happy person",
		"Today is a sunny day"
	]
}`;
var inputsFeatureExtraction = () => `"Today is a sunny day and I will get some ice cream."`;
var inputsImageClassification = () => `"cats.jpg"`;
var inputsImageToText = () => `"cats.jpg"`;
var inputsImageSegmentation = () => `"cats.jpg"`;
var inputsObjectDetection = () => `"cats.jpg"`;
var inputsAudioToAudio = () => `"sample1.flac"`;
var inputsAudioClassification = () => `"sample1.flac"`;
var inputsTextToImage = () => `"Astronaut riding a horse"`;
var inputsTextToSpeech = () => `"The answer to the universe is 42"`;
var inputsTextToAudio = () => `"liquid drum and bass, atmospheric synths, airy sounds"`;
var inputsAutomaticSpeechRecognition = () => `"sample1.flac"`;
var inputsTabularPrediction = () => `'{"Height":[11.52,12.48],"Length1":[23.2,24.0],"Length2":[25.4,26.3],"Species": ["Bream","Bream"]}'`;
var inputsZeroShotImageClassification = () => `"cats.jpg"`;
var modelInputSnippets = {
  "audio-to-audio": inputsAudioToAudio,
  "audio-classification": inputsAudioClassification,
  "automatic-speech-recognition": inputsAutomaticSpeechRecognition,
  "document-question-answering": inputsVisualQuestionAnswering,
  "feature-extraction": inputsFeatureExtraction,
  "fill-mask": inputsFillMask,
  "image-classification": inputsImageClassification,
  "image-to-text": inputsImageToText,
  "image-segmentation": inputsImageSegmentation,
  "object-detection": inputsObjectDetection,
  "question-answering": inputsQuestionAnswering,
  "sentence-similarity": inputsSentenceSimilarity,
  summarization: inputsSummarization,
  "table-question-answering": inputsTableQuestionAnswering,
  "tabular-regression": inputsTabularPrediction,
  "tabular-classification": inputsTabularPrediction,
  "text-classification": inputsTextClassification,
  "text-generation": inputsTextGeneration,
  "image-text-to-text": inputsTextGeneration,
  "text-to-image": inputsTextToImage,
  "text-to-speech": inputsTextToSpeech,
  "text-to-audio": inputsTextToAudio,
  "text2text-generation": inputsText2TextGeneration,
  "token-classification": inputsTokenClassification,
  translation: inputsTranslation,
  "zero-shot-classification": inputsZeroShotClassification,
  "zero-shot-image-classification": inputsZeroShotImageClassification
};
function getModelInputSnippet(model, noWrap = false, noQuotes = false) {
  if (model.pipeline_tag) {
    const inputs = modelInputSnippets[model.pipeline_tag];
    if (inputs) {
      let result = inputs(model);
      if (typeof result === "string") {
        if (noWrap) {
          result = result.replace(/(?:(?:\r?\n|\r)\t*)|\t+/g, " ");
        }
        if (noQuotes) {
          const REGEX_QUOTES = /^"(.+)"$/s;
          const match = result.match(REGEX_QUOTES);
          result = match ? match[1] : result;
        }
      }
      return result;
    }
  }
  return "No input example has been defined for this model task.";
}

// src/snippets/curl.ts
var curl_exports = {};
__export(curl_exports, {
  curlSnippets: () => curlSnippets,
  getCurlInferenceSnippet: () => getCurlInferenceSnippet,
  hasCurlInferenceSnippet: () => hasCurlInferenceSnippet,
  snippetBasic: () => snippetBasic,
  snippetFile: () => snippetFile,
  snippetTextGeneration: () => snippetTextGeneration,
  snippetZeroShotClassification: () => snippetZeroShotClassification
});

// src/snippets/common.ts
function stringifyMessages(messages, opts) {
  let messagesStr = JSON.stringify(messages, null, "	");
  if (opts?.indent) {
    messagesStr = messagesStr.replaceAll("\n", `
${opts.indent}`);
  }
  if (!opts?.attributeKeyQuotes) {
    messagesStr = messagesStr.replace(/"([^"]+)":/g, "$1:");
  }
  if (opts?.customContentEscaper) {
    messagesStr = opts.customContentEscaper(messagesStr);
  }
  return messagesStr;
}
function stringifyGenerationConfig(config, opts) {
  const quote = opts.attributeKeyQuotes ? `"` : "";
  return Object.entries(config).map(([key, val]) => `${quote}${key}${quote}${opts.attributeValueConnector}${val}`).join(`,${opts.indent}`);
}

// src/snippets/curl.ts
var snippetBasic = (model, accessToken) => ({
  content: `curl https://api-inference.huggingface.co/models/${model.id} \\
	-X POST \\
	-d '{"inputs": ${getModelInputSnippet(model, true)}}' \\
	-H 'Content-Type: application/json' \\
	-H "Authorization: Bearer ${accessToken || `{API_TOKEN}`}"`
});
var snippetTextGeneration = (model, accessToken, opts) => {
  if (model.tags.includes("conversational")) {
    const streaming = opts?.streaming ?? true;
    const exampleMessages = getModelInputSnippet(model);
    const messages = opts?.messages ?? exampleMessages;
    const config = {
      ...opts?.temperature ? { temperature: opts.temperature } : void 0,
      max_tokens: opts?.max_tokens ?? 500,
      ...opts?.top_p ? { top_p: opts.top_p } : void 0
    };
    return {
      content: `curl 'https://api-inference.huggingface.co/models/${model.id}/v1/chat/completions' \\
-H "Authorization: Bearer ${accessToken || `{API_TOKEN}`}" \\
-H 'Content-Type: application/json' \\
--data '{
    "model": "${model.id}",
    "messages": ${stringifyMessages(messages, {
        indent: "	",
        attributeKeyQuotes: true,
        customContentEscaper: (str) => str.replace(/'/g, "'\\''")
      })},
    ${stringifyGenerationConfig(config, {
        indent: "\n    ",
        attributeKeyQuotes: true,
        attributeValueConnector: ": "
      })},
    "stream": ${!!streaming}
}'`
    };
  } else {
    return snippetBasic(model, accessToken);
  }
};
var snippetZeroShotClassification = (model, accessToken) => ({
  content: `curl https://api-inference.huggingface.co/models/${model.id} \\
	-X POST \\
	-d '{"inputs": ${getModelInputSnippet(model, true)}, "parameters": {"candidate_labels": ["refund", "legal", "faq"]}}' \\
	-H 'Content-Type: application/json' \\
	-H "Authorization: Bearer ${accessToken || `{API_TOKEN}`}"`
});
var snippetFile = (model, accessToken) => ({
  content: `curl https://api-inference.huggingface.co/models/${model.id} \\
	-X POST \\
	--data-binary '@${getModelInputSnippet(model, true, true)}' \\
	-H "Authorization: Bearer ${accessToken || `{API_TOKEN}`}"`
});
var curlSnippets = {
  // Same order as in js/src/lib/interfaces/Types.ts
  "text-classification": snippetBasic,
  "token-classification": snippetBasic,
  "table-question-answering": snippetBasic,
  "question-answering": snippetBasic,
  "zero-shot-classification": snippetZeroShotClassification,
  translation: snippetBasic,
  summarization: snippetBasic,
  "feature-extraction": snippetBasic,
  "text-generation": snippetTextGeneration,
  "image-text-to-text": snippetTextGeneration,
  "text2text-generation": snippetBasic,
  "fill-mask": snippetBasic,
  "sentence-similarity": snippetBasic,
  "automatic-speech-recognition": snippetFile,
  "text-to-image": snippetBasic,
  "text-to-speech": snippetBasic,
  "text-to-audio": snippetBasic,
  "audio-to-audio": snippetFile,
  "audio-classification": snippetFile,
  "image-classification": snippetFile,
  "image-to-text": snippetFile,
  "object-detection": snippetFile,
  "image-segmentation": snippetFile
};
function getCurlInferenceSnippet(model, accessToken) {
  return model.pipeline_tag && model.pipeline_tag in curlSnippets ? curlSnippets[model.pipeline_tag]?.(model, accessToken) ?? { content: "" } : { content: "" };
}
function hasCurlInferenceSnippet(model) {
  return !!model.pipeline_tag && model.pipeline_tag in curlSnippets;
}

// src/snippets/python.ts
var python_exports = {};
__export(python_exports, {
  getPythonInferenceSnippet: () => getPythonInferenceSnippet,
  hasPythonInferenceSnippet: () => hasPythonInferenceSnippet,
  pythonSnippets: () => pythonSnippets,
  snippetBasic: () => snippetBasic2,
  snippetConversational: () => snippetConversational,
  snippetDocumentQuestionAnswering: () => snippetDocumentQuestionAnswering,
  snippetFile: () => snippetFile2,
  snippetTabular: () => snippetTabular,
  snippetTextToAudio: () => snippetTextToAudio,
  snippetTextToImage: () => snippetTextToImage,
  snippetZeroShotClassification: () => snippetZeroShotClassification2,
  snippetZeroShotImageClassification: () => snippetZeroShotImageClassification
});
var snippetConversational = (model, accessToken, opts) => {
  const streaming = opts?.streaming ?? true;
  const exampleMessages = getModelInputSnippet(model);
  const messages = opts?.messages ?? exampleMessages;
  const messagesStr = stringifyMessages(messages, { attributeKeyQuotes: true });
  const config = {
    ...opts?.temperature ? { temperature: opts.temperature } : void 0,
    max_tokens: opts?.max_tokens ?? 500,
    ...opts?.top_p ? { top_p: opts.top_p } : void 0
  };
  const configStr = stringifyGenerationConfig(config, {
    indent: "\n	",
    attributeValueConnector: "="
  });
  if (streaming) {
    return [
      {
        client: "huggingface_hub",
        content: `from huggingface_hub import InferenceClient

client = InferenceClient(api_key="${accessToken || "{API_TOKEN}"}")

messages = ${messagesStr}

stream = client.chat.completions.create(
    model="${model.id}", 
	messages=messages, 
	${configStr},
	stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content, end="")`
      },
      {
        client: "openai",
        content: `from openai import OpenAI

client = OpenAI(
	base_url="https://api-inference.huggingface.co/v1/",
	api_key="${accessToken || "{API_TOKEN}"}"
)

messages = ${messagesStr}

stream = client.chat.completions.create(
    model="${model.id}", 
	messages=messages, 
	${configStr},
	stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content, end="")`
      }
    ];
  } else {
    return [
      {
        client: "huggingface_hub",
        content: `from huggingface_hub import InferenceClient

client = InferenceClient(api_key="${accessToken || "{API_TOKEN}"}")

messages = ${messagesStr}

completion = client.chat.completions.create(
    model="${model.id}", 
	messages=messages, 
	${configStr}
)

print(completion.choices[0].message)`
      },
      {
        client: "openai",
        content: `from openai import OpenAI

client = OpenAI(
	base_url="https://api-inference.huggingface.co/v1/",
	api_key="${accessToken || "{API_TOKEN}"}"
)

messages = ${messagesStr}

completion = client.chat.completions.create(
    model="${model.id}", 
	messages=messages, 
	${configStr}
)

print(completion.choices[0].message)`
      }
    ];
  }
};
var snippetZeroShotClassification2 = (model) => ({
  content: `def query(payload):
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.json()

output = query({
    "inputs": ${getModelInputSnippet(model)},
    "parameters": {"candidate_labels": ["refund", "legal", "faq"]},
})`
});
var snippetZeroShotImageClassification = (model) => ({
  content: `def query(data):
	with open(data["image_path"], "rb") as f:
		img = f.read()
	payload={
		"parameters": data["parameters"],
		"inputs": base64.b64encode(img).decode("utf-8")
	}
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.json()

output = query({
    "image_path": ${getModelInputSnippet(model)},
    "parameters": {"candidate_labels": ["cat", "dog", "llama"]},
})`
});
var snippetBasic2 = (model) => ({
  content: `def query(payload):
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.json()
	
output = query({
	"inputs": ${getModelInputSnippet(model)},
})`
});
var snippetFile2 = (model) => ({
  content: `def query(filename):
    with open(filename, "rb") as f:
        data = f.read()
    response = requests.post(API_URL, headers=headers, data=data)
    return response.json()

output = query(${getModelInputSnippet(model)})`
});
var snippetTextToImage = (model) => ({
  content: `def query(payload):
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.content
image_bytes = query({
	"inputs": ${getModelInputSnippet(model)},
})
# You can access the image with PIL.Image for example
import io
from PIL import Image
image = Image.open(io.BytesIO(image_bytes))`
});
var snippetTabular = (model) => ({
  content: `def query(payload):
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.content
response = query({
	"inputs": {"data": ${getModelInputSnippet(model)}},
})`
});
var snippetTextToAudio = (model) => {
  if (model.library_name === "transformers") {
    return {
      content: `def query(payload):
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.content

audio_bytes = query({
	"inputs": ${getModelInputSnippet(model)},
})
# You can access the audio with IPython.display for example
from IPython.display import Audio
Audio(audio_bytes)`
    };
  } else {
    return {
      content: `def query(payload):
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.json()
	
audio, sampling_rate = query({
	"inputs": ${getModelInputSnippet(model)},
})
# You can access the audio with IPython.display for example
from IPython.display import Audio
Audio(audio, rate=sampling_rate)`
    };
  }
};
var snippetDocumentQuestionAnswering = (model) => ({
  content: `def query(payload):
 	with open(payload["image"], "rb") as f:
  		img = f.read()
		payload["image"] = base64.b64encode(img).decode("utf-8")  
	response = requests.post(API_URL, headers=headers, json=payload)
	return response.json()

output = query({
    "inputs": ${getModelInputSnippet(model)},
})`
});
var pythonSnippets = {
  // Same order as in tasks/src/pipelines.ts
  "text-classification": snippetBasic2,
  "token-classification": snippetBasic2,
  "table-question-answering": snippetBasic2,
  "question-answering": snippetBasic2,
  "zero-shot-classification": snippetZeroShotClassification2,
  translation: snippetBasic2,
  summarization: snippetBasic2,
  "feature-extraction": snippetBasic2,
  "text-generation": snippetBasic2,
  "text2text-generation": snippetBasic2,
  "image-text-to-text": snippetConversational,
  "fill-mask": snippetBasic2,
  "sentence-similarity": snippetBasic2,
  "automatic-speech-recognition": snippetFile2,
  "text-to-image": snippetTextToImage,
  "text-to-speech": snippetTextToAudio,
  "text-to-audio": snippetTextToAudio,
  "audio-to-audio": snippetFile2,
  "audio-classification": snippetFile2,
  "image-classification": snippetFile2,
  "tabular-regression": snippetTabular,
  "tabular-classification": snippetTabular,
  "object-detection": snippetFile2,
  "image-segmentation": snippetFile2,
  "document-question-answering": snippetDocumentQuestionAnswering,
  "image-to-text": snippetFile2,
  "zero-shot-image-classification": snippetZeroShotImageClassification
};
function getPythonInferenceSnippet(model, accessToken, opts) {
  if (model.tags.includes("conversational")) {
    return snippetConversational(model, accessToken, opts);
  } else {
    let snippets = model.pipeline_tag && model.pipeline_tag in pythonSnippets ? pythonSnippets[model.pipeline_tag]?.(model, accessToken) ?? { content: "" } : { content: "" };
    snippets = Array.isArray(snippets) ? snippets : [snippets];
    return snippets.map((snippet) => {
      return {
        ...snippet,
        content: `import requests

API_URL = "https://api-inference.huggingface.co/models/${model.id}"
headers = {"Authorization": ${accessToken ? `"Bearer ${accessToken}"` : `f"Bearer {API_TOKEN}"`}}

${snippet.content}`
      };
    });
  }
}
function hasPythonInferenceSnippet(model) {
  return !!model.pipeline_tag && model.pipeline_tag in pythonSnippets;
}

// src/snippets/js.ts
var js_exports = {};
__export(js_exports, {
  getJsInferenceSnippet: () => getJsInferenceSnippet,
  hasJsInferenceSnippet: () => hasJsInferenceSnippet,
  jsSnippets: () => jsSnippets,
  snippetBasic: () => snippetBasic3,
  snippetFile: () => snippetFile3,
  snippetTextGeneration: () => snippetTextGeneration2,
  snippetTextToAudio: () => snippetTextToAudio2,
  snippetTextToImage: () => snippetTextToImage2,
  snippetZeroShotClassification: () => snippetZeroShotClassification3
});
var snippetBasic3 = (model, accessToken) => ({
  content: `async function query(data) {
	const response = await fetch(
		"https://api-inference.huggingface.co/models/${model.id}",
		{
			headers: {
				Authorization: "Bearer ${accessToken || `{API_TOKEN}`}"
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}

query({"inputs": ${getModelInputSnippet(model)}}).then((response) => {
	console.log(JSON.stringify(response));
});`
});
var snippetTextGeneration2 = (model, accessToken, opts) => {
  if (model.tags.includes("conversational")) {
    const streaming = opts?.streaming ?? true;
    const exampleMessages = getModelInputSnippet(model);
    const messages = opts?.messages ?? exampleMessages;
    const messagesStr = stringifyMessages(messages, { indent: "	" });
    const config = {
      ...opts?.temperature ? { temperature: opts.temperature } : void 0,
      max_tokens: opts?.max_tokens ?? 500,
      ...opts?.top_p ? { top_p: opts.top_p } : void 0
    };
    const configStr = stringifyGenerationConfig(config, {
      indent: "\n	",
      attributeValueConnector: ": "
    });
    if (streaming) {
      return [
        {
          client: "huggingface_hub",
          content: `import { HfInference } from "@huggingface/inference"

const client = new HfInference("${accessToken || `{API_TOKEN}`}")

let out = "";

const stream = client.chatCompletionStream({
	model: "${model.id}",
	messages: ${messagesStr},
	${configStr}
});

for await (const chunk of stream) {
	if (chunk.choices && chunk.choices.length > 0) {
		const newContent = chunk.choices[0].delta.content;
		out += newContent;
		console.log(newContent);
	}  
}`
        },
        {
          client: "openai",
          content: `import { OpenAI } from "openai"

const client = new OpenAI({
	baseURL: "https://api-inference.huggingface.co/v1/",
    apiKey: "${accessToken || `{API_TOKEN}`}"
})

let out = "";

const stream = await client.chat.completions.create({
	model: "${model.id}",
	messages: ${messagesStr},
	${configStr},
	stream: true,
});

for await (const chunk of stream) {
	if (chunk.choices && chunk.choices.length > 0) {
		const newContent = chunk.choices[0].delta.content;
		out += newContent;
		console.log(newContent);
	}  
}`
        }
      ];
    } else {
      return [
        {
          client: "huggingface_hub",
          content: `import { HfInference } from '@huggingface/inference'

const client = new HfInference("${accessToken || `{API_TOKEN}`}")

const chatCompletion = await client.chatCompletion({
	model: "${model.id}",
	messages: ${messagesStr},
	${configStr}
});

console.log(chatCompletion.choices[0].message);`
        },
        {
          client: "openai",
          content: `import { OpenAI } from "openai"

const client = new OpenAI({
    baseURL: "https://api-inference.huggingface.co/v1/",
    apiKey: "${accessToken || `{API_TOKEN}`}"
})

const chatCompletion = await client.chat.completions.create({
	model: "${model.id}",
	messages: ${messagesStr},
	${configStr}
});

console.log(chatCompletion.choices[0].message);`
        }
      ];
    }
  } else {
    return snippetBasic3(model, accessToken);
  }
};
var snippetZeroShotClassification3 = (model, accessToken) => ({
  content: `async function query(data) {
	const response = await fetch(
		"https://api-inference.huggingface.co/models/${model.id}",
		{
			headers: {
				Authorization: "Bearer ${accessToken || `{API_TOKEN}`}"
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}

query({"inputs": ${getModelInputSnippet(
    model
  )}, "parameters": {"candidate_labels": ["refund", "legal", "faq"]}}).then((response) => {
	console.log(JSON.stringify(response));
});`
});
var snippetTextToImage2 = (model, accessToken) => ({
  content: `async function query(data) {
	const response = await fetch(
		"https://api-inference.huggingface.co/models/${model.id}",
		{
			headers: {
				Authorization: "Bearer ${accessToken || `{API_TOKEN}`}"
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.blob();
	return result;
}
query({"inputs": ${getModelInputSnippet(model)}}).then((response) => {
	// Use image
});`
});
var snippetTextToAudio2 = (model, accessToken) => {
  const commonSnippet = `async function query(data) {
		const response = await fetch(
			"https://api-inference.huggingface.co/models/${model.id}",
			{
				headers: {
					Authorization: "Bearer ${accessToken || `{API_TOKEN}`}"
					"Content-Type": "application/json",
				},
				method: "POST",
				body: JSON.stringify(data),
			}
		);`;
  if (model.library_name === "transformers") {
    return {
      content: commonSnippet + `
			const result = await response.blob();
			return result;
		}
		query({"inputs": ${getModelInputSnippet(model)}}).then((response) => {
			// Returns a byte object of the Audio wavform. Use it directly!
		});`
    };
  } else {
    return {
      content: commonSnippet + `
			const result = await response.json();
			return result;
		}
		
		query({"inputs": ${getModelInputSnippet(model)}}).then((response) => {
			console.log(JSON.stringify(response));
		});`
    };
  }
};
var snippetFile3 = (model, accessToken) => ({
  content: `async function query(filename) {
	const data = fs.readFileSync(filename);
	const response = await fetch(
		"https://api-inference.huggingface.co/models/${model.id}",
		{
			headers: {
				Authorization: "Bearer ${accessToken || `{API_TOKEN}`}"
				"Content-Type": "application/json",
			},
			method: "POST",
			body: data,
		}
	);
	const result = await response.json();
	return result;
}

query(${getModelInputSnippet(model)}).then((response) => {
	console.log(JSON.stringify(response));
});`
});
var jsSnippets = {
  // Same order as in js/src/lib/interfaces/Types.ts
  "text-classification": snippetBasic3,
  "token-classification": snippetBasic3,
  "table-question-answering": snippetBasic3,
  "question-answering": snippetBasic3,
  "zero-shot-classification": snippetZeroShotClassification3,
  translation: snippetBasic3,
  summarization: snippetBasic3,
  "feature-extraction": snippetBasic3,
  "text-generation": snippetTextGeneration2,
  "image-text-to-text": snippetTextGeneration2,
  "text2text-generation": snippetBasic3,
  "fill-mask": snippetBasic3,
  "sentence-similarity": snippetBasic3,
  "automatic-speech-recognition": snippetFile3,
  "text-to-image": snippetTextToImage2,
  "text-to-speech": snippetTextToAudio2,
  "text-to-audio": snippetTextToAudio2,
  "audio-to-audio": snippetFile3,
  "audio-classification": snippetFile3,
  "image-classification": snippetFile3,
  "image-to-text": snippetFile3,
  "object-detection": snippetFile3,
  "image-segmentation": snippetFile3
};
function getJsInferenceSnippet(model, accessToken) {
  return model.pipeline_tag && model.pipeline_tag in jsSnippets ? jsSnippets[model.pipeline_tag]?.(model, accessToken) ?? { content: "" } : { content: "" };
}
function hasJsInferenceSnippet(model) {
  return !!model.pipeline_tag && model.pipeline_tag in jsSnippets;
}

// src/gguf.ts
var GGMLQuantizationType = /* @__PURE__ */ ((GGMLQuantizationType2) => {
  GGMLQuantizationType2[GGMLQuantizationType2["F32"] = 0] = "F32";
  GGMLQuantizationType2[GGMLQuantizationType2["F16"] = 1] = "F16";
  GGMLQuantizationType2[GGMLQuantizationType2["Q4_0"] = 2] = "Q4_0";
  GGMLQuantizationType2[GGMLQuantizationType2["Q4_1"] = 3] = "Q4_1";
  GGMLQuantizationType2[GGMLQuantizationType2["Q5_0"] = 6] = "Q5_0";
  GGMLQuantizationType2[GGMLQuantizationType2["Q5_1"] = 7] = "Q5_1";
  GGMLQuantizationType2[GGMLQuantizationType2["Q8_0"] = 8] = "Q8_0";
  GGMLQuantizationType2[GGMLQuantizationType2["Q8_1"] = 9] = "Q8_1";
  GGMLQuantizationType2[GGMLQuantizationType2["Q2_K"] = 10] = "Q2_K";
  GGMLQuantizationType2[GGMLQuantizationType2["Q3_K"] = 11] = "Q3_K";
  GGMLQuantizationType2[GGMLQuantizationType2["Q4_K"] = 12] = "Q4_K";
  GGMLQuantizationType2[GGMLQuantizationType2["Q5_K"] = 13] = "Q5_K";
  GGMLQuantizationType2[GGMLQuantizationType2["Q6_K"] = 14] = "Q6_K";
  GGMLQuantizationType2[GGMLQuantizationType2["Q8_K"] = 15] = "Q8_K";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ2_XXS"] = 16] = "IQ2_XXS";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ2_XS"] = 17] = "IQ2_XS";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ3_XXS"] = 18] = "IQ3_XXS";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ1_S"] = 19] = "IQ1_S";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ4_NL"] = 20] = "IQ4_NL";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ3_S"] = 21] = "IQ3_S";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ2_S"] = 22] = "IQ2_S";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ4_XS"] = 23] = "IQ4_XS";
  GGMLQuantizationType2[GGMLQuantizationType2["I8"] = 24] = "I8";
  GGMLQuantizationType2[GGMLQuantizationType2["I16"] = 25] = "I16";
  GGMLQuantizationType2[GGMLQuantizationType2["I32"] = 26] = "I32";
  GGMLQuantizationType2[GGMLQuantizationType2["I64"] = 27] = "I64";
  GGMLQuantizationType2[GGMLQuantizationType2["F64"] = 28] = "F64";
  GGMLQuantizationType2[GGMLQuantizationType2["IQ1_M"] = 29] = "IQ1_M";
  GGMLQuantizationType2[GGMLQuantizationType2["BF16"] = 30] = "BF16";
  return GGMLQuantizationType2;
})(GGMLQuantizationType || {});
var ggufQuants = Object.values(GGMLQuantizationType).filter((v) => typeof v === "string");
var GGUF_QUANT_RE = new RegExp(`(?<quant>${ggufQuants.join("|")})(_(?<sizeVariation>[A-Z]+))?`);
var GGUF_QUANT_RE_GLOBAL = new RegExp(GGUF_QUANT_RE, "g");
function parseGGUFQuantLabel(fname) {
  const quantLabel = fname.toUpperCase().match(GGUF_QUANT_RE_GLOBAL)?.at(-1);
  return quantLabel;
}

// src/hardware.ts
var TFLOPS_THRESHOLD_WHITE_HOUSE_MODEL_TRAINING_TOTAL = 10 ** 14;
var TFLOPS_THRESHOLD_WHITE_HOUSE_MODEL_TRAINING_TOTAL_BIOLOGY = 10 ** 11;
var TFLOPS_THRESHOLD_WHITE_HOUSE_CLUSTER = 10 ** 8;
var TFLOPS_THRESHOLD_EU_AI_ACT_MODEL_TRAINING_TOTAL = 10 ** 13;
var DEFAULT_MEMORY_OPTIONS = [8, 16, 24, 32, 40, 48, 64, 80, 96, 128, 256, 512];
var SKUS = {
  GPU: {
    NVIDIA: {
      H100: {
        tflops: 267.6,
        memory: [80]
      },
      L40: {
        tflops: 90.52,
        memory: [48]
      },
      "RTX 6000 Ada": {
        tflops: 91.1,
        memory: [48]
      },
      "RTX 5880 Ada": {
        tflops: 69.3,
        memory: [48]
      },
      "RTX 5000 Ada": {
        tflops: 65.3,
        memory: [32]
      },
      "RTX 4500 Ada": {
        tflops: 39.6,
        memory: [24]
      },
      "RTX 4000 Ada": {
        tflops: 26.7,
        memory: [20]
      },
      "RTX 4000 SFF Ada": {
        tflops: 19.2,
        memory: [20]
      },
      "RTX 2000 Ada": {
        tflops: 12,
        memory: [16]
      },
      "RTX A4000": {
        tflops: 19.2,
        memory: [16]
      },
      A100: {
        tflops: 77.97,
        memory: [80, 40]
      },
      A40: {
        tflops: 37.42,
        memory: [48]
      },
      A10: {
        tflops: 31.24,
        memory: [24]
      },
      A2: {
        tflops: 4.531,
        // source: https://www.techpowerup.com/gpu-specs/a2.c3848
        memory: [16]
      },
      "RTX 4090": {
        tflops: 82.58,
        memory: [24]
      },
      "RTX 4090D": {
        tflops: 79.49,
        memory: [24]
      },
      "RTX 4080 SUPER": {
        tflops: 52.2,
        memory: [16]
      },
      "RTX 4080": {
        tflops: 48.7,
        memory: [16]
      },
      "RTX 4070": {
        tflops: 29.15,
        memory: [12]
      },
      "RTX 4070 Ti": {
        tflops: 40.09,
        memory: [12]
      },
      "RTX 4070 Super": {
        tflops: 35.48,
        memory: [12]
      },
      "RTX 4070 Ti Super": {
        tflops: 44.1,
        memory: [16]
      },
      "RTX 4060": {
        tflops: 15.11,
        memory: [8]
      },
      "RTX 4060 Ti": {
        tflops: 22.06,
        memory: [8, 16]
      },
      "RTX 3090": {
        tflops: 35.58,
        memory: [24]
      },
      "RTX 3090 Ti": {
        tflops: 40,
        memory: [24]
      },
      "RTX 3080": {
        tflops: 30.6,
        memory: [12, 10]
      },
      "RTX 3080 Ti": {
        tflops: 34.1,
        memory: [12]
      },
      "RTX 3070": {
        tflops: 20.31,
        memory: [8]
      },
      "RTX 3070 Ti": {
        tflops: 21.75,
        memory: [8]
      },
      "RTX 3070 Ti Laptop": {
        tflops: 16.6,
        memory: [8]
      },
      "RTX 3060 Ti": {
        tflops: 16.2,
        memory: [8]
      },
      "RTX 3060": {
        tflops: 12.74,
        memory: [12, 8]
      },
      "RTX 2080 Ti": {
        tflops: 26.9,
        memory: [11]
      },
      "RTX 2080": {
        tflops: 20.14,
        memory: [8]
      },
      "RTX 2070": {
        tflops: 14.93,
        memory: [8]
      },
      "RTX 2070 SUPER Mobile": {
        tflops: 14.13,
        memory: [8]
      },
      "RTX 2070 SUPER": {
        tflops: 18.12,
        memory: [8]
      },
      "RTX 3050 Mobile": {
        tflops: 7.639,
        memory: [6]
      },
      "RTX 2060 Mobile": {
        tflops: 9.22,
        memory: [6]
      },
      "GTX 1080 Ti": {
        tflops: 11.34,
        // float32 (GPU does not support native float16)
        memory: [11]
      },
      "GTX 1070 Ti": {
        tflops: 8.2,
        // float32 (GPU does not support native float16)
        memory: [8]
      },
      "RTX Titan": {
        tflops: 32.62,
        memory: [24]
      },
      "GTX 1660": {
        tflops: 10.05,
        memory: [6]
      },
      "GTX 1650 Mobile": {
        tflops: 6.39,
        memory: [4]
      },
      T4: {
        tflops: 65.13,
        memory: [16]
      },
      V100: {
        tflops: 28.26,
        memory: [32, 16]
      },
      "Quadro P6000": {
        tflops: 12.63,
        // float32 (GPU does not support native float16)
        memory: [24]
      },
      P40: {
        tflops: 11.76,
        // float32 (GPU does not support native float16)
        memory: [24]
      }
    },
    AMD: {
      MI300: {
        tflops: 383,
        memory: [192]
      },
      MI250: {
        tflops: 362.1,
        memory: [128]
      },
      MI210: {
        tflops: 181,
        memory: [64]
      },
      MI100: {
        tflops: 184.6,
        memory: [32]
      },
      MI60: {
        tflops: 29.5,
        memory: [32]
      },
      MI50: {
        tflops: 26.5,
        memory: [16]
      },
      "RX 7900 XTX": {
        tflops: 122.8,
        memory: [24]
      },
      "RX 7900 XT": {
        tflops: 103,
        memory: [20]
      },
      "RX 7900 GRE": {
        tflops: 91.96,
        memory: [16]
      },
      "RX 7800 XT": {
        tflops: 74.65,
        memory: [16]
      },
      "RX 7700 XT": {
        tflops: 70.34,
        memory: [12]
      },
      "RX 7600 XT": {
        tflops: 45.14,
        memory: [16, 8]
      },
      "RX 6950 XT": {
        tflops: 47.31,
        memory: [16]
      },
      "RX 6800": {
        tflops: 32.33,
        memory: [16]
      },
      "RX 6700 XT": {
        tflops: 26.43,
        memory: [12]
      },
      "RX 6700": {
        tflops: 22.58,
        memory: [10]
      },
      "Radeon Pro VII": {
        tflops: 26.11,
        memory: [16]
      }
    },
    QUALCOMM: {
      "Snapdragon X Elite X1E-00-1DE": {
        tflops: 4.6
      },
      "Snapdragon X Elite X1E-84-100": {
        tflops: 4.6
      },
      "Snapdragon X Elite X1E-80-100": {
        tflops: 3.8
      },
      "Snapdragon X Elite X1E-78-100": {
        tflops: 3.8
      },
      "Snapdragon X Plus X1P-64-100": {
        tflops: 3.8
      }
    }
  },
  CPU: {
    Intel: {
      "Xeon 4th Generation (Sapphire Rapids)": {
        tflops: 1.3
      },
      "Xeon 3th Generation (Ice Lake)": {
        tflops: 0.8
      },
      "Xeon 2th Generation (Cascade Lake)": {
        tflops: 0.55
      },
      "Intel Core 13th Generation (i9)": {
        tflops: 0.85
      },
      "Intel Core 13th Generation (i7)": {
        tflops: 0.82
      },
      "Intel Core 13th Generation (i5)": {
        tflops: 0.68
      },
      "Intel Core 13th Generation (i3)": {
        tflops: 0.57
      },
      "Intel Core 12th Generation (i9)": {
        tflops: 0.79
      },
      "Intel Core 12th Generation (i7)": {
        tflops: 0.77
      },
      "Intel Core 12th Generation (i5)": {
        tflops: 0.65
      },
      "Intel Core 12th Generation (i3)": {
        tflops: 0.53
      },
      "Intel Core 11th Generation (i9)": {
        tflops: 0.7
      },
      "Intel Core 11th Generation (i7)": {
        tflops: 0.6
      },
      "Intel Core 11th Generation (i5)": {
        tflops: 0.5
      },
      "Intel Core 11th Generation (i3)": {
        tflops: 0.35
      },
      "Intel Core 10th Generation (i9)": {
        tflops: 0.46
      },
      "Intel Core 10th Generation (i7)": {
        tflops: 0.46
      },
      "Intel Core 10th Generation (i5)": {
        tflops: 0.46
      },
      "Intel Core 10th Generation (i3)": {
        tflops: 0.44
      }
    },
    AMD: {
      "EPYC 4th Generation (Genoa)": {
        tflops: 5
      },
      "EPYC 3th Generation (Milan)": {
        tflops: 2.4
      },
      "EPYC 2th Generation (Rome)": {
        tflops: 0.6
      },
      "EPYC 1st Generation (Naples)": {
        tflops: 0.6
      },
      "Ryzen Zen4 7000 (Ryzen 9)": {
        tflops: 0.56
      },
      "Ryzen Zen4 7000 (Ryzen 7)": {
        tflops: 0.56
      },
      "Ryzen Zen4 7000 (Ryzen 5)": {
        tflops: 0.56
      },
      "Ryzen Zen3 5000 (Ryzen 9)": {
        tflops: 1.33
      },
      "Ryzen Zen3 5000 (Ryzen 7)": {
        tflops: 1.33
      },
      "Ryzen Zen3 5000 (Ryzen 5)": {
        tflops: 0.72
      },
      "Ryzen Zen 2  3000 (Threadripper)": {
        tflops: 0.72
      },
      "Ryzen Zen 2  3000 (Ryzen 9)": {
        tflops: 0.72
      },
      "Ryzen Zen 2  3000 (Ryzen 7)": {
        tflops: 0.72
      },
      "Ryzen Zen 2  3000 (Ryzen 5)": {
        tflops: 0.72
      },
      "Ryzen Zen 2  3000 (Ryzen 3)": {
        tflops: 0.72
      }
    }
  },
  "Apple Silicon": {
    "-": {
      "Apple M1": {
        tflops: 2.6,
        memory: [8, 16]
      },
      "Apple M1 Pro": {
        tflops: 5.2,
        memory: [16, 24, 32]
      },
      "Apple M1 Max": {
        tflops: 10.4,
        memory: [16, 24, 32, 64]
      },
      "Apple M1 Ultra": {
        tflops: 21,
        memory: [16, 24, 32, 64, 96, 128]
      },
      "Apple M2": {
        tflops: 3.6,
        memory: [8, 16, 24]
      },
      "Apple M2 Pro": {
        tflops: 13.6,
        memory: [16, 24, 32]
      },
      "Apple M2 Max": {
        tflops: 13.49,
        memory: [32, 64, 96]
      },
      "Apple M2 Ultra": {
        tflops: 27.2,
        memory: [64, 96, 128, 192]
      },
      "Apple M3": {
        tflops: 2.84,
        memory: [8, 16, 24]
      },
      "Apple M3 Pro": {
        tflops: 14,
        memory: [18, 36]
      },
      "Apple M3 Max": {
        tflops: 14.2,
        memory: [36, 48, 64, 96, 128]
      }
    }
  }
};

// src/local-apps.ts
function isAwqModel(model) {
  return model.config?.quantization_config?.quant_method === "awq";
}
function isGptqModel(model) {
  return model.config?.quantization_config?.quant_method === "gptq";
}
function isAqlmModel(model) {
  return model.config?.quantization_config?.quant_method === "aqlm";
}
function isMarlinModel(model) {
  return model.config?.quantization_config?.quant_method === "marlin";
}
function isTransformersModel(model) {
  return model.tags.includes("transformers");
}
function isTgiModel(model) {
  return model.tags.includes("text-generation-inference");
}
function isLlamaCppGgufModel(model) {
  return !!model.gguf?.context_length;
}
function isMlxModel(model) {
  return model.tags.includes("mlx");
}
var snippetLlamacpp = (model, filepath) => {
  const command = (binary) => [
    "# Load and run the model:",
    `${binary} \\`,
    `  --hf-repo "${model.id}" \\`,
    `  --hf-file ${filepath ?? "{{GGUF_FILE}}"} \\`,
    '  -p "You are a helpful assistant" \\',
    "  --conversation"
  ].join("\n");
  return [
    {
      title: "Install from brew",
      setup: "brew install llama.cpp",
      content: command("llama-cli")
    },
    {
      title: "Use pre-built binary",
      setup: [
        // prettier-ignore
        "# Download pre-built binary from:",
        "# https://github.com/ggerganov/llama.cpp/releases"
      ].join("\n"),
      content: command("./llama-cli")
    },
    {
      title: "Build from source code",
      setup: [
        "git clone https://github.com/ggerganov/llama.cpp.git",
        "cd llama.cpp",
        "LLAMA_CURL=1 make llama-cli"
      ].join("\n"),
      content: command("./llama-cli")
    }
  ];
};
var snippetNodeLlamaCppCli = (model, filepath) => {
  return [
    {
      title: "Chat with the model",
      content: [
        `npx -y node-llama-cpp chat \\`,
        `  --model "hf:${model.id}/${filepath ?? "{{GGUF_FILE}}"}" \\`,
        `  --prompt 'Hi there!'`
      ].join("\n")
    },
    {
      title: "Estimate the model compatibility with your hardware",
      content: `npx -y node-llama-cpp inspect estimate "hf:${model.id}/${filepath ?? "{{GGUF_FILE}}"}"`
    }
  ];
};
var snippetOllama = (model, filepath) => {
  if (filepath) {
    const quantLabel = parseGGUFQuantLabel(filepath);
    const ollamatag = quantLabel ? `:${quantLabel}` : "";
    return `ollama run hf.co/${model.id}${ollamatag}`;
  }
  return `ollama run hf.co/${model.id}{{OLLAMA_TAG}}`;
};
var snippetLocalAI = (model, filepath) => {
  const command = (binary) => ["# Load and run the model:", `${binary} huggingface://${model.id}/${filepath ?? "{{GGUF_FILE}}"}`].join("\n");
  return [
    {
      title: "Install from binary",
      setup: "curl https://localai.io/install.sh | sh",
      content: command("local-ai run")
    },
    {
      title: "Use Docker images",
      setup: [
        // prettier-ignore
        "# Pull the image:",
        "docker pull localai/localai:latest-cpu"
      ].join("\n"),
      content: command(
        "docker run -p 8080:8080 --name localai -v $PWD/models:/build/models localai/localai:latest-cpu"
      )
    }
  ];
};
var snippetVllm = (model) => {
  const runCommand = [
    "# Call the server using curl:",
    `curl -X POST "http://localhost:8000/v1/chat/completions" \\`,
    `	-H "Content-Type: application/json" \\`,
    `	--data '{`,
    `		"model": "${model.id}",`,
    `		"messages": [`,
    `			{"role": "user", "content": "Hello!"}`,
    `		]`,
    `	}'`
  ];
  return [
    {
      title: "Install from pip",
      setup: ["# Install vLLM from pip:", "pip install vllm"].join("\n"),
      content: [`# Load and run the model:
vllm serve "${model.id}"`, runCommand.join("\n")]
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
        `	--model ${model.id}`
      ].join("\n"),
      content: [
        `# Load and run the model:
docker exec -it my_vllm_container bash -c "vllm serve ${model.id}"`,
        runCommand.join("\n")
      ]
    }
  ];
};
var snippetTgi = (model) => {
  const runCommand = [
    "# Call the server using curl:",
    `curl -X POST "http://localhost:8000/v1/chat/completions" \\`,
    `	-H "Content-Type: application/json" \\`,
    `	--data '{`,
    `		"model": "${model.id}",`,
    `		"messages": [`,
    `			{"role": "user", "content": "What is the capital of France?"}`,
    `		]`,
    `	}'`
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
        `	--model-id ${model.id}`
      ].join("\n"),
      content: [runCommand.join("\n")]
    }
  ];
};
var LOCAL_APPS = {
  "llama.cpp": {
    prettyLabel: "llama.cpp",
    docsUrl: "https://github.com/ggerganov/llama.cpp",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    snippet: snippetLlamacpp
  },
  "node-llama-cpp": {
    prettyLabel: "node-llama-cpp",
    docsUrl: "https://node-llama-cpp.withcat.ai",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    snippet: snippetNodeLlamaCppCli
  },
  vllm: {
    prettyLabel: "vLLM",
    docsUrl: "https://docs.vllm.ai",
    mainTask: "text-generation",
    displayOnModelPage: (model) => (isAwqModel(model) || isGptqModel(model) || isAqlmModel(model) || isMarlinModel(model) || isLlamaCppGgufModel(model) || isTransformersModel(model)) && (model.pipeline_tag === "text-generation" || model.pipeline_tag === "image-text-to-text"),
    snippet: snippetVllm
  },
  tgi: {
    prettyLabel: "TGI",
    docsUrl: "https://huggingface.co/docs/text-generation-inference/",
    mainTask: "text-generation",
    displayOnModelPage: isTgiModel,
    snippet: snippetTgi
  },
  lmstudio: {
    prettyLabel: "LM Studio",
    docsUrl: "https://lmstudio.ai",
    mainTask: "text-generation",
    displayOnModelPage: (model) => isLlamaCppGgufModel(model) || isMlxModel(model),
    deeplink: (model, filepath) => new URL(`lmstudio://open_from_hf?model=${model.id}${filepath ? `&file=${filepath}` : ""}`)
  },
  localai: {
    prettyLabel: "LocalAI",
    docsUrl: "https://github.com/mudler/LocalAI",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    snippet: snippetLocalAI
  },
  jan: {
    prettyLabel: "Jan",
    docsUrl: "https://jan.ai",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    deeplink: (model) => new URL(`jan://models/huggingface/${model.id}`)
  },
  backyard: {
    prettyLabel: "Backyard AI",
    docsUrl: "https://backyard.ai",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    deeplink: (model) => new URL(`https://backyard.ai/hf/model/${model.id}`)
  },
  sanctum: {
    prettyLabel: "Sanctum",
    docsUrl: "https://sanctum.ai",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    deeplink: (model) => new URL(`sanctum://open_from_hf?model=${model.id}`)
  },
  jellybox: {
    prettyLabel: "Jellybox",
    docsUrl: "https://jellybox.com",
    mainTask: "text-generation",
    displayOnModelPage: (model) => isLlamaCppGgufModel(model) || model.library_name === "diffusers" && model.tags.includes("safetensors") && (model.pipeline_tag === "text-to-image" || model.tags.includes("lora")),
    deeplink: (model) => {
      if (isLlamaCppGgufModel(model)) {
        return new URL(`jellybox://llm/models/huggingface/LLM/${model.id}`);
      } else if (model.tags.includes("lora")) {
        return new URL(`jellybox://image/models/huggingface/ImageLora/${model.id}`);
      } else {
        return new URL(`jellybox://image/models/huggingface/Image/${model.id}`);
      }
    }
  },
  msty: {
    prettyLabel: "Msty",
    docsUrl: "https://msty.app",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    deeplink: (model) => new URL(`msty://models/search/hf/${model.id}`)
  },
  recursechat: {
    prettyLabel: "RecurseChat",
    docsUrl: "https://recurse.chat",
    mainTask: "text-generation",
    macOSOnly: true,
    displayOnModelPage: isLlamaCppGgufModel,
    deeplink: (model) => new URL(`recursechat://new-hf-gguf-model?hf-model-id=${model.id}`)
  },
  drawthings: {
    prettyLabel: "Draw Things",
    docsUrl: "https://drawthings.ai",
    mainTask: "text-to-image",
    macOSOnly: true,
    displayOnModelPage: (model) => model.library_name === "diffusers" && (model.pipeline_tag === "text-to-image" || model.tags.includes("lora")),
    deeplink: (model) => {
      if (model.tags.includes("lora")) {
        return new URL(`https://drawthings.ai/import/diffusers/pipeline.load_lora_weights?repo_id=${model.id}`);
      } else {
        return new URL(`https://drawthings.ai/import/diffusers/pipeline.from_pretrained?repo_id=${model.id}`);
      }
    }
  },
  diffusionbee: {
    prettyLabel: "DiffusionBee",
    docsUrl: "https://diffusionbee.com",
    mainTask: "text-to-image",
    macOSOnly: true,
    displayOnModelPage: (model) => model.library_name === "diffusers" && model.pipeline_tag === "text-to-image",
    deeplink: (model) => new URL(`https://diffusionbee.com/huggingface_import?model_id=${model.id}`)
  },
  joyfusion: {
    prettyLabel: "JoyFusion",
    docsUrl: "https://joyfusion.app",
    mainTask: "text-to-image",
    macOSOnly: true,
    displayOnModelPage: (model) => model.tags.includes("coreml") && model.tags.includes("joyfusion") && model.pipeline_tag === "text-to-image",
    deeplink: (model) => new URL(`https://joyfusion.app/import_from_hf?repo_id=${model.id}`)
  },
  invoke: {
    prettyLabel: "Invoke",
    docsUrl: "https://github.com/invoke-ai/InvokeAI",
    mainTask: "text-to-image",
    displayOnModelPage: (model) => model.library_name === "diffusers" && model.pipeline_tag === "text-to-image",
    deeplink: (model) => new URL(`https://models.invoke.ai/huggingface/${model.id}`)
  },
  ollama: {
    prettyLabel: "Ollama",
    docsUrl: "https://ollama.com",
    mainTask: "text-generation",
    displayOnModelPage: isLlamaCppGgufModel,
    snippet: snippetOllama
  }
};

// src/dataset-libraries.ts
var DATASET_LIBRARIES_UI_ELEMENTS = {
  mlcroissant: {
    prettyLabel: "Croissant",
    repoName: "croissant",
    repoUrl: "https://github.com/mlcommons/croissant/tree/main/python/mlcroissant",
    docsUrl: "https://huggingface.co/docs/dataset-viewer/mlcroissant"
  },
  webdataset: {
    prettyLabel: "WebDataset",
    repoName: "webdataset",
    repoUrl: "https://github.com/webdataset/webdataset",
    docsUrl: "https://huggingface.co/docs/hub/datasets-webdataset"
  },
  datasets: {
    prettyLabel: "Datasets",
    repoName: "datasets",
    repoUrl: "https://github.com/huggingface/datasets",
    docsUrl: "https://huggingface.co/docs/hub/datasets-usage"
  },
  pandas: {
    prettyLabel: "pandas",
    repoName: "pandas",
    repoUrl: "https://github.com/pandas-dev/pandas",
    docsUrl: "https://huggingface.co/docs/hub/datasets-pandas"
  },
  dask: {
    prettyLabel: "Dask",
    repoName: "dask",
    repoUrl: "https://github.com/dask/dask",
    docsUrl: "https://huggingface.co/docs/hub/datasets-dask"
  },
  distilabel: {
    prettyLabel: "Distilabel",
    repoName: "distilabel",
    repoUrl: "https://github.com/argilla-io/distilabel",
    docsUrl: "https://huggingface.co/docs/hub/datasets-distilabel"
  },
  fiftyone: {
    prettyLabel: "FiftyOne",
    repoName: "fiftyone",
    repoUrl: "https://github.com/voxel51/fiftyone",
    docsUrl: "https://huggingface.co/docs/hub/datasets-fiftyone"
  },
  argilla: {
    prettyLabel: "Argilla",
    repoName: "argilla",
    repoUrl: "https://github.com/argilla-io/argilla",
    docsUrl: "https://huggingface.co/docs/hub/datasets-argilla"
  },
  polars: {
    prettyLabel: "Polars",
    repoName: "polars",
    repoUrl: "https://github.com/pola-rs/polars",
    docsUrl: "https://huggingface.co/docs/hub/datasets-polars"
  },
  duckdb: {
    prettyLabel: "DuckDB",
    repoName: "duckdb",
    repoUrl: "https://github.com/duckdb/duckdb",
    docsUrl: "https://huggingface.co/docs/hub/datasets-duckdb"
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALL_DISPLAY_MODEL_LIBRARY_KEYS,
  ALL_MODEL_LIBRARY_KEYS,
  DATASET_LIBRARIES_UI_ELEMENTS,
  DEFAULT_MEMORY_OPTIONS,
  GGMLQuantizationType,
  GGUF_QUANT_RE,
  GGUF_QUANT_RE_GLOBAL,
  LIBRARY_TASK_MAPPING,
  LOCAL_APPS,
  MAPPING_DEFAULT_WIDGET,
  MODALITIES,
  MODALITY_LABELS,
  MODEL_LIBRARIES_UI_ELEMENTS,
  PIPELINE_DATA,
  PIPELINE_TYPES,
  PIPELINE_TYPES_SET,
  SKUS,
  SPECIAL_TOKENS_ATTRIBUTES,
  SUBTASK_TYPES,
  TASKS_DATA,
  TASKS_MODEL_LIBRARIES,
  parseGGUFQuantLabel,
  snippets
});
