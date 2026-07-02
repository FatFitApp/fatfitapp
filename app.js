// ============================================
// FATFIT - Aplicação Principal v2.0
// ============================================

const db = window.db;



// DETECÇÃO DE VERSÃO - Força update de cache
// ============================================
const APP_VERSION = '1.0.6';


(function checkVersion() {
    const storedVersion = localStorage.getItem('fatfit_version');
    
    if (storedVersion !== APP_VERSION) {
        console.log('🔄 Nova versão detectada! Limpando cache...');
        localStorage.setItem('fatfit_version', APP_VERSION);
        
        // Limpa todos os caches
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => caches.delete(key));
                console.log('✅ Cache limpo:', keys.length, 'entradas');
            });
        }
        
        // Força reload limpo
        setTimeout(() => {
            window.location.reload(true);
        }, 500);
    }
})();


let currentGroup = null;
let currentUserRole = null;
let chatSubscription = null;
let currentFacingMode = 'environment'; // 'environment' = traseira, 'user' = frontal


let isVideoMode = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let currentStoryGroup = null;
let currentStoryUser = null;
let currentStoryIndex = 0;
let currentStories = [];
let storyProgressTimer = null;


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
        // Mostra tela de redefinição (mantém o token na URL)
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

    

    // Redefinir senha
    document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('resetPassword').value;
        
        if (newPassword.length < 6) {
            showToast('A senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }
        
        try {
            // Pega o token do hash da URL
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            
            if (accessToken) {
                // Cria sessão com o token
                await db.auth.setSession({
                    access_token: accessToken,
                    refresh_token: hashParams.get('refresh_token') || ''
                });
            }
            
            // Agora atualiza a senha
            const { error } = await db.auth.updateUser({ password: newPassword });
            
            if (error) {
                if (error.message.includes('expired')) {
                    showToast('Link expirado. Solicite um novo.', 'error');
                } else {
                    showToast('Erro: ' + error.message, 'error');
                }
            } else {
                showToast('✅ Senha redefinida com sucesso! Faça login.', 'success');
                window.location.hash = '';
                setTimeout(() => showForm('loginForm'), 2000);
            }
        } catch (err) {
            showToast('Erro ao redefinir: ' + err.message, 'error');
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
    
    // Agrupar atividades por data
    const activitiesByDate = {};
    if (activities) {
        activities.forEach(act => {
            const date = act.activity_date;
            if (!activitiesByDate[date]) {
                activitiesByDate[date] = [];
            }
            activitiesByDate[date].push({
                id: act.activity_id || act.id,
                photo_url: act.photo_url,
                comment: act.comment,
                user_name: act.user_name,
                group_name: act.group_name,
                challenge_name: act.challenge_name,
                is_extra: act.is_extra
            });
        });
    }
    
    // Criar estrutura HTML moderna com gamificação e calendário
    const container = document.querySelector('.profile-container');
    if (container) {
        // Renderiza o card de gamificação
        const gamificationCard = await renderGamificationCard(user.id);
        
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
            
            <!-- GAMIFICAÇÃO CARD -->
            ${gamificationCard}
            
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
                        <span>1 atividade</span>
                    </div>
                    <div class="calendar-legend-item">
                        <div class="calendar-legend-dot" style="background: #10b981;"></div>
                        <span>Múltiplas</span>
                    </div>
                </div>
            </div>
            
            <!-- Botão Compartilhar -->
            <button class="btn-share-progress" onclick="shareProgress()">
                <i class="fas fa-share-alt"></i> Compartilhar Progresso
            </button>
            
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
    
    // Renderiza o calendário
    renderProfileCalendar(activitiesByDate);
    
    // Carrega estatísticas
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
            const ta = parseInt((a.photo_url?.match(/(\d{13})/) || [0])[1]) || 0;
            const tb = parseInt((b.photo_url?.match(/(\d{13})/) || [0])[1]) || 0;
            return ta - tb;
        });
        
        const merged = [];
        for (const a of sorted) {
            const ts = parseInt((a.photo_url?.match(/(\d{13})/) || [0])[1]) || 0;
            let found = false;
            for (const m of merged) {
                const mts = parseInt((m.photo_url?.match(/(\d{13})/) || [0])[1]) || 0;
                if (Math.abs(ts - mts) < 5000) {
                    if (!m.groups) m.groups = [];
                    if (!m.challenges) m.challenges = [];
                    if (a.group_name && !m.groups.includes(a.group_name)) m.groups.push(a.group_name);
                    if (a.challenge_name && !m.challenges.includes(a.challenge_name)) m.challenges.push(a.challenge_name);
                    found = true;
                    break;
                }
            }
            if (!found) {
                merged.push({
                    id: a.id,  // ← ID preservado
                    photo_url: a.photo_url,
                    comment: a.comment,
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
    
    // Agrupa atividades pela URL da foto
    const groupedByPhoto = {};
    acts.forEach(a => {
        const key = a.photo_url;
        if (!groupedByPhoto[key]) {
            groupedByPhoto[key] = {
                id: a.id,
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
                <div style="margin-top:8px;display:flex;gap:8px;">
                    <button class="btn btn-outline btn-sm" onclick="window.editActivityComment('${a.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteActivity('${a.id}')">
                        <i class="fas fa-trash"></i> Apagar
                    </button>
                </div>
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
    
    // Atualiza sidebar
    document.getElementById('sidebarAvatar').src = profile?.avatar_url || 'perfil_padrao.png';
    document.getElementById('sidebarName').textContent = profile?.name || 'Usuário';
    document.getElementById('sidebarEmail').textContent = profile?.email || user.email;
    
    // Menu lateral
    setupSidebar();
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.href = 'index.html';
    });
    
    // Criar grupo (sidebar)
    document.getElementById('createGroupSidebarBtn')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
        document.getElementById('createGroupModal').classList.add('open');
    });
    
    document.getElementById('createGroupForm')?.addEventListener('submit', createGroup);
    
    // Fechar modal
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').classList.remove('open'));
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    });
    
    // Bottom navigation
    setupBottomNav();
    
    // Botão Registrar na bottom nav
    setTimeout(() => {
        const btnRegister = document.getElementById('btnRegisterNav');
        if (btnRegister) {
            btnRegister.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openRegisterModal();
            });
        }
    }, 500);
    
    // Renderiza level no header
    await renderLevelBar();
    
    // 🔗 VERIFICA SE VEIO DE LINK DE CONVITE
    const inviteCode = new URLSearchParams(window.location.search).get('invite');
    if (inviteCode) {
        const { data: group } = await db.from('groups').select('*').eq('invite_code', inviteCode).single();
        if (group) {
            const { data: existing } = await db.from('group_members')
                .select('status').eq('group_id', group.id).eq('user_id', user.id).maybeSingle();
            
            if (!existing) {
                await db.from('group_members').insert({
                    group_id: group.id,
                    user_id: user.id,
                    role: 'member',
                    status: 'approved'
                });
                showToast('✅ Você entrou no grupo ' + group.name + '!', 'success');
            }
            
            const { data: membership } = await db.from('group_members')
                .select('role').eq('group_id', group.id).eq('user_id', user.id).single();
            if (membership && membership.status !== 'rejected') {
                await selectGroup(group, membership.role);
                return;
            }
        }
    }
    
    // Solicitar permissão de notificação
    if ('Notification' in window && Notification.permission === 'default') {
        showToast('🔔 Ative as notificações para receber atualizações!', 'info');
        setTimeout(async () => {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                showToast('✅ Notificações ativadas!', 'success');
            }
        }, 2000);
    }
    
    // Carrega grupos no menu lateral
    await loadSidebarGroups(user.id);
    
    // Tenta carregar último grupo acessado
    const lastGroupId = localStorage.getItem('fatfit_last_group');
    if (lastGroupId) {
        const { data: group } = await db.from('groups').select('*').eq('id', lastGroupId).single();
        
        if (group) {
            const { data: membership } = await db.from('group_members')
                .select('role, status')
                .eq('group_id', group.id)
                .eq('user_id', user.id)
                .maybeSingle();
            
            if (membership && membership.status === 'approved') {
                await selectGroup(group, membership.role);
                return;
            }
        }
    }
    
    // Se não tem grupo, mostra estado vazio
    document.getElementById('noGroupState').style.display = 'block';
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('headerGroupName').textContent = 'FATFIT';
    await renderLevelBar();
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
                setTimeout(() => markMessagesAsRead(), 500);
            }
            
            if (tabId !== 'tabChat') {
                updateUnreadBadge();
            }
        });
    });
}


async function loadSidebarGroups(userId) {
    const container = document.getElementById('sidebarGroups');
    if (!container) return;
    
    const { data: memberships, error } = await db.from('group_members')
        .select('group_id, role')
        .eq('user_id', userId)
        .eq('status', 'approved');
    
    if (error || !memberships || memberships.length === 0) {
        container.innerHTML = '<p class="text-xs text-muted" style="padding:8px 16px;">Nenhum grupo</p>';
        return;
    }
    
    container.innerHTML = '';
    
    for (const m of memberships) {
        const { data: group } = await db.from('groups')
            .select('id, name')
            .eq('id', m.group_id)
            .single();
        
        if (!group) continue;
        
        const btn = document.createElement('button');
        btn.className = 'sidebar-group-item';
        if (currentGroup?.id === group.id) btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-circle" style="font-size:0.4rem;"></i> ' + escapeHtml(group.name);
        btn.addEventListener('click', async () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
            const { data: membership } = await db.from('group_members')
                .select('role')
                .eq('group_id', group.id)
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();
            
            if (membership) {
                await selectGroup(group, membership.role);
            }
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
    
    // Carrega stories imediatamente
    renderStoriesBar();
    await renderLevelBar();
    
    // Força limpeza imediata da timeline
    const feed = document.getElementById('timelineFeed');
    if (feed) {
        feed.innerHTML = '<div class="loading-state"><img src="logo.png" alt="Carregando" class="loading-mini-logo"><p>Carregando atividades...</p></div>';
    }
    
    // Limpa detalhes e ranking também
    const detalhesContent = document.getElementById('detalhesContent');
    if (detalhesContent) detalhesContent.innerHTML = '';
    const rankingContent = document.getElementById('rankingContent');
    if (rankingContent) rankingContent.innerHTML = '';
    
    // Ativa timeline por padrão
    document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const timelineTab = document.querySelector('[data-tab="tabTimeline"]');
    const timelineContent = document.getElementById('tabTimeline');
    if (timelineTab) timelineTab.classList.add('active');
    if (timelineContent) timelineContent.classList.add('active');
    
    // Atualiza sidebar
    const user = await getCurrentUser();
    await loadSidebarGroups(user.id);
    
    // Carrega timeline apenas UMA VEZ
    setTimeout(async () => {
        await loadTimeline();
        await updateUnreadBadge();
    }, 100);
}
async function loadTimeline() {
    const feed = document.getElementById('timelineFeed');
    if (!feed || !currentGroup) return;
    
    const loadingGroupId = currentGroup.id;
    
    feed.innerHTML = '<div class="loading-state"><img src="logo.png" alt="Carregando" class="loading-mini-logo"><p>Carregando atividades...</p></div>';
    
    // Renderiza a barra de level e stories primeiro
    await renderLevelBar();
    
    const { data: challengeIds } = await db.from('challenges').select('id').eq('group_id', loadingGroupId);
    if (!challengeIds || challengeIds.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhum desafio no grupo</p></div>';
        return;
    }
    
    const { data: activities } = await db.from('daily_activities')
        .select('*, profiles:user_id(name, avatar_url, user_level), challenges:challenge_id(name)')
        .in('challenge_id', challengeIds.map(c => c.id)).eq('status', 'valid')
        .order('created_at', { ascending: false }).limit(30);
    
    if (currentGroup.id !== loadingGroupId) {
        console.log('⚠️ Grupo mudou durante carregamento, ignorando...');
        return;
    }
    
    if (!activities || activities.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhuma atividade ainda</p></div>';
        return;
    }
    
    feed.innerHTML = '';
    const user = await getCurrentUser();
    
    for (const a of activities) {
        const isExtra = a.is_extra === true;
        const isVideo = a.photo_url && (a.photo_url.endsWith('.webm') || a.photo_url.includes('video'));
        const userLevel = a.profiles?.user_level || 0;
        
        const { count: likesCount } = await db.from('activity_likes').select('*', { count: 'exact', head: true }).eq('activity_id', a.id);
        const { data: userLiked } = await db.from('activity_likes').select('id').eq('activity_id', a.id).eq('user_id', user.id).maybeSingle();
        const { data: comments } = await db.from('activity_comments').select('*, profiles:user_id(name, avatar_url)').eq('activity_id', a.id).order('created_at', { ascending: true }).limit(3);
        
        let mediaHtml = '';
        if (isVideo) {
            mediaHtml = '<video src="' + a.photo_url + '" class="timeline-video" autoplay muted loop playsinline onerror="this.style.display=\'none\'" onclick="event.stopPropagation(); openPhotoDetail(\'' + a.id + '\')"></video>';
        } else {
            mediaHtml = '<img src="' + a.photo_url + '" class="timeline-photo" loading="lazy" onerror="this.style.display=\'none\'" onclick="openPhotoDetail(\'' + a.id + '\')">';
        }
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = 
            '<div class="timeline-header">' +
            '<img src="' + (a.profiles?.avatar_url || 'perfil_padrao.png') + '" class="timeline-avatar">' +
            '<div class="timeline-user">' +
            '<div class="timeline-name">' + 
            escapeHtml(a.profiles?.name || 'Usuário') + 
            ' <span class="badge badge-info" style="font-size:0.6rem;">Nv.' + userLevel + '</span>' +
            (isExtra ? ' <span class="badge badge-warning" style="font-size:0.6rem;">Extra</span>' : '') +
            (a.workout_type ? ' <span class="badge badge-secondary" style="font-size:0.6rem;">' + escapeHtml(a.workout_type) + '</span>' : '') +
            '</div>' +
            '<div class="timeline-date">📅 ' + formatDate(a.activity_date) + ' • ' + escapeHtml(a.challenges?.name || 'Desafio') + (isVideo ? ' 🎥' : '') + '</div>' +
            '</div>' +
            (isExtra ? '<span class="badge badge-secondary" style="font-size:0.7rem;">+0</span>' : '<span class="badge badge-success" style="font-size:0.7rem;">+1 pt</span>') +
            '</div>' +
            mediaHtml +
            (a.comment ? '<div class="timeline-body">💬 ' + escapeHtml(a.comment) + '</div>' : '') +
            '<div class="timeline-actions-bar">' +
            '<button class="timeline-action-btn ' + (userLiked ? 'liked' : '') + '" onclick="event.stopPropagation(); toggleLike(\'' + a.id + '\', this)" data-activity="' + a.id + '">' +
            '<i class="' + (userLiked ? 'fas' : 'far') + ' fa-heart"></i> ' + (likesCount || 0) +
            '</button>' +
            '<button class="timeline-action-btn" onclick="event.stopPropagation(); focusComment(\'' + a.id + '\')">' +
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
            '<input type="text" id="commentInput-' + a.id + '" placeholder="Adicione um comentário..." autocomplete="off" aria-label="Comentário">' +
            '<button onclick="event.stopPropagation(); addComment(\'' + a.id + '\')">Enviar</button>' +
            '</div>';
        
        feed.appendChild(item);
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
    const { data: members } = await db.from('group_members').select('*, profiles:user_id(name, avatar_url)').eq('group_id', currentGroup.id).eq('status', 'approved');
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
    html += '<p class="text-sm"><i class="fas fa-users"></i> ' + (members?.length || 0) + '/' + currentGroup.max_members + ' membros</p>';
    html += '</div>';
    
    // Seção de Convite
    html += '<div class="group-detail-card">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<h3>🔗 Convite</h3>';
    if (currentUserRole === 'admin') {
        html += '<button class="btn btn-sm btn-outline" onclick="generateInviteLink()"><i class="fas fa-sync-alt"></i> Novo Link</button>';
    }
    html += '</div>';
    html += '<input type="text" value="' + window.location.origin + '/fatfitapp/home.html?invite=' + (currentGroup.invite_code || '') + '" readonly style="width:100%;padding:10px;border:1px solid #E5E5EA;border-radius:10px;font-size:0.8rem;text-align:center;margin-top:8px;">';
    html += '<div style="display:flex;gap:8px;margin-top:8px;">';
    html += '<button class="btn btn-sm btn-secondary" onclick="shareWhatsApp(\'' + window.location.origin + '/fatfitapp/home.html?invite=' + (currentGroup.invite_code || '') + '\')" style="flex:1;"><i class="fab fa-whatsapp"></i> WhatsApp</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="copyInviteLink(\'' + window.location.origin + '/fatfitapp/home.html?invite=' + (currentGroup.invite_code || '') + '\')" style="flex:1;"><i class="fas fa-copy"></i> Copiar</button>';
    html += '</div>';
    html += '</div>';
    
    // Membros
    html += '<div class="group-detail-card"><h3>👥 Membros</h3><div>';
    if (members) {
        for (const m of members) {
            html += '<span class="member-chip"><img src="' + (m.profiles?.avatar_url || 'perfil_padrao.png') + '" alt="">' + escapeHtml(m.profiles?.name || 'Usuário') + (m.role === 'admin' ? ' <span class="badge badge-info">Admin</span>' : '') + '</span>';
        }
    }
    html += '</div></div>';
    
    // Solicitações pendentes (admin)
    if (currentUserRole === 'admin') {
        const { data: pendingMembers } = await db.from('group_members')
            .select('*, profiles:user_id(name, avatar_url)')
            .eq('group_id', currentGroup.id)
            .eq('status', 'pending');
        
        if (pendingMembers && pendingMembers.length > 0) {
            html += '<div class="group-detail-card" style="border:2px solid #F59E0B;">';
            html += '<h3>⏳ Solicitações Pendentes (' + pendingMembers.length + ')</h3>';
            for (const pm of pendingMembers) {
                html += '<div class="flex-between" style="padding:8px 0;border-bottom:1px solid #F2F2F7;">';
                html += '<span><strong>' + escapeHtml(pm.profiles?.name || 'Usuário') + '</strong></span>';
                html += '<div style="display:flex;gap:4px;">';
                html += '<button class="btn btn-sm btn-primary" onclick="approveMember(\'' + pm.id + '\')">✓ Aprovar</button>';
                html += '<button class="btn btn-sm btn-danger" onclick="rejectMember(\'' + pm.id + '\')">✕ Recusar</button>';
                html += '</div></div>';
            }
            html += '</div>';
        }
    }
    
    // Resto do código (desafio ativo, histórico, etc.)
    // ... (mantenha o código existente)
    
    container.innerHTML = html;
    // ... eventos
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
    
    // Verifica se é premium para habilitar vídeo
    const user = await getCurrentUser();
    const { data: profile } = await db.from('profiles').select('is_premium').eq('id', user.id).single();
    const isPremium = profile?.is_premium || false;
    
    const videoBtn = document.getElementById('videoModeBtn');
    if (videoBtn) {
        if (isPremium) {
            videoBtn.disabled = false;
            videoBtn.innerHTML = '🎥 Vídeo';
            videoBtn.title = '';
        } else {
            videoBtn.disabled = true;
            videoBtn.innerHTML = '🎥 Vídeo 🔒';
            videoBtn.title = 'Vídeos exclusivos para conta premium';
        }
    }
    
    try {
        console.log('🎥 Iniciando câmera (' + currentFacingMode + ')');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: isVideoMode && isPremium
        });
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        console.log('✅ Câmera iniciada');
    } catch (e) { 
        console.error('❌ Erro câmera:', e);
        showToast('Erro ao acessar câmera', 'error'); 
    }
    
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
            getCurrentUser().then(async (user) => {
                const { data: profile } = await db.from('profiles').select('is_premium').eq('id', user.id).single();
                if (profile?.is_premium) {
                    startVideoRecording();
                } else {
                    showToast('🔒 Vídeos exclusivos para conta premium', 'warning');
                }
            });
        } else if (isVideoMode && isVideoRecording) {
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
            getCurrentUser().then(async (user) => {
                const { data: profile } = await db.from('profiles').select('is_premium').eq('id', user.id).single();
                if (profile?.is_premium) {
                    startVideoRecording();
                } else {
                    showToast('🔒 Vídeos exclusivos para conta premium', 'warning');
                }
            });
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
        return;
    }
    
    // Modo foto - verifica premium antes de gravar vídeo
    if (isVideoRecording) {
        stopVideoRecording();
    } else if (pressDuration < 300) {
        capturePhoto();
    } else {
        // Verifica se é premium para permitir vídeo por long press
        getCurrentUser().then(async (user) => {
            const { data: profile } = await db.from('profiles').select('is_premium').eq('id', user.id).single();
            if (profile?.is_premium) {
                startVideoRecording();
            } else {
                showToast('🔒 Vídeos exclusivos para conta premium', 'warning');
            }
        });
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
        
        mediaRecorder = new MediaRecorder(stream, { 
            mimeType: mimeType,
            videoBitsPerSecond: 500000 // 500kbps - reduz tamanho do vídeo
        });
        
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

document.getElementById('videoModeBtn')?.addEventListener('click', async () => {
    const user = await getCurrentUser();
    const { data: profile } = await db.from('profiles').select('is_premium').eq('id', user.id).single();
    
    if (!profile?.is_premium) {
        showToast('🔒 Vídeos exclusivos para conta premium', 'warning');
        return;
    }
    
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
    
    // Pega o tipo de treino
    const workoutTypeSelect = document.getElementById('workoutType');
    let workoutType = workoutTypeSelect?.value || null;
    if (workoutType === 'Outro') {
        workoutType = document.getElementById('workoutTypeCustom')?.value?.trim() || 'Outro';
    }
    
    const today = getToday();
    let successCount = 0, pointsEarned = 0, extraCount = 0;
    
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
            const { error: actErr } = await db.from('daily_activities').insert({ 
                user_id: user.id, 
                challenge_id: cs.challenge.id, 
                activity_date: today, 
                photo_url: urlData.publicUrl, 
                location: activityLocationData, 
                comment, 
                status: 'valid', 
                is_extra: isExtra,
                workout_type: workoutType
            });
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
        
        // Notificações
        for (const cs of challengesWithStatus) {
            notifyGroupActivity(null, user.id, cs.challenge.group_id);
        }
        
        stopCamera();
        setTimeout(() => { window.location.href = 'home.html'; }, 2000);
    } else {
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
        const { count: memberCount } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'approved');
        const { data: membership } = await db.from('group_members').select('status').eq('group_id', g.id).eq('user_id', user.id).maybeSingle();
        
        // Define o badge de status
        let statusHtml = '';
        if (membership) {
            if (membership.status === 'approved') {
                statusHtml = '<span class="badge-member"><i class="fas fa-check-circle"></i> Membro</span>';
            } else if (membership.status === 'pending') {
                statusHtml = '<span class="badge badge-warning" style="font-size:0.8rem;">⏳ Pendente</span>';
            } else if (membership.status === 'rejected') {
                statusHtml = '<button class="btn-join" data-id="' + g.id + '"><i class="fas fa-redo"></i> Solicitar novamente</button>';
            }
        } else {
            statusHtml = '<button class="btn-join" data-id="' + g.id + '"><i class="fas fa-door-open"></i> Entrar</button>';
        }
        
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
            statusHtml +
            '</div>';
        
        container.appendChild(card);
    }
    
    // Mostrar/ocultar botão "Carregar mais"
    const hasMore = totalCount > searchPage * SEARCH_LIMIT;
    loadMoreContainer.style.display = hasMore ? 'block' : 'none';
    
    // Eventos dos botões Entrar/Solicitar novamente
    document.querySelectorAll('.btn-join').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const gId = btn.dataset.id;
            const { data: g } = await db.from('groups').select('*').eq('id', gId).single();
            const { count: currentCount } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', gId).eq('status', 'approved');
            
            if (currentCount >= g.max_members) {
                showToast('Grupo lotado!', 'error');
                return;
            }
            
            // Verifica se já tem solicitação
            const { data: existing } = await db.from('group_members').select('status').eq('group_id', gId).eq('user_id', user.id).maybeSingle();
            if (existing) {
                if (existing.status === 'approved') {
                    showToast('Você já é membro!', 'warning');
                } else if (existing.status === 'pending') {
                    showToast('Solicitação já enviada. Aguarde aprovação.', 'warning');
                } else if (existing.status === 'rejected') {
                    await db.from('group_members').update({ status: 'pending' }).eq('group_id', gId).eq('user_id', user.id);
                    showToast('📩 Nova solicitação enviada!', 'success');
                    btn.outerHTML = '<span class="badge badge-warning" style="font-size:0.8rem;">⏳ Pendente</span>';
                }
                return;
            }
            
            // Nova solicitação pendente
            await db.from('group_members').insert({ group_id: gId, user_id: user.id, role: 'member', status: 'pending' });
            showToast('📩 Solicitação enviada! Aguarde aprovação do admin.', 'success');
            btn.outerHTML = '<span class="badge badge-warning" style="font-size:0.8rem;">⏳ Pendente</span>';
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
    
    // Agrupa atividades por data (garante que o ID esteja presente)
    const dedupedByDate = {};
    for (const [dateStr, acts] of Object.entries(activitiesByDate)) {
        dedupedByDate[dateStr] = acts.map(a => ({
            id: a.id || a.activity_id,
            photo_url: a.photo_url,
            comment: a.comment,
            user_name: a.user_name,
            group_name: a.group_name,
            challenge_name: a.challenge_name,
            location: a.location,
            is_extra: a.is_extra
        }));
    }
    
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
        const acts = dedupedByDate[dateStr] || [];
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
    container.dataset.activities = JSON.stringify(dedupedByDate);
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
    title.dataset.date = dateStr;
    
    body.innerHTML = acts.map(a => `
        <div class="day-detail-item">
            <img src="${a.photo_url}" class="day-detail-photo" onclick="window.open('${a.photo_url}')" alt="Foto" onerror="this.style.display='none'">
            <div class="day-detail-info">
                <div class="day-detail-name">🎯 ${escapeHtml(a.challenge_name || 'Desafio')}</div>
                <div class="day-detail-meta">
                    <span>👥 ${escapeHtml(a.group_name || 'Grupo')}</span>
                </div>
                ${a.comment ? `<p class="day-detail-comment">💬 ${escapeHtml(a.comment)}</p>` : ''}
                ${a.location ? '<span class="text-xs text-muted">📍 Localização registrada</span>' : ''}
                <div style="margin-top:8px;display:flex;gap:8px;">
                    <button class="btn btn-outline btn-sm" onclick="window.editActivityComment('${a.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteActivity('${a.id}')">
                        <i class="fas fa-trash"></i> Apagar
                    </button>
                </div>
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


// ============================================
// EDITAR COMENTÁRIO DA ATIVIDADE
// ============================================
async function editActivityComment(activityId) {
    const currentComment = document.getElementById('comment-' + activityId)?.dataset?.comment || '';
    const newComment = prompt('Editar comentário:', currentComment);
    
    if (newComment === null) return; // Cancelou
    
    const { error } = await db.from('daily_activities')
        .update({ comment: newComment.trim() || null })
        .eq('id', activityId);
    
    if (error) {
        showToast('Erro ao editar: ' + error.message, 'error');
    } else {
        showToast('Comentário atualizado!', 'success');
        // Atualiza o modal
        const dateStr = document.getElementById('dayDetailTitle')?.dataset?.date;
        if (dateStr) showDayActivities(dateStr);
    }
}

// ============================================
// APAGAR ATIVIDADE
// ============================================
async function deleteActivity(activityId) {
    console.log('🗑️ deleteActivity chamado com ID:', activityId);
    
    if (!activityId || activityId === 'undefined') {
        showToast('ID da atividade inválido', 'error');
        return;
    }
    
    if (!confirm('Tem certeza que deseja apagar esta atividade?\n\nO ponto será removido e a foto/vídeo será deletado(a).')) return;
    
    try {
        // 1. Busca dados da atividade
        const { data: activity } = await db.from('daily_activities')
            .select('*, challenges:challenge_id(group_id)')
            .eq('id', activityId)
            .single();
        
        if (!activity) {
            showToast('Atividade não encontrada', 'error');
            return;
        }
        
        // 2. Remove a foto/vídeo do Storage
        if (activity.photo_url) {
            const url = activity.photo_url;
            const pathMatch = url.match(/\/activity-photos\/(.+)/);
            if (pathMatch) {
                const filePath = pathMatch[1];
                await db.storage.from('activity-photos').remove([filePath]);
            }
        }
        
        // 3. Remove curtidas e comentários
        await db.from('activity_likes').delete().eq('activity_id', activityId);
        await db.from('activity_comments').delete().eq('activity_id', activityId);
        
        // 4. Subtrai ponto (se era válida e não extra)
        if (activity.status === 'valid' && !activity.is_extra) {
            // Busca pontos atuais
            const { data: participant } = await db.from('challenge_participants')
                .select('points')
                .eq('challenge_id', activity.challenge_id)
                .eq('user_id', activity.user_id)
                .maybeSingle();
            
            if (participant && participant.points > 0) {
                await db.from('challenge_participants')
                    .update({ points: participant.points - 1 })
                    .eq('challenge_id', activity.challenge_id)
                    .eq('user_id', activity.user_id);
            }
        }
        
        // 5. Remove a atividade
        console.log('🗑️ Tentando deletar atividade:', activityId);
        
        const { error: deleteError } = await db.from('daily_activities')
            .delete()
            .eq('id', activityId);
        
        if (deleteError) {
            console.error('❌ Erro ao deletar:', deleteError);
            showToast('Erro ao apagar: ' + deleteError.message, 'error');
        } else {
            console.log('✅ Atividade deletada com sucesso');
            showToast('Atividade apagada!', 'success');
            document.getElementById('dayDetailModal')?.classList.remove('open');
            
            // Força limpar e recarregar
            const container = document.getElementById('profileCalendarContainer');
            if (container) {
                container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Atualizando...</p></div>';
            }
            setTimeout(async () => {
                await loadProfileCalendar();
            }, 500);
        }
    } catch (e) {
        console.error('Erro ao apagar:', e);
        showToast('Erro ao apagar atividade', 'error');
    }
}

window.deleteActivity = deleteActivity;

window.editActivityComment = editActivityComment;
window.deleteActivity = deleteActivity;


// ============================================
// LINK DE CONVITE
// ============================================
async function generateInviteLink() {
    if (!currentGroup) return;
    
    const { data, error } = await db.rpc('generate_invite_link', { p_group_id: currentGroup.id });
    
    if (error) {
        showToast('Erro ao gerar link', 'error');
        return;
    }
    
    const link = `${window.location.origin}/fatfitapp/home.html?invite=${data}`;
    
    // Atualiza o código na interface
    currentGroup.invite_code = data;
    loadDetalhes();
    
    // Modal para compartilhar
    showInviteModal(link);
}

function showInviteModal(link) {
    let modal = document.getElementById('inviteModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inviteModal';
        modal.className = 'modal open';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;border-radius:20px;">
                <div class="modal-header" style="background:#FFFFFF;border-radius:20px 20px 0 0;">
                    <h3>🔗 Link de Convite</h3>
                    <button class="icon-btn modal-close" onclick="document.getElementById('inviteModal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body" style="background:#FFFFFF;border-radius:0 0 20px 20px;text-align:center;">
                    <p class="text-sm text-muted mb-2">Compartilhe este link para convidar pessoas:</p>
                    <input type="text" id="inviteLinkInput" value="${link}" readonly style="width:100%;padding:10px;border:1px solid #E5E5EA;border-radius:10px;font-size:0.8rem;text-align:center;margin-bottom:12px;">
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-secondary btn-sm" onclick="shareWhatsApp('${link}')" style="flex:1;">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="copyInviteLink('${link}')" style="flex:1;">
                            <i class="fas fa-copy"></i> Copiar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function shareWhatsApp(link) {
    const text = encodeURIComponent(`🦫 Entre no meu grupo no FATFIT!\n\n${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast('✅ Link copiado!', 'success');
    });
}

window.shareWhatsApp = shareWhatsApp;
window.copyInviteLink = copyInviteLink;




async function approveMember(memberId) {
    console.log('✅ Aprovando membro:', memberId);
    
    const { error } = await db.from('group_members')
        .update({ status: 'approved' })
        .eq('id', memberId);
    
    if (error) {
        console.error('❌ Erro ao aprovar:', error);
        showToast('Erro ao aprovar: ' + error.message, 'error');
    } else {
        console.log('✅ Membro aprovado com sucesso');
        showToast('✅ Membro aprovado!', 'success');
        
        // Recarrega os detalhes para atualizar a lista
        await loadDetalhes();
    }
}

window.approveMember = approveMember;
async function rejectMember(memberId) {
    console.log('❌ Recusando membro:', memberId);
    
    if (!confirm('Tem certeza que deseja recusar esta solicitação?')) return;
    
    const { error } = await db.from('group_members')
        .update({ status: 'rejected' })
        .eq('id', memberId);
    
    if (error) {
        console.error('❌ Erro ao recusar:', error);
        showToast('Erro ao recusar: ' + error.message, 'error');
    } else {
        console.log('✅ Solicitação recusada');
        showToast('Solicitação recusada', 'info');
        
        // Recarrega os detalhes para atualizar a lista
        await loadDetalhes();
    }
}

window.rejectMember = rejectMember;

window.approveMember = approveMember;
window.rejectMember = rejectMember;



// ============================================
// GAMIFICAÇÃO - BARRA DE LEVEL NA TIMELINE
// ============================================

async function renderLevelBar() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: profile } = await db.from('profiles')
        .select('user_level, user_xp, fatcoins, fitcoins')
        .eq('id', user.id)
        .single();
    
    if (!profile) return;
    
    const level = profile.user_level || 0;
    const coins = profile.fatcoins || 0;
    const fitcoins = profile.fitcoins || 0;
    
    // Atualiza o header
    const headerLevel = document.getElementById('headerLevel');
    if (headerLevel) {
        headerLevel.innerHTML = `
            <span class="header-level-badge">Nv.${level}</span>
            <span class="header-coins">🪙${coins}</span>
            <span class="header-coins" style="color:#00BCD4;cursor:pointer;" onclick="window.location.href='buy.html'" title="Comprar FitCoins">💎${fitcoins}</span>
        `;
    }
}
// ============================================
// GAMIFICAÇÃO - CARD DO PERFIL
// ============================================

async function renderGamificationCard(userId) {
    const { data: profile } = await db.from('profiles')
        .select('user_level, user_xp, fatcoins, fitcoins')
        .eq('id', userId)
        .single();
    
    if (!profile) return '';
    
    const level = profile.user_level || 0;
    const xp = profile.user_xp || 0;
    const nextXp = level + 2;
    const progress = Math.min((xp / nextXp) * 100, 100);
    const circumference = 2 * Math.PI * 30;
    const offset = circumference - (progress / 100) * circumference;
    
    const skills = ['Academia', 'Corrida', 'Ciclismo', 'Natação'];
    const skillIcons = { 'Academia': '🏋️', 'Corrida': '🏃', 'Ciclismo': '🚴', 'Natação': '🏊' };
    
    const { data: userSkills } = await db.from('user_skills')
        .select('*')
        .eq('user_id', userId);
    
    let skillsHtml = '';
    for (const skill of skills) {
        const skillData = userSkills?.find(s => s.skill_name === skill);
        const skillLevel = skillData?.level || 1;
        const skillXp = skillData?.xp || 0;
        const skillProgress = Math.min((skillXp % 3) / 3 * 100, 100);
        
        skillsHtml += `
            <div class="skill-item">
                <span class="skill-icon">${skillIcons[skill]}</span>
                <span class="skill-name">${skill}</span>
                <span class="skill-level">Nv.${skillLevel}</span>
                <div class="skill-bar">
                    <div class="skill-bar-fill" style="width:${skillProgress}%"></div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="gamification-card">
            <div class="gamification-header">
                <div class="gamification-level-circle">
                    <svg viewBox="0 0 72 72">
                        <circle class="level-circle-bg" cx="36" cy="36" r="30"/>
                        <circle class="level-circle-fill" cx="36" cy="36" r="30"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}"/>
                    </svg>
                    <div class="gamification-level-number">${level}</div>
                </div>
                <div class="gamification-info">
                    <div class="gamification-level-title">Nível ${level}</div>
                    <div class="gamification-xp-text">${xp}/${nextXp} XP para o próximo nível</div>
                    <div style="display:flex;gap:16px;align-items:center;margin-top:8px;">
                        <div class="gamification-coins" style="font-size:0.9rem;">
                            <i class="fas fa-coins"></i> ${profile.fatcoins || 0} FATCoins
                        </div>
                        <div class="gamification-coins" style="font-size:0.9rem;color:#00BCD4;cursor:pointer;" onclick="window.location.href='buy.html'" title="Comprar FitCoins">
                            <i class="fas fa-gem"></i> ${profile.fitcoins || 0} FitCoins
                        </div>
                    </div>
                </div>
            </div>
            <div class="skills-list">
                ${skillsHtml}
            </div>
        </div>
    `;
}


// ============================================
// COMPARTILHAR PROGRESSO (INSTAGRAM STYLE)
// ============================================
async function shareProgress() {
    const user = await getCurrentUser();
    if (!user) return;
    
    showToast('📤 Gerando imagem...', 'info');
    
    try {
        const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
        const { data: skills } = await db.from('user_skills').select('*').eq('user_id', user.id);
        
        const today = new Date();
        const { data: activities } = await db.rpc('get_calendar_data', {
            p_user_id: user.id,
            p_group_id: null,
            p_month: today.getMonth() + 1,
            p_year: today.getFullYear()
        });
        
        const activitiesByDay = {};
        if (activities) {
            activities.forEach(act => {
                const day = parseInt(act.activity_date.split('-')[2]);
                if (!activitiesByDay[day]) activitiesByDay[day] = [];
                activitiesByDay[day].push(act);
            });
        }
        
        // Calcula número de linhas do calendário
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
        const totalCells = firstDay + daysInMonth;
        const totalRows = Math.ceil(totalCells / 7);
        
        const calMargin = 25;
        const availableW = 500 - calMargin * 2;
        const cellSize = Math.floor(availableW / 7);
        const calHeight = 50 + totalRows * cellSize + 20;
        
        // Altura total do canvas
        const height = 270 + calHeight;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = 500;
        canvas.width = width;
        canvas.height = height;
        
        // Fundo gradiente
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#833AB4');
        gradient.addColorStop(0.5, '#C13584');
        gradient.addColorStop(1, '#F77737');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // ========== CABEÇALHO ==========
        const headerY = 15;
        const headerW = width - 30;
        const headerH = 95;
        
        const headerGradient = ctx.createLinearGradient(headerY, 0, headerY + headerW, 0);
        headerGradient.addColorStop(0, '#667eea');
        headerGradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = headerGradient;
        roundRect(ctx, 15, headerY, headerW, headerH, 20);
        ctx.fill();
        
        const avatarSize = 66;
        const avatarCX = width / 2;
        const avatarCY = headerY + headerH / 2 + 5;
        
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarSize/2 + 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        
        if (profile?.avatar_url) {
            const avatarImg = new Image();
            avatarImg.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
                avatarImg.onload = resolve;
                avatarImg.src = profile.avatar_url;
            });
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCX, avatarCY, avatarSize/2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, avatarCX - avatarSize/2, avatarCY - avatarSize/2, avatarSize, avatarSize);
            ctx.restore();
        }
        
        const nameY = headerY + headerH + 22;
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(profile?.name || 'Usuário', width / 2, nameY);
        
        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('Venha competir no FATFIT você também!', width / 2, nameY + 22);
        
        // ========== CARD: Level + Skills ==========
        const cardY = nameY + 45;
        const cardH = 130;
        
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(ctx, 15, cardY, width - 30, cardH, 16);
        ctx.fill();
        
        const levelCY = cardY + 30;
        ctx.beginPath();
        ctx.arc(width / 2, levelCY, 22, 0, Math.PI * 2);
        ctx.fillStyle = '#4F46E5';
        ctx.fill();
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(profile?.user_level || 0, width / 2, levelCY + 6);
        
        ctx.font = '11px -apple-system, sans-serif';
        ctx.fillStyle = '#1C1C1E';
        ctx.fillText('Nível ' + (profile?.user_level || 0), width / 2, levelCY + 35);
        
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillStyle = '#8E8E93';
        ctx.fillText('🪙 ' + (profile?.fatcoins || 0) + ' FATCoins', width / 2, levelCY + 50);
        
        const skillsY = cardY + 78;
        const skillList = ['Academia', 'Corrida', 'Ciclismo', 'Natação'];
        const skillIcons = { 'Academia': '🏋️', 'Corrida': '🏃', 'Ciclismo': '🚴', 'Natação': '🏊' };
        const skillColW = (width - 30) / 4;
        
        skillList.forEach((skill, idx) => {
            const sx = 15 + idx * skillColW;
            const skillData = skills?.find(s => s.skill_name === skill);
            const lvl = skillData?.level || 1;
            const xp = skillData?.xp || 0;
            const progress = Math.min(((xp % 3) / 3) * 100, 100);
            
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1C1C1E';
            ctx.font = 'bold 10px -apple-system, sans-serif';
            ctx.fillText(skillIcons[skill], sx + skillColW/2, skillsY + 10);
            ctx.font = '8px -apple-system, sans-serif';
            ctx.fillText(skill + ' Nv.' + lvl, sx + skillColW/2, skillsY + 28);
            
            const barW = skillColW - 16;
            ctx.fillStyle = '#E5E5EA';
            roundRect(ctx, sx + 8, skillsY + 34, barW, 3, 2);
            ctx.fill();
            ctx.fillStyle = '#4F46E5';
            roundRect(ctx, sx + 8, skillsY + 34, barW * progress / 100, 3, 2);
            ctx.fill();
        });
        
        // ========== CALENDÁRIO ==========
        const calY = cardY + cardH + 12;
        
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(ctx, 15, calY, width - 30, calHeight, 16);
        ctx.fill();
        
        let calInnerY = calY + 15;
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.fillStyle = '#1C1C1E';
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        ctx.fillText('📅 ' + monthNames[today.getMonth()] + ' ' + today.getFullYear(), width / 2, calInnerY + 8);
        calInnerY += 18;
        
        const calStartX = calMargin + (availableW - cellSize * 7) / 2;
        
        const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
        ctx.font = '9px -apple-system, sans-serif';
        ctx.fillStyle = '#8E8E93';
        for (let i = 0; i < 7; i++) {
            ctx.fillText(weekDays[i], calStartX + i * cellSize + cellSize / 2, calInnerY + 10);
        }
        calInnerY += 14;
        
        let dayCount = 1;
        for (let row = 0; row < totalRows; row++) {
            for (let col = 0; col < 7; col++) {
                const cx = calStartX + col * cellSize + cellSize / 2;
                const cy = calInnerY + cellSize / 2;
                
                if (row === 0 && col < firstDay) continue;
                if (dayCount > daysInMonth) break;
                
                const hasActivity = activitiesByDay[dayCount];
                
                if (hasActivity) {
                    const mediaUrl = hasActivity[0]?.photo_url;
                    if (mediaUrl) {
                        try {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            await new Promise((resolve, reject) => {
                                img.onload = resolve;
                                img.onerror = reject;
                                img.src = mediaUrl;
                                setTimeout(() => reject('timeout'), 2000);
                            });
                            ctx.save();
                            ctx.beginPath();
                            const imgSize = cellSize - 4;
                            roundRect(ctx, cx - imgSize/2, cy - imgSize/2, imgSize, imgSize, 4);
                            ctx.clip();
                            ctx.drawImage(img, cx - imgSize/2, cy - imgSize/2, imgSize, imgSize);
                            ctx.restore();
                        } catch(e) {
                            ctx.beginPath();
                            ctx.arc(cx, cy, (cellSize - 4) / 2, 0, Math.PI * 2);
                            ctx.fillStyle = '#4F46E5';
                            ctx.fill();
                        }
                    }
                } else {
                    ctx.beginPath();
                    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                    ctx.fillStyle = '#E5E5EA';
                    ctx.fill();
                }
                
                ctx.fillStyle = hasActivity ? '#FFFFFF' : '#1C1C1E';
                ctx.font = '8px -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(dayCount, cx, cy + cellSize / 2 - 3);
                
                dayCount++;
            }
            calInnerY += cellSize;
        }
        
        const dataUrl = canvas.toDataURL('image/png');
        
        if (navigator.share) {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'fatfit-progresso.png', { type: 'image/png' });
            await navigator.share({
                title: 'Veja o meu progresso no FATFIT',
                text: 'Acompanhe meus treinos e me desafie! Acesse: https://fatfitapp.github.io/fatfitapp',
                files: [file]
            });
        } else {
            window.open(dataUrl);
        }
        
    } catch (e) {
        console.error('Erro ao compartilhar:', e);
        showToast('Erro ao gerar imagem', 'error');
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

window.shareProgress = shareProgress;



// ============================================
// STORIES - BARRA E POSTAGEM
// ============================================

async function renderStoriesBar() {
    if (!currentGroup) return;
    
    // Remove barra antiga se existir
    const existingBar = document.getElementById('storiesBar');
    if (existingBar) existingBar.remove();
    
    const user = await getCurrentUser();
    if (!user) return;
    
    // Busca stories ativos do grupo
    const { data: stories } = await db.from('stories')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('group_id', currentGroup.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
    
    // Cria o elemento da barra
    const barDiv = document.createElement('div');
    barDiv.id = 'storiesBar';
    barDiv.className = 'stories-bar';
    
    // Perfil do usuário
    const profile = await getProfile(user.id);
    const yourStories = stories?.filter(s => s.user_id === user.id) || [];
    
    // PRIMEIRO CÍRCULO: Sempre "+" para postar (com sua foto)
    const addCircle = document.createElement('div');
    addCircle.className = 'story-circle';
    addCircle.onclick = () => openStoryUpload();
    addCircle.innerHTML = `
        <div class="story-avatar-ring add-story" style="position:relative;">
            <img src="${profile?.avatar_url || 'perfil_padrao.png'}" class="story-avatar-img">
        </div>
        <span class="story-username">Novo</span>
    `;
    barDiv.appendChild(addCircle);
    
    // SEGUNDO CÍRCULO: Seus stories (se tiver)
    if (yourStories.length > 0) {
        const yourCircle = document.createElement('div');
        yourCircle.className = 'story-circle';
        yourCircle.onclick = () => openStoryViewer(user.id);
        yourCircle.innerHTML = `
            <div class="story-avatar-ring" style="position:relative;">
                <img src="${profile?.avatar_url || 'perfil_padrao.png'}" class="story-avatar-img">
                ${yourStories.length > 1 ? `<span class="story-badge">${yourStories.length}</span>` : ''}
            </div>
            <span class="story-username">Você</span>
        `;
        barDiv.appendChild(yourCircle);
    }
    
    // Círculos dos outros usuários
    if (stories && stories.length > 0) {
        const usersMap = {};
        for (const s of stories) {
            if (s.user_id === user.id) continue;
            if (!usersMap[s.user_id]) {
                usersMap[s.user_id] = {
                    user: s.profiles,
                    count: 0,
                    hasUnseen: false
                };
            }
            usersMap[s.user_id].count++;
            
            const { data: viewed } = await db.from('story_views')
                .select('id').eq('story_id', s.id).eq('user_id', user.id).maybeSingle();
            
            if (!viewed) usersMap[s.user_id].hasUnseen = true;
        }
        
        for (const [userId, data] of Object.entries(usersMap)) {
            const ringClass = data.hasUnseen ? '' : 'viewed';
            const badgeHtml = data.count > 1 ? `<span class="story-badge">${data.count}</span>` : '';
            
            const circle = document.createElement('div');
            circle.className = 'story-circle';
            circle.onclick = () => openStoryViewer(userId);
            circle.innerHTML = `
                <div class="story-avatar-ring ${ringClass}" style="position:relative;">
                    <img src="${data.user?.avatar_url || 'perfil_padrao.png'}" class="story-avatar-img">
                    ${badgeHtml}
                </div>
                <span class="story-username">${escapeHtml(data.user?.name?.split(' ')[0] || 'Usuário')}</span>
            `;
            barDiv.appendChild(circle);
        }
    }
    
    // Insere DENTRO da div tabTimeline, antes do feed
    const timeline = document.getElementById('tabTimeline');
    const feed = document.getElementById('timelineFeed');
    if (timeline && feed) {
        timeline.insertBefore(barDiv, feed);
        console.log('✅ Barra de stories inserida');
    }
}
// Helper para criar elemento a partir de HTML
function createElementFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
}

// Abre modal de upload de story
function openStoryUpload() {
    let modal = document.getElementById('storyUploadModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'storyUploadModal';
        modal.className = 'modal open';
        modal.innerHTML = `
            <div class="modal-content story-upload-modal">
                <div class="modal-header" style="background:#FFFFFF;border-radius:20px 20px 0 0;">
                    <h3>📸 Postar Story</h3>
                    <button class="icon-btn modal-close" onclick="document.getElementById('storyUploadModal').remove()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body" style="background:#FFFFFF;border-radius:0 0 20px 20px;padding:0;">
                    <div class="story-upload-option" onclick="uploadStoryFromCamera()">
                        <i class="fas fa-camera"></i> Tirar foto / Gravar vídeo
                    </div>
                    <div class="story-upload-option" onclick="uploadStoryFromGallery()">
                        <i class="fas fa-image"></i> Escolher da galeria
                    </div>
                    <div class="story-upload-option" onclick="document.getElementById('storyUploadModal').remove()" style="color:#8E8E93;">
                        Cancelar
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Upload da galeria
function uploadStoryFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 5MB.', 'error');
            return;
        }
        
        document.getElementById('storyUploadModal')?.remove();
        await postStory(file);
    };
    input.click();
}

function uploadStoryFromCamera() {
    document.getElementById('storyUploadModal')?.remove();
    
    // No mobile, abre câmera. No desktop, abre galeria.
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    if (isMobile) input.capture = 'environment';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 5MB.', 'error');
            return;
        }
        await postStory(file);
    };
    
    setTimeout(() => input.click(), 300);
}
// Postar story
async function postStory(file) {
    const user = await getCurrentUser();
    if (!user || !currentGroup) {
        showToast('Selecione um grupo primeiro', 'error');
        return;
    }
    
    showToast('📤 Enviando story...', 'info');
    
    try {
        const isVideo = file.type.startsWith('video/');
        const ext = isVideo ? 'webm' : 'jpg';
        const fileName = `stories/${user.id}/${Date.now()}.${ext}`;
        
        const { error: upErr } = await db.storage.from('activity-photos')
            .upload(fileName, file, { contentType: file.type });
        
        if (upErr) {
            console.error('Erro upload:', upErr);
            showToast('Erro ao enviar arquivo', 'error');
            return;
        }
        
        const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
        
        const { error } = await db.from('stories').insert({
            user_id: user.id,
            group_id: currentGroup.id,
            photo_url: urlData.publicUrl,
            is_video: isVideo
        });
        
        if (error) {
            console.error('Erro ao salvar story:', error);
            showToast('Erro ao postar story', 'error');
            return;
        }
        
        showToast('✅ Story postado!', 'success');
        
        // Força recarregar a barra após o upload
        setTimeout(() => {
            renderStoriesBar();
        }, 500);
        
    } catch (e) {
        console.error('Erro ao postar story:', e);
        showToast('Erro ao postar story', 'error');
    }
}

async function openStoryViewer(userId) {
    if (!currentGroup) return;
    
    const user = await getCurrentUser();
    
    // Busca stories não expirados do usuário no grupo
    const { data: stories } = await db.from('stories')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('group_id', currentGroup.id)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
    
    if (!stories || stories.length === 0) {
        showToast('Nenhum story disponível', 'info');
        return;
    }
    
    // Verifica se JÁ VIU todos (bloqueia reabertura)
    if (userId !== user.id) {
        let allViewed = true;
        for (const s of stories) {
            const { data: viewed } = await db.from('story_views')
                .select('id').eq('story_id', s.id).eq('user_id', user.id).maybeSingle();
            if (!viewed) {
                allViewed = false;
                break;
            }
        }
        if (allViewed) {
            showToast('Você já viu todos os stories desta pessoa', 'info');
            return;
        }
    }
    
    currentStories = stories;
    currentStoryUser = stories[0].profiles;
    currentStoryIndex = 0;
    
    // Remove viewer antigo
    const existing = document.getElementById('storyViewer');
    if (existing) existing.remove();
    
    // Cria o visualizador estilo Instagram
    const viewer = document.createElement('div');
    viewer.id = 'storyViewer';
    viewer.className = 'story-viewer open';
    viewer.innerHTML = `
        <div class="story-viewer-bg" id="storyViewerBg"></div>
        <div class="story-progress-container" id="storyProgressContainer"></div>
        <div class="story-viewer-header">
            <img id="storyViewerAvatar" class="story-viewer-avatar" src="">
            <div>
                <div class="story-viewer-name" id="storyViewerName"></div>
                <div class="story-viewer-time" id="storyViewerTime"></div>
            </div>
            <button class="story-delete-btn" id="storyDeleteBtn" style="display:none;" onclick="deleteCurrentStory()">
                <i class="fas fa-trash"></i>
            </button>
            <button class="story-viewer-close" onclick="closeStoryViewer()">✕</button>
        </div>
        <div class="story-viewer-content" id="storyViewerContent"></div>
        <div class="story-nav-arrow story-nav-left" onclick="prevStory()">
            <i class="fas fa-chevron-left"></i>
        </div>
        <div class="story-nav-arrow story-nav-right" onclick="nextStory()">
            <i class="fas fa-chevron-right"></i>
        </div>
    `;
    document.body.appendChild(viewer);
    
    showCurrentStory();
}

// Mostra o story atual
function showCurrentStory() {
    if (currentStoryIndex >= currentStories.length) {
        closeStoryViewer();
        return;
    }
    
    const story = currentStories[currentStoryIndex];
    const user = currentStoryUser;
    
    // Fundo com blur da foto atual
    document.getElementById('storyViewerBg').style.backgroundImage = `url(${story.photo_url})`;
    document.getElementById('storyViewerAvatar').src = user?.avatar_url || 'perfil_padrao.png';
    document.getElementById('storyViewerName').textContent = user?.name || 'Usuário';
    document.getElementById('storyViewerTime').textContent = formatTime(story.created_at);
    
    // Mostra botão deletar apenas para o dono
    getCurrentUser().then(u => {
        document.getElementById('storyDeleteBtn').style.display = 
            (u.id === story.user_id) ? 'block' : 'none';
    });
    
    // Barras de progresso
    const progressContainer = document.getElementById('storyProgressContainer');
    progressContainer.innerHTML = currentStories.map((s, i) => `
        <div class="story-progress-bar">
            <div class="story-progress-fill" id="progressFill${i}" style="width:${i < currentStoryIndex ? '100%' : '0%'}"></div>
        </div>
    `).join('');
    
    // Conteúdo
    const content = document.getElementById('storyViewerContent');
    content.querySelector('img')?.remove();
    content.querySelector('video')?.remove();
    
    if (story.is_video) {
        const video = document.createElement('video');
        video.src = story.photo_url;
        video.className = 'story-viewer-video';
        video.autoplay = true;
        video.controls = false;
        video.onended = nextStory;
        content.appendChild(video);
        
        // Progresso baseado no tempo do vídeo
        video.addEventListener('timeupdate', () => {
            const progress = (video.currentTime / video.duration) * 100;
            const fill = document.getElementById('progressFill' + currentStoryIndex);
            if (fill) fill.style.width = progress + '%';
        });
    } else {
        const img = document.createElement('img');
        img.src = story.photo_url;
        img.className = 'story-viewer-media';
        content.appendChild(img);
        
        // Anima barra de progresso por 5 segundos
        const fill = document.getElementById('progressFill' + currentStoryIndex);
        if (fill) {
            let width = 0;
            clearTimeout(storyProgressTimer);
            const interval = setInterval(() => {
                width += 2;
                fill.style.width = width + '%';
                if (width >= 100) {
                    clearInterval(interval);
                    nextStory();
                }
            }, 100);
            storyProgressTimer = interval;
        }
    }
    
    // Marca como visto (se não for o dono)
    getCurrentUser().then(async (u) => {
        if (u.id !== story.user_id) {
            await db.from('story_views').insert({
                story_id: story.id,
                user_id: u.id
            }).select();
        }
    });
}

// Próximo story
function nextStory() {
    clearTimeout(storyProgressTimer);
    currentStoryIndex++;
    
    if (currentStoryIndex >= currentStories.length) {
        closeStoryViewer();
    } else {
        showCurrentStory();
    }
}

// Story anterior
function prevStory() {
    clearTimeout(storyProgressTimer);
    if (currentStoryIndex > 0) {
        currentStoryIndex--;
        showCurrentStory();
    }
}

// Fechar visualizador
function closeStoryViewer() {
    clearTimeout(storyProgressTimer);
    const viewer = document.getElementById('storyViewer');
    if (viewer) viewer.classList.remove('open');
    currentStories = [];
    currentStoryIndex = 0;
    renderStoriesBar(); // Atualiza barra (círculos ficam cinza)
}

// Deletar story atual
async function deleteCurrentStory() {
    if (currentStoryIndex >= currentStories.length) return;
    
    const story = currentStories[currentStoryIndex];
    if (!confirm('Deletar este story?')) return;
    
    await db.from('stories').delete().eq('id', story.id);
    
    currentStories.splice(currentStoryIndex, 1);
    if (currentStories.length === 0) {
        closeStoryViewer();
    } else if (currentStoryIndex >= currentStories.length) {
        currentStoryIndex = currentStories.length - 1;
        showCurrentStory();
    } else {
        showCurrentStory();
    }
}

// Funções globais
window.openStoryUpload = openStoryUpload;
window.uploadStoryFromCamera = uploadStoryFromCamera;
window.uploadStoryFromGallery = uploadStoryFromGallery;
window.openStoryViewer = openStoryViewer;
window.nextStory = nextStory;
window.prevStory = prevStory;
window.closeStoryViewer = closeStoryViewer;
window.deleteCurrentStory = deleteCurrentStory;

async function openStoryCamera() {
    // Cria input de câmera temporário
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.capture = 'environment'; // Câmera traseira
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 5MB.', 'error');
            return;
        }
        
        await postStory(file);
    };
    input.click();
}

// ============================================
// BOLÃO DA COPA - FATBET
// ============================================

// ============================================
// PÁGINA: bet.html
// ============================================
if (window.location.pathname.includes('bet')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await updateBetBalance();
        await loadBetGames();
    });
}

let currentBetGame = null;

async function setupBetPage(session) {
    const container = document.getElementById('betContainer');
    if (!container) return;
    
    await loadBetGames();
}

async function loadBetGames() {
    const container = document.getElementById('betContainer');
    if (!container) return;
    
    await updateBetBalance();
    
    container.innerHTML = '<div class="loading-state"><img src="logo.png" alt="Carregando" class="loading-mini-logo"><p>Carregando jogos...</p></div>';
    
    const user = await getCurrentUser();
    const { data: games } = await db.from('bet_games')
        .select('*')
        .order('game_date', { ascending: true });
    
    if (!games || games.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-futbol"></i><p>Nenhum jogo disponível</p></div>';
        return;
    }
    
    const { data: myBets } = await db.from('bet_entries')
        .select('*')
        .eq('user_id', user.id);
    
    const { data: profile } = await db.from('profiles').select('fitcoins, fatcoins').eq('id', user.id).single();
    
    const myBetsMap = {};
    if (myBets) myBets.forEach(b => myBetsMap[b.game_id] = b);
    
    const gamesByDate = {};
    for (const game of games) {
        const dateKey = game.game_date.split('T')[0];
        if (!gamesByDate[dateKey]) {
            gamesByDate[dateKey] = { date: dateKey, games: [] };
        }
        gamesByDate[dateKey].games.push(game);
    }
    
    const today = getToday();
    let html = '<h2 style="font-size:1.1rem;font-weight:700;color:#1C1C1E;margin-bottom:12px;">⚽ Jogos da Copa</h2>';
    
    for (const [dateKey, group] of Object.entries(gamesByDate)) {
        const isToday = dateKey === today;
        const sectionId = 'betDay-' + dateKey.replace(/-/g, '');
        
        html += `
            <div class="bet-day-section">
                <div class="bet-day-header" onclick="toggleBetDay('${sectionId}')">
                    <div>
                        <span style="font-weight:700;font-size:0.95rem;">${formatDate(dateKey)}</span>
                        ${isToday ? '<span class="bet-status bet-status-live" style="margin-left:8px;">HOJE</span>' : ''}
                        <span style="font-size:0.75rem;color:#8E8E93;margin-left:8px;">${group.games.length} jogo(s)</span>
                    </div>
                    <i class="fas fa-chevron-down bet-day-arrow" id="${sectionId}Arrow"></i>
                </div>
                <div class="bet-day-games ${isToday ? 'expanded' : ''}" id="${sectionId}">
        `;
        
        for (const game of group.games) {
            const isOpen = game.status === 'open' && new Date(game.game_date) > new Date();
            const gameStarted = new Date(game.game_date) < new Date();
            const myBet = myBetsMap[game.id];
            const currency = game.currency || 'fatcoins';
            const isFitcoinGame = currency === 'fitcoins';
            const isBothGame = currency === 'both';
            const userHasFitcoins = (profile?.fitcoins || 0) >= 10;
            const userHasFatcoins = (profile?.fatcoins || 0) >= 10;
            
            let statusBadge = '';
            if (game.status === 'finished') {
                statusBadge = `<span class="bet-status bet-status-finished">Finalizado</span>`;
            } else if (!isOpen) {
                statusBadge = `<span class="bet-status bet-status-closed">Em andamento</span>`;
            } else {
                statusBadge = `<span class="bet-status bet-status-open">Aberto</span>`;
            }
            
            let onClickAction = '';
            if (myBet) {
                onClickAction = `onclick="openGameDetail('${game.id}')"`;
            } else if (isOpen) {
                onClickAction = `onclick="openBetForm('${game.id}')"`;
            } else if (gameStarted) {
                onClickAction = `onclick="openGameDetail('${game.id}')"`;
            }
            
            // Informações específicas da moeda
            let currencyInfo = '';
            if (isFitcoinGame) {
                currencyInfo = `
                    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:0.75rem;color:#00BCD4;">
                        <i class="fas fa-gem"></i> Aposta com 💎 FitCoins
                        <span style="margin-left:4px;color:#8E8E93;">• Odds: 1.5x a 8x</span>
                    </div>
                `;
            } else if (isBothGame) {
                currencyInfo = `
                    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:0.75rem;color:#8E8E93;">
                        🪙 FATCoins ou 💎 FitCoins
                    </div>
                `;
            } else {
                currencyInfo = `
                    <div class="bet-game-pot">💰 Pote: ${game.pot_total || 0} 🪙 FATCoins</div>
                `;
            }
            
            // Botões de ação
            let actionButtons = '';
            if (isOpen && !myBet) {
                if (isFitcoinGame && !userHasFitcoins) {
                    actionButtons = `
                        <div style="display:flex;gap:8px;margin-top:8px;">
                            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openBetForm('${game.id}')" style="flex:1;">💎 Apostar</button>
                            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); window.location.href='buy.html'" style="flex:1;">🛒 Comprar</button>
                        </div>
                    `;
                }
            }
            
            html += `
                <div class="bet-game-card ${!isOpen ? 'closed' : ''} ${game.status === 'finished' ? 'finished' : ''}" ${onClickAction}>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        ${statusBadge}
                        ${game.status === 'finished' ? `<span style="font-weight:700;font-size:1rem;">${game.score_a || 0} x ${game.score_b || 0}</span>` : ''}
                    </div>
                    <div class="bet-game-teams">
                        <div class="bet-team">
                            <span class="bet-team-flag">${game.team_a_flag || '⚽'}</span>
                            <span class="bet-team-name">${escapeHtml(game.team_a)}</span>
                        </div>
                        <div class="bet-vs">VS</div>
                        <div class="bet-team">
                            <span class="bet-team-flag">${game.team_b_flag || '⚽'}</span>
                            <span class="bet-team-name">${escapeHtml(game.team_b)}</span>
                        </div>
                    </div>
                    <div class="bet-game-info">
                        <span>⏰ ${formatTime(game.game_date)}</span>
                    </div>
                    ${currencyInfo}
                    <div class="bet-game-bets">👥 ${game.total_bets || 0} palpites</div>
                    ${actionButtons}
                    ${myBet ? `
                        <div class="my-bet-card ${myBet.won ? 'my-bet-won' : game.status === 'finished' ? 'my-bet-lost' : 'my-bet-pending'}" style="margin-top:10px;">
                            <div class="my-bet-teams">Seu palpite: ${myBet.score_a || 0} x ${myBet.score_b || 0} • ${myBet.amount} ${myBet.currency === 'fitcoins' ? '💎' : '🪙'}</div>
                            <div class="my-bet-info">
                                ${myBet.won ? `<span style="color:#10B981;">+${myBet.amount_won} ${myBet.currency === 'fitcoins' ? '💎' : '🪙'}</span>` : game.status === 'finished' ? '<span style="color:#EF4444;">Não foi dessa vez</span>' : '<span style="color:#F59E0B;">Aguardando resultado</span>'}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        html += `</div></div>`;
    }
    
    container.innerHTML = html;
}
// Função para expandir/recolher dias
function toggleBetDay(sectionId) {
    const section = document.getElementById(sectionId);
    const arrow = document.getElementById(sectionId + 'Arrow');
    
    if (section && arrow) {
        section.classList.toggle('expanded');
        arrow.classList.toggle('rotated');
    }
}

window.toggleBetDay = toggleBetDay;

function openBetForm(gameId) {
    db.from('bet_games').select('*').eq('id', gameId).single().then(async ({ data: game }) => {
        if (!game) return;
        
        const user = await getCurrentUser();
        const { data: profile } = await db.from('profiles').select('fatcoins, fitcoins').eq('id', user.id).single();
        
        const currency = game.currency || 'fatcoins';
        const fatcoinBalance = profile?.fatcoins || 0;
        const fitcoinBalance = profile?.fitcoins || 0;
        
        let modal = document.getElementById('betFormModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'betFormModal';
            modal.className = 'modal open';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:420px;border-radius:20px;">
                    <div class="modal-header" style="background:#FFFFFF;border-radius:20px 20px 0 0;">
                        <h3>📝 Palpite Exato</h3>
                        <button class="icon-btn modal-close" onclick="document.getElementById('betFormModal').remove()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body" style="background:#FFFFFF;border-radius:0 0 20px 20px;" id="betFormBody"></div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            modal.classList.add('open');
        }
        
        let currencySelector = '';
        if (currency === 'both') {
            currencySelector = `
                <div class="bet-type-selector" style="margin-bottom:12px;">
                    <button class="bet-type-btn active" onclick="selectBetCurrency('fatcoins', '${gameId}')">🪙 FATCoins</button>
                    <button class="bet-type-btn" onclick="selectBetCurrency('fitcoins', '${gameId}')">💎 FitCoins</button>
                </div>
            `;
        }
        
        const displayCurrency = currency === 'fitcoins' ? 'fitcoins' : 'fatcoins';
        const balance = displayCurrency === 'fitcoins' ? fitcoinBalance : fatcoinBalance;
        const coinIcon = displayCurrency === 'fitcoins' ? '💎' : '🪙';
        const coinName = displayCurrency === 'fitcoins' ? 'FitCoins' : 'FATCoins';
        
        const body = document.getElementById('betFormBody');
        body.innerHTML = `
            <div class="bet-form-card bet-form-simple">
                <div class="bet-form-title">
                    ${game.team_a_flag || '⚽'} ${escapeHtml(game.team_a)} x ${escapeHtml(game.team_b)} ${game.team_b_flag || '⚽'}
                </div>
                <div class="bet-game-info">
                    <span>📅 ${formatDate(game.game_date)}</span>
                    <span>⏰ ${formatTime(game.game_date)}</span>
                </div>
                ${currency === 'both' ? currencySelector : ''}
                <div class="bet-balance" style="margin-top:12px;" id="betBalanceDisplay">
                    Seu saldo: <strong>${coinIcon} ${balance} ${coinName}</strong>
                </div>
                
                <div class="bet-score-simple">
                    <input type="number" id="betScoreA" min="0" max="20" value="0" placeholder="0" oninput="updateBetOdds()">
                    <span>x</span>
                    <input type="number" id="betScoreB" min="0" max="20" value="0" placeholder="0" oninput="updateBetOdds()">
                </div>
                
                <div style="text-align:center;margin:8px 0;font-size:0.85rem;color:#8E8E93;">
                    📊 Odd: <strong id="oddDisplay" style="color:#4F46E5;">1.5x</strong>
                </div>
                
                <div class="bet-amount-input">
                    <label>Valor da aposta (mín. 10 ${coinName})</label>
                    <div class="bet-amount-field">
                        <input type="number" id="betAmountSimple" min="10" max="${balance}" value="10" step="10" oninput="updateBetOdds()">
                        <span>${coinIcon} ${coinName}</span>
                    </div>
                </div>
                
                <div style="text-align:center;margin:4px 0 12px;font-size:0.9rem;">
                    💰 Retorno estimado: <strong id="returnDisplay" style="color:#10B981;">15</strong> ${coinIcon}
                </div>
                
                <button class="btn btn-primary btn-block" onclick="placeBetSimple('${game.id}', '${displayCurrency}')" style="border-radius:10px;padding:14px;">
                    ✅ Confirmar Palpite
                </button>
            </div>
        `;
        
        window._betGame = game;
        window._betCurrency = displayCurrency;
        
        // Inicializa a odd display
        updateBetOdds();
    });
}

// Atualiza odd e retorno em tempo real
function updateBetOdds() {
    const sa = parseInt(document.getElementById('betScoreA')?.value) || 0;
    const sb = parseInt(document.getElementById('betScoreB')?.value) || 0;
    const amount = parseInt(document.getElementById('betAmountSimple')?.value) || 10;
    
    const odd = calculateOdds(sa, sb);
    const returns = Math.floor(amount * odd);
    
    const oddDisplay = document.getElementById('oddDisplay');
    const returnDisplay = document.getElementById('returnDisplay');
    
    if (oddDisplay) oddDisplay.textContent = odd + 'x';
    if (returnDisplay) returnDisplay.textContent = returns;
}

// Calcula odd baseado no placar
function calculateOdds(scoreA, scoreB) {
    const diff = Math.abs(scoreA - scoreB);
    const total = scoreA + scoreB;
    
    if (scoreA === 0 && scoreB === 0) return 4;
    if (diff === 0 && total <= 2) return 4;
    if (diff === 0 && total > 2) return 6;
    if (diff >= 4) return 5;
    if (total >= 6 && diff <= 2) return 8;
    if (diff >= 3) return 4;
    if (diff === 2 && total >= 5) return 3;
    if (diff <= 1 && total >= 5) return 3;
    return 1.5;
}

window.updateBetOdds = updateBetOdds;
window.calculateOdds = calculateOdds;
// Seleciona moeda (quando both)
function selectBetCurrency(currency, gameId) {
    window._betCurrency = currency;
    document.querySelectorAll('.bet-type-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    getCurrentUser().then(async (user) => {
        const { data: profile } = await db.from('profiles').select('fatcoins, fitcoins').eq('id', user.id).single();
        const balance = currency === 'fitcoins' ? (profile?.fitcoins || 0) : (profile?.fatcoins || 0);
        const coinIcon = currency === 'fitcoins' ? '💎' : '🪙';
        const coinName = currency === 'fitcoins' ? 'FitCoins' : 'FATCoins';
        
        document.getElementById('betBalanceDisplay').innerHTML = `Seu saldo: <strong>${coinIcon} ${balance} ${coinName}</strong>`;
        document.getElementById('betAmountSimple').max = balance;
    });
}

window.selectBetCurrency = selectBetCurrency;
// Seleciona moeda (quando both)
function selectBetCurrency(currency, gameId) {
    window._betCurrency = currency;
    document.querySelectorAll('.bet-type-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    getCurrentUser().then(async (user) => {
        const { data: profile } = await db.from('profiles').select('fatcoins, fitcoins').eq('id', user.id).single();
        const balance = currency === 'fitcoins' ? (profile?.fitcoins || 0) : (profile?.fatcoins || 0);
        const coinIcon = currency === 'fitcoins' ? '💎' : '🪙';
        const coinName = currency === 'fitcoins' ? 'FitCoins' : 'FATCoins';
        
        document.getElementById('betBalanceDisplay').innerHTML = `Seu saldo: <strong>${coinIcon} ${balance} ${coinName}</strong>`;
        document.getElementById('betAmountSimple').max = balance;
    });
}

window.selectBetCurrency = selectBetCurrency;
// Seleciona tipo de aposta
function selectBetType(type, gameId) {
    window._betType = type;
    document.querySelectorAll('.bet-type-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('winnerPrediction').style.display = type === 'winner' ? 'block' : 'none';
    document.getElementById('scorePrediction').style.display = type === 'exact_score' ? 'flex' : 'none';
}

// Seleciona vencedor
function selectWinner(prediction, gameId) {
    window._betWinner = prediction;
    document.querySelectorAll('.bet-prediction-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// Faz a aposta
async function placeBet(gameId) {
    const user = await getCurrentUser();
    const amount = parseInt(document.getElementById('betAmount').value);
    const betType = window._betType;
    
    if (amount < 10) {
        showToast('Aposta mínima: 10 FATCoins', 'error');
        return;
    }
    
    const { data: profile } = await db.from('profiles').select('fatcoins').eq('id', user.id).single();
    if (amount > (profile?.fatcoins || 0)) {
        showToast('Saldo insuficiente!', 'error');
        return;
    }
    
    let prediction = '';
    let scoreA = null;
    let scoreB = null;
    
    if (betType === 'winner') {
        if (!window._betWinner) {
            showToast('Selecione um vencedor', 'error');
            return;
        }
        prediction = window._betWinner;
    } else {
        scoreA = parseInt(document.getElementById('scoreA').value) || 0;
        scoreB = parseInt(document.getElementById('scoreB').value) || 0;
        prediction = scoreA + 'x' + scoreB;
    }
    
    if (!confirm(`Confirmar aposta de ${amount} FATCoins?`)) return;
    
    const { error } = await db.from('bet_entries').insert({
        game_id: gameId,
        user_id: user.id,
        amount: amount,
        bet_type: betType,
        prediction: prediction,
        score_a: scoreA,
        score_b: scoreB
    });
    
    if (error) {
        if (error.message.includes('duplicate')) {
            showToast('Você já apostou neste jogo!', 'warning');
        } else {
            showToast('Erro: ' + error.message, 'error');
        }
    } else {
        showToast('✅ Aposta registrada! Boa sorte! 🍀', 'success');
        document.getElementById('betFormModal')?.remove();
        
        // Força recarregar tudo
        setTimeout(async () => {
            await updateBetBalance();
            await loadBetGames();
        }, 500);
    }
}

// Funções globais
window.selectBetType = selectBetType;
window.selectWinner = selectWinner;
window.placeBet = placeBet;
window.openBetForm = openBetForm;

async function updateBetBalance() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: profile } = await db.from('profiles').select('fatcoins, fitcoins').eq('id', user.id).single();
    const balanceEl = document.getElementById('betBalanceAmount');
    if (balanceEl) {
        balanceEl.innerHTML = `
            <div style="display:flex;justify-content:center;gap:24px;align-items:center;">
                <div>
                    <span style="font-size:1.5rem;">🪙</span>
                    <span style="font-weight:800;">${profile?.fatcoins || 0}</span>
                    <div style="font-size:0.7rem;opacity:0.8;">FATCoins</div>
                </div>
                <div style="width:1px;height:30px;background:rgba(255,255,255,0.3);"></div>
                <div>
                    <span style="font-size:1.5rem;">💎</span>
                    <span style="font-weight:800;">${profile?.fitcoins || 0}</span>
                    <div style="font-size:0.7rem;opacity:0.8;">FitCoins</div>
                </div>
            </div>
        `;
    }
    
    // Carrega minhas apostas
    const { data: myBets } = await db.from('bet_entries')
        .select('*, bet_games:game_id(team_a, team_b, team_a_flag, team_b_flag, game_date, status, score_a, score_b)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    
    const myBetsContainer = document.getElementById('myBetsContainer');
    if (myBetsContainer && myBets && myBets.length > 0) {
        myBetsContainer.innerHTML = myBets.map(b => {
            const game = b.bet_games;
            const coinIcon = b.currency === 'fitcoins' ? '💎' : '🪙';
            return `
                <div class="my-bet-card ${b.won ? 'my-bet-won' : game?.status === 'finished' ? 'my-bet-lost' : 'my-bet-pending'}">
                    <div class="my-bet-teams">
                        ${game?.team_a_flag || ''} ${escapeHtml(game?.team_a || '')} x ${escapeHtml(game?.team_b || '')} ${game?.team_b_flag || ''}
                    </div>
                    <div class="my-bet-info">
                        <span>${b.amount} ${coinIcon} • ${b.bet_type === 'exact_score' ? 'Placar: ' + (b.score_a || 0) + 'x' + (b.score_b || 0) : 'Vencedor'}</span>
                        ${b.won ? `<span style="color:#10B981;">+${b.amount_won} ${coinIcon}</span>` : game?.status === 'finished' ? '<span style="color:#EF4444;">Perdeu</span>' : '<span style="color:#F59E0B;">Aguardando</span>'}
                    </div>
                </div>
            `;
        }).join('');
    } else if (myBetsContainer) {
        myBetsContainer.innerHTML = '<p class="text-sm text-muted">Nenhuma aposta ainda</p>';
    }
}

// ============================================
// VISUALIZAÇÃO DETALHADA DA FOTO
// ============================================

async function openPhotoDetail(activityId) {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Busca dados completos da atividade
    const { data: activity } = await db.from('daily_activities')
        .select('*, profiles:user_id(name, avatar_url, user_level), challenges:challenge_id(name)')
        .eq('id', activityId)
        .single();
    
    if (!activity) return;
    
    // Busca curtidas com nomes
    const { data: likes } = await db.from('activity_likes')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false });
    
    // Busca comentários
    const { data: comments } = await db.from('activity_comments')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
    
    // Verifica se o usuário curtiu
    const { data: userLiked } = await db.from('activity_likes')
        .select('id').eq('activity_id', activityId).eq('user_id', user.id).maybeSingle();
    
    const isExtra = activity.is_extra === true;
    const isVideo = activity.photo_url && (activity.photo_url.endsWith('.webm') || activity.photo_url.includes('video'));
    
    // Cria o modal
    const existing = document.getElementById('photoDetailModal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'photoDetailModal';
    modal.className = 'photo-detail-modal open';
    modal.innerHTML = `
        <div class="photo-detail-bg" style="background-image: url('${activity.photo_url}')"></div>
        <div class="photo-detail-content">
            <div class="photo-detail-header">
                <button class="photo-detail-close" onclick="closePhotoDetail()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <span style="color:#fff;font-weight:600;">Detalhes</span>
                <div></div>
            </div>
            
            <div class="photo-detail-media-container">
                ${isVideo ? 
                    `<video src="${activity.photo_url}" controls autoplay class="photo-detail-video"></video>` :
                    `<img src="${activity.photo_url}" class="photo-detail-img" alt="Foto">`
                }
            </div>
            
            <div class="photo-detail-info-card">
                <div class="photo-detail-user-row">
                    <img src="${activity.profiles?.avatar_url || 'perfil_padrao.png'}" class="photo-detail-avatar">
                    <div>
                        <div style="font-weight:600;color:#1C1C1E;">
                            ${escapeHtml(activity.profiles?.name || 'Usuário')}
                            <span class="badge badge-info" style="font-size:0.6rem;">Nv.${activity.profiles?.user_level || 0}</span>
                            ${isExtra ? '<span class="badge badge-warning" style="font-size:0.6rem;">Extra</span>' : ''}
                        </div>
                        <div style="font-size:0.7rem;color:#8E8E93;">
                            📅 ${formatDate(activity.activity_date)} • 🎯 ${escapeHtml(activity.challenges?.name || 'Desafio')}
                        </div>
                    </div>
                    <span class="badge ${isExtra ? 'badge-secondary' : 'badge-success'}" style="font-size:0.7rem;">
                        ${isExtra ? '+0' : '+1 pt'}
                    </span>
                </div>
                
                ${activity.comment ? `
                    <div class="photo-detail-comment-author">
                        💬 ${escapeHtml(activity.comment)}
                    </div>
                ` : ''}
                
                ${activity.location?.lat ? `
                    <div class="photo-detail-location" id="detailLocation">
                        <i class="fas fa-map-pin"></i> Carregando endereço...
                    </div>
                ` : ''}
                
                <div class="photo-detail-actions">
                    <button class="photo-detail-action-btn ${userLiked ? 'liked' : ''}" onclick="toggleLikeFromDetail('${activityId}', this)">
                        <i class="${userLiked ? 'fas' : 'far'} fa-heart"></i>
                        <span>${likes?.length || 0}</span>
                    </button>
                    <button class="photo-detail-action-btn" onclick="focusDetailComment('${activityId}')">
                        <i class="far fa-comment"></i>
                        <span>${comments?.length || 0}</span>
                    </button>
                </div>
                
                ${likes?.length > 0 ? `
                    <div class="photo-detail-likes" onclick="showLikesList('${activityId}')">
                        Curtido por <strong>${escapeHtml(likes[0]?.profiles?.name || 'Alguém')}</strong>
                        ${likes.length > 1 ? ` e mais <strong>${likes.length - 1}</strong>` : ''}
                    </div>
                ` : ''}
            </div>
            
            <div class="photo-detail-comments-section">
                <div class="photo-detail-comments-list" id="detailCommentsList">
                    ${comments?.map(c => `
                        <div class="photo-detail-comment-item">
                            <img src="${c.profiles?.avatar_url || 'perfil_padrao.png'}" class="photo-detail-comment-avatar">
                            <div>
                                <span class="photo-detail-comment-name">${escapeHtml(c.profiles?.name || 'Usuário')}</span>
                                <span class="photo-detail-comment-text">${escapeHtml(c.comment)}</span>
                            </div>
                        </div>
                    `).join('') || '<p style="color:#8E8E93;text-align:center;padding:12px;">Nenhum comentário ainda</p>'}
                </div>
                
                <div class="photo-detail-comment-input">
                    <input type="text" id="detailCommentInput" placeholder="Adicione um comentário..." autocomplete="off">
                    <button onclick="addDetailComment('${activityId}')">Enviar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Carrega localização
    if (activity.location?.lat) {
        loadDetailLocation(activityId, activity.location.lat, activity.location.lng);
    }
}

// Fecha o modal
function closePhotoDetail() {
    const modal = document.getElementById('photoDetailModal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

// Curtir do modal
async function toggleLikeFromDetail(activityId, btn) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: existing } = await db.from('activity_likes')
        .select('id').eq('activity_id', activityId).eq('user_id', user.id).maybeSingle();
    
    if (existing) {
        await db.from('activity_likes').delete().eq('id', existing.id);
    } else {
        await db.from('activity_likes').insert({ activity_id: activityId, user_id: user.id });
    }
    
    // Recarrega o modal
    openPhotoDetail(activityId);
}

// Comentar do modal
async function addDetailComment(activityId) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const input = document.getElementById('detailCommentInput');
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    await db.from('activity_comments').insert({
        activity_id: activityId,
        user_id: user.id,
        comment: comment
    });
    
    // Recarrega o modal
    openPhotoDetail(activityId);
}

// Focar input de comentário
function focusDetailComment(activityId) {
    const input = document.getElementById('detailCommentInput');
    if (input) input.focus();
}

// Carregar localização no modal
async function loadDetailLocation(activityId, lat, lng) {
    const locEl = document.getElementById('detailLocation');
    if (!locEl) return;
    
    locEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando endereço...';
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`);
        const data = await res.json();
        
        if (data?.address) {
            const addr = data.address;
            const parts = [];
            
            // Nome do local (ponto de interesse)
            if (data.name && !data.name.match(/^\d/)) {
                parts.push('<strong>' + data.name + '</strong>');
            }
            
            // Endereço formatado
            const street = addr.road || addr.street || addr.pedestrian || '';
            const number = addr.house_number || '';
            const suburb = addr.suburb || addr.neighbourhood || addr.residential || '';
            const city = addr.city || addr.town || addr.municipality || addr.county || '';
            const state = addr.state || '';
            const country = addr.country || '';
            
            if (street) parts.push(street + (number ? ', ' + number : ''));
            if (suburb) parts.push(suburb);
            if (city || state) parts.push((city || '') + (city && state ? ', ' : '') + (state || ''));
            
            if (parts.length === 0) {
                parts.push(data.display_name || 'Localização registrada');
            }
            
            locEl.innerHTML = '<i class="fas fa-map-pin"></i> ' + parts.join(' • ');
        } else {
            locEl.innerHTML = '<i class="fas fa-map-pin"></i> 📍 Localização registrada';
        }
    } catch (e) {
        locEl.innerHTML = '<i class="fas fa-map-pin"></i> 📍 Localização registrada';
    }
}

// Funções globais
window.openPhotoDetail = openPhotoDetail;
window.closePhotoDetail = closePhotoDetail;
window.toggleLikeFromDetail = toggleLikeFromDetail;
window.addDetailComment = addDetailComment;
window.focusDetailComment = focusDetailComment;



async function placeBetSimple(gameId, currency) {
    const user = await getCurrentUser();
    
    const scoreAInput = document.getElementById('betScoreA');
    const scoreBInput = document.getElementById('betScoreB');
    const amountInput = document.getElementById('betAmountSimple');
    
    if (!scoreAInput || !scoreBInput || !amountInput) {
        showToast('Erro no formulário. Tente novamente.', 'error');
        return;
    }
    
    const scoreA = parseInt(scoreAInput.value) || 0;
    const scoreB = parseInt(scoreBInput.value) || 0;
    const amount = parseInt(amountInput.value);
    const betCurrency = window._betCurrency || currency || 'fatcoins';
    
    console.log('📊 Palpite:', scoreA, 'x', scoreB, '| Valor:', amount, '| Moeda:', betCurrency);
    
    if (amount < 10) {
        showToast('Aposta mínima: 10 ' + (betCurrency === 'fitcoins' ? 'FitCoins' : 'FATCoins'), 'error');
        return;
    }
    
    const { data: profile } = await db.from('profiles').select('fatcoins, fitcoins').eq('id', user.id).single();
    const balance = betCurrency === 'fitcoins' ? (profile?.fitcoins || 0) : (profile?.fatcoins || 0);
    
    if (amount > balance) {
        showToast('Saldo insuficiente!', 'error');
        return;
    }
    
    if (!confirm(`Confirmar palpite ${scoreA}x${scoreB} com ${amount} ${betCurrency === 'fitcoins' ? '💎 FitCoins' : '🪙 FATCoins'}?`)) return;
    
    const { error } = await db.from('bet_entries').insert({
        game_id: gameId,
        user_id: user.id,
        amount: amount,
        bet_type: 'exact_score',
        prediction: scoreA + 'x' + scoreB,
        score_a: scoreA,
        score_b: scoreB,
        currency: betCurrency
    });
    
    if (error) {
        if (error.message.includes('duplicate')) {
            showToast('Você já apostou neste jogo!', 'warning');
        } else {
            showToast('Erro: ' + error.message, 'error');
        }
    } else {
        // Desconta a moeda correta
        if (betCurrency === 'fitcoins') {
            await db.from('profiles').update({ fitcoins: balance - amount }).eq('id', user.id);
        } else {
            await db.from('profiles').update({ fatcoins: balance - amount }).eq('id', user.id);
        }
        
        showToast('✅ Palpite registrado! Boa sorte! 🍀', 'success');
        document.getElementById('betFormModal')?.remove();
        setTimeout(() => openGameDetail(gameId), 500);
    }
}
window.placeBetSimple = placeBetSimple;

async function openGameDetail(gameId) {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Busca dados do jogo
    const { data: game } = await db.from('bet_games').select('*').eq('id', gameId).single();
    if (!game) return;
    
    const gameStarted = new Date(game.game_date) < new Date();
    
    const { data: myBet } = await db.from('bet_entries')
        .select('*').eq('game_id', gameId).eq('user_id', user.id).maybeSingle();
    
    if (!gameStarted && !myBet) {
        showToast('Faça uma aposta para ver os palpites!', 'info');
        openBetForm(gameId);
        return;
    }
    
    const { data: entries } = await db.from('bet_entries')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
    
    const { data: comments } = await db.from('bet_comments')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
    
    const existing = document.getElementById('gameDetailScreen');
    if (existing) existing.remove();
    
    const currency = game.currency || 'fatcoins';
    const isFitcoinGame = currency === 'fitcoins';
    const isBothGame = currency === 'both';
    
    // Informação de moeda/pote
    let currencyHeader = '';
    if (isFitcoinGame) {
        currencyHeader = `
            <div style="font-size:0.85rem;margin-top:4px;color:#00BCD4;">
                💎 Aposta com FitCoins • Odds: 1.5x a 8x
            </div>
        `;
    } else if (isBothGame) {
        currencyHeader = `
            <div style="font-size:0.85rem;margin-top:4px;color:#8E8E93;">
                🪙 FATCoins ou 💎 FitCoins
            </div>
        `;
    } else {
        currencyHeader = `
            <div class="game-result-pot">💰 Pote: ${game.pot_total || 0} 🪙 FATCoins • 👥 ${game.total_bets || 0} palpites</div>
        `;
    }
    
    // Contagem de palpites para FitCoins
    const betsCount = entries?.length || 0;
    if (isFitcoinGame || isBothGame) {
        currencyHeader += `
            <div style="font-size:0.8rem;color:#8E8E93;margin-top:2px;">👥 ${betsCount} palpites</div>
        `;
    }
    
    const screen = document.createElement('div');
    screen.id = 'gameDetailScreen';
    screen.className = 'game-detail-screen';
    screen.innerHTML = `
        <div class="game-detail-header">
            <button class="body-back-btn" onclick="document.getElementById('gameDetailScreen').remove()">
                <i class="fas fa-chevron-left"></i>
            </button>
            <h3 style="font-size:1rem;font-weight:700;">Palpites</h3>
            <div style="width:36px;"></div>
        </div>
        <div class="game-detail-body">
            <div class="game-result-card">
                <div class="game-result-teams">
                    <span class="game-result-flag">${game.team_a_flag || '⚽'}</span>
                    ${game.status === 'finished' ? 
                        `<span class="game-result-score">${game.score_a || 0} x ${game.score_b || 0}</span>` :
                        '<span style="font-size:1.5rem;">VS</span>'}
                    <span class="game-result-flag">${game.team_b_flag || '⚽'}</span>
                </div>
                <div style="font-size:0.85rem;">${escapeHtml(game.team_a)} vs ${escapeHtml(game.team_b)}</div>
                <div class="game-result-info">
                    📅 ${formatDate(game.game_date)} ⏰ ${formatTime(game.game_date)}
                    ${game.status === 'finished' ? ' • Finalizado' : game.status === 'open' ? (gameStarted ? ' • Em andamento' : ' • Aberto') : ' • Encerrado'}
                </div>
                ${currencyHeader}
            </div>
            
            <div class="bets-list-card">
                <div class="bets-list-title">📝 Palpites (${betsCount})</div>
                ${entries?.map(e => {
                    const betCurrency = e.currency || 'fatcoins';
                    const coinIcon = betCurrency === 'fitcoins' ? '💎' : '🪙';
                    const coinName = betCurrency === 'fitcoins' ? 'FitCoins' : 'FATCoins';
                    const odd = calculateOdds(e.score_a || 0, e.score_b || 0);
                    const estimatedReturn = Math.floor(e.amount * odd);
                    
                    return `
                        <div class="bet-entry-row ${e.user_id === user.id ? 'mine' : ''}">
                            <img src="${e.profiles?.avatar_url || 'perfil_padrao.png'}" class="bet-entry-avatar">
                            <div style="flex:1;">
                                <span class="bet-entry-name">${escapeHtml(e.profiles?.name || 'Usuário')} ${e.user_id === user.id ? '(você)' : ''}</span>
                                <div style="font-size:0.7rem;color:#8E8E93;">
                                    Odd: ${odd}x • Retorno: ${estimatedReturn} ${coinIcon}
                                </div>
                            </div>
                            <span class="bet-entry-score">${e.score_a || 0} x ${e.score_b || 0}</span>
                            <span class="bet-entry-amount">${e.amount}${coinIcon}</span>
                            ${game.status === 'finished' ? 
                                (e.won ? '<span class="bet-entry-result bet-entry-won">+'+e.amount_won+'</span>' : 
                                         '<span class="bet-entry-result bet-entry-lost">Errou</span>') :
                                '<span class="bet-entry-result bet-entry-pending">Aguardando</span>'}
                        </div>
                    `;
                }).join('') || '<p style="text-align:center;color:#8E8E93;">Nenhum palpite ainda</p>'}
            </div>
            
            ${myBet ? `
                <div class="game-comments-card">
                    <div class="game-comments-title">💬 Comentários (${comments?.length || 0})</div>
                    ${comments?.map(c => `
                        <div class="game-comment-item">
                            <img src="${c.profiles?.avatar_url || 'perfil_padrao.png'}" class="game-comment-avatar">
                            <div>
                                <span class="game-comment-name">${escapeHtml(c.profiles?.name || 'Usuário')}</span>
                                <span class="game-comment-text">${escapeHtml(c.comment)}</span>
                                <div class="game-comment-time">${formatTime(c.created_at)}</div>
                            </div>
                        </div>
                    `).join('') || '<p style="color:#8E8E93;text-align:center;padding:12px;">Nenhum comentário ainda</p>'}
                    
                    <div class="game-comment-input">
                        <input type="text" id="gameCommentInput" placeholder="Comente sobre o jogo..." autocomplete="off">
                        <button onclick="addGameComment('${gameId}')">Enviar</button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    document.body.appendChild(screen);
} 
// Comentar no jogo
async function addGameComment(gameId) {
    const user = await getCurrentUser();
    const input = document.getElementById('gameCommentInput');
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    await db.from('bet_comments').insert({
        game_id: gameId,
        user_id: user.id,
        comment: comment
    });
    
    input.value = '';
    openGameDetail(gameId); // Recarrega
}

window.openGameDetail = openGameDetail;
window.addGameComment = addGameComment;
window.placeBetSimple = placeBetSimple;


// ============================================
// COMPRA DE FITCOINS - MERCADO PAGO
// ============================================

if (window.location.pathname.includes('buy')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await loadBuyPage();
    });
}

let selectedPackage = null;

async function loadBuyPage() {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Atualiza saldos
    const { data: profile } = await db.from('profiles').select('fatcoins, fitcoins').eq('id', user.id).single();
    const balanceEl = document.getElementById('buyBalanceAmount');
    if (balanceEl) {
        balanceEl.innerHTML = `
            <div style="display:flex;justify-content:center;gap:24px;align-items:center;">
                <div>
                    <span style="font-size:1.5rem;">🪙</span>
                    <span style="font-weight:800;">${profile?.fatcoins || 0}</span>
                    <div style="font-size:0.7rem;">FATCoins</div>
                </div>
                <div style="width:1px;height:30px;background:rgba(255,255,255,0.3);"></div>
                <div>
                    <span style="font-size:1.5rem;">💎</span>
                    <span style="font-weight:800;">${profile?.fitcoins || 0}</span>
                    <div style="font-size:0.7rem;">FitCoins</div>
                </div>
            </div>
        `;
    }
    
    // Carrega pacotes
    const { data: packages } = await db.from('fatcoin_packages')
        .select('*')
        .eq('active', true)
        .order('price_cents', { ascending: true });
    
    const grid = document.getElementById('packagesGrid');
    if (!packages || packages.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center">Nenhum pacote disponível</p>';
        return;
    }
    
    grid.innerHTML = packages.map((p, i) => `
        <div class="package-card ${i === 2 ? 'recommended' : ''}" onclick="selectPackage('${p.id}', ${p.price_cents}, this)" data-id="${p.id}">
            ${i === 2 ? '<div class="package-badge">MAIS POPULAR</div>' : ''}
            <div class="package-amount">💎 ${p.amount}</div>
            <div class="package-label">${p.name}</div>
            <div class="package-price">R$ ${(p.price_cents / 100).toFixed(2).replace('.', ',')}</div>
        </div>
    `).join('');
    
    // Carrega histórico de pedidos
    const { data: orders } = await db.from('fatcoin_orders')
        .select('*, packages:package_id(name, amount)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
    
    const history = document.getElementById('orderHistory');
    if (orders && orders.length > 0) {
        history.innerHTML = orders.map(o => {
            let statusIcon = '';
            let statusClass = '';
            let statusText = '';
            
            switch (o.status) {
                case 'paid':
                    statusIcon = '✅';
                    statusClass = 'status-paid';
                    statusText = 'Pago';
                    break;
                case 'pending':
                    statusIcon = '⏳';
                    statusClass = 'status-pending';
                    statusText = 'Pendente';
                    break;
                case 'expired':
                    statusIcon = '⏰';
                    statusClass = 'status-expired';
                    statusText = 'Expirado';
                    break;
                case 'cancelled':
                    statusIcon = '❌';
                    statusClass = 'status-expired';
                    statusText = 'Cancelado';
                    break;
            }
            
            return `
                <div class="order-history-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span class="order-history-amount">💎 ${o.amount} FitCoins</span>
                            <span style="font-size:0.8rem;color:#1C1C1E;margin-left:8px;">R$ ${(o.price_cents / 100).toFixed(2).replace('.', ',')}</span>
                        </div>
                        <span class="order-history-status ${statusClass}">${statusIcon} ${statusText}</span>
                    </div>
                    <div class="order-history-date">${formatDate(o.created_at)} • ${formatTime(o.created_at)}</div>
                    ${o.payment_method ? `<div style="font-size:0.7rem;color:#8E8E93;">Pix</div>` : ''}
                </div>
            `;
        }).join('');
    } else {
        history.innerHTML = '<p class="text-sm text-muted">Nenhuma compra ainda</p>';
    }
    
    // Verifica se tem pedido pendente
    const { data: pendingOrder } = await db.from('fatcoin_orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (pendingOrder) {
        showQRSection(pendingOrder);
        checkPaymentStatus(pendingOrder.id, pendingOrder.mp_payment_id);
    }
}
function selectPackage(packageId, priceCents, element) {
    document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    selectedPackage = { id: packageId, price_cents: priceCents };
    
    // Gera QR Code automaticamente
    generatePixPayment(packageId, priceCents);
}

async function generatePixPayment(packageId, priceCents) {
    const user = await getCurrentUser();
    if (!user) return;
    
    // Busca dados do pacote
    const { data: pkg } = await db.from('fatcoin_packages').select('amount, name').eq('id', packageId).single();
    
    // Mostra tela de confirmação antes de gerar o Pix
    const confirmModal = document.createElement('div');
    confirmModal.id = 'confirmPixModal';
    confirmModal.className = 'modal open';
    confirmModal.innerHTML = `
        <div class="modal-content" style="max-width:400px;border-radius:20px;">
            <div class="modal-header" style="background:#FFFFFF;border-radius:20px 20px 0 0;">
                <h3>📋 Confirmar Pedido</h3>
                <button class="icon-btn modal-close" onclick="document.getElementById('confirmPixModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" style="background:#FFFFFF;border-radius:0 0 20px 20px;text-align:center;">
                <div style="font-size:3rem;margin-bottom:12px;">💎</div>
                <div style="font-size:1.2rem;font-weight:700;color:#1C1C1E;margin-bottom:4px;">
                    ${pkg?.name || 'FitCoins'}
                </div>
                <div style="font-size:2rem;font-weight:800;color:#F59E0B;margin-bottom:4px;">
                    ${pkg?.amount || 0} 💎
                </div>
                <div style="font-size:1.5rem;font-weight:700;color:#1C1C1E;margin-bottom:16px;">
                    R$ ${(priceCents / 100).toFixed(2).replace('.', ',')}
                </div>
                <div style="font-size:0.8rem;color:#8E8E93;margin-bottom:16px;">
                    Pagamento via Pix • Aprovação em até 30 segundos
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-outline btn-block" onclick="document.getElementById('confirmPixModal').remove()" style="flex:1;">
                        ❌ Cancelar
                    </button>
                    <button class="btn btn-primary btn-block" onclick="document.getElementById('confirmPixModal').remove(); processPixPayment('${packageId}', ${priceCents})" style="flex:1;">
                        ✅ Confirmar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(confirmModal);
}

// Função separada para processar o pagamento após confirmação
async function processPixPayment(packageId, priceCents) {
    const user = await getCurrentUser();
    if (!user) return;
    
    showToast('📱 Gerando QR Code Pix...', 'info');
    
    try {
        const response = await fetch(`${window.SUPABASE_URL}/functions/v1/create-pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: priceCents / 100,
                email: user.email,
                name: user.user_metadata?.name || 'Usuário'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao gerar Pix');
        }
        
        const data = await response.json();
        console.log('📱 Order:', data);
        
        if (data.qr_code) {
            const { data: pkg } = await db.from('fatcoin_packages').select('amount').eq('id', packageId).single();
            const fitcoinAmount = pkg?.amount || 10;
            
            const { data: order, error } = await db.from('fatcoin_orders').insert({
                user_id: user.id,
                package_id: packageId,
                amount: fitcoinAmount,
                price_cents: priceCents,
                pix_code: data.qr_code,
                pix_qr: data.qr_code_base64,
                mp_payment_id: data.id,
                status: 'pending'
            }).select().single();
            
            if (error) {
                console.error('Erro ao salvar pedido:', error);
                showToast('Erro ao criar pedido. Tente novamente.', 'error');
                return;
            }
            
            if (order) {
                showQRSection(order);
                checkPaymentStatus(order.id, data.id);
                showToast('✅ QR Code gerado! Escaneie ou copie o código.', 'success');
            }
        } else {
            console.error('Resposta inesperada:', data);
            showToast('Erro ao gerar QR Code. Tente novamente.', 'error');
        }
    } catch (e) {
        console.error('Erro Pix:', e);
        const errorMsg = e.message || 'Erro ao processar pagamento. Tente novamente.';
        showToast('❌ ' + errorMsg, 'error');
    }
}

window.processPixPayment = processPixPayment;


function showQRSection(order) {
    const qrSection = document.getElementById('qrSection');
    if (!qrSection) return;
    
    qrSection.style.display = 'block';
    
    const priceFormatted = (order.price_cents / 100).toFixed(2).replace('.', ',');
    
    qrSection.innerHTML = `
        <div class="qr-container" style="background:#FFFFFF;border-radius:16px;margin-bottom:16px;">
            <h3 style="font-size:0.9rem;font-weight:700;color:#1C1C1E;margin-bottom:16px;">📱 Pagamento via Pix</h3>
            
            ${order.pix_qr ? `
                <img src="data:image/png;base64,${order.pix_qr}" class="qr-code-img" alt="QR Code Pix" style="width:200px;height:200px;margin:0 auto;display:block;">
            ` : `
                <div style="width:200px;height:200px;margin:0 auto;display:flex;align-items:center;justify-content:center;background:#F9FAFB;border-radius:16px;">
                    <i class="fas fa-qrcode" style="font-size:4rem;color:#E5E5EA;"></i>
                </div>
            `}
            
            <div class="qr-code-value">R$ ${priceFormatted}</div>
            <div class="qr-code-info">Escaneie o QR Code ou copie o código Pix abaixo</div>
            
            <div class="pix-copy-container">
                <div class="pix-copy-label">Código Pix (copia e cola)</div>
                <div class="pix-copy-code" id="pixCode">${order.pix_code || 'Gerando código...'}</div>
                <button class="btn-copy-pix" onclick="copyPixCode()">
                    <i class="fas fa-copy"></i> Copiar código Pix
                </button>
            </div>
            
            <div class="payment-status" id="paymentStatus">
                <div class="payment-status-icon">⏳</div>
                <div class="payment-status-title">Aguardando pagamento</div>
                <div class="payment-status-text">O Pix expira em 30 minutos</div>
            </div>
            
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F2F2F7;">
                <p style="font-size:0.75rem;color:#8E8E93;text-align:center;">
                    Após o pagamento, seus 💎 FitCoins serão creditados automaticamente.
                </p>
                <button class="btn btn-text btn-sm" onclick="cancelOrder('${order.id}')" style="margin-top:8px;color:#EF4444;">
                    ❌ Cancelar pedido
                </button>
            </div>
        </div>
    `;
    
    // Scroll suave até o QR Code
    qrSection.scrollIntoView({ behavior: 'smooth' });
}

// Cancela um pedido pendente
async function cancelOrder(orderId) {
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;
    
    const { error } = await db.from('fatcoin_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('status', 'pending');
    
    if (error) {
        showToast('Erro ao cancelar pedido', 'error');
    } else {
        showToast('Pedido cancelado', 'info');
        document.getElementById('qrSection').style.display = 'none';
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
    }
}

window.cancelOrder = cancelOrder;

async function checkPaymentStatus(orderId, orderMpId) {
    let attempts = 0;
    const maxAttempts = 30;
    
    // Verifica se já foi processado
    const { data: existingOrder } = await db.from('fatcoin_orders')
        .select('status')
        .eq('id', orderId)
        .single();
    
    if (existingOrder?.status === 'paid') {
        document.getElementById('paymentStatus').innerHTML = `
            <div class="payment-status-icon">✅</div>
            <div class="payment-status-title">Pagamento já confirmado!</div>
            <div class="payment-status-text">Seus FitCoins já foram creditados.</div>
        `;
        return;
    }
    
    // Status inicial
    document.getElementById('paymentStatus').innerHTML = `
        <div class="payment-status-icon">⏳</div>
        <div class="payment-status-title">Aguardando pagamento</div>
        <div class="payment-status-text">O Pix expira em 30 minutos</div>
    `;
    
    const interval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch(`${window.SUPABASE_URL}/functions/v1/check-pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderMpId })
            });
            
            if (!response.ok) {
                console.error('Erro na verificação:', response.status);
                return;
            }
            
            const data = await response.json();
            console.log('📱 Check:', data);
            
            if (data.status === 'approved' || data.payment_status === 'approved' || 
                data.status === 'processed' || data.payment_status === 'processed') {
                clearInterval(interval);
                
                // Verifica NOVAMENTE se já foi pago (evita duplicata)
                const { data: checkOrder } = await db.from('fatcoin_orders')
                    .select('status')
                    .eq('id', orderId)
                    .single();
                
                if (checkOrder?.status === 'paid') return;
                
                // Marca como pago
                await db.from('fatcoin_orders').update({ 
                    status: 'paid', 
                    paid_at: new Date().toISOString() 
                }).eq('id', orderId);
                
                const { data: order } = await db.from('fatcoin_orders')
                    .select('amount, user_id')
                    .eq('id', orderId)
                    .single();
                
                if (order) {
                    const { data: profile } = await db.from('profiles')
                        .select('fitcoins')
                        .eq('id', order.user_id)
                        .single();
                    
                    const newBalance = (profile?.fitcoins || 0) + order.amount;
                    await db.from('profiles').update({ fitcoins: newBalance }).eq('id', order.user_id);
                }
                
                document.getElementById('paymentStatus').innerHTML = `
                    <div class="payment-status-icon">✅</div>
                    <div class="payment-status-title">Pagamento confirmado!</div>
                    <div class="payment-status-text">+${order?.amount || ''} 💎 FitCoins creditados com sucesso</div>
                `;
                
                showToast('✅ Pagamento aprovado! FitCoins creditados.', 'success');
                setTimeout(() => location.reload(), 2000);
            }
        } catch (e) {
            console.error('Erro ao verificar pagamento:', e);
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(interval);
            document.getElementById('paymentStatus').innerHTML = `
                <div class="payment-status-icon">⏰</div>
                <div class="payment-status-title">QR Code expirado</div>
                <div class="payment-status-text">O tempo de pagamento acabou. Gere um novo QR Code.</div>
            `;
            showToast('⏰ QR Code expirado. Gere um novo.', 'warning');
        }
    }, 10000);
}

function copyPixCode() {
    const code = document.getElementById('pixCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('✅ Código Pix copiado!', 'success');
    });
}

window.selectPackage = selectPackage;
window.copyPixCode = copyPixCode;


// Calcula odd baseado no placar
function calculateOdds(scoreA, scoreB) {
    const diff = Math.abs(scoreA - scoreB);
    const total = scoreA + scoreB;
    
    if (scoreA === 0 && scoreB === 0) return 4;     // 0x0
    if (diff === 0 && total <= 2) return 4;          // 1x1
    if (diff === 0 && total > 2) return 6;           // 2x2, 3x3
    if (diff >= 4) return 5;                          // Goleada
    if (total >= 6 && diff <= 2) return 8;           // 4x2, 5x1, 4x3
    if (diff >= 3) return 4;                          // 3x0, 4x1
    if (diff === 2 && total >= 5) return 3;           // 3x1, 4x2
    if (diff <= 1 && total >= 5) return 3;            // 3x2, 4x3
    return 1.5;                                        // Placar comum
}


// ============================================
// PÁGINA: cup.html - CHAVEAMENTO DA COPA
// ============================================

if (window.location.pathname.includes('cup')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await loadCupData();
    });
}

let cupTeams = [];
let simulationTournament = null;
let originalTournament = null;
let simulationHistory = [];
const centerX = 500;
const centerY = 500;

async function loadCupData() {
    const { data: teams } = await db.from('cup_teams')
        .select('*')
        .order('group_name', { ascending: true })
        .order('position', { ascending: true });
    
    if (!teams || teams.length === 0) {
        console.log('Nenhum time cadastrado');
        return;
    }
    
    cupTeams = teams;
    
    const tournament = [
        teams.filter(t => t.round === 0).map(t => ({
            id: t.id,
            name: t.team_name,
            flag: t.team_flag,
            status: t.status
        })),
        teams.filter(t => t.round === 1).map(t => ({
            id: t.id,
            name: t.team_name,
            flag: t.team_flag,
            status: t.status
        })),
        teams.filter(t => t.round === 2).map(t => ({
            id: t.id,
            name: t.team_name,
            flag: t.team_flag,
            status: t.status || 'pending'
        })),
        teams.filter(t => t.round === 3).map(t => ({
            id: t.id,
            name: t.team_name,
            flag: t.team_flag,
            status: t.status || 'pending'
        })),
        teams.filter(t => t.round === 4).map(t => ({
            id: t.id,
            name: t.team_name,
            flag: t.team_flag,
            status: t.status || 'pending'
        })),
        teams.filter(t => t.round === 5).map(t => ({
            id: t.id,
            name: t.team_name,
            flag: t.team_flag,
            status: t.status || 'pending'
        }))
    ];
    
    const expectedSlots = [32, 16, 8, 4, 2, 1];
    for (let r = 0; r < 6; r++) {
        while (tournament[r].length < expectedSlots[r]) {
            tournament[r].push({ id: null, name: '', flag: '', status: 'pending' });
        }
    }
    
    originalTournament = JSON.parse(JSON.stringify(tournament));
    simulationTournament = JSON.parse(JSON.stringify(tournament));
    
    renderTournament(simulationTournament);
}



function simulateAdvance(round, index) {
    if (round >= 5) return;
    
    const currentSlot = simulationTournament[round][index];
    
    // Verificações
    if (!currentSlot || currentSlot.name === '') return;
    if (currentSlot.status === 'eliminated') return;
    if (currentSlot.status === 'pending') return;
    
    const parentIndex = Math.floor(index / 2);
    
    // Verifica se já tem resultado oficial
    const originalParent = originalTournament[round + 1]?.[parentIndex];
    if (originalParent && originalParent.name !== '' && originalParent.status !== 'pending') {
        showToast('Este jogo já tem resultado oficial!', 'warning');
        return;
    }
    
    // O adversário precisa existir (não pode avançar sozinho)
    const siblingIndex = (index % 2 === 0) ? index + 1 : index - 1;
    const siblingSlot = simulationTournament[round][siblingIndex];
    
    if (!siblingSlot || siblingSlot.name === '' || siblingSlot.status === 'pending') {
        showToast('Este jogo ainda não tem adversário definido!', 'warning');
        return;
    }
    
    // Salva estado antes de modificar
    simulationHistory.push(JSON.parse(JSON.stringify(simulationTournament)));
    
    // Avança o time
    simulationTournament[round + 1][parentIndex] = {
        id: currentSlot.id,
        name: currentSlot.name,
        flag: currentSlot.flag,
        status: 'active'
    };
    
    // Elimina o adversário
    simulationTournament[round][siblingIndex].status = 'eliminated';
    simulationTournament[round][index].status = 'active';
    
    renderTournament(simulationTournament);
    showToast(`🔄 Simulação: ${currentSlot.name} avançou!`, 'info');
}

function undoLastAdvance() {
    if (simulationHistory.length === 0) {
        showToast('Nada para desfazer', 'warning');
        return;
    }
    
    simulationTournament = simulationHistory.pop();
    renderTournament(simulationTournament);
    showToast('↩ Último avanço desfeito', 'info');
}
window.undoLastAdvance = undoLastAdvance;

function resetSimulation() {
    simulationTournament = JSON.parse(JSON.stringify(originalTournament));
    renderTournament(simulationTournament);
    showToast('🔄 Simulação resetada aos dados oficiais', 'info');
}
window.resetSimulation = resetSimulation;

function getRadius(round) {
    return 440 - (round * 78);
}

function getAngle(round, index) {
    const slotsInRound = 32 / Math.pow(2, round);
    return (Math.pow(2, round) * index + (Math.pow(2, round) - 1) / 2) * (360 / 32);
}

function polarToCartesian(r, angleDegrees) {
    const angleRadians = (angleDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (r * Math.cos(angleRadians)),
        y: centerY + (r * Math.sin(angleRadians))
    };
}

function renderTournament(tournament) {
    const linksGroup = document.getElementById('links-group');
    const nodesGroup = document.getElementById('nodes-group');
    const clipDefs = document.getElementById('clip-defs');
    
    if (!linksGroup || !nodesGroup || !clipDefs) return;
    
    linksGroup.innerHTML = '';
    nodesGroup.innerHTML = '';
    clipDefs.innerHTML = '';

    for (let r = 0; r <= 5; r++) {
        const rad = r === 5 ? 55 : 24 + (r * 3.5);
        clipDefs.innerHTML += `<clipPath id="clip-round-${r}"><circle r="${rad}" cx="0" cy="0" /></clipPath>`;
    }

    // ========== ETAPA 1: Mostrar todas as 32 seleções primeiro ==========
    
    // Linhas (invisíveis no início)
    for (let r = 0; r < 4; r++) {
        const slots = 32 / Math.pow(2, r);
        for (let i = 0; i < slots; i++) {
            const childSlot = tournament[r][i];
            const parentIndex = Math.floor(i / 2);
            const parentSlot = tournament[r + 1][parentIndex];

            const angleChild = getAngle(r, i);
            const angleParent = getAngle(r + 1, parentIndex);
            const rChild = getRadius(r);
            const rParent = getRadius(r + 1);
            const rMid = (rChild + rParent) / 2;
            const p1 = polarToCartesian(rChild, angleChild);
            const pMid1 = polarToCartesian(rMid, angleChild);
            const pMid2 = polarToCartesian(rMid, angleParent);
            const p2 = polarToCartesian(rParent, angleParent);
            const sweepFlag = angleChild < angleParent ? 1 : 0;
            const d = `M ${p1.x} ${p1.y} L ${pMid1.x} ${pMid1.y} A ${rMid} ${rMid} 0 0 ${sweepFlag} ${pMid2.x} ${pMid2.y} L ${p2.x} ${p2.y}`;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', 'link-pending');
            path.style.opacity = '0';
            linksGroup.appendChild(path);
        }
    }

    // Linha final
    for (let i = 0; i < 2; i++) {
        const p1 = polarToCartesian(getRadius(4), getAngle(4, i));
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${p1.x} ${p1.y} L ${centerX} ${centerY}`);
        path.setAttribute('class', 'link-pending');
        path.style.opacity = '0';
        linksGroup.appendChild(path);
    }

    // Nós do round 0 (32 times)
    const allNodes = [];
    
    for (let r = 0; r < 5; r++) {
        const slots = 32 / Math.pow(2, r);
        const radiusNode = 24 + (r * 3.5);

        for (let i = 0; i < slots; i++) {
            const slot = tournament[r][i];
            const pos = polarToCartesian(getRadius(r), getAngle(r, i));

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            g.setAttribute('class', 'node-group pending');
            g.style.opacity = '0';
            g.style.transition = 'all 0.6s ease';

            if (slot.name !== '' && slot.status === 'active') {
                g.setAttribute('onclick', `simulateAdvance(${r}, ${i})`);
                g.style.cursor = 'pointer';
            }

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', radiusNode);
            circle.setAttribute('class', 'node-circle');
            g.appendChild(circle);

            if (slot.name !== '') {
                const gClip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                gClip.setAttribute('clip-path', `url(#clip-round-${r})`);
                const textEmoji = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                textEmoji.setAttribute('x', '0');
                textEmoji.setAttribute('y', '2');
                textEmoji.setAttribute('text-anchor', 'middle');
                textEmoji.setAttribute('class', 'node-emoji');
                textEmoji.style.fontSize = `${radiusNode * 2.8}px`;
                textEmoji.textContent = slot.flag;
                gClip.appendChild(textEmoji);
                g.appendChild(gClip);

                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                title.textContent = slot.name;
                g.appendChild(title);
            }
            
            nodesGroup.appendChild(g);
            allNodes.push({ node: g, slot, r, i });
        }
    }

    // Centro
    const champ = tournament[5][0];
    const radiusNode = 55;
    const centerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    centerG.setAttribute('transform', `translate(${centerX}, ${centerY})`);
    centerG.style.opacity = '0';
    centerG.style.transition = 'opacity 0.8s ease';

    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('r', radiusNode);

    if (champ.name === '') {
        centerG.setAttribute('class', 'node-group pending');
        centerCircle.setAttribute('class', 'node-circle center-circle');
        centerG.appendChild(centerCircle);
        const textTrophy = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textTrophy.setAttribute('y', '12');
        textTrophy.setAttribute('text-anchor', 'middle');
        textTrophy.style.fontSize = '40px';
        textTrophy.textContent = '🏆';
        centerG.appendChild(textTrophy);
    }
    nodesGroup.appendChild(centerG);

    // ========== ANIMAÇÃO EM 3 ETAPAS ==========
    
    // ETAPA 1: Aparecem todos os 32 times (0.5s)
    setTimeout(() => {
        allNodes.forEach(({ node }) => {
            node.style.opacity = '1';
            node.setAttribute('class', 'node-group active');
        });
    }, 300);

    // ETAPA 2: Eliminados esmaecem E classificados brilham (após 1.5s)
    setTimeout(() => {
        allNodes.forEach(({ node, slot }) => {
            if (slot.status === 'eliminated') {
                node.style.opacity = '0.25';
                node.style.filter = 'grayscale(100%)';
                node.setAttribute('class', 'node-group eliminated');
            }
            if (slot.round === 1 && slot.status === 'active') {
                node.style.filter = 'drop-shadow(0px 0px 15px rgba(255,204,0,0.9))';
                node.setAttribute('class', 'node-group active');
                // Brilho some após 1s
                setTimeout(() => {
                    node.style.filter = '';
                }, 1000);
            }
        });
    }, 1500);

    // ETAPA 3: Centro aparece (após 2s)
    setTimeout(() => {
        centerG.style.opacity = '1';
    }, 2000);
    
    // Revela linhas gradualmente
    setTimeout(() => {
        document.querySelectorAll('#links-group path').forEach((path, i) => {
            setTimeout(() => {
                path.style.opacity = '1';
            }, i * 30);
        });
    }, 500);
    
    addResetButton();
}


function addResetButton() {
    const existingBar = document.getElementById('simBtns');
    if (existingBar) existingBar.remove();
    
    const isSimulating = JSON.stringify(simulationTournament) !== JSON.stringify(originalTournament);
    const hasChampion = simulationTournament[5][0]?.name !== '';
    
    if (isSimulating || simulationHistory.length > 0) {
        const btnBar = document.createElement('div');
        btnBar.id = 'simBtns';
        btnBar.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        `;
        
        const btnStyle = `
            background: #ffcc00;
            color: #0b0c10;
            border: none;
            padding: 10px 18px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.8rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(255,204,0,0.4);
            white-space: nowrap;
        `;
        
        btnBar.innerHTML = `
            <div style="display:flex;gap:8px;">
                <button style="${btnStyle}" onclick="event.stopPropagation(); resetSimulation()">🔄 Resetar</button>
                <button style="${btnStyle}" onclick="event.stopPropagation(); undoLastAdvance()">↩ Desfazer</button>
            </div>
            ${hasChampion ? `
                <div style="
                    color: #ffcc00;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-align: center;
                    background: rgba(0,0,0,0.7);
                    padding: 8px 16px;
                    border-radius: 12px;
                    animation: pulse 2s infinite;
                ">
                    📸 Tire print da tela e compartilhe sua previsão final!
                </div>
            ` : ''}
        `;
        
        document.body.appendChild(btnBar);
    }
}




async function shareSimulation() {
    showToast('📤 Gerando imagem...', 'info');
    
    try {
        const svgElement = document.getElementById('bracket-svg');
        if (!svgElement) return;
        
        // Cria um canvas do tamanho do SVG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const svgSize = 1000;
        canvas.width = svgSize;
        canvas.height = svgSize;
        
        // Fundo escuro
        ctx.fillStyle = '#0b0c10';
        ctx.fillRect(0, 0, svgSize, svgSize);
        
        // Renderiza cada nó do SVG manualmente no canvas
        const nodes = svgElement.querySelectorAll('.node-group');
        
        for (const node of nodes) {
            const transform = node.getAttribute('transform');
            if (!transform) continue;
            
            // Extrai posição x, y do transform
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (!match) continue;
            
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            
            // Verifica se é um time (tem emoji)
            const textEl = node.querySelector('.node-emoji');
            const circleEl = node.querySelector('circle');
            const titleEl = node.querySelector('title');
            
            if (!textEl || !circleEl) continue;
            
            const emoji = textEl.textContent;
            const fontSize = parseFloat(textEl.style.fontSize) || 30;
            const radius = parseFloat(circleEl.getAttribute('r')) || 20;
            const isEliminated = node.classList.contains('eliminated');
            const isPending = node.classList.contains('pending');
            
            // Desenha círculo
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            
            if (isEliminated) {
                ctx.fillStyle = 'rgba(26, 30, 45, 0.25)';
                ctx.strokeStyle = '#161922';
            } else if (isPending) {
                ctx.fillStyle = '#0f111a';
                ctx.strokeStyle = '#222738';
                ctx.setLineDash([4, 4]);
            } else {
                ctx.fillStyle = '#1a1e2d';
                ctx.strokeStyle = '#ffcc00';
            }
            
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Desenha emoji
            if (emoji && emoji.trim()) {
                ctx.fillStyle = isEliminated ? 'rgba(255,255,255,0.25)' : '#ffffff';
                ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(emoji, x, y + 2);
            }
            
            // Nome do time (tooltip)
            if (titleEl && titleEl.textContent && !isPending) {
                ctx.fillStyle = isEliminated ? 'rgba(255,255,255,0.3)' : '#ffffff';
                ctx.font = `${fontSize * 0.3}px -apple-system, sans-serif`;
                ctx.fillText(titleEl.textContent, x, y + radius + 12);
            }
        }
        
        // Cria imagem final no formato story (9:16)
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        
        const width = 600;
        const height = 1067;
        finalCanvas.width = width;
        finalCanvas.height = height;
        
        // Fundo escuro
        finalCtx.fillStyle = '#0b0c10';
        finalCtx.fillRect(0, 0, width, height);
        
        // Chaveamento centralizado
        const imgSize = width - 20;
        const imgX = 10;
        const imgY = 50;
        finalCtx.drawImage(canvas, imgX, imgY, imgSize, imgSize);
        
        // Frase
        finalCtx.fillStyle = '#ffcc00';
        finalCtx.font = 'bold 18px -apple-system, sans-serif';
        finalCtx.textAlign = 'center';
        finalCtx.fillText('Essa é a minha previsão', width / 2, height - 50);
        finalCtx.fillText('para a copa do mundo 😄', width / 2, height - 25);
        
        const dataUrl = finalCanvas.toDataURL('image/png', 0.95);
        
        // Download direto
        const link = document.createElement('a');
        link.download = 'copa-2026-previsao.png';
        link.href = dataUrl;
        link.click();
        showToast('✅ Imagem PNG salva!', 'success');
        
    } catch (e) {
        console.error('Erro:', e);
        showToast('Erro ao gerar imagem', 'error');
    }
}
window.shareSimulation = shareSimulation;