const SUPABASE_URL  = 'https://fczudbtgtpkxteppckwb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjenVkYnRndHBreHRlcHBja3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzczMzEsImV4cCI6MjA5MzU1MzMzMX0.AZKGqLFVB-VpBsDrg0ekOzX755t5kLfgWZPEJ92ELeU';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let tempUser = null;
let is2FAStep = false;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    btn.disabled = true;
    errEl.classList.add('hidden');

    if (!is2FAStep) {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        btn.textContent = 'Signing in...';

        const { data, error } = await sb
            .from('mission_users')
            .select('id, username, full_name, mission_id, is_active, two_fa_enabled, totp_secret')
            .eq('username', username)
            .eq('password_hash', password)
            .eq('mission_id', 6)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !data) {
            errEl.textContent = 'Access denied. This portal is for WMC users only.';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Login';
            return;
        }

        if (data.two_fa_enabled) {
            tempUser = data;
            is2FAStep = true;
            document.getElementById('credentialsGroup').classList.add('hidden');
            document.getElementById('twoFaGroup').classList.remove('hidden');
            document.getElementById('backBtn').classList.remove('hidden');
            btn.textContent = 'Verify Code';
            btn.disabled = false;
            document.getElementById('totpCode').focus();
        } else {
            sessionStorage.setItem('wmc_user', JSON.stringify(data));
            location.href = 'Pages/Dashboard.html';
        }
    } else {
        const code = document.getElementById('totpCode').value.trim();

        if (code.length !== 6) {
            errEl.textContent = 'Please enter a 6-digit code.';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            return;
        }

        btn.textContent = 'Verifying...';

        try {
            const totp = new OTPAuth.TOTP({
                issuer: 'WMC Treasury',
                label: tempUser.username,
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: tempUser.totp_secret
            });

            const isValid = totp.validate({ token: code, window: 1 }) !== null;

            if (isValid) {
                const { totp_secret, ...userData } = tempUser;
                sessionStorage.setItem('wmc_user', JSON.stringify(userData));
                location.href = 'Pages/Dashboard.html';
            } else {
                errEl.textContent = 'Invalid code. Please try again.';
                errEl.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = 'Verify Code';
                document.getElementById('totpCode').value = '';
                document.getElementById('totpCode').focus();
            }
        } catch (err) {
            errEl.textContent = 'Verification failed. Please try again.';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Verify Code';
        }
    }
});

function resetLogin() {
    is2FAStep = false;
    tempUser = null;
    document.getElementById('credentialsGroup').classList.remove('hidden');
    document.getElementById('twoFaGroup').classList.add('hidden');
    document.getElementById('backBtn').classList.add('hidden');
    document.getElementById('loginBtn').textContent = 'Login';
    document.getElementById('totpCode').value = '';
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('username').focus();
}
