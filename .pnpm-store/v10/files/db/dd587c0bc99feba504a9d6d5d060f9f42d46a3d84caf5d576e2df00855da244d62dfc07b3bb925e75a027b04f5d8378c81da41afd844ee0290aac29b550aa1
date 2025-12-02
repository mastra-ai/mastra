extern crate tokenizers as tk;

use crate::models::Model;
use napi::bindgen_prelude::*;
use std::sync::{Arc, RwLock};
use tokenizers::models::bpe::{BpeBuilder, BPE};
use tokenizers::models::wordlevel::{WordLevel, WordLevelBuilder};
use tokenizers::models::wordpiece::{WordPiece, WordPieceBuilder};

pub struct BPEFromFilesTask {
  pub(crate) builder: Option<BpeBuilder>,
}

impl Task for BPEFromFilesTask {
  type Output = BPE;
  type JsValue = Model;

  fn compute(&mut self) -> Result<Self::Output> {
    self
      .builder
      .take()
      .ok_or(Error::from_reason("Empty builder".to_string()))?
      .build()
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(Model {
      model: Some(Arc::new(RwLock::new(output.into()))),
    })
  }
}

pub struct WordPieceFromFilesTask {
  pub(crate) builder: Option<WordPieceBuilder>,
}

impl Task for WordPieceFromFilesTask {
  type Output = WordPiece;
  type JsValue = Model;

  fn compute(&mut self) -> Result<Self::Output> {
    self
      .builder
      .take()
      .ok_or(Error::from_reason("Empty builder".to_string()))?
      .build()
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(Model {
      model: Some(Arc::new(RwLock::new(output.into()))),
    })
  }
}
pub struct WordLevelFromFilesTask {
  pub(crate) builder: Option<WordLevelBuilder>,
}

impl Task for WordLevelFromFilesTask {
  type Output = WordLevel;
  type JsValue = Model;

  fn compute(&mut self) -> Result<Self::Output> {
    self
      .builder
      .take()
      .ok_or(Error::from_reason("Empty builder".to_string()))?
      .build()
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(Model {
      model: Some(Arc::new(RwLock::new(output.into()))),
    })
  }
}
