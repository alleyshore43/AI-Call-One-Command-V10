# AI Call Center - Agent Routing System

## Overview

The AI Call Center now features a sophisticated agent routing system that intelligently directs incoming calls to the most appropriate AI agent based on various factors including agent type, business hours, call direction, and availability.

## 🌟 Key Features

### Intelligent Call Routing
- **Agent Type Routing**: Route calls to specific agent types (customer service, sales, support, etc.)
- **Business Hours Awareness**: Route calls based on agent availability and business hours
- **Call Direction Support**: Agents can handle inbound, outbound, or both types of calls
- **Fallback System**: Default agent ensures no call goes unanswered

### Multiple AI Agents
- **Customizable Personalities**: Each agent has unique system instructions and greetings
- **Voice Variety**: 8 different AI voices (Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr)
- **Multi-language Support**: Support for 10+ languages
- **Concurrent Call Management**: Each agent can handle multiple simultaneous calls

### Real-time Management
- **Live Monitoring**: Track active calls and agent status in real-time
- **Routing Statistics**: Monitor routing performance and agent utilization
- **Dynamic Configuration**: Update agent settings without system restart

## 🏗️ Architecture

### Core Components

1. **AgentRoutingService** (`agent-routing-service.js`)
   - Central routing logic
   - Agent selection algorithms
   - Business hours validation
   - Fallback handling

2. **Server Integration** (`server-standalone.js`)
   - Webhook routing integration
   - WebSocket agent assignment
   - API endpoints for management

3. **Frontend Management** (`AgentManager.tsx`)
   - Agent creation and configuration UI
   - Real-time agent monitoring
   - Routing statistics dashboard

### Routing Flow

```
Incoming Call → Webhook → Agent Router → Selected Agent → WebSocket Connection
     ↓              ↓           ↓             ↓              ↓
Phone Number → Call Data → Routing Logic → Agent Config → Voice Stream
```

## 🚀 Quick Start

### 1. Start the System
```bash
./start-ai-call-center.sh
```

### 2. Test Agent Routing
```bash
node demo-agent-routing.js
```

### 3. Run Comprehensive Tests
```bash
node test-agent-routing-simple.js
```

## 📞 Agent Configuration

### Agent Types
- `customer_service` - General customer inquiries and support
- `sales` - Sales calls and lead qualification
- `support` - Technical support and troubleshooting
- `appointment_booking` - Scheduling and calendar management
- `survey` - Feedback collection and surveys
- `after_hours` - Outside business hours handling
- `general` - Default catch-all agent

### Voice Options
- **Puck** - Male, Neutral tone
- **Charon** - Male, Deep voice
- **Kore** - Female, Warm tone
- **Fenrir** - Male, Authoritative
- **Aoede** - Female, Melodic
- **Leda** - Female, Professional
- **Orus** - Male, Friendly
- **Zephyr** - Non-binary, Calm

### Call Direction
- `inbound` - Receives incoming calls only
- `outbound` - Makes outgoing calls only
- `both` - Handles both inbound and outbound calls

## 🔧 API Endpoints

### Agent Management
```http
GET /api/agents/active
# Returns active agents and call statistics

POST /api/agents/route-test
# Test routing with specific parameters
{
  "agentType": "customer_service",
  "callData": {
    "From": "+15551234567",
    "To": "+18186006909"
  }
}

GET /api/agents/routing-stats
# Get routing performance statistics
```

### Webhook Integration
```http
POST /webhook/voice
# Twilio webhook for incoming calls
# Automatically routes to appropriate agent
```

## 🎯 Routing Logic

### Priority Order
1. **Phone Number Assignment** - Specific agent assigned to phone number
2. **Agent Type Matching** - Route to agent of requested type
3. **Business Hours** - Route to available agent during business hours
4. **General Availability** - Route to any available agent
5. **Default Fallback** - Use default agent if no specific match

### Business Hours Validation
- Configurable start/end times per agent
- Day-of-week scheduling (Monday=1, Sunday=7)
- Timezone-aware calculations
- After-hours agent fallback

### Load Balancing
- Respect max concurrent calls per agent
- Round-robin selection for same agent type
- Automatic failover to available agents

## 📊 Monitoring & Analytics

### Real-time Metrics
- Active call count
- Agent utilization
- Routing success rate
- Average call duration

### Routing Statistics
- Calls by agent type
- Peak usage times
- Routing decision breakdown
- Agent performance metrics

## 🛠️ Configuration

### Environment Variables
```bash
# Agent Routing Configuration
VOICE_NAME=Puck                    # Default voice
LANGUAGE_CODE=en-US                # Default language
SYSTEM_INSTRUCTION="..."           # Default system instruction

# Business Hours (for default agent)
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
TIMEZONE=America/New_York
```

### Database Schema Enhancement
The system works with existing database schemas by enhancing agent data with routing metadata:

```javascript
// Enhanced agent object includes:
{
  // Existing fields
  id, name, agent_type, voice_name, language_code, system_instruction,
  is_active, max_concurrent_calls, profile_id,
  
  // Enhanced routing fields (added by system)
  call_direction: 'inbound',
  timezone: 'America/New_York',
  business_hours_start: '09:00',
  business_hours_end: '17:00',
  business_days: [1, 2, 3, 4, 5]
}
```

## 🧪 Testing

### Automated Tests
```bash
# Run comprehensive routing tests
node test-agent-routing-simple.js

# Run interactive demo
node demo-agent-routing.js
```

### Manual Testing
1. **Create Test Agents** - Use the frontend to create agents with different types
2. **Test Routing** - Use the route-test API endpoint
3. **Simulate Calls** - Use the webhook endpoint with test data
4. **Monitor Activity** - Check active agents endpoint

## 🔍 Troubleshooting

### Common Issues

**No agents found for routing**
- Check agent `is_active` status
- Verify agent type matches request
- Ensure business hours are configured correctly

**Default agent always selected**
- No specific agents created in database
- All agents are inactive or outside business hours
- Agent type mismatch

**Webhook routing fails**
- Check webhook URL configuration in Twilio
- Verify server is accessible from internet
- Check server logs for errors

### Debug Commands
```bash
# Check system health
curl http://localhost:12001/health

# Test default routing
curl -X POST http://localhost:12001/api/agents/route-test \
  -H "Content-Type: application/json" -d '{}'

# Check active agents
curl http://localhost:12001/api/agents/active

# View server logs
pm2 logs ai-call-backend
```

## 🚀 Production Deployment

### Requirements
- Node.js 18+
- PM2 process manager
- Supabase database
- Twilio account
- Google Gemini API key

### Deployment Steps
1. Configure environment variables
2. Set up database with agent tables
3. Configure Twilio webhooks
4. Deploy with PM2
5. Monitor with routing statistics

### Scaling Considerations
- Multiple server instances with load balancer
- Database connection pooling
- Agent capacity planning
- Real-time monitoring setup

## 📈 Future Enhancements

### Planned Features
- **IVR Integration** - Route based on caller menu selections
- **Skill-based Routing** - Match agents to specific skills/topics
- **Queue Management** - Handle call queuing and wait times
- **Advanced Analytics** - Machine learning routing optimization
- **Multi-tenant Support** - Separate agent pools per organization

### API Extensions
- Agent performance APIs
- Historical routing data
- Real-time event streaming
- Integration webhooks

## 🤝 Contributing

The agent routing system is designed to be extensible. Key areas for contribution:

1. **Routing Algorithms** - Improve agent selection logic
2. **Monitoring** - Enhanced metrics and dashboards
3. **Integration** - Additional CRM and telephony platforms
4. **Testing** - Expanded test coverage and scenarios

## 📄 License

This agent routing system is part of the AI Call Center project and follows the same licensing terms.

---

**Ready to route calls intelligently? Start with `./start-ai-call-center.sh` and experience the power of AI-driven call routing!** 🚀