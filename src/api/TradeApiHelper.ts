import { APIRequestContext } from '@playwright/test';
import crypto from 'crypto';

export interface TradeResponse {
    status: number;
    body: any;
}

function generateTOTP(base32Secret: string): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32Secret.replace(/=+$/, '').toUpperCase();
    let bits = '';
    for (const char of clean) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) continue;
        bits += idx.toString(2).padStart(5, '0');
    }
    const keyBytes = Buffer.alloc(Math.floor(bits.length / 8));
    for (let i = 0; i < keyBytes.length; i++) {
        keyBytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    const step = Math.floor(Date.now() / 1000 / 30);
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(step));
    const digest = crypto.createHmac('sha1', keyBytes).update(msg).digest();
    const offset = digest[19] & 0x0f;
    const code =
        (((digest[offset] & 0x7f) << 24) |
            ((digest[offset + 1] & 0xff) << 16) |
            ((digest[offset + 2] & 0xff) << 8) |
            (digest[offset + 3] & 0xff)) %
        1_000_000;
    return code.toString().padStart(6, '0');
}

export class TradeApiHelper {
    private readonly request: APIRequestContext;
    private readonly baseURL: string;
    private csrfToken = '';

    constructor(request: APIRequestContext, baseURL: string) {
        this.request = request;
        this.baseURL = baseURL;
    }

    async login(email: string, password: string, totpSecret: string): Promise<void> {
        console.log('\n🚀 STARTING LOGIN WITH 2FA FLOW\n');

        // ── STEP 1: Identity API ─────────────────────────────────────────────
        console.log('📌 STEP 1: Calling Identity API...');
        const identityRes = await this.request.post(`${this.baseURL}/api/v2/barong/identity`, {
            data: { email, password, finger_print: 1290830814, session_type: 'email' },
            headers: { 'Content-Type': 'application/json' },
        });
        const identityBodyText = await identityRes.text();
        let identityBody: any = {};
        try { identityBody = JSON.parse(identityBodyText); } catch { /* non-JSON */ }
        console.log(`✅ Identity API Response Status: ${identityRes.status()}`);
        console.log('📦 Identity API Response Data:', identityBody);
        if (identityRes.status() !== 200 && identityRes.status() !== 201) {
            console.error('❌ Identity API failed');
        } else {
            console.log('✔️  Identity Validation Passed (OTP Required)');
        }

        // ── STEP 2: Generate TOTP ────────────────────────────────────────────
        console.log('\n📌 STEP 2: Generating OTP...');
        const otp = generateTOTP(totpSecret);
        console.log(`🔐 OTP Generated: ${otp}`);

        // ── STEP 3: Session with OTP ─────────────────────────────────────────
        console.log('\n📌 STEP 3: Creating Session with OTP...');
        const sessionRes = await this.request.post(`${this.baseURL}/api/v2/barong/identity/sessions`, {
            data: {
                email, password, otp_code: otp,
                finger_print: 694321185, session_type: 'email',
                authentication_state: 'web', isTrust: false,
            },
            headers: { 'Content-Type': 'application/json' },
        });
        const sessionBodyText = await sessionRes.text();
        let sessionBody: any = {};
        try { sessionBody = JSON.parse(sessionBodyText); } catch { /* non-JSON */ }
        console.log(`✅ Session API Response Status: ${sessionRes.status()}`);
        console.log('📦 Session API Response Data:', sessionBody);
        if (sessionRes.status() === 200) {
            console.log('✔️  Session Created Successfully');
        } else {
            console.error('❌ Session creation failed');
        }

        // ── STEP 4: Extract CSRF token from session body ─────────────────────
        // Barong returns csrf_token directly in the session response body
        console.log('\n📌 STEP 4: Extracting CSRF Token...');
        this.csrfToken =
            sessionBody.csrf_token  ||
            sessionBody.csrfToken   ||
            sessionBody.data?.csrf_token || '';

        // Fallback: response headers
        if (!this.csrfToken) {
            const h = sessionRes.headers();
            this.csrfToken = h['x-csrf-token'] || h['x-xsrf-token'] || '';
        }
        console.log(`🔑 CSRF Token: ${this.csrfToken || '❌ NOT FOUND'}`);

        // ── STEP 5: Verify session cookie ────────────────────────────────────
        // Playwright auto-manages cookies — just log for confirmation
        console.log('\n📌 STEP 5: Verifying Session Cookie...');
        const state = await this.request.storageState();
        const sessionCookie = state.cookies.find(
            c => c.name === '_edx_session' || c.name === '_barong_session',
        );
        if (sessionCookie) {
            console.log(`🍪 Session Cookie: ${sessionCookie.name}=${sessionCookie.value.slice(0, 32)}...`);
        } else {
            console.warn('⚠️  Session cookie not found. All cookies:', state.cookies.map(c => c.name).join(', '));
        }

        if (this.csrfToken && sessionCookie) {
            console.log('\n🎉 LOGIN WITH 2FA SUCCESSFUL ✅\n');
        } else {
            console.error('\n❌ LOGIN INCOMPLETE — check CSRF or session cookie above\n');
        }
    }

    private sessionHeaders(): Record<string, string> {
        return {
            'x-csrf-token': this.csrfToken,
            'Content-Type': 'application/json',
        };
    }

    private async parse(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<TradeResponse> {
        // Keep CSRF token current — Barong sends a fresh one with every response
        const freshCsrf = response.headers()['x-csrf-token'];
        if (freshCsrf) this.csrfToken = freshCsrf;

        const text = await response.text();
        let body: any;
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
        return { status: response.status(), body };
    }

    async get(endpoint: string): Promise<TradeResponse> {
        const r = await this.request.get(`${this.baseURL}${endpoint}`, {
            headers: this.sessionHeaders(),
        });
        return this.parse(r);
    }

    async post(endpoint: string, data: object): Promise<TradeResponse> {
        const r = await this.request.post(`${this.baseURL}${endpoint}`, {
            data,
            headers: this.sessionHeaders(),
        });
        return this.parse(r);
    }
}
