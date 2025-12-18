#!/bin/bash

# Base directory
BASE_DIR="/Users/booker/Code/mastra/docs/src/content/en"

# Function to calculate relative path
get_rel_path() {
    local from_file="$1"
    local to_url="$2"

    # Get directory of source file
    local from_dir=$(dirname "$from_file")

    # Remove the base dir to get the relative from location
    local from_rel="${from_dir#$BASE_DIR/}"

    # Determine target section and path
    local target_file=""
    if [[ "$to_url" =~ ^/docs/v1/(.*)$ ]]; then
        target_file="$BASE_DIR/docs/${BASH_REMATCH[1]}"
    elif [[ "$to_url" =~ ^/reference/v1/(.*)$ ]]; then
        target_file="$BASE_DIR/reference/${BASH_REMATCH[1]}"
    elif [[ "$to_url" =~ ^/guides/v1/(.*)$ ]]; then
        target_file="$BASE_DIR/guides/${BASH_REMATCH[1]}"
    elif [[ "$to_url" =~ ^/models/v1/(.*)$ ]]; then
        target_file="$BASE_DIR/models/${BASH_REMATCH[1]}"
    elif [[ "$to_url" =~ ^/examples/v1/(.*)$ ]]; then
        target_file="$BASE_DIR/examples/${BASH_REMATCH[1]}"
    fi

    if [ -z "$target_file" ]; then
        echo "$to_url"
        return
    fi

    # Calculate relative path
    python3 -c "import os; print(os.path.relpath('$target_file', '$from_dir'))"
}

# Process a single file
process_file() {
    local file="$1"
    local temp_file="${file}.tmp"
    local changed=0

    # Read file line by line
    while IFS= read -r line; do
        # Check if line contains absolute links
        if [[ "$line" =~ \]\(/(docs|reference|guides|models|examples)/v1/ ]]; then
            # Extract and convert each link
            local new_line="$line"

            # Find all links in the line
            while [[ "$new_line" =~ (\]\((/(docs|reference|guides|models|examples)/v1/[^)]+)\)) ]]; then
                local full_match="${BASH_REMATCH[1]}"
                local url="${BASH_REMATCH[2]}"

                # Calculate relative path
                local rel_path=$(get_rel_path "$file" "$url")

                # Ensure relative path starts with ./ or ../
                if [[ ! "$rel_path" =~ ^\.\./  ]] && [[ ! "$rel_path" =~ ^\./ ]]; then
                    rel_path="./$rel_path"
                fi

                # Replace in line
                local new_match="](${rel_path})"
                new_line="${new_line//$full_match/$new_match}"
                changed=1
            done

            echo "$new_line" >> "$temp_file"
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$file"

    # Replace original file if changed
    if [ $changed -eq 1 ]; then
        mv "$temp_file" "$file"
        echo "✓ $(basename $file)"
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# Main execution
echo "Processing reference directory..."
files_changed=0
files_processed=0

# Find all .mdx files in reference directory
find "$BASE_DIR/reference" -name "*.mdx" -type f | while read -r file; do
    files_processed=$((files_processed + 1))
    if process_file "$file"; then
        files_changed=$((files_changed + 1))
    fi
done

echo "Done! Processed $files_processed files, changed $files_changed files"
