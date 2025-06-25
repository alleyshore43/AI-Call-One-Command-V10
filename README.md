# AI Call Center - One Command Deploy

🚀 **Production-ready AI Call Center with Gemini Live API integration**

Deploy a complete AI calling system with smart agent routing, audio triggers, GoHighLevel integration, and Zapier integration in one command.

## 🌐 Production Environment

- **Frontend**: https://work-1-errcwactxqohaxwm.prod-runtime.all-hands.dev
- **Backend**: https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev
- **Health Check**: https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev/health

### Admin Login
- **Email**: admin@aicallcenter.com
- **Password**: password123

## ✨ Features

- 🎯 **One-Command Deployment** - Clone and deploy with a single script
- 🤖 **Gemini Live API Integration** - Real-time audio conversations
- 🎵 **Audio Trigger System** - Gemini speaks first on inbound calls
- 🔀 **Intelligent Agent Routing** - Route calls to specialized AI agents
- 👥 **Multiple AI Agents** - Customer service, sales, support, and custom agents
- 🗣️ **8 Unique Voices** - Diverse AI personalities with different voices
- 🌍 **Multi-language Support** - 10+ languages with localized agents
- 🕐 **Business Hours Routing** - Time-aware call routing with after-hours support
- 📞 **Twilio Integration** - Production-ready phone system
- 🔗 **Zapier Integration** - Webhook automation for CRM/workflows
- 🏢 **GoHighLevel Integration** - Connect your GHL account for CRM functionality
- 🎛️ **Agent Management** - Web-based configuration interface
- 📊 **Real-time Dashboard** - Call monitoring and analytics
- 🧪 **Testing Suite** - Comprehensive routing and functionality tests
- 🔒 **User Authentication** - Secure login and user management

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/perfectionking90/AI-Call-One-Command-V8.git
cd AI-Call-One-Command-V8

# Start the complete AI Call Center system
./start-ai-call-center.sh
```

That's it! Your AI Call Center will be running at:
- **Frontend**: http://localhost:12000
- **Backend**: http://localhost:12001
- **Health Check**: http://localhost:12001/health

### Production Environment

The system is already deployed and running at:
- **Frontend**: https://work-1-errcwactxqohaxwm.prod-runtime.all-hands.dev
- **Backend**: https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev
- **Health Check**: https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev/health

### Test the Agent Routing System
```bash
# Run interactive demo
node demo-agent-routing.js

# Run comprehensive tests
node test-agent-routing-simple.js
```

## 📋 Prerequisites

- Node.js 18+ (installed automatically if missing)
- **Gemini API Key** (required) - Get yours at [Google AI Studio](https://aistudio.google.com/app/apikey)
- Twilio Account (optional, for production calls)

## 🔧 Configuration

### Required Configuration

Before running the deployment script, you **MUST** configure your API keys:

1. Create a `.env` file in the root directory with the following:
```
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_API_KEY_SID=your_twilio_api_key_sid
TWILIO_API_KEY_SECRET=your_twilio_api_key_secret

# Public API URL
PUBLIC_API_URL=https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev
```

2. Create a `.env` file in the frontend directory with the following:
```
VITE_SUPABASE_URL=https://wllyticlzvtsimgefsti.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHl0aWNsenZ0c2ltZ2Vmc3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTA0MTYsImV4cCI6MjA2NTE4NjQxNn0.V2pQNPbCBCjw9WecUFE45dIswma0DjB6ikLi9Kdgcnk
VITE_API_URL=https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev
```

The script will automatically configure the frontend environment based on these settings.

### GoHighLevel Integration

To connect your GoHighLevel account:

1. Log in to the AI Call Center dashboard
2. Navigate to Settings > Integrations
3. Click on "Connect GoHighLevel"
4. Enter your GoHighLevel API Key and Location ID
5. Click "Connect"

## 🎯 How It Works

1. **Audio Trigger**: When a call connects, the system sends a PCM audio trigger to Gemini
2. **Gemini Response**: Gemini Live API processes the audio and responds with speech
3. **Smart Routing**: Calls are routed to appropriate agents based on direction (inbound/outbound)
4. **Real-time Audio**: Bidirectional audio streaming between caller and Gemini
5. **Zapier Integration**: Webhook events trigger automation workflows
6. **GoHighLevel Integration**: Connect your GHL account to sync contacts, appointments, and opportunities

## 📁 Project Structure

```
AI-Call-One-Command-V8/
├── start-ai-call-center.sh   # Single deployment script with all setup functions
├── server-standalone.js      # Main server with audio trigger
├── packages/                 # Core packages
│   ├── tw2gem-server/       # Twilio to Gemini server
│   │   ├── src/             # Source code
│   │   │   ├── ghl-service.ts # GoHighLevel service
│   │   │   └── function-handler.ts # Gemini function handler
│   │   └── dist/            # Compiled JavaScript
│   ├── gemini-live-client/  # Gemini Live API client
│   ├── audio-converter/     # Audio processing utilities
│   └── examples/            # Example implementations
├── frontend/                # React dashboard
│   ├── src/                 # Source code
│   │   ├── components/      # React components
│   │   │   └── GoHighLevelIntegration.tsx # GHL integration UI
│   │   └── pages/           # React pages
│   └── dist/                # Built frontend
├── utils/                   # Audio trigger system
├── assets/                  # Audio files (PCM trigger)
├── test-system.js           # System testing script
├── production-readiness.js  # Production readiness check
└── ecosystem.config.js      # PM2 configuration
```

## 🎵 Audio Trigger System

The system includes a pre-recorded PCM audio file that triggers Gemini to speak first:
- **File**: `assets/trigger-audio.pcm` (134KB, 16-bit PCM)
- **Purpose**: Makes Gemini greet callers immediately
- **Format**: Raw PCM, little-endian, 16-bit, 16kHz
- **Integration**: Automatically sent when Gemini connects

## 🔀 Smart Agent Routing

Agents can be configured for different call directions:
- **Inbound Only**: Handles incoming calls
- **Outbound Only**: Makes outgoing calls  
- **Both**: Handles any call direction
- **Default Routing**: Filters agents by capability

## 🔗 Zapier Integration

Built-in webhook system for automation:
- **Events**: call_completed, appointment_scheduled, lead_captured, etc.
- **Configuration**: Web-based webhook management
- **Testing**: Built-in webhook testing tools
- **Payloads**: Structured data for easy integration

## 🏢 GoHighLevel Integration

Connect your GoHighLevel account to sync data:
- **Contacts**: Create and update contacts in GHL
- **Appointments**: Schedule appointments from calls
- **Opportunities**: Create opportunities and track sales
- **Notes**: Add call notes to contacts
- **Configuration**: Web-based integration management

## 🛠️ Management Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Health check
curl http://localhost:12001/health

# Production health check
curl https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev/health

# Test system
node test-system.js

# Check production readiness
node production-readiness.js
```

## 🔒 Security

- Environment variables for sensitive data
- No hardcoded API keys in repository
- CORS configuration for cross-origin requests
- Webhook signature validation
- Rate limiting on API endpoints

## 📈 Scaling

The system is designed for production scaling:
- PM2 process management
- Horizontal scaling ready
- Database connection pooling
- Efficient audio processing

## 🐛 Troubleshooting

### Common Issues

1. **API Key Error**: Make sure you've replaced the placeholder API key with your actual Gemini API key
2. **Port conflicts**: Ensure ports 12000-12001 are available
3. **Gemini API**: Verify your API key has Live API access
4. **Audio issues**: Check PCM file permissions and format
5. **Webhook failures**: Verify endpoint URLs and signatures
6. **Database issues**: Check Supabase connection and tables
7. **GHL integration**: Verify API key and location ID

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development pm2 restart all

# View detailed logs
pm2 logs --lines 100

# Run system tests
node test-system.js

# Check production readiness
node production-readiness.js
```

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `pm2 logs`
2. **Verify API key**: Make sure your Gemini API key is correctly configured
3. **Check ports**: Ensure ports 12000-12001 are not in use
4. **Review configuration**: Verify all required settings in the deployment script
5. **Run tests**: Use `node test-system.js` to verify system functionality
6. **Check production readiness**: Use `node production-readiness.js` to verify production readiness
7. **Check database**: Verify Supabase connection and tables
8. **Check GHL integration**: Verify GoHighLevel API key and location ID

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Ready to deploy your AI Call Center? Configure your API keys and run `./start-ai-call-center.sh`!** 🚀

## 🌐 Production Environment

The system is already deployed and running at:
- **Frontend**: https://work-1-errcwactxqohaxwm.prod-runtime.all-hands.dev
- **Backend**: https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev
- **Health Check**: https://work-2-errcwactxqohaxwm.prod-runtime.all-hands.dev/health

### Admin Login
- **Email**: admin@aicallcenter.com
- **Password**: password123