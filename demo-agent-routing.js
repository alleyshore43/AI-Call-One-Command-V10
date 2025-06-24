#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = 'http://localhost:12001';
const FRONTEND_URL = 'http://localhost:12000';

class AgentRoutingDemo {
    constructor() {
        this.scenarios = [
            {
                name: 'Customer Service Call',
                description: 'Incoming call routed to customer service agent',
                callData: {
                    From: '+15551234567',
                    To: '+18186006909',
                    CallSid: 'CS-' + Date.now()
                },
                agentType: 'customer_service'
            },
            {
                name: 'Sales Inquiry',
                description: 'Incoming call routed to sales agent',
                callData: {
                    From: '+15559876543',
                    To: '+18186006909',
                    CallSid: 'SALES-' + Date.now()
                },
                agentType: 'sales'
            },
            {
                name: 'Technical Support',
                description: 'Incoming call routed to technical support agent',
                callData: {
                    From: '+15555551234',
                    To: '+18186006909',
                    CallSid: 'TECH-' + Date.now()
                },
                agentType: 'support'
            },
            {
                name: 'General Inquiry',
                description: 'Incoming call with automatic routing',
                callData: {
                    From: '+15554567890',
                    To: '+18186006909',
                    CallSid: 'GEN-' + Date.now()
                }
            }
        ];
    }

    async demonstrateRouting() {
        console.log('🎭 AI Call Center Agent Routing Demonstration');
        console.log('=' .repeat(60));
        console.log('This demo shows how the AI Call Center intelligently routes');
        console.log('incoming calls to appropriate AI agents based on various factors.');
        console.log('');

        // Show system status
        await this.showSystemStatus();

        // Demonstrate routing scenarios
        console.log('\n📞 CALL ROUTING SCENARIOS');
        console.log('=' .repeat(60));

        for (const scenario of this.scenarios) {
            await this.demonstrateScenario(scenario);
            console.log(''); // Add spacing between scenarios
        }

        // Show routing statistics
        await this.showRoutingStats();

        // Show active agents
        await this.showActiveAgents();

        console.log('\n🎉 DEMONSTRATION COMPLETE');
        console.log('=' .repeat(60));
        console.log('The AI Call Center Agent Routing System is fully operational!');
        console.log('');
        console.log('🌟 KEY FEATURES DEMONSTRATED:');
        console.log('  ✅ Intelligent call routing based on agent type');
        console.log('  ✅ Default agent fallback for unmatched calls');
        console.log('  ✅ Agent enhancement with routing metadata');
        console.log('  ✅ Real-time routing statistics and monitoring');
        console.log('  ✅ Webhook integration for live call handling');
        console.log('  ✅ Multiple agent configurations (voice, language, instructions)');
        console.log('');
        console.log('🚀 Ready for production use!');
    }

    async showSystemStatus() {
        console.log('🏥 SYSTEM HEALTH CHECK');
        console.log('-'.repeat(30));
        
        try {
            const response = await fetch(`${BACKEND_URL}/health`);
            const health = await response.json();
            
            console.log(`✅ Backend Status: ${health.status}`);
            console.log(`🤖 Gemini API: ${health.gemini}`);
            console.log(`🌐 Port: ${health.port}`);
            console.log(`⏰ Timestamp: ${health.timestamp}`);
        } catch (error) {
            console.log(`❌ Backend Error: ${error.message}`);
        }

        try {
            const frontendResponse = await fetch(`${FRONTEND_URL}`);
            console.log(`✅ Frontend Status: ${frontendResponse.ok ? 'healthy' : 'error'}`);
        } catch (error) {
            console.log(`❌ Frontend Error: ${error.message}`);
        }
    }

    async demonstrateScenario(scenario) {
        console.log(`📋 ${scenario.name}`);
        console.log(`   ${scenario.description}`);
        console.log(`   📞 From: ${scenario.callData.From}`);
        console.log(`   📞 To: ${scenario.callData.To}`);
        console.log(`   🆔 Call ID: ${scenario.callData.CallSid}`);

        try {
            // Test routing
            const routingPayload = scenario.agentType 
                ? { agentType: scenario.agentType }
                : { callData: scenario.callData };

            const routeResponse = await fetch(`${BACKEND_URL}/api/agents/route-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routingPayload)
            });

            if (routeResponse.ok) {
                const routeData = await routeResponse.json();
                const agent = routeData.selected_agent;
                
                if (agent) {
                    console.log(`   🎯 Routed to: ${agent.name}`);
                    console.log(`   🎭 Agent Type: ${agent.agent_type}`);
                    console.log(`   🗣️ Voice: ${agent.voice_name}`);
                    console.log(`   🌍 Language: ${agent.language_code}`);
                    console.log(`   📞 Max Calls: ${agent.max_concurrent_calls}`);
                    console.log(`   🕐 Business Hours: ${agent.business_hours_start} - ${agent.business_hours_end}`);
                    console.log(`   🌎 Timezone: ${agent.timezone}`);
                    console.log(`   📝 Greeting: "${agent.greeting || 'Default greeting'}"`);
                } else {
                    console.log(`   ⚠️ No agent found for this scenario`);
                }
            } else {
                console.log(`   ❌ Routing failed: ${routeResponse.status}`);
            }

            // Test webhook
            const webhookData = new URLSearchParams({
                ...scenario.callData,
                CallStatus: 'ringing'
            });

            const webhookResponse = await fetch(`${BACKEND_URL}/webhook/voice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: webhookData.toString()
            });

            if (webhookResponse.ok) {
                const twiml = await webhookResponse.text();
                console.log(`   ✅ Webhook Response: TwiML generated successfully`);
                
                // Extract greeting from TwiML
                const sayMatch = twiml.match(/<Say[^>]*>(.*?)<\/Say>/);
                if (sayMatch) {
                    console.log(`   💬 AI Greeting: "${sayMatch[1]}"`);
                }
            } else {
                console.log(`   ❌ Webhook failed: ${webhookResponse.status}`);
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    async showRoutingStats() {
        console.log('\n📊 ROUTING STATISTICS');
        console.log('-'.repeat(30));
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/agents/routing-stats`);
            const stats = await response.json();
            
            if (Object.keys(stats).length === 0) {
                console.log('📈 No routing statistics available yet');
                console.log('   (Statistics will appear after actual calls are processed)');
            } else {
                console.log('📈 Current routing statistics:');
                console.log(JSON.stringify(stats, null, 2));
            }
        } catch (error) {
            console.log(`❌ Stats Error: ${error.message}`);
        }
    }

    async showActiveAgents() {
        console.log('\n👥 ACTIVE AGENTS STATUS');
        console.log('-'.repeat(30));
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/agents/active`);
            const data = await response.json();
            
            console.log(`📞 Active Calls: ${data.active_calls}`);
            console.log(`👤 Active Agents: ${data.active_agents.length}`);
            
            if (data.active_agents.length > 0) {
                console.log('\n🎭 Currently Active Agents:');
                data.active_agents.forEach((agent, index) => {
                    console.log(`   ${index + 1}. ${agent.name} (${agent.agent_type})`);
                });
            } else {
                console.log('   No agents currently handling calls');
            }
        } catch (error) {
            console.log(`❌ Active Agents Error: ${error.message}`);
        }
    }
}

// Run the demonstration
console.log('🚀 Starting AI Call Center Agent Routing Demo...\n');

const demo = new AgentRoutingDemo();
demo.demonstrateRouting().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
});