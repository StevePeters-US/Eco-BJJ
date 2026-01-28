import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_persistence():
    print("Testing Persistence...")
    
    # 1. Define Test Data
    test_title = "Headless_Verification_Title"
    test_data = {
        "title": test_title,
        "conceptId": "mobility",
        "segments": {
            "mobility": [
                {"gameId": "test-game-1", "title": "Test Game"}
            ]
        }
    }
    
    # 2. Save Class
    print(f"Saving class '{test_title}'...")
    save_payload = {
        "name": test_title,
        "data": test_data
    }
    try:
        resp = requests.post(f"{BASE_URL}/api/save_class", json=save_payload)
        if resp.status_code != 200:
            print(f"FAILED: Save failed with {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"FAILED: Connection error during save: {e}")
        return False
        
    print("Save successful.")
    
    # 3. List Classes (Verify existence)
    print("Listing classes...")
    try:
        resp = requests.get(f"{BASE_URL}/api/list_classes")
        data = resp.json()
        classes = data.get("classes", [])
        if test_title not in classes and test_title.replace("_", " ") not in classes:
            print(f"FAILED: '{test_title}' (or space-replaced) not found in saved classes list: {classes}")
            return False
            
        # Use the name as found in the list for loading (if the server requires the exact list name or the original name?)
        # The load endpoint likely does the reverse transformation or accepts the display name.
        load_name = test_title
        if test_title.replace("_", " ") in classes:
            load_name = test_title.replace("_", " ")
    except Exception as e:
        print(f"FAILED: Error listing classes: {e}")
        return False
        
    print(f"Class '{test_title}' found in list.")
    
    # 4. Load Class (Verify content)
    print("Loading class...")
    try:
        resp = requests.post(f"{BASE_URL}/api/load_class", json={"name": test_title})
        if resp.status_code != 200:
            print(f"FAILED: Load failed with {resp.status_code}")
            return False
            
        loaded_data = resp.json().get("data", {})
        
        # Verify Title
        if loaded_data.get("title") != test_title:
            print(f"FAILED: Title mismatch. Expected '{test_title}', got '{loaded_data.get('title')}'")
            return False
            
        # Verify Segments
        segments = loaded_data.get("segments", {})
        if "mobility" not in segments:
            print("FAILED: 'mobility' segment missing.")
            return False
            
        games = segments["mobility"]
        if len(games) != 1 or games[0].get("gameId") != "test-game-1":
            print(f"FAILED: Game mismatch. Got {games}")
            return False
            
    except Exception as e:
        print(f"FAILED: Error loading class: {e}")
        return False
        
    print("VERIFICATION PASSED: Class saved and loaded correctly.")
    return True

if __name__ == "__main__":
    success = test_persistence()
    if not success:
        sys.exit(1)
