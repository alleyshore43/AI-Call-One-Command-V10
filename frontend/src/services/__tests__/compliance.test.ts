import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceService } from '../compliance';

// Mock fetch globally
global.fetch = vi.fn();

describe('ComplianceService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getDNCList', () => {
    it('should fetch DNC list successfully', async () => {
      const mockDNCEntries = [
        {
          id: '1',
          profile_id: 'user-1',
          phone_number: '+1234567890',
          reason: 'customer_request',
          source: 'manual',
          added_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNCEntries
      });

      const result = await ComplianceService.getDNCList('user-1', 50, 0);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dnc/entries?profile_id=user-1&limit=50&offset=0'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockDNCEntries);
    });

    it('should handle fetch error gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await ComplianceService.getDNCList('user-1');

      expect(result).toEqual([]);
    });

    it('should handle network error gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await ComplianceService.getDNCList('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('addToDNC', () => {
    it('should add number to DNC list successfully', async () => {
      const dncEntry = {
        profile_id: 'user-1',
        phone_number: '+1234567890',
        reason: 'customer_request' as const,
        source: 'manual' as const,
        added_by: 'user-1'
      };

      const mockResponse = {
        ...dncEntry,
        id: '1',
        created_at: '2024-01-01T00:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ComplianceService.addToDNC(dncEntry);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dnc/entries'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dncEntry)
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle add error', async () => {
      const dncEntry = {
        profile_id: 'user-1',
        phone_number: '+1234567890',
        reason: 'customer_request' as const,
        source: 'manual' as const,
        added_by: 'user-1'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      const result = await ComplianceService.addToDNC(dncEntry);

      expect(result).toBeNull();
    });
  });

  describe('removeFromDNC', () => {
    it('should remove number from DNC list successfully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true
      });

      const result = await ComplianceService.removeFromDNC('user-1', '+1234567890');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dnc/entries'),
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: 'user-1',
            phone_number: '+1234567890'
          })
        })
      );
      expect(result).toBe(true);
    });

    it('should handle remove error', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await ComplianceService.removeFromDNC('user-1', '+1234567890');

      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await ComplianceService.removeFromDNC('user-1', '+1234567890');

      expect(result).toBe(false);
    });
  });

  describe('isWithinCallingHours', () => {
    it('should return true for valid calling hours', () => {
      // Mock current time to 10 AM
      const mockDate = new Date('2024-01-01T10:00:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = ComplianceService.isWithinCallingHours('America/New_York', {
        start: 8,
        end: 21
      });

      expect(result).toBe(true);
    });

    it('should return false for invalid calling hours', () => {
      // Mock current time to 6 AM
      const mockDate = new Date('2024-01-01T06:00:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = ComplianceService.isWithinCallingHours('America/New_York', {
        start: 8,
        end: 21
      });

      expect(result).toBe(false);
    });

    it('should handle timezone error gracefully', () => {
      const result = ComplianceService.isWithinCallingHours('Invalid/Timezone');

      expect(result).toBe(false);
    });
  });

  describe('validateCallCompliance', () => {
    it('should validate compliant call', async () => {
      // Mock all compliance checks to pass
      vi.spyOn(ComplianceService, 'isDNCListed').mockResolvedValue(false);
      vi.spyOn(ComplianceService, 'hasValidConsent').mockResolvedValue({
        hasConsent: true,
        consent: {
          id: '1',
          profile_id: 'user-1',
          phone_number: '+1234567890',
          consent_type: 'express_written',
          consent_date: '2024-01-01T00:00:00Z',
          consent_method: 'website_form',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      });
      vi.spyOn(ComplianceService, 'isWithinCallingHours').mockReturnValue(true);
      vi.spyOn(ComplianceService, 'checkFrequencyLimit').mockResolvedValue({
        withinLimit: true,
        callCount: 1
      });

      const result = await ComplianceService.validateCallCompliance(
        'user-1',
        '+1234567890',
        'America/New_York'
      );

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect DNC violation', async () => {
      vi.spyOn(ComplianceService, 'isDNCListed').mockResolvedValue(true);
      vi.spyOn(ComplianceService, 'hasValidConsent').mockResolvedValue({
        hasConsent: true
      });
      vi.spyOn(ComplianceService, 'isWithinCallingHours').mockReturnValue(true);
      vi.spyOn(ComplianceService, 'checkFrequencyLimit').mockResolvedValue({
        withinLimit: true,
        callCount: 1
      });

      const result = await ComplianceService.validateCallCompliance(
        'user-1',
        '+1234567890',
        'America/New_York'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Phone number is on Do Not Call list');
    });

    it('should detect consent violation', async () => {
      vi.spyOn(ComplianceService, 'isDNCListed').mockResolvedValue(false);
      vi.spyOn(ComplianceService, 'hasValidConsent').mockResolvedValue({
        hasConsent: false,
        reason: 'No consent record found'
      });
      vi.spyOn(ComplianceService, 'isWithinCallingHours').mockReturnValue(true);
      vi.spyOn(ComplianceService, 'checkFrequencyLimit').mockResolvedValue({
        withinLimit: true,
        callCount: 1
      });

      const result = await ComplianceService.validateCallCompliance(
        'user-1',
        '+1234567890',
        'America/New_York'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('TCPA consent required: No consent record found');
    });

    it('should detect calling hours violation', async () => {
      vi.spyOn(ComplianceService, 'isDNCListed').mockResolvedValue(false);
      vi.spyOn(ComplianceService, 'hasValidConsent').mockResolvedValue({
        hasConsent: true
      });
      vi.spyOn(ComplianceService, 'isWithinCallingHours').mockReturnValue(false);
      vi.spyOn(ComplianceService, 'checkFrequencyLimit').mockResolvedValue({
        withinLimit: true,
        callCount: 1
      });

      const result = await ComplianceService.validateCallCompliance(
        'user-1',
        '+1234567890',
        'America/New_York'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Outside allowed calling hours (8 AM - 9 PM local time)');
    });

    it('should detect frequency violation', async () => {
      vi.spyOn(ComplianceService, 'isDNCListed').mockResolvedValue(false);
      vi.spyOn(ComplianceService, 'hasValidConsent').mockResolvedValue({
        hasConsent: true
      });
      vi.spyOn(ComplianceService, 'isWithinCallingHours').mockReturnValue(true);
      vi.spyOn(ComplianceService, 'checkFrequencyLimit').mockResolvedValue({
        withinLimit: false,
        callCount: 5
      });

      const result = await ComplianceService.validateCallCompliance(
        'user-1',
        '+1234567890',
        'America/New_York'
      );

      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('Frequency limit exceeded (5 calls in last 24 hours)');
    });
  });
});