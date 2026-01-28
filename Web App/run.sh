#!/bin/bash

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Generate content (reads from project root Concepts folder)
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

# Start Server
echo "Starting Eco-BJJ Server..."
python3 server.py

