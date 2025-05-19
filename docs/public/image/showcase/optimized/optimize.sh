#!/usr/bin/env bash
# optimize-images.sh
# Usage: ./optimize-images.sh [target_directory]
# If no directory is given, defaults to the current directory.

# 1. Directory to scan (default: current dir)
DIR="${1:-.}"

# 2. File extensions to target
EXTS=(jpg jpeg png gif webp tiff tif)

# 3. Build the find expression for -iname '*.ext' -o '*.ext' ...
NAME_EXPR=""
for ext in "${EXTS[@]}"; do
  NAME_EXPR+=" -iname '*.${ext}' -o"
done
# strip trailing -o
NAME_EXPR=${NAME_EXPR% -o}

# 4. Find and optimize in-place
find "$DIR" -type f \( $NAME_EXPR \) -print0 \
  | xargs -0 magick mogrify -strip -quality 50

echo "Done! All images under '$DIR' have been optimized to 50% quality."
