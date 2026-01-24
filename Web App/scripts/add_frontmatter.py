import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '../../'))
GAMES_DIR = os.path.join(PROJECT_ROOT, 'Games')

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already has frontmatter
    if content.startswith('---'):
        print(f"Skipping {filepath} (already has frontmatter)")
        return

    # Extract Title (First # H1 or ## H2)
    # We remove the title line from the body to avoid duplication
    title = "Unknown Game"
    new_content = content
    
    # regex for title
    # ^#+\s+(.*)
    match = re.search(r'^#+\s+(.*)', content, re.MULTILINE)
    if match:
        title = match.group(1).strip()
        # Remove the title line
        new_content = content[:match.start()] + content[match.end():]
    
    # Extract Category from parent folder
    category = os.path.basename(os.path.dirname(filepath))
    
    # Clean up leading whitespace/newlines
    new_content = new_content.strip()

    # Construct Frontmatter
    frontmatter = f"""---
title: {title}
category: {category}
players: 2
---

{new_content}
"""

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(frontmatter)
    
    print(f"Migrated {filepath}")

def main():
    if not os.path.exists(GAMES_DIR):
        print("Games dir not found")
        return

    for root, dirs, files in os.walk(GAMES_DIR):
        for file in files:
            if file.endswith('.md') and file != "GameTemplate.md":
                # Check if it's a category description file (same name as folder)
                folder_name = os.path.basename(root)
                if file == f"{folder_name}.md":
                    # It's a category descriptor, maybe skipping for now or migrating differently?
                    # Let's migrate it too, giving it a type: category
                     migrate_file(os.path.join(root, file))
                else:
                    migrate_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
