use crate::tokenizer::PaddingOptions;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use tokenizers::utils::truncation::TruncationDirection;
use tokenizers::Encoding;

#[napi(js_name = "Encoding")]
#[derive(Clone, Default)]
pub struct JsEncoding {
  pub(crate) encoding: Option<Encoding>,
}

impl From<Encoding> for JsEncoding {
  fn from(value: Encoding) -> Self {
    Self {
      encoding: Some(value),
    }
  }
}

impl TryFrom<JsEncoding> for Encoding {
  type Error = Error;

  fn try_from(value: JsEncoding) -> Result<Self> {
    value
      .encoding
      .ok_or(Error::from_reason("Uninitialized encoding".to_string()))
  }
}

#[napi(string_enum, js_name = "TruncationDirection")]
pub enum JsTruncationDirection {
  Left,
  Right,
}

impl From<JsTruncationDirection> for TruncationDirection {
  fn from(value: JsTruncationDirection) -> Self {
    match value {
      JsTruncationDirection::Left => TruncationDirection::Left,
      JsTruncationDirection::Right => TruncationDirection::Right,
    }
  }
}

impl TryFrom<String> for JsTruncationDirection {
  type Error = Error;
  fn try_from(value: String) -> Result<JsTruncationDirection> {
    match value.as_str() {
      "left" => Ok(JsTruncationDirection::Left),
      "right" => Ok(JsTruncationDirection::Right),
      s => Err(Error::from_reason(format!(
        "{s:?} is not a valid direction"
      ))),
    }
  }
}

#[napi(string_enum, js_name = "TruncationStrategy")]
pub enum JsTruncationStrategy {
  LongestFirst,
  OnlyFirst,
  OnlySecond,
}

impl From<JsTruncationStrategy> for tokenizers::TruncationStrategy {
  fn from(value: JsTruncationStrategy) -> Self {
    match value {
      JsTruncationStrategy::LongestFirst => tokenizers::TruncationStrategy::LongestFirst,
      JsTruncationStrategy::OnlyFirst => tokenizers::TruncationStrategy::OnlyFirst,
      JsTruncationStrategy::OnlySecond => tokenizers::TruncationStrategy::OnlySecond,
    }
  }
}

#[napi]
impl JsEncoding {
  #[napi(constructor)]
  pub fn new() -> Self {
    Self { encoding: None }
  }

  #[napi]
  pub fn get_length(&self) -> u32 {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_ids()
      .len() as u32
  }

  #[napi]
  pub fn get_n_sequences(&self) -> u32 {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .n_sequences() as u32
  }

  #[napi]
  pub fn get_ids(&self) -> Vec<u32> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_ids()
      .to_vec()
  }

  #[napi]
  pub fn get_type_ids(&self) -> Vec<u32> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_type_ids()
      .to_vec()
  }

  #[napi]
  pub fn get_attention_mask(&self) -> Vec<u32> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_attention_mask()
      .to_vec()
  }

  #[napi]
  pub fn get_special_tokens_mask(&self) -> Vec<u32> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_special_tokens_mask()
      .to_vec()
  }

  #[napi]
  pub fn get_tokens(&self) -> Vec<String> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_tokens()
      .to_vec()
  }

  #[napi]
  pub fn get_offsets(&self) -> Vec<Vec<u32>> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_offsets()
      .iter()
      .map(|(a, b)| vec![*a as u32, *b as u32])
      .collect()
  }

  #[napi]
  pub fn get_word_ids(&self) -> Vec<Option<u32>> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_word_ids()
      .to_vec()
  }

  #[napi]
  pub fn char_to_token(&self, pos: u32, seq_id: Option<u32>) -> Option<u32> {
    let seq_id = seq_id.unwrap_or(0);
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .char_to_token(pos as usize, seq_id as usize)
      .map(|i| i as u32)
  }

  #[napi]
  pub fn char_to_word(&self, pos: u32, seq_id: Option<u32>) -> Option<u32> {
    let seq_id = seq_id.unwrap_or(0);
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .char_to_word(pos as usize, seq_id as usize)
  }

  #[napi]
  pub fn pad(&mut self, length: u32, options: Option<PaddingOptions>) -> Result<()> {
    let params: tokenizers::PaddingParams = options.unwrap_or_default().try_into()?;
    self.encoding.as_mut().expect("Uninitialized Encoding").pad(
      length as usize,
      params.pad_id,
      params.pad_type_id,
      &params.pad_token,
      params.direction,
    );
    Ok(())
  }

  #[napi]
  pub fn truncate(
    &mut self,
    length: u32,
    stride: Option<u32>,
    direction: Option<Either<String, JsTruncationDirection>>,
  ) -> Result<()> {
    let stride = stride.unwrap_or_default();
    let direction = match direction {
      None => TruncationDirection::Left,
      Some(Either::A(s)) => match s.as_str() {
        "left" => TruncationDirection::Left,
        "right" => TruncationDirection::Right,
        d => {
          return Err(Error::from_reason(format!(
            "{d} is not a valid truncation direction"
          )));
        }
      },
      Some(Either::B(t)) => t.into(),
    };
    self
      .encoding
      .as_mut()
      .expect("Uninitialized Encoding")
      .truncate(length as usize, stride as usize, direction);
    Ok(())
  }

  #[napi(ts_return_type = "[number, number] | null | undefined")]
  pub fn word_to_tokens(&self, env: Env, word: u32, seq_id: Option<u32>) -> Result<Option<Array>> {
    let seq_id = seq_id.unwrap_or(0);

    if let Some((a, b)) = self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .word_to_tokens(word, seq_id as usize)
    {
      let mut arr = env.create_array(2)?;
      arr.set(0, env.create_uint32(a as u32)?)?;
      arr.set(1, env.create_uint32(b as u32)?)?;
      Ok(Some(arr))
    } else {
      Ok(None)
    }
  }
  #[napi(ts_return_type = "[number, number] | null | undefined")]
  pub fn word_to_chars(&self, env: Env, word: u32, seq_id: Option<u32>) -> Result<Option<Array>> {
    let seq_id = seq_id.unwrap_or(0);

    if let Some((a, b)) = self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .word_to_chars(word, seq_id as usize)
    {
      let mut arr = env.create_array(2)?;
      arr.set(0, env.create_uint32(a as u32)?)?;
      arr.set(1, env.create_uint32(b as u32)?)?;
      Ok(Some(arr))
    } else {
      Ok(None)
    }
  }

  #[napi(ts_return_type = "[number, [number, number]] | null | undefined")]
  pub fn token_to_chars(&self, env: Env, token: u32) -> Result<Option<Array>> {
    if let Some((_, (start, stop))) = self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .token_to_chars(token as usize)
    {
      let mut offsets = env.create_array(2)?;
      offsets.set(0, env.create_uint32(start as u32)?)?;
      offsets.set(1, env.create_uint32(stop as u32)?)?;
      Ok(Some(offsets))
    } else {
      Ok(None)
    }
  }

  #[napi]
  pub fn token_to_word(&self, token: u32) -> Result<Option<u32>> {
    if let Some((_, index)) = self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .token_to_word(token as usize)
    {
      Ok(Some(index))
    } else {
      Ok(None)
    }
  }

  #[napi]
  pub fn get_overflowing(&self) -> Vec<JsEncoding> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_overflowing()
      .clone()
      .into_iter()
      .map(|enc| JsEncoding {
        encoding: Some(enc),
      })
      .collect()
  }

  #[napi]
  pub fn get_sequence_ids(&self) -> Vec<Option<u32>> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .get_sequence_ids()
      .into_iter()
      .map(|s| s.map(|id| id as u32))
      .collect()
  }

  #[napi]
  pub fn token_to_sequence(&self, token: u32) -> Option<u32> {
    self
      .encoding
      .as_ref()
      .expect("Uninitialized Encoding")
      .token_to_sequence(token as usize)
      .map(|s| s as u32)
  }
}
