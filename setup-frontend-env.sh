#!/bin/bash

# Script to automatically create frontend .env file from root .env
# This ensures Supabase credentials are properly configured

# Check if root .env exists
if [ ! -f .env ]; then
  echo "❌ Root .env file not found. Please create it first."
  exit 1
fi

# Create frontend directory if it doesn't exist
mkdir -p frontend

# Extract Supabase credentials from root .env
SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2)
SUPABASE_ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2)

# Create frontend .env file
cat > frontend/.env << EOF
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
VITE_API_URL=http://localhost:12001
EOF

echo "✅ Frontend .env file created successfully with Supabase credentials"