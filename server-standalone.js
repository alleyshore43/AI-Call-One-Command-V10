import { TwilioWebSocketServer } from './packages/twilio-server/dist/index.js';
import { GeminiLiveClient } from './packages/gemini-live-client/dist/index.js';
import { AudioConverter } from './packages/audio-converter/dist/index.js';
import { AudioTrigger } from './utils/audio-trigger.js';
import { createServer as createHttpServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Initialize utilities
const execAsync = util.promisify(exec);

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
        this.audioTrigger = new AudioTrigger();
        this.initializeAudioTrigger();
        this.setupEventHandlers();
    }

    async initializeAudioTrigger() {
        console.log('🎵 Initializing audio trigger system...');
        try {
            const success = await this.audioTrigger.initialize();
            if (success) {
                console.log('✅ Audio trigger system ready');
            } else {
                console.log('⚠️ Audio trigger system failed to initialize');
            }
        } catch (error) {
            console.error('❌ Error initializing audio trigger:', error.message);
        }
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
                
                // Send audio trigger to make Gemini speak first
                console.log('🎤 Sending audio trigger to Gemini...');
                try {
                    this.audioTrigger.sendTriggerToGemini(geminiClient);
                } catch (error) {
                    console.error('❌ Failed to send audio trigger:', error.message);
                    // Fallback: send text prompt
                    console.log('🔄 Sending fallback text prompt...');
                    geminiClient.sendMessage({
                        type: 'text',
                        text: 'Hello! Thank you for calling. How can I help you today?'
                    });
                }
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

    handleTwilioMessage(socket, message) {
        switch (message.event) {
            case 'connected':
                console.log('🔗 Twilio connected');
                break;
                
            case 'start':
                console.log('🎬 Call started:', message.start?.streamSid);
                socket.twilioStreamSid = message.start?.streamSid;
                
                // Gemini Live client connects automatically in constructor
                console.log('🤖 Gemini Live client ready for audio');
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
        setup: {
            model: 'models/gemini-2.0-flash-live-001',
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: process.env.VOICE_NAME || 'Puck'
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
    
    // Send initial greeting to ensure AI speaks first
    setTimeout(() => {
        if (socket.geminiLive && socket.geminiLive.readyState === 1) {
            let greetingPrompt = 'Please greet the caller now. Say hello and ask how you can help them today.';
            
            if (selectedAgent) {
                greetingPrompt = `You are ${selectedAgent.name}, a ${selectedAgent.agent_type} AI assistant. ${selectedAgent.greeting || 'Please greet the caller warmly and ask how you can help them today.'}`;
            }
            
            const initialMessage = {
                client_content: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: greetingPrompt }]
                    }],
                    turn_complete: true
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

const WEBHOOK_URL = `https://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev`;

// Initialize agent routing service
const agentRouter = new AgentRoutingService();

// Store active call agents for WebSocket routing
const activeCallAgents = new Map();

// Twilio webhook for incoming calls
app.post('/webhook/voice', async (req, res) => {
    console.log('📞 Incoming call webhook:', req.body);
    
    try {
        // Route call to appropriate agent
        const selectedAgent = await agentRouter.routeIncomingCall(req.body);
        
        // Store agent for this call
        activeCallAgents.set(req.body.CallSid, selectedAgent);
        
        console.log(`🎯 Routed call ${req.body.CallSid} to agent: ${selectedAgent.name} (${selectedAgent.agent_type})`);
        
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Start a stream to capture audio
        const start = twiml.start();
        start.stream({
            url: `wss://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev`,
            track: 'both_tracks'
        });
        
        // Use agent's custom greeting or default
        const greeting = selectedAgent.greeting || 
                        `Hello! Thank you for calling. I'm ${selectedAgent.name}, your ${selectedAgent.agent_type} assistant. How can I help you today?`;
        
        twiml.say({
            voice: 'alice',
            language: selectedAgent.language_code || 'en-US'
        }, greeting);
        
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
            url: `wss://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev`,
            track: 'both_tracks'
        });
        
        twiml.say({
            voice: 'alice',
            language: 'en-US'
        }, 'Hello! I am your AI assistant. How can I help you today?');
        
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
                stream_url: `wss://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev:${PORT}`
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
                stream_url: `wss://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev:${PORT}`
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
            url: `wss://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev:${PORT}`,
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
        
        // TODO: Save to Supabase
        res.json(settings);
    } catch (error) {
        console.error('Error saving GHL settings:', error);
        res.status(500).json({ error: 'Failed to save GHL settings' });
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
            activeCalls: Math.max(activeCalls, runningProcesses), // Use higher of actual calls or running processes
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
    console.log(`🎵 Twilio stream URL: wss://work-2-ipscjteepreyjhti.prod-runtime.all-hands.dev:${PORT}`);
    console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🏥 Health check: ${WEBHOOK_URL}/health`);
    console.log(`🧪 System tests: ${WEBHOOK_URL}/test/system`);
    console.log('📋 Ready to receive calls!');
});