const SUPABASE_URL  = 'https://fczudbtgtpkxteppckwb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjenVkYnRndHBreHRlcHBja3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzczMzEsImV4cCI6MjA5MzU1MzMzMX0.AZKGqLFVB-VpBsDrg0ekOzX755t5kLfgWZPEJ92ELeU';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const session = JSON.parse(sessionStorage.getItem('wmc_user'));
let currentSecret = null;
let twoFaEnabled = false;

async function loadProfile() {
  const { data, error } = await sb
    .from('mission_users')
    .select('id, username, full_name, email, phone, mission_id, two_fa_enabled, totp_secret')
    .eq('id', session.id)
    .single();

  if (error || !data) return;

  twoFaEnabled = data.two_fa_enabled || false;
  currentSecret = data.totp_secret;

  const initials = (data.full_name || data.username || '?').charAt(0).toUpperCase();
  document.getElementById('profileAvatar').textContent   = initials;
  document.getElementById('profileName').textContent     = data.full_name || '—';
  document.getElementById('profileUsername').textContent = '@' + data.username;

  document.getElementById('fUsername').value = data.username  || '';
  document.getElementById('fFullName').value = data.full_name || '';
  document.getElementById('fEmail').value    = data.email     || '';
  document.getElementById('fPhone').value    = data.phone     || '';

  update2FAStatus();
}

async function saveProfile() {
  const btn       = document.getElementById('btnSave');
  const username  = document.getElementById('fUsername').value.trim();
  const full_name = document.getElementById('fFullName').value.trim();
  const email     = document.getElementById('fEmail').value.trim();
  const phone     = document.getElementById('fPhone').value.trim();
  const password  = document.getElementById('fPassword').value;

  if (!username) { showFeedback('Username cannot be empty.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Saving…';

  const payload = { username, full_name, email, phone, updated_at: new Date().toISOString() };
  if (password) payload.password_hash = password;

  const { error } = await sb.from('mission_users').update(payload).eq('id', session.id);

  btn.disabled = false;
  btn.textContent = 'Save Changes';

  if (error) { showFeedback(error.message, 'error'); return; }

  const updated = { ...session, username, full_name };
  sessionStorage.setItem('wmc_user', JSON.stringify(updated));

  document.getElementById('fPassword').value = '';
  document.getElementById('profileName').textContent     = full_name || '—';
  document.getElementById('profileUsername').textContent = '@' + username;
  document.getElementById('profileAvatar').textContent   = (full_name || username).charAt(0).toUpperCase();

  showFeedback('Profile updated successfully!', 'success');
}

function showFeedback(msg, type) {
  const el = document.getElementById('saveFeedback');
  el.textContent = msg;
  el.className = 'save-feedback ' + type;
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function logout() {
  sessionStorage.removeItem('wmc_user');
  localStorage.setItem('wmc_logout', Date.now());
  localStorage.removeItem('wmc_logout');
  location.replace('../index.html');
}

function update2FAStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const actions = document.getElementById('twoFaActions');

  if (twoFaEnabled) {
    dot.className = 'status-dot enabled';
    text.textContent = 'Enabled';
    actions.innerHTML = '<button class="btn-2fa" onclick="viewQR()">View QR</button><button class="btn-2fa danger" onclick="disable2FA()">Disable</button>';
  } else {
    dot.className = 'status-dot';
    text.textContent = 'Disabled';
    actions.innerHTML = '<button class="btn-2fa" onclick="enable2FA()">Enable 2FA</button>';
  }
}

function enable2FA() {
  const secret = new OTPAuth.Secret();
  const totp = new OTPAuth.TOTP({
    issuer: 'WMC Treasury',
    label: session.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret
  });

  const uri = totp.toString();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;

  document.getElementById('modalTitle').textContent = 'Enable Two-Factor Authentication';
  document.getElementById('modalBody').innerHTML = `
    <p class="modal-text">Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.)</p>
    <div class="qr-container"><img src="${qrUrl}" alt="QR Code" class="qr-image"/></div>
    <p class="modal-text">Or enter this secret key manually:</p>
    <div class="secret-key">${secret.base32}</div>
    <div class="input-group" style="margin-top:16px;">
      <label for="verifyCode">Enter 6-digit code to confirm</label>
      <input type="text" id="verifyCode" maxlength="6" pattern="[0-9]{6}" autocomplete="off" required/>
    </div>
    <div class="modal-error hidden" id="modalError"></div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn-modal-primary" onclick="confirm2FA('${secret.base32}')">Confirm & Enable</button>
    <button class="btn-modal-secondary" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById('modalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('verifyCode').focus(), 100);
}

async function confirm2FA(secret) {
  const code = document.getElementById('verifyCode').value.trim();
  const errEl = document.getElementById('modalError');

  if (code.length !== 6) {
    errEl.textContent = 'Please enter a 6-digit code.';
    errEl.classList.remove('hidden');
    return;
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'WMC Treasury',
    label: session.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret
  });

  const isValid = totp.validate({ token: code, window: 1 }) !== null;

  if (!isValid) {
    errEl.textContent = 'Invalid code. Please try again.';
    errEl.classList.remove('hidden');
    return;
  }

  const { error } = await sb.from('mission_users').update({ totp_secret: secret, two_fa_enabled: true }).eq('id', session.id);

  if (error) {
    errEl.textContent = 'Failed to enable 2FA. Please try again.';
    errEl.classList.remove('hidden');
    return;
  }

  twoFaEnabled = true;
  currentSecret = secret;
  closeModal();
  update2FAStatus();
  showFeedback('Two-Factor Authentication enabled successfully!', 'success');
}

function viewQR() {
  if (!currentSecret) return;

  const totp = new OTPAuth.TOTP({
    issuer: 'WMC Treasury',
    label: session.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: currentSecret
  });

  const uri = totp.toString();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;

  document.getElementById('modalTitle').textContent = 'Your 2FA QR Code';
  document.getElementById('modalBody').innerHTML = `
    <p class="modal-text">Scan this QR code to add your account to a new device</p>
    <div class="qr-container"><img src="${qrUrl}" alt="QR Code" class="qr-image"/></div>
    <p class="modal-text">Secret key:</p>
    <div class="secret-key">${currentSecret}</div>
  `;
  document.getElementById('modalFooter').innerHTML = '<button class="btn-modal-primary" onclick="closeModal()">Close</button>';
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function disable2FA() {
  document.getElementById('modalTitle').textContent = 'Disable Two-Factor Authentication';
  document.getElementById('modalBody').innerHTML = `
    <div class="warning-box">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <p>Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.</p>
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn-modal-danger" onclick="confirmDisable2FA()">Yes, Disable</button>
    <button class="btn-modal-secondary" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function confirmDisable2FA() {
  const { error } = await sb.from('mission_users').update({ totp_secret: null, two_fa_enabled: false }).eq('id', session.id);

  if (error) {
    showFeedback('Failed to disable 2FA. Please try again.', 'error');
    return;
  }

  twoFaEnabled = false;
  currentSecret = null;
  closeModal();
  update2FAStatus();
  showFeedback('Two-Factor Authentication disabled.', 'success');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

loadProfile();
