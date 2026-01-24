import os
import json
import re

# Paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '../../'))
WEB_APP_DATA_DIR = os.path.join(BASE_DIR, '../data')

THEORY_DIR = os.path.join(PROJECT_ROOT, 'Theory')
GAMES_DIR = os.path.join(PROJECT_ROOT, 'Games')

OUTPUT_FILE = os.path.join(WEB_APP_DATA_DIR, 'content.json')

def parse_markdown_sections(content):
    """
    Parses markdown content into a dictionary of sections based on headers.
    """
    sections = {}
    current_section = "description"
    lines = content.split('\n')
    
    for line in lines:
        if line.startswith('#'):
            # New section
            header_match = re.match(r'#+\s*(.*)', line)
            if header_match:
                current_section = header_match.group(1).strip().lower()
                sections[current_section] = ""
        else:
            if current_section not in sections:
                sections[current_section] = ""
            sections[current_section] += line + "\n"
            
    return {k: v.strip() for k, v in sections.items()}

def parse_game_file(filepath):
    """
    Parses a game file which may contain multiple games separated by '---'
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by horizontal rule
    raw_games = content.split('---')
    games = []

    for raw_game in raw_games:
        if not raw_game.strip():
            continue
            
        game_data = {}
        
        # Extract Title (First H2 or H1)
        title_match = re.search(r'^##?\s+(.*)', raw_game, re.MULTILINE)
        if title_match:
            game_data['title'] = title_match.group(1).strip()
        else:
            # Fallback for files that might be just one game without top-level header or just parsing needed
            # Use filename if no title found in a meaningful block? 
            # For now, skip if no title found, or check if it's the top of the file
            lines = raw_game.strip().split('\n')
            if lines and lines[0].startswith('# '):
                 game_data['title'] = lines[0].replace('# ', '').strip()

        if 'title' not in game_data:
            continue

        # Extract sections
        # Simplified parsing: looking for **Key**
        details = {}
        # Regex to find **Key** followed by text until next **Key** or ## Header
        # This is a bit complex, let's try a simpler line-by-line approach for keys
        
        current_key = 'description'
        if current_key not in game_data: game_data[current_key] = ""

        lines = raw_game.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('## '):
                # Skip title line if we already processed it, or reset context?
                # Actually we already extracted title, so this handles sub-sections if they exist
                pass 
            elif line.startswith('**') and line.endswith('**'):
                # New key like **Purpose**
                current_key = line.strip('*').lower()
                game_data[current_key] = ""
            elif line.startswith('**') and '**' in line:
                 # Key inline like **Static** - ...
                 pass # Treat as content for now
            else:
                if current_key in game_data:
                     game_data[current_key] += line + "\n"
                else:
                     game_data[current_key] = line + "\n"
        
        # Clean up
        for k in game_data:
            if isinstance(game_data[k], str):
                game_data[k] = game_data[k].strip()

        games.append(game_data)
        
    return games

def get_theories():
    theories = []
    if not os.path.exists(THEORY_DIR):
        print(f"Warning: {THEORY_DIR} does not exist.")
        return theories

    for root, dirs, files in os.walk(THEORY_DIR):
        for file in files:
            if file.endswith('.md'):
                path = os.path.join(root, file)
                # Theory usually matches folder name, e.g. Theory/Pressure/Pressure.md
                # We can just parse all md files in Theory as potential concepts
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract Title
                title_match = re.match(r'^#\s+(.*)', content)
                title = title_match.group(1).strip() if title_match else file.replace('.md', '')
                
                # Check for images in the same directory
                images = []
                for img_file in os.listdir(root):
                    if img_file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                        # Relative path for web app to access?
                        # We need to serve them. The simplest way is to assume python http server serves root.
                        # So path should be relative to Web App root or absolute if we symlink?
                        # Let's use relative path from the processed content root.
                        # Actually, our server is converting local file paths? No.
                        # We should likely copy them or just reference them relatively if the server allows.
                        # Current server is simple static server in 'Web App'. 
                        # Theory/Images are in ../Theory.
                        # Chrome blocks local file access. 
                        # We need to symlink or copy 'Theory' and 'Games' into 'Web App' or Configure server.
                        # For now, let's store the relative path from project root and handle serving later 
                        # or assume 'Theory' is accessible via ../
                        # Wait, SimpleHTTPRequestHandler serves CWD. If we run in 'Web App', ../Theory is not accessible by default unless we symlink?
                        # Actually, let's try to reference them as ../Theory/..., but browsers might block that.
                        # Ideally 'run.sh' should symlink data.
                        # Since we symlinked Theory into Web App, we can just use Theory/Folder/Image
                        images.append(f"Theory/{os.path.basename(root)}/{img_file}")

                # Let's actually fix the pathing. 
                # If we run server in 'Web App', we need 'Theory' to be inside 'Web App' or available.
                # Let's adjust the path to be accessible.
                # Only way is to symlink '../Theory' to 'Web App/Theory'
                
                theories.append({
                    'id': title.lower().replace(' ', '-'),
                    'title': title,
                    'content': content,
                    'path': path,
                    'images': sorted(images)
                })
    return theories

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
                    # Strip H1 title from content if present, as we use folder name as title or parse it
                    # Simple heuristic: take everything
                    desc = content
                    # If it starts with # Title, maybe remove it? 
                    # Let's keep it raw for now, or just remove the first line if it is a header
                    lines = content.strip().split('\n')
                    if lines and lines[0].startswith('#'):
                        # Check if it matches directory name roughly? 
                        # User wants "Butterfly and it's description should be a header"
                        pass
                    categories[category_name]["description"] = desc
            elif file.endswith('.md') and file != "GameTemplate.md":
                # It's a game file
                file_games = parse_game_file(path)
                for g in file_games:
                    g['category'] = category_name
                    g['id'] = (category_name + '-' + g['title']).lower().replace(' ', '-').replace('/', '-')
                    categories[category_name]["games"].append(g['id'])
                    all_games.append(g)

    return list(categories.values()), all_games

def main():
    print("Generating content...")
    theories = get_theories()
    print(f"Found {len(theories)} theories.")
    
    categories, games = get_categories_and_games()
    print(f"Found {len(categories)} categories and {len(games)} games.")
    
    data = {
        "theories": theories,
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
