import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

// Test Gemini by sending a message and getting a response
app.post('/test', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                status: 'error',
                error: 'Message is required'
            });
        }
        
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
        
        const result = await model.generateContent(message);
        const response = result.response;
        const text = response.text();
        
        res.json({
            status: 'success',
            request: message,
            response: text
        });
    } catch (error) {
        console.error('❌ Gemini chat test failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 12003;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gemini test server running on port ${PORT}`);
});