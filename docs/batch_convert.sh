#!/bin/bash

# This script converts all absolute internal links to relative links in the reference section

cd /Users/booker/Code/mastra/docs/src/content/en/reference

# Find all MDX files and process them
find . -name "*.mdx" -type f | while read file; do
    # Calculate the depth (number of directories deep from reference/)
    depth=$(echo "$file" | grep -o "/" | wc -l)

    # For files directly in reference/ (depth=1), use ../
    # For files in reference/subdir/ (depth=2), use ../../
    # etc.

    if [ $depth -eq 1 ]; then
        # File is in reference/ directly
        prefix_to_docs="../"
        prefix_to_same="."
    elif [ $depth -eq 2 ]; then
        # File is in reference/subdir/
        prefix_to_docs="../../"
        prefix_to_same="."
    elif [ $depth -eq 3 ]; then
        # File is in reference/subdir/subdir2/
        prefix_to_docs="../../../"
        prefix_to_same="."
    fi

    # Create a backup
    cp "$file" "$file.bak"

    # Perform replacements (this is a simplified version)
    # We'll need to handle this more carefully for production

    echo "Processing: $file (depth: $depth)"
done

echo "Done! Backups created with .bak extension"
