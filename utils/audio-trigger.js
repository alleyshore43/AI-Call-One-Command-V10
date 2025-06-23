// Audio Trigger Utility for Gemini Live API
// Converts MP3 to PCM format and sends to Gemini to trigger greeting

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AudioTrigger {
    constructor() {
        this.triggerAudioPath = path.join(process.cwd(), 'assets', 'trigger-audio.pcm');
        this.sourcePcmPath = '/workspace/Record (online-voice-recorder.com).pcm';
    }

    // Copy PCM file to assets directory
    async copyPcmFile() {
        try {
            // Ensure assets directory exists
            const assetsDir = path.join(process.cwd(), 'assets');
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // Check if source PCM exists
            if (!fs.existsSync(this.sourcePcmPath)) {
                console.error('❌ Source PCM file not found:', this.sourcePcmPath);
                return false;
            }

            console.log('🔄 Copying PCM file for Gemini trigger...');
            
            // Copy the PCM file
            fs.copyFileSync(this.sourcePcmPath, this.triggerAudioPath);
            
            if (fs.existsSync(this.triggerAudioPath)) {
                console.log('✅ Audio trigger file copied:', this.triggerAudioPath);
                return true;
            } else {
                console.error('❌ Failed to copy PCM file');
                return false;
            }
        } catch (error) {
            console.error('❌ Error copying PCM file:', error.message);
            return false;
        }
    }

    // Get PCM audio data as base64 for Gemini Live API
    getTriggerAudioData() {
        try {
            if (!fs.existsSync(this.triggerAudioPath)) {
                console.error('❌ PCM trigger file not found. Run convertMp3ToPcm() first.');
                return null;
            }

            const audioBuffer = fs.readFileSync(this.triggerAudioPath);
            const base64Audio = audioBuffer.toString('base64');
            
            console.log('📤 Trigger audio data prepared:', {
                size: audioBuffer.length,
                base64Length: base64Audio.length
            });
            
            return base64Audio;
        } catch (error) {
            console.error('❌ Error reading trigger audio data:', error.message);
            return null;
        }
    }

    // Send trigger audio to Gemini Live client
    async sendTriggerToGemini(geminiClient) {
        try {
            const audioData = this.getTriggerAudioData();
            if (!audioData) {
                console.error('❌ No trigger audio data available');
                return false;
            }

            // Send audio data to Gemini Live API
            const realtimeInput = {
                mediaChunks: [{
                    mimeType: 'audio/pcm',
                    data: audioData
                }]
            };

            console.log('🎤 Sending trigger audio to Gemini...');
            geminiClient.sendRealtimeInput(realtimeInput);
            
            console.log('✅ Trigger audio sent successfully');
            return true;
        } catch (error) {
            console.error('❌ Error sending trigger audio to Gemini:', error.message);
            return false;
        }
    }

    // Initialize audio trigger system
    async initialize() {
        console.log('🎵 Initializing audio trigger system...');
        
        // Copy PCM file if not already done
        if (!fs.existsSync(this.triggerAudioPath)) {
            const copied = await this.copyPcmFile();
            if (!copied) {
                console.log('⚠️ PCM copy failed, creating fallback trigger...');
                const fallbackCreated = this.createFallbackTrigger();
                if (!fallbackCreated) {
                    console.error('❌ Failed to initialize audio trigger system');
                    return false;
                }
            }
        }
        
        console.log('✅ Audio trigger system ready');
        return true;
    }

    // Create a simple "hi" audio trigger if conversion fails
    createFallbackTrigger() {
        try {
            console.log('🔄 Creating fallback audio trigger...');
            
            // Generate a simple sine wave "beep" as PCM data
            const sampleRate = 16000;
            const duration = 0.1; // 100ms
            const frequency = 440; // A4 note
            const samples = Math.floor(sampleRate * duration);
            
            const buffer = Buffer.alloc(samples * 2); // 16-bit = 2 bytes per sample
            
            for (let i = 0; i < samples; i++) {
                const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1; // Low volume
                const intSample = Math.floor(sample * 32767); // Convert to 16-bit integer
                buffer.writeInt16LE(intSample, i * 2);
            }
            
            fs.writeFileSync(this.triggerAudioPath, buffer);
            console.log('✅ Fallback audio trigger created');
            return true;
        } catch (error) {
            console.error('❌ Error creating fallback trigger:', error.message);
            return false;
        }
    }
}

// Export singleton instance
export const audioTrigger = new AudioTrigger();