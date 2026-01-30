extends Control

# Main.gd
# 2-Column Layout with Modal Game Picker to match Web App exactly

# Nodes
var left_sidebar: VBoxContainer
var timeline_container: VBoxContainer
var class_name_input: LineEdit
var concept_select: OptionButton
var date_label: Label
var game_picker_modal: Window
var game_picker_tree: Tree
var picker_target_section = ""

# Data State
var current_class_data = {} # { "standing": [game1...], ... }
var selected_concept_id = ""

var CLASS_TEMPLATE = [
	{ "id": "standing", "title": "Standing", "duration": 10 },
	{ "id": "mobility", "title": "Mobility", "duration": 15 },
	{ "id": "takedowns", "title": "Takedowns", "duration": 15 },
	{ "id": "discussion", "title": "Discussion", "duration": 5 },
	{ "id": "applications", "title": "Concept Applications", "duration": 30 },
	{ "id": "review", "title": "Review", "duration": 5 },
	{ "id": "rolling", "title": "Free Roll", "duration": 15 }
]

const COL_BG = Color("#0f172a")
const COL_PANEL = Color("#1e293b")
const COL_ACCENT = Color("#3b82f6")

func _ready():
	_apply_theme()
	_build_ui()
	_init_class_data()
	_build_game_picker()
	
	DataManager.data_loaded.connect(_on_data_loaded)
	call_deferred("_start_scan")

func _apply_theme():
	RenderingServer.set_default_clear_color(COL_BG)

func _start_scan():
	DataManager.scan_all()

func _init_class_data():
	current_class_data = {}
	for sec in CLASS_TEMPLATE:
		current_class_data[sec.id] = []
	
	if timeline_container:
		_refresh_timeline()

func _get_stylebox(color, radius=8):
	var sb = StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	return sb

func _build_ui():
	# Root
	var margin = MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	add_child(margin)
	
	var h_split = HSplitContainer.new()
	# Set split offset to give sidebar about 300px
	h_split.split_offset = 350
	margin.add_child(h_split)
	
	# === LEFT SIDEBAR (1/3 approx) ===
	var left_panel = PanelContainer.new()
	left_panel.custom_minimum_size = Vector2(320, 0)
	left_panel.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL))
	h_split.add_child(left_panel)
	
	left_sidebar = VBoxContainer.new()
	left_sidebar.add_theme_constant_override("separation", 15)
	left_panel.add_child(left_sidebar)
	
	var title = Label.new()
	title.text = "BJJ Class Planner"
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", COL_ACCENT)
	left_sidebar.add_child(title)
	
	class_name_input = LineEdit.new()
	class_name_input.placeholder_text = "Class Title"
	class_name_input.custom_minimum_size.y = 40
	left_sidebar.add_child(class_name_input)
	
	date_label = Label.new()
	date_label.text = Time.get_date_string_from_system()
	left_sidebar.add_child(date_label)
	
	left_sidebar.add_child(HSeparator.new())
	
	var concept_lbl = Label.new()
	concept_lbl.text = "Core Concept"
	left_sidebar.add_child(concept_lbl)
	
	var concept_hbox = HBoxContainer.new()
	left_sidebar.add_child(concept_hbox)
	
	concept_select = OptionButton.new()
	concept_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	concept_select.item_selected.connect(_on_concept_selected)
	concept_hbox.add_child(concept_select)
	
	var add_concept_btn = Button.new()
	add_concept_btn.text = "+"
	concept_hbox.add_child(add_concept_btn)
	
	var instr_lbl = Label.new()
	instr_lbl.text = "Select a concept to generate a class structure."
	instr_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	instr_lbl.add_theme_color_override("font_color", Color("#94a3b8"))
	left_sidebar.add_child(instr_lbl)
	
	var spacer = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_sidebar.add_child(spacer)
	
	var save_btn = Button.new()
	save_btn.text = "Save Class"
	save_btn.custom_minimum_size.y = 40
	save_btn.pressed.connect(_on_save_pressed)
	left_sidebar.add_child(save_btn)
	
	var load_btn = Button.new()
	load_btn.text = "Load Class"
	load_btn.custom_minimum_size.y = 40
	# load_btn.pressed.connect(_on_load_pressed)
	left_sidebar.add_child(load_btn)
	
	var print_btn = Button.new()
	print_btn.text = "Print / PDF"
	print_btn.custom_minimum_size.y = 40
	left_sidebar.add_child(print_btn)
	
	# === RIGHT MAIN AREA (2/3) ===
	var main_panel = PanelContainer.new()
	main_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# Make it transparent or similar to bg
	var style = _get_stylebox(Color(0,0,0,0)) # Transparent
	main_panel.add_theme_stylebox_override("panel", style)
	h_split.add_child(main_panel)
	
	var right_vbox = VBoxContainer.new()
	main_panel.add_child(right_vbox)
	
	var class_header_lbl = Label.new()
	class_header_lbl.text = "Class"
	class_header_lbl.add_theme_font_size_override("font_size", 28)
	right_vbox.add_child(class_header_lbl)
	
	var scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right_vbox.add_child(scroll)
	
	timeline_container = VBoxContainer.new()
	timeline_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	timeline_container.add_theme_constant_override("separation", 20)
	scroll.add_child(timeline_container)

func _build_game_picker():
	game_picker_modal = Window.new()
	game_picker_modal.title = "Select a Game"
	game_picker_modal.initial_position = Window.WINDOW_INITIAL_POSITION_CENTER_MAIN_WINDOW_SCREEN
	game_picker_modal.size = Vector2(600, 500)
	game_picker_modal.visible = false
	game_picker_modal.exclusive = true
	game_picker_modal.close_requested.connect(func(): game_picker_modal.hide())
	add_child(game_picker_modal)
	
	var panel = PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL, 0))
	game_picker_modal.add_child(panel)
	
	var vbox = VBoxContainer.new()
	panel.add_child(vbox)
	
	var label = Label.new()
	label.text = "Double click a game to add it"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(label)
	
	game_picker_tree = Tree.new()
	game_picker_tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	game_picker_tree.hide_root = true
	game_picker_tree.item_activated.connect(_on_picker_item_activated)
	vbox.add_child(game_picker_tree)
	
	var cancel_btn = Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.pressed.connect(func(): game_picker_modal.hide())
	vbox.add_child(cancel_btn)

func _on_data_loaded():
	# Populate Concepts Dropdown
	concept_select.clear()
	concept_select.add_item("Select a Concept...")
	concept_select.set_item_disabled(0, true)
	
	for i in range(DataManager.concepts.size()):
		var c = DataManager.concepts[i]
		concept_select.add_item(c.title, i) # Store index as ID
	
	_populate_picker_tree()
	_refresh_timeline()

func _populate_picker_tree():
	game_picker_tree.clear()
	var root = game_picker_tree.create_item()
	
	var cats = DataManager.categories
	for cat_id in cats:
		var cat_data = cats[cat_id]
		var cat_item = game_picker_tree.create_item(root)
		cat_item.set_text(0, cat_data.title)
		cat_item.set_selectable(0, false)
		
		for game_id in cat_data.games:
			var game = _find_game_by_id(game_id)
			if game:
				var item = game_picker_tree.create_item(cat_item)
				item.set_text(0, game.title)
				item.set_metadata(0, game)

func _find_game_by_id(id):
	for g in DataManager.games:
		if g.id == id:
			return g
	return null

func _on_concept_selected(idx):
	# index in optionbutton (starts at 1 for real items because 0 is disabled)
	# But we stored DataManager index as ID.
	var concept_idx = concept_select.get_item_id(idx)
	if concept_idx >= 0:
		var c = DataManager.concepts[concept_idx]
		selected_concept_id = c.id
		_refresh_timeline()

func _refresh_timeline():
	for c in timeline_container.get_children():
		c.queue_free()
	
	var concept_obj = null
	if selected_concept_id != "":
		for c in DataManager.concepts:
			if c.id == selected_concept_id:
				concept_obj = c
				break
	
	for sec in CLASS_TEMPLATE:
		var sec_games = current_class_data[sec.id]
		
		# Section Container
		var sec_box = VBoxContainer.new()
		timeline_container.add_child(sec_box)
		
		# Header (Collapsible look)
		var header_hbox = HBoxContainer.new()
		sec_box.add_child(header_hbox)
		
		var toggle_btn = Button.new()
		toggle_btn.text = "v"
		toggle_btn.flat = true
		header_hbox.add_child(toggle_btn)
		
		var title = Label.new()
		title.text = sec.title
		title.add_theme_font_size_override("font_size", 18)
		header_hbox.add_child(title)
		
		var dur_lbl = Label.new()
		dur_lbl.text = "(%d min)" % sec.duration
		dur_lbl.add_theme_color_override("font_color", Color("#cbd5e1"))
		header_hbox.add_child(dur_lbl)
		
		# Content Box with border
		var content_panel = PanelContainer.new()
		content_panel.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL, 5))
		sec_box.add_child(content_panel)
		
		var content_vbox = VBoxContainer.new()
		content_panel.add_child(content_vbox)
		
		# Special handling for Discussion
		if sec.id == "discussion":
			var disc_lbl = RichTextLabel.new()
			disc_lbl.fit_content = true
			disc_lbl.bbcode_enabled = true
			if concept_obj:
				# Show full or partial text?
				disc_lbl.text = "[b]" + concept_obj.title + "[/b]\n" + concept_obj.content
			else:
				disc_lbl.text = "[i]Select a concept to view discussion topics.[/i]"
			content_vbox.add_child(disc_lbl)
		else:
			# List Games
			for i in range(sec_games.size()):
				var g = sec_games[i]
				var game_card = PanelContainer.new()
				game_card.add_theme_stylebox_override("panel", _get_stylebox(Color("#334155"), 5))
				content_vbox.add_child(game_card)
				
				var card_vbox = VBoxContainer.new()
				game_card.add_child(card_vbox)
				
				var row = HBoxContainer.new()
				card_vbox.add_child(row)
				
				var g_title = Label.new()
				g_title.text = g.title
				g_title.add_theme_color_override("font_color", Color("#60a5fa"))
				g_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_child(g_title)
				
				var rem_btn = Button.new()
				rem_btn.text = "x"
				rem_btn.flat = true
				rem_btn.pressed.connect(_remove_game.bind(sec.id, i))
				row.add_child(rem_btn)
				
				var details = Label.new()
				details.text = "%s | %s" % [g.duration, g.players]
				details.add_theme_font_size_override("font_size", 12)
				card_vbox.add_child(details)
				
				if g.has("description"):
					var desc_lbl = RichTextLabel.new()
					desc_lbl.text = g.description.left(100) + "..."
					desc_lbl.fit_content = true
					desc_lbl.add_theme_color_override("default_color", Color("#94a3b8"))
					card_vbox.add_child(desc_lbl)
			
			# + Add Game Button
			var add_btn = Button.new()
			add_btn.text = "+ Add Game"
			add_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
			add_btn.pressed.connect(func(): _open_game_picker(sec.id))
			content_vbox.add_child(add_btn)

func _remove_game(sec_id, idx):
	current_class_data[sec_id].remove_at(idx)
	_refresh_timeline()

func _open_game_picker(sec_id):
	picker_target_section = sec_id
	game_picker_modal.popup_centered()

func _on_picker_item_activated():
	var item = game_picker_tree.get_selected()
	if not item: return
	
	var g = item.get_metadata(0)
	if g:
		current_class_data[picker_target_section].append(g)
		game_picker_modal.hide()
		_refresh_timeline()

func _on_save_pressed():
	var name = class_name_input.text
	if name.strip_edges() == "":
		print("Name required")
		return
	
	var save_data = {
		"name": name,
		"segments": current_class_data,
		"concept_id": selected_concept_id
	}
	DataManager.save_class(name, save_data)
