import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface GHLSettings {
  api_key: string;
  location_id: string;
  webhook_url: string;
  sync_contacts: boolean;
  sync_opportunities: boolean;
  sync_appointments: boolean;
  is_active: boolean;
}

interface GHLConnectionStatus {
  connected: boolean;
  integration_id: string | null;
  created_at: string | null;
}

export default function GoHighLevelIntegration() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GHLSettings>({
    api_key: '',
    location_id: '',
    webhook_url: '',
    sync_contacts: true,
    sync_opportunities: true,
    sync_appointments: true,
    is_active: false
  });
  const [connectionStatus, setConnectionStatus] = useState<GHLConnectionStatus>({
    connected: false,
    integration_id: null,
    created_at: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
      checkConnectionStatus();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ghl/settings?profile_id=${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading GHL settings:', error);
      toast.error('Failed to load Go High Level settings');
    } finally {
      setLoading(false);
    }
  };
  
  const checkConnectionStatus = async () => {
    try {
      const response = await fetch(`/api/integrations/ghl?user_id=${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
        
        // If connected, update the is_active flag
        if (data.connected) {
          setSettings(prev => ({
            ...prev,
            is_active: true
          }));
        }
      }
    } catch (error) {
      console.error('Error checking GHL connection status:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // First save the settings
      const settingsResponse = await fetch('/api/ghl/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...settings,
          profile_id: user?.id
        })
      });

      if (!settingsResponse.ok) {
        throw new Error('Failed to save settings');
      }
      
      // Then save the integration
      const integrationResponse = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          api_key: settings.api_key,
          location_id: settings.location_id
        })
      });
      
      if (!integrationResponse.ok) {
        throw new Error('Failed to save integration');
      }
      
      const connectionData = await integrationResponse.json();
      setConnectionStatus(connectionData);
      
      // Update settings with active status
      setSettings(prev => ({
        ...prev,
        is_active: true
      }));
      
      toast.success('Go High Level integration connected successfully');
    } catch (error) {
      console.error('Error saving GHL integration:', error);
      toast.error('Failed to save Go High Level integration');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!settings.api_key || !settings.location_id) {
      toast.error('Please enter API key and Location ID first');
      return;
    }

    try {
      setTesting(true);
      // Test the GHL API connection
      const response = await fetch('https://services.leadconnectorhq.com/locations/', {
        headers: {
          'Authorization': `Bearer ${settings.api_key}`,
          'Version': '2021-07-28'
        }
      });

      if (response.ok) {
        toast.success('✅ Connection to Go High Level successful!');
      } else {
        toast.error('❌ Failed to connect to Go High Level. Check your credentials.');
      }
    } catch (error) {
      console.error('Error testing GHL connection:', error);
      toast.error('❌ Error testing connection to Go High Level');
    } finally {
      setTesting(false);
    }
  };
  
  const handleDisconnect = async () => {
    if (!connectionStatus.connected) {
      return;
    }
    
    try {
      setDisconnecting(true);
      const response = await fetch(`/api/integrations/ghl?user_id=${user?.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setConnectionStatus({
          connected: false,
          integration_id: null,
          created_at: null
        });
        
        setSettings(prev => ({
          ...prev,
          is_active: false
        }));
        
        toast.success('Go High Level integration disconnected successfully');
      } else {
        throw new Error('Failed to disconnect integration');
      }
    } catch (error) {
      console.error('Error disconnecting GHL integration:', error);
      toast.error('Failed to disconnect Go High Level integration');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Go High Level Integration</h2>
          <p className="text-gray-600">Connect your AI Call Center to Go High Level CRM</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm ${
          settings.is_active 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {settings.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">🔗 How to Set Up Go High Level Integration</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li>Log into your Go High Level account</li>
          <li>Go to Settings → Integrations → API Keys</li>
          <li>Create a new API key with the following permissions:
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>contacts.readonly, contacts.write</li>
              <li>opportunities.readonly, opportunities.write</li>
              <li>calendars.readonly, calendars.write</li>
              <li>locations.readonly</li>
            </ul>
          </li>
          <li>Copy your API key and Location ID</li>
          <li>Paste them below and test the connection</li>
        </ol>
      </div>

      {/* Configuration Form */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key *</label>
            <input
              type="password"
              name="api_key"
              value={settings.api_key}
              onChange={handleInputChange}
              placeholder="Enter your Go High Level API key"
              className="w-full border rounded p-2"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              Get this from Settings → Integrations → API Keys in your GHL account
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location ID *</label>
            <input
              type="text"
              name="location_id"
              value={settings.location_id}
              onChange={handleInputChange}
              placeholder="Enter your Location ID"
              className="w-full border rounded p-2"
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              Found in your GHL account settings or URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Integration URL (Optional)</label>
            <input
              type="url"
              name="webhook_url"
              value={settings.webhook_url}
              onChange={handleInputChange}
              placeholder="https://your-ghl-webhook-url.com"
              className="w-full border rounded p-2"
            />
            <p className="text-xs text-gray-600 mt-1">
              URL to receive updates from Go High Level
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={testConnection}
              disabled={testing || !settings.api_key || !settings.location_id}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Sync Settings</h3>
        
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="sync_contacts"
              checked={settings.sync_contacts}
              onChange={handleInputChange}
              className="mr-3"
            />
            <div>
              <label className="font-medium">Sync Contacts</label>
              <p className="text-sm text-gray-600">
                Automatically create/update contacts in GHL when calls are made
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="sync_opportunities"
              checked={settings.sync_opportunities}
              onChange={handleInputChange}
              className="mr-3"
            />
            <div>
              <label className="font-medium">Sync Opportunities</label>
              <p className="text-sm text-gray-600">
                Create opportunities in GHL based on call outcomes
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="sync_appointments"
              checked={settings.sync_appointments}
              onChange={handleInputChange}
              className="mr-3"
            />
            <div>
              <label className="font-medium">Sync Appointments</label>
              <p className="text-sm text-gray-600">
                Sync scheduled appointments between systems
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Flow */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">📊 Data Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-green-700">From AI Call Center → GHL</h4>
            <ul className="list-disc list-inside text-gray-600 mt-1">
              <li>Call logs and recordings</li>
              <li>Contact information</li>
              <li>Appointment bookings</li>
              <li>Lead status updates</li>
              <li>Call outcomes and notes</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-700">From GHL → AI Call Center</h4>
            <ul className="list-disc list-inside text-gray-600 mt-1">
              <li>Contact updates</li>
              <li>Opportunity changes</li>
              <li>Appointment modifications</li>
              <li>Custom field data</li>
              <li>Pipeline status</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus.connected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <h3 className="font-semibold text-green-800">Connected to Go High Level</h3>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Connected since {new Date(connectionStatus.created_at || '').toLocaleString()}
          </p>
          <div className="mt-3">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-red-600 border border-red-300 px-3 py-1 rounded text-sm hover:bg-red-50 disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect Integration'}
            </button>
          </div>
        </div>
      )}
      
      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || connectionStatus.connected}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : connectionStatus.connected ? 'Already Connected' : 'Connect to Go High Level'}
        </button>
      </div>

      {/* Sample Webhook Payload */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">📋 Sample Webhook Payload</h3>
        <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`{
  "event_type": "call_completed",
  "timestamp": "2025-06-23T12:00:00Z",
  "contact": {
    "phone": "+1234567890",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "call": {
    "duration": 180,
    "outcome": "appointment_scheduled",
    "summary": "Customer interested in premium service",
    "recording_url": "https://...",
    "sentiment": "positive"
  },
  "appointment": {
    "date": "2025-06-25",
    "time": "14:00",
    "service": "Consultation"
  }
}`}
        </pre>
      </div>
    </div>
  );
}