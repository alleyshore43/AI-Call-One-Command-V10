// Stub file for compatibility - RealtimeService functionality moved to polling in individual services
// This maintains compatibility with existing imports while the real-time features are replaced with API polling

export class RealtimeService {
  static subscribeToCallUpdates(userId: string, onUpdate?: () => void, onInsert?: () => void, onDelete?: () => void) {
    // Return a mock subscription object
    return {
      unsubscribe: () => {}
    };
  }

  static subscribeToCampaignUpdates(userId: string, onUpdate?: () => void, onInsert?: () => void, onDelete?: () => void) {
    return {
      unsubscribe: () => {}
    };
  }

  static subscribeToAgentUpdates(userId: string, onUpdate?: () => void, onInsert?: () => void, onDelete?: () => void) {
    return {
      unsubscribe: () => {}
    };
  }

  static subscribeToDNCUpdates(userId: string, onUpdate?: () => void, onInsert?: () => void, onDelete?: () => void) {
    return {
      unsubscribe: () => {}
    };
  }

  static subscribeToAppointmentUpdates(userId: string, onUpdate?: () => void, onInsert?: () => void, onDelete?: () => void) {
    return {
      unsubscribe: () => {}
    };
  }

  static subscribeToWebhookUpdates(userId: string, onUpdate?: () => void, onInsert?: () => void, onDelete?: () => void) {
    return {
      unsubscribe: () => {}
    };
  }

  static unsubscribe(subscription: any) {
    if (subscription && subscription.unsubscribe) {
      subscription.unsubscribe();
    }
  }
}