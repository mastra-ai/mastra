use napi::bindgen_prelude::*;
use napi_derive::napi;
use tokenizers as tk;
use tokenizers::Encoding;

use crate::encoding::JsEncoding;

#[napi]
pub fn slice(s: String, begin_index: Option<i32>, end_index: Option<i32>) -> Result<String> {
  let len = s.chars().count();

  let get_index = |x: i32| -> usize {
    if x >= 0 {
      x as usize
    } else {
      (len as i32 + x) as usize
    }
  };

  let begin_index = get_index(begin_index.unwrap_or(0));
  let end_index = get_index(end_index.unwrap_or(len as i32));

  if let Some(slice) = tk::tokenizer::normalizer::get_range_of(&s, begin_index..end_index) {
    Ok(slice.to_string())
  } else {
    Err(Error::new(
      Status::GenericFailure,
      "Error in offsets".to_string(),
    ))
  }
}

#[napi]
pub fn merge_encodings(
  encodings: Vec<&JsEncoding>,
  growing_offsets: Option<bool>,
) -> Result<JsEncoding> {
  let growing_offsets = growing_offsets.unwrap_or(false);

  let encodings: Vec<_> = encodings
    .into_iter()
    .map(|enc| enc.encoding.to_owned().unwrap())
    .collect();

  let new_encoding = Encoding::merge(encodings, growing_offsets);
  let js_encoding = JsEncoding {
    encoding: Some(new_encoding),
  };

  Ok(js_encoding)
}
