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
	
	if class_data.has("date") and class_data.date != "":
		safe_name += "_" + class_data.date
	
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

func save_game(game_data):
	var title = game_data.get("title", "Untitled")
	var category = game_data.get("category", "Uncategorized")
	
	# Sanitization
	var safe_title = title.strip_edges().replace(" ", "-").replace("/", "")
	var safe_cat = category.strip_edges()
	
	var concepts_dir = PROJECT_ROOT.path_join("Concepts")
	var cat_dir = concepts_dir.path_join(safe_cat)
	var games_dir = cat_dir.path_join("Games")
	
	if not DirAccess.dir_exists_absolute(games_dir):
		var err = DirAccess.make_dir_recursive_absolute(games_dir)
		if err != OK:
			print("Error creating directory: ", games_dir)
			return false
		
	var filename = safe_title + ".md"
	var path = games_dir.path_join(filename)
	
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		# Write Frontmatter
		file.store_string("---\n")
		file.store_string("title: %s\n" % title)
		file.store_string("category: %s\n" % category)
		if game_data.has("duration"): file.store_string("duration: %s\n" % str(game_data.duration))
		if game_data.has("players"): file.store_string("players: %s\n" % str(game_data.players))
		if game_data.has("type"): file.store_string("type: %s\n" % game_data.type)
		if game_data.has("intensity"): file.store_string("intensity: %s\n" % game_data.intensity)
		if game_data.has("difficulty"): file.store_string("difficulty: %s\n" % game_data.difficulty)
		if game_data.has("initiation"): file.store_string("initiation: %s\n" % game_data.initiation)
		if game_data.has("focus"): file.store_string("focus: %s\n" % game_data.focus)
		file.store_string("---\n\n")
		
		# Write Description
		file.store_string(game_data.get("description", ""))
		file.close()
		print("Saved game to: ", path)
		return true
		
	print("Failed to write to: ", path)
	return false

func save_concept(concept_data):
	var title = concept_data.get("title", "Untitled")
	# Determine path: use existing if available, else standard structure
	var path = concept_data.get("path", "")
	
	if path == "":
		var safe_title = title.strip_edges().replace(" ", "-") # Simple safe name
		# Path: Concepts/Name/Name.md
		var folder = PROJECT_ROOT.path_join("Concepts").path_join(safe_title)
		if not DirAccess.dir_exists_absolute(folder):
			DirAccess.make_dir_recursive_absolute(folder)
		path = folder.path_join(safe_title + ".md")
		
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file:
		# Write as Markdown
		var content = concept_data.get("content", "")
		# If content doesn't start with heading, add it?
		if not content.strip_edges().begins_with("#"):
			# Optionally ensure title is there, but user might have edited it in content
			pass 
		
		# Since we treat the whole text as "content", just write it.
		# Ideally we parse title from first line if we want to sync them, 
		# but simplification: just write content.
		file.store_string(content)
		file.close()
		print("Saved concept to: ", path)
		return true
		
	print("Failed to save concept: ", path)
	return false

func copy_image_to_project(source_path):
	# Create Images dir if needed
	var images_dir = PROJECT_ROOT.path_join("Images")
	if not DirAccess.dir_exists_absolute(images_dir):
		DirAccess.make_dir_absolute(images_dir)
	return copy_image_to_target(source_path, images_dir)

func copy_image_to_target(source_path, target_dir):
	var ext = source_path.get_extension()
	var file_name = source_path.get_file().get_basename()
	
	# Unique name to prevent collision
	var timestamp = str(Time.get_unix_time_from_system()).replace(".", "")
	var new_name = "%s_%s.%s" % [file_name, timestamp, ext]
	var dest_path = target_dir.path_join(new_name)
	
	var err = DirAccess.copy_absolute(source_path, dest_path)
	if err == OK:
		print("Image copied to: ", dest_path)
		return dest_path
	else:
		print("Error copying image: ", err)
		return ""


