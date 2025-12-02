use crate::arc_rwlock_serde;
use crate::tasks::models::{BPEFromFilesTask, WordLevelFromFilesTask, WordPieceFromFilesTask};
use crate::trainers::Trainer;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tokenizers as tk;
use tokenizers::models::bpe::{BpeBuilder, Merges, Vocab};
use tokenizers::models::wordlevel::WordLevelBuilder;
use tokenizers::models::wordpiece::WordPieceBuilder;

#[napi]
#[derive(Clone, Serialize, Deserialize)]
pub struct Model {
  #[serde(flatten, with = "arc_rwlock_serde")]
  pub(crate) model: Option<Arc<RwLock<tk::models::ModelWrapper>>>,
}

impl<M> From<M> for Model
where
  M: Into<tk::models::ModelWrapper>,
{
  fn from(wrapper: M) -> Self {
    Self {
      model: Some(Arc::new(RwLock::new(wrapper.into()))),
    }
  }
}

#[napi(js_name = "BPE")]
pub struct Bpe {}

#[napi]
impl Bpe {
  #[napi(factory, ts_return_type = "Model")]
  pub fn empty() -> Result<Model> {
    let bpe = tk::models::bpe::BPE::default();
    Ok(Model {
      model: Some(Arc::new(RwLock::new(bpe.into()))),
    })
  }

  #[napi(factory, ts_return_type = "Model")]
  pub fn init(vocab: Vocab, merges: Merges, options: Option<BpeOptions>) -> Result<Model> {
    let options = options.unwrap_or_default();
    let mut builder = tk::models::bpe::BPE::builder().vocab_and_merges(vocab, merges);
    builder = options.apply_to_bpe_builder(builder);
    let model = builder
      .build()
      .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(Model {
      model: Some(Arc::new(RwLock::new(model.into()))),
    })
  }

  #[napi(ts_return_type = "Promise<Model>")]
  pub fn from_file(
    vocab: String,
    merges: String,
    options: Option<BpeOptions>,
  ) -> AsyncTask<BPEFromFilesTask> {
    let options = options.unwrap_or_default();
    let mut builder = tk::models::bpe::BPE::from_file(&vocab, &merges);

    builder = options.apply_to_bpe_builder(builder);

    AsyncTask::new(BPEFromFilesTask {
      builder: Some(builder),
    })
  }
}

impl tk::Model for Model {
  type Trainer = Trainer;

  fn tokenize(&self, sequence: &str) -> tk::Result<Vec<tk::Token>> {
    self
      .model
      .as_ref()
      .ok_or("Uninitialized Model")?
      .read()
      .unwrap()
      .tokenize(sequence)
  }

  fn token_to_id(&self, token: &str) -> Option<u32> {
    self.model.as_ref()?.read().unwrap().token_to_id(token)
  }

  fn id_to_token(&self, id: u32) -> Option<String> {
    self.model.as_ref()?.read().unwrap().id_to_token(id)
  }

  fn get_vocab(&self) -> HashMap<String, u32> {
    self
      .model
      .as_ref()
      .expect("Uninitialized Model")
      .read()
      .unwrap()
      .get_vocab()
  }

  fn get_vocab_size(&self) -> usize {
    self
      .model
      .as_ref()
      .expect("Uninitialized Model")
      .read()
      .unwrap()
      .get_vocab_size()
  }

  fn save(&self, folder: &Path, name: Option<&str>) -> tk::Result<Vec<PathBuf>> {
    self
      .model
      .as_ref()
      .ok_or("Uninitialized Model")?
      .read()
      .unwrap()
      .save(folder, name)
  }

  fn get_trainer(&self) -> Self::Trainer {
    self
      .model
      .as_ref()
      .expect("Uninitialized Model")
      .read()
      .unwrap()
      .get_trainer()
      .into()
  }
}

#[derive(Default)]
#[napi(object)]
pub struct BpeOptions {
  pub cache_capacity: Option<u32>,
  pub dropout: Option<f64>,
  pub unk_token: Option<String>,
  pub continuing_subword_prefix: Option<String>,
  pub end_of_word_suffix: Option<String>,
  pub fuse_unk: Option<bool>,
  pub byte_fallback: Option<bool>,
}
impl BpeOptions {
  fn apply_to_bpe_builder(self, mut builder: BpeBuilder) -> BpeBuilder {
    if let Some(cache_capacity) = self.cache_capacity {
      builder = builder.cache_capacity(cache_capacity as usize);
    }
    if let Some(dropout) = self.dropout {
      builder = builder.dropout(dropout as f32);
    }
    if let Some(unk_token) = self.unk_token {
      builder = builder.unk_token(unk_token);
    }
    if let Some(continuing_subword_prefix) = self.continuing_subword_prefix {
      builder = builder.continuing_subword_prefix(continuing_subword_prefix);
    }
    if let Some(end_of_word_suffix) = self.end_of_word_suffix {
      builder = builder.end_of_word_suffix(end_of_word_suffix);
    }
    if let Some(fuse_unk) = self.fuse_unk {
      builder = builder.fuse_unk(fuse_unk);
    }
    if let Some(byte_fallback) = self.byte_fallback {
      builder = builder.byte_fallback(byte_fallback);
    }

    builder
  }
}

#[derive(Default)]
#[napi(object)]
pub struct WordPieceOptions {
  pub unk_token: Option<String>,
  pub continuing_subword_prefix: Option<String>,
  pub max_input_chars_per_word: Option<u32>,
}

impl WordPieceOptions {
  fn apply_to_wordpiece_builder(self, mut builder: WordPieceBuilder) -> WordPieceBuilder {
    if let Some(token) = self.unk_token {
      builder = builder.unk_token(token);
    }
    if let Some(prefix) = self.continuing_subword_prefix {
      builder = builder.continuing_subword_prefix(prefix);
    }
    if let Some(max) = self.max_input_chars_per_word {
      builder = builder.max_input_chars_per_word(max as usize);
    }

    builder
  }
}

#[napi]
pub struct WordPiece {}

#[napi]
impl WordPiece {
  #[napi(factory, ts_return_type = "Model")]
  pub fn init(vocab: Vocab, options: Option<WordPieceOptions>) -> Result<Model> {
    let options = options.unwrap_or_default();

    let mut builder = tk::models::wordpiece::WordPiece::builder().vocab(vocab);
    builder = options.apply_to_wordpiece_builder(builder);
    let model = builder
      .build()
      .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(Model {
      model: Some(Arc::new(RwLock::new(model.into()))),
    })
  }

  #[napi(factory)]
  pub fn empty() -> Model {
    let wordpiece = tk::models::wordpiece::WordPiece::default();
    Model {
      model: Some(Arc::new(RwLock::new(wordpiece.into()))),
    }
  }

  #[napi(ts_return_type = "Promise<Model>")]
  pub fn from_file(
    vocab: String,
    options: Option<WordPieceOptions>,
  ) -> AsyncTask<WordPieceFromFilesTask> {
    let options = options.unwrap_or_default();
    let mut builder = tk::models::wordpiece::WordPiece::from_file(&vocab);
    builder = options.apply_to_wordpiece_builder(builder);
    AsyncTask::new(WordPieceFromFilesTask {
      builder: Some(builder),
    })
  }
}

#[derive(Default)]
#[napi(object)]
pub struct WordLevelOptions {
  pub unk_token: Option<String>,
}
impl WordLevelOptions {
  fn apply_to_wordlevel_builder(self, mut builder: WordLevelBuilder) -> WordLevelBuilder {
    if let Some(token) = self.unk_token {
      builder = builder.unk_token(token);
    }

    builder
  }
}

#[napi]
pub struct WordLevel {}

#[napi]
impl WordLevel {
  #[napi(factory, ts_return_type = "Model")]
  pub fn init(vocab: Vocab, options: Option<WordLevelOptions>) -> Result<Model> {
    let options = options.unwrap_or_default();
    let mut builder = tk::models::wordlevel::WordLevel::builder().vocab(vocab);
    builder = options.apply_to_wordlevel_builder(builder);
    let model = builder
      .build()
      .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(Model {
      model: Some(Arc::new(RwLock::new(model.into()))),
    })
  }

  #[napi(factory)]
  pub fn empty() -> Model {
    let wordlevel = tk::models::wordlevel::WordLevel::default();
    Model {
      model: Some(Arc::new(RwLock::new(wordlevel.into()))),
    }
  }

  #[napi(ts_return_type = "Promise<Model>")]
  pub fn from_file(
    vocab: String,
    options: Option<WordLevelOptions>,
  ) -> AsyncTask<WordLevelFromFilesTask> {
    let options = options.unwrap_or_default();
    let mut builder = tk::models::wordlevel::WordLevel::builder().files(vocab);
    builder = options.apply_to_wordlevel_builder(builder);
    AsyncTask::new(WordLevelFromFilesTask {
      builder: Some(builder),
    })
  }
}

#[derive(Default)]
#[napi(object)]
pub struct UnigramOptions {
  pub unk_id: Option<u32>,
  pub byte_fallback: Option<bool>,
}

#[napi]
pub struct Unigram {}

#[napi]
impl Unigram {
  #[napi(factory, ts_return_type = "Model")]
  pub fn init(vocab: Vec<(String, f64)>, options: Option<UnigramOptions>) -> Result<Model> {
    let options = options.unwrap_or_default();

    let unigram = tk::models::unigram::Unigram::from(
      vocab,
      options.unk_id.map(|u| u as usize),
      options.byte_fallback.unwrap_or(false),
    )
    .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(Model {
      model: Some(Arc::new(RwLock::new(unigram.into()))),
    })
  }

  #[napi(factory, ts_return_type = "Model")]
  pub fn empty() -> Model {
    let unigram = tk::models::unigram::Unigram::default();
    Model {
      model: Some(Arc::new(RwLock::new(unigram.into()))),
    }
  }
}
