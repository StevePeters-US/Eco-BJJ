extends Control

# Main.gd
# Refined UI matches Web App: Tags in Header, Full Edit Modal, Load/Save working

# Nodes
var left_sidebar: VBoxContainer
var timeline_container: VBoxContainer
var class_name_input: LineEdit
var date_input # Was LineEdit, now CalendarButton
var concept_select: OptionButton
var class_header_lbl: Label
var game_picker_modal: Window
var game_picker_tree: Tree
var input_modal: Window
var input_field: LineEdit
var input_confirm_callback: Callable
var picker_target_section = ""
var picker_filter_select: OptionButton # New Filter


# Load Modal
var load_modal: Window
var load_list: ItemList

# Edit Modal
var edit_modal: Window
var edit_fields = {} # Dictionary to store references to input nodes
var edit_callback: Callable

var concept_edit_modal: Window
var concept_edit_fields = {}

var file_dialog: FileDialog
var active_text_edit: TextEdit # Tracks which TextEdit is focused for image insertion


# Data State
var current_class_data = {} 
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

const COL_BG = Color("#0f1115")
const COL_PANEL = Color("#161b22")
const COL_CARD = Color("#21262d")
const COL_ACCENT = Color("#58a6ff") # Kept as alias for Blue
const COL_ACCENT_GREEN = Color("#238636")
const COL_TEXT_PRIM = Color("#f0f6fc")
const COL_TEXT_SEC = Color("#8b949e")
const COL_BORDER = Color("#30363d")

func _ready():
	_apply_theme()
	_build_ui()
	_init_class_data()
	_build_modals()
	
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

func _get_stylebox(color, radius=12):
	var sb = StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(radius)
	
	# Add Shadow
	if color.a > 0:
		sb.shadow_size = 4
		sb.shadow_color = Color(0, 0, 0, 0.3)
	
	if color.a == 0:
		sb.content_margin_left = 0
	else:
		sb.content_margin_left = 16
		sb.content_margin_right = 16
		sb.content_margin_top = 16
		sb.content_margin_bottom = 16
	return sb

func _build_ui():
	var margin = MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	add_child(margin)
	
	var h_split = HSplitContainer.new()
	h_split.split_offset = 350
	margin.add_child(h_split)
	
	# === LEFT SIDEBAR ===
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
	class_name_input.text_changed.connect(func(_new_text): _update_header_title())
	left_sidebar.add_child(class_name_input)
	
	# Load Calendar Button Script
	var CalendarButtonPayload = preload("res://addons/calendar_button/assets/calendar_button.gd")
	date_input = 	CalendarButtonPayload.new()
	date_input.text = Time.get_date_string_from_system()
	# Apply styling to look like input/button
	var date_style = _get_stylebox(COL_CARD, 6)
	date_style.border_width_left = 1
	date_style.border_width_top = 1
	date_style.border_width_right = 1
	date_style.border_width_bottom = 1
	date_style.border_color = COL_BORDER
	date_style.content_margin_left = 10
	date_input.add_theme_stylebox_override("normal", date_style)
	date_input.add_theme_color_override("font_color", COL_TEXT_SEC)
	date_input.custom_minimum_size.y = 40
	date_input.alignment = HORIZONTAL_ALIGNMENT_LEFT
	
	# Set custom parent to Main Control (self) to avoid clipping in Sidebar
	date_input.custom_parent = self
	
	# Prevent Calendar from resetting to Center
	date_input.anchor_and_offset = Control.PRESET_TOP_LEFT
	
	# Connect signal
	date_input.calendar_confirmed.connect(_on_date_selected)
	
	# Fix Positioning and Sizing
	# Fix Positioning and Sizing
	# Use button_down because _pressed is overridden and doesn't emit pressed
	date_input.button_down.connect(func():
		if date_input.calendar:
			# 1. Fix Transparency: Apply opaque background to the internal PanelContainer
			var panel = date_input.calendar.get_node_or_null("PanelContainer")
			if panel:
				var bg_style = _get_stylebox(COL_BG, 12)
				bg_style.shadow_size = 8
				bg_style.shadow_color = Color(0, 0, 0, 0.4)
				bg_style.border_width_left = 1
				bg_style.border_width_top = 1
				bg_style.border_width_right = 1
				bg_style.border_width_bottom = 1
				bg_style.border_color = COL_BORDER
				panel.add_theme_stylebox_override("panel", bg_style)

			# 2. Fix Layout Stability
			# Stop it from growing from center
			date_input.calendar.set_anchors_preset(Control.PRESET_TOP_LEFT)
			
			# Force stable size (enough for 6 weeks)
			var fixed_size = Vector2(320, 340)
			date_input.calendar.custom_minimum_size = fixed_size
			date_input.calendar.size = fixed_size
			
			# Position exactly under the button
			var btn_global_pos = date_input.global_position
			var btn_size = date_input.size
			date_input.calendar.position = btn_global_pos + Vector2(0, btn_size.y + 5)
	)
	
	left_sidebar.add_child(date_input)
	
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
	add_concept_btn.tooltip_text = "Create New Concept"
	add_concept_btn.pressed.connect(_on_add_concept_pressed)
	concept_hbox.add_child(add_concept_btn)
	
	var instr_lbl = Label.new()
	instr_lbl.text = "Select a concept to generate a class structure."
	instr_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	instr_lbl.add_theme_color_override("font_color", COL_TEXT_SEC)
	left_sidebar.add_child(instr_lbl)
	
	var spacer = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_sidebar.add_child(spacer)
	
	var save_btn = Button.new()
	save_btn.text = "Save Class"
	save_btn.custom_minimum_size.y = 40
	save_btn.pressed.connect(_on_save_pressed)
	# Primary Button Style
	var save_style = _get_stylebox(COL_ACCENT_GREEN, 6)
	save_btn.add_theme_stylebox_override("normal", save_style)
	save_btn.add_theme_color_override("font_color", Color.WHITE)
	left_sidebar.add_child(save_btn)
	
	var new_btn = Button.new()
	new_btn.text = "New Class"
	new_btn.custom_minimum_size.y = 40
	new_btn.pressed.connect(_on_new_class_pressed)
	# Secondary Button Style (Same as Load)
	var sec_style = _get_stylebox(COL_CARD, 6)
	sec_style.border_width_left = 1
	sec_style.border_width_top = 1
	sec_style.border_width_right = 1
	sec_style.border_width_bottom = 1
	sec_style.border_color = COL_BORDER
	new_btn.add_theme_stylebox_override("normal", sec_style)
	new_btn.add_theme_color_override("font_color", COL_TEXT_SEC)
	left_sidebar.add_child(new_btn)
	
	var load_btn = Button.new()
	load_btn.text = "Load Class"
	load_btn.custom_minimum_size.y = 40
	load_btn.pressed.connect(_on_load_pressed)
	# Secondary Button Style
	var load_style = _get_stylebox(COL_CARD, 6)
	load_style.border_width_left = 1
	load_style.border_width_top = 1
	load_style.border_width_right = 1
	load_style.border_width_bottom = 1
	load_style.border_color = COL_BORDER
	load_btn.add_theme_stylebox_override("normal", load_style)
	load_btn.add_theme_color_override("font_color", COL_TEXT_SEC)
	left_sidebar.add_child(load_btn)
	
	var print_btn = Button.new()
	print_btn.text = "Print / PDF"
	print_btn.custom_minimum_size.y = 40
	# Secondary Style
	print_btn.add_theme_stylebox_override("normal", load_style)
	print_btn.add_theme_color_override("font_color", COL_TEXT_SEC)
	left_sidebar.add_child(print_btn)
	
	# === RIGHT MAIN AREA ===
	var main_panel = PanelContainer.new()
	main_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var style = _get_stylebox(Color(0,0,0,0))
	main_panel.add_theme_stylebox_override("panel", style)
	h_split.add_child(main_panel)
	
	var right_vbox = VBoxContainer.new()
	main_panel.add_child(right_vbox)
	
	class_header_lbl = Label.new()
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

	# Window Controls Overlay (Top Right)
	var win_hb = HBoxContainer.new()
	win_hb.layout_direction = Control.LAYOUT_DIRECTION_LTR
	win_hb.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	win_hb.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	# Small padding from edges
	win_hb.offset_top = 5
	win_hb.offset_right = -5
	
	add_child(win_hb)
	
	var min_btn = Button.new()
	min_btn.text = " — "
	min_btn.flat = true
	min_btn.add_theme_color_override("font_color", Color("#94a3b8"))
	min_btn.pressed.connect(func(): DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MINIMIZED))
	win_hb.add_child(min_btn)
	
	var close_btn = Button.new()
	close_btn.text = " ✕ "
	close_btn.flat = true
	close_btn.add_theme_color_override("font_color", Color("#ef4444")) # Red close
	close_btn.pressed.connect(func(): get_tree().quit())
	win_hb.add_child(close_btn)

func _build_modals():
	# Game Picker
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
	
	# Header Row: Filter | New Game
	var header_row = HBoxContainer.new()
	vbox.add_child(header_row)
	
	picker_filter_select = OptionButton.new()
	picker_filter_select.custom_minimum_size.x = 200
	picker_filter_select.item_selected.connect(func(idx): _populate_picker_tree())
	header_row.add_child(picker_filter_select)
	
	var spacer = Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_row.add_child(spacer)
	
	var new_game_btn = Button.new()
	new_game_btn.text = "+ New Game"
	new_game_btn.flat = true
	new_game_btn.add_theme_color_override("font_color", Color("#94a3b8"))
	new_game_btn.pressed.connect(_on_new_game_pressed)
	header_row.add_child(new_game_btn)
	
	var close_btn = Button.new()
	close_btn.text = "✕"
	close_btn.flat = true
	close_btn.add_theme_color_override("font_color", Color("#94a3b8"))
	close_btn.pressed.connect(func(): game_picker_modal.hide())
	header_row.add_child(close_btn)
	
	game_picker_tree = Tree.new()

	game_picker_tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	game_picker_tree.hide_root = true
	game_picker_tree.item_activated.connect(_on_picker_item_activated)
	vbox.add_child(game_picker_tree)
	
	var cancel_btn = Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.pressed.connect(func(): game_picker_modal.hide())
	vbox.add_child(cancel_btn)
	
	# Input Modal (Reusable)
	input_modal = Window.new()
	input_modal.title = "Input"
	input_modal.initial_position = Window.WINDOW_INITIAL_POSITION_CENTER_MAIN_WINDOW_SCREEN
	input_modal.size = Vector2(300, 150)
	input_modal.visible = false
	input_modal.exclusive = true
	input_modal.close_requested.connect(func(): input_modal.hide())
	add_child(input_modal)
	
	var i_panel = PanelContainer.new()
	i_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	i_panel.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL, 0))
	input_modal.add_child(i_panel)
	
	var i_vbox = VBoxContainer.new()
	i_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	i_panel.add_child(i_vbox)
	
	input_field = LineEdit.new()
	input_field.placeholder_text = "Enter name..."
	i_vbox.add_child(input_field)
	
	var ok_btn = Button.new()
	ok_btn.text = "OK"
	ok_btn.pressed.connect(_on_input_confirm)
	i_vbox.add_child(ok_btn)

	# Load Modal
	_build_load_modal()
	
	# Edit Modal (Complex)
	_build_edit_modal()
	_build_concept_edit_modal()
	
	# File Dialog
	_build_file_dialog()

func _build_file_dialog():
	file_dialog = FileDialog.new()
	file_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	file_dialog.access = FileDialog.ACCESS_FILESYSTEM
	file_dialog.filters = ["*.png, *.jpg, *.jpeg, *.webp ; Images"]
	file_dialog.size = Vector2(800, 600)
	file_dialog.initial_position = Window.WINDOW_INITIAL_POSITION_CENTER_MAIN_WINDOW_SCREEN
	file_dialog.visible = false
	file_dialog.file_selected.connect(_on_file_selected)
	add_child(file_dialog)


func _build_load_modal():
	load_modal = Window.new()
	load_modal.title = "Load Class Plan"
	load_modal.initial_position = Window.WINDOW_INITIAL_POSITION_CENTER_MAIN_WINDOW_SCREEN
	load_modal.size = Vector2(400, 500)
	load_modal.visible = false
	load_modal.exclusive = true
	load_modal.close_requested.connect(func(): load_modal.hide())
	add_child(load_modal)
	
	var p = PanelContainer.new()
	p.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL, 0))
	load_modal.add_child(p)
	
	var v = VBoxContainer.new()
	p.add_child(v)
	
	load_list = ItemList.new()
	load_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	load_list.item_activated.connect(_on_load_item_activated)
	v.add_child(load_list)
	
	var c_btn = Button.new()
	c_btn.text = "Cancel"
	c_btn.pressed.connect(func(): load_modal.hide())
	v.add_child(c_btn)

func _build_edit_modal():
	edit_modal = Window.new()
	edit_modal.title = "Edit Game"
	edit_modal.size = Vector2(500, 600)
	edit_modal.visible = false
	edit_modal.exclusive = true
	edit_modal.close_requested.connect(func(): edit_modal.hide())
	add_child(edit_modal)
	
	var p = PanelContainer.new()
	p.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL))
	edit_modal.add_child(p)
	
	var scroll = ScrollContainer.new()
	p.add_child(scroll)
	
	var v = VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	scroll.add_child(v)
	
	# Fields
	edit_fields["title"] = _add_edit_field(v, "Game Title", "LineEdit")
	edit_fields["category"] = _add_edit_field(v, "Category", "OptionButton", ["Grips", "Takedowns", "Passing", "Guard", "Submission", "Positional"])
	
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 20)
	v.add_child(row)
	
	# Left VBox
	var v1 = VBoxContainer.new()
	v1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(v1)
	edit_fields["players"] = _add_edit_field(v1, "Players", "LineEdit") # Or Spin
	edit_fields["difficulty"] = _add_edit_field(v1, "Difficulty", "OptionButton", ["Beginner", "Intermediate", "Advanced"])
	
	# Right VBox
	var v2 = VBoxContainer.new()
	v2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(v2)
	edit_fields["duration"] = _add_edit_field(v2, "Round Time (mins)", "LineEdit")
	edit_fields["intensity"] = _add_edit_field(v2, "Intensity", "OptionButton", ["Low", "Flow", "Medium", "High"])
	
	edit_fields["type"] = _add_edit_field(v, "Type", "OptionButton", ["Standard", "Alternating", "Live", "Situational"])
	edit_fields["initiation"] = _add_edit_field(v, "Game Initiation Conditions", "OptionButton", ["Static", "Inertial", "Separated", "Disengaged"])
	
	# Focus / Notes (TextArea)
	var l = Label.new()
	l.text = "Focus / Notes"
	v.add_child(l)
	var te = TextEdit.new()
	te.custom_minimum_size.y = 80
	te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	te.focus_entered.connect(func(): active_text_edit = te)
	v.add_child(te)
	edit_fields["focus"] = te
	
	# Description (TextArea with Image Support)
	var desc_row = HBoxContainer.new()
	v.add_child(desc_row)
	
	var dl = Label.new()
	dl.text = "Description"
	dl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dl.add_theme_color_override("font_color", Color("#94a3b8"))
	dl.add_theme_font_size_override("font_size", 12)
	desc_row.add_child(dl)
	
	var img_btn = Button.new()
	img_btn.text = "+ Insert Image"
	img_btn.custom_minimum_size = Vector2(100, 0)
	img_btn.add_theme_font_size_override("font_size", 10)
	img_btn.pressed.connect(func(): 
		active_text_edit = edit_fields["description"]
		file_dialog.popup_centered()
	)
	desc_row.add_child(img_btn)
	
	var d_te = TextEdit.new()
	d_te.custom_minimum_size.y = 150
	d_te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	d_te.focus_entered.connect(func(): active_text_edit = d_te)
	v.add_child(d_te)
	edit_fields["description"] = d_te
	
	var btn_row = HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_END
	btn_row.add_theme_constant_override("separation", 10)
	v.add_child(btn_row)
	
	var var_btn = Button.new()
	var_btn.text = "Save as Variation"
	var_btn.pressed.connect(_on_save_variation_pressed)
	btn_row.add_child(var_btn)
	
	var save_btn = Button.new()
	save_btn.text = "Save Changes"
	save_btn.pressed.connect(func(): if edit_callback.is_valid(): edit_callback.call())
	btn_row.add_child(save_btn)

var concept_preview_label: RichTextLabel

func _build_concept_edit_modal():
	concept_edit_modal = Window.new()
	concept_edit_modal.title = "Edit Concept"
	concept_edit_modal.size = Vector2(1000, 800)
	concept_edit_modal.visible = false
	concept_edit_modal.exclusive = true
	concept_edit_modal.close_requested.connect(func(): concept_edit_modal.hide())
	add_child(concept_edit_modal)
	
	var p = PanelContainer.new()
	p.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL))
	concept_edit_modal.add_child(p)
	
	var split = HSplitContainer.new()
	split.split_offset = 500
	p.add_child(split)
	
	# === LEFT SIDE (Editor) ===
	var left_vbox = VBoxContainer.new()
	left_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_vbox.add_theme_constant_override("separation", 10)
	split.add_child(left_vbox)
	
	# Fields
	concept_edit_fields["title"] = _add_edit_field(left_vbox, "Concept Title", "LineEdit")
	concept_edit_fields["title"].text_changed.connect(func(_new_text): _update_concept_preview())
	
	# Content Header
	var desc_row = HBoxContainer.new()
	left_vbox.add_child(desc_row)
	
	var dl = Label.new()
	dl.text = "Content"
	dl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dl.add_theme_color_override("font_color", Color("#94a3b8"))
	dl.add_theme_font_size_override("font_size", 12)
	desc_row.add_child(dl)
	
	var img_btn = Button.new()
	img_btn.text = "+ Insert Image"
	img_btn.custom_minimum_size = Vector2(100, 0)
	img_btn.add_theme_font_size_override("font_size", 10)
	img_btn.pressed.connect(func(): 
		active_text_edit = concept_edit_fields["content"]
		_open_smart_image_dialog()
	)
	desc_row.add_child(img_btn)
	
	var d_te = TextEdit.new()
	d_te.size_flags_vertical = Control.SIZE_EXPAND_FILL
	d_te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	d_te.focus_entered.connect(func(): active_text_edit = d_te)
	# Connect for Live Preview
	d_te.text_changed.connect(_update_concept_preview)
	left_vbox.add_child(d_te)
	concept_edit_fields["content"] = d_te
	
	var btn_row = HBoxContainer.new()
	btn_row.alignment = BoxContainer.ALIGNMENT_END
	btn_row.add_theme_constant_override("separation", 10)
	left_vbox.add_child(btn_row)
	
	var save_btn = Button.new()
	save_btn.text = "Save Changes"
	save_btn.pressed.connect(_on_save_concept_pressed)
	btn_row.add_child(save_btn)
	
	# === RIGHT SIDE (Preview) ===
	var right_panel = PanelContainer.new()
	right_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right_panel.add_theme_stylebox_override("panel", _get_stylebox(Color(0,0,0,0.2)))
	split.add_child(right_panel)
	
	var preview_scroll = ScrollContainer.new()
	right_panel.add_child(preview_scroll)
	
	var pv = VBoxContainer.new()
	pv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	preview_scroll.add_child(pv)
	
	var lbl = Label.new()
	lbl.text = "PREVIEW"
	lbl.add_theme_color_override("font_color", Color("#94a3b8"))
	lbl.add_theme_font_size_override("font_size", 10)
	pv.add_child(lbl)
	
	concept_preview_label = RichTextLabel.new()
	concept_preview_label.fit_content = true
	concept_preview_label.bbcode_enabled = true
	concept_preview_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# Default Color
	concept_preview_label.add_theme_color_override("default_color", COL_TEXT_PRIM)
	pv.add_child(concept_preview_label)

func _add_edit_field(parent, label_text, type, options=[]):
	var cont = VBoxContainer.new()
	cont.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(cont)
	
	var l = Label.new()
	l.text = label_text
	l.add_theme_color_override("font_color", Color("#94a3b8"))
	l.add_theme_font_size_override("font_size", 12)
	cont.add_child(l)
	
	if type == "LineEdit":
		var le = LineEdit.new()
		le.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cont.add_child(le)
		return le
	elif type == "OptionButton":
		var ob = OptionButton.new()
		ob.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		for opt in options:
			ob.add_item(opt)
		cont.add_child(ob)
		return ob
	return null

func _on_data_loaded():
	_refresh_concepts_dropdown()
	_populate_picker_tree()
	_refresh_timeline()

func _refresh_concepts_dropdown():
	concept_select.clear()
	concept_select.add_item("Select a Concept...")
	concept_select.set_item_disabled(0, true)
	for i in range(DataManager.concepts.size()):
		var c = DataManager.concepts[i]
		concept_select.add_item(c.title, i)
	
	# Default to placeholder
	concept_select.select(0)

func _populate_picker_tree():
	# 1. Populate Filter if empty
	if picker_filter_select.item_count == 0:
		picker_filter_select.add_item("All Concepts")
		picker_filter_select.set_item_metadata(0, "All")
		for c in DataManager.concepts:
			picker_filter_select.add_item(c.title)
			picker_filter_select.set_item_metadata(picker_filter_select.item_count - 1, c.title)
			
	# 2. Determine Filter
	var filter_txt = "All"
	if picker_filter_select.selected >= 0:
		filter_txt = picker_filter_select.get_item_metadata(picker_filter_select.selected)
	
	game_picker_tree.clear()
	var root = game_picker_tree.create_item()
	var cats = DataManager.categories
	
	for cat_id in cats:
		var cat_data = cats[cat_id]
		# Filter check: Check if category title matches concept title
		if filter_txt != "All" and cat_data.title != filter_txt:
			continue
			
		var cat_item = game_picker_tree.create_item(root)
		cat_item.set_text(0, cat_data.title)
		cat_item.set_selectable(0, false)
		cat_item.set_custom_color(0, Color("#94a3b8"))
		
		# Sort games alphabetically?
		# Currently array order from scan.
		
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
		var sec_box = VBoxContainer.new()
		timeline_container.add_child(sec_box)
		
		# Header
		var header_hbox = HBoxContainer.new()
		sec_box.add_child(header_hbox)
		
		var toggle_btn = Button.new()
		toggle_btn.text = "▼" # Initial state open
		toggle_btn.flat = true
		toggle_btn.add_theme_color_override("font_color", COL_TEXT_SEC)
		header_hbox.add_child(toggle_btn)
		
		var title = Label.new()
		title.text = sec.title
		title.add_theme_font_size_override("font_size", 20)
		title.add_theme_color_override("font_color", COL_TEXT_PRIM)
		header_hbox.add_child(title)
		
		var dur_lbl = Label.new()
		dur_lbl.text = "(%d min)" % sec.duration
		dur_lbl.add_theme_color_override("font_color", COL_TEXT_SEC)
		header_hbox.add_child(dur_lbl)
		
		var content_panel = PanelContainer.new()
		content_panel.add_theme_stylebox_override("panel", _get_stylebox(COL_PANEL, 12))
		sec_box.add_child(content_panel)
		
		# Connect Toggle
		toggle_btn.pressed.connect(func():
			content_panel.visible = !content_panel.visible
			toggle_btn.text = "▼" if content_panel.visible else "▶"
		)
		
		# Set initial state (verified)
		toggle_btn.text = "▼" if content_panel.visible else "▶"
		
		var content_vbox = VBoxContainer.new()
		content_panel.add_child(content_vbox)
		
		if sec.id == "discussion":
			# Inject Concept Content here
			var header_row = HBoxContainer.new()
			content_vbox.add_child(header_row)
			
			if concept_obj:
				var edit_c_btn = Button.new()
				edit_c_btn.text = "✎ Edit Concept"
				edit_c_btn.flat = true
				edit_c_btn.add_theme_color_override("font_color", COL_ACCENT)
				edit_c_btn.pressed.connect(func(): _open_concept_editor(concept_obj))
				header_row.add_child(edit_c_btn)
			
			var disc_lbl = RichTextLabel.new()
			disc_lbl.fit_content = true
			disc_lbl.bbcode_enabled = true
			
			if concept_obj:
				_set_concept_display(disc_lbl, concept_obj.title, concept_obj.content)
			else:
				disc_lbl.text = "[i]Select a concept to view discussion topics.[/i]"
			
			disc_lbl.add_theme_color_override("default_color", COL_TEXT_PRIM)
			content_vbox.add_child(disc_lbl)
		else:
			for i in range(sec_games.size()):
				var g = sec_games[i]
				
				# === GAME CARD ===
				var game_card = PanelContainer.new()
				var card_style = _get_stylebox(COL_CARD, 12)
				card_style.border_width_left = 1
				card_style.border_width_top = 1
				card_style.border_width_right = 1
				card_style.border_width_bottom = 1
				card_style.border_color = COL_BORDER
				game_card.add_theme_stylebox_override("panel", card_style)
				content_vbox.add_child(game_card)
				
				var card_vbox = VBoxContainer.new()
				game_card.add_child(card_vbox)
				
				# Row 1: Arrow | Title | Tags | Actions

				# Use HBox for everything in one line or split behavior? 
				# User wants: Arrow Title <Tags> ... Actions
				
				var row1 = HBoxContainer.new()
				card_vbox.add_child(row1)
				
				# 1. Expand Arrow
				var collapse_btn = Button.new()
				collapse_btn.text = "▼"
				collapse_btn.flat = true
				collapse_btn.toggle_mode = true
				collapse_btn.add_theme_font_size_override("font_size", 12)
				collapse_btn.add_theme_color_override("font_color", Color("#94a3b8"))
				row1.add_child(collapse_btn) # We'll connect later
				
				# 2. Title
				var g_title = Label.new()
				g_title.text = g.get("title", "Untitled Game")
				g_title.add_theme_color_override("font_color", COL_ACCENT)
				g_title.add_theme_font_size_override("font_size", 18)
				row1.add_child(g_title)
				
				# Spacer before tags
				var tag_spacer = Control.new()
				tag_spacer.custom_minimum_size.x = 10
				row1.add_child(tag_spacer)
				
				# 3. Tags Container (Inline)
				var tags_hbox = HBoxContainer.new()
				tags_hbox.add_theme_constant_override("separation", 6)
				row1.add_child(tags_hbox)
				
				# --- Insert Tags here ---
				# Duration
				var dur = str(g.duration) if g.has("duration") else "5"
				if dur != "None" and dur != "": _create_chip(tags_hbox, dur + "m", "⏱", COL_BORDER)
				# Players
				var players = str(g.players) if g.has("players") else "2"
				if players != "None" and players != "": _create_chip(tags_hbox, players, "👥", COL_BORDER)
				# Difficulty
				if g.has("difficulty") and g.difficulty != "" and g.difficulty != "None":
					var col = Color("#81c784")
					var s = g.difficulty.to_lower()
					if "intermediate" in s: col = Color("#ffd54f")
					elif "advanced" in s: col = Color("#e57373")
					_create_chip(tags_hbox, g.difficulty, "", col, 0.2)
				# Intensity
				if g.has("intensity") and g.intensity != "" and g.intensity != "None":
					var col = Color("#81c784") # Flow
					var s = g.intensity.to_lower()
					if "medium" in s: col = Color("#ffd54f") # Cooperative? Wait, CSS says coop=yellow, med=?
					elif "high" in s: col = Color("#e57373") # Adversarial
					elif "cooperative" in s: col = Color("#ffd54f")
					_create_chip(tags_hbox, g.intensity, "", col, 0.2)
				# Type
				if g.has("type") and g.type != "" and g.type != "None": _create_chip(tags_hbox, g.type, "", COL_BORDER)
				
				# Spacer to push Actions to right
				var push = Control.new()
				push.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row1.add_child(push)
				
				# 4. Actions
				var edit_btn = Button.new()
				edit_btn.text = "✎"
				edit_btn.flat = true
				edit_btn.tooltip_text = "Edit Game"
				edit_btn.add_theme_color_override("font_color", Color("#94a3b8"))
				edit_btn.pressed.connect(_on_edit_game_pressed.bind(g, sec.id, i))
				row1.add_child(edit_btn)
				
				var rem_btn = Button.new()
				rem_btn.text = "✕"
				rem_btn.flat = true
				rem_btn.tooltip_text = "Remove"
				rem_btn.add_theme_color_override("font_color", Color("#94a3b8"))
				rem_btn.pressed.connect(_remove_game.bind(sec.id, i))
				row1.add_child(rem_btn)
				
				# Collapsible Body
				var body_container = VBoxContainer.new()
				card_vbox.add_child(body_container)
				
				# Connect Collapse Toggle
				collapse_btn.pressed.connect(func():
					body_container.visible = !body_container.visible
					collapse_btn.text = "▼" if body_container.visible else "▶"
				)
				
				# Content
				# Focus
				if g.has("focus") and g.focus != "" and g.focus != "None":
					var focus_lbl = RichTextLabel.new()
					focus_lbl.bbcode_enabled = true
					focus_lbl.text = "[b]Focus:[/b] " + g.focus
					focus_lbl.fit_content = true
					focus_lbl.add_theme_color_override("default_color", Color("#e2e8f0"))
					body_container.add_child(focus_lbl)

				# Description
				if g.has("description") and g.description != "" and g.description != "None":
					var desc_lbl = RichTextLabel.new()
					desc_lbl.text = g.description.left(300) + ("..." if g.description.length() > 300 else "")
					desc_lbl.fit_content = true
					desc_lbl.add_theme_color_override("default_color", Color("#94a3b8"))
					desc_lbl.add_theme_font_size_override("normal_font_size", 12)
					body_container.add_child(desc_lbl)
			
			var add_btn = Button.new()
			add_btn.text = "+ Add Game"
			add_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
			var add_style = _get_stylebox(COL_PANEL, 4)
			add_style.border_width_bottom = 1
			add_style.border_color = COL_BORDER
			add_btn.add_theme_stylebox_override("normal", add_style)
			add_btn.pressed.connect(func(): _open_game_picker(sec.id))
			content_vbox.add_child(add_btn)

	_update_header_title()

func _on_save_variation_pressed():
	# Capture current fields
	var new_game = {
		"title": edit_fields["title"].text + " (Variation)",
		"category": _get_selected_text(edit_fields["category"]),
		"difficulty": _get_selected_text(edit_fields["difficulty"]),
		"intensity": _get_selected_text(edit_fields["intensity"]),
		"type": _get_selected_text(edit_fields["type"]),
		"initiation": _get_selected_text(edit_fields["initiation"]),
		"players": edit_fields["players"].text,
		"duration": edit_fields["duration"].text,
		"focus": edit_fields["focus"].text,
		"description": edit_fields["description"].text
	}
	
	if DataManager.save_game(new_game):
		print("Variation saved!")
		DataManager.scan_all()
		
		# If we are in edit mode (context exists), replace/update the current slot with this new variation
		if edit_modal.has_meta("edit_context"):
			var ctx = edit_modal.get_meta("edit_context")
			var sec_id = ctx.sec_id
			var idx = ctx.idx
			
			# User request: "When we create a variation, it should be the one that is placed in the class planner window"
			# So we replace the old game at this index with the NEW game data.
			current_class_data[sec_id][idx] = new_game
			_refresh_timeline()
			
		edit_modal.hide()

func _update_header_title():
	if class_header_lbl:
		var txt = class_name_input.text
		if txt == "": txt = "Class"
		var d = date_input.text
		class_header_lbl.text = "%s %s" % [txt, d]

func _create_chip(parent, text, icon, base_color, bg_alpha=1.0):
	var p = PanelContainer.new()
	var style = StyleBoxFlat.new()
	var bg = base_color
	bg.a = bg_alpha
	style.bg_color = bg
	style.set_corner_radius_all(4)
	style.content_margin_left = 6
	style.content_margin_right = 6
	style.content_margin_top = 2
	style.content_margin_bottom = 2
	
	if bg_alpha < 1.0:
		style.border_width_left = 1
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
		style.border_color = base_color
	
	p.add_theme_stylebox_override("panel", style)
	parent.add_child(p)
	
	var hbox = HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 4)
	p.add_child(hbox)
	
	if icon != "":
		var l = Label.new()
		l.text = icon
		l.add_theme_font_size_override("font_size", 10)
		l.add_theme_color_override("font_color", base_color if bg_alpha < 1.0 else Color.WHITE)
		hbox.add_child(l)
		
	var l = Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", base_color if bg_alpha < 1.0 else Color.WHITE)
	hbox.add_child(l)

func _remove_game(sec_id, idx):
	current_class_data[sec_id].remove_at(idx)
	_refresh_timeline()

func _on_new_game_pressed():
	# Clear/Default fields
	edit_fields["title"].text = ""
	edit_fields["players"].text = "2"
	edit_fields["duration"].text = "5"
	edit_fields["focus"].text = ""
	edit_fields["description"].text = ""
	
	# Determine default category from filter if possible
	var filter_txt = "All"
	if picker_filter_select.selected >= 0:
		filter_txt = picker_filter_select.get_item_metadata(picker_filter_select.selected)
	
	# Update Category list in Edit Modal (it might be stale or empty if we built it once)
	# We should refresh the options.
	var cat_opt = edit_fields["category"]
	cat_opt.clear()
	# We want to match existing concepts for categories.
	for c in DataManager.concepts:
		cat_opt.add_item(c.title)
	
	if filter_txt != "All":
		_select_option(cat_opt, filter_txt)
	
	edit_modal.title = "Create New Game"
	
	# Remove edit context if existing
	if edit_modal.has_meta("edit_context"):
		edit_modal.remove_meta("edit_context")
	
	edit_callback = func():
		var new_game = {
			"title": edit_fields["title"].text,
			"category": _get_selected_text(edit_fields["category"]),
			"difficulty": _get_selected_text(edit_fields["difficulty"]),
			"intensity": _get_selected_text(edit_fields["intensity"]),
			"type": _get_selected_text(edit_fields["type"]),
			"initiation": _get_selected_text(edit_fields["initiation"]),
			"players": edit_fields["players"].text,
			"duration": edit_fields["duration"].text,
			"focus": edit_fields["focus"].text,
			"description": edit_fields["description"].text
		}
		
		# Validate
		if new_game.title == "": 
			print("Title required")
			return
			
		if DataManager.save_game(new_game):
			DataManager.scan_all()
			# Re-populate picker (will happen via signal? No, we called scan_all which emits data_loaded)
			# But we want to ensure we see the new game.
			edit_modal.hide()
			# picker is still open, it should update automatically if we connected data_loaded properly?
			# Yes: DataManager.data_loaded.connect(_on_data_loaded) -> _populate_picker_tree
	
	edit_modal.popup_centered()

func _on_new_class_pressed():
	var dialog = AcceptDialog.new()
	dialog.title = "New Class"
	dialog.dialog_text = "Save current class before starting a new one?"
	dialog.add_button("Save & New", true, "save")
	dialog.add_button("Discard & New", true, "discard")
	dialog.add_cancel_button("Cancel")
	
	dialog.custom_action.connect(func(action):
		if action == "save":
			_on_save_pressed()
			_clear_class()
			dialog.queue_free()
		elif action == "discard":
			_clear_class()
			dialog.queue_free()
	)
	add_child(dialog)
	dialog.popup_centered()

func _on_date_selected(date_dict, _time_dict):
	var year = date_dict.year
	var month = date_dict.month
	var day = date_dict.day
	
	# Pad with zeros
	var m_str = str(month)
	if month < 10: m_str = "0" + m_str
	var d_str = str(day)
	if day < 10: d_str = "0" + d_str
	
	var date_str = "%s-%s-%s" % [year, m_str, d_str]
	date_input.text = date_str
	_update_header_title()

func _clear_class():
	class_name_input.text = ""
	date_input.text = Time.get_date_string_from_system()
	selected_concept_id = ""
	concept_select.select(0)
	_init_class_data()
	_refresh_timeline()

func _open_game_picker(sec_id):
	picker_target_section = sec_id
	game_picker_modal.popup_centered()

func _on_picker_item_activated():
	var item = game_picker_tree.get_selected()
	if not item: return
	var g = item.get_metadata(0)
	if g:
		current_class_data[picker_target_section].append(g.duplicate())
		game_picker_modal.hide()
		_refresh_timeline()

func _on_add_concept_pressed():
	input_modal.title = "New Concept Name"
	input_field.text = ""
	input_confirm_callback = _create_concept
	input_modal.popup_centered()

func _on_input_confirm():
	if input_confirm_callback.is_valid():
		input_confirm_callback.call()
	input_modal.hide()

func _create_concept():
	var txt = input_field.text
	if txt != "":
		DataManager.create_concept(txt, "Description for " + txt)
		DataManager.scan_all() 

func _on_save_pressed():
	var name = class_name_input.text
	if name.strip_edges() == "":
		print("Name required")
		return
	
	var save_data = {
		"name": name,
		"segments": current_class_data,
		"concept_id": selected_concept_id,
		"date": date_input.text
	}
	if DataManager.save_class(name, save_data):
		print("Class saved successfully!")
		var confirm = AcceptDialog.new()
		confirm.title = "Saved"
		confirm.dialog_text = "Class saved successfully!"
		add_child(confirm)
		confirm.popup_centered()
		confirm.confirmed.connect(func(): confirm.queue_free())
	else:
		print("Failed to save class.")
		var err = AcceptDialog.new()
		err.title = "Error"
		err.dialog_text = "Failed to save class."
		add_child(err)
		err.popup_centered()
		err.confirmed.connect(func(): err.queue_free())

func _on_load_pressed():
	load_list.clear()
	var classes = DataManager.list_classes()
	for c in classes:
		load_list.add_item(c)
	load_modal.popup_centered()

func _on_load_item_activated(idx):
	var txt = load_list.get_item_text(idx)
	var data = DataManager.load_class(txt)
	if data:
		# Support both keys for legacy/debug reasons or migrate
		class_name_input.text = data.get("name", data.get("title", "")) # Fallback to title
		date_input.text = data.get("date", Time.get_date_string_from_system())
		selected_concept_id = data.get("concept_id", data.get("conceptId", "")) # Fallback
		
		# Sync UI Dropdown
		_select_concept_by_id(selected_concept_id)
		
		current_class_data = data.get("segments", {})
		_refresh_timeline()
		load_modal.hide()

func _select_concept_by_id(id):
	for i in range(concept_select.item_count):
		# item_id in option button is index in DataManager.concepts list 
		# (see _refresh_concepts_dropdown: add_item(c.title, i))
		var concept_idx = concept_select.get_item_id(i)
		if concept_idx >= 0 and concept_idx < DataManager.concepts.size():
			if DataManager.concepts[concept_idx].id == id:
				concept_select.select(i)
				return
	concept_select.select(-1)

func _on_edit_game_pressed(game, sec_id, idx):
	# Refresh categories to match current concepts
	var cat_opt = edit_fields["category"]
	cat_opt.clear()
	for c in DataManager.concepts:
		cat_opt.add_item(c.title)
		
	# Populate edit modal
	edit_fields["title"].text = game.title
	
	# Mapping Option buttons is tricky if strings don't match exactly index
	# Simple helpers for OptionButton string selection:
	_select_option(edit_fields["category"], game.get("category", ""))
	_select_option(edit_fields["difficulty"], game.get("difficulty", ""))
	_select_option(edit_fields["intensity"], game.get("intensity", ""))
	_select_option(edit_fields["type"], game.get("type", ""))
	_select_option(edit_fields["initiation"], game.get("initiation", ""))
	
	edit_fields["players"].text = str(game.get("players", ""))
	edit_fields["duration"].text = str(game.get("duration", ""))
	edit_fields["focus"].text = game.get("focus", "")
	edit_fields["description"].text = game.get("description", "")
	
	edit_callback = func():
		# Save back
		game.title = edit_fields["title"].text
		game.category = _get_selected_text(edit_fields["category"])
		game.difficulty = _get_selected_text(edit_fields["difficulty"])
		game.intensity = _get_selected_text(edit_fields["intensity"])
		game.type = _get_selected_text(edit_fields["type"])
		game.initiation = _get_selected_text(edit_fields["initiation"])
		game.players = edit_fields["players"].text
		game.duration = edit_fields["duration"].text
		game.focus = edit_fields["focus"].text
		game.description = edit_fields["description"].text
		
		# Update
		current_class_data[sec_id][idx] = game
		_refresh_timeline()
		edit_modal.hide()
	
	# Store context for variation
	edit_modal.set_meta("edit_context", {"game": game, "sec_id": sec_id, "idx": idx})
	
	edit_modal.popup_centered()

func _select_option(opt_btn, text):
	for i in range(opt_btn.item_count):
		if opt_btn.get_item_text(i).to_lower() == text.to_lower():
			opt_btn.select(i)
			return
	opt_btn.select(-1)

func _get_selected_text(opt_btn):
	var idx = opt_btn.selected
	if idx >= 0: return opt_btn.get_item_text(idx)
	return ""

func _on_file_selected(path):
	# Smart Handler
	var dest = path
	
	# Check if path is already inside Project Root
	if path.begins_with(DataManager.PROJECT_ROOT):
		# It is inside. Use absolute path? Or Relative?
		# Main.gd seems to use absolute paths currently for simplicity in _set_concept_display (Image.load_from_file)
		# So we can just use the path as is, no copy needed.
		dest = path
	else:
		# External image. Copy it.
		# Where to? 
		if concept_edit_modal.visible and concept_edit_modal.has_meta("concept_ref"):
			var concept = concept_edit_modal.get_meta("concept_ref")
			# Copy to concept folder
			var target_dir = concept.folder.path_join("Images")
			if not DirAccess.dir_exists_absolute(target_dir):
				DirAccess.make_dir_absolute(target_dir)
			
			dest = DataManager.copy_image_to_target(path, target_dir)
		else:
			# Fallback to global images
			dest = DataManager.copy_image_to_project(path)

	if dest != "" and active_text_edit:
		var bbcode = "\n[img]%s[/img]\n" % dest
		active_text_edit.insert_text_at_caret(bbcode)
		# Trigger update if in concept editor
		if active_text_edit == concept_edit_fields["content"]:
			_update_concept_preview()

func _open_concept_editor(concept):
	concept_edit_fields["title"].text = concept.title
	concept_edit_fields["content"].text = concept.content
	concept_edit_modal.set_meta("concept_ref", concept)
	_update_concept_preview()
	concept_edit_modal.popup_centered()

func _update_concept_preview():
	if concept_preview_label:
		var t = concept_edit_fields["title"].text
		var c = concept_edit_fields["content"].text
		_set_concept_display(concept_preview_label, t, c)

func _open_smart_image_dialog():
	# Default to Project Root Images
	var start_dir = DataManager.PROJECT_ROOT.path_join("Images")
	
	# Try usage of Concept specific folder if we have context
	if concept_edit_modal.visible and concept_edit_modal.has_meta("concept_ref"):
		var concept = concept_edit_modal.get_meta("concept_ref")
		if concept.has("folder"):
			# Check for Images subfolder
			var img_sub = concept.folder.path_join("Images")
			if DirAccess.dir_exists_absolute(img_sub):
				start_dir = img_sub
			else:
				start_dir = concept.folder
	
	file_dialog.current_dir = start_dir
	file_dialog.popup_centered()

func _on_save_concept_pressed():
	if not concept_edit_modal.has_meta("concept_ref"): return
	var concept = concept_edit_modal.get_meta("concept_ref")
	
	# Update Data
	concept.title = concept_edit_fields["title"].text
	concept.content = concept_edit_fields["content"].text
	
	if DataManager.save_concept(concept):
		DataManager.scan_all() # Refresh all data to catch title changes etc
		# _on_data_loaded will refresh timeline
		concept_edit_modal.hide()
	else:
		print("Error saving concept")

func _set_concept_display(label: RichTextLabel, title: String, content: String):
	label.clear()
	
	# Bold Title at top
	label.append_text("[b]" + title + "[/b]\n")
	
	var regex = RegEx.new()
	regex.compile("\\[img\\](.*?)\\[/img\\]")
	
	var search_start = 0
	while true:
		var result = regex.search(content, search_start)
		if not result:
			# Append remaining text
			label.append_text(content.substr(search_start))
			break
			
		# Text before image
		var start = result.get_start()
		var prefix = content.substr(search_start, start - search_start)
		label.append_text(prefix)
		label.append_text("\n") # Ensure newline before image
		
		# Image processing
		var path = result.get_string(1).strip_edges()
		var img = Image.load_from_file(path)
		if img:
			# Resize if too big? 
			# For now, let's limit width to something reasonable if needed, 
			# but RichTextLabel might just overflow. 
			# Let's cap width at 600px for safety (approx timeline width)
			if img.get_width() > 600:
				var ratio = 600.0 / img.get_width()
				var new_h = img.get_height() * ratio
				img.resize(600, new_h)
				
			var tex = ImageTexture.create_from_image(img)
			label.add_image(tex)
			label.append_text("\n") # Ensure newline after image
		else:
			label.append_text("[Image not found: %s]" % path)
		
		search_start = result.get_end()
