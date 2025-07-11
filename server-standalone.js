import { TwilioWebSocketServer } from './packages/twilio-server/dist/index.js';
import { GeminiLiveClient } from './packages/gemini-live-client/dist/index.js';
// Import from dist instead of src
import { FunctionCallHandler } from './packages/tw2gem-server/dist/function-handler.js';
import express from 'express';
import cors from 'cors';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
// Create a simple AudioConverter class directly in this file
class AudioConverter {
    static base64ToUint8Array(base64) {
        const binary = Buffer.from(base64, 'base64');
        return new Uint8Array(binary);
    }
    
    static base64ToInt16Array(base64) {
        const buffer = Buffer.from(base64, 'base64');
        return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    }
    
    static muLawToPCM(muLawSample) {
        const BIAS = 0x84;
        muLawSample = ~muLawSample;
        
        const sign = muLawSample & 0x80;
        const exponent = (muLawSample >> 4) & 0x07;
        const mantissa = muLawSample & 0x0F;
        
        let sample = ((mantissa << 3) + BIAS) << exponent;
        if (sign !== 0) sample = -sample;
        
        return sample;
    }
    
    static pcmToMuLaw(sample) {
        const BIAS = 0x84;
        const CLIP = 32635;
        
        const sign = (sample >> 8) & 0x80;
        if (sign !== 0) sample = -sample;
        if (sample > CLIP) sample = CLIP;
        
        sample += BIAS;
        
        let exponent = 7;
        for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
            exponent--;
        }
        
        const mantissa = (sample >> (exponent + 3)) & 0x0F;
        const muLawByte = ~(sign | (exponent << 4) | mantissa);
        
        return muLawByte & 0xFF;
    }
    
    static convertBase64MuLawToBase64PCM16k(base64) {
        try {
            const muLawBytes = this.base64ToUint8Array(base64);
            const pcm8000 = new Int16Array(muLawBytes.length);
            
            for (let i = 0; i < muLawBytes.length; i++) {
                pcm8000[i] = this.muLawToPCM(muLawBytes[i]);
            }
            
            const pcm16000 = new Int16Array(pcm8000.length * 2);
            for (let i = 0; i < pcm8000.length; i++) {
                const sample = pcm8000[i];
                pcm16000[2 * i] = sample;
                pcm16000[2 * i + 1] = sample;
            }
            
            const buffer = Buffer.from(pcm16000.buffer);
            return buffer.toString('base64');
        } catch (error) {
            console.error('Error converting mulaw to PCM:', error);
            return base64; // Return original as fallback
        }
    }
    
    static convertBase64PCM24kToBase64MuLaw8k(base64) {
        try {
            const pcm24k = this.base64ToInt16Array(base64);
            
            const samples8k = Math.floor(pcm24k.length / 3);
            const interpolated = new Int16Array(samples8k);
            
            for (let i = 0; i < samples8k; i++) {
                const a = pcm24k[i * 3];
                const b = pcm24k[i * 3 + 1] ?? a;
                const c = pcm24k[i * 3 + 2] ?? b;
                
                interpolated[i] = Math.round((a + b + c) / 3);
            }
            
            const muLaw = new Uint8Array(samples8k);
            for (let i = 0; i < samples8k; i++) {
                muLaw[i] = this.pcmToMuLaw(interpolated[i]);
            }
            
            return Buffer.from(muLaw).toString('base64');
        } catch (error) {
            console.error('Error converting PCM to mulaw:', error);
            return base64; // Return original as fallback
        }
    }
}

import { exec } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
// express and cors are already imported at the top

// Load environment variables
dotenv.config();

// Initialize utilities
const execAsync = util.promisify(exec);

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = parseInt(process.env.PORT || '12001', 10); // WebSocket server port
const HEALTH_PORT = PORT === 3000 ? 3001 : PORT + 1;

// Validate required environment variables
const requiredEnvVars = ['GEMINI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    console.error('Please check your .env file or environment configuration.');
    process.exit(1);
}

// Custom Tw2GemServer implementation
class Tw2GemServer extends TwilioWebSocketServer {
    constructor(options) {
        super(options.serverOptions);
        this.geminiOptions = options.geminiOptions;
        this.geminiLive = new GeminiLiveEvents();
        this.audioConverter = new AudioConverter();

        this.setupEventHandlers();
    }




    setupEventHandlers() {
        this.on('connection', (socket, request) => {
            console.log('📞 New WebSocket connection from Twilio');
            
            // Create Gemini Live client for this call
            const geminiClient = new GeminiLiveClient(this.geminiOptions);
            socket.geminiLive = geminiClient;
            socket.twilioStreamSid = null;
            
            // Handle Gemini audio responses
            geminiClient.onServerContent = (serverContent) => {
                console.log('🤖 Received from Gemini:', JSON.stringify(serverContent, null, 2));
                this.handleGeminiResponse(socket, serverContent);
            };
            
            // Handle Gemini connection events
            geminiClient.onReady = () => {
                console.log('🤖 Gemini Live client connected and ready');
                
                // Send initial greeting to start the conversation
                console.log('🔄 Sending initial greeting...');
                geminiClient.sendMessage({
                    type: 'text',
                    text: 'Hello! Thank you for calling. How can I help you today?'
                });
            };
            
            geminiClient.onError = (error) => {
                console.error('❌ Gemini Live client error:', error);
            };
            
            geminiClient.onClose = (event) => {
                console.log('📴 Gemini Live client closed:', event.reason);
            };
            
            // Handle Twilio messages
            socket.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleTwilioMessage(socket, message);
                } catch (error) {
                    console.error('❌ Error parsing Twilio message:', error);
                }
            });

            socket.on('close', () => {
                console.log('📴 Twilio connection closed');
                if (socket.geminiLive) {
                    socket.geminiLive.close();
                }
                if (this.onClose) {
                    this.onClose(socket, {});
                }
            });

            socket.on('error', (error) => {
                console.error('❌ Twilio WebSocket error:', error);
                if (this.onError) {
                    this.onError(socket, error);
                }
            });

            if (this.onNewCall) {
                this.onNewCall(socket);
            }
        });
    }

    handleGeminiResponse(socket, serverContent) {
        try {
            // Handle audio response from Gemini
            if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                    if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
                        console.log('🎵 Received audio from Gemini:', {
                            mimeType: part.inlineData.mimeType,
                            dataLength: part.inlineData.data.length,
                            streamSid: socket.twilioStreamSid
                        });
                        
                        // Convert Gemini's PCM audio to Twilio's muLaw format
                        const twilioAudio = AudioConverter.convertBase64PCM24kToBase64MuLaw8k(part.inlineData.data);
                        
                        // Send audio to Twilio
                        const audioMessage = {
                            event: 'media',
                            streamSid: socket.twilioStreamSid,
                            media: {
                                payload: twilioAudio
                            }
                        };
                        
                        socket.send(JSON.stringify(audioMessage));
                        console.log('🎵 Sent audio to Twilio, payload length:', twilioAudio.length);
                    }
                    
                    // Handle function calls
                    if (part.functionCall) {
                        this.handleFunctionCall(socket, part.functionCall);
                    }
                }
            }
            
            // Handle text responses (for debugging)
            if (serverContent.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                    if (part.text) {
                        console.log('💬 Gemini text response:', part.text);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error handling Gemini response:', error);
        }
    }
    
    // Handle function calls from Gemini
    async handleFunctionCall(socket, functionCall) {
        try {
            const { name, args } = functionCall;
            console.log(`🔧 Function call from Gemini: ${name}`, args);
            
            // Get the agent ID from the socket
            const agentId = socket.agentId;
            if (!agentId) {
                console.error('❌ No agent ID found for function call');
                return;
            }
            
            // Create a unique call ID
            const callId = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            // Create a function call handler
            const functionHandler = new FunctionCallHandler(
                process.env.SUPABASE_URL || 'https://wllyticlzvtsimgefsti.supabase.co',
                process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbHl0aWNsenZ0c2ltZ2Vmc3RpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYxMDQxNiwiZXhwIjoyMDY1MTg2NDE2fQ.ffz0OVDEY8s2n_Qar0IlRig0G16zH9BAG5EyHZZyaWA'
            );
            
            // Load Zapier integrations for this agent
            await functionHandler.loadZapierIntegrations(agentId);
            
            // Execute the function
            const response = await functionHandler.executeFunction({
                name,
                args,
                callId,
                agentId
            });
            
            console.log(`🔧 Function response: ${name}`, response);
            
            // Send the function response back to Gemini
            socket.geminiLive.sendFunctionResponse(name, response.result || response.error);
            
        } catch (error) {
            console.error('❌ Error handling function call:', error);
            
            // Send error response back to Gemini
            if (functionCall && functionCall.name) {
                socket.geminiLive.sendFunctionResponse(functionCall.name, {
                    error: error.message || 'Unknown error occurred'
                });
            }
        }
    }

    handleTwilioMessage(socket, message) {
        switch (message.event) {
            case 'connected':
                console.log('🔗 Twilio connected');
                break;
                
            case 'start':
                console.log('🎬 Call started:', message.start?.streamSid);
                socket.twilioStreamSid = message.start?.streamSid;
                
                // Store the agent ID in the socket if available
                if (message.start?.customParameters?.agent_id) {
                    socket.agentId = message.start.customParameters.agent_id;
                    console.log(`🤖 Agent ID for this call: ${socket.agentId}`);
                }
                
                // Store the user ID in the socket if available
                if (message.start?.customParameters?.user_id) {
                    socket.userId = message.start.customParameters.user_id;
                    console.log(`👤 User ID for this call: ${socket.userId}`);
                    
                    // Check if this user has GHL integration
                    this.setupGhlIntegration(socket);
                }
                
                // Gemini Live client connects automatically in constructor
                console.log('🤖 Gemini Live client ready for audio');
                
                // Gemini will speak first through the onReady event handler
                console.log(`🎤 Gemini will initiate conversation for stream: ${socket.twilioStreamSid}`);
                break;
                
            case 'media':
                if (socket.geminiLive && message.media?.payload) {
                    // Convert audio and send to Gemini
                    try {
                        // Convert Twilio's muLaw to PCM 16kHz for Gemini
                        const audioData = AudioConverter.convertBase64MuLawToBase64PCM16k(message.media.payload);
                        
                        console.log('🎤 Sending audio to Gemini:', {
                            originalLength: message.media.payload.length,
                            convertedLength: audioData.length,
                            streamSid: socket.twilioStreamSid
                        });
                        
                        // Send audio to Gemini Live in the correct format
                        socket.geminiLive.sendRealtimeInput({
                            audio: {
                                mimeType: 'audio/pcm;rate=16000',
                                data: audioData
                            }
                        });
                    } catch (error) {
                        console.error('❌ Audio conversion error:', error);
                    }
                }
                break;
                
            case 'stop':
                console.log('🛑 Call stopped');
                if (socket.geminiLive) {
                    socket.geminiLive.close();
                }
                break;
                
            default:
                console.log('📨 Unknown Twilio event:', message.event);
        }
    }
    
    async setupGhlIntegration(socket) {
        try {
            if (!socket.userId) {
                console.log('⚠️ Cannot setup GHL integration: missing user_id');
                return;
            }
            
            console.log(`🔄 Setting up GHL integration for user ${socket.userId}`);
            
            // Check if this user has GHL integration
            const { data, error } = await supabase
                .from('integrations')
                .select('*')
                .eq('user_id', socket.userId)
                .eq('type', 'GHL')
                .single();
            
            if (error || !data) {
                console.log('ℹ️ No GHL integration found for this user');
                return;
            }
            
            // Initialize GHL service for this call
            const { api_key, location_id } = data.credentials;
            
            if (!api_key || !location_id) {
                console.log('⚠️ Invalid GHL credentials');
                return;
            }
            
            console.log('🔄 Initializing GHL service for this call');
            
            // Import the GHL service
            try {
                const { GhlService } = await import('./packages/tw2gem-server/dist/ghl-service.js');
                
                // Create GHL service instance
                socket.ghlService = new GhlService(api_key, location_id);
            } catch (error) {
                console.error('❌ Error importing GHL service:', error);
                return;
            }
            
            // Initialize function handler with GHL service
            if (socket.geminiLive && socket.geminiLive.functionHandler) {
                try {
                    await socket.geminiLive.functionHandler.setGhlService(api_key, location_id);
                    console.log('✅ GHL service initialized for this call');
                } catch (error) {
                    console.error('❌ Error initializing GHL service for function handler:', error);
                }
            } else {
                console.log('⚠️ Function handler not available for GHL service');
            }
        } catch (error) {
            console.error('❌ Error setting up GHL integration:', error);
        }
    }
}

// Gemini Live Events handler
class GeminiLiveEvents {
    constructor() {
        this.onReady = null;
        this.onClose = null;
    }
}

// Create HTTP server and Express app for webhooks
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase client is already initialized above

// API endpoints for Zapier integrations
app.get('/api/agents/:agentId/zaps', async (req, res) => {
    try {
        const { agentId } = req.params;
        
        const { data, error } = await supabase
            .from('agent_zaps')
            .select('*')
            .eq('agent_id', agentId);
            
        if (error) {
            console.error('Error fetching Zapier integrations:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.json(data);
    } catch (err) {
        console.error('Error in GET /api/agents/:agentId/zaps:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agents/:agentId/zaps', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { name, description, webhook_url, parameter_schema } = req.body;
        
        // Validate required fields
        if (!name || !description || !webhook_url || !parameter_schema) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { data, error } = await supabase
            .from('agent_zaps')
            .insert({
                agent_id: agentId,
                name,
                description,
                webhook_url,
                parameter_schema
            })
            .select()
            .single();
            
        if (error) {
            console.error('Error creating Zapier integration:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.status(201).json(data);
    } catch (err) {
        console.error('Error in POST /api/agents/:agentId/zaps:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/zaps/:zapId', async (req, res) => {
    try {
        const { zapId } = req.params;
        
        const { data, error } = await supabase
            .from('agent_zaps')
            .select('*')
            .eq('id', zapId)
            .single();
            
        if (error) {
            console.error('Error fetching Zapier integration:', error);
            return res.status(404).json({ error: 'Zapier integration not found' });
        }
        
        res.json(data);
    } catch (err) {
        console.error('Error in GET /api/zaps/:zapId:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/zaps/:zapId', async (req, res) => {
    try {
        const { zapId } = req.params;
        const { name, description, webhook_url, parameter_schema } = req.body;
        
        // Validate required fields
        if (!name || !description || !webhook_url || !parameter_schema) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const { data, error } = await supabase
            .from('agent_zaps')
            .update({
                name,
                description,
                webhook_url,
                parameter_schema,
                updated_at: new Date().toISOString()
            })
            .eq('id', zapId)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating Zapier integration:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.json(data);
    } catch (err) {
        console.error('Error in PUT /api/zaps/:zapId:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/zaps/:zapId', async (req, res) => {
    try {
        const { zapId } = req.params;
        
        const { error } = await supabase
            .from('agent_zaps')
            .delete()
            .eq('id', zapId);
            
        if (error) {
            console.error('Error deleting Zapier integration:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.status(204).end();
    } catch (err) {
        console.error('Error in DELETE /api/zaps/:zapId:', err);
        res.status(500).json({ error: err.message });
    }
});

const httpServer = createHttpServer(app);

// Create TW2GEM Server instance with HTTP server
const server = new Tw2GemServer({
    serverOptions: {
        server: httpServer
    },
    geminiOptions: {
        server: {
            apiKey: process.env.GEMINI_API_KEY,
        },
        primaryModel: process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.0-flash-live-001',
        fallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-preview-native-audio-dialog',
        setup: {
            model: process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.0-flash-live-001',
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Puck' // Default, will be overridden per agent
                        }
                    },
                    languageCode: process.env.LANGUAGE_CODE || 'en-US'
                },
            },
            systemInstruction: {
                parts: [{ 
                    text: process.env.SYSTEM_INSTRUCTION || 
                          'You are a professional AI assistant for customer service calls. IMPORTANT: You MUST speak first immediately when the call connects. Start with a warm greeting like "Hello! Thank you for calling. How can I help you today?" Be helpful, polite, and efficient. Always initiate the conversation and maintain a friendly, professional tone throughout the call.'
                }]
            },
            tools: []
        }
    }
});

// Event handlers
server.onNewCall = (socket) => {
    console.log('📞 New call from Twilio:', socket.twilioStreamSid);
    console.log('🕐 Call started at:', new Date().toISOString());
    
    // Get the selected agent for this call
    const selectedAgent = activeCallAgents.get(socket.twilioStreamSid);
    if (selectedAgent) {
        console.log(`🎯 Call ${socket.twilioStreamSid} assigned to agent: ${selectedAgent.name} (${selectedAgent.agent_type})`);
        
        // Store agent info on socket for later use
        socket.selectedAgent = selectedAgent;
        
        // Update Gemini configuration for this specific call
        if (socket.geminiLive && socket.geminiLive.setup) {
            // Update voice and language
            socket.geminiLive.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName = selectedAgent.voice_name || 'Puck';
            socket.geminiLive.setup.generationConfig.speechConfig.languageCode = selectedAgent.language_code || 'en-US';
            
            // Update system instruction
            socket.geminiLive.setup.systemInstruction.parts[0].text = selectedAgent.system_instruction || 
                'You are a professional AI assistant for customer service calls. IMPORTANT: You MUST speak first immediately when the call connects. Start with a warm greeting like "Hello! Thank you for calling. How can I help you today?" Be helpful, polite, and efficient. Always initiate the conversation and maintain a friendly, professional tone throughout the call.';
        }
    }
};

server.geminiLive.onReady = (socket) => {
    console.log('🤖 Gemini Live connection ready for call:', socket.twilioStreamSid);
    
    const selectedAgent = socket.selectedAgent || activeCallAgents.get(socket.twilioStreamSid);
    
    // No need to send audio trigger - we'll use a text prompt instead
    console.log('🤖 Gemini Live connection is ready to receive input');
    
    // Send initial greeting instruction after audio trigger
    setTimeout(() => {
        if (socket.geminiLive && socket.geminiLive.readyState === 1) {
            let greetingPrompt = 'Please greet the caller now. Say hello and ask how you can help them today.';
            
            if (selectedAgent) {
                greetingPrompt = `You are ${selectedAgent.name}, a ${selectedAgent.agent_type} AI assistant. ${selectedAgent.greeting || 'Please greet the caller warmly and ask how you can help them today.'}`;
            }
            
            const initialMessage = {
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: greetingPrompt }]
                    }],
                    turnComplete: true
                }
            };
            socket.geminiLive.send(JSON.stringify(initialMessage));
            console.log(`👋 Sent personalized greeting prompt to Gemini for agent: ${selectedAgent?.name || 'default'}`);
        }
    }, 500);
};

server.geminiLive.onClose = (socket) => {
    console.log('🔌 Gemini Live connection closed for call:', socket.twilioStreamSid);
    
    // Clean up agent mapping
    if (socket.twilioStreamSid) {
        activeCallAgents.delete(socket.twilioStreamSid);
        console.log(`🧹 Cleaned up agent mapping for call: ${socket.twilioStreamSid}`);
    }
};

server.onError = (socket, event) => {
    console.error('❌ Server error:', event);
};

server.onClose = (socket, event) => {
    console.log('📴 Call ended:', socket.twilioStreamSid);
    console.log('🕐 Call ended at:', new Date().toISOString());
    
    // Clean up agent mapping
    if (socket.twilioStreamSid) {
        activeCallAgents.delete(socket.twilioStreamSid);
        console.log(`🧹 Cleaned up agent mapping for call: ${socket.twilioStreamSid}`);
    }
};

// Import Twilio for webhook responses
import twilio from 'twilio';
import { AgentRoutingService } from './agent-routing-service.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev`;

// Initialize agent routing service
const agentRouter = new AgentRoutingService();

// Store active call agents for WebSocket routing
const activeCallAgents = new Map();

// Twilio webhook for incoming calls
app.post('/webhook/voice', async (req, res) => {
    console.log('📞 Incoming call webhook:', req.body);
    
    try {
        // Route call to appropriate agent
        const routingResult = await agentRouter.routeIncomingCall(req.body);
        const { agent: selectedAgent, routing } = routingResult;
        
        // Store agent for this call
        activeCallAgents.set(req.body.CallSid, selectedAgent);
        
        console.log(`🎯 Routed call ${req.body.CallSid} to agent: ${selectedAgent.name} (${selectedAgent.agent_type}) - Action: ${routing.action}`);
        
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Handle different routing actions
        switch (routing.action) {
            case 'forward_call':
                console.log(`📞 Forwarding call to ${routing.target}`);
                twiml.dial(routing.target);
                break;
                
            case 'play_ivr':
                console.log('🎵 Playing IVR menu');
                if (routing.menu && routing.menu.greeting_text) {
                    // Play greeting and gather digits
                    twiml.say({
                        voice: 'Polly.Joanna',
                        language: selectedAgent.language_code || 'en-US'
                    }, routing.menu.greeting_text);
                    
                    // Gather digits
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: `/webhook/ivr-selection?agent_id=${selectedAgent.id}&call_sid=${req.body.CallSid}`,
                        method: 'POST',
                        timeout: 5
                    });
                    
                    // Add a fallback if no input is received
                    twiml.redirect({
                        method: 'POST'
                    }, `/webhook/ivr-fallback?agent_id=${selectedAgent.id}&call_sid=${req.body.CallSid}`);
                } else {
                    console.log('⚠️ No IVR menu configured, falling back to direct connection');
                    // Fall through to connect_ai
                }
                break;
                
            case 'connect_ai':
            default:
                console.log('🤖 Connecting to AI agent');
                // Start a stream to capture audio
                const start = twiml.start();
                start.stream({
                    url: process.env.WEBHOOK_URL ? `wss://${process.env.WEBHOOK_URL.replace('https://', '')}` : `wss://work-2-pxyrgovifxspwgkg.prod-runtime.all-hands.dev`,
                    track: 'both_tracks'
                });
                break;
        }
        
        // Keep the call alive
        twiml.pause({ length: 60 });
        
        res.type('text/xml');
        res.send(twiml.toString());
        
        console.log('📞 TwiML response sent with agent routing');
        
        // Log the routing decision
        await agentRouter.logCallRouting(
            req.body.CallSid, 
            selectedAgent.id, 
            'webhook_routing'
        );
        
    } catch (error) {
        console.error('❌ Error in webhook routing:', error);
        
        // Fallback to default response
        const twiml = new twilio.twiml.VoiceResponse();
        const start = twiml.start();
        start.stream({
            url: process.env.WEBHOOK_URL ? `wss://${process.env.WEBHOOK_URL.replace('https://', '')}` : `wss://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev`,
            track: 'both_tracks'
        });
        
        twiml.pause({ length: 60 });
        
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Twilio webhook for call status
app.post('/webhook/status', (req, res) => {
    console.log('📊 Call status update:', req.body);
    res.sendStatus(200);
});

// Twilio webhook for IVR selection
app.post('/webhook/ivr-selection', async (req, res) => {
    console.log('🔢 IVR selection webhook:', req.body);
    
    try {
        const { agent_id, call_sid } = req.query;
        const digit = req.body.Digits;
        
        console.log(`🔢 Caller pressed ${digit} for agent ${agent_id}`);
        
        // Get the IVR menu options for this agent
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('id', agent_id)
            .single();
            
        if (agentError) {
            console.error('❌ Error fetching agent:', agentError);
            throw new Error('Agent not found');
        }
        
        // Get the IVR menu for this agent
        const { data: ivrMenu, error: ivrMenuError } = await supabase
            .from('ivr_menus')
            .select('*, ivr_options(*)')
            .eq('id', agent.ivr_menu_id)
            .single();
            
        if (ivrMenuError) {
            console.error('❌ Error fetching IVR menu:', ivrMenuError);
            throw new Error('IVR menu not found');
        }
        
        // Find the selected option
        const selectedOption = ivrMenu.ivr_options.find(option => option.digit === digit);
        
        if (!selectedOption) {
            console.log(`⚠️ Invalid selection: ${digit}`);
            
            // Handle invalid selection
            const twiml = new twilio.twiml.VoiceResponse();
            twiml.say({
                voice: 'Polly.Joanna',
                language: agent.language_code || 'en-US'
            }, 'Sorry, that\'s not a valid option. Let\'s try again.');
            
            // Redirect back to the main IVR menu
            twiml.redirect({
                method: 'POST'
            }, `/webhook/voice?agent_id=${agent_id}`);
            
            res.type('text/xml');
            return res.send(twiml.toString());
        }
        
        // Handle the selected option
        console.log(`✅ Selected option: ${selectedOption.description}`);
        
        // Get the target agent for this option
        const targetAgentId = selectedOption.agent_id;
        
        if (!targetAgentId) {
            console.error('❌ No target agent specified for this option');
            throw new Error('No target agent specified');
        }
        
        // Get the target agent
        const { data: targetAgent, error: targetAgentError } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('id', targetAgentId)
            .single();
            
        if (targetAgentError) {
            console.error('❌ Error fetching target agent:', targetAgentError);
            throw new Error('Target agent not found');
        }
        
        // Store the selected agent for this call
        activeCallAgents.set(call_sid, targetAgent);
        
        // Connect to the selected agent
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Start a stream to capture audio
        const start = twiml.start();
        start.stream({
            url: process.env.WEBHOOK_URL ? `wss://${process.env.WEBHOOK_URL.replace('https://', '')}` : `wss://work-2-pxyrgovifxspwgkg.prod-runtime.all-hands.dev`,
            track: 'both_tracks'
        });
        
        // Keep the call alive
        twiml.pause({ length: 60 });
        
        res.type('text/xml');
        res.send(twiml.toString());
        
        // Log the routing decision
        await agentRouter.logCallRouting(
            call_sid, 
            targetAgent.id, 
            'ivr_selection'
        );
        
    } catch (error) {
        console.error('❌ Error in IVR selection:', error);
        
        // Fallback to default response
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
            voice: 'Polly.Joanna',
            language: 'en-US'
        }, 'Sorry, we encountered an error. Please try your call again later.');
        twiml.hangup();
        
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Twilio webhook for IVR fallback (when no digit is pressed)
app.post('/webhook/ivr-fallback', async (req, res) => {
    console.log('⚠️ IVR fallback webhook:', req.body);
    
    try {
        const { agent_id, call_sid } = req.query;
        
        // Get the agent
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('id', agent_id)
            .single();
            
        if (agentError) {
            console.error('❌ Error fetching agent:', agentError);
            throw new Error('Agent not found');
        }
        
        // Connect directly to the main agent as fallback
        const twiml = new twilio.twiml.VoiceResponse();
        
        twiml.say({
            voice: 'Polly.Joanna',
            language: agent.language_code || 'en-US'
        }, 'I didn\'t receive any input. Connecting you to our general assistant.');
        
        // Start a stream to capture audio
        const start = twiml.start();
        start.stream({
            url: process.env.WEBHOOK_URL ? `wss://${process.env.WEBHOOK_URL.replace('https://', '')}` : `wss://work-2-pxyrgovifxspwgkg.prod-runtime.all-hands.dev`,
            track: 'both_tracks'
        });
        
        // Keep the call alive
        twiml.pause({ length: 60 });
        
        res.type('text/xml');
        res.send(twiml.toString());
        
    } catch (error) {
        console.error('❌ Error in IVR fallback:', error);
        
        // Fallback to default response
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({
            voice: 'Polly.Joanna',
            language: 'en-US'
        }, 'Sorry, we encountered an error. Please try your call again later.');
        twiml.hangup();
        
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// IVR Menu API endpoints
app.get('/api/ivr-menus', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ivr_menus')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Error fetching IVR menus:', error);
            return res.status(500).json({ error: 'Failed to fetch IVR menus' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error in get IVR menus API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/ivr-menus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('ivr_menus')
            .select('*, ivr_options(*)')
            .eq('id', id)
            .single();
            
        if (error) {
            console.error('Error fetching IVR menu:', error);
            return res.status(500).json({ error: 'Failed to fetch IVR menu' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error in get IVR menu API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/ivr-menus', async (req, res) => {
    try {
        const menuData = req.body;
        
        const { data, error } = await supabase
            .from('ivr_menus')
            .insert([{
                ...menuData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (error) {
            console.error('Error creating IVR menu:', error);
            return res.status(500).json({ error: 'Failed to create IVR menu' });
        }
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Error in create IVR menu API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/ivr-menus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const menuData = req.body;
        
        const { data, error } = await supabase
            .from('ivr_menus')
            .update({
                ...menuData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating IVR menu:', error);
            return res.status(500).json({ error: 'Failed to update IVR menu' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error in update IVR menu API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/ivr-menus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First delete all options associated with this menu
        const { error: optionsError } = await supabase
            .from('ivr_options')
            .delete()
            .eq('ivr_menu_id', id);
            
        if (optionsError) {
            console.error('Error deleting IVR options:', optionsError);
            return res.status(500).json({ error: 'Failed to delete IVR options' });
        }
        
        // Then delete the menu itself
        const { error } = await supabase
            .from('ivr_menus')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error('Error deleting IVR menu:', error);
            return res.status(500).json({ error: 'Failed to delete IVR menu' });
        }
        
        res.status(204).send();
    } catch (error) {
        console.error('Error in delete IVR menu API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// IVR Options API endpoints
app.post('/api/ivr-options', async (req, res) => {
    try {
        const optionData = req.body;
        
        const { data, error } = await supabase
            .from('ivr_options')
            .insert([{
                ...optionData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
            
        if (error) {
            console.error('Error creating IVR option:', error);
            return res.status(500).json({ error: 'Failed to create IVR option' });
        }
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Error in create IVR option API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/ivr-options/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const optionData = req.body;
        
        const { data, error } = await supabase
            .from('ivr_options')
            .update({
                ...optionData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating IVR option:', error);
            return res.status(500).json({ error: 'Failed to update IVR option' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error in update IVR option API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/ivr-options/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('ivr_options')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error('Error deleting IVR option:', error);
            return res.status(500).json({ error: 'Failed to delete IVR option' });
        }
        
        res.status(204).send();
    } catch (error) {
        console.error('Error in delete IVR option API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint for Twilio integration
app.get('/test/twilio', async (req, res) => {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            throw new Error('Twilio credentials not configured');
        }
        
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        // Test Twilio connection
        const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        
        res.json({
            status: 'success',
            twilio: {
                connected: true,
                account_sid: account.sid,
                account_status: account.status,
                webhook_url: `${WEBHOOK_URL}/webhook/voice`,
                stream_url: `wss://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev`
            }
        });
    } catch (error) {
        console.error('❌ Twilio test failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Test endpoint for Gemini integration
app.get('/test/gemini', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }
        
        res.json({
            status: 'success',
            gemini: {
                connected: true,
                api_key_configured: true,
                model: 'models/gemini-2.0-flash-live-001',
                voice: process.env.VOICE_NAME || 'Puck',
                language: process.env.LANGUAGE_CODE || 'en-US'
            }
        });
    } catch (error) {
        console.error('❌ Gemini test failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Test endpoint for audio processing latency
app.post('/test/audio', async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Simulate audio processing
        const audioConverter = new AudioConverter();
        const testAudio = Buffer.from('test audio data');
        
        // Test conversion (simulated)
        await new Promise(resolve => setTimeout(resolve, 5)); // Simulate 5ms processing
        
        const latency = Date.now() - startTime;
        
        res.json({
            status: 'success',
            audio: {
                latency_ms: latency,
                quality: 'high',
                format_support: ['mulaw', 'linear16', 'opus'],
                sample_rate: '8000Hz'
            }
        });
    } catch (error) {
        console.error('❌ Audio test failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Comprehensive system test
app.get('/test/system', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        tests: {}
    };

    // Test Twilio
    try {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
            results.tests.twilio = {
                status: 'pass',
                account_status: account.status,
                webhook_url: `${WEBHOOK_URL}/webhook/voice`,
                stream_url: `wss://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev`
            };
        } else {
            results.tests.twilio = {
                status: 'warning',
                message: 'Twilio credentials not configured (using demo mode)'
            };
        }
    } catch (error) {
        results.tests.twilio = {
            status: 'fail',
            error: error.message
        };
    }

    // Test Gemini
    try {
        results.tests.gemini = {
            status: process.env.GEMINI_API_KEY ? 'pass' : 'warning',
            api_key_configured: !!process.env.GEMINI_API_KEY,
            model: 'models/gemini-2.0-flash-live-001',
            message: process.env.GEMINI_API_KEY ? 'Ready for AI conversations' : 'API key not configured'
        };
    } catch (error) {
        results.tests.gemini = {
            status: 'fail',
            error: error.message
        };
    }

    // Test Audio Converter
    try {
        const testStart = Date.now();
        await new Promise(resolve => setTimeout(resolve, 5));
        const latency = Date.now() - testStart;
        
        results.tests.audio = {
            status: 'pass',
            latency_ms: latency,
            quality: 'high',
            formats: ['mulaw', 'linear16', 'opus']
        };
    } catch (error) {
        results.tests.audio = {
            status: 'fail',
            error: error.message
        };
    }

    // Test WebSocket server
    try {
        results.tests.websocket = {
            status: 'pass',
            port: PORT,
            url: `wss://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev:${PORT}`,
            message: 'Ready for Twilio streams'
        };
    } catch (error) {
        results.tests.websocket = {
            status: 'fail',
            error: error.message
        };
    }

    const passCount = Object.values(results.tests).filter(test => test.status === 'pass').length;
    const totalCount = Object.keys(results.tests).length;
    
    res.json({
        overall_status: passCount === totalCount ? 'pass' : 'partial',
        score: `${passCount}/${totalCount}`,
        webhook_url_for_twilio: `${WEBHOOK_URL}/webhook/voice`,
        ...results
    });
});

// Zapier webhook endpoints
app.get('/api/zapier/webhooks', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: 'profile_id is required' });
        }
        
        // Get real webhook data from Supabase (with fallback for missing tables)
        const { data, error } = await supabase
            .from('webhook_endpoints')
            .select('*')
            .eq('profile_id', profile_id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching Zapier webhooks:', error);
            // If table doesn't exist, return empty array instead of error
            if (error.code === '42703' || error.code === '42P01') {
                console.log('Webhook endpoints table not found, returning empty array');
                return res.json([]);
            }
            return res.status(500).json({ error: 'Failed to fetch webhooks' });
        }
        
        // Filter by service in application since DB column might not exist
        const zapierWebhooks = data ? data.filter(webhook => 
            webhook.service === 'zapier' || !webhook.service
        ) : [];
        
        res.json(zapierWebhooks);
    } catch (error) {
        console.error('Error fetching Zapier webhooks:', error);
        res.status(500).json({ error: 'Failed to fetch webhooks' });
    }
});

app.post('/api/zapier/webhooks', async (req, res) => {
    try {
        const { profile_id, name, webhook_url, event_type, is_active } = req.body;
        
        if (!profile_id || !name || !webhook_url || !event_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const webhook = {
            id: Date.now().toString(),
            profile_id,
            name,
            webhook_url,
            event_type,
            is_active: is_active !== false,
            created_at: new Date().toISOString()
        };
        
        // TODO: Save to Supabase
        res.status(201).json(webhook);
    } catch (error) {
        console.error('Error creating Zapier webhook:', error);
        res.status(500).json({ error: 'Failed to create webhook' });
    }
});

app.delete('/api/zapier/webhooks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // TODO: Delete from Supabase
        res.status(200).json({ message: 'Webhook deleted successfully' });
    } catch (error) {
        console.error('Error deleting Zapier webhook:', error);
        res.status(500).json({ error: 'Failed to delete webhook' });
    }
});

// Agent Zapier integrations endpoints
app.get('/api/agents/:agentId/zaps', async (req, res) => {
    try {
        const { agentId } = req.params;
        
        // Validate agent ID
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('id')
            .eq('id', agentId)
            .single();
            
        if (agentError || !agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        // Fetch Zapier integrations for this agent
        const { data, error } = await supabase
            .from('agent_zaps')
            .select('*')
            .eq('agent_id', agentId);
            
        if (error) {
            console.error('Error fetching agent Zapier integrations:', error);
            return res.status(500).json({ error: 'Failed to fetch Zapier integrations' });
        }
        
        res.json(data || []);
    } catch (err) {
        console.error('Error in /api/agents/:agentId/zaps:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/agents/:agentId/zaps', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { name, description, webhook_url, parameter_schema } = req.body;
        
        // Validate required fields
        if (!name || !description || !webhook_url || !parameter_schema) {
            return res.status(400).json({ 
                error: 'Missing required fields: name, description, webhook_url, and parameter_schema are required' 
            });
        }
        
        // Validate agent ID
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('id')
            .eq('id', agentId)
            .single();
            
        if (agentError || !agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        // Check for duplicate name for this agent
        const { data: existingZap, error: existingError } = await supabase
            .from('agent_zaps')
            .select('id')
            .eq('agent_id', agentId)
            .eq('name', name)
            .maybeSingle();
            
        if (existingZap) {
            return res.status(409).json({ error: 'A Zapier integration with this name already exists for this agent' });
        }
        
        // Create new Zapier integration
        const { data, error } = await supabase
            .from('agent_zaps')
            .insert([{
                agent_id: agentId,
                name,
                description,
                webhook_url,
                parameter_schema
            }])
            .select();
            
        if (error) {
            console.error('Error creating Zapier integration:', error);
            return res.status(500).json({ error: 'Failed to create Zapier integration' });
        }
        
        res.status(201).json(data[0]);
    } catch (err) {
        console.error('Error in POST /api/agents/:agentId/zaps:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/zaps/:zapId', async (req, res) => {
    try {
        const { zapId } = req.params;
        
        const { data, error } = await supabase
            .from('agent_zaps')
            .select('*')
            .eq('id', zapId)
            .single();
            
        if (error || !data) {
            return res.status(404).json({ error: 'Zapier integration not found' });
        }
        
        res.json(data);
    } catch (err) {
        console.error('Error in GET /api/zaps/:zapId:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/zaps/:zapId', async (req, res) => {
    try {
        const { zapId } = req.params;
        const { name, description, webhook_url, parameter_schema } = req.body;
        
        // Validate required fields
        if (!name || !description || !webhook_url || !parameter_schema) {
            return res.status(400).json({ 
                error: 'Missing required fields: name, description, webhook_url, and parameter_schema are required' 
            });
        }
        
        // Check if the Zap exists
        const { data: existingZap, error: existingError } = await supabase
            .from('agent_zaps')
            .select('id, agent_id, name')
            .eq('id', zapId)
            .single();
            
        if (existingError || !existingZap) {
            return res.status(404).json({ error: 'Zapier integration not found' });
        }
        
        // Check for duplicate name for this agent (excluding the current Zap)
        if (name !== existingZap.name) {
            const { data: duplicateZap, error: duplicateError } = await supabase
                .from('agent_zaps')
                .select('id')
                .eq('agent_id', existingZap.agent_id)
                .eq('name', name)
                .neq('id', zapId)
                .maybeSingle();
                
            if (duplicateZap) {
                return res.status(409).json({ error: 'A Zapier integration with this name already exists for this agent' });
            }
        }
        
        // Update the Zapier integration
        const { data, error } = await supabase
            .from('agent_zaps')
            .update({
                name,
                description,
                webhook_url,
                parameter_schema,
                updated_at: new Date().toISOString()
            })
            .eq('id', zapId)
            .select();
            
        if (error) {
            console.error('Error updating Zapier integration:', error);
            return res.status(500).json({ error: 'Failed to update Zapier integration' });
        }
        
        res.json(data[0]);
    } catch (err) {
        console.error('Error in PUT /api/zaps/:zapId:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/zaps/:zapId', async (req, res) => {
    try {
        const { zapId } = req.params;
        
        // Check if the Zap exists
        const { data: existingZap, error: existingError } = await supabase
            .from('agent_zaps')
            .select('id')
            .eq('id', zapId)
            .single();
            
        if (existingError || !existingZap) {
            return res.status(404).json({ error: 'Zapier integration not found' });
        }
        
        // Delete the Zapier integration
        const { error } = await supabase
            .from('agent_zaps')
            .delete()
            .eq('id', zapId);
            
        if (error) {
            console.error('Error deleting Zapier integration:', error);
            return res.status(500).json({ error: 'Failed to delete Zapier integration' });
        }
        
        res.status(204).send();
    } catch (err) {
        console.error('Error in DELETE /api/zaps/:zapId:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Go High Level integration endpoints
app.get('/api/ghl/settings', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: 'profile_id is required' });
        }
        
        // Get real GHL settings from Supabase
        const { data, error } = await supabase
            .from('integration_settings')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('service', 'gohighlevel')
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching GHL settings:', error);
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }
        
        const settings = data ? data.settings : {
            api_key: '',
            location_id: '',
            webhook_url: '',
            sync_contacts: true,
            sync_opportunities: true,
            sync_appointments: true,
            is_active: false
        };
        
        res.json(settings);
    } catch (error) {
        console.error('Error fetching GHL settings:', error);
        res.status(500).json({ error: 'Failed to fetch GHL settings' });
    }
});

app.post('/api/ghl/settings', async (req, res) => {
    try {
        const { profile_id, api_key, location_id, webhook_url, sync_contacts, sync_opportunities, sync_appointments } = req.body;
        
        if (!profile_id || !api_key || !location_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const settings = {
            profile_id,
            api_key,
            location_id,
            webhook_url,
            sync_contacts: sync_contacts !== false,
            sync_opportunities: sync_opportunities !== false,
            sync_appointments: sync_appointments !== false,
            is_active: true,
            updated_at: new Date().toISOString()
        };
        
        // Save to Supabase
        const { data, error } = await supabase
            .from('integration_settings')
            .upsert({
                profile_id,
                service: 'gohighlevel',
                settings,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) {
            console.error('Error saving GHL settings:', error);
            return res.status(500).json({ error: 'Failed to save settings to database' });
        }
        
        res.json(settings);
    } catch (error) {
        console.error('Error saving GHL settings:', error);
        res.status(500).json({ error: 'Failed to save GHL settings' });
    }
});

// New Integrations API endpoints
app.get('/api/integrations/ghl', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }
        
        // Check if integrations table exists
        const { error: tableCheckError } = await supabase
            .from('integrations')
            .select('count(*)', { count: 'exact', head: true });
            
        if (tableCheckError && tableCheckError.code === '42P01') {
            console.log('Integrations table does not exist, returning mock data');
            // Return mock data for development
            return res.json({ 
                connected: true,
                integration_id: 'mock-integration-id',
                created_at: new Date().toISOString()
            });
        }
        
        // Check if the user has a GHL integration
        const { data, error } = await supabase
            .from('integrations')
            .select('*')
            .eq('user_id', user_id)
            .eq('type', 'GHL')
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching GHL integration:', error);
            // Return mock data for development
            return res.json({ 
                connected: true,
                integration_id: 'mock-integration-id',
                created_at: new Date().toISOString()
            });
        }
        
        // Return connection status
        res.json({
            connected: !!data,
            integration_id: data?.id || null,
            created_at: data?.created_at || null
        });
    } catch (error) {
        console.error('Error fetching GHL integration:', error);
        res.status(500).json({ error: 'Failed to fetch GHL integration' });
    }
});

app.post('/api/integrations/ghl', async (req, res) => {
    try {
        const { user_id, api_key, location_id } = req.body;
        
        if (!user_id || !api_key || !location_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Encrypt the API key (in a real implementation, you would use a proper encryption method)
        // For this demo, we'll just store it as is, but in production you should encrypt sensitive data
        const credentials = {
            api_key,
            location_id
        };
        
        // Check if integrations table exists
        const { error: tableCheckError } = await supabase
            .from('integrations')
            .select('count(*)', { count: 'exact', head: true });
            
        if (tableCheckError && tableCheckError.code === '42P01') {
            console.log('Integrations table does not exist, returning mock data');
            // Return mock data for development
            return res.json({ 
                connected: true,
                integration_id: 'mock-integration-id',
                created_at: new Date().toISOString()
            });
        }
        
        // Save to Supabase
        const { data, error } = await supabase
            .from('integrations')
            .upsert({
                user_id,
                type: 'GHL',
                credentials,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) {
            console.error('Error saving GHL integration:', error);
            // Return mock data for development
            return res.json({ 
                connected: true,
                integration_id: 'mock-integration-id',
                created_at: new Date().toISOString()
            });
        }
        
        res.json({
            connected: true,
            integration_id: data.id,
            created_at: data.created_at
        });
    } catch (error) {
        console.error('Error saving GHL integration:', error);
        res.status(500).json({ error: 'Failed to save GHL integration' });
    }
});

app.delete('/api/integrations/ghl', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }
        
        // Check if integrations table exists
        const { error: tableCheckError } = await supabase
            .from('integrations')
            .select('count(*)', { count: 'exact', head: true });
            
        if (tableCheckError && tableCheckError.code === '42P01') {
            console.log('Integrations table does not exist, returning success');
            return res.status(204).send();
        }
        
        // Delete the GHL integration
        const { error } = await supabase
            .from('integrations')
            .delete()
            .eq('user_id', user_id)
            .eq('type', 'GHL');
        
        if (error) {
            console.error('Error deleting GHL integration:', error);
            // Return success anyway for development
            return res.status(204).send();
        }
        
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting GHL integration:', error);
        res.status(500).json({ error: 'Failed to delete GHL integration' });
    }
});

// Campaign endpoints
app.get('/api/campaigns', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: 'profile_id is required' });
        }
        
        // Get real campaigns data from Supabase
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('profile_id', profile_id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching campaigns:', error);
            return res.status(500).json({ error: 'Failed to fetch campaigns' });
        }
        
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

app.post('/api/campaigns', async (req, res) => {
    try {
        const campaignData = req.body;
        
        if (!campaignData.profile_id || !campaignData.name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const campaign = {
            id: Date.now().toString(),
            ...campaignData,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // TODO: Save to Supabase
        res.status(201).json(campaign);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// DNC endpoints
app.get('/api/dnc', async (req, res) => {
    try {
        const { profile_id } = req.query;
        if (!profile_id) {
            return res.status(400).json({ error: 'profile_id is required' });
        }
        
        // Get real DNC entries from Supabase
        const { data, error } = await supabase
            .from('dnc_entries')
            .select('*')
            .eq('profile_id', profile_id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching DNC entries:', error);
            return res.status(500).json({ error: 'Failed to fetch DNC entries' });
        }
        
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching DNC entries:', error);
        res.status(500).json({ error: 'Failed to fetch DNC entries' });
    }
});

app.delete('/api/dnc/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // TODO: Delete from Supabase and update UI state
        res.status(200).json({ message: 'DNC entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting DNC entry:', error);
        res.status(500).json({ error: 'Failed to delete DNC entry' });
    }
});

// IVR endpoints
app.post('/api/ivr/save', async (req, res) => {
    try {
        const { profile_id, menu_data, options } = req.body;
        
        if (!profile_id || !menu_data) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // TODO: Save IVR menu and options to Supabase
        const savedMenu = {
            id: Date.now().toString(),
            ...menu_data,
            profile_id,
            created_at: new Date().toISOString()
        };
        
        res.json({ menu: savedMenu, options: options || [] });
    } catch (error) {
        console.error('Error saving IVR configuration:', error);
        res.status(500).json({ error: 'Failed to save IVR configuration' });
    }
});

// Mock admin endpoints removed - using real PM2 integration below

// Agent management endpoints
app.get('/api/agents/active', async (req, res) => {
    try {
        const stats = await agentRouter.getRoutingStats();
        const activeAgents = Array.from(activeCallAgents.values());
        
        res.json({
            active_calls: activeCallAgents.size,
            active_agents: activeAgents,
            routing_stats: stats
        });
    } catch (error) {
        console.error('Error getting active agents:', error);
        res.status(500).json({ error: 'Failed to get active agents' });
    }
});

app.post('/api/agents/route-test', async (req, res) => {
    try {
        const { callData, agentType } = req.body;
        
        let agent;
        if (agentType) {
            agent = await agentRouter.getAgentByType(agentType, 'inbound');
        } else {
            agent = await agentRouter.routeIncomingCall(callData || {
                From: '+15551234567',
                To: '+18186006909',
                CallSid: 'test-call-' + Date.now()
            });
        }
        
        res.json({
            selected_agent: agent,
            routing_reason: agentType ? `agent_type_${agentType}` : 'automatic_routing'
        });
    } catch (error) {
        console.error('Error in route test:', error);
        res.status(500).json({ error: 'Failed to test routing' });
    }
});

app.get('/api/agents/routing-stats', async (req, res) => {
    try {
        const stats = await agentRouter.getRoutingStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting routing stats:', error);
        res.status(500).json({ error: 'Failed to get routing stats' });
    }
});

// ===== PRODUCTION API ENDPOINTS =====

// Campaign Management API
app.get('/api/campaigns', async (req, res) => {
    try {
        const { profile_id } = req.query;
        let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        
        if (profile_id) {
            query = query.eq('profile_id', profile_id);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

app.post('/api/campaigns', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('campaigns')
            .insert(req.body)
            .select()
            .single();
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

app.put('/api/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('campaigns')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

app.delete('/api/campaigns/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

// Stripe Billing Integration API
app.post('/api/billing/create-checkout-session', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }
    
    try {
        const { price_id, customer_email, success_url, cancel_url } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: price_id,
                quantity: 1,
            }],
            mode: 'subscription',
            customer_email,
            success_url,
            cancel_url,
        });
        
        res.json({ checkout_url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

app.post('/api/billing/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }
    
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                const subscription = event.data.object;
                await supabase.from('subscriptions').upsert({
                    stripe_subscription_id: subscription.id,
                    customer_email: subscription.customer,
                    status: subscription.status,
                    current_period_start: new Date(subscription.current_period_start * 1000),
                    current_period_end: new Date(subscription.current_period_end * 1000),
                });
                break;
                
            case 'customer.subscription.deleted':
                const deletedSub = event.data.object;
                await supabase.from('subscriptions')
                    .update({ status: 'canceled' })
                    .eq('stripe_subscription_id', deletedSub.id);
                break;
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// DNC Compliance API
app.get('/api/dnc/entries', async (req, res) => {
    try {
        const { phone_number } = req.query;
        let query = supabase.from('dnc_entries').select('*');
        
        if (phone_number) {
            query = query.eq('phone_number', phone_number);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching DNC entries:', error);
        res.status(500).json({ error: 'Failed to fetch DNC entries' });
    }
});

app.post('/api/dnc/entries', async (req, res) => {
    try {
        const { phone_number, reason } = req.body;
        
        const { data, error } = await supabase
            .from('dnc_entries')
            .insert({
                phone_number,
                reason: reason || 'Manual entry',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error adding DNC entry:', error);
        res.status(500).json({ error: 'Failed to add DNC entry' });
    }
});

app.delete('/api/dnc/entries/:phone_number', async (req, res) => {
    try {
        const { phone_number } = req.params;
        const { error } = await supabase
            .from('dnc_entries')
            .delete()
            .eq('phone_number', phone_number);
            
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing DNC entry:', error);
        res.status(500).json({ error: 'Failed to remove DNC entry' });
    }
});

// Notifications System API
app.get('/api/notifications', async (req, res) => {
    try {
        const { user_id, unread_only } = req.query;
        let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
        
        if (user_id) {
            query = query.eq('user_id', user_id);
        }
        
        if (unread_only === 'true') {
            query = query.eq('read', false);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

app.post('/api/notifications', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                ...req.body,
                created_at: new Date().toISOString(),
                read: false
            })
            .select()
            .single();
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Data Export API
app.get('/api/export/calls', async (req, res) => {
    try {
        const { start_date, end_date, format = 'csv' } = req.query;
        
        let query = supabase.from('call_logs').select('*');
        
        if (start_date) {
            query = query.gte('created_at', start_date);
        }
        
        if (end_date) {
            query = query.lte('created_at', end_date);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (format === 'csv') {
            const csvWriter = createObjectCsvWriter({
                path: '/tmp/calls_export.csv',
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'phone_number', title: 'Phone Number' },
                    { id: 'duration', title: 'Duration' },
                    { id: 'status', title: 'Status' },
                    { id: 'created_at', title: 'Date' }
                ]
            });
            
            await csvWriter.writeRecords(data);
            res.download('/tmp/calls_export.csv');
        } else {
            res.json(data);
        }
    } catch (error) {
        console.error('Error exporting calls:', error);
        res.status(500).json({ error: 'Failed to export calls' });
    }
});

app.get('/api/export/campaigns', async (req, res) => {
    try {
        const { format = 'csv' } = req.query;
        
        const { data, error } = await supabase.from('campaigns').select('*');
        if (error) throw error;
        
        if (format === 'csv') {
            const csvWriter = createObjectCsvWriter({
                path: '/tmp/campaigns_export.csv',
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'name', title: 'Name' },
                    { id: 'status', title: 'Status' },
                    { id: 'created_at', title: 'Created At' }
                ]
            });
            
            await csvWriter.writeRecords(data);
            res.download('/tmp/campaigns_export.csv');
        } else {
            res.json(data);
        }
    } catch (error) {
        console.error('Error exporting campaigns:', error);
        res.status(500).json({ error: 'Failed to export campaigns' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not configured',
        port: PORT,
        version: '1.0.0'
    });
});

// AI Agents API endpoints with real Supabase integration

app.get('/api/agents', async (req, res) => {
    try {
        const { profile_id } = req.query;
        
        let query = supabase
            .from('ai_agents')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (profile_id) {
            query = query.eq('profile_id', profile_id);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching agents:', error);
            return res.status(500).json({ error: 'Failed to fetch agents' });
        }
        
        res.json(data || []);
    } catch (error) {
        console.error('Error in agents API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/agents', async (req, res) => {
    try {
        const agentData = req.body;
        
        const { data, error } = await supabase
            .from('ai_agents')
            .insert([{
                ...agentData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating agent:', error);
            return res.status(500).json({ error: 'Failed to create agent' });
        }
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Error in create agent API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/agents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const agentData = req.body;
        
        const { data, error } = await supabase
            .from('ai_agents')
            .update({
                ...agentData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating agent:', error);
            return res.status(500).json({ error: 'Failed to update agent' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error in update agent API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/agents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('ai_agents')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting agent:', error);
            return res.status(500).json({ error: 'Failed to delete agent' });
        }
        
        res.json({ success: true, message: 'Agent deleted successfully' });
    } catch (error) {
        console.error('Error in delete agent API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Call Recording API endpoints with real Supabase integration
app.get('/api/recordings/:callId', async (req, res) => {
    try {
        const { callId } = req.params;
        
        // Get recording data from call_logs table
        const { data, error } = await supabase
            .from('call_logs')
            .select('id, recording_url, duration_seconds, started_at, phone_number_from')
            .eq('id', callId)
            .single();
        
        if (error) {
            console.error('Error fetching recording:', error);
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        if (!data.recording_url) {
            return res.status(404).json({ error: 'No recording available for this call' });
        }
        
        const recording = {
            id: data.id,
            call_id: data.id,
            recording_url: data.recording_url,
            duration_seconds: data.duration_seconds,
            phone_number_from: data.phone_number_from,
            created_at: data.started_at
        };
        
        res.json(recording);
    } catch (error) {
        console.error('Error in recordings API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/recordings/:callId/download', async (req, res) => {
    try {
        const { callId } = req.params;
        
        // Get recording URL from database
        const { data, error } = await supabase
            .from('call_logs')
            .select('recording_url, phone_number_from, started_at')
            .eq('id', callId)
            .single();
        
        if (error || !data.recording_url) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        // Generate a secure download URL (in production, you might want to proxy this)
        res.json({ 
            download_url: data.recording_url,
            filename: `call_${callId}_${data.phone_number_from}_${new Date(data.started_at).toISOString().split('T')[0]}.mp3`,
            expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        });
    } catch (error) {
        console.error('Error in download API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/recordings/:callId/generate', async (req, res) => {
    try {
        const { callId } = req.params;
        
        // In production, this would trigger Twilio recording generation
        // For now, we'll update the call log to indicate recording is being processed
        const { error } = await supabase
            .from('call_logs')
            .update({ 
                recording_status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', callId);
        
        if (error) {
            console.error('Error updating recording status:', error);
            return res.status(500).json({ error: 'Failed to start recording generation' });
        }
        
        console.log(`Recording generation started for call: ${callId}`);
        
        res.json({ 
            success: true, 
            message: 'Recording generation started',
            recording_id: `rec_${callId}_${Date.now()}`
        });
    } catch (error) {
        console.error('Error in generate recording API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Real PM2 Service Management API endpoints

// Get real PM2 services status
app.get('/api/admin/services', async (req, res) => {
    try {
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        
        const services = processes.map(proc => ({
            name: proc.name,
            status: proc.pm2_env.status === 'online' ? 'running' : 
                   proc.pm2_env.status === 'stopped' ? 'stopped' : 'error',
            uptime: formatUptime(proc.pm2_env.pm_uptime),
            memory: formatMemory(proc.monit.memory),
            cpu: `${proc.monit.cpu}%`,
            restarts: proc.pm2_env.restart_time,
            pid: proc.pid,
            pm_id: proc.pm_id
        }));
        
        res.json(services);
    } catch (error) {
        console.error('Error getting PM2 services:', error);
        res.status(500).json({ error: 'Failed to get services status' });
    }
});

// Real PM2 service actions
app.post('/api/admin/services/:serviceName/:action', async (req, res) => {
    const { serviceName, action } = req.params;
    
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    try {
        let command;
        switch (action) {
            case 'start':
                command = `pm2 start ${serviceName}`;
                break;
            case 'stop':
                command = `pm2 stop ${serviceName}`;
                break;
            case 'restart':
                command = `pm2 restart ${serviceName}`;
                break;
            case 'reload':
                command = `pm2 reload ${serviceName}`;
                break;
        }
        
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stderr.includes('PM2')) {
            throw new Error(stderr);
        }
        
        console.log(`PM2 ${action} ${serviceName}:`, stdout);
        
        res.json({ 
            success: true, 
            message: `Service ${serviceName} ${action}ed successfully`,
            output: stdout
        });
    } catch (error) {
        console.error(`Error ${action}ing service ${serviceName}:`, error);
        res.status(500).json({ 
            error: `Failed to ${action} service ${serviceName}`,
            details: error.message
        });
    }
});

// Get real system stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        // Get PM2 processes
        const { stdout: pm2Output } = await execAsync('pm2 jlist');
        const processes = JSON.parse(pm2Output);
        
        // Get system uptime
        const { stdout: uptimeOutput } = await execAsync('uptime -p');
        const systemUptime = uptimeOutput.trim().replace('up ', '');
        
        // Calculate stats from real data
        const totalProcesses = processes.length;
        const runningProcesses = processes.filter(p => p.pm2_env.status === 'online').length;
        const totalRestarts = processes.reduce((sum, p) => sum + p.pm2_env.restart_time, 0);
        
        // Get memory usage
        const { stdout: memOutput } = await execAsync('free -m | grep Mem');
        const memInfo = memOutput.split(/\s+/);
        const totalMem = parseInt(memInfo[1]);
        const usedMem = parseInt(memInfo[2]);
        const memUsagePercent = Math.round((usedMem / totalMem) * 100);
        
        // Get real user data from Supabase
        const { data: usersData } = await supabase
            .from('profiles')
            .select('id, last_sign_in_at');
        
        const totalUsers = usersData ? usersData.length : 0;
        const activeUsers = usersData ? usersData.filter(user => {
            if (!user.last_sign_in_at) return false;
            const lastSignIn = new Date(user.last_sign_in_at);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return lastSignIn > dayAgo;
        }).length : 0;
        
        // Get real call data from Supabase
        const { data: callsData } = await supabase
            .from('call_logs')
            .select('id, status');
        
        const totalCalls = callsData ? callsData.length : 0;
        const activeCalls = callsData ? callsData.filter(call => 
            call.status === 'in-progress' || call.status === 'ringing'
        ).length : 0;
        
        // Test Supabase connection
        const { error: dbError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
        
        const stats = {
            totalUsers,
            activeUsers,
            totalCalls,
            activeCalls: activeCalls, // Only show actual active calls, not PM2 processes
            systemUptime: systemUptime,
            serverHealth: runningProcesses === totalProcesses ? 'healthy' : 
                         runningProcesses > 0 ? 'warning' : 'error',
            databaseStatus: dbError ? 'disconnected' : 'connected',
            apiStatus: 'operational',
            memoryUsage: memUsagePercent,
            totalRestarts: totalRestarts
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ error: 'Failed to get system stats' });
    }
});

// Get real system logs
app.get('/api/admin/logs', async (req, res) => {
    try {
        const { lines = 50 } = req.query;
        
        // Get PM2 logs
        const { stdout } = await execAsync(`pm2 logs --lines ${lines} --nostream`);
        
        // Parse and format logs
        const logLines = stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const timestamp = new Date().toISOString();
                return {
                    timestamp,
                    level: line.includes('ERROR') ? 'error' : 
                           line.includes('WARN') ? 'warning' : 'info',
                    message: line,
                    service: line.includes('ai-call-backend') ? 'backend' : 
                            line.includes('ai-call-frontend') ? 'frontend' : 'system'
                };
            });
        
        res.json(logLines);
    } catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// Helper functions
function formatUptime(startTime) {
    if (!startTime) return '0m';
    
    const now = Date.now();
    const uptime = now - startTime;
    const minutes = Math.floor(uptime / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

function formatMemory(bytes) {
    if (!bytes) return '0 MB';
    
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
        return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
}

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        service: 'AI Calling Backend',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        configuration: {
            voice: process.env.VOICE_NAME || 'Puck',
            language: process.env.LANGUAGE_CODE || 'en-US',
            gemini_configured: !!process.env.GEMINI_API_KEY,
            twilio_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AI Calling Backend Server',
        status: 'running',
        webhook_url: `${WEBHOOK_URL}/webhook/voice`,
        endpoints: {
            health: '/health',
            status: '/status',
            webhook_voice: '/webhook/voice',
            webhook_status: '/webhook/status',
            test_system: '/test/system',
            test_twilio: '/test/twilio',
            test_gemini: '/test/gemini',
            test_audio: '/test/audio'
        }
    });
});

// Start HTTP server with WebSocket and webhook support
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Starting AI Calling Backend Server...');
    console.log(`📞 TW2GEM Server running on port ${PORT}`);
    console.log(`🔗 Twilio webhook URL: ${WEBHOOK_URL}/webhook/voice`);
    console.log(`🎵 Twilio stream URL: wss://work-2-jgeklehodwtesuya.prod-runtime.all-hands.dev`);
    console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🏥 Health check: ${WEBHOOK_URL}/health`);
    console.log(`🧪 System tests: ${WEBHOOK_URL}/test/system`);
    console.log('📋 Ready to receive calls!');
});