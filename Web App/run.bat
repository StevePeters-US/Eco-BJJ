@echo off
cd /d "%~dp0"

echo Generating content...
python scripts/generate_content.py

echo Opening http://localhost:8000 in browser...
start http://localhost:8000

echo Starting Eco-BJJ Server...
python server.py
