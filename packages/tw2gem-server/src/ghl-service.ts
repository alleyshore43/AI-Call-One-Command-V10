/**
 * GoHighLevel API Service
 * Handles all interactions with the GoHighLevel API
 */

export class GhlService {
  private apiKey: string;
  private locationId: string;
  private baseUrl = 'https://services.leadconnectorhq.com';
  private apiVersion = '2021-07-28';

  constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
  }

  /**
   * Get headers for GHL API requests
   */
  private getHeaders() {
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
  async searchContactByPhone(phoneNumber: string) {
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
    } catch (error) {
      console.error('Error searching for contact by phone:', error);
      throw error;
    }
  }

  /**
   * Create a new contact in GoHighLevel
   * @param contactData The contact data to create
   * @returns The created contact data
   */
  async createContact(contactData: {
    name: string;
    phone: string;
    email?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  }) {
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
    } catch (error) {
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
  async addNoteToContact(contactId: string, note: string) {
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
    } catch (error) {
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
  async createOpportunity(contactId: string, opportunityData: {
    name: string;
    pipelineId: string;
    stageId: string;
    status?: 'open' | 'won' | 'lost';
    monetary?: {
      value: number;
      currency?: string;
    };
    assignedTo?: string;
    notes?: string;
  }) {
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
    } catch (error) {
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
  async createAppointment(contactId: string, appointmentData: {
    title: string;
    description?: string;
    startTime: string; // ISO date string
    endTime: string;   // ISO date string
    calendarId: string;
  }) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error('Error getting calendars:', error);
      throw error;
    }
  }
}