import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeService } from '../stripe';

// Mock fetch globally
global.fetch = vi.fn();

// Mock Stripe
const mockStripe = {
  redirectToCheckout: vi.fn()
};

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue(mockStripe)
}));

describe('StripeService', () => {
  let stripeService: StripeService;

  beforeEach(() => {
    vi.resetAllMocks();
    stripeService = new StripeService('pk_test_123');
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      const mockResponse = {
        checkout_url: 'https://checkout.stripe.com/pay/cs_test_123'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await stripeService.createCheckoutSession('price_123', 'user@example.com');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/billing/create-checkout-session'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            price_id: 'price_123',
            customer_email: 'user@example.com',
            success_url: expect.stringContaining('/billing/success'),
            cancel_url: expect.stringContaining('/billing')
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle checkout session creation error', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400
      });

      const result = await stripeService.createCheckoutSession('price_123');

      expect(result).toBeNull();
    });

    it('should handle network error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await stripeService.createCheckoutSession('price_123');

      expect(result).toBeNull();
    });
  });

  describe('redirectToCheckout', () => {
    it('should redirect to checkout URL', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: '' } as any;

      await stripeService.redirectToCheckout('https://checkout.stripe.com/pay/cs_test_123');

      expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_test_123');

      window.location = originalLocation;
    });

    it('should handle redirect error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock window.location to throw an error
      const originalLocation = window.location;
      delete (window as any).location;
      Object.defineProperty(window, 'location', {
        set: () => {
          throw new Error('Redirect failed');
        }
      });

      await stripeService.redirectToCheckout('invalid-url');

      expect(consoleSpy).toHaveBeenCalledWith('Error redirecting to checkout:', expect.any(Error));

      window.location = originalLocation;
      consoleSpy.mockRestore();
    });
  });

  describe('getSubscriptionPlans', () => {
    it('should return predefined subscription plans', () => {
      const plans = StripeService.getSubscriptionPlans();

      expect(plans).toHaveLength(3);
      expect(plans[0]).toMatchObject({
        id: 'basic',
        name: 'Basic',
        price: 99,
        interval: 'month'
      });
      expect(plans[1]).toMatchObject({
        id: 'standard',
        name: 'Standard',
        price: 299,
        interval: 'month',
        popular: true
      });
      expect(plans[2]).toMatchObject({
        id: 'premium',
        name: 'Premium',
        price: 799,
        interval: 'month'
      });
    });
  });

  describe('getPlanById', () => {
    it('should return correct plan by ID', () => {
      const plan = StripeService.getPlanById('standard');

      expect(plan).toMatchObject({
        id: 'standard',
        name: 'Standard',
        popular: true
      });
    });

    it('should return null for non-existent plan', () => {
      const plan = StripeService.getPlanById('non-existent');

      expect(plan).toBeNull();
    });
  });

  describe('calculateUsagePricing', () => {
    it('should calculate pricing with no overages', () => {
      const plan = StripeService.getPlanById('basic')!;
      const usage = {
        calls: 400,
        storage_gb: 8
      };

      const pricing = StripeService.calculateUsagePricing(plan, usage);

      expect(pricing).toMatchObject({
        base_price: 99,
        overage_charges: 0,
        total_price: 99,
        breakdown: [
          {
            item: 'Basic Plan',
            quantity: 1,
            rate: 99,
            amount: 99
          }
        ]
      });
    });

    it('should calculate pricing with call overages', () => {
      const plan = StripeService.getPlanById('basic')!;
      const usage = {
        calls: 600, // 100 over limit
        storage_gb: 8
      };

      const pricing = StripeService.calculateUsagePricing(plan, usage);

      expect(pricing.overage_charges).toBe(25); // 100 * 0.25
      expect(pricing.total_price).toBe(124); // 99 + 25
      expect(pricing.breakdown).toHaveLength(2);
    });

    it('should calculate pricing with storage overages', () => {
      const plan = StripeService.getPlanById('basic')!;
      const usage = {
        calls: 400,
        storage_gb: 15 // 5 GB over limit
      };

      const pricing = StripeService.calculateUsagePricing(plan, usage);

      expect(pricing.overage_charges).toBe(10); // 5 * 2.00
      expect(pricing.total_price).toBe(109); // 99 + 10
    });
  });

  describe('checkUsageLimits', () => {
    it('should check usage limits correctly', () => {
      const plan = StripeService.getPlanById('basic')!;
      const usage = {
        calls: 400,
        agents: 1,
        campaigns: 3,
        storage_gb: 8
      };

      const limits = StripeService.checkUsageLimits(plan, usage);

      expect(limits.calls).toMatchObject({
        used: 400,
        limit: 500,
        percentage: 80,
        exceeded: false
      });
      expect(limits.storage).toMatchObject({
        used: 8,
        limit: 10,
        percentage: 80,
        exceeded: false
      });
    });

    it('should detect exceeded limits', () => {
      const plan = StripeService.getPlanById('basic')!;
      const usage = {
        calls: 600,
        agents: 3,
        campaigns: 6,
        storage_gb: 12
      };

      const limits = StripeService.checkUsageLimits(plan, usage);

      expect(limits.calls.exceeded).toBe(true);
      expect(limits.agents.exceeded).toBe(true);
      expect(limits.campaigns.exceeded).toBe(true);
      expect(limits.storage.exceeded).toBe(true);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(StripeService.formatCurrency(9900)).toBe('$99.00');
      expect(StripeService.formatCurrency(29900)).toBe('$299.00');
      expect(StripeService.formatCurrency(79900)).toBe('$799.00');
    });
  });
});