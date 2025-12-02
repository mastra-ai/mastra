use crate::models::Model;
use napi_derive::napi;
use std::sync::{Arc, RwLock};
use tokenizers as tk;
use tokenizers::models::TrainerWrapper;

#[napi]
pub struct Trainer {
  trainer: Option<Arc<RwLock<TrainerWrapper>>>,
}

impl From<TrainerWrapper> for Trainer {
  fn from(trainer: TrainerWrapper) -> Self {
    Self {
      trainer: Some(Arc::new(RwLock::new(trainer))),
    }
  }
}

impl tk::Trainer for Trainer {
  type Model = Model;

  fn should_show_progress(&self) -> bool {
    self
      .trainer
      .as_ref()
      .expect("Uninitialized Trainer")
      .read()
      .unwrap()
      .should_show_progress()
  }

  fn train(&self, model: &mut Self::Model) -> tk::Result<Vec<tk::AddedToken>> {
    let special_tokens = self
      .trainer
      .as_ref()
      .ok_or("Uninitialized Trainer")?
      .read()
      .unwrap()
      .train(
        &mut model
          .model
          .as_ref()
          .ok_or("Uninitialized Model")?
          .write()
          .unwrap(),
      )?;

    Ok(special_tokens)
  }

  fn feed<I, S, F>(&mut self, iterator: I, process: F) -> tk::Result<()>
  where
    I: Iterator<Item = S> + Send,
    S: AsRef<str> + Send,
    F: Fn(&str) -> tk::Result<Vec<String>> + Sync,
  {
    self
      .trainer
      .as_ref()
      .ok_or("Uninitialized Trainer")?
      .write()
      .unwrap()
      .feed(iterator, process)
  }
}
