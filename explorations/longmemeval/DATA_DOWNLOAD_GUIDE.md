# LongMemEval Dataset Download Guide

The LongMemEval datasets are large files (several GB) hosted on HuggingFace with Git LFS. Here are all the ways to download them:

## Option 1: JavaScript/Node.js Download

### 1. Get your HuggingFace token

- Go to https://huggingface.co/settings/tokens
- Create a new token with read permissions
- Copy the token

### 2. Set the token as environment variable

```bash
export HF_TOKEN=your_token_here
# or
export HUGGINGFACE_TOKEN=your_token_here
```

### 3. Install dependencies and download

```bash
pnpm install
pnpm download:hf
```

## Option 2: Git LFS

### 1. Install Git LFS

```bash
# macOS
brew install git-lfs

# Ubuntu/Debian
sudo apt-get install git-lfs

# Initialize Git LFS
git lfs install
```

### 2. Clone with Git LFS

```bash
git clone https://huggingface.co/datasets/xiaowu0162/longmemeval
cd longmemeval
cp *.json ../data/
```

## Option 3: Manual Download from Google Drive

### 1. Download the archive

Go to: https://drive.google.com/file/d/1zJgtYRFhOh5zDQzzatiddfjYhFSnyQ80/view

### 2. Extract the files

```bash
cd packages/longmemeval/data
tar -xzvf ~/Downloads/longmemeval_data.tar.gz
```

### 3. Verify the files

```bash
ls -lh *.json
# You should see:
# - longmemeval_s.json (~40MB)
# - longmemeval_m.json (~200MB)
# - longmemeval_oracle.json (~2MB)
```

## Option 4: Direct Browser Download

If you have a HuggingFace account:

1. Go to https://huggingface.co/datasets/xiaowu0162/longmemeval
2. Click on "Files and versions"
3. Download each JSON file directly
4. Move them to `packages/longmemeval/data/`

## Troubleshooting

### "Entry not found" or small files (15 bytes)

This means the download failed due to authentication. Use one of the authenticated methods above.

### Git LFS bandwidth exceeded

HuggingFace has bandwidth limits. Try:

- Using the Google Drive link instead
- Waiting until the next day when bandwidth resets
- Using a different download method

### Permission denied

Make sure you're logged in to HuggingFace and have accepted any dataset terms of use.

## Verification

After downloading, verify the files:

```bash
# Check file sizes
ls -lh data/*.json

# Check file content (should be valid JSON)
head -n 5 data/longmemeval_s.json
```

Expected sizes:

- `longmemeval_oracle.json`: ~2MB
- `longmemeval_s.json`: ~40MB
- `longmemeval_m.json`: ~200MB
