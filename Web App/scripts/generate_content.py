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
                'description': body, 
                'category': metadata.get('category', 'Uncategorized'),
                'goals': metadata.get('goals', ''),
                'purpose': metadata.get('purpose', ''),
                'focus': metadata.get('focus', ''),
                'duration': metadata.get('duration', ''),
                'players': metadata.get('players', ''),
                'type': metadata.get('type', ''),
                'intensity': metadata.get('intensity', ''),
                'difficulty': metadata.get('difficulty', ''),
                'parentId': metadata.get('parent_id', ''),
            }
            
            # Fallback for old purpose format in body if not in frontmatter
            if not game_data['purpose']:
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

    # Iterate top-level folders only
    for concept_name in os.listdir(THEORY_DIR):
        concept_path = os.path.join(THEORY_DIR, concept_name)
        
        if os.path.isdir(concept_path):
            # Look for ConceptName.md
            md_file = os.path.join(concept_path, f"{concept_name}.md")
            
            # If strictly matching name doesn't exist, maybe look for any MD that isn't in Games?
            # But strictly matching is safer and cleaner practice.
            if not os.path.exists(md_file):
                 # Try finding *any* .md file at this level (that isn't in a subfolder)
                 # This handles cases where file casing might differ slightly or legacy naming?
                 candidates = [f for f in os.listdir(concept_path) if f.endswith('.md')]
                 if candidates:
                     md_file = os.path.join(concept_path, candidates[0])
                 else:
                     continue

            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract Title
            title_match = re.match(r'^#\s+(.*)', content)
            
            # Prefer title from file content, fallback to folder name
            title = title_match.group(1).strip() if title_match else concept_name
            
            # Images
            images = []
            for img_file in os.listdir(concept_path):
                if img_file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                    images.append(f"Concepts/{concept_name}/{img_file}")

            concepts.append({
                'id': title.lower().replace(' ', '-'),
                'title': title,
                'content': content,
                'path': md_file,
                'images': sorted(images)
            })
            
    return concepts

def get_categories_and_games():
    categories = {}
    
    # Scan Concepts Directory for Games
    if not os.path.exists(THEORY_DIR):
        print(f"Warning: {THEORY_DIR} does not exist.")
        return [], []

    all_games = []

    # Iterate over each Concept folder
    for concept_name in os.listdir(THEORY_DIR):
        concept_path = os.path.join(THEORY_DIR, concept_name)
        if not os.path.isdir(concept_path):
            continue
            
        # Check for Games subfolder
        games_dir = os.path.join(concept_path, 'Games')
        if not os.path.exists(games_dir):
            continue
            
        # Initialize category (Concept name is the category)
        if concept_name not in categories:
            categories[concept_name] = {
                "id": concept_name.lower().replace(" ", "-"),
                "title": concept_name,
                "description": "", # Could read concept file for this?
                "games": []
            }
            
        # Scan games in this folder
        for file in os.listdir(games_dir):
            if file.endswith('.md'):
                path = os.path.join(games_dir, file)
                file_games = parse_game_file(path)
                
                for g in file_games:
                    # Force category to match the folder structure logic
                    cat_key = concept_name # g.get('category', concept_name)
                    # Or trust frontmatter? Let's prefer folder structure for consistency now.
                    g['category'] = cat_key
                    
                    g['id'] = (cat_key + '-' + g['title']).lower().replace(' ', '-').replace('/', '-')
                    g['path'] = path 
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
