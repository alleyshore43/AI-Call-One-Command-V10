#!/usr/bin/env node

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config();

const BACKEND_URL = 'http://localhost:12001';
const FRONTEND_URL = 'http://localhost:12000';

class ProductionReadinessChecker {
    constructor() {
        this.checks = {
            services: {},
            apis: {},
            database: {},
            security: {},
            performance: {},
            monitoring: {}
        };
        this.totalChecks = 0;
        this.passedChecks = 0;
        this.criticalIssues = [];
        this.warnings = [];
    }

    async runCheck(category, checkName, checkFunction, critical = false) {
        this.totalChecks++;
        console.log(`🔍 Checking ${category}/${checkName}...`);
        
        try {
            const result = await checkFunction();
            this.passedChecks++;
            this.checks[category][checkName] = { status: 'PASS', result, critical };
            console.log(`✅ ${checkName} - PASSED`);
            return result;
        } catch (error) {
            this.checks[category][checkName] = { status: 'FAIL', error: error.message, critical };
            if (critical) {
                this.criticalIssues.push(`${category}/${checkName}: ${error.message}`);
                console.log(`🔴 ${checkName} - CRITICAL FAILURE: ${error.message}`);
            } else {
                this.warnings.push(`${category}/${checkName}: ${error.message}`);
                console.log(`⚠️  ${checkName} - WARNING: ${error.message}`);
            }
            return null;
        }
    }

    // Service Health Checks
    async checkBackendService() {
        const response = await fetch(`${BACKEND_URL}/health`);
        if (!response.ok) throw new Error(`Backend unhealthy: ${response.status}`);
        const data = await response.json();
        if (data.status !== 'healthy') throw new Error('Backend reports unhealthy status');
        return { status: data.status, timestamp: data.timestamp };
    }

    async checkFrontendService() {
        const response = await fetch(`${FRONTEND_URL}/`);
        if (!response.ok) throw new Error(`Frontend inaccessible: ${response.status}`);
        return { accessible: true };
    }

    async checkProcesses() {
        try {
            const { stdout } = await execAsync('pm2 jlist');
            const processes = JSON.parse(stdout);
            const backend = processes.find(p => p.name === 'ai-call-backend');
            const frontend = processes.find(p => p.name === 'ai-call-frontend');
            
            if (!backend || backend.pm2_env.status !== 'online') {
                throw new Error('Backend process not running');
            }
            if (!frontend || frontend.pm2_env.status !== 'online') {
                throw new Error('Frontend process not running');
            }
            
            return { 
                backend: backend.pm2_env.status, 
                frontend: frontend.pm2_env.status,
                backendUptime: backend.pm2_env.pm_uptime,
                frontendUptime: frontend.pm2_env.pm_uptime
            };
        } catch (error) {
            throw new Error(`Process check failed: ${error.message}`);
        }
    }

    // API Functionality Checks
    async checkCoreAPIs() {
        const endpoints = [
            { path: '/health', method: 'GET' },
            { path: '/status', method: 'GET' },
            { path: '/test/system', method: 'GET' },
            { path: '/webhook/voice', method: 'POST', body: 'From=%2B15551234567&To=%2B18186006909&CallSid=test', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        ];
        
        const results = {};
        for (const endpoint of endpoints) {
            const options = { method: endpoint.method };
            if (endpoint.headers) options.headers = endpoint.headers;
            if (endpoint.body) options.body = endpoint.body;
            
            const response = await fetch(`${BACKEND_URL}${endpoint.path}`, options);
            if (!response.ok) throw new Error(`${endpoint.method} ${endpoint.path} failed: ${response.status}`);
            results[`${endpoint.method} ${endpoint.path}`] = response.status;
        }
        
        return results;
    }

    async checkSystemIntegration() {
        const response = await fetch(`${BACKEND_URL}/test/system`);
        if (!response.ok) throw new Error(`System test failed: ${response.status}`);
        const data = await response.json();
        
        if (data.overall_status !== 'pass') {
            throw new Error(`System integration failed: ${data.score}/4 tests passed`);
        }
        
        return data;
    }

    // Database Checks
    async checkDatabaseConnection() {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) throw new Error(`Database connection failed: ${error.message}`);
        return { connected: true };
    }

    async checkDatabaseTables() {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const requiredTables = ['profiles', 'ai_agents', 'call_logs', 'campaigns'];
        const results = {};
        
        for (const table of requiredTables) {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) throw new Error(`Table ${table} inaccessible: ${error.message}`);
            results[table] = 'accessible';
        }
        
        return results;
    }

    // Security Checks
    async checkEnvironmentVariables() {
        const required = [
            'GEMINI_API_KEY',
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY',
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_PHONE_NUMBER'
        ];
        
        const missing = required.filter(env => !process.env[env]);
        if (missing.length > 0) {
            throw new Error(`Missing environment variables: ${missing.join(', ')}`);
        }
        
        return { allSet: true, count: required.length };
    }

    async checkCORS() {
        const response = await fetch(`${BACKEND_URL}/health`, { method: 'OPTIONS' });
        const corsHeader = response.headers.get('Access-Control-Allow-Origin');
        if (!corsHeader) throw new Error('CORS headers not configured');
        return { cors: corsHeader };
    }

    // Performance Checks
    async checkResponseTimes() {
        const endpoints = ['/health', '/status'];
        const results = {};
        
        for (const endpoint of endpoints) {
            const start = Date.now();
            const response = await fetch(`${BACKEND_URL}${endpoint}`);
            const duration = Date.now() - start;
            
            if (!response.ok) throw new Error(`${endpoint} failed: ${response.status}`);
            if (duration > 5000) throw new Error(`${endpoint} too slow: ${duration}ms`);
            
            results[endpoint] = `${duration}ms`;
        }
        
        return results;
    }

    async checkMemoryUsage() {
        try {
            const { stdout } = await execAsync('pm2 jlist');
            const processes = JSON.parse(stdout);
            const backend = processes.find(p => p.name === 'ai-call-backend');
            const frontend = processes.find(p => p.name === 'ai-call-frontend');
            
            const backendMem = backend?.pm2_env?.memory || 0;
            const frontendMem = frontend?.pm2_env?.memory || 0;
            
            // Warning if over 500MB
            if (backendMem > 500 * 1024 * 1024) {
                throw new Error(`Backend memory usage high: ${Math.round(backendMem / 1024 / 1024)}MB`);
            }
            
            return {
                backend: `${Math.round(backendMem / 1024 / 1024)}MB`,
                frontend: `${Math.round(frontendMem / 1024 / 1024)}MB`
            };
        } catch (error) {
            throw new Error(`Memory check failed: ${error.message}`);
        }
    }

    // Monitoring Checks
    async checkLogging() {
        try {
            const { stdout } = await execAsync('pm2 logs --lines 1 --nostream');
            if (!stdout || stdout.trim().length === 0) {
                throw new Error('No recent logs found');
            }
            return { logsActive: true };
        } catch (error) {
            throw new Error(`Logging check failed: ${error.message}`);
        }
    }

    async checkExternalServices() {
        // Test Twilio connectivity
        const twilioTest = await fetch(`${BACKEND_URL}/test/system`);
        const data = await twilioTest.json();
        
        if (data.tests.twilio.status !== 'pass') {
            throw new Error('Twilio service not accessible');
        }
        if (data.tests.gemini.status !== 'pass') {
            throw new Error('Gemini service not accessible');
        }
        
        return {
            twilio: data.tests.twilio.status,
            gemini: data.tests.gemini.status
        };
    }

    async runAllChecks() {
        console.log('🚀 Starting Production Readiness Assessment');
        console.log('=' .repeat(60));

        // Service Health Checks (Critical)
        console.log('\n🔧 SERVICE HEALTH CHECKS');
        console.log('-'.repeat(30));
        await this.runCheck('services', 'backend_service', () => this.checkBackendService(), true);
        await this.runCheck('services', 'frontend_service', () => this.checkFrontendService(), true);
        await this.runCheck('services', 'processes', () => this.checkProcesses(), true);

        // API Functionality Checks (Critical)
        console.log('\n🔌 API FUNCTIONALITY CHECKS');
        console.log('-'.repeat(30));
        await this.runCheck('apis', 'core_apis', () => this.checkCoreAPIs(), true);
        await this.runCheck('apis', 'system_integration', () => this.checkSystemIntegration(), true);

        // Database Checks (Critical)
        console.log('\n🗄️  DATABASE CHECKS');
        console.log('-'.repeat(30));
        await this.runCheck('database', 'connection', () => this.checkDatabaseConnection(), true);
        await this.runCheck('database', 'tables', () => this.checkDatabaseTables(), true);

        // Security Checks (Critical)
        console.log('\n🔒 SECURITY CHECKS');
        console.log('-'.repeat(30));
        await this.runCheck('security', 'environment_variables', () => this.checkEnvironmentVariables(), true);
        await this.runCheck('security', 'cors', () => this.checkCORS(), false);

        // Performance Checks (Warning)
        console.log('\n⚡ PERFORMANCE CHECKS');
        console.log('-'.repeat(30));
        await this.runCheck('performance', 'response_times', () => this.checkResponseTimes(), false);
        await this.runCheck('performance', 'memory_usage', () => this.checkMemoryUsage(), false);

        // Monitoring Checks (Warning)
        console.log('\n📊 MONITORING CHECKS');
        console.log('-'.repeat(30));
        await this.runCheck('monitoring', 'logging', () => this.checkLogging(), false);
        await this.runCheck('monitoring', 'external_services', () => this.checkExternalServices(), true);

        this.generateReport();
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 PRODUCTION READINESS REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n📈 OVERALL SUMMARY:`);
        console.log(`Total Checks: ${this.totalChecks}`);
        console.log(`✅ Passed: ${this.passedChecks}`);
        console.log(`❌ Failed: ${this.totalChecks - this.passedChecks}`);
        console.log(`Success Rate: ${((this.passedChecks / this.totalChecks) * 100).toFixed(1)}%`);

        // Critical Issues
        if (this.criticalIssues.length > 0) {
            console.log(`\n🔴 CRITICAL ISSUES (${this.criticalIssues.length}):`);
            this.criticalIssues.forEach(issue => console.log(`  ❌ ${issue}`));
        }

        // Warnings
        if (this.warnings.length > 0) {
            console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
            this.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
        }

        // Category Results
        for (const [category, checks] of Object.entries(this.checks)) {
            const categoryPassed = Object.values(checks).filter(c => c.status === 'PASS').length;
            const categoryTotal = Object.keys(checks).length;
            
            if (categoryTotal > 0) {
                console.log(`\n📋 ${category.toUpperCase()}: ${categoryPassed}/${categoryTotal} passed`);
                for (const [checkName, result] of Object.entries(checks)) {
                    const icon = result.status === 'PASS' ? '✅' : (result.critical ? '🔴' : '⚠️');
                    console.log(`  ${icon} ${checkName}`);
                }
            }
        }

        // Final Assessment
        console.log('\n🏭 PRODUCTION READINESS ASSESSMENT:');
        console.log('-'.repeat(40));
        
        if (this.criticalIssues.length === 0) {
            console.log('🟢 SYSTEM IS PRODUCTION READY');
            console.log('✅ All critical systems are operational');
            console.log('✅ Core functionality verified');
            console.log('✅ Database connectivity confirmed');
            console.log('✅ External services accessible');
            
            if (this.warnings.length > 0) {
                console.log(`\n⚠️  ${this.warnings.length} non-critical warnings to address`);
            }
            
            console.log('\n🚀 DEPLOYMENT RECOMMENDATIONS:');
            console.log('  • Monitor system performance after deployment');
            console.log('  • Set up alerting for critical endpoints');
            console.log('  • Regular health checks every 5 minutes');
            console.log('  • Database backup strategy in place');
            
        } else {
            console.log('🔴 SYSTEM NOT READY FOR PRODUCTION');
            console.log(`❌ ${this.criticalIssues.length} critical issues must be resolved`);
            console.log('\n🔧 REQUIRED ACTIONS:');
            this.criticalIssues.forEach(issue => console.log(`  • Fix: ${issue}`));
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Return status for automation
        return {
            ready: this.criticalIssues.length === 0,
            score: (this.passedChecks / this.totalChecks) * 100,
            criticalIssues: this.criticalIssues.length,
            warnings: this.warnings.length
        };
    }
}

// Run the assessment
const checker = new ProductionReadinessChecker();
checker.runAllChecks()
    .then(() => {
        const ready = checker.criticalIssues.length === 0;
        process.exit(ready ? 0 : 1);
    })
    .catch(error => {
        console.error('Assessment failed:', error);
        process.exit(1);
    });