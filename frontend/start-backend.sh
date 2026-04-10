#!/bin/bash
echo "=================================================="
echo "Starting PetroPulse AI High-Scale Async Backend..."
echo "=================================================="

# Check for python3 and pip3
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 is required but not found. Please install Python 3."
    exit 1
fi

if ! command -v pip3 &>/dev/null; then
    echo "❌ pip3 is required but not found. Please install pip3."
    exit 1
fi

echo "📦 Ensuring high-performance dependencies are installed (FastAPI, Uvicorn)..."
pip3 install -r requirements.txt --quiet --disable-pip-version-check

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies."
    exit 1
fi

echo "✅ Dependencies verified."
echo "🚀 Spawning Uvicorn ASGI Server with 4 asynchronous workers..."
echo "=================================================="

# Run Uvicorn 
python3 -m uvicorn server:app --workers 4 --host 0.0.0.0 --port 8000
