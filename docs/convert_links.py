#!/usr/bin/env python3
import os
import re
from pathlib import Path

BASE_DIR = "/Users/booker/Code/mastra/docs/src/content/en"
REFERENCE_DIR = os.path.join(BASE_DIR, "reference")

# URL to directory mapping
URL_MAPPINGS = {
    "/docs/v1/": "docs/",
    "/reference/v1/": "reference/",
    "/guides/v1/": "guides/",
    "/models/v1/": "models/",
    "/examples/v1/": "examples/",
}


def get_relative_path(from_file, to_section, to_path):
    """
    Calculate relative path from one file to another.

    Args:
        from_file: Absolute path to the source file
        to_section: Target section (docs, reference, guides, models, examples)
        to_path: Path within the target section (e.g., "memory/overview")

    Returns:
        Relative path string
    """
    # Get the directory containing the source file
    from_dir = os.path.dirname(from_file)

    # Build the target absolute path
    to_file = os.path.join(BASE_DIR, to_section, to_path)

    # Calculate relative path
    rel_path = os.path.relpath(to_file, from_dir)

    # Convert to forward slashes and remove .mdx extension if present
    rel_path = rel_path.replace("\\", "/")
    if rel_path.endswith(".mdx"):
        rel_path = rel_path[:-4]

    # Ensure path starts with ./ if it doesn't start with ../
    if not rel_path.startswith("../"):
        rel_path = "./" + rel_path

    return rel_path


def convert_link(match, file_path):
    """Convert an absolute link to a relative link."""
    full_match = match.group(0)
    link_content = match.group(1)  # The URL part

    # Check if it's an external URL
    if link_content.startswith("http://") or link_content.startswith("https://"):
        return full_match

    # Extract hash anchor if present
    hash_anchor = ""
    if "#" in link_content:
        link_content, hash_anchor = link_content.split("#", 1)
        hash_anchor = "#" + hash_anchor

    # Try to match the URL pattern
    matched = False
    for url_prefix, section_dir in URL_MAPPINGS.items():
        if link_content.startswith(url_prefix):
            # Extract the path after the prefix
            path_after_prefix = link_content[len(url_prefix):]

            # Calculate relative path
            rel_path = get_relative_path(file_path, section_dir, path_after_prefix)

            # Return the converted link
            matched = True
            return f"]({rel_path}{hash_anchor})"

    # If no match found, return original
    return full_match


def process_file(file_path):
    """Process a single MDX file to convert absolute links to relative."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Pattern to match markdown links: ](URL)
    # We look for links that start with our known prefixes
    pattern = r"\]\((/(?:docs|reference|guides|models|examples)/v1/[^)]+)\)"

    original_content = content
    content = re.sub(
        pattern,
        lambda m: convert_link(m, file_path),
        content
    )

    # Only write if content changed
    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False


def main():
    """Process all MDX files in the reference directory."""
    files_changed = 0
    files_processed = 0

    for root, dirs, files in os.walk(REFERENCE_DIR):
        for file in files:
            if file.endswith(".mdx"):
                file_path = os.path.join(root, file)
                files_processed += 1

                if process_file(file_path):
                    files_changed += 1
                    print(f"✓ {os.path.relpath(file_path, REFERENCE_DIR)}")

    print(f"\nProcessed {files_processed} files, changed {files_changed} files")


if __name__ == "__main__":
    main()
