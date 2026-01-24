import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '../../'))
CONCEPTS_DIR = os.path.join(PROJECT_ROOT, 'Concepts')
GAMES_DIR = os.path.join(PROJECT_ROOT, 'Games')

def migrate():
    if not os.path.exists(GAMES_DIR):
        print("Games directory not found.")
        return

    for item in os.listdir(GAMES_DIR):
        source_path = os.path.join(GAMES_DIR, item)
        
        if os.path.isdir(source_path):
            category = item
            target_concept_dir = os.path.join(CONCEPTS_DIR, category)
            
            if os.path.exists(target_concept_dir):
                target_games_dir = os.path.join(target_concept_dir, 'Games')
                if not os.path.exists(target_games_dir):
                    os.makedirs(target_games_dir)
                
                # Move contents
                print(f"Migrating {category} games to {target_games_dir}")
                for game_file in os.listdir(source_path):
                    src = os.path.join(source_path, game_file)
                    dst = os.path.join(target_games_dir, game_file)
                    if os.path.exists(dst):
                        print(f"Skipping {game_file}, already exists.")
                    else:
                        shutil.move(src, dst)
                        print(f"Moved {game_file}")
                
                # Remove empty dir
                try:
                    os.rmdir(source_path)
                    print(f"Removed empty directory {source_path}")
                except OSError:
                    print(f"Directory {source_path} not empty, keeping.")
            else:
                print(f"No matching Concept found for {category}, skipping.")
        else:
            print(f"Skipping file {item}")

if __name__ == "__main__":
    migrate()
