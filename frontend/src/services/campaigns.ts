// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://work-2-xztkqihbepsagxrs.prod-runtime.all-hands.dev';

export interface Campaign {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  agent_id?: string
  profile_id: string
  description?: string
  start_time?: string
  end_time?: string
  max_concurrent_calls: number
  call_interval: number
  retry_attempts: number
  retry_interval: number
  created_at: string
  updated_at: string
}

export interface CampaignLead {
  id: string
  campaign_id: string
  phone_number: string
  first_name?: string
  last_name?: string
  email?: string
  custom_data?: any
  status: 'pending' | 'calling' | 'called' | 'completed' | 'failed' | 'dnc'
  call_attempts: number
  last_call_at?: string
  call_result?: string
  notes?: string
  created_at: string
  updated_at: string
}

export class CampaignService {
  
  // Get all campaigns
  static async getCampaigns(profileId: string, limit = 50, offset = 0): Promise<Campaign[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns?profile_id=${profileId}&limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }
  }

  // Get single campaign
  static async getCampaign(campaignId: string): Promise<Campaign | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch campaign');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      return null;
    }
  }

  // Create campaign
  static async createCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>): Promise<Campaign | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaign)
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating campaign:', error);
      return null;
    }
  }

  // Update campaign
  static async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating campaign:', error);
      return null;
    }
  }

  // Delete campaign
  static async deleteCampaign(campaignId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error deleting campaign:', error);
      return false;
    }
  }

  // Get campaign leads
  static async getCampaignLeads(campaignId: string, filters?: {
    status?: string[]
    limit?: number
    offset?: number
  }): Promise<CampaignLead[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) {
        params.append('status', filters.status.join(','));
      }
      if (filters?.limit) {
        params.append('limit', filters.limit.toString());
      }
      if (filters?.offset) {
        params.append('offset', filters.offset.toString());
      }

      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/leads?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch campaign leads');
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching campaign leads:', error);
      return [];
    }
  }

  // Add leads to campaign
  static async addLeadsToCampaign(campaignId: string, leads: Omit<CampaignLead, 'id' | 'campaign_id' | 'created_at' | 'updated_at'>[]): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads })
      });

      return response.ok;
    } catch (error) {
      console.error('Error adding leads to campaign:', error);
      return false;
    }
  }

  // Update campaign lead
  static async updateCampaignLead(campaignId: string, leadId: string, updates: Partial<CampaignLead>): Promise<CampaignLead | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign lead');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating campaign lead:', error);
      return null;
    }
  }

  // Start campaign
  static async startCampaign(campaignId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error starting campaign:', error);
      return false;
    }
  }

  // Pause campaign
  static async pauseCampaign(campaignId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error pausing campaign:', error);
      return false;
    }
  }

  // Stop campaign
  static async stopCampaign(campaignId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error stopping campaign:', error);
      return false;
    }
  }

  // Get campaign statistics
  static async getCampaignStats(campaignId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch campaign stats');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      return null;
    }
  }

  // Import leads from CSV
  static async importLeadsFromCSV(campaignId: string, csvFile: File): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/import-leads`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to import leads');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error importing leads:', error);
      return { success: false, imported: 0, errors: [error.message] };
    }
  }

  // Export campaign results
  static async exportCampaignResults(campaignId: string, format: 'csv' | 'json' = 'csv'): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/export?format=${format}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export campaign results');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `campaign-${campaignId}-results.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting campaign results:', error);
      throw error;
    }
  }
}