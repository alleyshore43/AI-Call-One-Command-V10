export class WebhookService {
  private static baseUrl = 'http://localhost:12001/api';

  // Send webhook notification for appointment events
  static async sendAppointmentWebhook(event: string, appointment: any, profileId: string) {
    try {
      // Get active webhook integrations for this user
      const integrations = await this.getActiveIntegrations(profileId);
      
      const webhookData = {
        event,
        data: appointment,
        timestamp: new Date().toISOString(),
        profile_id: profileId
      };

      // Send to each active integration
      for (const integration of integrations) {
        await this.sendWebhook(integration, webhookData);
      }
    } catch (error) {
      console.error('Error sending appointment webhook:', error);
    }
  }

  // Get active webhook integrations
  private static async getActiveIntegrations(profileId: string) {
    const integrations = [];

    try {
      // Check Zapier integration
      const zapierResponse = await fetch(`${this.baseUrl}/zapier/webhooks?profile_id=${profileId}`);
      const zapierWebhooks = await zapierResponse.json();
      
      for (const webhook of zapierWebhooks) {
        if (webhook.is_active && webhook.events?.includes('appointment.created')) {
          integrations.push({
            type: 'zapier',
            url: webhook.url,
            events: webhook.events
          });
        }
      }

      // Check Go High Level integration
      const ghlResponse = await fetch(`${this.baseUrl}/ghl/settings?profile_id=${profileId}`);
      const ghlSettings = await ghlResponse.json();
      
      if (ghlSettings.is_active && ghlSettings.sync_appointments) {
        integrations.push({
          type: 'ghl',
          url: ghlSettings.webhook_url,
          api_key: ghlSettings.api_key,
          location_id: ghlSettings.location_id
        });
      }

    } catch (error) {
      console.error('Error fetching integrations:', error);
    }

    return integrations;
  }

  // Send webhook to specific integration
  private static async sendWebhook(integration: any, data: any) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add integration-specific headers
      if (integration.type === 'ghl' && integration.api_key) {
        headers['Authorization'] = `Bearer ${integration.api_key}`;
      }

      const response = await fetch(integration.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...data,
          integration_type: integration.type,
          ...(integration.location_id && { location_id: integration.location_id })
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Webhook sent successfully to ${integration.type}`);
    } catch (error) {
      console.error(`❌ Failed to send webhook to ${integration.type}:`, error);
    }
  }

  // Send appointment created webhook
  static async appointmentCreated(appointment: any, profileId: string) {
    return this.sendAppointmentWebhook('appointment.created', appointment, profileId);
  }

  // Send appointment updated webhook
  static async appointmentUpdated(appointment: any, profileId: string) {
    return this.sendAppointmentWebhook('appointment.updated', appointment, profileId);
  }

  // Send appointment cancelled webhook
  static async appointmentCancelled(appointment: any, profileId: string) {
    return this.sendAppointmentWebhook('appointment.cancelled', appointment, profileId);
  }

  // Send appointment completed webhook
  static async appointmentCompleted(appointment: any, profileId: string) {
    return this.sendAppointmentWebhook('appointment.completed', appointment, profileId);
  }
}