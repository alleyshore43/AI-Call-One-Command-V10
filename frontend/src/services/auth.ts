import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthError {
  message: string
  status?: number
}

export interface SignUpData {
  email: string
  password: string
  clientName: string
  companyName?: string
  phoneNumber?: string
}

export interface SignInData {
  email: string
  password: string
}

export interface ResetPasswordData {
  email: string
}

export class AuthService {
  // Sign up new user
  static async signUp(data: SignUpData): Promise<{ user: User | null; error: AuthError | null }> {

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation
          data: {
            client_name: data.clientName,
            company_name: data.companyName,
            phone_number: data.phoneNumber
          }
        }
      });

      if (error) {
        return { user: null, error: { message: error.message } };
      }

      return { user: authData.user, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, error: { message: 'An unexpected error occurred' } };
    }
  }

  // Sign in existing user
  static async signIn(data: SignInData): Promise<{ user: User | null; error: AuthError | null }> {

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (error) {
        return { user: null, error: { message: error.message } };
      }

      return { user: authData.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error: { message: 'An unexpected error occurred' } };
    }
  }

  // Sign out user
  static async signOut(): Promise<{ error: AuthError | null }> {

    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return { error: { message: error.message } };
      }

      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: { message: 'An unexpected error occurred' } };
    }
  }

  // Get current session
  static async getSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        return { session: null, error: { message: error.message } };
      }

      return { session: data.session, error: null };
    } catch (error) {
      console.error('Get session error:', error);
      return { session: null, error: { message: 'An unexpected error occurred' } };
    }
  }

  // Reset password
  static async resetPassword(data: ResetPasswordData): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) {
        return { error: { message: error.message } };
      }

      return { error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: { message: 'An unexpected error occurred' } };
    }
  }

  // Resend confirmation email
  static async resendConfirmation(data: ResetPasswordData): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`
        }
      });
      
      if (error) {
        return { error: { message: error.message } };
      }

      return { error: null };
    } catch (error) {
      console.error('Resend confirmation error:', error);
      return { error: { message: 'An unexpected error occurred' } };
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  }
}