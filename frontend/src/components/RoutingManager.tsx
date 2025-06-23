import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/database';
import { useAuth } from '../hooks/useAuth';

interface PhoneNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  agent_id: string | null;
  is_primary: boolean;
  is_active: boolean;
}

interface Agent {
  id: string;
  name: string;
  agent_type: string;
  is_active: boolean;
  business_hours_start?: string;
  business_hours_end?: string;
  business_days?: number[];
}

interface IVRMenu {
  id: string;
  name: string;
  greeting_text: string;
  timeout_seconds: number;
  max_attempts: number;
  is_active: boolean;
  ivr_options: IVROption[];
}

interface IVROption {
  id?: string;
  ivr_menu_id?: string;
  digit: string;
  description: string;
  agent_id: string | null;
  action_type: string;
  action_data?: any;
}

const ROUTING_STRATEGIES = [
  { value: 'single_number_ivr', label: 'Single Number with IVR Menu' },
  { value: 'multiple_numbers', label: 'Multiple Dedicated Numbers' },
  { value: 'external_integration', label: 'External System Integration' },
  { value: 'time_based', label: 'Time-Based Routing' }
];

const ACTION_TYPES = [
  { value: 'agent', label: 'Connect to Agent' },
  { value: 'transfer', label: 'Transfer to External Number' },
  { value: 'voicemail', label: 'Send to Voicemail' }
];

const RoutingManager: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [routingStrategy, setRoutingStrategy] = useState('single_number_ivr');
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [ivrMenu, setIvrMenu] = useState<IVRMenu | null>(null);
  const [ivrOptions, setIvrOptions] = useState<IVROption[]>([]);
  const [showPhoneNumberForm, setShowPhoneNumberForm] = useState(false);
  const [editingPhoneNumber, setEditingPhoneNumber] = useState<PhoneNumber | null>(null);
  const [phoneNumberFormData, setPhoneNumberFormData] = useState({
    phone_number: '',
    friendly_name: '',
    agent_id: '',
    is_primary: false,
    is_active: true
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!user) {
        console.error('No user found');
        setLoading(false);
        return;
      }

      // Load profile to get routing strategy
      const profile = await DatabaseService.getProfile(user.id);
      if (profile) {
        setRoutingStrategy(profile.routing_strategy || 'single_number_ivr');
      }
      
      // Load phone numbers
      const phoneNumbersData = await DatabaseService.getPhoneNumbers(user.id);
      setPhoneNumbers(phoneNumbersData);
      
      // Load agents
      const agentsData = await DatabaseService.getAIAgents(user.id);
      setAgents(agentsData);
      
      // Load IVR menu
      const ivrData = await DatabaseService.getIVRMenu(user.id);
      if (ivrData) {
        setIvrMenu(ivrData);
        setIvrOptions(ivrData.ivr_options || []);
      } else {
        // Create default IVR options if none exist
        setIvrOptions([
          { digit: '1', description: 'Sales', agent_id: null, action_type: 'agent' },
          { digit: '2', description: 'Support', agent_id: null, action_type: 'agent' },
          { digit: '3', description: 'General Inquiries', agent_id: null, action_type: 'agent' }
        ]);
      }
    } catch (error) {
      console.error('Error loading routing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRoutingStrategy = async () => {
    try {
      if (!user) {
        console.error('No user found');
        return;
      }
      
      await DatabaseService.updateProfile(user.id, {
        routing_strategy: routingStrategy
      });
      
      alert('Routing strategy updated successfully!');
    } catch (error) {
      console.error('Error saving routing strategy:', error);
      alert('Error saving routing strategy');
    }
  };

  const handlePhoneNumberInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPhoneNumberFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneNumberCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPhoneNumberFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handlePhoneNumberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPhoneNumber) {
        // Update existing phone number
        await DatabaseService.updatePhoneNumber(editingPhoneNumber.id, phoneNumberFormData);
      } else {
        // Create new phone number
        if (!user) {
          console.error('No user found');
          return;
        }
        
        await DatabaseService.createPhoneNumber({
          ...phoneNumberFormData,
          profile_id: user.id
        });
      }
      
      // Reset form and reload data
      setPhoneNumberFormData({
        phone_number: '',
        friendly_name: '',
        agent_id: '',
        is_primary: false,
        is_active: true
      });
      setEditingPhoneNumber(null);
      setShowPhoneNumberForm(false);
      loadData();
    } catch (error) {
      console.error('Error saving phone number:', error);
      alert('Error saving phone number. Please try again.');
    }
  };

  const handleEditPhoneNumber = (phoneNumber: PhoneNumber) => {
    setEditingPhoneNumber(phoneNumber);
    setPhoneNumberFormData({
      phone_number: phoneNumber.phone_number,
      friendly_name: phoneNumber.friendly_name || '',
      agent_id: phoneNumber.agent_id || '',
      is_primary: phoneNumber.is_primary,
      is_active: phoneNumber.is_active
    });
    setShowPhoneNumberForm(true);
  };

  const handleDeletePhoneNumber = async (phoneNumberId: string) => {
    if (!confirm('Are you sure you want to delete this phone number?')) {
      return;
    }
    
    try {
      await DatabaseService.deletePhoneNumber(phoneNumberId);
      loadData();
    } catch (error) {
      console.error('Error deleting phone number:', error);
      alert('Error deleting phone number. Please try again.');
    }
  };

  const handleNewPhoneNumber = () => {
    setEditingPhoneNumber(null);
    setPhoneNumberFormData({
      phone_number: '',
      friendly_name: '',
      agent_id: '',
      is_primary: false,
      is_active: true
    });
    setShowPhoneNumberForm(true);
  };

  const handleCancelPhoneNumber = () => {
    setShowPhoneNumberForm(false);
    setEditingPhoneNumber(null);
  };

  const handleIVROptionChange = (index: number, field: string, value: any) => {
    const newOptions = [...ivrOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setIvrOptions(newOptions);
  };

  const handleAddIVROption = () => {
    const newDigit = (ivrOptions.length + 1).toString();
    setIvrOptions([...ivrOptions, {
      digit: newDigit,
      description: `Option ${newDigit}`,
      agent_id: null,
      action_type: 'agent'
    }]);
  };

  const handleRemoveIVROption = (index: number) => {
    const newOptions = ivrOptions.filter((_, i) => i !== index);
    setIvrOptions(newOptions);
  };

  const saveIVRConfig = async () => {
    try {
      // Save IVR menu
      let menuId = ivrMenu?.id;
      
      if (!menuId) {
        // Create new IVR menu
        if (!user) {
          console.error('No user found');
          return;
        }
        
        const newMenu = await DatabaseService.createIVRMenu({
          profile_id: user.id,
          name: 'Main Menu',
          greeting_text: ivrMenu?.greeting_text || 'Thank you for calling. Please select from the following options.',
          is_active: true
        });
        
        menuId = newMenu.id;
        setIvrMenu(newMenu);
      } else {
        // Update existing menu
        await DatabaseService.updateIVRMenu(menuId, {
          greeting_text: ivrMenu?.greeting_text || 'Thank you for calling. Please select from the following options.',
          is_active: true
        });
      }
      
      // Save IVR options
      for (const option of ivrOptions) {
        if (option.id) {
          // Update existing option
          await DatabaseService.updateIVROption(option.id, {
            digit: option.digit,
            description: option.description,
            agent_id: option.agent_id,
            action_type: option.action_type,
            action_data: option.action_data
          });
        } else {
          // Create new option
          await DatabaseService.createIVROption({
            ivr_menu_id: menuId,
            digit: option.digit,
            description: option.description,
            agent_id: option.agent_id,
            action_type: option.action_type,
            action_data: option.action_data
          });
        }
      }
      
      alert('IVR configuration saved successfully!');
      loadData();
    } catch (error) {
      console.error('Error saving IVR configuration:', error);
      alert('Error saving IVR configuration');
    }
  };

  const handleIVRGreetingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const greeting_text = e.target.value;
    setIvrMenu(prev => ({
      ...(prev || {
        id: '',
        name: 'Main Menu',
        greeting_text: '',
        timeout_seconds: 10,
        max_attempts: 3,
        is_active: true,
        ivr_options: []
      }),
      greeting_text
    }));
  };

  // Render different configuration forms based on routing strategy
  const renderConfigForm = () => {
    switch (routingStrategy) {
      case 'single_number_ivr':
        return renderIVRConfig();
      case 'multiple_numbers':
        return renderMultipleNumbersConfig();
      case 'external_integration':
        return renderExternalIntegrationConfig();
      case 'time_based':
        return renderTimeBasedConfig();
      default:
        return <p>Select a routing strategy to configure</p>;
    }
  };

  // Render IVR configuration form
  const renderIVRConfig = () => {
    return (
      <div className="mt-4 p-4 border rounded">
        <h3 className="text-lg font-semibold">IVR Menu Configuration</h3>
        
        {/* IVR menu form */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Greeting Message</label>
          <textarea 
            className="mt-1 block w-full border rounded p-2"
            value={ivrMenu?.greeting_text || 'Thank you for calling. Please select from the following options.'}
            onChange={handleIVRGreetingChange}
            rows={3}
          />
        </div>
        
        {/* IVR options */}
        <div className="mt-4">
          <h4 className="font-medium">Menu Options</h4>
          
          {ivrOptions.map((option, index) => (
            <div key={index} className="mt-2 p-2 border rounded flex items-center">
              <div className="w-12 text-center font-bold">{option.digit}</div>
              <div className="flex-1 px-2">
                <input
                  type="text"
                  value={option.description}
                  onChange={(e) => handleIVROptionChange(index, 'description', e.target.value)}
                  className="w-full border rounded p-1"
                />
              </div>
              <div className="w-32">
                <select 
                  className="w-full border rounded p-1"
                  value={option.action_type}
                  onChange={(e) => handleIVROptionChange(index, 'action_type', e.target.value)}
                >
                  {ACTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-48 ml-2">
                {option.action_type === 'agent' ? (
                  <select 
                    className="w-full border rounded p-1"
                    value={option.agent_id || ''}
                    onChange={(e) => handleIVROptionChange(index, 'agent_id', e.target.value || null)}
                  >
                    <option value="">Select Agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                ) : option.action_type === 'transfer' ? (
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={option.action_data?.phone_number || ''}
                    onChange={(e) => handleIVROptionChange(index, 'action_data', { phone_number: e.target.value })}
                    className="w-full border rounded p-1"
                  />
                ) : null}
              </div>
              <button 
                className="ml-2 p-1 text-red-600"
                onClick={() => handleRemoveIVROption(index)}
              >
                Remove
              </button>
            </div>
          ))}
          
          <button 
            className="mt-2 p-2 bg-blue-500 text-white rounded"
            onClick={handleAddIVROption}
          >
            Add Option
          </button>
        </div>
        
        <button 
          className="mt-4 p-2 bg-green-500 text-white rounded"
          onClick={saveIVRConfig}
        >
          Save IVR Configuration
        </button>
      </div>
    );
  };

  // Render multiple numbers configuration form
  const renderMultipleNumbersConfig = () => {
    return (
      <div className="mt-4 p-4 border rounded">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Multiple Phone Numbers Configuration</h3>
          <button
            onClick={handleNewPhoneNumber}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            Add Phone Number
          </button>
        </div>
        
        {showPhoneNumberForm ? (
          <div className="bg-gray-50 p-4 rounded mb-4">
            <h4 className="font-medium mb-2">
              {editingPhoneNumber ? 'Edit Phone Number' : 'Add New Phone Number'}
            </h4>
            <form onSubmit={handlePhoneNumberSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={phoneNumberFormData.phone_number}
                    onChange={handlePhoneNumberInputChange}
                    className="w-full border rounded p-2"
                    placeholder="+1234567890"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Friendly Name</label>
                  <input
                    type="text"
                    name="friendly_name"
                    value={phoneNumberFormData.friendly_name}
                    onChange={handlePhoneNumberInputChange}
                    className="w-full border rounded p-2"
                    placeholder="Sales Line"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned Agent</label>
                  <select
                    name="agent_id"
                    value={phoneNumberFormData.agent_id}
                    onChange={handlePhoneNumberInputChange}
                    className="w-full border rounded p-2"
                  >
                    <option value="">None (Use IVR)</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="is_primary"
                      checked={phoneNumberFormData.is_primary}
                      onChange={handlePhoneNumberCheckboxChange}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="ml-2">Primary Number</span>
                  </label>
                  
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={phoneNumberFormData.is_active}
                      onChange={handlePhoneNumberCheckboxChange}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="ml-2">Active</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end mt-4 space-x-2">
                <button
                  type="button"
                  onClick={handleCancelPhoneNumber}
                  className="px-3 py-1 border rounded text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  {editingPhoneNumber ? 'Update' : 'Add'} Phone Number
                </button>
              </div>
            </form>
          </div>
        ) : null}
        
        {/* Phone numbers list */}
        <div className="mt-4">
          {phoneNumbers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No phone numbers configured. Add your first phone number to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {phoneNumbers.map(phone => (
                    <tr key={phone.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {phone.is_primary && (
                            <span className="mr-2 flex-shrink-0 h-2 w-2 rounded-full bg-green-500" title="Primary Number"></span>
                          )}
                          {phone.phone_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {phone.friendly_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {phone.agent_id ? (
                          agents.find(a => a.id === phone.agent_id)?.name || 'Unknown Agent'
                        ) : (
                          <span className="text-gray-500">None (Use IVR)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          phone.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {phone.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditPhoneNumber(phone)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePhoneNumber(phone.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render external integration configuration form
  const renderExternalIntegrationConfig = () => {
    return (
      <div className="mt-4 p-4 border rounded">
        <h3 className="text-lg font-semibold">External Integration Configuration</h3>
        <p className="text-gray-500 mt-2">
          This feature allows you to integrate with existing phone systems. Please contact support for assistance with setting up external integrations.
        </p>
      </div>
    );
  };

  // Render time-based configuration form
  const renderTimeBasedConfig = () => {
    return (
      <div className="mt-4 p-4 border rounded">
        <h3 className="text-lg font-semibold">Time-Based Routing Configuration</h3>
        <p className="text-gray-500 mt-2">
          Configure different AI agents for business hours and after hours. This uses the business hours settings from each agent's configuration.
        </p>
        
        <div className="mt-4">
          <p className="font-medium">How it works:</p>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-gray-600">
            <li>Create at least two AI agents: one for business hours and one for after hours</li>
            <li>Set the agent type to "General" for business hours agent</li>
            <li>Set the agent type to "After Hours" for after hours agent</li>
            <li>Configure business hours and days in each agent's settings</li>
            <li>The system will automatically route calls to the appropriate agent based on the current time</li>
          </ol>
        </div>
        
        <div className="mt-6">
          <h4 className="font-medium">Current Agent Configuration:</h4>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents
                  .filter(agent => agent.agent_type === 'general' || agent.agent_type === 'after_hours')
                  .map(agent => {
                    // Agent data is already available in the agent object
                    return (
                      <tr key={agent.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{agent.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {agent.agent_type === 'after_hours' ? 'After Hours' : 'Business Hours'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {agent.business_hours_start || '9:00'} - {agent.business_hours_end || '17:00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(agent.business_days || [1, 2, 3, 4, 5])
                            .map((day: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day])
                            .join(', ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            agent.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {agent.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {agents.filter(agent => agent.agent_type === 'general' || agent.agent_type === 'after_hours').length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No business hours or after hours agents configured. Please create agents with these types.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Call Routing Configuration</h1>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Loading configuration...</p>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <label className="block text-sm font-medium">Routing Strategy</label>
            <select 
              className="mt-1 block w-full border rounded p-2"
              value={routingStrategy}
              onChange={(e) => setRoutingStrategy(e.target.value)}
            >
              {ROUTING_STRATEGIES.map(strategy => (
                <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
              ))}
            </select>
            
            <button 
              className="mt-2 p-2 bg-blue-500 text-white rounded"
              onClick={saveRoutingStrategy}
            >
              Save Strategy
            </button>
          </div>
          
          {renderConfigForm()}
        </>
      )}
    </div>
  );
};

export default RoutingManager;