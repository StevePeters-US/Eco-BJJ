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
        else:
            self.send_error(404, "Endpoint not found")

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
                content = f"# {name}\n\nDescription of the concept."
                
            elif type_ == 'game':
                category = data.get('category')
                description = data.get('description', f'Description of {name}.')
                goals = data.get('goals', '')
                purpose = data.get('purpose', '')
                
                if not category:
                     self.send_error(400, "Missing category for game")
                     return
                     
                folder = os.path.join(PROJECT_ROOT, 'Games', category)
                if not os.path.exists(folder):
                    os.makedirs(folder)
                    
                filepath = os.path.join(folder, filename)
                content = f"""---
title: {name}
category: {category}
players: 2
goals: {goals}
purpose: {purpose}
---

{description}
"""
            else:
                 self.send_error(400, "Invalid type")
                 return
                 
            # Write file
            if os.path.exists(filepath):
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

if __name__ == "__main__":
    # Change into Web App directory so static files are served correctly from root
    os.chdir(BASE_DIR)
    
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), EcoHandler) as httpd:
        print(f"Eco-BJJ Server running at http://0.0.0.0:{PORT}")
        print(f"Parsing Project Root: {PROJECT_ROOT}")
        httpd.serve_forever()
