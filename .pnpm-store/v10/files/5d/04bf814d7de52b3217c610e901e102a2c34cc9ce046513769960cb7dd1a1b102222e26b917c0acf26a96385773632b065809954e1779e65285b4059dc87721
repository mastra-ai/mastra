use crate::decoders::Decoder;
use crate::encoding::{JsEncoding, JsTruncationDirection, JsTruncationStrategy};
use crate::models::Model;
use crate::normalizers::Normalizer;
use crate::pre_tokenizers::PreTokenizer;
use crate::processors::Processor;
use crate::tasks::tokenizer::{DecodeBatchTask, DecodeTask, EncodeBatchTask, EncodeTask};
use crate::trainers::Trainer;
use std::collections::HashMap;
use tokenizers::Model as ModelTrait;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::{Arc, RwLock};
use tokenizers as tk;

#[napi]
#[derive(Default)]
pub enum PaddingDirection {
  #[default]
  Left,
  Right,
}

impl From<PaddingDirection> for tk::PaddingDirection {
  fn from(w: PaddingDirection) -> Self {
    match w {
      PaddingDirection::Left => tk::PaddingDirection::Left,
      PaddingDirection::Right => tk::PaddingDirection::Right,
    }
  }
}

impl TryFrom<String> for PaddingDirection {
  type Error = Error;
  fn try_from(w: String) -> Result<Self> {
    match w.as_str() {
      "left" => Ok(PaddingDirection::Left),
      "right" => Ok(PaddingDirection::Right),
      s => Err(Error::from_reason(format!(
        "{s:?} is not a valid direction"
      ))),
    }
  }
}

#[napi(object)]
#[derive(Default)]
pub struct PaddingOptions {
  pub max_length: Option<u32>,
  pub direction: Option<Either<String, PaddingDirection>>,
  pub pad_to_multiple_of: Option<u32>,
  pub pad_id: Option<u32>,
  pub pad_type_id: Option<u32>,
  pub pad_token: Option<String>,
}

impl TryFrom<PaddingOptions> for tk::PaddingParams {
  type Error = Error;
  fn try_from(value: PaddingOptions) -> Result<Self> {
    let direction = match value.direction {
      Some(either) => match either {
        Either::A(string) => {
          let direction: PaddingDirection = string.try_into()?;
          direction.into()
        }
        Either::B(direction) => direction.into(),
      },
      None => tk::PaddingDirection::Right,
    };
    Ok(Self {
      pad_to_multiple_of: value.pad_to_multiple_of.map(|s| s as usize),
      pad_id: value.pad_id.unwrap_or_default(),
      pad_type_id: value.pad_type_id.unwrap_or_default(),
      pad_token: value.pad_token.unwrap_or("[PAD]".to_string()),
      direction,
      strategy: match value.max_length {
        Some(length) => tk::PaddingStrategy::Fixed(length as usize),
        None => tk::PaddingStrategy::BatchLongest,
      },
    })
  }
}

#[napi(object)]
#[derive(Default)]
pub struct EncodeOptions {
  pub is_pretokenized: Option<bool>,
  pub add_special_tokens: Option<bool>,
}

#[derive(Default)]
struct EncodeOptionsDef {
  // TODO
  // is_pretokenized: bool,
  add_special_tokens: bool,
}

impl From<EncodeOptions> for EncodeOptionsDef {
  fn from(value: EncodeOptions) -> Self {
    EncodeOptionsDef {
      // TODO
      // is_pretokenized: value.is_pretokenized.unwrap_or(false),
      add_special_tokens: value.add_special_tokens.unwrap_or(true),
    }
  }
}

#[napi(object)]
#[derive(Default)]
pub struct TruncationOptions {
  pub max_length: Option<u32>,
  pub strategy: Option<JsTruncationStrategy>,
  pub direction: Option<Either<String, JsTruncationDirection>>,
  pub stride: Option<u32>,
}

impl TryFrom<TruncationOptions> for tk::TruncationParams {
  type Error = Error;
  fn try_from(value: TruncationOptions) -> Result<Self> {
    let direction = match value.direction {
      Some(either) => match either {
        Either::A(string) => {
          let direction: JsTruncationDirection = string.try_into()?;
          direction.into()
        }
        Either::B(direction) => direction.into(),
      },
      None => Default::default(),
    };
    Ok(Self {
      max_length: value.max_length.unwrap_or(0) as usize,
      strategy: value.strategy.map(|s| s.into()).unwrap_or_default(),
      direction,
      stride: value.stride.unwrap_or_default() as usize,
    })
  }
}

#[napi(object)]
pub struct AddedTokenOptions {
  pub single_word: Option<bool>,
  pub left_strip: Option<bool>,
  pub right_strip: Option<bool>,
  pub normalized: Option<bool>,
}

#[napi]
#[derive(Clone)]
pub struct AddedToken {
  token: tk::AddedToken,
}

#[napi]
impl AddedToken {
  #[napi(constructor)]
  pub fn from(token: String, is_special: bool, options: Option<AddedTokenOptions>) -> Self {
    let mut token = tk::AddedToken::from(token, is_special);
    if let Some(options) = options {
      if let Some(sw) = options.single_word {
        token = token.single_word(sw);
      }
      if let Some(ls) = options.left_strip {
        token = token.lstrip(ls);
      }
      if let Some(rs) = options.right_strip {
        token = token.rstrip(rs);
      }
      if let Some(n) = options.normalized {
        token = token.normalized(n);
      }
    }
    Self { token }
  }

  #[napi]
  pub fn get_content(&self) -> String {
    self.token.content.clone()
  }
}

impl From<AddedToken> for tk::AddedToken {
  fn from(v: AddedToken) -> Self {
    v.token
  }
}

type RsTokenizer = tk::TokenizerImpl<Model, Normalizer, PreTokenizer, Processor, Decoder>;

#[napi]
#[derive(Clone)]
pub struct Tokenizer {
  pub(crate) tokenizer: Arc<RwLock<RsTokenizer>>,
}

#[napi]
impl Tokenizer {
  #[napi(constructor)]
  pub fn new(model: &Model) -> Self {
    Self {
      tokenizer: Arc::new(RwLock::new(tk::TokenizerImpl::new((*model).clone()))),
    }
  }

  #[napi]
  pub fn set_pre_tokenizer(&mut self, pre_tokenizer: &PreTokenizer) {
    self
      .tokenizer
      .write()
      .unwrap()
      .with_pre_tokenizer((*pre_tokenizer).clone());
  }

  #[napi]
  pub fn set_decoder(&mut self, decoder: &Decoder) {
    self
      .tokenizer
      .write()
      .unwrap()
      .with_decoder((*decoder).clone());
  }

  #[napi]
  pub fn set_model(&mut self, model: &Model) {
    self.tokenizer.write().unwrap().with_model((*model).clone());
  }

  #[napi]
  pub fn set_post_processor(&mut self, post_processor: &Processor) {
    self
      .tokenizer
      .write()
      .unwrap()
      .with_post_processor((*post_processor).clone());
  }

  #[napi]
  pub fn set_normalizer(&mut self, normalizer: &Normalizer) {
    self
      .tokenizer
      .write()
      .unwrap()
      .with_normalizer((*normalizer).clone());
  }

  #[napi]
  pub fn save(&self, path: String, pretty: Option<bool>) -> Result<()> {
    let pretty = pretty.unwrap_or(false);
    self
      .tokenizer
      .read()
      .unwrap()
      .save(path, pretty)
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  #[napi]
  pub fn add_added_tokens(&mut self, tokens: Vec<&AddedToken>) -> u32 {
    let tokens: Vec<_> = tokens
      .into_iter()
      .map(|tok| (*tok).clone().into())
      .collect();
    self.tokenizer.write().unwrap().add_tokens(&tokens) as u32
  }

  #[napi]
  pub fn add_tokens(&mut self, tokens: Vec<String>) -> u32 {
    let tokens: Vec<_> = tokens
      .into_iter()
      .map(|tok| tk::AddedToken::from(tok, false))
      .collect();
    self.tokenizer.write().unwrap().add_tokens(&tokens) as u32
  }

  #[napi(ts_return_type = "Promise<JsEncoding>")]
  pub fn encode(
    &self,
    #[napi(ts_arg_type = "InputSequence")] sentence: String,
    #[napi(ts_arg_type = "InputSequence | null")] pair: Option<String>,
    encode_options: Option<EncodeOptions>,
  ) -> AsyncTask<EncodeTask<'static>> {
    let options: EncodeOptionsDef = encode_options.unwrap_or_default().into();
    let input: tk::EncodeInput = match pair {
      Some(pair) => (sentence, pair).into(),
      None => sentence.into(),
    };

    AsyncTask::new(EncodeTask {
      tokenizer: (*self).clone(),
      input: Some(input),
      add_special_tokens: options.add_special_tokens,
    })
  }

  #[napi(ts_return_type = "Promise<JsEncoding[]>")]
  pub fn encode_batch(
    &self,
    #[napi(ts_arg_type = "EncodeInput[]")] sentences: Vec<String>,
    encode_options: Option<EncodeOptions>,
  ) -> AsyncTask<EncodeBatchTask<'static>> {
    let options: EncodeOptionsDef = encode_options.unwrap_or_default().into();
    let inputs: Vec<tk::EncodeInput> = sentences
      .into_iter()
      .map(|sentence| sentence.into())
      .collect();

    AsyncTask::new(EncodeBatchTask {
      tokenizer: (*self).clone(),
      inputs: Some(inputs),
      add_special_tokens: options.add_special_tokens,
    })
  }

  #[napi(ts_return_type = "Promise<string>")]
  pub fn decode(&self, ids: Vec<u32>, skip_special_tokens: bool) -> AsyncTask<DecodeTask> {
    AsyncTask::new(DecodeTask {
      tokenizer: (*self).clone(),
      ids,
      skip_special_tokens,
    })
  }

  #[napi(ts_return_type = "Promise<string[]>")]
  pub fn decode_batch(
    &self,
    ids: Vec<Vec<u32>>,
    skip_special_tokens: bool,
  ) -> AsyncTask<DecodeBatchTask> {
    AsyncTask::new(DecodeBatchTask {
      tokenizer: (*self).clone(),
      ids,
      skip_special_tokens,
    })
  }

  #[napi(factory)]
  pub fn from_string(s: String) -> Result<Self> {
    let tokenizer: tk::tokenizer::TokenizerImpl<
      Model,
      Normalizer,
      PreTokenizer,
      Processor,
      Decoder,
    > = s
      .parse()
      .map_err(|e| Error::from_reason(format!("{}", e)))?;
    Ok(Self {
      tokenizer: Arc::new(RwLock::new(tokenizer)),
    })
  }

  #[napi(factory)]
  pub fn from_file(file: String) -> Result<Self> {
    let tokenizer = tk::tokenizer::TokenizerImpl::from_file(file)
      .map_err(|e| Error::from_reason(format!("Error loading from file{}", e)))?;
    Ok(Self {
      tokenizer: Arc::new(RwLock::new(tokenizer)),
    })
  }

  #[napi]
  pub fn add_special_tokens(&mut self, tokens: Vec<String>) {
    let tokens: Vec<_> = tokens
      .into_iter()
      .map(|s| tk::AddedToken::from(s, true))
      .collect();
    self.tokenizer.write().unwrap().add_special_tokens(&tokens);
  }

  #[napi]
  pub fn set_truncation(
    &mut self,
    max_length: u32,
    options: Option<TruncationOptions>,
  ) -> Result<()> {
    let mut options: tk::TruncationParams = if let Some(options) = options {
      options.try_into()?
    } else {
      Default::default()
    };
    options.max_length = max_length as usize;
    self
      .tokenizer
      .write()
      .unwrap()
      .with_truncation(Some(options))
      .unwrap();
    Ok(())
  }

  #[napi]
  pub fn disable_truncation(&mut self) {
    self
      .tokenizer
      .write()
      .unwrap()
      .with_truncation(None)
      .unwrap();
  }

  #[napi]
  pub fn set_padding(&mut self, options: Option<PaddingOptions>) -> Result<()> {
    let options = if let Some(options) = options {
      Some(options.try_into()?)
    } else {
      None
    };
    self.tokenizer.write().unwrap().with_padding(options);
    Ok(())
  }

  #[napi]
  pub fn disable_padding(&mut self) {
    self.tokenizer.write().unwrap().with_padding(None);
  }

  #[napi]
  pub fn get_decoder(&self) -> Option<Decoder> {
    self.tokenizer.read().unwrap().get_decoder().cloned()
  }

  #[napi]
  pub fn get_normalizer(&self) -> Option<Normalizer> {
    self.tokenizer.read().unwrap().get_normalizer().cloned()
  }
  #[napi]
  pub fn get_pre_tokenizer(&self) -> Option<PreTokenizer> {
    self.tokenizer.read().unwrap().get_pre_tokenizer().cloned()
  }
  #[napi]
  pub fn get_post_processor(&self) -> Option<Processor> {
    self.tokenizer.read().unwrap().get_post_processor().cloned()
  }

  #[napi]
  pub fn get_vocab(&self, with_added_tokens: Option<bool>) -> HashMap<String, u32> {
    let with_added_tokens = with_added_tokens.unwrap_or(true);
    self.tokenizer.read().unwrap().get_vocab(with_added_tokens)
  }

  #[napi]
  pub fn get_vocab_size(&self, with_added_tokens: Option<bool>) -> u32 {
    self.get_vocab(with_added_tokens).len() as u32
  }

  #[napi]
  pub fn id_to_token(&self, id: u32) -> Option<String> {
    self.tokenizer.read().unwrap().id_to_token(id)
  }

  #[napi]
  pub fn token_to_id(&self, token: String) -> Option<u32> {
    self.tokenizer.read().unwrap().token_to_id(&token)
  }

  #[napi]
  pub fn train(&mut self, files: Vec<String>) -> Result<()> {
    let mut trainer: Trainer = self
      .tokenizer
      .read()
      .unwrap()
      .get_model()
      .model
      .as_ref()
      .unwrap()
      .read()
      .unwrap()
      .get_trainer()
      .into();
    self
      .tokenizer
      .write()
      .unwrap()
      .train_from_files(&mut trainer, files)
      .map_err(|e| Error::from_reason(format!("{}", e)))?;
    Ok(())
  }

  #[napi]
  pub fn running_tasks(&self) -> u32 {
    std::sync::Arc::strong_count(&self.tokenizer) as u32
  }

  #[napi]
  pub fn post_process(
    &self,
    encoding: &JsEncoding,
    pair: Option<&JsEncoding>,
    add_special_tokens: Option<bool>,
  ) -> Result<JsEncoding> {
    let add_special_tokens = add_special_tokens.unwrap_or(true);

    Ok(
      self
        .tokenizer
        .read()
        .unwrap()
        .post_process(
          (*encoding).clone().try_into()?,
          if let Some(pair) = pair {
            Some((*pair).clone().try_into()?)
          } else {
            None
          },
          add_special_tokens,
        )
        .map_err(|e| Error::from_reason(format!("{}", e)))?
        .into(),
    )
  }
}

#[napi(object)]
#[derive(Default)]
pub struct JsFromPretrainedParameters {
  pub revision: Option<String>,
  pub auth_token: Option<String>,
}
