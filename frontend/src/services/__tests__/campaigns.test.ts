import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignService } from '../campaigns';

// Mock fetch globally
global.fetch = vi.fn();

describe('CampaignService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getCampaigns', () => {
    it('should fetch campaigns successfully', async () => {
      const mockCampaigns = [
        {
          id: '1',
          name: 'Test Campaign',
          status: 'active',
          profile_id: 'user-1',
          max_concurrent_calls: 5,
          call_interval: 30,
          retry_attempts: 3,
          retry_interval: 300,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCampaigns
      });

      const result = await CampaignService.getCampaigns('user-1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns?profile_id=user-1&limit=50&offset=0'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockCampaigns);
    });

    it('should handle fetch error gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await CampaignService.getCampaigns('user-1');

      expect(result).toEqual([]);
    });

    it('should handle network error gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await CampaignService.getCampaigns('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('createCampaign', () => {
    it('should create campaign successfully', async () => {
      const newCampaign = {
        name: 'New Campaign',
        status: 'draft' as const,
        profile_id: 'user-1',
        max_concurrent_calls: 3,
        call_interval: 60,
        retry_attempts: 2,
        retry_interval: 600
      };

      const mockResponse = {
        ...newCampaign,
        id: '2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await CampaignService.createCampaign(newCampaign);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCampaign)
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle creation error', async () => {
      const newCampaign = {
        name: 'New Campaign',
        status: 'draft' as const,
        profile_id: 'user-1',
        max_concurrent_calls: 3,
        call_interval: 60,
        retry_attempts: 2,
        retry_interval: 600
      };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      const result = await CampaignService.createCampaign(newCampaign);

      expect(result).toBeNull();
    });
  });

  describe('updateCampaign', () => {
    it('should update campaign successfully', async () => {
      const updates = { status: 'paused' as const };
      const mockResponse = {
        id: '1',
        name: 'Test Campaign',
        status: 'paused',
        profile_id: 'user-1',
        max_concurrent_calls: 5,
        call_interval: 30,
        retry_attempts: 3,
        retry_interval: 300,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await CampaignService.updateCampaign('1', updates);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns/1'),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteCampaign', () => {
    it('should delete campaign successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await CampaignService.deleteCampaign('1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns/1'),
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toBe(true);
    });

    it('should handle deletion error', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await CampaignService.deleteCampaign('1');

      expect(result).toBe(false);
    });
  });

  describe('startCampaign', () => {
    it('should start campaign successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await CampaignService.startCampaign('1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns/1/start'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toBe(true);
    });
  });

  describe('getCampaignLeads', () => {
    it('should fetch campaign leads with filters', async () => {
      const mockLeads = [
        {
          id: '1',
          campaign_id: '1',
          phone_number: '+1234567890',
          first_name: 'John',
          last_name: 'Doe',
          status: 'pending',
          call_attempts: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeads
      });

      const result = await CampaignService.getCampaignLeads('1', {
        status: ['pending', 'retry'],
        limit: 100
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/campaigns/1/leads?status=pending%2Cretry&limit=100'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockLeads);
    });
  });
});