extends Node

# DataManager.gd
# Handles loading of Concepts, Games, and Classes from the file system.
# Mirrors the logic of generate_content.py

signal data_loaded

var concepts = []
var categories = {}
var games = []

# Paths relative to the project root (when running from editor) or executable (exported)
# content is in ../Concepts and ../Games relative to this project folder
var PROJECT_ROOT = ""

func _ready():
	_determine_project_root()

func _determine_project_root():
	# In Editor: res:// is project folder. Real data is up one level.
	# Exported: Executable is usually in a bin folder or root. 
	# For now, let's assume we function relative to the 'Eco-BJJ' root.
	
	if OS.has_feature("editor"):
		# res://../ maps to the parent of the project folder
		# But Godot res:// checks are sandboxed. We need absolute paths for OS functions.
		var script_path = ProjectSettings.globalize_path("res://")
		# script_path is .../bjj-class-planner/
		PROJECT_ROOT = script_path.path_join("../")
	else:
		# Exported builds: adjacent to executable?
		PROJECT_ROOT = OS.get_executable_path().get_base_dir().path_join("../")
	
	print("Data Root determined as: ", PROJECT_ROOT)

func scan_all():
	print("Scanning data...")
	concepts = _scan_concepts()
	var cats_and_games = _scan_games()
	categories = cats_and_games.categories
	games = cats_and_games.games
	print("Scan complete. Found %d concepts, %d categories, %d games." % [concepts.size(), categories.size(), games.size()])
	emit_signal("data_loaded")

func _scan_concepts():
	var result = []
	var concepts_dir = PROJECT_ROOT.path_join("Concepts")
	
	var dir = DirAccess.open(concepts_dir)
	if dir:
		dir.list_dir_begin()
		var file_name = dir.get_next()
		while file_name != "":
			if dir.current_is_dir() and not file_name.begins_with("."):
				# This is a concept folder
				var concept_path = concepts_dir.path_join(file_name)
				var concept_data = _parse_concept_folder(concept_path, file_name)
				if concept_data:
					result.append(concept_data)
			file_name = dir.get_next()
	else:
		print("Failed to open Concepts dir: ", concepts_dir)
	
	return result

func _parse_concept_folder(path, folder_name):
	# Look for {folder_name}.md
	var md_filename = folder_name + ".md"
	var files = []
	
	# Fallback search if exact name not found?
	# For now, stick to the pattern
	var full_path = path.path_join(md_filename)
	
	if not FileAccess.file_exists(full_path):
		return null
		
	var content = FileAccess.get_file_as_string(full_path)
	var title = folder_name # Default
	
	# Simple regex for title "# Title"
	var regex = RegEx.new()
	regex.compile("^#\\s+(.*)")
	var match = regex.search(content)
	if match:
		title = match.get_string(1).strip_edges()
		
	return {
		"id": title.to_lower().replace(" ", "-"),
		"title": title,
		"content": content,
		"path": full_path,
		"folder": path
	}

func _scan_games():
	var cats = {}
	var all_games = []
	var concepts_dir = PROJECT_ROOT.path_join("Concepts")
	
	var dir = DirAccess.open(concepts_dir)
	if dir:
		dir.list_dir_begin()
		var folder_name = dir.get_next()
		while folder_name != "":
			if dir.current_is_dir() and not folder_name.begins_with("."):
				var games_dir = concepts_dir.path_join(folder_name).path_join("Games")
				if DirAccess.dir_exists_absolute(games_dir):
					# Init category
					if not cats.has(folder_name):
						cats[folder_name] = {
							"id": folder_name.to_lower().replace(" ", "-"),
							"title": folder_name,
							"games": []
						}
					
					var game_files = _get_files_in_dir(games_dir, "md")
					for gf in game_files:
						var g_path = games_dir.path_join(gf)
						var parsed_games = _parse_game_file(g_path)
						for g in parsed_games:
							g["category"] = folder_name # Force category match
							g["id"] = (folder_name + "-" + g["title"]).to_lower().replace(" ", "-")
							g["path"] = g_path
							
							cats[folder_name]["games"].append(g["id"])
							all_games.append(g)
							
			folder_name = dir.get_next()
			
	return {"categories": cats, "games": all_games}

func _get_files_in_dir(path, ext):
	var files = []
	var dir = DirAccess.open(path)
	if dir:
		dir.list_dir_begin()
		var n = dir.get_next()
		while n != "":
			if not dir.current_is_dir() and n.get_extension() == ext:
				files.append(n)
			n = dir.get_next()
	return files

func _parse_game_file(path):
	var games_list = []
	var content = FileAccess.get_file_as_string(path)
	
	if content.begins_with("---"):
		var parts = content.split("---", false) # Split by ---
		# parts[0] is frontmatter (because empty string before first --- is removed if allow_empty=false? Wait.)
		# actually if string is "---\nfoo\n---\nbar", split("---") -> ["", "\nfoo\n", "\nbar"]
		parts = content.split("---")
		
		# Expected: [empty, frontmatter, body]
		if parts.size() >= 3:
			var fm = parts[1]
			var body = parts[2].strip_edges()
			
			var meta = _parse_yaml(fm)
			
			var game = {
				"title": meta.get("title", "Unknown"),
				"description": body,
				"category": meta.get("category", ""),
				"duration": meta.get("duration", ""),
				"players": meta.get("players", ""),
				"type": meta.get("type", ""),
				"intensity": meta.get("intensity", ""),
			}
			# Add other fields if needed
			
			games_list.append(game)
	
	return games_list

func _parse_yaml(text):
	var res = {}
	var lines = text.split("\n")
	for line in lines:
		if ":" in line:
			var p = line.split(":", true, 1)
			var k = p[0].strip_edges()
			var v = p[1].strip_edges()
			res[k] = v
	return res

func save_class(name, class_data):
	var safe_name = name.strip_edges().replace(" ", "_").replace("/", "").replace("\\", "")
	# Simple sanitization
	
	var filename = safe_name + ".json"
	var save_dir = PROJECT_ROOT.path_join("Saved Classes")
	
	if not DirAccess.dir_exists_absolute(save_dir):
		DirAccess.make_dir_absolute(save_dir)
		
	var path = save_dir.path_join(filename)
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		var json = JSON.stringify(class_data, "\t")
		file.store_string(json)
		file.close()
		print("Saved class to: ", path)
		return true
	print("Failed to write to: ", path)
	return false

func list_classes():
	var classes = []
	var save_dir = PROJECT_ROOT.path_join("Saved Classes")
	var dir = DirAccess.open(save_dir)
	if dir:
		dir.list_dir_begin()
		var n = dir.get_next()
		while n != "":
			if not dir.current_is_dir() and n.ends_with(".json"):
				classes.append(n.replace(".json", "").replace("_", " "))
			n = dir.get_next()
	return classes

func load_class(name):
	var safe_name = name.strip_edges().replace(" ", "_")
	var path = PROJECT_ROOT.path_join("Saved Classes").path_join(safe_name + ".json")
	if FileAccess.file_exists(path):
		var content = FileAccess.get_file_as_string(path)
		var json = JSON.new()
		var err = json.parse(content)
		if err == OK:
			return json.data
	return null

func delete_class(name):
	var safe_name = name.strip_edges().replace(" ", "_")
	var path = PROJECT_ROOT.path_join("Saved Classes").path_join(safe_name + ".json")
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)
		return true
	return false
