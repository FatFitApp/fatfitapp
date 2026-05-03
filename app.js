// ============================================
// FATFIT - Aplicação Principal v2.0
// ============================================

const db = window.db;
let currentGroup = null;
let currentUserRole = null;
let chatSubscription = null;

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
        else { showToast('Conta criada! Faça login.', 'success'); setTimeout(() => showForm('loginForm'), 2000); }
    });

    document.getElementById('recoverForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoverEmail').value.trim();
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/index.html' });
        if (error) { showToast(error.message, 'error'); }
        else { showToast('Email de recuperação enviado!', 'success'); setTimeout(() => showForm('loginForm'), 2000); }
    });
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
    
    document.getElementById('headerAvatarImg').src = profile?.avatar_url || 'https://via.placeholder.com/32';
    document.getElementById('headerAvatar').addEventListener('click', () => window.location.href = 'profile.html');
    
    document.getElementById('sidebarAvatar').src = profile?.avatar_url || 'https://via.placeholder.com/48';
    document.getElementById('sidebarName').textContent = profile?.name || 'Usuário';
    document.getElementById('sidebarEmail').textContent = profile?.email || user.email;
    
    setupSidebar();
    
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
    
    const fab = document.getElementById('fabRegister');
    if (fab) fab.addEventListener('click', openRegisterModal);
    
    await loadSidebarGroups(user.id);
    
    const lastGroupId = localStorage.getItem('fatfit_last_group');
    if (lastGroupId) {
        const { data: group } = await db.from('groups').select('*').eq('id', lastGroupId).single();
        if (group) {
            const { data: membership } = await db.from('group_members').select('role').eq('group_id', group.id).eq('user_id', user.id).single();
            if (membership) {
                await selectGroup(group, membership.role);
                return;
            }
        }
    }
    
    document.getElementById('noGroupState').style.display = 'block';
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('fabRegister').style.display = 'none';
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
            if (tabId === 'tabChat') loadChat();
        });
    });
}

function toggleFAB() {
    const fab = document.getElementById('fabRegister');
    if (fab) fab.style.display = currentGroup ? 'flex' : 'none';
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
}

async function loadTimeline() {
    const feed = document.getElementById('timelineFeed');
    if (!feed || !currentGroup) return;
    feed.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Carregando...</p></div>';
    const { data: challengeIds } = await db.from('challenges').select('id').eq('group_id', currentGroup.id);
    if (!challengeIds || challengeIds.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhum desafio no grupo</p></div>';
        return;
    }
    const { data: activities } = await db.from('daily_activities')
        .select('*, profiles:user_id(name, avatar_url), challenges:challenge_id(name)')
        .in('challenge_id', challengeIds.map(c => c.id)).eq('status', 'valid')
        .order('created_at', { ascending: false }).limit(50);
    if (!activities || activities.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhuma atividade ainda</p></div>';
        return;
    }
    feed.innerHTML = '';
    for (const a of activities) {
        const isExtra = a.is_extra === true;
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = 
            '<div class="timeline-header">' +
            '<img src="' + (a.profiles?.avatar_url || 'https://via.placeholder.com/40') + '" class="timeline-avatar">' +
            '<div class="timeline-user">' +
            '<div class="timeline-name">' + escapeHtml(a.profiles?.name || 'Usuário') + (isExtra ? ' <span class="badge badge-warning" style="margin-left:6px;">Extra</span>' : '') + '</div>' +
            '<div class="timeline-date">📅 ' + formatDate(a.activity_date) + ' • ' + (a.challenges?.name || 'Desafio') + '</div>' +
            '</div>' +
            (isExtra ? '<span class="badge badge-secondary" style="font-size:0.7rem;">+0</span>' : '<span class="timeline-points">+1 pt</span>') +
            '</div>' +
            '<img src="' + a.photo_url + '" class="timeline-photo" onclick="window.open(\'' + a.photo_url + '\')" loading="lazy" onerror="this.style.display=\'none\'">' +
            (a.comment ? '<div class="timeline-body"><p class="timeline-comment">' + escapeHtml(a.comment) + '</p></div>' : '') +
            (a.location ? '<div class="timeline-body"><p class="timeline-location"><i class="fas fa-map-marker-alt"></i> Localização registrada</p></div>' : '');
        feed.appendChild(item);
    }
}

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
            html += '<span class="member-chip"><img src="' + (m.profiles?.avatar_url || 'https://via.placeholder.com/24') + '" alt="">' + escapeHtml(m.profiles?.name || 'Usuário') + (m.role === 'admin' ? ' <span class="badge badge-info">Admin</span>' : '') + '</span>';
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
        html += '<div class="mt-1">';
        if (!isParticipant) {
            html += '<button class="btn btn-primary btn-block btn-sm confirm-participation-btn" data-id="' + activeChallenge.id + '">✅ Confirmar Participação</button>';
        }
        if (isParticipant) {
            html += '<a href="activity.html?challenge=' + activeChallenge.id + '" class="btn btn-secondary btn-block btn-sm">📸 Registrar Atividade</a>';
        }
        html += '</div>';
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
    
    document.querySelectorAll('.confirm-participation-btn').forEach(b => {
        b.addEventListener('click', async () => {
            await db.from('challenge_participants').insert({ challenge_id: b.dataset.id, user_id: user.id });
            showToast('Participação confirmada!', 'success');
            loadDetalhes();
        });
    });
    
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
    const { data: participants } = await db.from('challenge_participants').select('*, profiles:user_id(name, avatar_url)').eq('challenge_id', activeChallenge.id).order('points', { ascending: false });
    if (!participants || participants.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum participante ainda</p></div>'; return; }
    const maxPoints = Math.max(...participants.map(p => p.points), 1);
    let html = '<div class="ranking-header"><h3>🏆 ' + escapeHtml(activeChallenge.name || 'Desafio') + '</h3><p class="text-sm">📅 ' + formatDate(activeChallenge.start_date) + ' → ' + formatDate(activeChallenge.end_date) + '</p><p class="text-sm">💰 Prêmio total: ' + formatCurrency(activeChallenge.total_prize) + '</p></div><div class="ranking-list">';
    participants.forEach((p, i) => {
        const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const isMe = p.user_id === user.id;
        html += '<div class="ranking-item" style="' + (isMe ? 'border: 2px solid var(--primary);' : '') + '">';
        html += '<div class="ranking-pos ' + posClass + '">' + (i + 1) + '</div>';
        html += '<img src="' + (p.profiles?.avatar_url || 'https://via.placeholder.com/40') + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer;" onclick="window.openPersonCalendar(\'' + p.user_id + '\', \'' + currentGroup.id + '\')">';
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
    const { data: messages } = await db.from('messages').select('*, profiles:user_id(name)').eq('group_id', currentGroup.id).order('created_at', { ascending: true }).limit(100);
    if (chatSubscription) await db.removeChannel(chatSubscription);
    chatSubscription = db.channel('chat-' + currentGroup.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'group_id=eq.' + currentGroup.id }, (payload) => { appendMessage(payload.new, user.id); }).subscribe();
    messagesContainer.innerHTML = '';
    if (messages && messages.length > 0) { for (const msg of messages) appendMessage(msg, user.id); }
    else { messagesContainer.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="fas fa-comments"></i><p>Nenhuma mensagem ainda</p></div>'; }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    document.getElementById('chatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;
        const { error } = await db.from('messages').insert({ group_id: currentGroup.id, user_id: user.id, message: message });
        if (error) { showToast('Erro ao enviar', 'error'); }
        else { input.value = ''; }
    });
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
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
        video.srcObject = stream;
        await video.play();
    } catch (e) { showToast('Erro ao acessar câmera', 'error'); }
    document.getElementById('captureBtn')?.addEventListener('click', capturePhoto);
    addCameraBackButton();
}

function addCameraBackButton() {
    const existing = document.querySelector('.camera-back-btn');
    if (existing) existing.remove();
    const backBtn = document.createElement('button');
    backBtn.className = 'camera-back-btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backBtn.addEventListener('click', () => { stopCamera(); window.location.href = 'home.html'; });
    document.getElementById('cameraState')?.appendChild(backBtn);
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
    document.getElementById('previewState').style.display = 'none';
    document.getElementById('cameraState').style.display = 'flex';
    startCameraFullscreen();
}

function usePhoto() {
    document.getElementById('previewState').style.display = 'none';
    document.getElementById('detailsState').style.display = 'block';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    setupLocationButtons();
    document.getElementById('activityForm')?.addEventListener('submit', submitActivity);
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
    if (!navigator.geolocation) { showToast('Geolocalização não suportada', 'warning'); return; }
    const btn = document.getElementById('getLocationBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obtendo...';
    navigator.geolocation.getCurrentPosition(async (pos) => {
        activityLocationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        document.getElementById('locationStatus').textContent = '✓ Capturada';
        document.getElementById('locationStatus').style.color = 'var(--secondary)';
        await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Capturar';
    }, () => { showToast('Falha na localização', 'warning'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Tentar'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
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
    if (!activityPhotoFile) { showToast('Tire uma foto primeiro!', 'error'); return; }
    const user = await getCurrentUser();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    const comment = document.getElementById('activityComment')?.value?.trim() || null;
    const today = getToday();
    let successCount = 0, pointsEarned = 0, extraCount = 0;
    
    for (let i = 0; i < challengesWithStatus.length; i++) {
        const cs = challengesWithStatus[i];
        const isExtra = cs.hasValidToday;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando ' + (i + 1) + '/' + challengesWithStatus.length + '...';
        try {
            const fileName = user.id + '/' + cs.challenge.id + '/' + Date.now() + '_' + i + '.jpg';
            const { error: upErr } = await db.storage.from('activity-photos').upload(fileName, activityPhotoFile, { contentType: 'image/jpeg', upsert: false });
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
        stopCamera();
        setTimeout(() => { window.location.href = 'home.html'; }, 2000);
    } else {
        showToast('Erro ao registrar', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ============================================
// PÁGINA: search.html
// ============================================
if (window.location.pathname.includes('search')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await loadAllGroups();
        document.getElementById('searchBtn')?.addEventListener('click', () => loadAllGroups(document.getElementById('searchInput')?.value || ''));
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadAllGroups(e.target.value); });
    });
}

async function loadAllGroups(query = '') {
    const container = document.getElementById('groupsList');
    if (!container) return;
    let q = db.from('groups').select('*').order('created_at', { ascending: false }).limit(20);
    if (query) q = q.ilike('name', '%' + query + '%');
    const { data: groups } = await q;
    if (!groups || groups.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Nenhum grupo encontrado</p></div>'; return; }
    const user = await getCurrentUser();
    container.innerHTML = '';
    for (const g of groups) {
        const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        const { data: membership } = await db.from('group_members').select('*').eq('group_id', g.id).eq('user_id', user.id).maybeSingle();
        const card = document.createElement('div');
        card.className = 'card group-card mb-2';
        card.innerHTML = '<h3>' + escapeHtml(g.name) + '</h3><p class="text-sm text-muted">' + escapeHtml(g.description || '') + '</p><div class="group-meta mb-1"><span><i class="fas fa-users"></i> ' + (count || 0) + '/' + g.max_members + '</span></div>' + (membership ? '<span class="badge badge-success">Membro</span>' : '<button class="btn btn-primary btn-sm join-btn" data-id="' + g.id + '">Entrar</button>');
        container.appendChild(card);
    }
    document.querySelectorAll('.join-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const gId = btn.dataset.id;
            const { data: g } = await db.from('groups').select('*').eq('id', gId).single();
            const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', gId);
            if (count >= g.max_members) { showToast('Grupo lotado!', 'error'); return; }
            await db.from('group_members').insert({ group_id: gId, user_id: user.id, role: 'member' });
            showToast('Entrou no grupo: ' + g.name, 'success');
            loadAllGroups(query);
        });
    });
}

// ============================================
// PÁGINA: profile.html
// ============================================
if (window.location.pathname.includes('profile')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupNewProfile(session);
    });
}

async function setupNewProfile(session) {
    const user = session.user;
    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
        document.getElementById('profileName').textContent = profile.name || 'Usuário';
        document.getElementById('profileEmail').textContent = profile.email || user.email;
        document.getElementById('editName').value = profile.name || '';
        document.getElementById('editPixKey').value = profile.pix_key || '';
        if (profile.avatar_url) document.getElementById('avatarImg').src = profile.avatar_url;
    }
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => document.getElementById('avatarInput').click());
    document.getElementById('avatarInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || file.size > 5*1024*1024) { showToast('Máx 5MB', 'error'); return; }
        const fileName = 'avatars/' + user.id + '/' + Date.now() + '.jpg';
        await db.storage.from('activity-photos').upload(fileName, file, { contentType: file.type, upsert: true });
        const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
        await db.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
        document.getElementById('avatarImg').src = urlData.publicUrl;
        showToast('Avatar atualizado!', 'success');
    });
    document.getElementById('openEditProfileBtn')?.addEventListener('click', () => {
        document.getElementById('editProfileSection').style.display = document.getElementById('editProfileSection').style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => {
        document.getElementById('changePasswordSection').style.display = document.getElementById('changePasswordSection').style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        if (!name) { showToast('Nome obrigatório', 'error'); return; }
        await db.from('profiles').update({ name, pix_key: document.getElementById('editPixKey').value.trim() || null }).eq('id', user.id);
        document.getElementById('profileName').textContent = name;
        document.getElementById('editProfileSection').style.display = 'none';
        showToast('Salvo!', 'success');
    });
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
        document.getElementById('changePasswordSection').style.display = 'none';
    });
    const { count: challenges } = await db.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    document.getElementById('totalChallenges').textContent = challenges || 0;
    const { data: wins } = await db.from('challenge_winners').select('*, challenges:challenge_id(name, groups:group_id(name))').eq('user_id', user.id).order('declared_at', { ascending: false });
    document.getElementById('totalWins').textContent = wins?.length || 0;
    document.getElementById('totalEarnings').textContent = formatCurrency(wins?.reduce((s, w) => s + Number(w.prize_share), 0) || 0);
    const list = document.getElementById('winsList');
    if (!wins?.length) { list.innerHTML = '<p class="empty-state"><i class="fas fa-trophy"></i> Nenhuma vitória ainda</p>'; }
    else {
        list.innerHTML = '';
        wins.forEach(w => {
            const card = document.createElement('div');
            card.className = 'card mb-1';
            card.style.borderLeft = '4px solid #FCD34D';
            card.innerHTML = '<div class="flex-between"><div><strong>' + escapeHtml(w.challenges?.groups?.name || 'Grupo') + '</strong><p class="text-sm">' + escapeHtml(w.challenges?.name || 'Desafio') + '</p><p class="text-xs text-muted">' + formatDate(w.declared_at) + '</p></div><div><span class="badge badge-warning" style="font-size:1rem;">' + formatCurrency(w.prize_share) + '</span></div></div>';
            list.appendChild(card);
        });
    }
    await loadProfileCalendar();
}

// ============================================
// PÁGINA: person.html
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
    if (!userId || !groupId) { showToast('Parâmetros inválidos', 'error'); setTimeout(() => history.back(), 1500); return; }
    const profile = await getProfile(userId);
    const { data: group } = await db.from('groups').select('name').eq('id', groupId).single();
    if (profile) {
        document.getElementById('personName').textContent = profile.name || 'Usuário';
        document.getElementById('personAvatar').src = profile.avatar_url || 'https://via.placeholder.com/80';
        document.getElementById('personGroup').textContent = '👥 ' + (group?.name || 'Grupo');
        document.getElementById('personPageTitle').textContent = profile.name || 'Atividades';
    }
    const { data: activities } = await db.rpc('get_calendar_data', { p_user_id: userId, p_group_id: groupId });
    if (activities) {
        document.getElementById('personDays').textContent = new Set(activities.map(a => a.activity_date)).size;
        const dates = [...new Set(activities.map(a => a.activity_date))].sort();
        let maxStreak = 0, currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
            const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
            if (diff === 1) currentStreak++;
            else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 1; }
        }
        document.getElementById('personStreak').textContent = Math.max(maxStreak, currentStreak);
    }
    const { data: activeChallenge } = await db.from('challenges').select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle();
    if (activeChallenge) {
        const { data: p } = await db.from('challenge_participants').select('points').eq('challenge_id', activeChallenge.id).eq('user_id', userId).maybeSingle();
        document.getElementById('personPoints').textContent = p?.points || 0;
    }
    await loadPersonCalendar(userId, groupId);
    const { data: recent } = await db.from('daily_activities').select('*, challenges:challenge_id(name)').eq('user_id', userId).in('challenge_id', (await db.from('challenges').select('id').eq('group_id', groupId)).data?.map(c => c.id) || []).order('created_at', { ascending: false }).limit(20);
    const actContainer = document.getElementById('personActivities');
    if (recent?.length) {
        actContainer.innerHTML = recent.map(a => '<div class="card activity-card mb-1"><img src="' + a.photo_url + '" class="day-detail-photo" onclick="window.open(\'' + a.photo_url + '\')" style="cursor:pointer;"><div class="day-detail-info"><div class="text-sm">📅 ' + formatDate(a.activity_date) + '</div><div class="text-xs text-muted">🎯 ' + escapeHtml(a.challenges?.name || 'Desafio') + '</div>' + (a.comment ? '<p class="text-sm mt-1">' + escapeHtml(a.comment) + '</p>' : '') + '</div><span class="badge badge-success">+1</span></div>').join('');
    } else {
        actContainer.innerHTML = '<p class="empty-state">Nenhuma atividade ainda</p>';
    }
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
// FECHAR MODAL
// ============================================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('open')) {
        e.target.classList.remove('open');
    }
});