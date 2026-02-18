#!/bin/bash
# Root launcher for Eco-BJJ

# Find the script location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCRIPT="$DIR/Web App/run_on_android.sh"

if [ -f "$SCRIPT" ]; then
    bash "$SCRIPT"
else
    echo "Error: Could not find launcher at $SCRIPT"
    exit 1
fi
