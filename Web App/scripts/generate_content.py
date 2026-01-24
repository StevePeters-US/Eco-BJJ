import os
import json
import re

# Paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '../../'))
WEB_APP_DATA_DIR = os.path.join(BASE_DIR, '../data')

THEORY_DIR = os.path.join(PROJECT_ROOT, 'Concepts') # Updated to Concepts
GAMES_DIR = os.path.join(PROJECT_ROOT, 'Games')

OUTPUT_FILE = os.path.join(WEB_APP_DATA_DIR, 'content.json')

def parse_game_file(filepath):
    """
    Parses a game file using YAML frontmatter if available.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    games = []
    
    # Check for Frontmatter
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter_raw = parts[1]
            body = parts[2].strip()
            
            metadata = {}
            for line in frontmatter_raw.strip().split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    metadata[key.strip()] = value.strip()
            
            # Construct game object
            game_data = {
                'title': metadata.get('title', 'Unknown Title'),
                'description': body, # The body is the description now
                'category': metadata.get('category', 'Uncategorized'),
                # Parse body for other sections if needed, but for now we rely on the body being markdown
                # We can try to extract specific sections from body if they exist as headers
            }
            
            # Use body as description. 
            # If we needed specific fields like 'purpose' extracted from body, we'd do it here.
            # Keeping it simple as per previous logic.
            
            purpose_match = re.search(r'\*\*Purpose\*\*\s*\n*(.*)', body)
            if purpose_match:
                game_data['purpose'] = purpose_match.group(1).strip()
            
            games.append(game_data)
            return games

    return games

def get_concepts():
    concepts = []
    if not os.path.exists(THEORY_DIR):
        print(f"Warning: {THEORY_DIR} does not exist.")
        return concepts

    for root, dirs, files in os.walk(THEORY_DIR):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                # Theory usually matches folder name, e.g. Concepts/Pressure/Pressure.md
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract Title
                title_match = re.match(r'^#\s+(.*)', content)
                title = title_match.group(1).strip() if title_match else file.replace('.md', '')
                
                # Check for images in the same directory
                images = []
                for img_file in os.listdir(root):
                    if img_file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                         # Updated path: Concepts/Folder/Image
                        images.append(f"Concepts/{os.path.basename(root)}/{img_file}")

                concepts.append({
                    'id': title.lower().replace(' ', '-'),
                    'title': title,
                    'content': content,
                    'path': path,
                    'images': sorted(images)
                })
    return concepts

def get_categories_and_games():
    categories = {}
    
    if not os.path.exists(GAMES_DIR):
        print(f"Warning: {GAMES_DIR} does not exist.")
        return [], []

    all_games = []

    for root, dirs, files in os.walk(GAMES_DIR):
        category_name = os.path.basename(root)
        if root == GAMES_DIR:
            continue
            
        # Initialize category if new
        if category_name not in categories:
            categories[category_name] = {
                "id": category_name.lower().replace(" ", "-"),
                "title": category_name,
                "description": "",
                "games": []
            }

        # Look for category description file (same name as folder)
        category_file = f"{category_name}.md"
        
        for file in files:
            path = os.path.join(root, file)
            
            if file == category_file:
                # This is the category description
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    categories[category_name]["description"] = content
            elif file.endswith('.md') and file != "GameTemplate.md":
                # It's a game file (or category desc if fallback)
                file_games = parse_game_file(path)
                for g in file_games:
                    # Use frontmatter category if available, else folder name
                    cat_key = g.get('category', category_name)
                    
                    # Ensure category exists in our map if it's new (e.g. from frontmatter)
                    if cat_key not in categories:
                         categories[cat_key] = {
                            "id": cat_key.lower().replace(" ", "-"),
                            "title": cat_key,
                            "description": "",
                            "games": []
                        }
                    
                    g['id'] = (cat_key + '-' + g['title']).lower().replace(' ', '-').replace('/', '-')
                    g['path'] = path # Critical: Add path for editing
                    categories[cat_key]["games"].append(g['id'])
                    all_games.append(g)

    return list(categories.values()), all_games

def main():
    print("Generating content...")
    concepts = get_concepts()
    print(f"Found {len(concepts)} concepts.")
    
    categories, games = get_categories_and_games()
    print(f"Found {len(categories)} categories and {len(games)} games.")
    
    data = {
        "concepts": concepts, 
        "categories": categories,
        "games": games
    }
    
    if not os.path.exists(WEB_APP_DATA_DIR):
        os.makedirs(WEB_APP_DATA_DIR)
        
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        
    print(f"Content generated at {OUTPUT_FILE}")

    # Auto-Cache Busting for index.html
    import time
    index_path = os.path.join(BASE_DIR, '../index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Replace existing version param or add one
        timestamp = int(time.time())
        # Regex to find src="js/app.js..."
        new_html = re.sub(r'src="js/app\.js(\?v=\d+)?"', f'src="js/app.js?v={timestamp}"', html_content)
        
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(new_html)
        print(f"Updated index.html with version {timestamp}")

if __name__ == "__main__":
    main()
