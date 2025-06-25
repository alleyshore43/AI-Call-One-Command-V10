import { BidiGenerateContentRealtimeInput, BidiGenerateContentServerContent, BidiGenerateContentServerMessage, BidiRequest, GeminiLiveClientOptions } from '@tw2gem/gemini-live-client/src/gemini-live.dto';
import { CloseEvent, ErrorEvent, MessageEvent, WebSocket } from 'ws';

export class GeminiLiveClient {

    private static readonly DEFAULT_GEMINI_BIDI_SERVER = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

    private socket: WebSocket;
    public isReady: boolean = false;

    public onReady?: () => void;
    public onError?: (event: ErrorEvent) => void;
    public onClose?: (event: CloseEvent) => void;
    public onServerContent?: (serverContent: BidiGenerateContentServerContent) => void;

    constructor(
        private options: GeminiLiveClientOptions
    ) {
        const server = options.server;
        const baseUrl = server?.url || GeminiLiveClient.DEFAULT_GEMINI_BIDI_SERVER;
        
        // Add API key to URL
        const url = new URL(baseUrl);
        url.searchParams.append('key', options.apiKey);
        
        // Add model to URL if provided
        if (options.model) {
            url.searchParams.append('model', options.model);
        }
        
        // Connect to Gemini Live
        this.socket = new WebSocket(url.toString());
        
        // Set up event handlers
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onerror = this.handleError.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
    }
    
    private handleOpen() {
        console.log('Connected to Gemini Live');
        
        // Send initial request
        const initialRequest: BidiRequest = {
            bidiRequest: {
                generateContentRequest: {
                    contents: [],
                    generationConfig: this.options.generationConfig,
                    safetySettings: this.options.safetySettings,
                    tools: this.options.tools,
                    toolConfig: this.options.toolConfig
                }
            }
        };
        
        this.socket.send(JSON.stringify(initialRequest));
    }
    
    private handleMessage(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data.toString()) as BidiGenerateContentServerMessage;
            
            if (data.bidiResponse?.generateContentResponse?.usageMetadata) {
                // This is the initial response, indicating the connection is ready
                this.isReady = true;
                if (this.onReady) {
                    this.onReady();
                }
            } else if (data.bidiResponse?.generateContentResponse?.candidates?.[0]?.content) {
                // This is a content response
                const content = data.bidiResponse.generateContentResponse.candidates[0].content;
                
                if (this.onServerContent) {
                    this.onServerContent({
                        type: content.parts?.[0]?.functionCall ? 'functionCall' : 'text',
                        text: content.parts?.[0]?.text || '',
                        functionCall: content.parts?.[0]?.functionCall,
                        modelTurn: content
                    });
                }
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    private handleError(event: ErrorEvent) {
        console.error('WebSocket error:', event);
        if (this.onError) {
            this.onError(event);
        }
    }
    
    private handleClose(event: CloseEvent) {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isReady = false;
        if (this.onClose) {
            this.onClose(event);
        }
    }
    
    public sendMessage(message: { type: 'text', text: string }) {
        if (!this.isReady) {
            console.warn('Cannot send message, connection not ready');
            return;
        }
        
        const request: BidiRequest = {
            bidiRequest: {
                generateContentRequest: {
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    text: message.text
                                }
                            ]
                        }
                    ]
                }
            }
        };
        
        this.socket.send(JSON.stringify(request));
    }
    
    public sendRealtimeInput(input: BidiGenerateContentRealtimeInput) {
        if (!this.isReady) {
            console.warn('Cannot send realtime input, connection not ready');
            return;
        }
        
        const request: BidiRequest = {
            bidiRequest: {
                generateContentRequest: {
                    realtimeInput: input
                }
            }
        };
        
        this.socket.send(JSON.stringify(request));
    }
    
    public close() {
        this.socket.close();
    }
}