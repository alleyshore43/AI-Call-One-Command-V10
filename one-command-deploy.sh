#!/bin/bash

# AI Call Center - One Command Deploy Script
# 
# IMPORTANT: Before running this script, you MUST:
# 1. Replace 'your_gemini_api_key_here' with your actual Gemini API key
# 2. Optionally configure Twilio and Supabase credentials for production use
# 3. Make sure ports 12000-12002 are available
#
# Usage: ./one-command-deploy.sh

set -e  # Exit on any error

echo "🚀 AI Call Center - One Command Deploy"
echo "======================================"
echo "⚠️  IMPORTANT: Make sure you've configured your API keys in this script!"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Node.js if not present
install_nodejs() {
    echo "📦 Installing Node.js..."
    if command_exists curl; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "❌ curl not found. Please install Node.js manually."
        exit 1
    fi
}

# Function to install PM2 globally
install_pm2() {
    echo "📦 Installing PM2..."
    npm install -g pm2
}

# Check and install dependencies
echo "🔍 Checking dependencies..."

if ! command_exists node; then
    install_nodejs
else
    echo "✅ Node.js found: $(node --version)"
fi

if ! command_exists npm; then
    echo "❌ npm not found. Please install Node.js with npm."
    exit 1
else
    echo "✅ npm found: $(npm --version)"
fi

if ! command_exists pm2; then
    install_pm2
else
    echo "✅ PM2 found: $(pm2 --version)"
fi

# Configuration - REPLACE THESE WITH YOUR ACTUAL VALUES
echo "⚙️  Setting up configuration..."

# Server Configuration
PORT=12001
HEALTH_PORT=12002

# Gemini AI Configuration - REPLACE WITH YOUR API KEY
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration (optional - for user management)
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Twilio Configuration (optional - for production calls)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
TWILIO_API_KEY_SID=your_twilio_api_key_sid_here
TWILIO_API_KEY_SECRET=your_twilio_api_key_secret_here

# Voice Configuration
VOICE_NAME=Puck
LANGUAGE_CODE=en-US
SYSTEM_INSTRUCTION="You are a professional AI assistant for customer service calls. IMPORTANT: You MUST speak first immediately when the call connects. Start with a warm greeting like 'Hello! Thank you for calling. How can I help you today?' Be helpful, polite, and efficient. Always initiate the conversation and maintain a friendly, professional tone throughout the call."

# Check if API key is configured
if [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    echo "❌ ERROR: You must configure your Gemini API key!"
    echo "   Edit this script and replace 'your_gemini_api_key_here' with your actual API key."
    echo "   Get your API key from: https://aistudio.google.com/app/apikey"
    exit 1
fi

# Create backend .env file
echo "📝 Creating backend .env file..."
cat > .env << EOF
# Gemini AI Configuration
GEMINI_API_KEY=$GEMINI_API_KEY

# Server Configuration
PORT=$PORT
HEALTH_PORT=$HEALTH_PORT
NODE_ENV=production

# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Twilio Configuration
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER
TWILIO_API_KEY_SID=$TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET=$TWILIO_API_KEY_SECRET

# Voice Configuration
VOICE_NAME=$VOICE_NAME
LANGUAGE_CODE=$LANGUAGE_CODE
SYSTEM_INSTRUCTION=$SYSTEM_INSTRUCTION
EOF

# Create frontend .env.local file
echo "📝 Creating frontend .env.local file..."
cat > frontend/.env.local << EOF
# Frontend Configuration
VITE_API_URL=http://localhost:$PORT
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
npm run build
cd ..

# Create logs directory
mkdir -p logs

# Create PM2 ecosystem file
echo "📝 Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ai-call-backend',
      script: 'server-standalone.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 12001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'ai-call-frontend',
      script: 'npm',
      args: 'run preview',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 12000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};
EOF

# Stop any existing PM2 processes
echo "🛑 Stopping any existing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Start services with PM2
echo "🚀 Starting services with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup

# Health check function
health_check() {
    local url=$1
    local service=$2
    local max_attempts=30
    local attempt=1
    
    echo "🔍 Checking $service health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo "✅ $service is healthy!"
            return 0
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts - waiting for $service..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service health check failed after $max_attempts attempts"
    return 1
}

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Health checks
health_check "http://localhost:$PORT/health" "Backend"
health_check "http://localhost:12000" "Frontend"

# Display status
echo ""
echo "🎉 Deployment completed successfully!"
echo "======================================"
echo ""
echo "📊 Service Status:"
pm2 status
echo ""
echo "🌐 Access your AI Call Center:"
echo "   Frontend: http://localhost:12000"
echo "   Backend:  http://localhost:$PORT"
echo "   Health:   http://localhost:$PORT/health"
echo ""
echo "📋 Management Commands:"
echo "   View logs:    pm2 logs"
echo "   Restart:      pm2 restart all"
echo "   Stop:         pm2 stop all"
echo "   Status:       pm2 status"
echo ""
echo "🎯 Your AI Call Center is now running!"
echo "   Configure your agents at: http://localhost:12000"
echo ""