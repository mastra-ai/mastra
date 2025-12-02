extern crate tokenizers as tk;

use crate::encoding::*;
use crate::tokenizer::Tokenizer;
use napi::bindgen_prelude::*;
use tk::tokenizer::{EncodeInput, Encoding};

pub struct EncodeTask<'s> {
  pub tokenizer: Tokenizer,
  pub input: Option<EncodeInput<'s>>,
  pub add_special_tokens: bool,
}

impl Task for EncodeTask<'static> {
  type Output = Encoding;
  type JsValue = JsEncoding;

  fn compute(&mut self) -> Result<Self::Output> {
    self
      .tokenizer
      .tokenizer
      .read()
      .unwrap()
      .encode_char_offsets(
        self
          .input
          .take()
          .ok_or(Error::from_reason("No provided input"))?,
        self.add_special_tokens,
      )
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(JsEncoding {
      encoding: Some(output),
    })
  }
}

pub struct DecodeTask {
  pub tokenizer: Tokenizer,
  pub ids: Vec<u32>,
  pub skip_special_tokens: bool,
}

impl Task for DecodeTask {
  type Output = String;
  type JsValue = String;

  fn compute(&mut self) -> Result<Self::Output> {
    self
      .tokenizer
      .tokenizer
      .read()
      .unwrap()
      .decode(&self.ids, self.skip_special_tokens)
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}
pub struct EncodeBatchTask<'s> {
  pub tokenizer: Tokenizer,
  pub inputs: Option<Vec<EncodeInput<'s>>>,
  pub add_special_tokens: bool,
}

impl Task for EncodeBatchTask<'static> {
  type Output = Vec<Encoding>;
  type JsValue = Vec<JsEncoding>;

  fn compute(&mut self) -> Result<Self::Output> {
    self
      .tokenizer
      .tokenizer
      .read()
      .unwrap()
      .encode_batch_char_offsets(
        self
          .inputs
          .take()
          .ok_or(Error::from_reason("No provided input"))?,
        self.add_special_tokens,
      )
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(
      output
        .into_iter()
        .map(|encoding| JsEncoding {
          encoding: Some(encoding),
        })
        .collect(),
    )
  }
}

pub struct DecodeBatchTask {
  pub tokenizer: Tokenizer,
  pub ids: Vec<Vec<u32>>,
  pub skip_special_tokens: bool,
}

impl Task for DecodeBatchTask {
  type Output = Vec<String>;
  type JsValue = Vec<String>;

  fn compute(&mut self) -> Result<Self::Output> {
    let ids: Vec<_> = self.ids.iter().map(|s| s.as_slice()).collect();
    self
      .tokenizer
      .tokenizer
      .read()
      .unwrap()
      .decode_batch(&ids, self.skip_special_tokens)
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}
