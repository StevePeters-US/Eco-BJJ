#!/bin/bash

# Eco-BJJ Android Launcher (Termux)

echo "Starting Eco-BJJ on Android..."

# Check if running in Termux
if [ -n "$TERMUX_VERSION" ]; then
    echo "Termux detected."
    
    # Check for Python
    if ! command -v python &> /dev/null; then
        echo "Python not found. Installing..."
        pkg update -y
        pkg install python -y
    fi
else
    echo "Not running in Termux. Assuming standard Linux environment."
fi

# Get the directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVER_SCRIPT="$DIR/server.py"

if [ -f "$SERVER_SCRIPT" ]; then
    echo "Starting Server..."
    # Run python server
    python "$SERVER_SCRIPT"
else
    echo "Error: server.py not found at $SERVER_SCRIPT"
    exit 1
fi
