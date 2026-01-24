#!/bin/bash

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Link data folders if they don't exist
ln -sfn ../Theory Theory
ln -sfn ../Games Games

# Generate
echo "Generating content..."
python3 scripts/generate_content.py

echo "Opening http://localhost:8000 in browser..."
# Try to open Google Chrome, Chromium, or fallback to default browser
if command -v google-chrome &> /dev/null; then
    google-chrome http://localhost:8000 &
elif command -v chromium-browser &> /dev/null; then
    chromium-browser http://localhost:8000 &
else
    xdg-open http://localhost:8000 &
fi

echo "Starting server at http://localhost:8000..."
python3 -m http.server 8000

