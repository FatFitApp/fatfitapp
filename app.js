// ============================================
// FATFIT - Aplicação Principal v2.0
// ============================================

const db = window.db;
let currentGroup = null;
let currentUserRole = null;
let chatSubscription = null;
let currentFacingMode = 'environment'; // 'environment' = traseira, 'user' = frontal


let isVideoMode = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
const MAX_VIDEO_DURATION = 6000; // 6 segundos


// ============================================
// UTILITÁRIOS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
}

function formatCurrency(value) {
    return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = dateStr.split('T')[0].split('-');
    return d[2] + '/' + d[1] + '/' + d[0];
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showForm(formId) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(formId)?.classList.add('active');
}

// ============================================
// AUTENTICAÇÃO
// ============================================

async function checkAuth() {
    if (!db) return null;
    try { const { data } = await db.auth.getSession(); return data.session; } 
    catch (e) { return null; }
}

async function requireAuth() {
    const session = await checkAuth();
    if (!session) { window.location.href = 'index.html'; return null; }
    return session;
}

async function getCurrentUser() {
    if (!db) return null;
    try { const { data } = await db.auth.getUser(); return data.user; } 
    catch (e) { return null; }
}

async function getProfile(userId) {
    const { data } = await db.from('profiles').select('*').eq('id', userId).single();
    return data;
}

// ============================================
// PÁGINA: index.html
// ============================================
if (document.querySelector('.auth-page')) {
    document.addEventListener('DOMContentLoaded', async () => {
        // Verifica PRIMEIRO se veio do link de recuperação
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
            // Força logout e mostra tela de redefinição
            await db.auth.signOut();
            setupAuthForms();
            showForm('resetForm');
            return;
        }
        
        // Depois verifica se já está logado
        const session = await checkAuth();
        if (session) { window.location.href = 'home.html'; return; }
        
        setupAuthForms();
    });
}

function setupAuthForms() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.password-wrapper');
            if (!wrapper) return;
            const input = wrapper.querySelector('input');
            const icon = btn.querySelector('i');
            if (!input || !icon) return;
            if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
            else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
        });
    });

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
            showToast(error.message.includes('Invalid login') ? 'E-mail ou senha incorretos' : error.message, 'error');
        } else {
            showToast('Login realizado!', 'success');
            setTimeout(() => window.location.href = 'home.html', 500);
        }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        if (password.length < 6) { showToast('Senha deve ter no mínimo 6 caracteres', 'error'); return; }
        const { error } = await db.auth.signUp({ email, password, options: { data: { name } } });
        if (error) { showToast(error.message, 'error'); }
        else { 
            showToast('✅ Conta criada! Verifique seu e-mail para confirmar.', 'success'); 
            setTimeout(() => showForm('loginForm'), 3000); 
        }
    });

    document.getElementById('recoverForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoverEmail').value.trim();
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/index.html' });
        if (error) { showToast(error.message, 'error'); }
        else { showToast('Email de recuperação enviado!', 'success'); setTimeout(() => showForm('loginForm'), 2000); }
    });

        // Verifica se veio do link de recuperação
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        showForm('resetForm');
    }

    // Redefinir senha
    document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('resetPassword').value;
        
        if (newPassword.length < 6) {
            showToast('A senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }
        
        const { error } = await db.auth.updateUser({ password: newPassword });
        
        if (error) {
            showToast('Erro ao redefinir senha: ' + error.message, 'error');
        } else {
            showToast('Senha redefinida com sucesso! Faça login.', 'success');
            setTimeout(() => showForm('loginForm'), 2000);
        }
    });

}



// ============================================
// PÁGINA: profile.html
// ============================================
if (window.location.pathname.includes('profile')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupProfile(session);
    });
}

async function setupProfile(session) {
    const user = session.user;
    
    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
    
    // Buscar atividades do usuário usando a função RPC
    const { data: activities, error: actError } = await db.rpc('get_calendar_data', {
        p_user_id: user.id,
        p_group_id: null,
        p_month: new Date().getMonth() + 1,
        p_year: new Date().getFullYear()
    });
    
    console.log('📊 Atividades carregadas:', activities?.length, 'Erro:', actError);
    
    // Agrupar atividades por data
    const activitiesByDate = {};
    if (activities) {
        activities.forEach(act => {
            const date = act.activity_date;
            if (!activitiesByDate[date]) {
                activitiesByDate[date] = [];
            }
            activitiesByDate[date].push({
                photo_url: act.photo_url,
                comment: act.comment,
                user_name: act.user_name,
                group_name: act.group_name,
                challenge_name: act.challenge_name,
                is_extra: act.is_extra
            });
        });
    }
    
    // Criar estrutura HTML moderna com calendário
    const container = document.querySelector('.profile-container');
    if (container) {
        container.innerHTML = `
            <!-- Header com capa -->
            <div class="profile-header">
                <div class="profile-avatar-container">
                    <div class="profile-avatar-wrapper">
                        <img id="avatarImg" class="profile-avatar-img" 
                             src="${profile?.avatar_url || 'perfil_padrao.png'}" 
                             alt="Avatar">
                        <div class="profile-avatar-overlay" id="avatarUploadBtn">
                            <i class="fas fa-camera"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="profile-info">
                <h1 class="profile-name" id="profileName">${escapeHtml(profile?.name || 'Usuário')}</h1>
                <p class="profile-email" id="profileEmail">${escapeHtml(profile?.email || user.email)}</p>
            </div>
            
            <!-- Cards de estatísticas -->
            <div class="stats-grid">
                <div class="stat-card-modern">
                    <div class="stat-icon challenges"><i class="fas fa-trophy"></i></div>
                    <div class="stat-value" id="totalChallenges">0</div>
                    <div class="stat-label">Desafios</div>
                </div>
                <div class="stat-card-modern">
                    <div class="stat-icon wins"><i class="fas fa-medal"></i></div>
                    <div class="stat-value" id="totalWins">0</div>
                    <div class="stat-label">Vitórias</div>
                </div>
                <div class="stat-card-modern">
                    <div class="stat-icon earnings"><i class="fas fa-coins"></i></div>
                    <div class="stat-value" id="totalEarnings">R$ 0</div>
                    <div class="stat-label">Ganhos</div>
                </div>
            </div>
            
            <!-- Calendário de Atividades -->
            <div class="profile-card">
                <div class="profile-card-title">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Minhas Atividades</span>
                </div>
                <div id="profileCalendarContainer">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando calendário...</p>
                    </div>
                </div>
                <div class="calendar-legend">
                    <div class="calendar-legend-item">
                        <div class="calendar-legend-dot" style="background: #667eea;"></div>
                        <span>1 atividade no dia</span>
                    </div>
                    <div class="calendar-legend-item">
                        <div class="calendar-legend-dot" style="background: #10b981;"></div>
                        <span>Múltiplas atividades</span>
                    </div>
                </div>
            </div>
            
            <!-- Editar Perfil -->
            <div class="profile-card">
                <div class="profile-card-title">
                    <i class="fas fa-user-edit"></i>
                    <span>Editar Perfil</span>
                </div>
                <form id="profileForm">
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Nome completo</label>
                        <input type="text" id="editName" class="modern-input" 
                               value="${escapeHtml(profile?.name || '')}" required>
                    </div>
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Chave PIX</label>
                        <input type="text" id="editPixKey" class="modern-input" 
                               value="${escapeHtml(profile?.pix_key || '')}" 
                               placeholder="CPF, E-mail, Telefone ou Chave aleatória">
                    </div>
                    <button type="submit" class="btn-modern">
                        <i class="fas fa-save"></i> Salvar Alterações
                    </button>
                </form>
            </div>
            
            <!-- Alterar Senha -->
            <div class="profile-card">
                <div class="profile-card-title">
                    <i class="fas fa-lock"></i>
                    <span>Segurança</span>
                </div>
                <form id="changePasswordForm">
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Senha atual</label>
                        <input type="password" id="currentPassword" class="modern-input" required>
                    </div>
                    <div class="input-group" style="margin-bottom: 15px;">
                        <label>Nova senha</label>
                        <input type="password" id="newPassword" class="modern-input" required>
                        <small class="text-muted">Mínimo 6 caracteres</small>
                    </div>
                    <button type="submit" class="btn-outline-modern" style="width: 100%;">
                        <i class="fas fa-key"></i> Alterar Senha
                    </button>
                </form>
            </div>
            
            <!-- Histórico de Vitórias -->
            <div class="profile-card">
                <div class="profile-card-title">
                    <i class="fas fa-history"></i>
                    <span>Histórico de Vitórias</span>
                </div>
                <div id="winsList" class="wins-list">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando vitórias...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Renderiza o calendário com miniaturas
    renderProfileCalendar(activitiesByDate);
    
    // Resto das estatísticas e eventos...
    await loadProfileStats(user);
    
    // Evento de upload de avatar
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file || file.size > 5*1024*1024) { showToast('Máx 5MB', 'error'); return; }
            const fileName = 'avatars/' + user.id + '/' + Date.now() + '.jpg';
            await db.storage.from('activity-photos').upload(fileName, file, { contentType: file.type, upsert: true });
            const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
            await db.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
            document.getElementById('avatarImg').src = urlData.publicUrl;
            showToast('Avatar atualizado!', 'success');
        };
        input.click();
    });
    
    // Evento do formulário de perfil
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        if (!name) { showToast('Nome obrigatório', 'error'); return; }
        await db.from('profiles').update({ name, pix_key: document.getElementById('editPixKey').value.trim() || null }).eq('id', user.id);
        document.getElementById('profileName').textContent = name;
        showToast('Salvo!', 'success');
    });
    
    // Evento do formulário de senha
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const curr = document.getElementById('currentPassword').value;
        const newPw = document.getElementById('newPassword').value;
        if (newPw.length < 6) { showToast('Mínimo 6 caracteres', 'error'); return; }
        const { error } = await db.auth.signInWithPassword({ email: user.email, password: curr });
        if (error) { showToast('Senha atual incorreta', 'error'); return; }
        await db.auth.updateUser({ password: newPw });
        showToast('Senha alterada!', 'success');
        document.getElementById('changePasswordForm').reset();
    });
}

// ============================================
// FUNÇÃO AUXILIAR - RENDERIZAR CALENDÁRIO COM MINIATURAS
// ============================================
function renderProfileCalendar(activitiesByDate) {
    const container = document.getElementById('profileCalendarContainer');
    if (!container) return;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstDay.getDay();
    
    // Agrupa atividades com timestamps próximos (< 5s de diferença = mesmo registro)
    const dedupedByDate = {};
    for (const [dateStr, acts] of Object.entries(activitiesByDate)) {
        const sorted = [...acts].sort((a, b) => {
            const ta = parseInt((a.photo_url.match(/(\d{13})/) || [0])[1]) || 0;
            const tb = parseInt((b.photo_url.match(/(\d{13})/) || [0])[1]) || 0;
            return ta - tb;
        });
        
        const merged = [];
        for (const a of sorted) {
            const ts = parseInt((a.photo_url.match(/(\d{13})/) || [0])[1]) || 0;
            let found = false;
            for (const m of merged) {
                const mts = parseInt((m.photo_url.match(/(\d{13})/) || [0])[1]) || 0;
                if (Math.abs(ts - mts) < 5000) {
                    if (!m.groups.includes(a.group_name)) m.groups.push(a.group_name);
                    if (!m.challenges.includes(a.challenge_name)) m.challenges.push(a.challenge_name);
                    found = true;
                    break;
                }
            }
            if (!found) {
                merged.push({
                    ...a,
                    groups: [a.group_name].filter(Boolean),
                    challenges: [a.challenge_name].filter(Boolean)
                });
            }
        }
        dedupedByDate[dateStr] = merged;
    }
    
    let html = '<div class="activity-calendar">';
    html += '<div class="calendar-header">';
    html += '<button class="calendar-nav" onclick="window.profilePrevMonth()"><i class="fas fa-chevron-left"></i></button>';
    html += '<h4>' + monthNames[month] + ' ' + year + '</h4>';
    html += '<button class="calendar-nav" onclick="window.profileNextMonth()"><i class="fas fa-chevron-right"></i></button>';
    html += '</div>';
    html += '<div class="calendar-weekdays"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>';
    html += '<div class="calendar-days">';
    
    for (let i = 0; i < startWeekday; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    const todayStr = getToday();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const acts = dedupedByDate[dateStr] || [];
        const hasActivity = acts.length > 0;
        const hasMultiple = acts.length > 1;
        const isToday = dateStr === todayStr;
        
        let dayClass = 'calendar-day';
        if (hasActivity) dayClass += ' has-activity';
        if (hasMultiple) dayClass += ' has-multiple';
        if (isToday) dayClass += ' today';
        
        html += '<div class="' + dayClass + '" data-date="' + dateStr + '" ' + (hasActivity ? 'onclick="showDayActivities(\'' + dateStr + '\')"' : '') + '>';
        html += '<div class="calendar-day-inner" style="width:100%;height:100%;position:relative;">';
        
        if (hasActivity) {
            html += '<img src="' + acts[0].photo_url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.style.display=\'none\'">';
            html += '<span style="position:absolute;top:2px;left:4px;font-size:0.7rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);z-index:1;">' + d + '</span>';
            if (hasMultiple) {
                html += '<span style="position:absolute;bottom:2px;right:2px;background:var(--secondary);color:#fff;width:18px;height:18px;border-radius:50%;font-size:0.55rem;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;">+' + (acts.length - 1) + '</span>';
            }
        } else {
            html += '<span class="day-number" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">' + d + '</span>';
        }
        
        html += '</div></div>';
    }
    
    html += '</div></div>';
    container.innerHTML = html;
    container.dataset.activities = JSON.stringify(dedupedByDate);
}

// Funções de navegação do mês no perfil
window.profilePrevMonth = function() { console.log('Mês anterior'); };
window.profileNextMonth = function() { console.log('Próximo mês'); };
// ============================================
// FUNÇÃO - MOSTRAR ATIVIDADES DO DIA (AGRUPADO POR FOTO)
// ============================================
function showDayActivities(dateStr) {
    const container = document.getElementById('profileCalendarContainer');
    if (!container) return;
    
    let activitiesByDate;
    try {
        activitiesByDate = JSON.parse(container.dataset.activities);
    } catch(e) { return; }
    
    const acts = activitiesByDate[dateStr] || [];
    if (acts.length === 0) return;
    
    // Agrupa atividades pela URL da foto (mesma foto em grupos diferentes = mesma atividade)
    const groupedByPhoto = {};
    acts.forEach(a => {
        const key = a.photo_url;
        if (!groupedByPhoto[key]) {
            groupedByPhoto[key] = {
                photo_url: a.photo_url,
                comment: a.comment,
                groups: [],
                challenges: []
            };
        }
        if (a.group_name && !groupedByPhoto[key].groups.includes(a.group_name)) {
            groupedByPhoto[key].groups.push(a.group_name);
        }
        if (a.challenge_name && !groupedByPhoto[key].challenges.includes(a.challenge_name)) {
            groupedByPhoto[key].challenges.push(a.challenge_name);
        }
        // Mantém o comentário mais completo
        if (a.comment && a.comment.length > (groupedByPhoto[key].comment || '').length) {
            groupedByPhoto[key].comment = a.comment;
        }
    });
    
    const uniqueActivities = Object.values(groupedByPhoto);
    
    const modal = document.getElementById('dayDetailModal');
    const title = document.getElementById('dayDetailTitle');
    const body = document.getElementById('dayDetailBody');
    if (!modal || !title || !body) return;
    
    const [y, m, d] = dateStr.split('-');
    title.textContent = '📅 ' + d + '/' + m + '/' + y;
    
    body.innerHTML = uniqueActivities.map(a => `
        <div class="day-detail-item">
            <img src="${a.photo_url}" class="day-detail-photo" onclick="window.open('${a.photo_url}')" alt="Foto" onerror="this.style.display='none'">
            <div class="day-detail-info">
                <div class="day-detail-name">
                    ${a.challenges.length > 0 ? a.challenges.map(c => '🎯 ' + escapeHtml(c)).join('<br>') : 'Atividade'}
                </div>
                <div class="day-detail-meta">
                    <span>👥 ${a.groups.map(g => escapeHtml(g)).join(', ')}</span>
                </div>
                ${a.comment ? '<p class="day-detail-comment">💬 ' + escapeHtml(a.comment) + '</p>' : ''}
            </div>
        </div>
    `).join('');
    
    modal.classList.add('open');
}

// Torna global
window.showDayActivities = showDayActivities;

// ============================================
// FUNÇÃO - CARREGAR ESTATÍSTICAS
// ============================================
async function loadProfileStats(user) {
    const { count: challenges } = await db.from('challenge_participants')
        .select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    document.getElementById('totalChallenges') && (document.getElementById('totalChallenges').textContent = challenges || 0);
    
    const { data: wins } = await db.from('challenge_winners')
        .select('*, challenges:challenge_id(name, groups:group_id(name))')
        .eq('user_id', user.id).order('declared_at', { ascending: false });
    document.getElementById('totalWins') && (document.getElementById('totalWins').textContent = wins?.length || 0);
    document.getElementById('totalEarnings') && (document.getElementById('totalEarnings').textContent = formatCurrency(wins?.reduce((s, w) => s + Number(w.prize_share), 0) || 0));
    
    const list = document.getElementById('winsList');
    if (list) {
        if (!wins?.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Nenhuma vitória ainda</p><small>Participe de desafios e ganhe prêmios!</small></div>';
        } else {
            list.innerHTML = wins.map(w => `
                <div class="win-item">
                    <div class="win-info">
                        <h4>${escapeHtml(w.challenges?.groups?.name || 'Grupo')}</h4>
                        <p>${escapeHtml(w.challenges?.name || 'Desafio')}</p>
                        <p class="text-muted" style="font-size:11px;"><i class="far fa-calendar-alt"></i> ${formatDate(w.declared_at)}</p>
                    </div>
                    <div class="win-value">${formatCurrency(w.prize_share)}</div>
                </div>
            `).join('');
        }
    }
}


// ============================================
// PÁGINA: home.html
// ============================================
if (window.location.pathname.includes('home')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await setupHome(session);
    });
}

async function setupHome(session) {
    const user = session.user;
    const profile = await getProfile(user.id);

    // 🔔 SOLICITAR PERMISSÃO DE NOTIFICAÇÃO
    if ('Notification' in window && Notification.permission === 'default') {
        // Mostra um toast informativo antes de pedir permissão
        showToast('🔔 Ative as notificações para receber atualizações!', 'info');
        
        setTimeout(async () => {
            const granted = await requestNotificationPermission();
            if (granted) {
                showToast('✅ Notificações ativadas!', 'success');
            }
        }, 2000);
    } else if (Notification.permission === 'granted') {
        // Já tem permissão, só inicializa
        initFirebaseMessaging();
    }
    
    document.getElementById('headerAvatarImg').src = profile?.avatar_url || 'perfil_padrao.png';
    document.getElementById('headerAvatar').addEventListener('click', () => window.location.href = 'profile.html');
    
    document.getElementById('sidebarAvatar').src = profile?.avatar_url || 'perfil_padrao.png';
    document.getElementById('sidebarName').textContent = profile?.name || 'Usuário';
    document.getElementById('sidebarEmail').textContent = profile?.email || user.email;
    
    setupSidebar();
    
        // Inicializa Firebase Messaging
    setTimeout(() => {
        initFirebaseMessaging().then(token => {
            if (token) {
                console.log('🔔 Notificações ativadas!');
            }
        });
    }, 2000);

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.href = 'index.html';
    });
    
    document.getElementById('createGroupSidebarBtn')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
        document.getElementById('createGroupModal').classList.add('open');
    });
    
    document.getElementById('createGroupForm')?.addEventListener('submit', createGroup);
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').classList.remove('open'));
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    });
    
    setupBottomNav();
    
    // Botão Registrar na bottom nav
    document.getElementById('btnRegisterNav')?.addEventListener('click', openRegisterModal);
    
    await loadSidebarGroups(user.id);
    
    const lastGroupId = localStorage.getItem('fatfit_last_group');
    if (lastGroupId) {
        const { data: group } = await db.from('groups').select('*').eq('id', lastGroupId).single();
        if (group) {
            const { data: membership } = await db.from('group_members').select('role').eq('group_id', group.id).eq('user_id', user.id).single();
            if (membership) {
                await selectGroup(group, membership.role);
                 await updateUnreadBadge();  // ← ADICIONE ESTA LINHA AQUI
                return;
            }
        }
    }
    
    document.getElementById('noGroupState').style.display = 'block';
    document.getElementById('bottomNav').style.display = 'none';

    document.getElementById('headerGroupName').textContent = 'FATFIT';
}





function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    document.getElementById('menuBtn')?.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    });
    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

function setupBottomNav() {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            const tabId = item.dataset.tab;
            document.getElementById(tabId)?.classList.add('active');
            
            if (tabId === 'tabDetalhes') loadDetalhes();
            if (tabId === 'tabRanking') loadRanking();
if (tabId === 'tabChat') {
                loadChat();
                // Força marcar como lido com delay para garantir
                setTimeout(() => {
                    markMessagesAsRead();
                }, 500);
            }
            toggleFAB();  
            // Atualiza badge ao trocar de aba
            if (tabId !== 'tabChat') {
                updateUnreadBadge();
            }
        });
    });
}



async function loadSidebarGroups(userId) {
    const container = document.getElementById('sidebarGroups');
    if (!container) return;
    const { data: memberships } = await db.from('group_members').select('group_id, groups:group_id(id, name)').eq('user_id', userId);
    if (!memberships || memberships.length === 0) {
        container.innerHTML = '<p class="text-xs text-muted" style="padding:8px 16px;">Nenhum grupo</p>';
        return;
    }
    container.innerHTML = '';
    for (const m of memberships) {
        const g = m.groups;
        if (!g) continue;
        const btn = document.createElement('button');
        btn.className = 'sidebar-group-item';
        if (currentGroup?.id === g.id) btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-circle" style="font-size:0.4rem;"></i> ' + escapeHtml(g.name);
        btn.addEventListener('click', async () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
            const { data: membership } = await db.from('group_members').select('role').eq('group_id', g.id).eq('user_id', userId).single();
            await selectGroup(g, membership?.role || 'member');
        });
        container.appendChild(btn);
    }
}








async function selectGroup(group, role) {
    currentGroup = group;
    currentUserRole = role;
    localStorage.setItem('fatfit_last_group', group.id);
    document.getElementById('headerGroupName').textContent = group.name;
    document.getElementById('noGroupState').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'flex';
    toggleFAB();
    document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="tabTimeline"]')?.classList.add('active');
    document.getElementById('tabTimeline')?.classList.add('active');
    const user = await getCurrentUser();
    await loadSidebarGroups(user.id);
    await loadTimeline();
        // Atualiza badge de mensagens não lidas
    await updateUnreadBadge();
}

async function loadTimeline() {
    const feed = document.getElementById('timelineFeed');
    if (!feed || !currentGroup) return;
    feed.innerHTML = '<div class="loading-state"><img src="logo.png" alt="Carregando" class="loading-mini-logo"><p>Carregando atividades...</p></div>';
    
    const { data: challengeIds } = await db.from('challenges').select('id').eq('group_id', currentGroup.id);
    if (!challengeIds || challengeIds.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhum desafio no grupo</p></div>';
        return;
    }
    
    const { data: activities } = await db.from('daily_activities')
        .select('*, profiles:user_id(name, avatar_url), challenges:challenge_id(name)')
        .in('challenge_id', challengeIds.map(c => c.id)).eq('status', 'valid')
        .order('created_at', { ascending: false }).limit(30);
    
    if (!activities || activities.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhuma atividade ainda</p></div>';
        return;
    }
    
    feed.innerHTML = '';
    const user = await getCurrentUser();
    
    for (const a of activities) {
        const isExtra = a.is_extra === true;
        const isVideo = a.photo_url && (a.photo_url.endsWith('.webm') || a.photo_url.includes('video'));
        
        const { count: likesCount } = await db.from('activity_likes').select('*', { count: 'exact', head: true }).eq('activity_id', a.id);
        const { data: userLiked } = await db.from('activity_likes').select('id').eq('activity_id', a.id).eq('user_id', user.id).maybeSingle();
        const { data: comments } = await db.from('activity_comments').select('*, profiles:user_id(name, avatar_url)').eq('activity_id', a.id).order('created_at', { ascending: true }).limit(10);
        
        let locationHtml = '';
        if (a.location && a.location.lat && a.location.lng) {
            locationHtml = '<div class="timeline-location-full" id="loc-' + a.id + '"><i class="fas fa-map-pin"></i><span>Carregando endereço...</span></div>';
        }
        
        // Mídia: vídeo ou foto
        let mediaHtml = '';
        if (isVideo) {
            mediaHtml = '<video src="' + a.photo_url + '" class="timeline-video" autoplay muted loop playsinline onerror="this.style.display=\'none\'"></video>';
        } else {
            mediaHtml = '<img src="' + a.photo_url + '" class="timeline-photo" onclick="window.open(\'' + a.photo_url + '\')" loading="lazy" onerror="this.style.display=\'none\'">';
        }
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = 
            '<div class="timeline-header">' +
            '<img src="' + (a.profiles?.avatar_url || 'perfil_padrao.png') + '" class="timeline-avatar">' +
            '<div class="timeline-user">' +
            '<div class="timeline-name">' + escapeHtml(a.profiles?.name || 'Usuário') + (isExtra ? ' <span class="badge badge-warning" style="font-size:0.6rem;">Extra</span>' : '') + '</div>' +
            '<div class="timeline-date">📅 ' + formatDate(a.activity_date) + ' • ' + escapeHtml(a.challenges?.name || 'Desafio') + (isVideo ? ' 🎥' : '') + '</div>' +
            '</div>' +
            (isExtra ? '<span class="badge badge-secondary" style="font-size:0.7rem;">+0</span>' : '<span class="badge badge-success" style="font-size:0.7rem;">+1 pt</span>') +
            '</div>' +
            mediaHtml +
            locationHtml +
            (a.comment ? '<div class="timeline-body">💬 ' + escapeHtml(a.comment) + '</div>' : '') +
            '<div class="timeline-actions-bar">' +
            '<button class="timeline-action-btn ' + (userLiked ? 'liked' : '') + '" onclick="toggleLike(\'' + a.id + '\', this)" data-activity="' + a.id + '">' +
            '<i class="' + (userLiked ? 'fas' : 'far') + ' fa-heart"></i> ' + (likesCount || 0) +
            '</button>' +
            '<button class="timeline-action-btn" onclick="focusComment(\'' + a.id + '\')">' +
            '<i class="far fa-comment"></i> ' + (comments?.length || 0) +
            '</button>' +
            '</div>';
        
        if (comments && comments.length > 0) {
            let commentsHtml = '<div class="timeline-comments-section">';
            for (const c of comments) {
                commentsHtml += '<div class="timeline-comment-item">' +
                    '<img src="' + (c.profiles?.avatar_url || 'perfil_padrao.png') + '" class="timeline-comment-avatar">' +
                    '<div class="timeline-comment-content">' +
                    '<span class="timeline-comment-author">' + escapeHtml(c.profiles?.name || 'Usuário') + '</span>' +
                    '<span class="timeline-comment-text">' + escapeHtml(c.comment) + '</span>' +
                    '<div class="timeline-comment-time">' + formatTime(c.created_at) + '</div>' +
                    '</div></div>';
            }
            commentsHtml += '</div>';
            item.innerHTML += commentsHtml;
        }
        
        item.innerHTML += '<div class="timeline-comment-input">' +
            '<input type="text" id="commentInput-' + a.id + '" placeholder="Adicione um comentário..." autocomplete="off">' +
            '<button onclick="addComment(\'' + a.id + '\')">Enviar</button>' +
            '</div>';
        
        feed.appendChild(item);
        
        if (a.location && a.location.lat && a.location.lng) {
            loadLocationAddress(a.id, a.location.lat, a.location.lng);
        }
    }
}
// ============================================
// CURTIR / DESCURTIR
// ============================================
async function toggleLike(activityId, btn) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: existing } = await db.from('activity_likes')
        .select('id').eq('activity_id', activityId).eq('user_id', user.id).maybeSingle();
    
    if (existing) {
        // Remove curtida
        await db.from('activity_likes').delete().eq('id', existing.id);
        btn.classList.remove('liked');
        btn.querySelector('i').className = 'far fa-heart';
    } else {
        // Adiciona curtida
        await db.from('activity_likes').insert({ activity_id: activityId, user_id: user.id });
        btn.classList.add('liked');
        btn.querySelector('i').className = 'fas fa-heart';
    }
    
    // Atualiza contagem
    const { count } = await db.from('activity_likes')
        .select('*', { count: 'exact', head: true }).eq('activity_id', activityId);
    btn.innerHTML = '<i class="' + (btn.classList.contains('liked') ? 'fas' : 'far') + ' fa-heart"></i> ' + (count || 0);
}

// ============================================
// COMENTAR
// ============================================
async function addComment(activityId) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const input = document.getElementById('commentInput-' + activityId);
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    const { data: newComment, error } = await db.from('activity_comments').insert({
        activity_id: activityId,
        user_id: user.id,
        comment: comment
    }).select('*, profiles:user_id(name, avatar_url)').single();
    
    if (error) {
        showToast('Erro ao comentar', 'error');
        return;
    }
    
    // Limpa o input
    input.value = '';
    
    // Encontra a seção de comentários desta atividade
    const activityItem = input.closest('.timeline-item');
    if (!activityItem) return;
    
    // Verifica se já existe a seção de comentários
    let commentsSection = activityItem.querySelector('.timeline-comments-section');
    
    if (!commentsSection) {
        // Cria a seção de comentários
        commentsSection = document.createElement('div');
        commentsSection.className = 'timeline-comments-section';
        
        // Insere após a barra de ações (antes do input de comentário)
        const actionsBar = activityItem.querySelector('.timeline-actions-bar');
        if (actionsBar) {
            actionsBar.insertAdjacentElement('afterend', commentsSection);
        }
    }
    
    // Adiciona o novo comentário
    const commentEl = document.createElement('div');
    commentEl.className = 'timeline-comment-item';
    commentEl.innerHTML = 
        '<img src="' + (newComment.profiles?.avatar_url || 'perfil_padrao.png') + '" class="timeline-comment-avatar">' +
        '<div class="timeline-comment-content">' +
        '<span class="timeline-comment-author">' + escapeHtml(newComment.profiles?.name || 'Usuário') + '</span>' +
        '<span class="timeline-comment-text">' + escapeHtml(newComment.comment) + '</span>' +
        '<div class="timeline-comment-time">Agora</div>' +
        '</div>';
    
    commentsSection.appendChild(commentEl);
    
    // Atualiza contagem de comentários na barra de ações
    const commentBtn = activityItem.querySelector('.timeline-action-btn[onclick*="focusComment"]');
    if (commentBtn) {
        const { count } = await db.from('activity_comments')
            .select('*', { count: 'exact', head: true }).eq('activity_id', activityId);
        commentBtn.innerHTML = '<i class="far fa-comment"></i> ' + (count || 0);
    }
    
    // Scroll suave para o novo comentário
    commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    showToast('Comentário adicionado!', 'success');
}

function focusComment(activityId) {
    const input = document.getElementById('commentInput-' + activityId);
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// LOCALIZAÇÃO (GEOCODIFICAÇÃO REVERSA)
// ============================================
async function loadLocationAddress(activityId, lat, lng) {
    const locEl = document.getElementById('loc-' + activityId);
    if (!locEl) return;
    
    try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1&accept-language=pt-BR');
        const data = await res.json();
        
        if (data?.display_name) {
            const addr = data.address || {};
            const parts = [];
            
            // Nome do local (ponto de interesse)
            if (data.name && data.name !== data.display_name.split(',')[0]) {
                parts.push('📍 <strong>' + data.name + '</strong>');
            }
            
            // Endereço
            const street = addr.road || addr.street || addr.pedestrian || '';
            const number = addr.house_number || '';
            const suburb = addr.suburb || addr.neighbourhood || '';
            const city = addr.city || addr.town || addr.municipality || '';
            const state = addr.state || '';
            
            if (street) parts.push(street + (number ? ', ' + number : ''));
            if (suburb && !parts.some(p => p.includes(suburb))) parts.push(suburb);
            if (city || state) parts.push(city + (city && state ? ', ' : '') + state);
            
            locEl.innerHTML = '<i class="fas fa-map-pin"></i><span>' + parts.join(' • ') + '</span>';
        } else {
            locEl.innerHTML = '<i class="fas fa-map-pin"></i><span>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</span>';
        }
    } catch (e) {
        locEl.innerHTML = '<i class="fas fa-map-pin"></i><span>📍 Localização registrada</span>';
    }
}

// ============================================
// FAB - ESCONDE NO CHAT
// ============================================
function toggleFAB() {
    // Não faz mais nada - FAB removido
}

// Funções globais
window.toggleLike = toggleLike;
window.addComment = addComment;
window.focusComment = focusComment;

async function loadDetalhes() {
    const container = document.getElementById('detalhesContent');
    if (!container || !currentGroup) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    const user = await getCurrentUser();
    const { data: members } = await db.from('group_members').select('*, profiles:user_id(name, avatar_url)').eq('group_id', currentGroup.id);
    const { data: activeChallenge } = await db.from('challenges').select('*').eq('group_id', currentGroup.id).in('status', ['pending', 'active']).maybeSingle();
    let isParticipant = false;
    if (activeChallenge) {
        const { data: cp } = await db.from('challenge_participants').select('*').eq('challenge_id', activeChallenge.id).eq('user_id', user.id).maybeSingle();
        isParticipant = !!cp;
    }
    const { data: pastChallenges } = await db.from('challenges').select('*').eq('group_id', currentGroup.id).eq('status', 'finished').order('end_date', { ascending: false });
    
    let html = '';
    html += '<div class="group-detail-card">';
    html += '<h3>📋 ' + escapeHtml(currentGroup.name) + '</h3>';
    html += '<p class="text-sm text-muted">' + escapeHtml(currentGroup.description || 'Sem descrição') + '</p>';
    html += '<div class="group-code">' + currentGroup.invite_code + '</div>';
    html += '<p class="text-sm"><i class="fas fa-users"></i> ' + (members?.length || 0) + '/' + currentGroup.max_members + ' membros</p>';
    html += '</div>';
    
    html += '<div class="group-detail-card"><h3>👥 Membros</h3><div>';
    if (members) {
        for (const m of members) {
            html += '<span class="member-chip"><img src="' + (m.profiles?.avatar_url || 'perfil_padrao.png') + '" alt="">' + escapeHtml(m.profiles?.name || 'Usuário') + (m.role === 'admin' ? ' <span class="badge badge-info">Admin</span>' : '') + '</span>';
        }
    }
    html += '</div></div>';
    
    if (activeChallenge) {
        html += '<div class="challenge-card-mini">';
        html += '<h3>🎯 ' + escapeHtml(activeChallenge.name || 'Desafio') + '</h3>';
        html += '<p>📅 ' + formatDate(activeChallenge.start_date) + ' → ' + formatDate(activeChallenge.end_date) + '</p>';
        html += '<p>💰 R$' + activeChallenge.amount_per_person + '/pessoa | Total: R$' + activeChallenge.total_prize + '</p>';
        html += '<p>' + escapeHtml(activeChallenge.description || '') + '</p>';
        html += '<span class="badge">' + (activeChallenge.status === 'active' ? 'Em andamento' : 'Aguardando') + '</span>';

        if (currentUserRole === 'admin') {
            html += '<button class="btn btn-outline btn-sm mt-2 edit-dates-btn" data-id="' + activeChallenge.id + '" data-start="' + activeChallenge.start_date + '" data-end="' + activeChallenge.end_date + '" style="width:100%;"><i class="fas fa-edit"></i> Alterar Datas</button>';
        }
        html += '</div>';
    } else if (currentUserRole === 'admin') {
        html += '<div class="group-detail-card"><h3>Criar Desafio</h3>';
        html += '<form id="createChallengeForm">';
        html += '<div class="input-group"><label>Nome</label><input type="text" id="challengeName" placeholder="Ex: Desafio de Verão"></div>';
        html += '<div class="input-group"><label>Data Início *</label><input type="date" id="challengeStartDate" required min="' + getToday() + '"></div>';
        html += '<div class="input-group"><label>Data Fim *</label><input type="date" id="challengeEndDate" required min="' + getToday() + '"></div>';
        html += '<div class="input-group"><label>Valor por Pessoa (R$) *</label><input type="number" id="challengeAmount" required min="0.01" step="0.01"></div>';
        html += '<div class="input-group"><label>Descrição</label><textarea id="challengeDescription" rows="2"></textarea></div>';
        html += '<button type="submit" class="btn btn-primary btn-block">Criar Desafio</button>';
        html += '</form></div>';
    }
    
    if (pastChallenges?.length > 0) {
        html += '<div class="group-detail-card"><h3>📜 Histórico</h3>';
        for (const c of pastChallenges) {
            const { data: winners } = await db.from('challenge_winners').select('*, profiles:user_id(name)').eq('challenge_id', c.id);
            html += '<div class="mb-1"><strong>' + escapeHtml(c.name || 'Desafio') + '</strong><br>';
            html += '<span class="text-sm">📅 ' + formatDate(c.start_date) + ' → ' + formatDate(c.end_date) + ' | 💰 ' + formatCurrency(c.total_prize) + '</span><br>';
            if (winners?.length > 0) {
                html += '<span class="text-sm">🏆 ' + winners.map(w => escapeHtml(w.profiles?.name || '') + ' (' + formatCurrency(w.prize_share) + ')').join(', ') + '</span>';
            }
            html += '</div>';
        }
        html += '</div>';
    }
    
    container.innerHTML = html;
    

    
    document.querySelectorAll('.edit-dates-btn').forEach(b => {
        b.addEventListener('click', async () => {
            const newStart = prompt('Nova data de início (AAAA-MM-DD):', b.dataset.start);
            if (!newStart) return;
            const newEnd = prompt('Nova data de fim (AAAA-MM-DD):', b.dataset.end);
            if (!newEnd) return;
            if (newEnd < newStart) { showToast('Data fim deve ser após data início', 'error'); return; }
            await db.from('challenges').update({ start_date: newStart, end_date: newEnd }).eq('id', b.dataset.id);
            showToast('Datas alteradas!', 'success');
            loadDetalhes();
        });
    });
    
    document.getElementById('createChallengeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('challengeName').value.trim() || 'Desafio';
        const start = document.getElementById('challengeStartDate').value;
        const end = document.getElementById('challengeEndDate').value;
        const amount = parseFloat(document.getElementById('challengeAmount').value);
        const desc = document.getElementById('challengeDescription').value.trim();
        if (!start || !end || end < start) { showToast('Datas inválidas', 'error'); return; }
        if (!amount || amount <= 0) { showToast('Valor inválido', 'error'); return; }
        const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', currentGroup.id);
        const { error } = await db.from('challenges').insert({ group_id: currentGroup.id, name, start_date: start, end_date: end, amount_per_person: amount, total_prize: amount * (count || 1), description: desc, status: 'pending' });
        if (error) { showToast('Erro: ' + error.message, 'error'); }
        else { showToast('Desafio criado!', 'success'); loadDetalhes(); }
    });
    
    const calendarSection = document.createElement('div');
    calendarSection.innerHTML = '<div class="group-detail-card mt-2"><h3>📅 Calendário do Grupo</h3><div id="groupCalendar"><div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div></div></div>';
    container.appendChild(calendarSection);
    await loadGroupCalendar();
}

async function loadRanking() {
    const container = document.getElementById('rankingContent');
    if (!container || !currentGroup) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    const user = await getCurrentUser();
    const { data: activeChallenge } = await db.from('challenges').select('*').eq('group_id', currentGroup.id).in('status', ['pending', 'active']).maybeSingle();
    if (!activeChallenge) { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Nenhum desafio ativo</p></div>'; return; }
        // Busca participantes E membros que não pontuaram ainda
    const { data: participants } = await db.from('challenge_participants')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('challenge_id', activeChallenge.id)
        .order('points', { ascending: false });
    
    // Se não tem participantes, busca todos os membros do grupo
    if (!participants || participants.length === 0) {
        const { data: members } = await db.from('group_members')
            .select('user_id, profiles:user_id(name, avatar_url)')
            .eq('group_id', currentGroup.id);
        
        if (members) {
            // Mostra membros com 0 pontos
            const { data: allParticipants } = await db.from('challenge_participants')
                .select('*, profiles:user_id(name, avatar_url)')
                .eq('challenge_id', activeChallenge.id)
                .order('points', { ascending: false });
        }
    }
    if (!participants || participants.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum participante ainda</p></div>'; return; }
    const maxPoints = Math.max(...participants.map(p => p.points), 1);
    let html = '<div class="ranking-header"><h3>🏆 ' + escapeHtml(activeChallenge.name || 'Desafio') + '</h3><p class="text-sm">📅 ' + formatDate(activeChallenge.start_date) + ' → ' + formatDate(activeChallenge.end_date) + '</p><p class="text-sm">💰 Prêmio total: ' + formatCurrency(activeChallenge.total_prize) + '</p></div><div class="ranking-list">';
    participants.forEach((p, i) => {
        const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const isMe = p.user_id === user.id;
        html += '<div class="ranking-item" style="' + (isMe ? 'border: 2px solid var(--primary);' : '') + '">';
        html += '<div class="ranking-pos ' + posClass + '">' + (i + 1) + '</div>';
        html += '<img src="' + (p.profiles?.avatar_url || 'perfil_padrao.png') + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer;" onclick="window.openPersonCalendar(\'' + p.user_id + '\', \'' + currentGroup.id + '\')">';
        html += '<div class="ranking-info" style="cursor:pointer;" onclick="window.openPersonCalendar(\'' + p.user_id + '\', \'' + currentGroup.id + '\')">';
        html += '<div class="ranking-name">' + escapeHtml(p.profiles?.name || 'Usuário') + ' ' + (isMe ? '(você)' : '') + '</div>';
        html += '<div class="ranking-bar"><div class="ranking-bar-fill" style="width:' + ((p.points / maxPoints) * 100) + '%"></div></div>';
        html += '</div><div class="ranking-points">' + p.points + ' pts</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

window.openPersonCalendar = function(userId, groupId) {
    window.location.href = 'person.html?user=' + userId + '&group=' + groupId;
};

async function loadChat() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer || !currentGroup) return;
    
    messagesContainer.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    const user = await getCurrentUser();
    
    // 🔴 FECHA TODOS OS CANAIS ABERTOS antes de criar novo
    if (chatSubscription) {
        console.log('🔌 Removendo canal antigo...');
        try {
            await db.removeChannel(chatSubscription);
        } catch(e) {
            console.log('Erro ao remover canal:', e);
        }
        chatSubscription = null;
    }
    
    // 🔴 Remove TODOS os canais do Supabase
    try {
        const channels = db.getChannels();
        console.log('📡 Canais ativos antes da limpeza:', channels.length);
        for (const ch of channels) {
            await db.removeChannel(ch);
        }
        console.log('✅ Todos os canais removidos');
    } catch(e) {
        console.log('Erro ao limpar canais:', e);
    }
    
    // Carrega mensagens existentes
    const { data: messages } = await db.from('messages')
        .select('*, profiles:user_id(name)')
        .eq('group_id', currentGroup.id)
        .order('created_at', { ascending: true })
        .limit(100);
    
    // Cria NOVO canal com nome único
    const channelName = 'chat-' + currentGroup.id + '-' + Date.now();
    console.log('📡 Criando novo canal:', channelName);
    
    chatSubscription = db.channel(channelName)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: 'group_id=eq.' + currentGroup.id 
        }, (payload) => {
            console.log('📩 Mensagem recebida via realtime:', payload.new.id);
            
            const isChatActive = document.getElementById('tabChat')?.classList.contains('active');
            
            if (isChatActive) {
                appendMessage(payload.new, user.id);
                markMessagesAsRead();
            } else {
                updateUnreadBadge();
            }
        })
        .subscribe((status) => {
            console.log('📡 Canal ' + channelName + ' status:', status);
        });
    
    // Renderiza mensagens
    messagesContainer.innerHTML = '';
    if (messages && messages.length > 0) {
        for (const msg of messages) {
            appendMessage(msg, user.id);
        }
    } else {
        messagesContainer.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="fas fa-comments"></i><p>Nenhuma mensagem ainda</p></div>';
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    await markMessagesAsRead();
    
    // Configura envio de mensagem com anti-duplo-clique
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        const newForm = chatForm.cloneNode(true);
        chatForm.parentNode.replaceChild(newForm, chatForm);
        
        let isSending = false;
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (isSending) {
                console.log('⏳ Envio em andamento, ignorando');
                return;
            }
            
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            if (!message) return;
            
            isSending = true;
            const submitBtn = newForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
            
            console.log('📤 Enviando mensagem para grupo:', currentGroup.id);
            
            const { error } = await db.from('messages').insert({ 
                group_id: currentGroup.id, 
                user_id: user.id, 
                message: message 
            });
            
            if (error) { 
                console.error('❌ Erro:', error);
                showToast('Erro ao enviar', 'error'); 
            } else { 
                console.log('✅ Enviada');
                input.value = '';
                input.focus();
            }
            
            setTimeout(() => {
                isSending = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                }
            }, 2000); // 2 segundos para garantir
        });
    }
}

function appendMessage(msg, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    const isMine = msg.user_id === currentUserId;
    const div = document.createElement('div');
    div.className = 'chat-message ' + (isMine ? 'mine' : 'other');
    div.innerHTML = (!isMine ? '<div class="chat-message-sender">' + escapeHtml(msg.profiles?.name || 'Usuário') + '</div>' : '') + '<div>' + escapeHtml(msg.message) + '</div><div class="chat-message-time">' + formatTime(msg.created_at) + '</div>';
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function createGroup(e) {
    e.preventDefault();
    const user = await getCurrentUser();
    const name = document.getElementById('groupName').value.trim();
    const desc = document.getElementById('groupDescription').value.trim();
    const max = parseInt(document.getElementById('groupMaxMembers').value);
    if (!name) { showToast('Nome obrigatório', 'error'); return; }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    const { data: group, error } = await db.from('groups').insert({ name, description: desc, max_members: max, creator_id: user.id, invite_code: code }).select().single();
    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
    await db.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'admin' });
    document.getElementById('createGroupModal').classList.remove('open');
    document.getElementById('createGroupForm').reset();
    showToast('Grupo criado! Código: ' + code, 'success');
    await loadSidebarGroups(user.id);
    await selectGroup(group, 'admin');
}

// ============================================
// FAB - REGISTRO
// ============================================

async function openRegisterModal() {
    const user = await getCurrentUser();
    if (!user) { showToast('Erro: faça login novamente', 'error'); return; }
    const { data: memberships } = await db.from('group_members').select('group_id, groups:group_id(id, name)').eq('user_id', user.id);
    if (!memberships || memberships.length === 0) { showToast('Você não está em nenhum grupo', 'warning'); return; }
    
    if (memberships.length === 1) {
        const groupId = memberships[0].group_id;
        const { data: challenge } = await db.from('challenges').select('id').eq('group_id', groupId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (challenge) { window.location.href = 'activity.html?challenge=' + challenge.id; }
        else { showToast('Crie um desafio primeiro', 'warning'); }
        return;
    }
    
    const modal = document.getElementById('registerSelectModal');
    const container = document.getElementById('groupsChecklist');
    if (!modal || !container) return;
    container.innerHTML = '';
    const today = getToday();
    
    for (const m of memberships) {
        const g = m.groups;
        if (!g) continue;
        const { data: challenge } = await db.from('challenges').select('id, name, status, start_date, end_date').eq('group_id', g.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const hasChallenge = !!challenge;
        const inPeriod = challenge && today >= challenge.start_date && today <= challenge.end_date;
        const willScore = hasChallenge && inPeriod;
        
        let isParticipant = false;
        if (challenge) { const { data: cp } = await db.from('challenge_participants').select('id').eq('challenge_id', challenge.id).eq('user_id', user.id).maybeSingle(); isParticipant = !!cp; }
        
        let statusBadge = '', scoreBadge = '';
        if (challenge) {
            if (willScore && isParticipant) { statusBadge = '✅ Pontuando'; scoreBadge = '+1 pt'; }
            else if (willScore && !isParticipant) { statusBadge = '⚠️ Participe para pontuar'; scoreBadge = '0 pt'; }
            else if (today < challenge.start_date) { statusBadge = '⏳ Não iniciou'; scoreBadge = 'Sem ponto'; }
            else { statusBadge = '📋 Encerrado'; scoreBadge = 'Sem ponto'; }
        }
        
        const itemId = g.id.replace(/-/g, '');
        container.innerHTML += '<div class="group-checkbox-item ' + (hasChallenge ? 'checked' : '') + '" id="check-' + itemId + '" onclick="window.toggleGroupCheck(\'' + itemId + '\', \'' + (challenge?.id || '') + '\', ' + (willScore && isParticipant) + ')" style="display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:8px;border:2px solid ' + (hasChallenge ? (willScore && isParticipant ? '#10B981' : '#4F46E5') : '#FEE2E2') + ';border-radius:10px;background:' + (hasChallenge ? '#fff' : '#FEF2F2') + ';cursor:' + (hasChallenge ? 'pointer' : 'default') + ';">' +
        '<div class="check-icon" style="width:24px;height:24px;border:2px solid ' + (hasChallenge ? '#4F46E5' : '#EF4444') + ';border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + (hasChallenge ? '#4F46E5' : 'transparent') + ';color:#fff;font-size:0.7rem;">' + (hasChallenge ? '✓' : '') + '</div>' +
        '<div style="flex:1;"><div style="font-weight:600;font-size:0.95rem;">' + escapeHtml(g.name) + '</div><div style="font-size:0.75rem;color:#6B7280;">' + (challenge ? '🎯 ' + escapeHtml(challenge.name) + ' <span style="font-size:0.65rem;">' + statusBadge + '</span>' : '⚠️ Nenhum desafio') + '</div></div>' +
        '<span style="font-size:0.7rem;padding:4px 8px;border-radius:12px;font-weight:600;background:' + (willScore && isParticipant ? '#D1FAE5' : '#F3F4F6') + ';color:' + (willScore && isParticipant ? '#065F46' : '#6B7280') + ';">' + scoreBadge + '</span>' +
        '<input type="checkbox" id="cb-' + itemId + '" value="' + g.id + '" data-challenge="' + (challenge?.id || '') + '" ' + (hasChallenge ? 'checked' : 'disabled') + ' style="display:none;"></div>';
    }
    
    const confirmBtn = document.getElementById('confirmRegisterBtn');
    if (confirmBtn) {
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#groupsChecklist input[type="checkbox"]:checked');
            const selected = [];
            checkboxes.forEach(cb => { if (cb.dataset.challenge) selected.push(cb.dataset.challenge); });
            if (selected.length === 0) { showToast('Selecione pelo menos um grupo', 'warning'); return; }
            localStorage.setItem('fatfit_register_challenges', JSON.stringify(selected));
            modal.classList.remove('open');
            window.location.href = selected.length === 1 ? 'activity.html?challenge=' + selected[0] : 'activity.html?challenges=' + selected.join(',');
        });
    }
    
    modal.querySelectorAll('.modal-close').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => modal.classList.remove('open'));
    });
    modal.classList.add('open');
}

window.toggleGroupCheck = function(elementId, challengeId, willScore) {
    const item = document.getElementById('check-' + elementId);
    const checkbox = document.getElementById('cb-' + elementId);
    const checkIcon = item?.querySelector('.check-icon');
    if (!item || !checkbox || checkbox.disabled) return;
    checkbox.checked = !checkbox.checked;
    if (checkbox.checked) {
        checkIcon.style.background = '#4F46E5'; checkIcon.style.color = '#fff'; checkIcon.innerHTML = '✓';
        item.style.borderColor = willScore ? '#10B981' : '#4F46E5'; item.style.background = '#fff'; item.classList.add('checked');
    } else {
        checkIcon.style.background = 'transparent'; checkIcon.style.color = '#4F46E5'; checkIcon.innerHTML = '';
        item.style.borderColor = '#D1D5DB'; item.style.background = '#FAFAFA'; item.classList.remove('checked');
    }
};

// ============================================
// PÁGINA: activity.html
// ============================================
if (window.location.pathname.includes('activity')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await setupActivity(session);
    });
}

let activityPhotoFile = null;
let activityLocationData = null;
let challengesWithStatus = [];

async function setupActivity(session) {
    const user = session.user;
    const params = new URLSearchParams(window.location.search);
    let challengeIds = [];
    if (params.get('challenges')) challengeIds = params.get('challenges').split(',').filter(Boolean);
    else if (params.get('challenge')) challengeIds = [params.get('challenge')];
    else { const stored = localStorage.getItem('fatfit_register_challenges'); if (stored) try { challengeIds = JSON.parse(stored); } catch(e) {} }
    
    if (challengeIds.length === 0) { showToast('Nenhum desafio selecionado', 'error'); setTimeout(() => location.replace('home.html'), 1500); return; }
    
    const challenges = [];
    for (const id of challengeIds) { const { data: c } = await db.from('challenges').select('*, groups:group_id(name)').eq('id', id).single(); if (c) challenges.push(c); }
    if (challenges.length === 0) { showToast('Nenhum desafio encontrado', 'error'); setTimeout(() => location.replace('home.html'), 1500); return; }
    
    const today = getToday();
    challengesWithStatus = [];
    for (const c of challenges) {
        const { data: todayActs } = await db.from('daily_activities').select('id, is_extra').eq('user_id', user.id).eq('challenge_id', c.id).eq('activity_date', today);
        const hasValidToday = todayActs?.some(a => !a.is_extra);
        const { data: cp } = await db.from('challenge_participants').select('id').eq('challenge_id', c.id).eq('user_id', user.id).maybeSingle();
        challengesWithStatus.push({ challenge: c, hasValidToday, isParticipant: !!cp });
    }
    
    const groupsDiv = document.getElementById('selectedGroups');
    if (groupsDiv) {
        groupsDiv.innerHTML = challengesWithStatus.map(cs => {
            const c = cs.challenge;
            const inPeriod = today >= c.start_date && today <= c.end_date;
            const willScore = c.status === 'active' && inPeriod && !cs.hasValidToday && cs.isParticipant;
            const isExtra = cs.hasValidToday;
            const notParticipant = !cs.isParticipant;
            return '<span class="badge ' + (willScore ? 'badge-success' : isExtra ? 'badge-warning' : notParticipant ? 'badge-info' : 'badge-secondary') + '" style="margin:3px;font-size:0.85rem;padding:6px 12px;">' + escapeHtml(c.groups?.name || 'Grupo') + ' - ' + escapeHtml(c.name || 'Desafio') + ' ' + (willScore ? '(+1 pt)' : isExtra ? '(extra)' : notParticipant ? '(não participante)' : '(sem ponto)') + '</span>';
        }).join('');
    }
    
    const scoringCount = challengesWithStatus.filter(cs => { const c = cs.challenge; return c.status === 'active' && today >= c.start_date && today <= c.end_date && !cs.hasValidToday && cs.isParticipant; }).length;
    const extraCount = challengesWithStatus.filter(cs => cs.hasValidToday).length;
    const infoText = 'Registrando em ' + challenges.length + ' grupo(s)' + (scoringCount > 0 ? ' • ' + scoringCount + ' pontuando' : '') + (extraCount > 0 ? ' • ' + extraCount + ' como extra' : '');
    document.getElementById('registerInfo') && (document.getElementById('registerInfo').textContent = infoText);
    document.getElementById('submitInfo') && (document.getElementById('submitInfo').textContent = extraCount > 0 ? 'Atividades extras não contabilizam pontos adicionais' : '');
    
    await startCameraFullscreen();
}

async function startCameraFullscreen() {
    const video = document.getElementById('cameraPreview');
    if (!video) return;
    
    stopCamera();
    
    try {
        console.log('🎥 Iniciando câmera (' + currentFacingMode + ')');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: isVideoMode // Habilita áudio só no modo vídeo
        });
        video.srcObject = stream;
        video.muted = true; // Evita eco
        await video.play();
        console.log('✅ Câmera iniciada');
    } catch (e) { 
        console.error('❌ Erro câmera:', e);
        showToast('Erro ao acessar câmera', 'error'); 
    }
    
    // Configura modo
    setupCameraMode();
    document.getElementById('flipCameraBtn')?.addEventListener('click', flipCamera);
}

let pressStartTime = 0;
let isLongPress = false;
let isVideoRecording = false;

function setupCameraMode() {
    const captureBtn = document.getElementById('captureBtn');
    if (!captureBtn) return;
    
    const newBtn = captureBtn.cloneNode(true);
    captureBtn.parentNode.replaceChild(newBtn, captureBtn);
    
    // Eventos de mouse
    newBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pressStartTime = Date.now();
        isLongPress = false;
        
        if (isVideoMode && !isVideoRecording) {
            // Modo vídeo: toggle gravação
            startVideoRecording();
        } else if (isVideoMode && isVideoRecording) {
            // Modo vídeo: para gravação
            stopVideoRecording();
        }
    });
    
    newBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        handleRelease();
    });
    
    newBtn.addEventListener('mouseleave', (e) => {
        if (isVideoRecording && !isVideoMode) {
            stopVideoRecording();
        }
    });
    
    // Eventos de toque
    newBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pressStartTime = Date.now();
        isLongPress = false;
        
        if (isVideoMode && !isVideoRecording) {
            startVideoRecording();
        } else if (isVideoMode && isVideoRecording) {
            stopVideoRecording();
        }
    });
    
    newBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleRelease();
    });
}

function handleRelease() {
    const pressDuration = Date.now() - pressStartTime;
    
    if (isVideoMode) {
        // Modo vídeo: já tratado no mousedown/touchstart
        return;
    }
    
    // Modo foto
    if (isVideoRecording) {
        // Estava gravando vídeo (segurou) - para
        stopVideoRecording();
    } else if (pressDuration < 300) {
        // Clique rápido = foto
        capturePhoto();
    } else {
        // Segurou > 300ms = começa vídeo
        startVideoRecording();
    }
}

function startVideoRecording() {
    const video = document.getElementById('cameraPreview');
    const stream = video?.srcObject;
    if (!stream || isVideoRecording) return;
    
    console.log('🔴 Iniciando gravação...');
    isVideoRecording = true;
    recordedChunks = [];
    recordingStartTime = Date.now();
    
    try {
        let mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
        }
        
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
            console.log('⏹️ Gravação finalizada');
            isVideoRecording = false;
            const blob = new Blob(recordedChunks, { type: mimeType });
            activityPhotoFile = new File([blob], 'video_' + Date.now() + '.webm', { type: mimeType });
            const url = URL.createObjectURL(blob);
            showVideoPreview(url);
        };
        
        mediaRecorder.start(100);
        showRecordingUI();
        
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopVideoRecording();
            }
        }, MAX_VIDEO_DURATION);
        
    } catch (e) {
        console.error('❌ Erro ao gravar:', e);
        showToast('Erro ao iniciar gravação', 'error');
        isVideoRecording = false;
    }
}

function stopVideoRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        hideRecordingUI();
    }
}

// NOVA FUNÇÃO - Iniciar gravação de vídeo
function startRecording() {
    const video = document.getElementById('cameraPreview');
    const stream = video?.srcObject;
    if (!stream) return;
    
    console.log('🔴 Iniciando gravação...');
    
    recordedChunks = [];
    recordingStartTime = Date.now();
    
    try {
        // Tenta formato MP4 primeiro, fallback para webm
        let mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
        }
        
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
            console.log('⏹️ Gravação finalizada');
            const blob = new Blob(recordedChunks, { type: mimeType });
            activityPhotoFile = new File([blob], 'video_' + Date.now() + '.webm', { type: mimeType });
            
            // Mostra preview do vídeo
            const url = URL.createObjectURL(blob);
            showVideoPreview(url);
        };
        
        mediaRecorder.start(100); // Coleta dados a cada 100ms
        
        // Timer e barra de progresso
        showRecordingUI();
        
        // Para automaticamente após 6 segundos
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopRecording();
            }
        }, MAX_VIDEO_DURATION);
        
    } catch (e) {
        console.error('❌ Erro ao gravar:', e);
        showToast('Erro ao iniciar gravação', 'error');
    }
}

// NOVA FUNÇÃO - Parar gravação
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        hideRecordingUI();
    }
}

// NOVA FUNÇÃO - Mostrar UI de gravação
function showRecordingUI() {
    const progressBar = document.createElement('div');
    progressBar.className = 'recording-progress';
    progressBar.id = 'recordingProgress';
    document.getElementById('cameraState')?.appendChild(progressBar);
    
    const timer = document.createElement('div');
    timer.className = 'recording-timer';
    timer.id = 'recordingTimer';
    timer.innerHTML = '<span class="recording-dot"></span> 0.0s';
    document.getElementById('cameraState')?.appendChild(timer);
    
    const captureBtn = document.getElementById('captureBtn');
    captureBtn?.classList.add('recording');
    
    // Muda o círculo interno para quadrado vermelho
    const ring = captureBtn?.querySelector('.capture-ring');
    if (ring) {
        ring.style.width = '28px';
        ring.style.height = '28px';
        ring.style.borderRadius = '4px';
        ring.style.background = '#FF3B30';
    }
    
    recordingTimer = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const seconds = Math.min(elapsed / 1000, 6).toFixed(1);
        const progress = Math.min((elapsed / MAX_VIDEO_DURATION) * 100, 100);
        
        const timerEl = document.getElementById('recordingTimer');
        const progressEl = document.getElementById('recordingProgress');
        
        if (timerEl) timerEl.innerHTML = '<span class="recording-dot"></span> ' + seconds + 's';
        if (progressEl) progressEl.style.width = progress + '%';
    }, 100);
}

// NOVA FUNÇÃO - Esconder UI de gravação
function hideRecordingUI() {
    clearInterval(recordingTimer);
    document.getElementById('recordingProgress')?.remove();
    document.getElementById('recordingTimer')?.remove();
    
    const captureBtn = document.getElementById('captureBtn');
    captureBtn?.classList.remove('recording');
    
    // Restaura o círculo branco
    const ring = captureBtn?.querySelector('.capture-ring');
    if (ring) {
        ring.style.width = '64px';
        ring.style.height = '64px';
        ring.style.borderRadius = '50%';
        ring.style.background = '#fff';
    }
}

// NOVA FUNÇÃO - Preview de vídeo
function showVideoPreview(url) {
    stopCamera();
    
    document.getElementById('cameraState').style.display = 'none';
    document.getElementById('previewState').style.display = 'flex';
    
    // Substitui img por video
    const previewContainer = document.getElementById('previewState');
    const existingImg = document.getElementById('photoPreview');
    const existingVideo = document.getElementById('videoPreview');
    
    if (existingVideo) existingVideo.remove();
    
    const videoEl = document.createElement('video');
    videoEl.id = 'videoPreview';
    videoEl.src = url;
    videoEl.controls = true;
    videoEl.autoplay = true;
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'contain';
    
    if (existingImg) existingImg.style.display = 'none';
    previewContainer.insertBefore(videoEl, previewContainer.querySelector('.preview-controls'));
    
    document.getElementById('retakeBtn')?.addEventListener('click', retakeMedia);
    document.getElementById('usePhotoBtn')?.addEventListener('click', useMedia);
}

// NOVA FUNÇÃO - Refazer mídia (foto ou vídeo)
function retakeMedia() {
    activityPhotoFile = null;
    recordedChunks = [];
    
    // Limpa preview
    const videoEl = document.getElementById('videoPreview');
    if (videoEl) {
        URL.revokeObjectURL(videoEl.src);
        videoEl.remove();
    }
    document.getElementById('photoPreview').style.display = 'block';
    
    document.getElementById('previewState').style.display = 'none';
    document.getElementById('cameraState').style.display = 'flex';
    startCameraFullscreen();
}

// NOVA FUNÇÃO - Usar mídia
function useMedia() {
    document.getElementById('previewState').style.display = 'none';
    document.getElementById('detailsState').style.display = 'block';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    
    // Mostra thumbnail
    if (activityPhotoFile) {
        if (activityPhotoFile.type.startsWith('video/')) {
            const thumb = document.getElementById('photoThumb');
            if (thumb) {
                thumb.style.display = 'none';
                // Cria thumbnail de vídeo
                const videoThumb = document.createElement('video');
                videoThumb.src = URL.createObjectURL(activityPhotoFile);
                videoThumb.muted = true;
                videoThumb.autoplay = true;
                videoThumb.loop = true;
                videoThumb.style.width = '140px';
                videoThumb.style.height = '140px';
                videoThumb.style.borderRadius = '20px';
                videoThumb.style.objectFit = 'cover';
                videoThumb.id = 'videoThumb';
                thumb.parentNode.insertBefore(videoThumb, thumb);
            }
        } else {
            document.getElementById('photoThumb').src = URL.createObjectURL(activityPhotoFile);
        }
    }
    
    setupLocationButtons();
    
    const form = document.getElementById('activityForm');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', submitActivity);
    }
}

// Modo foto/vídeo
document.getElementById('photoModeBtn')?.addEventListener('click', () => {
    isVideoMode = false;
    document.getElementById('photoModeBtn').classList.add('active');
    document.getElementById('videoModeBtn').classList.remove('active');
    startCameraFullscreen();
});

document.getElementById('videoModeBtn')?.addEventListener('click', () => {
    isVideoMode = true;
    document.getElementById('videoModeBtn').classList.add('active');
    document.getElementById('photoModeBtn').classList.remove('active');
    startCameraFullscreen();
});

// NOVA FUNÇÃO - Inverter câmera
function flipCamera() {
    console.log('🔄 Invertendo câmera...');
    
    // Alterna entre frontal e traseira
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    
    // Reinicia a câmera com o novo modo
    startCameraFullscreen();
    
    // Pequena animação no botão
    const btn = document.getElementById('flipCameraBtn');
    if (btn) {
        btn.style.transform = 'rotate(180deg)';
        setTimeout(() => { btn.style.transform = 'rotate(0deg)'; }, 300);
    }
}

function addCameraBackButton() {
    // O botão voltar já está no HTML, não precisa criar dinamicamente
    // Mas se quiser manter, pode deixar vazio
}

function stopCamera() {
    const video = document.getElementById('cameraPreview');
    if (video?.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
}

function capturePhoto() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('photoCanvas');
    if (!video?.videoWidth) return;
    const flash = document.createElement('div');
    flash.className = 'camera-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => { activityPhotoFile = new File([blob], 'act.jpg', { type: 'image/jpeg' }); }, 'image/jpeg', 0.85);
    showPreview(canvas.toDataURL('image/jpeg', 0.85));
}

function showPreview(dataUrl) {
    stopCamera();
    document.getElementById('cameraState').style.display = 'none';
    document.getElementById('previewState').style.display = 'flex';
    document.getElementById('photoPreview').src = dataUrl;
    document.getElementById('photoThumb').src = dataUrl;
    document.getElementById('retakeBtn')?.addEventListener('click', retakePhoto);
    document.getElementById('usePhotoBtn')?.addEventListener('click', usePhoto);
}

function retakePhoto() {
    activityPhotoFile = null;
    recordedChunks = [];
    
    const videoEl = document.getElementById('videoPreview');
    if (videoEl) {
        URL.revokeObjectURL(videoEl.src);
        videoEl.remove();
    }
    const photoEl = document.getElementById('photoPreview');
    if (photoEl) photoEl.style.display = 'block';
    
    document.getElementById('previewState').style.display = 'none';
    document.getElementById('cameraState').style.display = 'flex';
    startCameraFullscreen();
}

function usePhoto() {
    console.log('✅ Usar esta foto');
    
    document.getElementById('previewState').style.display = 'none';
    document.getElementById('detailsState').style.display = 'block';
    
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    
    // Configura botões de localização
    setupLocationButtons();
    
    // Configura envio
    const form = document.getElementById('activityForm');
    if (form) {
        // Remove listener antigo
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', submitActivity);
    }
}
function setupLocationButtons() {
    document.getElementById('getLocationBtn')?.addEventListener('click', captureLocation);
    document.getElementById('skipLocationBtn')?.addEventListener('click', () => {
        activityLocationData = null;
        document.getElementById('locationStatus').textContent = 'Ignorada';
        document.getElementById('locationStatus').style.color = 'var(--gray-500)';
        const addrDiv = document.getElementById('locationAddress');
        if (addrDiv) addrDiv.style.display = 'none';
    });
}

async function captureLocation() {
    if (!navigator.geolocation) { 
        showToast('Geolocalização não suportada', 'warning'); 
        return; 
    }
    
    const btn = document.getElementById('getLocationBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obtendo...';
    
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            activityLocationData = { 
                lat: pos.coords.latitude, 
                lng: pos.coords.longitude 
            };
            
            document.getElementById('locationStatus').textContent = '✓ Localização capturada';
            document.getElementById('locationStatus').style.color = 'var(--secondary)';
            
            // Geocodificação reversa
            await reverseGeocodeModern(pos.coords.latitude, pos.coords.longitude);
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Capturar';
        },
        (err) => {
            console.error('Erro localização:', err);
            showToast('Falha ao obter localização', 'warning');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Tentar novamente';
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// NOVA FUNÇÃO - Geocodificação reversa moderna
async function reverseGeocodeModern(lat, lng) {
    const addrDiv = document.getElementById('locationAddress');
    if (!addrDiv) return;
    
    addrDiv.style.display = 'flex';
    addrDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando endereço...';
    
    try {
        const res = await fetch(
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + 
            '&lon=' + lng + '&addressdetails=1&accept-language=pt-BR'
        );
        const data = await res.json();
        
        if (data?.display_name) {
            const addr = data.address || {};
            const parts = [];
            
            // Nome do local
            if (data.name && data.name !== data.display_name.split(',')[0]) {
                parts.push('<strong>' + data.name + '</strong>');
            }
            
            // Endereço
            const street = addr.road || addr.street || '';
            const number = addr.house_number || '';
            const suburb = addr.suburb || addr.neighbourhood || '';
            const city = addr.city || addr.town || addr.municipality || '';
            const state = addr.state || '';
            
            if (street) parts.push(street + (number ? ', ' + number : ''));
            if (suburb) parts.push(suburb);
            if (city || state) parts.push(city + (city && state ? ', ' : '') + state);
            
            let html = '<i class="fas fa-map-pin"></i><div>';
            html += parts.join('<br>');
            html += '<small>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</small>';
            html += '</div>';
            
            addrDiv.innerHTML = html;
            showToast('Localização capturada!', 'success');
        } else {
            addrDiv.innerHTML = '<i class="fas fa-map-marker-alt"></i><div>Endereço não encontrado<small>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</small></div>';
        }
    } catch (e) {
        addrDiv.innerHTML = '<i class="fas fa-map-marker-alt"></i><div>Endereço indisponível<small>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</small></div>';
    }
}

async function reverseGeocode(lat, lng) {
    const addrDiv = document.getElementById('locationAddress');
    if (!addrDiv) return;
    addrDiv.style.display = 'flex';
    addrDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando endereço...';
    try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1&accept-language=pt-BR');
        const data = await res.json();
        if (data?.display_name) {
            const a = data.address || {};
            const street = a.road || a.street || '';
            const number = a.house_number || '';
            const suburb = a.suburb || a.neighbourhood || '';
            const city = a.city || a.town || a.municipality || '';
            const state = a.state || '';
            let h = '<i class="fas fa-map-pin"></i><div>';
            if (street) h += '<strong>' + street + (number ? ', ' + number : '') + '</strong><br>';
            if (suburb) h += suburb + '<br>';
            if (city || state) h += city + (city && state ? ', ' : '') + state + '<br>';
            h += '<small>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</small></div>';
            addrDiv.innerHTML = h;
        } else {
            addrDiv.innerHTML = '<i class="fas fa-map-marker-alt"></i><div>Endereço não encontrado<br><small>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</small></div>';
        }
    } catch (e) {
        addrDiv.innerHTML = '<i class="fas fa-map-marker-alt"></i><div>Endereço indisponível<br><small>📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</small></div>';
    }
}

async function submitActivity(e) {
    e.preventDefault();
    if (!activityPhotoFile) { showToast('Tire uma foto ou grave um vídeo primeiro!', 'error'); return; }
    const user = await getCurrentUser();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    const comment = document.getElementById('activityComment')?.value?.trim() || null;
    const today = getToday();
    let successCount = 0, pointsEarned = 0, extraCount = 0;
    
    // Determina extensão do arquivo
    const isVideo = activityPhotoFile.type.startsWith('video/');
    const fileExt = isVideo ? 'webm' : 'jpg';
    const mimeType = isVideo ? 'video/webm' : 'image/jpeg';
    
    for (let i = 0; i < challengesWithStatus.length; i++) {
        const cs = challengesWithStatus[i];
        const isExtra = cs.hasValidToday;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando ' + (i + 1) + '/' + challengesWithStatus.length + '...';
        
        try {
            const fileName = user.id + '/' + cs.challenge.id + '/' + Date.now() + '_' + i + '.' + fileExt;
            const { error: upErr } = await db.storage.from('activity-photos').upload(fileName, activityPhotoFile, { contentType: mimeType, upsert: false });
            if (upErr) continue;
            const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
            const { error: actErr } = await db.from('daily_activities').insert({ user_id: user.id, challenge_id: cs.challenge.id, activity_date: today, photo_url: urlData.publicUrl, location: activityLocationData, comment, status: 'valid', is_extra: isExtra });
            if (actErr) continue;
            successCount++;
            if (!isExtra) pointsEarned++; else extraCount++;
        } catch (err) {}
    }
    
    localStorage.removeItem('fatfit_register_challenges');
    
    if (successCount > 0) {
        let msg = 'Registrado em ' + successCount + ' grupo(s)!';
        if (pointsEarned > 0) msg += ' 🎉 +' + pointsEarned + ' pontos';
        if (extraCount > 0) msg += ' (' + extraCount + ' extra)';
        showToast(msg, 'success');

                // 🔔 NOTIFICAÇÕES: Envia para cada grupo
        for (const cs of challengesWithStatus) {
            notifyGroupActivity(null, user.id, cs.challenge.group_id);
        }
        stopCamera();
        setTimeout(() => { window.location.href = 'home.html'; }, 2000);
    } 
    
    else {
        showToast('Erro ao registrar', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Funções auxiliares da activity page (fallback)
if (typeof skipLocation === 'undefined') {
    function skipLocation() {
        activityLocationData = null;
        document.getElementById('locationStatus').textContent = 'Localização ignorada';
        document.getElementById('locationStatus').style.color = 'var(--gray-500)';
        const addrDiv = document.getElementById('locationAddress');
        if (addrDiv) addrDiv.style.display = 'none';
    }
}

if (typeof window.goBackToCamera === 'undefined') {
    window.goBackToCamera = function() {
        activityPhotoFile = null;
        activityLocationData = null;
        document.getElementById('detailsState').style.display = 'none';
        document.getElementById('cameraState').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100%';
        startCameraFullscreen();
    };
}

// ============================================
// PÁGINA: search.html (MODERNA)
// ============================================
if (window.location.pathname.includes('search')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupSearchPage();
    });
}

let searchPage = 0;
let searchQuery = '';
const SEARCH_LIMIT = 10;

async function setupSearchPage() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    // Busca ao digitar (com delay)
    let searchTimeout;
    searchInput?.addEventListener('input', () => {
        clearBtn.style.display = searchInput.value ? 'flex' : 'none';
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = searchInput.value.trim();
            searchPage = 0;
            loadAllGroups(true);
        }, 400);
    });
    
    // Limpar busca
    clearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchQuery = '';
        searchPage = 0;
        loadAllGroups(true);
        searchInput.focus();
    });
    
    // Atualizar
    refreshBtn?.addEventListener('click', () => {
        searchPage = 0;
        loadAllGroups(true);
    });
    
    // Carregar mais
    loadMoreBtn?.addEventListener('click', () => {
        loadAllGroups(false);
    });
    
    // Carrega grupos iniciais
    await loadAllGroups(true);
}

async function loadAllGroups(reset = false) {
    const container = document.getElementById('groupsList');
    const emptyState = document.getElementById('emptyState');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const groupsCount = document.getElementById('groupsCount');
    
    if (!container) return;
    
    if (reset) {
        container.innerHTML = '<div class="loading-state"><img src="logo.png" alt="Carregando" class="loading-mini-logo"><p>Buscando grupos...</p></div>';
        emptyState.style.display = 'none';
        loadMoreContainer.style.display = 'none';
        searchPage = 0;
    }
    
    searchPage++;
    const from = (searchPage - 1) * SEARCH_LIMIT;
    const to = from + SEARCH_LIMIT - 1;
    
    // Busca grupos
    let query = db.from('groups').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (searchQuery) query = query.ilike('name', '%' + searchQuery + '%');
    
    const { data: groups, count, error } = await query;
    
    if (error) {
        container.innerHTML = '<div class="empty-state"><p>Erro ao carregar grupos</p></div>';
        return;
    }
    
    const totalCount = count || 0;
    groupsCount.textContent = totalCount + ' grupo(s) encontrado(s)';
    
    if (!groups || groups.length === 0) {
        if (reset) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        }
        loadMoreContainer.style.display = 'none';
        return;
    }
    
    if (reset) container.innerHTML = '';
    
    const user = await getCurrentUser();
    
    for (const g of groups) {
        const { count: memberCount } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        const { data: membership } = await db.from('group_members').select('*').eq('group_id', g.id).eq('user_id', user.id).maybeSingle();
        
        const card = document.createElement('div');
        card.className = 'group-card-modern';
        card.innerHTML = 
            '<div class="group-card-header">' +
            '<h3 class="group-card-title">' + escapeHtml(g.name) + '</h3>' +
            '</div>' +
            '<p class="group-card-description">' + escapeHtml(g.description || 'Sem descrição') + '</p>' +
            '<div class="group-card-footer">' +
            '<div class="group-card-stats">' +
            '<span><i class="fas fa-users"></i> ' + (memberCount || 0) + '/' + g.max_members + '</span>' +
            '<span><i class="fas fa-calendar"></i> ' + formatDate(g.created_at) + '</span>' +
            '</div>' +
            (membership ? 
                '<span class="badge-member"><i class="fas fa-check-circle"></i> Membro</span>' : 
                '<button class="btn-join" data-id="' + g.id + '"><i class="fas fa-door-open"></i> Entrar</button>'
            ) +
            '</div>';
        
        container.appendChild(card);
    }
    
    // Mostrar/ocultar botão "Carregar mais"
    const hasMore = totalCount > searchPage * SEARCH_LIMIT;
    loadMoreContainer.style.display = hasMore ? 'block' : 'none';
    
    // Eventos dos botões Entrar
    document.querySelectorAll('.btn-join').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const gId = btn.dataset.id;
            const { data: g } = await db.from('groups').select('*').eq('id', gId).single();
            const { count: currentCount } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', gId);
            
            if (currentCount >= g.max_members) {
                showToast('Grupo lotado!', 'error');
                return;
            }
            
            await db.from('group_members').insert({ group_id: gId, user_id: user.id, role: 'member' });
            showToast('✅ Entrou no grupo: ' + g.name, 'success');
            
            // Atualiza o card
            btn.outerHTML = '<span class="badge-member"><i class="fas fa-check-circle"></i> Membro</span>';
        });
    });
}


// ============================================
// PÁGINA: person.html
// ============================================
// ============================================
// PÁGINA: person.html (REDESIGN)
// ============================================
if (window.location.pathname.includes('person')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupPersonPage(session);
    });
}

async function setupPersonPage(session) {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    const groupId = params.get('group');
    
    if (!userId || !groupId) { 
        showToast('Parâmetros inválidos', 'error'); 
        setTimeout(() => history.back(), 1500); 
        return; 
    }
    
    const profile = await getProfile(userId);
    const { data: group } = await db.from('groups').select('name').eq('id', groupId).single();
    
    // Buscar atividades da pessoa
    const { data: activities } = await db.rpc('get_calendar_data', {
        p_user_id: userId,
        p_group_id: groupId,
        p_month: new Date().getMonth() + 1,
        p_year: new Date().getFullYear()
    });
    
    // Agrupar atividades por data
    const activitiesByDate = {};
    if (activities) {
        activities.forEach(act => {
            const date = act.activity_date;
            if (!activitiesByDate[date]) activitiesByDate[date] = [];
            activitiesByDate[date].push(act);
        });
    }
    
    // Estatísticas
    const uniqueDays = activities ? new Set(activities.map(a => a.activity_date)).size : 0;
    let maxStreak = 0;
    if (activities) {
        const dates = [...new Set(activities.map(a => a.activity_date))].sort();
        let currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
            const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
            if (diff === 1) currentStreak++;
            else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 1; }
        }
        maxStreak = Math.max(maxStreak, currentStreak);
    }
    
    let points = 0;
    const { data: activeChallenge } = await db.from('challenges')
        .select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle();
    if (activeChallenge) {
        const { data: p } = await db.from('challenge_participants')
            .select('points').eq('challenge_id', activeChallenge.id).eq('user_id', userId).maybeSingle();
        points = p?.points || 0;
    }
    
    // Renderizar HTML
    const container = document.getElementById('personContainer');
    if (container) {
        container.innerHTML = `
            <!-- Cabeçalho com capa -->
            <div class="profile-header">
                <div class="profile-avatar-container">
                    <div class="profile-avatar-wrapper">
                        <img src="${profile?.avatar_url || 'perfil_padrao.png'}" 
                             class="profile-avatar-img" alt="Avatar">
                    </div>
                </div>
            </div>
            
            <div class="profile-info">
                <h1 class="profile-name">${escapeHtml(profile?.name || 'Usuário')}</h1>
                <p class="profile-email">👥 ${escapeHtml(group?.name || 'Grupo')}</p>
            </div>
            
            <!-- Cards de estatísticas -->
            <div class="stats-grid">
                <div class="stat-card-modern">
                    <div class="stat-icon challenges"><i class="fas fa-star"></i></div>
                    <div class="stat-value">${points}</div>
                    <div class="stat-label">Pontos</div>
                </div>
                <div class="stat-card-modern">
                    <div class="stat-icon wins"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-value">${uniqueDays}</div>
                    <div class="stat-label">Dias Ativos</div>
                </div>
                <div class="stat-card-modern">
                    <div class="stat-icon earnings"><i class="fas fa-fire"></i></div>
                    <div class="stat-value">${maxStreak}</div>
                    <div class="stat-label">Sequência</div>
                </div>
            </div>
            
            <!-- Calendário -->
            <div class="profile-card">
                <div class="profile-card-title">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Calendário de Atividades</span>
                </div>
                <div id="personCalendarContainer">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando calendário...</p>
                    </div>
                </div>
            </div>
            
            <!-- Atividades Recentes - Timeline -->
            <div class="profile-card">
                <div class="profile-card-title">
                    <i class="fas fa-clock"></i>
                    <span>Atividades Recentes</span>
                </div>
                <div id="personRecentActivities">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Atualiza título
    document.getElementById('personPageTitle') && (document.getElementById('personPageTitle').textContent = profile?.name || 'Atividades');
    
    // Renderiza calendário
    renderPersonCalendar(activitiesByDate);
    
    // Renderiza atividades recentes
    renderPersonRecentActivities(activities);
}

// ============================================
// CALENDÁRIO DA PESSOA
// ============================================
function renderPersonCalendar(activitiesByDate) {
    const container = document.getElementById('personCalendarContainer');
    if (!container) return;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstDay.getDay();
    
    let html = '<div class="activity-calendar">';
    html += '<div class="calendar-header">';
    html += '<button class="calendar-nav" onclick="window.personPrevMonth()"><i class="fas fa-chevron-left"></i></button>';
    html += '<h4>' + monthNames[month] + ' ' + year + '</h4>';
    html += '<button class="calendar-nav" onclick="window.personNextMonth()"><i class="fas fa-chevron-right"></i></button>';
    html += '</div>';
    html += '<div class="calendar-weekdays"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>';
    html += '<div class="calendar-days">';
    
    for (let i = 0; i < startWeekday; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    const todayStr = getToday();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const acts = activitiesByDate[dateStr] || [];
        const hasActivity = acts.length > 0;
        const hasMultiple = acts.length > 1;
        const isToday = dateStr === todayStr;
        
        let dayClass = 'calendar-day';
        if (hasActivity) dayClass += ' has-activity';
        if (hasMultiple) dayClass += ' has-multiple';
        if (isToday) dayClass += ' today';
        
        html += '<div class="' + dayClass + '" data-date="' + dateStr + '" ' + (hasActivity ? 'onclick="window.showPersonDayActivities(\'' + dateStr + '\')"' : '') + '>';
        html += '<div class="calendar-day-inner" style="width:100%;height:100%;position:relative;">';
        
        if (hasActivity) {
            html += '<img src="' + acts[0].photo_url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.style.display=\'none\'">';
            html += '<span style="position:absolute;top:2px;left:4px;font-size:0.7rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);z-index:1;">' + d + '</span>';
            if (hasMultiple) {
                html += '<span style="position:absolute;bottom:2px;right:2px;background:var(--secondary);color:#fff;width:18px;height:18px;border-radius:50%;font-size:0.55rem;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;">+' + (acts.length - 1) + '</span>';
            }
        } else {
            html += '<span class="day-number" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">' + d + '</span>';
        }
        
        html += '</div></div>';
    }
    
    html += '</div></div>';
    container.innerHTML = html;
    container.dataset.activities = JSON.stringify(activitiesByDate);
}

// Navegação
window.personPrevMonth = function() { console.log('Mês anterior'); };
window.personNextMonth = function() { console.log('Próximo mês'); };

// Modal de detalhes do dia
window.showPersonDayActivities = function(dateStr) {
    const container = document.getElementById('personCalendarContainer');
    if (!container) return;
    
    let activitiesByDate;
    try { activitiesByDate = JSON.parse(container.dataset.activities); } catch(e) { return; }
    
    const acts = activitiesByDate[dateStr] || [];
    if (acts.length === 0) return;
    
    const modal = document.getElementById('dayDetailModal');
    const title = document.getElementById('dayDetailTitle');
    const body = document.getElementById('dayDetailBody');
    if (!modal || !title || !body) return;
    
    const [y, m, d] = dateStr.split('-');
    title.textContent = '📅 ' + d + '/' + m + '/' + y;
    
    body.innerHTML = acts.map(a => `
        <div class="day-detail-item">
            <img src="${a.photo_url}" class="day-detail-photo" onclick="window.open('${a.photo_url}')" alt="Foto" onerror="this.style.display='none'">
            <div class="day-detail-info">
                <div class="day-detail-name">🎯 ${escapeHtml(a.challenge_name || 'Desafio')}</div>
                ${a.comment ? '<p class="day-detail-comment">💬 ' + escapeHtml(a.comment) + '</p>' : ''}
                ${a.location ? '<span class="text-xs text-muted">📍 Localização registrada</span>' : ''}
            </div>
        </div>
    `).join('');
    
    modal.classList.add('open');
};

// ============================================
// ATIVIDADES RECENTES - TIMELINE MODERNA
// ============================================
function renderPersonRecentActivities(activities) {
    const container = document.getElementById('personRecentActivities');
    if (!container) return;
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro"></i><p>Nenhuma atividade ainda</p></div>';
        return;
    }
    
    // Pega as 15 mais recentes, ordenadas por data
    const recent = [...activities]
        .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date))
        .slice(0, 15);
    
    container.innerHTML = recent.map(a => `
        <div class="win-item" style="cursor:default;">
            <div class="win-info">
                <h4>📅 ${formatDate(a.activity_date)}</h4>
                <p>🎯 ${escapeHtml(a.challenge_name || 'Desafio')}</p>
                ${a.comment ? '<p style="font-size:0.8rem;color:#666;margin-top:4px;">💬 ' + escapeHtml(a.comment) + '</p>' : ''}
            </div>
            <img src="${a.photo_url}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;cursor:pointer;" onclick="window.open('${a.photo_url}')" onerror="this.style.display='none'">
        </div>
    `).join('');
}
// ============================================
// FUNÇÕES DE CALENDÁRIO
// ============================================

function renderCalendar(containerId, activities, month, year) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDayOfWeek = firstDay.getDay();
    const today = getToday();
    const [tYear, tMonth, tDay] = today.split('-').map(Number);
    
    const activitiesByDay = {};
    if (activities) for (const a of activities) {
        if (!a.activity_date) continue;
        const day = parseInt(a.activity_date.split('-')[2]);
        if (!activitiesByDay[day]) activitiesByDay[day] = [];
        activitiesByDay[day].push(a);
    }
    
    container.dataset.month = month;
    container.dataset.year = year;
    container.dataset.activities = JSON.stringify(activitiesByDay);
    container.dataset.containerId = containerId;
    
    let html = '<div class="calendar-container"><div class="calendar-header"><h3 class="calendar-title">' + monthNames[month - 1] + ' ' + year + '</h3><div class="calendar-nav"><button class="calendar-nav-btn" onclick="window.navigateCalendar(\'' + containerId + '\', -1)"><i class="fas fa-chevron-left"></i></button><button class="calendar-nav-btn" onclick="window.navigateCalendar(\'' + containerId + '\', 1)"><i class="fas fa-chevron-right"></i></button></div></div><div class="calendar-weekdays">' + weekDays.map(d => '<div class="calendar-weekday">' + d + '</div>').join('') + '</div><div class="calendar-grid">';
    
    for (let i = 0; i < startDayOfWeek; i++) html += '<div class="calendar-day other-month"></div>';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === tDay && month === tMonth && year === tYear;
        const dayActs = activitiesByDay[day] || [];
        const hasActivity = dayActs.length > 0;
        const dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        html += '<div class="calendar-day' + (isToday ? ' today' : '') + (hasActivity ? ' has-activity' : '') + '" data-date="' + dateStr + '"' + (hasActivity ? ' onclick="window.openDayDetail(\'' + dateStr + '\', \'' + containerId + '\')"' : '') + '><div class="calendar-day-inner"><span class="calendar-day-number">' + day + '</span>';
        if (hasActivity) {
            html += '<img src="' + dayActs[0].photo_url + '" class="calendar-day-photo" alt="Atividade" loading="lazy" onerror="this.style.display=\'none\'">';
            if (dayActs.length > 1) html += '<span class="calendar-day-badge">+' + (dayActs.length - 1) + '</span>';
        }
        html += '</div></div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
}

window.navigateCalendar = async function(containerId, direction) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let month = parseInt(container.dataset.month) + direction;
    let year = parseInt(container.dataset.year);
    if (month < 1) { month = 12; year--; }
    else if (month > 12) { month = 1; year++; }
    if (containerId === 'profileCalendar') await loadProfileCalendar(month, year);
    else if (containerId === 'personCalendar') { const params = new URLSearchParams(window.location.search); await loadPersonCalendar(params.get('user'), params.get('group'), month, year); }
    else if (containerId === 'groupCalendar') await loadGroupCalendar(month, year);
};

window.openDayDetail = function(dateStr, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let activitiesByDay;
    try { activitiesByDay = JSON.parse(container.dataset.activities); } catch(e) { return; }
    const dayActs = activitiesByDay[parseInt(dateStr.split('-')[2])] || [];
    if (dayActs.length === 0) return;
    const modal = document.getElementById('dayDetailModal');
    const title = document.getElementById('dayDetailTitle');
    const body = document.getElementById('dayDetailBody');
    if (!modal || !title || !body) return;
    const [y, m, d] = dateStr.split('-');
    title.textContent = '📅 ' + d + '/' + m + '/' + y;
    const sorted = [...dayActs].sort((a, b) => (a.is_extra ? 1 : 0) - (b.is_extra ? 1 : 0));
    body.innerHTML = sorted.map(a => '<div class="day-detail-item" style="' + (a.is_extra ? 'opacity:0.85;' : '') + '"><div style="position:relative;"><img src="' + a.photo_url + '" class="day-detail-photo" onclick="window.open(\'' + a.photo_url + '\')" alt="Foto" onerror="this.style.display=\'none\'">' + (a.is_extra ? '<span class="badge badge-warning" style="position:absolute;top:-4px;left:-4px;font-size:0.6rem;">Extra</span>' : '') + '</div><div class="day-detail-info"><div class="day-detail-name">' + escapeHtml(a.user_name || 'Usuário') + (a.is_extra ? ' <span class="badge badge-warning" style="margin-left:6px;font-size:0.65rem;">Extra</span>' : ' <span class="badge badge-success" style="margin-left:6px;font-size:0.65rem;">+1</span>') + '</div><div class="day-detail-meta"><span>👥 ' + escapeHtml(a.group_name || 'Grupo') + '</span><span>🎯 ' + escapeHtml(a.challenge_name || 'Desafio') + '</span></div>' + (a.comment ? '<p class="day-detail-comment">💬 ' + escapeHtml(a.comment) + '</p>' : '') + (a.location ? '<span class="text-xs text-muted">📍 Localização registrada</span>' : '') + '</div></div>').join('');
    modal.classList.add('open');
};

let currentProfileMonth = new Date().getMonth() + 1;
let currentProfileYear = new Date().getFullYear();
let currentPersonMonth = new Date().getMonth() + 1;
let currentPersonYear = new Date().getFullYear();
let currentGroupMonth = new Date().getMonth() + 1;
let currentGroupYear = new Date().getFullYear();

async function loadProfileCalendar(month, year) {
    const user = await getCurrentUser();
    if (!user) return;
    const container = document.getElementById('profileCalendar');
    if (!container) return;
    if (!month) { month = currentProfileMonth; year = currentProfileYear; }
    else { currentProfileMonth = month; currentProfileYear = year; }
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data: activities } = await db.rpc('get_calendar_data', { p_user_id: user.id, p_group_id: null, p_month: month, p_year: year });
    renderCalendar('profileCalendar', activities, month, year);
}

async function loadPersonCalendar(userId, groupId, month, year) {
    const container = document.getElementById('personCalendar');
    if (!container) return;
    if (!month) { month = currentPersonMonth; year = currentPersonYear; }
    else { currentPersonMonth = month; currentPersonYear = year; }
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data: activities } = await db.rpc('get_calendar_data', { p_user_id: userId, p_group_id: groupId, p_month: month, p_year: year });
    renderCalendar('personCalendar', activities, month, year);
}

async function loadGroupCalendar(month, year) {
    if (!currentGroup) return;
    const container = document.getElementById('groupCalendar');
    if (!container) return;
    if (!month) { month = currentGroupMonth; year = currentGroupYear; }
    else { currentGroupMonth = month; currentGroupYear = year; }
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data: activities } = await db.rpc('get_calendar_data', { p_user_id: null, p_group_id: currentGroup.id, p_month: month, p_year: year });
    renderCalendar('groupCalendar', activities, month, year);
}

// ============================================
// MENSAGENS NÃO LIDAS
// ============================================

async function updateUnreadBadge() {
    if (!currentGroup) return;
    
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data, error } = await db.rpc('get_unread_count', {
        p_user_id: user.id,
        p_group_id: currentGroup.id
    });
    
    console.log('🔴 updateUnreadBadge - Não lidas:', data, 'Erro:', error);
    
    const chatBtn = document.querySelector('[data-tab="tabChat"]');
    if (!chatBtn) return;
    
    // Remove badge existente
    const existingBadge = chatBtn.querySelector('.unread-badge');
    if (existingBadge) existingBadge.remove();
    
    const count = data || 0;
    
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'unread-badge';
        badge.textContent = count > 99 ? '99+' : count;
        chatBtn.appendChild(badge);
    }
}

async function markMessagesAsRead() {
    if (!currentGroup) return;
    
    const user = await getCurrentUser();
    if (!user) return;
    
    await db.rpc('mark_messages_read', {
        p_user_id: user.id,
        p_group_id: currentGroup.id
    });
    
    // Remove badge imediatamente
    const chatBtn = document.querySelector('[data-tab="tabChat"]');
    if (chatBtn) {
        const badge = chatBtn.querySelector('.unread-badge');
        if (badge) badge.remove();
    }
}


// ============================================
// FECHAR MODAL
// ============================================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('open')) {
        e.target.classList.remove('open');
    }
});

// ============================================
// PÁGINA: body.html - Avaliação Antropométrica v2
// ============================================
if (window.location.pathname.includes('body')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupBodyPage(session);
    });
}

// Coordenadas das regiões (imagem 758x1162)
const REGIONS = {
    braco_relaxado: { x1: 63, y1: 400, x2: 129, y2: 560 },
    braco_contraido: { x1: 580, y1: 340, x2: 634, y2: 484 },
    cintura: { x1: 158, y1: 570, x2: 550, y2: 590 },
    abdomen: { x1: 116, y1: 675, x2: 600, y2: 700 },
    quadril: { x1: 82, y1: 780, x2: 622, y2: 808 },
    perna_esquerda: { x1: 94, y1: 915, x2: 252, y2: 961 },
    perna_direita: { x1: 418, y1: 915, x2: 600, y2: 961 },
    panturrilha_esquerda: { x1: 106, y1: 1008, x2: 228, y2: 1045 },
    panturrilha_direita: { x1: 461, y1: 1008, x2: 583, y2: 1045 }
};

const DUAL_REGIONS = {
    perna_esquerda: ['perna_esquerda', 'perna_direita'],
    perna_direita: ['perna_esquerda', 'perna_direita'],
    panturrilha_esquerda: ['panturrilha_esquerda', 'panturrilha_direita'],
    panturrilha_direita: ['panturrilha_esquerda', 'panturrilha_direita']
};

let photoFiles = [null, null, null];
let editingId = null;

async function setupBodyPage(session) {
    document.getElementById('measurementDate').value = getToday();
    document.getElementById('weightKg')?.addEventListener('input', updateIMCPreview);
    document.getElementById('heightM')?.addEventListener('input', updateIMCPreview);
    document.getElementById('btnNewMeasurement')?.addEventListener('click', () => startNewMeasurement());
    document.getElementById('formBasic')?.addEventListener('submit', (e) => { e.preventDefault(); showStep('perimeters'); });
    document.getElementById('btnSaveMeasurement')?.addEventListener('click', saveMeasurement);
    setupMeasurementHighlights();
    await loadDashboard();
}

// ============================================
// NAVEGAÇÃO
// ============================================
function showStep(step) {
    ['dashboard', 'basic', 'perimeters', 'photos'].forEach(s => {
        const el = document.getElementById('step' + s.charAt(0).toUpperCase() + s.slice(1));
        if (el) el.style.display = 'none';
    });
    const el = document.getElementById('step' + step.charAt(0).toUpperCase() + step.slice(1));
    if (el) el.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startNewMeasurement() {
    editingId = null;
    document.getElementById('editId').value = '';
    document.getElementById('measurementDate').value = getToday();
    document.getElementById('weightKg').value = '';
    document.getElementById('heightM').value = '';
    document.getElementById('imcDisplay').style.display = 'none';
    // Limpa perímetros
    ['armRelaxed','armContracted','waist','abdomen','hip','thighLeft','thighRight','calfLeft','calfRight'].forEach(id => {
        document.getElementById(id).value = '';
    });
    // Limpa fotos
    photoFiles = [null, null, null];
    [1,2,3].forEach(i => {
        document.getElementById('photoPreview' + i).style.display = 'none';
        document.getElementById('photoInput' + i).value = '';
    });
    document.getElementById('btnSaveMeasurement').textContent = 'Salvar';
    showStep('basic');
}

// ============================================
// IMC
// ============================================
function updateIMCPreview() {
    const w = parseFloat(document.getElementById('weightKg').value);
    const h = parseFloat(document.getElementById('heightM').value);
    const display = document.getElementById('imcDisplay');
    if (w && h && h > 0) {
        const bmi = w / (h * h);
        display.style.display = 'block';
        document.getElementById('imcValue').textContent = bmi.toFixed(1);
        let cls = ''; let color = '';
        if (bmi < 18.5) { cls = 'Abaixo do peso'; color = '#F59E0B'; }
        else if (bmi < 25) { cls = 'Peso normal'; color = '#34C759'; }
        else if (bmi < 30) { cls = 'Sobrepeso'; color = '#F59E0B'; }
        else if (bmi < 35) { cls = 'Obesidade Grau I'; color = '#FF3B30'; }
        else if (bmi < 40) { cls = 'Obesidade Grau II'; color = '#FF3B30'; }
        else { cls = 'Obesidade Grau III'; color = '#FF3B30'; }
        document.getElementById('imcClassification').textContent = cls;
        document.getElementById('imcClassification').style.color = color;
    } else {
        display.style.display = 'none';
    }
}

// ============================================
// HIGHLIGHTS
// ============================================
function setupMeasurementHighlights() {
    document.querySelectorAll('#stepPerimeters input[data-region]').forEach(input => {
        input.addEventListener('focus', () => highlightRegion(input.dataset.region));
        input.addEventListener('blur', () => clearHighlights());
    });
}

function highlightRegion(name) {
    clearHighlights();
    const regions = DUAL_REGIONS[name] || [name];
    const overlay = document.getElementById('highlightOverlay');
    const img = document.getElementById('capybaraBody');
    if (!overlay || !img) return;
    const rect = img.getBoundingClientRect();
    const sx = rect.width / 758;
    const sy = rect.height / 1162;
    regions.forEach(r => {
        const reg = REGIONS[r];
        if (!reg) return;
        const div = document.createElement('div');
        div.className = 'highlight-region';
        div.style.left = (reg.x1 * sx) + 'px';
        div.style.top = (reg.y1 * sy) + 'px';
        div.style.width = ((reg.x2 - reg.x1) * sx) + 'px';
        div.style.height = ((reg.y2 - reg.y1) * sy) + 'px';
        overlay.appendChild(div);
    });
}

function clearHighlights() {
    const overlay = document.getElementById('highlightOverlay');
    if (overlay) overlay.innerHTML = '';
}

window.addEventListener('resize', () => {
    const active = document.querySelector('#stepPerimeters input:focus');
    if (active?.dataset.region) highlightRegion(active.dataset.region);
});

// ============================================
// FOTOS (Upload ou Câmera)
// ============================================
function previewPhoto(slot) {
    const input = document.getElementById('photoInput' + slot);
    const preview = document.getElementById('photoPreview' + slot);
    const file = input.files[0];
    if (!file) return;
    photoFiles[slot - 1] = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// ============================================
// SALVAR / EDITAR
// ============================================
async function saveMeasurement() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const btn = document.getElementById('btnSaveMeasurement');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    
    try {
        const date = document.getElementById('measurementDate').value || getToday();
        const weight = parseFloat(document.getElementById('weightKg').value);
        const height = parseFloat(document.getElementById('heightM').value);
        if (!weight || !height) { showToast('Peso e altura são obrigatórios', 'error'); btn.disabled = false; btn.innerHTML = 'Salvar'; return; }
        
        const getVal = (id) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; };
        
        // Upload fotos
        const photoUrls = [null, null, null];
        for (let i = 0; i < 3; i++) {
            if (photoFiles[i]) {
                const fileName = 'body_measurements/' + user.id + '/' + Date.now() + '_' + i + '.jpg';
                const { error: upErr } = await db.storage.from('activity-photos').upload(fileName, photoFiles[i], { contentType: 'image/jpeg', upsert: false });
                if (!upErr) {
                    const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
                    photoUrls[i] = urlData.publicUrl;
                }
            }
        }
        
        const data = {
            measurement_date: date,
            weight_kg: weight,
            height_m: height,
            arm_relaxed: getVal('armRelaxed'),
            arm_contracted: getVal('armContracted'),
            waist: getVal('waist'),
            abdomen: getVal('abdomen'),
            hip: getVal('hip'),
            thigh_left: getVal('thighLeft'),
            thigh_right: getVal('thighRight'),
            calf_left: getVal('calfLeft'),
            calf_right: getVal('calfRight'),
            photo_1: photoUrls[0],
            photo_2: photoUrls[1],
            photo_3: photoUrls[2]
        };
        
        let error;
        const editId = document.getElementById('editId').value;
        
        if (editId) {
            // Atualiza existente
            const { error: updateError } = await db.from('body_measurements').update(data).eq('id', editId);
            error = updateError;
        } else {
            // Insere novo
            const { error: insertError } = await db.from('body_measurements').insert({ ...data, user_id: user.id });
            error = insertError;
        }
        
        if (error) { showToast('Erro: ' + error.message, 'error'); btn.disabled = false; btn.innerHTML = 'Salvar'; return; }
        
        showToast(editId ? 'Avaliação atualizada!' : 'Avaliação salva!', 'success');
        photoFiles = [null, null, null];
        editingId = null;
        document.getElementById('editId').value = '';
        await loadDashboard();
        showStep('dashboard');
        
    } catch (err) {
        showToast('Erro ao salvar', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Salvar';
    }
}

// ============================================
// CARREGAR PARA EDIÇÃO
// ============================================
async function editMeasurement(id) {
    const { data: m } = await db.from('body_measurements').select('*').eq('id', id).single();
    if (!m) return;
    
    editingId = id;
    document.getElementById('editId').value = id;
    document.getElementById('measurementDate').value = m.measurement_date;
    document.getElementById('weightKg').value = m.weight_kg;
    document.getElementById('heightM').value = m.height_m;
    updateIMCPreview();
    
    // Preenche perímetros
    const fields = { armRelaxed: 'arm_relaxed', armContracted: 'arm_contracted', waist: 'waist', abdomen: 'abdomen', hip: 'hip', thighLeft: 'thigh_left', thighRight: 'thigh_right', calfLeft: 'calf_left', calfRight: 'calf_right' };
    for (const [inputId, dbField] of Object.entries(fields)) {
        document.getElementById(inputId).value = m[dbField] || '';
    }
    
    // Fotos existentes
    photoFiles = [null, null, null];
    [1,2,3].forEach(i => {
        const url = m['photo_' + i];
        const preview = document.getElementById('photoPreview' + i);
        if (url) {
            preview.src = url;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    });
    
    document.getElementById('btnSaveMeasurement').innerHTML = '<i class="fas fa-save"></i> Atualizar';
    showStep('basic');
}

// ============================================
// DASHBOARD (Apple Health Style)
// ============================================
// ============================================
// DASHBOARD (Apple Health Style)
// ============================================
async function loadDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: measurements } = await db.from('body_measurements')
        .select('*').eq('user_id', user.id).order('measurement_date', { ascending: false });
    
    if (!measurements || measurements.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:40px 20px;"><img src="logo.png" style="width:60px;height:60px;object-fit:contain;margin-bottom:12px;opacity:0.4;"><p style="color:#8E8E93;">Nenhuma avaliação ainda</p></div>';
        return;
    }
    
    const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    let html = '';
    
    for (let i = 0; i < measurements.length; i++) {
        const m = measurements[i];
        const prev = measurements[i + 1];
        const hasPrevious = i < measurements.length - 1;
        
        const d = new Date(m.measurement_date + 'T00:00:00');
        const day = d.getDate();
        const monthAbbr = months[d.getMonth()];
        const year = d.getFullYear();
        
        // Delta de peso
        let deltaHtml = '';
        if (prev && prev.weight_kg) {
            const diff = m.weight_kg - prev.weight_kg;
            if (Math.abs(diff) >= 0.05) {
                const isDown = diff < 0;
                deltaHtml = '<span class="' + (isDown ? 'delta-down' : 'delta-up') + '">' +
                    (isDown ? '↓' : '↑') + ' ' + Math.abs(diff).toFixed(1) + ' kg</span>';
            } else {
                deltaHtml = '<span class="delta-empty">--</span>';
            }
        } else {
            deltaHtml = '<span class="delta-empty">--</span>';
        }
        
        // Card individual
        html += '<div class="measurement-card" onclick="editMeasurement(\'' + m.id + '\')">';
        
        // Linha principal
        html += '<div class="measurement-card-row">';
        html += '<div class="measurement-date-col">';
        html += '<div class="measurement-date-day">' + day + ' ' + monthAbbr + '</div>';
        html += '<div class="measurement-date-year">' + year + '</div>';
        html += '</div>';
        html += '<div class="measurement-delta-col">' + deltaHtml + '</div>';
        html += '<div class="measurement-value-col">';
        html += '<span class="measurement-value-big">' + m.weight_kg + '</span> ';
        html += '<span class="measurement-value-unit">kg</span>';
        html += '</div>';
        html += '<div class="measurement-delete-col" onclick="event.stopPropagation();">';
        html += '<button class="btn-delete-mini" onclick="deleteMeasurement(\'' + m.id + '\')" title="Excluir">';
        html += '<i class="fas fa-trash"></i></button>';
        html += '</div>';
        html += '</div>'; // Fecha row
        
        // Botão Comparar dentro do card
        if (hasPrevious) {
            html += '<div class="measurement-compare-row" onclick="event.stopPropagation();">';
            html += '<button class="btn-compare-full" onclick="openCompareScreen(\'' + m.id + '\')">';
            html += '<i class="fas fa-balance-scale"></i> Comparar</button>';
            html += '</div>';
        }
        
        html += '</div>'; // Fecha card
    }
    
    container.innerHTML = html;
}


async function deleteMeasurement(id) {
    if (!confirm('Tem certeza que deseja excluir esta avaliação?\n\nEsta ação não pode ser desfeita.')) return;
    
    const { error } = await db.from('body_measurements').delete().eq('id', id);
    
    if (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
    } else {
        showToast('Avaliação excluída!', 'success');
        await loadDashboard();
    }
}

// Torna global
window.deleteMeasurement = deleteMeasurement;


// ============================================
// TELA DE COMPARATIVO
// ============================================
let allMeasurementsCache = [];

async function openCompareScreen(currentId) {
    console.log('🔍 openCompareScreen chamado com ID:', currentId);
    
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: measurements } = await db.from('body_measurements')
        .select('*').eq('user_id', user.id).order('measurement_date', { ascending: false });
    
    if (!measurements) {
        console.log('❌ Nenhuma avaliação encontrada');
        return;
    }
    
    allMeasurementsCache = measurements;
    console.log('📋 Avaliações carregadas:', measurements.length);
    
    const current = measurements.find(m => m.id === currentId);
    if (!current) {
        console.log('❌ Avaliação atual não encontrada');
        return;
    }
    console.log('📅 Avaliação atual:', current.measurement_date);
    
    const previousOnes = measurements.filter(m => 
        new Date(m.measurement_date) < new Date(current.measurement_date)
    );
    console.log('📋 Anteriores disponíveis:', previousOnes.length);
    
    if (previousOnes.length === 0) {
        showToast('Nenhuma avaliação anterior disponível', 'warning');
        return;
    }
    
    let options = '<option value="">Selecione uma avaliação anterior...</option>';
    for (const p of previousOnes) {
        options += '<option value="' + p.id + '">' + formatDate(p.measurement_date) + ' - ' + p.weight_kg + ' kg</option>';
    }
    
    const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    const cd = new Date(current.measurement_date + 'T00:00:00');
    const currentLabel = cd.getDate() + ' ' + months[cd.getMonth()] + ' ' + cd.getFullYear();
    
    const screenHTML = 
        '<div class="compare-screen" id="compareScreen">' +
        '<div class="compare-header">' +
        '<button class="body-back-btn" onclick="window.closeCompareScreen()"><i class="fas fa-chevron-left"></i></button>' +
        '<h2 class="compare-title">Comparar Avaliações</h2>' +
        '<div style="width:36px;"></div>' +
        '</div>' +
        '<div class="compare-body">' +
        '<div class="compare-select-card">' +
        '<div class="compare-select-label">Avaliação atual: ' + currentLabel + ' • ' + current.weight_kg + ' kg</div>' +
        '<select class="compare-select" id="compareSelect">' + options + '</select>' +
        '</div>' +
        '<div id="compareResultContainer"></div>' +
        '</div>' +
        '</div>';
    
    const existing = document.getElementById('compareScreen');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', screenHTML);
    document.body.style.overflow = 'hidden';
    
    console.log('✅ Tela de comparativo criada');
    
    // Evento do select - USANDO addEventListener
    const selectEl = document.getElementById('compareSelect');
    if (selectEl) {
        console.log('✅ Select encontrado, adicionando evento');
        selectEl.addEventListener('change', async function() {
            console.log('🔄 Select mudou para:', this.value);
            if (this.value) {
                await loadCompareData(currentId, this.value);
            } else {
                document.getElementById('compareResultContainer').innerHTML = '';
            }
        });
    } else {
        console.log('❌ Select NÃO encontrado!');
    }
}

window.closeCompareScreen = function() {
    console.log('🔙 Fechando comparativo');
    const screen = document.getElementById('compareScreen');
    if (screen) screen.remove();
    document.body.style.overflow = '';
};

window.openCompareScreen = openCompareScreen;

function closeCompareScreen() {
    const screen = document.getElementById('compareScreen');
    if (screen) screen.remove();
    document.body.style.overflow = '';
}



// Funções globais
window.openCompareScreen = openCompareScreen;
window.closeCompareScreen = closeCompareScreen;
window.loadCompareData = loadCompareData;

// Função global para edição
window.editMeasurement = editMeasurement;

// ============================================
// COMPARATIVO (mantido)
// ============================================
async function loadCompareData(currentId, previousId) {
    console.log('🚀 loadCompareData INICIADO:', currentId, previousId);
    
    if (!previousId) return;
    
    let container = document.getElementById('compareResultContainer');
    
    if (!container) {
        const screen = document.getElementById('compareScreen');
        if (screen) container = screen.querySelector('#compareResultContainer');
    }
    
    if (!container) return;
    
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Calculando...</p></div>';
    
    const user = await getCurrentUser();
    
    const current = allMeasurementsCache.find(m => m.id === currentId);
    const previous = allMeasurementsCache.find(m => m.id === previousId);
    
    console.log('📅 Atual:', current?.weight_kg, 'kg | Anterior:', previous?.weight_kg, 'kg');
    console.log('📸 Fotos atual:', [current?.photo_1, current?.photo_2, current?.photo_3].filter(p => p));
    console.log('📸 Fotos anterior:', [previous?.photo_1, previous?.photo_2, previous?.photo_3].filter(p => p));
    
    let html = '';
    
    // Tabela comparativa
    html += '<div class="compare-table-card"><table class="compare-table">';
    html += '<thead><tr><th>Medida</th><th>Atual</th><th>Anterior</th><th>Δ</th></tr></thead><tbody>';
    
    const fields = [
        { label: 'Peso (kg)', curr: current?.weight_kg, prev: previous?.weight_kg, unit: 'kg' },
        { label: 'IMC', curr: current?.bmi, prev: previous?.bmi, unit: '' },
        { label: 'Braço Relaxado (cm)', curr: current?.arm_relaxed, prev: previous?.arm_relaxed, unit: 'cm' },
        { label: 'Braço Contraído (cm)', curr: current?.arm_contracted, prev: previous?.arm_contracted, unit: 'cm' },
        { label: 'Cintura (cm)', curr: current?.waist, prev: previous?.waist, unit: 'cm' },
        { label: 'Abdômen (cm)', curr: current?.abdomen, prev: previous?.abdomen, unit: 'cm' },
        { label: 'Quadril (cm)', curr: current?.hip, prev: previous?.hip, unit: 'cm' },
        { label: 'Coxa Esquerda (cm)', curr: current?.thigh_left, prev: previous?.thigh_left, unit: 'cm' },
        { label: 'Coxa Direita (cm)', curr: current?.thigh_right, prev: previous?.thigh_right, unit: 'cm' },
        { label: 'Panturrilha Esq. (cm)', curr: current?.calf_left, prev: previous?.calf_left, unit: 'cm' },
        { label: 'Panturrilha Dir. (cm)', curr: current?.calf_right, prev: previous?.calf_right, unit: 'cm' }
    ];
    
    for (const f of fields) {
        if (f.curr === null && f.prev === null) continue;
        
        const diff = (f.curr || 0) - (f.prev || 0);
        let deltaClass = '';
        let arrow = '';
        if (diff > 0) { deltaClass = 'delta-negative'; arrow = ' ↑'; }
        else if (diff < 0) { deltaClass = 'delta-positive'; arrow = ' ↓'; }
        
        html += '<tr>' +
            '<td>' + f.label + '</td>' +
            '<td>' + (f.curr !== null ? f.curr : '-') + '</td>' +
            '<td>' + (f.prev !== null ? f.prev : '-') + '</td>' +
            '<td class="delta-col ' + deltaClass + '">' +
            (f.curr !== null && f.prev !== null ? (diff > 0 ? '+' : '') + diff.toFixed(1) + ' ' + f.unit + arrow : '-') +
            '</td></tr>';
    }
    
    html += '</tbody></table></div>';
    
    // FOTOS LADO A LADO
    const currentPhotos = [current?.photo_1, current?.photo_2, current?.photo_3].filter(p => p);
    const previousPhotos = [previous?.photo_1, previous?.photo_2, previous?.photo_3].filter(p => p);
    
    if (currentPhotos.length > 0 || previousPhotos.length > 0) {
        html += '<div class="compare-photos-card">';
        html += '<div class="compare-photos-title">📸 Comparativo de Fotos</div>';
        html += '<div class="compare-photos-grid">';
        
        // Foto anterior
        html += '<div class="compare-photo-item">';
        html += '<div class="compare-photo-label">📅 ' + formatDate(previous?.measurement_date) + '</div>';
        if (previousPhotos.length > 0) {
            html += '<img src="' + previousPhotos[0] + '" class="compare-photo-img" onclick="window.open(\'' + previousPhotos[0] + '\')" style="cursor:pointer;">';
        } else {
            html += '<div class="compare-photo-img" style="display:flex;align-items:center;justify-content:center;color:#C7C7CC;background:#F9FAFB;">Sem foto</div>';
        }
        html += '</div>';
        
        // Foto atual
        html += '<div class="compare-photo-item">';
        html += '<div class="compare-photo-label">📅 ' + formatDate(current?.measurement_date) + '</div>';
        if (currentPhotos.length > 0) {
            html += '<img src="' + currentPhotos[0] + '" class="compare-photo-img" onclick="window.open(\'' + currentPhotos[0] + '\')" style="cursor:pointer;">';
        } else {
            html += '<div class="compare-photo-img" style="display:flex;align-items:center;justify-content:center;color:#C7C7CC;background:#F9FAFB;">Sem foto</div>';
        }
        html += '</div>';
        
        html += '</div></div>';
    }
    
    console.log('✅ HTML gerado, inserindo...');
    container.innerHTML = html;
    console.log('✅ Pronto! Fotos:', currentPhotos.length, 'vs', previousPhotos.length);
}


// ============================================
// NOTIFICAÇÕES - ATIVIDADE PUBLICADA
// ============================================

// ============================================
// NOTIFICAÇÕES VIA SERVICE WORKER (SEM FCM)
// ============================================

async function notifyGroupActivity(activityId, userId, groupId) {
    try {
        const { data: profile } = await db.from('profiles').select('name').eq('id', userId).single();
        const { data: group } = await db.from('groups').select('name').eq('id', groupId).single();
        
        // Busca todos os membros do grupo
        const { data: members } = await db.from('group_members')
            .select('user_id')
            .eq('group_id', groupId)
            .neq('user_id', userId);
        
        if (!members || members.length === 0) return;
        
        const title = '🏋️ Nova Atividade!';
        const body = `${profile?.name || 'Alguém'} registrou uma atividade no grupo ${group?.name || ''}`;
        
        // Envia para cada membro via Supabase Realtime
        for (const m of members) {
            // Salva uma notificação no banco
            await db.from('notifications').insert({
                user_id: m.user_id,
                title: title,
                body: body,
                group_id: groupId,
                read: false
            });
        }
        
        // Se o Service Worker estiver ativo, tenta enviar push nativo
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, {
                body: body,
                icon: '/fatfitapp/logo.png',
                badge: '/fatfitapp/logo.png',
                vibrate: [200, 100, 200],
                data: { groupId: groupId }
            });
        }
        
        console.log('📩 Notificações salvas para', members.length, 'usuários');
    } catch (e) {
        console.error('Erro ao notificar:', e);
    }
}


async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Permissão concedida');
            const token = await initFirebaseMessaging();
            return !!token;
        } else {
            console.log('❌ Permissão negada:', permission);
            showToast('Notificações desativadas. Você pode ativar nas configurações.', 'warning');
            return false;
        }
    } catch (e) {
        console.error('Erro ao solicitar permissão:', e);
        return false;
    }
}