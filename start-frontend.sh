#!/bin/bash

# Set environment variables
export VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
export VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
export VITE_API_URL="https://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev"
export PORT=12000

# Start the frontend
echo "Starting frontend on port $PORT..."
cd frontend && npm run dev -- --port $PORT --host 0.0.0.0