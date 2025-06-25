#!/bin/bash

# Create the dist directory if it doesn't exist
mkdir -p /workspace/AI-Call-One-Command-V8/packages/tw2gem-server/dist

# Compile the GHL service file
echo "Compiling GHL service..."
npx tsc --allowJs --outDir /workspace/AI-Call-One-Command-V8/packages/tw2gem-server/dist /workspace/AI-Call-One-Command-V8/packages/tw2gem-server/src/ghl-service.ts

# Check if compilation was successful
if [ $? -eq 0 ]; then
  echo "Compilation successful"
else
  echo "Compilation failed, creating a JavaScript version directly"
  
  # Create a JavaScript version directly
  cat > /workspace/AI-Call-One-Command-V8/packages/tw2gem-server/dist/ghl-service.js << 'EOL'
/**
 * GoHighLevel API Service
 * Handles all interactions with the GoHighLevel API
 */
export class GhlService {
    constructor(apiKey, locationId) {
        this.baseUrl = 'https://services.leadconnectorhq.com';
        this.apiVersion = '2021-07-28';
        this.apiKey = apiKey;
        this.locationId = locationId;
    }
    /**
     * Get headers for GHL API requests
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Version': this.apiVersion,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    /**
     * Search for a contact by phone number
     * @param phoneNumber The phone number to search for
     * @returns The contact data if found, null otherwise
     */
    async searchContactByPhone(phoneNumber) {
        try {
            // Format phone number (remove any non-digit characters)
            const formattedPhone = phoneNumber.replace(/\D/g, '');
            // Search for the contact
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/contacts/lookup?phone=${formattedPhone}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // Contact not found
                }
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return data.contacts && data.contacts.length > 0 ? data.contacts[0] : null;
        }
        catch (error) {
            console.error('Error searching for contact by phone:', error);
            throw error;
        }
    }
    /**
     * Create a new contact in GoHighLevel
     * @param contactData The contact data to create
     * @returns The created contact data
     */
    async createContact(contactData) {
        try {
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/contacts`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(contactData)
            });
            if (!response.ok) {
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error creating contact:', error);
            throw error;
        }
    }
    /**
     * Add a note to a contact
     * @param contactId The ID of the contact
     * @param note The note content
     * @returns The created note data
     */
    async addNoteToContact(contactId, note) {
        try {
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/contacts/${contactId}/notes`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    body: note
                })
            });
            if (!response.ok) {
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error adding note to contact:', error);
            throw error;
        }
    }
    /**
     * Create an opportunity for a contact
     * @param contactId The ID of the contact
     * @param opportunityData The opportunity data
     * @returns The created opportunity data
     */
    async createOpportunity(contactId, opportunityData) {
        try {
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/opportunities`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    contactId,
                    ...opportunityData
                })
            });
            if (!response.ok) {
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error creating opportunity:', error);
            throw error;
        }
    }
    /**
     * Create an appointment for a contact
     * @param contactId The ID of the contact
     * @param appointmentData The appointment data
     * @returns The created appointment data
     */
    async createAppointment(contactId, appointmentData) {
        try {
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/appointments`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    contactId,
                    ...appointmentData
                })
            });
            if (!response.ok) {
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error creating appointment:', error);
            throw error;
        }
    }
    /**
     * Get pipelines from GoHighLevel
     * @returns List of pipelines
     */
    async getPipelines() {
        try {
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/pipelines`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            if (!response.ok) {
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error getting pipelines:', error);
            throw error;
        }
    }
    /**
     * Get calendars from GoHighLevel
     * @returns List of calendars
     */
    async getCalendars() {
        try {
            const response = await fetch(`${this.baseUrl}/locations/${this.locationId}/calendars`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            if (!response.ok) {
                throw new Error(`GHL API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error getting calendars:', error);
            throw error;
        }
    }
}
EOL

  echo "JavaScript version created directly"
fi

# Fix the import in function-handler.js
echo "Fixing imports in function-handler.js..."
sed -i 's/const { GhlService } = require(.*/try { const { GhlService } = await import("\.\/ghl-service.js"); this.ghlService = new GhlService(apiKey, locationId); } catch (e) { console.error("Error importing GhlService:", e); }/' /workspace/AI-Call-One-Command-V8/packages/tw2gem-server/dist/function-handler.js

echo "Build completed"