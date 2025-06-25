import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../notifications';

// Mock fetch globally
global.fetch = vi.fn();

describe('NotificationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getNotifications', () => {
    it('should fetch notifications successfully', async () => {
      const mockNotifications = [
        {
          id: '1',
          profile_id: 'user-1',
          title: 'Campaign Completed',
          message: 'Your campaign has finished running',
          type: 'success',
          is_read: false,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      });

      const result = await NotificationService.getNotifications('user-1', 25, 0);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications?profile_id=user-1&limit=25&offset=0'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockNotifications);
    });

    it('should handle fetch error gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(result).toEqual([]);
    });

    it('should handle network error gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await NotificationService.getNotifications('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const newNotification = {
        profile_id: 'user-1',
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info' as const,
        is_read: false
      };

      const mockResponse = {
        ...newNotification,
        id: '1',
        created_at: '2024-01-01T00:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await NotificationService.createNotification(newNotification);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNotification)
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle creation error', async () => {
      const newNotification = {
        profile_id: 'user-1',
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info' as const,
        is_read: false
      };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      const result = await NotificationService.createNotification(newNotification);

      expect(result).toBeNull();
    });

    it('should handle network error', async () => {
      const newNotification = {
        profile_id: 'user-1',
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info' as const,
        is_read: false
      };

      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await NotificationService.createNotification(newNotification);

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/notification-1'),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true })
        })
      );
      expect(result).toBe(true);
    });

    it('should handle mark as read error', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const emailNotification = {
        to: 'user@example.com',
        subject: 'Test Email',
        template: '<p>Test message</p>',
        data: { name: 'John' }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await NotificationService.sendEmail(emailNotification);

      expect(fetch).toHaveBeenCalledWith(
        '/api/send-email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining(emailNotification.to)
        })
      );
      expect(result).toBe(true);
    });

    it('should handle email send error', async () => {
      const emailNotification = {
        to: 'user@example.com',
        subject: 'Test Email',
        template: '<p>Test message</p>',
        data: { name: 'John' }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await NotificationService.sendEmail(emailNotification);

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      const emailNotification = {
        to: 'user@example.com',
        subject: 'Test Email',
        template: '<p>Test message</p>',
        data: { name: 'John' }
      };

      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await NotificationService.sendEmail(emailNotification);

      expect(result).toBe(false);
    });
  });

  describe('sendWebhook', () => {
    it('should send webhook successfully', async () => {
      const webhookPayload = {
        event: 'campaign.completed',
        data: { campaign_id: '1' },
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user-1'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await NotificationService.sendWebhook(
        'https://example.com/webhook',
        webhookPayload,
        'secret-key'
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'AI-Call-Center-Webhook/1.0',
            'X-Webhook-Signature': expect.any(String)
          }),
          body: JSON.stringify(webhookPayload)
        })
      );
      expect(result).toBe(true);
    });

    it('should send webhook without signature when no secret provided', async () => {
      const webhookPayload = {
        event: 'campaign.completed',
        data: { campaign_id: '1' },
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user-1'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await NotificationService.sendWebhook(
        'https://example.com/webhook',
        webhookPayload
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({
            'X-Webhook-Signature': expect.any(String)
          })
        })
      );
      expect(result).toBe(true);
    });

    it('should handle webhook send error', async () => {
      const webhookPayload = {
        event: 'campaign.completed',
        data: { campaign_id: '1' },
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user-1'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await NotificationService.sendWebhook(
        'https://example.com/webhook',
        webhookPayload
      );

      expect(result).toBe(false);
    });
  });

  describe('getZapierTemplateConfig', () => {
    it('should return Slack template config', () => {
      const config = NotificationService.getZapierTemplateConfig('slack-notifications');

      expect(config).toMatchObject({
        name: 'Slack Notifications',
        description: 'Send call and campaign updates to Slack',
        events: ['call.completed', 'campaign.completed'],
        zapierUrl: expect.stringContaining('slack'),
        samplePayload: expect.objectContaining({
          event: 'call.completed'
        })
      });
    });

    it('should return Google Calendar template config', () => {
      const config = NotificationService.getZapierTemplateConfig('google-calendar');

      expect(config).toMatchObject({
        name: 'Google Calendar Integration',
        description: 'Add appointments to Google Calendar',
        events: ['appointment.scheduled'],
        zapierUrl: expect.stringContaining('google-calendar'),
        samplePayload: expect.objectContaining({
          event: 'appointment.scheduled'
        })
      });
    });

    it('should return CRM template config', () => {
      const config = NotificationService.getZapierTemplateConfig('crm-updates');

      expect(config).toMatchObject({
        name: 'CRM Updates',
        description: 'Update leads in your CRM system',
        events: ['call.completed', 'lead.updated'],
        zapierUrl: expect.stringContaining('salesforce'),
        samplePayload: expect.objectContaining({
          event: 'lead.updated'
        })
      });
    });

    it('should return undefined for non-existent template', () => {
      const config = NotificationService.getZapierTemplateConfig('non-existent');

      expect(config).toBeUndefined();
    });
  });
});