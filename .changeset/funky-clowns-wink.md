---
'@mastra/e2b': patch
'@mastra/gcs': patch
'@mastra/core': patch
'@mastra/s3': patch
---

Added overwrite: false support to S3 and GCS writeFile and copyFile methods. Previously, the overwrite option in WriteOptions and CopyOptions was ignored by cloud providers, allowing files to be silently overwritten. Now S3 and GCS correctly throw FileExistsError when overwrite is set to false and the destination file already exists. CompositeFilesystem cross-mount copies now delegate overwrite handling to the destination provider instead of checking at the composite level.
