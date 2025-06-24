# AI Call Center - One Command Deploy

🚀 **Production-ready AI Call Center with Gemini Live API integration**

Deploy a complete AI calling system with smart agent routing, audio triggers, and Zapier integration in one command.

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
- 🎛️ **Agent Management** - Web-based configuration interface
- 📊 **Real-time Dashboard** - Call monitoring and analytics
- 🧪 **Testing Suite** - Comprehensive routing and functionality tests

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/rhondaallen9460/AI-Call-One-Command-V1.git
cd AI-Call-One-Command-V1

# Start the complete AI Call Center system
./start-ai-call-center.sh
```

That's it! Your AI Call Center will be running at:
- **Frontend**: http://localhost:12000
- **Backend**: http://localhost:12001
- **Health Check**: http://localhost:12001/health

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

Before running the deployment script, you **MUST** configure your Gemini API key:

1. Edit `one-command-deploy.sh`
2. Find line with `GEMINI_API_KEY=your_gemini_api_key_here`
3. Replace `your_gemini_api_key_here` with your actual Gemini API key

### Optional Configuration

For production use, you can also configure:
- **Twilio**: For real phone calls
- **Supabase**: For user management and database

## 🎯 How It Works

1. **Audio Trigger**: When a call connects, the system sends a PCM audio trigger to Gemini
2. **Gemini Response**: Gemini Live API processes the audio and responds with speech
3. **Smart Routing**: Calls are routed to appropriate agents based on direction (inbound/outbound)
4. **Real-time Audio**: Bidirectional audio streaming between caller and Gemini
5. **Zapier Integration**: Webhook events trigger automation workflows

## 📁 Project Structure

```
AI-Call-One-Command/
├── one-command-deploy.sh     # Single deployment script
├── server-standalone.js      # Main server with audio trigger
├── packages/                 # Core packages
│   ├── twilio-server/       # Twilio WebSocket handling
│   ├── gemini-live-client/  # Gemini Live API client
│   ├── audio-converter/     # Audio processing utilities
│   └── tw2gem-server/       # Server integration
├── frontend/                # React dashboard
├── utils/                   # Audio trigger system
├── assets/                  # Audio files (PCM trigger)
└── ecosystem.config.js      # PM2 configuration (auto-generated)
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

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development pm2 restart all

# View detailed logs
pm2 logs --lines 100
```

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `pm2 logs`
2. **Verify API key**: Make sure your Gemini API key is correctly configured
3. **Check ports**: Ensure ports 12000-12001 are not in use
4. **Review configuration**: Verify all required settings in the deployment script

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Ready to deploy your AI Call Center? Configure your API key and run `./one-command-deploy.sh`!** 🚀