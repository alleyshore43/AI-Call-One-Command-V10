import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../export';

// Mock fetch globally
global.fetch = vi.fn();

// Mock DOM methods
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
  }
});

describe('ExportService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock document methods
    const mockLink = {
      href: '',
      download: '',
      style: { visibility: '' },
      click: vi.fn(),
      setAttribute: vi.fn()
    };
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
  });

  describe('exportData', () => {
    it('should export calls data successfully', async () => {
      const mockBlob = new Blob(['mock csv data'], { type: 'text/csv' });
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="calls-export-2024-01-01.csv"')
        }
      });

      await ExportService.exportData('calls', 'csv', { date_from: '2024-01-01' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/export/calls?format=csv'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date_from: '2024-01-01' })
        })
      );

      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should export campaigns data successfully', async () => {
      const mockBlob = new Blob(['mock json data'], { type: 'application/json' });
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      });

      await ExportService.exportData('campaigns', 'json');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/export/campaigns?format=json'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
    });

    it('should handle export error', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(ExportService.exportData('calls')).rejects.toThrow('Failed to export calls');
    });

    it('should handle network error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(ExportService.exportData('calls')).rejects.toThrow('Network error');
    });

    it('should generate default filename when no content-disposition header', async () => {
      const mockBlob = new Blob(['mock data'], { type: 'text/csv' });
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: {
          get: vi.fn().mockReturnValue(null)
        }
      });

      await ExportService.exportData('calls', 'csv');

      const mockLink = document.createElement('a');
      expect(mockLink.download).toMatch(/calls-export-\d{4}-\d{2}-\d{2}\.csv/);
    });

    it('should extract filename from content-disposition header', async () => {
      const mockBlob = new Blob(['mock data'], { type: 'text/csv' });
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: {
          get: vi.fn().mockReturnValue('attachment; filename="custom-export.csv"')
        }
      });

      await ExportService.exportData('calls', 'csv');

      const mockLink = document.createElement('a');
      expect(mockLink.download).toBe('custom-export.csv');
    });
  });

  describe('exportCallsToCSV', () => {
    it('should export calls to CSV format', () => {
      const mockCalls = [
        {
          id: '1',
          started_at: '2024-01-01T10:00:00Z',
          direction: 'outbound',
          phone_number_from: '+1234567890',
          phone_number_to: '+0987654321',
          duration_seconds: 120,
          status: 'completed',
          outcome: 'successful',
          sentiment_score: 0.8,
          customer_satisfaction_score: 4,
          agent_id: 'agent-1',
          campaign_id: 'campaign-1',
          call_summary: 'Customer inquiry about product'
        }
      ] as any;

      ExportService.exportCallsToCSV(mockCalls, 'test-calls.csv');

      expect(document.createElement).toHaveBeenCalledWith('a');
      const mockLink = document.createElement('a');
      expect(mockLink.download).toBe('test-calls.csv');
    });

    it('should use default filename when not provided', () => {
      const mockCalls = [] as any;

      ExportService.exportCallsToCSV(mockCalls);

      const mockLink = document.createElement('a');
      expect(mockLink.download).toMatch(/calls-export-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('exportCampaignsToCSV', () => {
    it('should export campaigns to CSV format', () => {
      const mockCampaigns = [
        {
          id: '1',
          name: 'Test Campaign',
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          scheduled_start_date: '2024-01-01T09:00:00Z',
          scheduled_end_date: '2024-01-01T17:00:00Z',
          total_leads: 100,
          leads_called: 95,
          leads_answered: 80,
          leads_completed: 75,
          caller_id: '+1234567890',
          max_concurrent_calls: 5
        }
      ] as any;

      ExportService.exportCampaignsToCSV(mockCampaigns, 'test-campaigns.csv');

      expect(document.createElement).toHaveBeenCalledWith('a');
      const mockLink = document.createElement('a');
      expect(mockLink.download).toBe('test-campaigns.csv');
    });
  });

  describe('exportToJSON', () => {
    it('should export data to JSON format', async () => {
      const mockData = [
        { id: '1', name: 'Test Item' },
        { id: '2', name: 'Another Item' }
      ];

      await ExportService.exportToJSON(mockData, 'test-data.json');

      expect(document.createElement).toHaveBeenCalledWith('a');
      const mockLink = document.createElement('a');
      expect(mockLink.download).toBe('test-data.json');
    });

    it('should use default filename when not provided', async () => {
      const mockData = [];

      await ExportService.exportToJSON(mockData);

      const mockLink = document.createElement('a');
      expect(mockLink.download).toMatch(/export-\d{4}-\d{2}-\d{2}\.json/);
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate compliance report with violations', () => {
      const mockCalls = [
        {
          id: '1',
          direction: 'outbound',
          phone_number_to: '+1234567890',
          started_at: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          direction: 'inbound',
          phone_number_from: '+0987654321',
          started_at: '2024-01-01T11:00:00Z'
        }
      ] as any;

      const mockDNCEntries = [
        {
          phone_number: '+1234567890',
          is_active: true
        }
      ] as any;

      const report = ExportService.generateComplianceReport(mockCalls, mockDNCEntries);

      expect(report.summary.totalCalls).toBe(2);
      expect(report.summary.dncViolations).toBe(1);
      expect(report.summary.complianceRate).toBe(50);
      expect(report.violations).toHaveLength(1);
      expect(report.violations[0]).toMatchObject({
        callId: '1',
        phoneNumber: '+1234567890',
        violationType: 'DNC_VIOLATION'
      });
    });

    it('should generate report with no violations', () => {
      const mockCalls = [
        {
          id: '1',
          direction: 'outbound',
          phone_number_to: '+1111111111',
          started_at: '2024-01-01T10:00:00Z'
        }
      ] as any;

      const mockDNCEntries = [
        {
          phone_number: '+1234567890',
          is_active: true
        }
      ] as any;

      const report = ExportService.generateComplianceReport(mockCalls, mockDNCEntries);

      expect(report.summary.totalCalls).toBe(1);
      expect(report.summary.dncViolations).toBe(0);
      expect(report.summary.complianceRate).toBe(100);
      expect(report.violations).toHaveLength(0);
    });
  });
});