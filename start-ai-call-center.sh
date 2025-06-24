#!/bin/bash

# AI Call Center - One Command Startup Script
# This script builds, configures, and starts the complete AI Call Center system

set -e  # Exit on any error

echo "🚀 Starting AI Call Center - One Command Setup"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the AI-Call-One-Command-V1 directory"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required dependencies
echo "🔍 Checking dependencies..."

if ! command_exists node; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is required but not installed"
    exit 1
fi

if ! command_exists pm2; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

echo "✅ All dependencies are available"

# Install packages
echo ""
echo "📦 Installing packages..."
echo "========================="

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies (if separate)
if [ -d "backend" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

# Build packages
echo ""
echo "🔨 Building packages..."
echo "======================"

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

# Build any other packages that need building
if [ -d "packages" ]; then
    echo "🔨 Building packages..."
    for package_dir in packages/*/; do
        if [ -f "${package_dir}package.json" ]; then
            echo "🔨 Building $(basename "$package_dir")..."
            cd "$package_dir"
            if grep -q '"build"' package.json; then
                npm run build
            fi
            cd - > /dev/null
        fi
    done
fi

# Check environment variables
echo ""
echo "🔧 Checking environment configuration..."
echo "======================================="

if [ ! -f ".env" ]; then
    echo "⚠️ No .env file found. Creating template..."
    cat > .env << 'EOF'
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
PORT=12001
FRONTEND_PORT=12000
VOICE_NAME=Puck
LANGUAGE_CODE=en-US

# System Instructions
SYSTEM_INSTRUCTION="You are a professional AI assistant for customer service calls. IMPORTANT: You MUST speak first immediately when the call connects. Start with a warm greeting like 'Hello! Thank you for calling. How can I help you today?' Be helpful, polite, and efficient. Always initiate the conversation and maintain a friendly, professional tone throughout the call."
EOF
    echo "📝 Template .env file created. Please configure your API keys and settings."
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check critical environment variables
missing_vars=()
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key" ]; then
    missing_vars+=("GEMINI_API_KEY")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "⚠️ Warning: The following environment variables need to be configured:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo "   The system will start but may have limited functionality."
fi

# Stop any existing processes
echo ""
echo "🛑 Stopping existing processes..."
echo "================================"
pm2 delete all 2>/dev/null || echo "No existing processes to stop"

# Start services
echo ""
echo "🚀 Starting AI Call Center services..."
echo "====================================="

# Start backend
echo "🚀 Starting backend server..."
pm2 start server-standalone.js --name "ai-call-backend" --watch --ignore-watch="node_modules frontend dist logs"

# Start frontend
echo "🚀 Starting frontend server..."
cd frontend
pm2 start npm --name "ai-call-frontend" -- run preview -- --host 0.0.0.0 --port 12000
cd ..

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check service status
echo ""
echo "🏥 Checking service health..."
echo "============================"

# Check backend health
backend_health=$(curl -s http://localhost:12001/health 2>/dev/null || echo "failed")
if echo "$backend_health" | grep -q "healthy"; then
    echo "✅ Backend: Healthy"
else
    echo "❌ Backend: Not responding"
fi

# Check frontend
frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:12000 2>/dev/null || echo "000")
if [ "$frontend_health" = "200" ]; then
    echo "✅ Frontend: Healthy"
else
    echo "❌ Frontend: Not responding"
fi

# Show PM2 status
echo ""
echo "📊 Service Status:"
echo "=================="
pm2 list

# Test agent routing
echo ""
echo "🧪 Testing agent routing system..."
echo "=================================="
routing_test=$(curl -s -X POST http://localhost:12001/api/agents/route-test -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "failed")
if echo "$routing_test" | grep -q "selected_agent"; then
    echo "✅ Agent routing: Operational"
else
    echo "❌ Agent routing: Failed"
fi

# Show access URLs
echo ""
echo "🌐 Access URLs:"
echo "==============="
echo "Frontend: http://localhost:12000"
echo "Backend API: http://localhost:12001"
echo "Health Check: http://localhost:12001/health"
echo "Agent Routing Test: http://localhost:12001/api/agents/route-test"

# Show webhook URL for Twilio
echo ""
echo "📞 Twilio Webhook Configuration:"
echo "==============================="
echo "Voice Webhook URL: https://your-domain.com/webhook/voice"
echo "Stream URL: wss://your-domain.com"
echo ""
echo "Note: Replace 'your-domain.com' with your actual domain or ngrok URL"

# Final status
echo ""
echo "🎉 AI Call Center Setup Complete!"
echo "================================="
echo ""
echo "🌟 System Features:"
echo "  ✅ Intelligent agent routing"
echo "  ✅ Real-time voice streaming"
echo "  ✅ Multiple AI agent support"
echo "  ✅ Customizable voice and language"
echo "  ✅ Business hours routing"
echo "  ✅ Call logging and analytics"
echo "  ✅ Webhook integration"
echo ""
echo "📋 Next Steps:"
echo "  1. Configure your .env file with API keys"
echo "  2. Set up Twilio webhook URLs"
echo "  3. Create custom AI agents in the frontend"
echo "  4. Test with real phone calls"
echo ""
echo "🔧 Management Commands:"
echo "  pm2 list                    # View running services"
echo "  pm2 logs                    # View service logs"
echo "  pm2 restart all             # Restart all services"
echo "  pm2 stop all                # Stop all services"
echo "  node demo-agent-routing.js  # Run routing demo"
echo ""
echo "🚀 Your AI Call Center is ready for action!"