#!/bin/bash

# Set environment variables
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
export SUPABASE_URL="YOUR_SUPABASE_URL"
export SUPABASE_KEY="YOUR_SUPABASE_KEY"
export TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
export TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
export TWILIO_PHONE_NUMBER="YOUR_TWILIO_PHONE_NUMBER"
export TWILIO_API_KEY_SID="YOUR_TWILIO_API_KEY_SID"
export TWILIO_API_KEY_SECRET="YOUR_TWILIO_API_KEY_SECRET"
export WEBHOOK_URL="https://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev"
export PORT=12001

# Start the server
echo "Starting server on port $PORT..."
node server-standalone.js