import { DatabaseService } from './database';
import { supabase } from '../lib/supabase';
import type { 
  PhoneNumber, 
  IVRMenu, 
  IVROption, 
  ExternalIntegration 
} from '../lib/supabase';

// These methods will be added directly to the DatabaseService class

// Define the extension methods
class ExtendedDatabaseService {
  // Phone Numbers operations
  static async getPhoneNumbers(profileId: string): Promise<PhoneNumber[]> {
    if (DatabaseService.isDemoMode()) {
      return this.getDemoPhoneNumbers();
    }

    const { data, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('profile_id', profileId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching phone numbers:', error);
      return [];
    }

    return data || [];
  }

  static async createPhoneNumber(phoneNumber: Omit<PhoneNumber, 'id' | 'created_at' | 'updated_at'>): Promise<PhoneNumber | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: Phone number creation simulated');
      return {
        ...phoneNumber,
        id: 'demo-phone-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as PhoneNumber;
    }

    const { data, error } = await supabase
      .from('phone_numbers')
      .insert(phoneNumber)
      .select()
      .single();

    if (error) {
      console.error('Error creating phone number:', error);
      throw error;
    }

    return data;
  }

  static async updatePhoneNumber(id: string, updates: Partial<PhoneNumber>): Promise<PhoneNumber | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: Phone number update simulated');
      return null;
    }

    const { data, error } = await supabase
      .from('phone_numbers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating phone number:', error);
      throw error;
    }

    return data;
  }

  static async deletePhoneNumber(id: string): Promise<boolean> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: Phone number deletion simulated');
      return true;
    }

    const { error } = await supabase
      .from('phone_numbers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting phone number:', error);
      throw error;
    }

    return true;
  }

  // IVR Menu operations
  static async getIVRMenu(profileId: string): Promise<IVRMenu | null> {
    if (DatabaseService.isDemoMode()) {
      return this.getDemoIVRMenu();
    }

    const { data, error } = await supabase
      .from('ivr_menus')
      .select(`
        *,
        ivr_options(*)
      `)
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found, not an error for our purposes
        return null;
      }
      console.error('Error fetching IVR menu:', error);
      return null;
    }

    return data;
  }

  static async createIVRMenu(menu: Omit<IVRMenu, 'id' | 'created_at' | 'updated_at' | 'ivr_options'>): Promise<IVRMenu | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: IVR menu creation simulated');
      return {
        ...menu,
        id: 'demo-ivr-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ivr_options: []
      } as IVRMenu;
    }

    const { data, error } = await supabase
      .from('ivr_menus')
      .insert(menu)
      .select()
      .single();

    if (error) {
      console.error('Error creating IVR menu:', error);
      throw error;
    }

    return data;
  }

  static async updateIVRMenu(id: string, updates: Partial<IVRMenu>): Promise<IVRMenu | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: IVR menu update simulated');
      return null;
    }

    const { data, error } = await supabase
      .from('ivr_menus')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating IVR menu:', error);
      throw error;
    }

    return data;
  }

  static async deleteIVRMenu(id: string): Promise<boolean> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: IVR menu deletion simulated');
      return true;
    }

    const { error } = await supabase
      .from('ivr_menus')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting IVR menu:', error);
      throw error;
    }

    return true;
  }

  // IVR Option operations
  static async createIVROption(option: Omit<IVROption, 'id' | 'created_at' | 'updated_at'>): Promise<IVROption | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: IVR option creation simulated');
      return {
        ...option,
        id: 'demo-ivr-option-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as IVROption;
    }

    const { data, error } = await supabase
      .from('ivr_options')
      .insert(option)
      .select()
      .single();

    if (error) {
      console.error('Error creating IVR option:', error);
      throw error;
    }

    return data;
  }

  static async updateIVROption(id: string, updates: Partial<IVROption>): Promise<IVROption | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: IVR option update simulated');
      return null;
    }

    const { data, error } = await supabase
      .from('ivr_options')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating IVR option:', error);
      throw error;
    }

    return data;
  }

  static async deleteIVROption(id: string): Promise<boolean> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: IVR option deletion simulated');
      return true;
    }

    const { error } = await supabase
      .from('ivr_options')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting IVR option:', error);
      throw error;
    }

    return true;
  }

  // External Integration operations
  static async getExternalIntegrations(profileId: string): Promise<ExternalIntegration[]> {
    if (DatabaseService.isDemoMode()) {
      return [];
    }

    const { data, error } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching external integrations:', error);
      return [];
    }

    return data || [];
  }

  static async createExternalIntegration(integration: Omit<ExternalIntegration, 'id' | 'created_at' | 'updated_at'>): Promise<ExternalIntegration | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: External integration creation simulated');
      return null;
    }

    const { data, error } = await supabase
      .from('external_integrations')
      .insert(integration)
      .select()
      .single();

    if (error) {
      console.error('Error creating external integration:', error);
      throw error;
    }

    return data;
  }

  static async updateExternalIntegration(id: string, updates: Partial<ExternalIntegration>): Promise<ExternalIntegration | null> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: External integration update simulated');
      return null;
    }

    const { data, error } = await supabase
      .from('external_integrations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating external integration:', error);
      throw error;
    }

    return data;
  }

  static async deleteExternalIntegration(id: string): Promise<boolean> {
    if (DatabaseService.isDemoMode()) {
      console.log('Demo mode: External integration deletion simulated');
      return true;
    }

    const { error } = await supabase
      .from('external_integrations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting external integration:', error);
      throw error;
    }

    return true;
  }

  // Demo data methods
  private static getDemoPhoneNumbers(): PhoneNumber[] {
    return [
      {
        id: 'demo-phone-1',
        profile_id: 'demo-user-id',
        phone_number: '+18553947135',
        friendly_name: 'Main Line',
        is_primary: true,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      },
      {
        id: 'demo-phone-2',
        profile_id: 'demo-user-id',
        phone_number: '+18553947136',
        friendly_name: 'Sales Line',
        agent_id: 'demo-agent-1',
        is_primary: false,
        is_active: true,
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z'
      },
      {
        id: 'demo-phone-3',
        profile_id: 'demo-user-id',
        phone_number: '+18553947137',
        friendly_name: 'Support Line',
        agent_id: 'demo-agent-2',
        is_primary: false,
        is_active: true,
        created_at: '2023-01-03T00:00:00Z',
        updated_at: '2023-01-03T00:00:00Z'
      }
    ];
  }

  private static getDemoIVRMenu(): IVRMenu {
    return {
      id: 'demo-ivr-1',
      profile_id: 'demo-user-id',
      name: 'Main Menu',
      greeting_text: 'Thank you for calling our demo company. Press 1 for sales, press 2 for support, or press 3 for general inquiries.',
      timeout_seconds: 10,
      max_attempts: 3,
      is_active: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      ivr_options: [
        {
          id: 'demo-ivr-option-1',
          ivr_menu_id: 'demo-ivr-1',
          digit: '1',
          description: 'Sales',
          agent_id: 'demo-agent-1',
          action_type: 'agent',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: 'demo-ivr-option-2',
          ivr_menu_id: 'demo-ivr-1',
          digit: '2',
          description: 'Support',
          agent_id: 'demo-agent-2',
          action_type: 'agent',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: 'demo-ivr-option-3',
          ivr_menu_id: 'demo-ivr-1',
          digit: '3',
          description: 'General Inquiries',
          agent_id: 'demo-agent-3',
          action_type: 'agent',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]
    };
  }
}

// Add the new methods directly to the DatabaseService class
DatabaseService.getPhoneNumbers = ExtendedDatabaseService.getPhoneNumbers;
DatabaseService.createPhoneNumber = ExtendedDatabaseService.createPhoneNumber;
DatabaseService.updatePhoneNumber = ExtendedDatabaseService.updatePhoneNumber;
DatabaseService.deletePhoneNumber = ExtendedDatabaseService.deletePhoneNumber;
DatabaseService.getIVRMenu = ExtendedDatabaseService.getIVRMenu;
DatabaseService.createIVRMenu = ExtendedDatabaseService.createIVRMenu;
DatabaseService.updateIVRMenu = ExtendedDatabaseService.updateIVRMenu;
DatabaseService.getIVROptions = ExtendedDatabaseService.getIVROptions;
DatabaseService.createIVROption = ExtendedDatabaseService.createIVROption;
DatabaseService.updateIVROption = ExtendedDatabaseService.updateIVROption;
DatabaseService.deleteIVROption = ExtendedDatabaseService.deleteIVROption;
DatabaseService.getExternalIntegrations = ExtendedDatabaseService.getExternalIntegrations;
DatabaseService.createExternalIntegration = ExtendedDatabaseService.createExternalIntegration;
DatabaseService.updateExternalIntegration = ExtendedDatabaseService.updateExternalIntegration;
DatabaseService.deleteExternalIntegration = ExtendedDatabaseService.deleteExternalIntegration;

// Export the original DatabaseService with the new methods
export { DatabaseService };