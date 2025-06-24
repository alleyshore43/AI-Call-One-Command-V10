#!/bin/bash

# AI Call Center - Complete Build and Deploy Script
# This script builds all packages, installs dependencies, and deploys the system

set -e  # Exit on any error

echo "🚀 AI Call Center - Complete Build and Deploy"
echo "=============================================="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install PM2 globally if not present
install_pm2() {
    echo "📦 Installing PM2..."
    npm install -g pm2
}

# Check dependencies
echo "🔍 Checking dependencies..."

if ! command_exists node; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
else
    echo "✅ Node.js found: $(node --version)"
fi

if ! command_exists npm; then
    echo "❌ npm not found. Please install npm first."
    exit 1
else
    echo "✅ npm found: $(npm --version)"
fi

if ! command_exists pm2; then
    install_pm2
else
    echo "✅ PM2 found: $(pm2 --version)"
fi

echo ""

# Configuration with provided credentials
echo "⚙️  Setting up configuration with provided credentials..."

# Server Configuration
PORT=12001
HEALTH_PORT=12002

# Provided Credentials
GEMINI_API_KEY="your_gemini_api_key_here"
SUPABASE_URL="your_supabase_url_here"
SUPABASE_ANON_KEY="your_supabase_anon_key_here"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key_here"
TWILIO_ACCOUNT_SID="your_twilio_account_sid_here"
TWILIO_AUTH_TOKEN="your_twilio_auth_token_here"
TWILIO_PHONE_NUMBER="your_twilio_phone_number_here"
TWILIO_API_KEY_SID="your_twilio_api_key_sid_here"
TWILIO_API_KEY_SECRET="your_twilio_api_key_secret_here"

# Voice Configuration
VOICE_NAME="Puck"
LANGUAGE_CODE="en-US"
SYSTEM_INSTRUCTION="You are a professional AI assistant for customer service calls. IMPORTANT: You MUST speak first immediately when the call connects. Start with a warm greeting like 'Hello! Thank you for calling. How can I help you today?' Be helpful, polite, and efficient. Always initiate the conversation and maintain a friendly, professional tone throughout the call."

echo "✅ Configuration set with provided credentials"
echo ""

# Step 1: Build all TypeScript packages
echo "🔨 Building TypeScript packages..."

# Build each package in the correct order (skip tw2gem-server as it has complex dependencies)
packages=("audio-converter" "twilio-server" "gemini-live-client")

for package in "${packages[@]}"; do
    if [ -d "packages/$package" ]; then
        echo "📦 Building $package..."
        cd "packages/$package"
        
        # Install dependencies if package-lock.json exists
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
        
        # Build the package
        npm run build
        
        # Verify dist directory was created
        if [ -d "dist" ]; then
            echo "✅ $package built successfully"
        else
            echo "❌ Failed to build $package - dist directory not found"
            exit 1
        fi
        
        cd ../..
    else
        echo "⚠️  Package $package not found, skipping..."
    fi
done

echo "✅ All packages built successfully"
echo ""

# Step 2: Install root dependencies
echo "📦 Installing root dependencies..."
npm install
echo "✅ Root dependencies installed"
echo ""

# Step 3: Install and build frontend
echo "🎨 Building frontend..."
cd frontend

# Install frontend dependencies
npm install

# Build frontend for production
npm run build

# Verify build was successful
if [ -d "dist" ]; then
    echo "✅ Frontend built successfully"
else
    echo "❌ Frontend build failed - dist directory not found"
    exit 1
fi

cd ..
echo ""

# Step 4: Create environment files
echo "📝 Creating environment files..."

# Create backend .env file
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
cat > frontend/.env.local << EOF
# Frontend Configuration
VITE_API_URL=http://localhost:$PORT
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

echo "✅ Environment files created"
echo ""

# Step 5: Create logs directory
mkdir -p logs

# Step 6: Create PM2 ecosystem file
echo "📝 Creating PM2 ecosystem configuration..."
cat > ecosystem.config.cjs << 'EOF'
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

echo "✅ PM2 ecosystem configuration created"
echo ""

# Step 7: Stop any existing PM2 processes
echo "🛑 Stopping any existing PM2 processes..."
pm2 delete all 2>/dev/null || true
echo ""

# Step 8: Start services with PM2
echo "🚀 Starting services with PM2..."
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

echo ""

# Step 9: Health check function
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

# Display final status
echo ""
echo "🎉 Deployment completed successfully!"
echo "======================================"
echo ""
echo "📊 Service Status:"
pm2 status
echo ""
echo "🌐 Access your AI Call Center:"
echo "   Frontend: https://work-1-okavkedynbgvzfwe.prod-runtime.all-hands.dev"
echo "   Backend:  https://work-2-okavkedynbgvzfwe.prod-runtime.all-hands.dev"
echo "   Health:   https://work-2-okavkedynbgvzfwe.prod-runtime.all-hands.dev/health"
echo ""
echo "📋 Management Commands:"
echo "   View logs:    pm2 logs"
echo "   Restart:      pm2 restart all"
echo "   Stop:         pm2 stop all"
echo "   Status:       pm2 status"
echo ""
echo "🎯 Your AI Call Center is now running!"
echo "   Configure your agents at: https://work-1-okavkedynbgvzfwe.prod-runtime.all-hands.dev"
echo ""
echo "📞 Twilio Configuration:"
echo "   Webhook URL: https://work-2-okavkedynbgvzfwe.prod-runtime.all-hands.dev/webhook/voice"
echo "   Stream URL:  wss://work-2-okavkedynbgvzfwe.prod-runtime.all-hands.dev"
echo ""
echo "🔧 Credentials Configured:"
echo "   ✅ Gemini API Key"
echo "   ✅ Supabase Database"
echo "   ✅ Twilio Phone System"
echo ""