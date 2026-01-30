import http.server
import socketserver
import json
import os
import subprocess

PORT = 8000
# Define root as directory of this script (Web App)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Project root is two levels up (Eco-BJJ root)
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '../'))

class EcoHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/save':
            self.handle_save()
        elif self.path == '/api/create':
            self.handle_create()
        elif self.path == '/api/save_class':
            self.handle_save_class()
        elif self.path == '/api/load_class':
            self.handle_load_class()
        elif self.path == '/api/delete':
            self.handle_delete()
        else:
            self.send_error(404, "Endpoint not found")

    def do_GET(self):
        if self.path == '/api/list_classes':
            self.handle_list_classes()
        elif self.path.startswith('/Concepts/'):
            # Serve files from the project root Concepts folder
            self.serve_project_file(self.path)
        else:
            super().do_GET()

    def serve_project_file(self, path):
        """Serve files from the PROJECT_ROOT directory (for Concepts, Games, etc.)"""
        try:
            # Remove leading slash and decode URL encoding
            from urllib.parse import unquote
            relative_path = unquote(path.lstrip('/'))
            file_path = os.path.join(PROJECT_ROOT, relative_path)
            
            # Security check - ensure we're still within project root
            file_path = os.path.abspath(file_path)
            if not file_path.startswith(PROJECT_ROOT):
                self.send_error(403, "Forbidden")
                return
            
            if not os.path.exists(file_path):
                self.send_error(404, f"File not found: {relative_path}")
                return
                
            # Determine content type
            import mimetypes
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                content_type = 'application/octet-stream'
            
            # Read and serve the file
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
            
        except Exception as e:
            print(f"Error serving project file: {e}")
            self.send_error(500, str(e))

    def handle_save_class(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body)

            name = data.get('name')
            class_data = data.get('data')

            if not name or not class_data:
                self.send_error(400, "Missing name or data")
                return

            # Sanitize name
            safe_name = "".join([c for c in name if c.isalnum() or c in " -_"])
            filename = safe_name.replace(" ", "_") + ".json"
            
            # Save to 'Saved Classes' directory
            classes_dir = os.path.join(PROJECT_ROOT, 'Saved Classes')
            if not os.path.exists(classes_dir):
                os.makedirs(classes_dir)

            filepath = os.path.join(classes_dir, filename)

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(class_data, f, indent=2)

            print(f"Saved Class: {filepath}")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'path': filepath}).encode())

        except Exception as e:
            print(f"Error saving class: {e}")
            self.send_error(500, str(e))

    def handle_list_classes(self):
        try:
            classes_dir = os.path.join(PROJECT_ROOT, 'Saved Classes')
            if not os.path.exists(classes_dir):
                os.makedirs(classes_dir)

            classes = []
            for filename in os.listdir(classes_dir):
                if filename.endswith('.json'):
                    classes.append(filename.replace('.json', '').replace('_', ' '))
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'classes': sorted(classes)}).encode())

        except Exception as e:
            print(f"Error listing classes: {e}")
            self.send_error(500, str(e))

    def handle_load_class(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body)

            name = data.get('name')
            if not name:
                self.send_error(400, "Missing name")
                return

            safe_name = "".join([c for c in name if c.isalnum() or c in " -_"])
            filename = safe_name.replace(" ", "_") + ".json"
            classes_dir = os.path.join(PROJECT_ROOT, 'Saved Classes')
            filepath = os.path.join(classes_dir, filename)

            if not os.path.exists(filepath):
                self.send_error(404, "Class not found")
                return

            with open(filepath, 'r', encoding='utf-8') as f:
                class_data = json.load(f)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'data': class_data}).encode())

        except Exception as e:
            print(f"Error loading class: {e}")
            self.send_error(500, str(e))

    def handle_create(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body)
            
            type_ = data.get('type')
            name = data.get('name')
            
            if not type_ or not name:
                self.send_error(400, "Missing type or name")
                return
                
            # Sanitize name
            safe_name = "".join([c for c in name if c.isalnum() or c in " -_"])
            filename = safe_name.replace(" ", "") + ".md"
            
            if type_ == 'concept':
                # Create Concepts/safe_name/safe_name.md
                folder = os.path.join(PROJECT_ROOT, 'Concepts', safe_name.replace(" ", ""))
                if not os.path.exists(folder):
                    os.makedirs(folder)
                
                filepath = os.path.join(folder, filename)
                description = data.get('description', 'Description of the concept.')
                content = f"# {name}\n\n{description}"
                
            elif type_ == 'game':
                category = data.get('category')
                # Define fields
                players = data.get('players')
                duration = data.get('duration')
                game_type = data.get('gameType')
                intensity = data.get('intensity')
                goals = data.get('goals')
                purpose = data.get('purpose')
                focus = data.get('focus')
                description = data.get('description', f'Description of {name}.')

                # Prepare frontmatter fields
                fm_fields = [
                    ('title', name),
                    ('category', category),
                    ('players', players),
                    ('duration', duration),
                    ('type', game_type),
                    ('intensity', intensity),
                ]

                # Optional fields
                difficulty = data.get('difficulty')
                if difficulty:
                    fm_fields.append(('difficulty', difficulty))
                
                parent_id = data.get('parentId')
                if parent_id:
                    fm_fields.append(('parent_id', parent_id))
                    
                if goals:
                    fm_fields.append(('goals', goals))
                if purpose:
                    fm_fields.append(('purpose', purpose))
                if focus:
                    fm_fields.append(('focus', focus))
                    
                # Build Content
                lines = ["---"]
                for k, v in fm_fields:
                    # Write only if value is not None/Empty, OR if it's a critical field?
                    # Actually, if we want inheritance, we want to omit fields.
                    # But if we create a NEW game, we want defaults?
                    # The frontend should send defaults for new games, and nulls/empty for overrides.
                    # 'players' default is handled below inside `if v:`.
                    # But wait, python default '2' was set in data.get call earlier?
                    
                    # Correction: I need to change how data is retrieved to avoid defaults if I want inheritance.
                    # But `data.get('players', '2')` is already done above.
                    # I should update those lines too.
                    # Let's just blindly write what we have for now, BUT for parent_id we definitely write it.
                    # For inheritance, 'players' should only be written if it was explicitly provided?
                    # But handle_create doesn't know if it was explicit or default.
                    
                    # If I rely on Frontend sending nulls, I should change the .get() calls.
                    # Let's fix the .get() calls in this same replace block or assume I'll fix them next.
                    # Actually, I can't easily change lines 198-202 without a larger range.
                    # I will expand the range of this replacement to cover lines 193-226.
                    
                    if v:
                        lines.append(f"{k}: {v}")
                        
                lines.append("---\n")
                lines.append(description)
                
                content = "\n".join(lines)
                
                # Construct path for game: Concepts/{Category}/Games/{filename}
                # Sanitize category just in case, though it should match an existing concept folder
                safe_category = category.replace(" ", "")
                concept_dir = os.path.join(PROJECT_ROOT, 'Concepts', safe_category)
                games_dir = os.path.join(concept_dir, 'Games')
                
                if not os.path.exists(games_dir):
                    os.makedirs(games_dir)
                    
                filepath = os.path.join(games_dir, filename)
            else:
                 self.send_error(400, "Invalid type")
                 return
                 
            # Write file
            if os.path.exists(filepath) and not data.get('overwrite', False):
                 self.send_error(409, "File already exists")
                 return

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
                
            print(f"Created: {filepath}")
            
            # Regenerate
            gen_script = os.path.join(BASE_DIR, 'scripts/generate_content.py')
            subprocess.run(["python3", gen_script], check=True)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success', 'path': filepath}).encode())

        except Exception as e:
            print(f"Error creating: {e}")
            self.send_error(500, str(e))

    def handle_save(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body)
            
            file_path = data.get('path')
            content = data.get('content')
            
            if not file_path or content is None:
                self.send_error(400, "Missing path or content")
                return

            # Security: Ensure path is within Project Root
            # We assume the frontend sends an absolute path (as read from content.json which has absolute paths)
            # OR a relative path.
            # Let's clean the path.
            
            # If the path comes from content.json, it's currently absolute on the user's machine?
            # Let's check generate_content.py
            # 'path': path (which is os.path.join(root, file)) -> This is absolute in the python execution context.
            # So the frontend will send an absolute path.
            
            abs_path = os.path.abspath(file_path)
            
            if not abs_path.startswith(PROJECT_ROOT):
                 print(f"Blocked write to: {abs_path}")
                 self.send_error(403, "Forbidden path")
                 return
                 
            # Write file
            with open(abs_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"Saved file: {abs_path}")

            # Re-generate content.json to reflect changes (if titles changed etc)
            # Run the generation script
            gen_script = os.path.join(BASE_DIR, 'scripts/generate_content.py')
            subprocess.run(["python3", gen_script], check=True)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())
            
        except Exception as e:
            print(f"Error saving: {e}")
            self.send_error(500, str(e))

    def handle_delete(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body)
            
            relative_path = data.get('path')
            if not relative_path:
                self.send_error(400, "Missing path")
                return

            # Security: Ensure path is within Project Root
            # The path coming from content.json is absolute.
            # If it is absolute, we check it starts with PROJECT_ROOT.
            
            target_path = relative_path
            if not os.path.isabs(target_path):
                target_path = os.path.join(PROJECT_ROOT, relative_path)
            
            target_path = os.path.abspath(target_path)
            
            if not target_path.startswith(PROJECT_ROOT):
                 print(f"Blocked delete of: {target_path}")
                 self.send_error(403, "Forbidden path")
                 return

            if not os.path.exists(target_path):
                self.send_error(404, "Path not found")
                return
                
            # Delete logic
            if os.path.isdir(target_path):
                import shutil
                shutil.rmtree(target_path)
                print(f"Deleted directory: {target_path}")
            else:
                os.remove(target_path)
                print(f"Deleted file: {target_path}")
                
            # Regenerate content
            gen_script = os.path.join(BASE_DIR, 'scripts/generate_content.py')
            subprocess.run(["python3", gen_script], check=True)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode())

        except Exception as e:
            print(f"Error deleting: {e}")
            self.send_error(500, str(e))

if __name__ == "__main__":
    # Change into Web App directory so static files are served correctly from root
    os.chdir(BASE_DIR)
    
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), EcoHandler) as httpd:
        print(f"Eco-BJJ Server running at http://0.0.0.0:{PORT}")
        print(f"Parsing Project Root: {PROJECT_ROOT}")
        httpd.serve_forever()
