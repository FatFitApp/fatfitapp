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
    
    // Atualiza header
    document.getElementById('headerAvatarImg').src = profile?.avatar_url || 'https://via.placeholder.com/32';
    document.getElementById('headerAvatar').addEventListener('click', () => window.location.href = 'profile.html');
    
    // Atualiza sidebar
    document.getElementById('sidebarAvatar').src = profile?.avatar_url || 'https://via.placeholder.com/48';
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
    
    // FAB Button
    const fab = document.getElementById('fabRegister');
    fab?.addEventListener('click', openRegisterModal);
    document.getElementById('confirmRegisterBtn')?.addEventListener('click', goToRegister);
    
    // Fechar modal de seleção
    document.querySelectorAll('#registerSelectModal .modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('registerSelectModal').classList.remove('open');
        });
    });
    
    // Carrega grupos no menu lateral
    await loadSidebarGroups(user.id);
    
    // Tenta carregar último grupo acessado
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
    
    // Se não tem grupo, mostra estado vazio
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
    if (fab) {
        fab.style.display = currentGroup ? 'flex' : 'none';
    }
}

async function loadSidebarGroups(userId) {
    const container = document.getElementById('sidebarGroups');
    if (!container) return;
    
    const { data: memberships } = await db.from('group_members')
        .select('group_id, groups:group_id(id, name)')
        .eq('user_id', userId);
    
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
        btn.innerHTML = `<i class="fas fa-circle" style="font-size:0.4rem;"></i> ${escapeHtml(g.name)}`;
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
    
    // Ativa timeline por padrão
    document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="tabTimeline"]')?.classList.add('active');
    document.getElementById('tabTimeline')?.classList.add('active');
    
    // Atualiza sidebar
    const user = await getCurrentUser();
    await loadSidebarGroups(user.id);
    
    // Carrega timeline
    await loadTimeline();
}

async function loadTimeline() {
    const feed = document.getElementById('timelineFeed');
    if (!feed || !currentGroup) return;
    
    feed.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Carregando atividades...</p></div>';
    
    const { data: challengeIds } = await db.from('challenges').select('id').eq('group_id', currentGroup.id);
    
    if (!challengeIds || challengeIds.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhum desafio no grupo</p></div>';
        return;
    }
    
    const { data: activities, error } = await db.from('daily_activities')
        .select('*, profiles:user_id(name, avatar_url), challenges:challenge_id(name)')
        .in('challenge_id', challengeIds.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error || !activities || activities.length === 0) {
        feed.innerHTML = '<div class="empty-state"><i class="fas fa-camera-retro fa-2x"></i><p>Nenhuma atividade ainda no grupo</p><p class="text-sm text-muted">As atividades dos desafios aparecerão aqui</p></div>';
        return;
    }
    
    feed.innerHTML = '';
    for (const a of activities) {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-header">
                <img src="${a.profiles?.avatar_url || 'https://via.placeholder.com/40'}" class="timeline-avatar">
                <div class="timeline-user">
                    <div class="timeline-name">${escapeHtml(a.profiles?.name || 'Usuário')}</div>
                    <div class="timeline-date">📅 ${formatDate(a.activity_date)} • ${a.challenges?.name || 'Desafio'}</div>
                </div>
                <span class="timeline-points">+1 pt</span>
            </div>
            <img src="${a.photo_url}" class="timeline-photo" onclick="window.open('${a.photo_url}')" loading="lazy">
            ${a.comment ? `<div class="timeline-body"><p class="timeline-comment">${escapeHtml(a.comment)}</p></div>` : ''}
            ${a.location ? `<div class="timeline-body"><p class="timeline-location"><i class="fas fa-map-marker-alt"></i> Localização registrada</p></div>` : ''}
        `;
        feed.appendChild(item);
    }
}

async function loadDetalhes() {
    const container = document.getElementById('detalhesContent');
    if (!container || !currentGroup) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    const user = await getCurrentUser();
    
    const { data: members } = await db.from('group_members')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('group_id', currentGroup.id);
    
    const { data: activeChallenge } = await db.from('challenges')
        .select('*').eq('group_id', currentGroup.id)
        .in('status', ['pending', 'active']).maybeSingle();
    
    let isParticipant = false;
    if (activeChallenge) {
        const { data: cp } = await db.from('challenge_participants')
            .select('*').eq('challenge_id', activeChallenge.id).eq('user_id', user.id).maybeSingle();
        isParticipant = !!cp;
    }
    
    const { data: pastChallenges } = await db.from('challenges')
        .select('*').eq('group_id', currentGroup.id).eq('status', 'finished')
        .order('end_date', { ascending: false });
    
    let html = `
        <div class="group-detail-card">
            <h3>📋 ${escapeHtml(currentGroup.name)}</h3>
            <p class="text-sm text-muted">${escapeHtml(currentGroup.description || 'Sem descrição')}</p>
            <div class="group-code">${currentGroup.invite_code}</div>
            <p class="text-sm"><i class="fas fa-users"></i> ${members?.length || 0}/${currentGroup.max_members} membros</p>
        </div>
        
        <div class="group-detail-card">
            <h3>👥 Membros</h3>
            <div>
                ${members?.map(m => `
                    <span class="member-chip">
                        <img src="${m.profiles?.avatar_url || 'https://via.placeholder.com/24'}" alt="">
                        ${escapeHtml(m.profiles?.name || 'Usuário')}
                        ${m.role === 'admin' ? '<span class="badge badge-info">Admin</span>' : ''}
                    </span>
                `).join('') || 'Nenhum membro'}
            </div>
        </div>
    `;
    
    if (activeChallenge) {
        html += `
            <div class="challenge-card-mini">
                <h3>🎯 Desafio Atual: ${escapeHtml(activeChallenge.name || 'Desafio')}</h3>
                <p>📅 ${formatDate(activeChallenge.start_date)} → ${formatDate(activeChallenge.end_date)}</p>
                <p>💰 R$${activeChallenge.amount_per_person}/pessoa | Total: R$${activeChallenge.total_prize}</p>
                <p>${escapeHtml(activeChallenge.description || '')}</p>
                <span class="badge">${activeChallenge.status === 'active' ? 'Em andamento' : 'Aguardando'}</span>
                <div class="mt-1">
                    ${activeChallenge.status === 'pending' && !isParticipant && getToday() < activeChallenge.start_date ? 
                        `<button class="btn btn-primary btn-block btn-sm confirm-participation-btn" data-id="${activeChallenge.id}">✅ Confirmar Participação</button>` : ''}
                    ${activeChallenge.status === 'active' && isParticipant ? 
                        `<a href="activity.html?challenge=${activeChallenge.id}" class="btn btn-secondary btn-block btn-sm">📸 Registrar Atividade</a>` : ''}
                </div>
            </div>
        `;
    } else if (currentUserRole === 'admin') {
        html += `
            <div class="group-detail-card">
                <h3>Criar Desafio</h3>
                <form id="createChallengeForm">
                    <div class="input-group"><label>Nome</label><input type="text" id="challengeName" placeholder="Ex: Desafio de Verão"></div>
                    <div class="input-group"><label>Data Início *</label><input type="date" id="challengeStartDate" required min="${getToday()}"></div>
                    <div class="input-group"><label>Data Fim *</label><input type="date" id="challengeEndDate" required min="${getToday()}"></div>
                    <div class="input-group"><label>Valor por Pessoa (R$) *</label><input type="number" id="challengeAmount" required min="0.01" step="0.01"></div>
                    <div class="input-group"><label>Descrição</label><textarea id="challengeDescription" rows="2"></textarea></div>
                    <button type="submit" class="btn btn-primary btn-block">Criar Desafio</button>
                </form>
            </div>
        `;
    }
    
    if (pastChallenges?.length > 0) {
        html += `<div class="group-detail-card"><h3>📜 Histórico</h3>`;
        for (const c of pastChallenges) {
            const { data: winners } = await db.from('challenge_winners').select('*, profiles:user_id(name)').eq('challenge_id', c.id);
            html += `<div class="mb-1"><strong>${escapeHtml(c.name || 'Desafio')}</strong><br>
                <span class="text-sm">📅 ${formatDate(c.start_date)} → ${formatDate(c.end_date)} | 💰 ${formatCurrency(c.total_prize)}</span><br>
                ${winners?.length > 0 ? '<span class="text-sm">🏆 ' + winners.map(w => escapeHtml(w.profiles?.name || '') + ' (' + formatCurrency(w.prize_share) + ')').join(', ') + '</span>' : ''}
            </div>`;
        }
        html += '</div>';
    }
    
    container.innerHTML = html;
    
    document.querySelectorAll('.confirm-participation-btn').forEach(b => b.addEventListener('click', async () => {
        await db.from('challenge_participants').insert({ challenge_id: b.dataset.id, user_id: user.id });
        showToast('Participação confirmada!', 'success');
        loadDetalhes();
    }));
    
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
        
        const { error } = await db.from('challenges').insert({
            group_id: currentGroup.id, name, start_date: start, end_date: end,
            amount_per_person: amount, total_prize: amount * (count || 1),
            description: desc, status: 'pending'
        });
        
        if (error) { showToast('Erro: ' + error.message, 'error'); }
        else { showToast('Desafio criado!', 'success'); loadDetalhes(); }
    });
}

async function loadRanking() {
    const container = document.getElementById('rankingContent');
    if (!container || !currentGroup) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    const user = await getCurrentUser();
    
    const { data: activeChallenge } = await db.from('challenges')
        .select('*').eq('group_id', currentGroup.id)
        .in('status', ['pending', 'active']).maybeSingle();
    
    if (!activeChallenge) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Nenhum desafio ativo</p></div>';
        return;
    }
    
    const { data: participants } = await db.from('challenge_participants')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('challenge_id', activeChallenge.id)
        .order('points', { ascending: false });
    
    if (!participants || participants.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum participante ainda</p></div>';
        return;
    }
    
    const maxPoints = Math.max(...participants.map(p => p.points), 1);
    
    let html = `
        <div class="ranking-header">
            <h3>🏆 ${escapeHtml(activeChallenge.name || 'Desafio')}</h3>
            <p class="text-sm">📅 ${formatDate(activeChallenge.start_date)} → ${formatDate(activeChallenge.end_date)}</p>
            <p class="text-sm">💰 Prêmio total: ${formatCurrency(activeChallenge.total_prize)}</p>
        </div>
        <div class="ranking-list">
    `;
    
    participants.forEach((p, i) => {
        const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const isMe = p.user_id === user.id;
        html += `
            <div class="ranking-item" style="${isMe ? 'border: 2px solid var(--primary);' : ''}">
                <div class="ranking-pos ${posClass}">${i + 1}</div>
                <img src="${p.profiles?.avatar_url || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                <div class="ranking-info">
                    <div class="ranking-name">${escapeHtml(p.profiles?.name || 'Usuário')} ${isMe ? '(você)' : ''}</div>
                    <div class="ranking-bar"><div class="ranking-bar-fill" style="width:${(p.points / maxPoints) * 100}%"></div></div>
                </div>
                <div class="ranking-points">${p.points} pts</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadChat() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer || !currentGroup) return;
    
    messagesContainer.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    const user = await getCurrentUser();
    
    const { data: messages } = await db.from('messages')
        .select('*, profiles:user_id(name)')
        .eq('group_id', currentGroup.id)
        .order('created_at', { ascending: true })
        .limit(100);
    
    if (chatSubscription) {
        await db.removeChannel(chatSubscription);
    }
    
    chatSubscription = db.channel('chat-' + currentGroup.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: 'group_id=eq.' + currentGroup.id
        }, (payload) => {
            appendMessage(payload.new, user.id);
        })
        .subscribe();
    
    messagesContainer.innerHTML = '';
    if (messages && messages.length > 0) {
        for (const msg of messages) {
            appendMessage(msg, user.id);
        }
    } else {
        messagesContainer.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="fas fa-comments"></i><p>Nenhuma mensagem ainda</p></div>';
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    document.getElementById('chatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;
        
        const { error } = await db.from('messages').insert({
            group_id: currentGroup.id,
            user_id: user.id,
            message: message
        });
        
        if (error) { showToast('Erro ao enviar', 'error'); }
        else { input.value = ''; }
    });
}

function appendMessage(msg, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const isMine = msg.user_id === currentUserId;
    const div = document.createElement('div');
    div.className = `chat-message ${isMine ? 'mine' : 'other'}`;
    div.innerHTML = `
        ${!isMine ? `<div class="chat-message-sender">${escapeHtml(msg.profiles?.name || 'Usuário')}</div>` : ''}
        <div>${escapeHtml(msg.message)}</div>
        <div class="chat-message-time">${formatTime(msg.created_at)}</div>
    `;
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
    
    const { data: group, error } = await db.from('groups').insert({
        name, description: desc, max_members: max, creator_id: user.id, invite_code: code
    }).select().single();
    
    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
    
    await db.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'admin' });
    
    document.getElementById('createGroupModal').classList.remove('open');
    document.getElementById('createGroupForm').reset();
    showToast('Grupo criado! Código: ' + code, 'success');
    
    await loadSidebarGroups(user.id);
    await selectGroup(group, 'admin');
}

// ============================================
// FAB - REGISTRO EM MÚLTIPLOS GRUPOS
// ============================================

async function openRegisterModal() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: memberships } = await db.from('group_members')
        .select('group_id, groups:group_id(id, name)')
        .eq('user_id', user.id);
    
    if (!memberships || memberships.length === 0) {
        showToast('Você não está em nenhum grupo', 'warning');
        return;
    }
    
    // Se só tem 1 grupo, vai direto
    if (memberships.length === 1) {
        const groupId = memberships[0].group_id;
        const { data: challenge } = await db.from('challenges')
            .select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle();
        
        if (challenge) {
            window.location.href = `activity.html?challenge=${challenge.id}`;
        } else {
            showToast('Nenhum desafio ativo neste grupo', 'warning');
        }
        return;
    }
    
    // Múltiplos grupos - mostra modal
    const modal = document.getElementById('registerSelectModal');
    const container = document.getElementById('groupsChecklist');
    container.innerHTML = '';
    
    let hasAnyActive = false;
    
    for (const m of memberships) {
        const g = m.groups;
        if (!g) continue;
        
        const { data: activeChallenge } = await db.from('challenges')
            .select('id, name, status').eq('group_id', g.id)
            .in('status', ['pending', 'active']).maybeSingle();
        
        const hasActive = activeChallenge && activeChallenge.status === 'active';
        if (hasActive) hasAnyActive = true;
        
        const item = document.createElement('div');
        item.className = 'group-checkbox-item' + (hasActive ? ' checked' : '');
        item.innerHTML = `
            <div class="checkbox-custom">
                <i class="fas fa-check"></i>
            </div>
            <div class="group-checkbox-info">
                <div class="group-checkbox-name">${escapeHtml(g.name)}</div>
                ${activeChallenge ? 
                    `<div class="group-checkbox-challenge">🎯 ${escapeHtml(activeChallenge.name || 'Desafio')}</div>` : 
                    '<div class="group-checkbox-challenge">Nenhum desafio ativo</div>'}
            </div>
            <span class="group-checkbox-badge ${hasActive ? 'active' : 'inactive'}">
                ${hasActive ? 'Ativo' : 'Inativo'}
            </span>
            <input type="checkbox" value="${g.id}" data-challenge="${activeChallenge?.id || ''}" ${hasActive ? 'checked' : 'disabled'} hidden>
        `;
        
        if (hasActive) {
            item.addEventListener('click', () => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) { item.classList.add('checked'); }
                else { item.classList.remove('checked'); }
            });
        }
        
        container.appendChild(item);
    }
    
    if (!hasAnyActive) {
        container.innerHTML += '<p class="text-center text-muted mt-2">Nenhum grupo com desafio ativo no momento</p>';
    }
    
    modal.classList.add('open');
}

function goToRegister() {
    const checkboxes = document.querySelectorAll('#groupsChecklist input[type="checkbox"]:checked');
    const selectedChallenges = [];
    
    checkboxes.forEach(cb => {
        if (cb.dataset.challenge) {
            selectedChallenges.push(cb.dataset.challenge);
        }
    });
    
    if (selectedChallenges.length === 0) {
        showToast('Selecione pelo menos um grupo', 'warning');
        return;
    }
    
    localStorage.setItem('fatfit_register_challenges', JSON.stringify(selectedChallenges));
    document.getElementById('registerSelectModal').classList.remove('open');
    
    const url = selectedChallenges.length === 1 
        ? `activity.html?challenge=${selectedChallenges[0]}`
        : `activity.html?challenges=${selectedChallenges.join(',')}`;
    
    window.location.href = url;
}

// ============================================
// PÁGINA: search.html
// ============================================
if (window.location.pathname.includes('search')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        await loadAllGroups();
        document.getElementById('searchBtn')?.addEventListener('click', searchGroups);
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchGroups();
        });
    });
}

async function loadAllGroups(query = '') {
    const container = document.getElementById('groupsList');
    if (!container) return;
    
    let queryBuilder = db.from('groups').select('*').order('created_at', { ascending: false }).limit(20);
    if (query) queryBuilder = queryBuilder.ilike('name', '%' + query + '%');
    
    const { data: groups, error } = await queryBuilder;
    
    if (error || !groups || groups.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Nenhum grupo encontrado</p></div>';
        return;
    }
    
    const user = await getCurrentUser();
    container.innerHTML = '';
    
    for (const g of groups) {
        const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        const { data: membership } = await db.from('group_members').select('*').eq('group_id', g.id).eq('user_id', user.id).maybeSingle();
        
        const card = document.createElement('div');
        card.className = 'card group-card mb-2';
        card.innerHTML = `
            <h3>${escapeHtml(g.name)}</h3>
            <p class="text-sm text-muted">${escapeHtml(g.description || '')}</p>
            <div class="group-meta mb-1"><span><i class="fas fa-users"></i> ${count || 0}/${g.max_members}</span></div>
            ${membership ? '<span class="badge badge-success">Membro</span>' : '<button class="btn btn-primary btn-sm join-btn" data-id="' + g.id + '">Entrar</button>'}
        `;
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

function searchGroups() {
    const query = document.getElementById('searchInput')?.value.trim() || '';
    loadAllGroups(query);
}

// ============================================
// PÁGINA: activity.html (MÚLTIPLOS DESAFIOS)
// ============================================
if (window.location.pathname.includes('activity')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupActivity(session);
    });
}

async function setupActivity(session) {
    const user = session.user;
    const params = new URLSearchParams(window.location.search);
    
    let challengeIds = [];
    
    if (params.get('challenges')) {
        challengeIds = params.get('challenges').split(',').filter(Boolean);
    } else if (params.get('challenge')) {
        challengeIds = [params.get('challenge')];
    } else {
        const stored = localStorage.getItem('fatfit_register_challenges');
        if (stored) {
            try { challengeIds = JSON.parse(stored); } catch(e) {}
        }
    }
    
    if (challengeIds.length === 0) {
        showToast('Nenhum desafio selecionado', 'error');
        setTimeout(() => location.href = 'home.html', 1500);
        return;
    }
    
    // Busca desafios ativos
    const challenges = [];
    for (const id of challengeIds) {
        const { data: challenge } = await db.from('challenges')
            .select('*, groups:group_id(name)').eq('id', id).eq('status', 'active').single();
        if (challenge) challenges.push(challenge);
    }
    
    if (challenges.length === 0) {
        showToast('Nenhum desafio ativo encontrado', 'error');
        setTimeout(() => location.href = 'home.html', 1500);
        return;
    }
    
    // Mostra grupos selecionados
    const groupsDiv = document.getElementById('selectedGroups');
    groupsDiv.innerHTML = challenges.map(c => `
        <span class="badge badge-info" style="margin:3px;font-size:0.85rem;padding:6px 12px;">
            ${escapeHtml(c.groups?.name || 'Grupo')} - ${escapeHtml(c.name || 'Desafio')}
        </span>
    `).join('');
    
    document.getElementById('registerInfo').textContent = 
        `Registrando em ${challenges.length} grupo(s) • +1 ponto em cada`;
    document.getElementById('submitInfo').textContent = 
        `A foto será registrada em ${challenges.length} desafio(s)`;
    
    // Verifica se já registrou hoje
    const alreadyRegistered = [];
    const validChallenges = [];
    
    for (const c of challenges) {
        const { data: today } = await db.from('daily_activities')
            .select('id').eq('user_id', user.id).eq('challenge_id', c.id)
            .eq('activity_date', getToday()).maybeSingle();
        if (today) {
            alreadyRegistered.push(c);
        } else {
            validChallenges.push(c);
        }
    }
    
    if (validChallenges.length === 0) {
        showToast('Já registrou em todos os grupos hoje!', 'warning');
        setTimeout(() => location.href = 'home.html', 2000);
        return;
    }
    
    // Se removeu alguns que já foram registrados
    if (alreadyRegistered.length > 0) {
        const names = alreadyRegistered.map(c => c.groups?.name || '').join(', ');
        showToast(`Já registrado em: ${names}. Registrando nos outros.`, 'info');
    }
    
    let photoFile = null;
    let locationData = null;
    
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('photoCanvas');
    const photo = document.getElementById('photoResult');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            video.srcObject = stream;
            await video.play();
        } catch (e) { 
            console.error('Erro câmera:', e);
            showToast('Erro ao acessar câmera', 'error'); 
        }
    }
    await startCamera();
    
    captureBtn?.addEventListener('click', () => {
        if (!video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        video.srcObject?.getTracks().forEach(t => t.stop());
        video.style.display = 'none';
        photo.src = canvas.toDataURL('image/jpeg', 0.8);
        photo.style.display = 'block';
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'flex';
        canvas.toBlob(b => photoFile = new File([b], 'act.jpg', { type: 'image/jpeg' }), 'image/jpeg', 0.8);
    });
    
    retakeBtn?.addEventListener('click', async () => {
        photo.style.display = 'none';
        retakeBtn.style.display = 'none';
        video.style.display = 'block';
        captureBtn.style.display = 'flex';
        photoFile = null;
        await startCamera();
    });
    
    document.getElementById('getLocationBtn')?.addEventListener('click', () => {
        if (!navigator.geolocation) { showToast('Geolocalização não suportada', 'warning'); return; }
        navigator.geolocation.getCurrentPosition(
            pos => {
                locationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                document.getElementById('locationStatus').textContent = '✓ Capturada';
                document.getElementById('locationStatus').style.color = 'var(--secondary)';
                showToast('Localização capturada!', 'success');
            },
            (err) => {
                console.error('Erro localização:', err);
                showToast('Falha ao obter localização', 'warning');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
    
    document.getElementById('skipLocationBtn')?.addEventListener('click', () => {
        locationData = null;
        document.getElementById('locationStatus').textContent = 'Ignorada';
        document.getElementById('locationStatus').style.color = 'var(--gray-500)';
    });
    
    document.getElementById('activityForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!photoFile) { showToast('Tire uma foto primeiro!', 'error'); return; }
        
        const btn = document.getElementById('submitBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        
        const comment = document.getElementById('activityComment')?.value?.trim() || null;
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < validChallenges.length; i++) {
            const challenge = validChallenges[i];
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Salvando ${i + 1}/${validChallenges.length}...`;
            
            try {
                const fileName = `${user.id}/${challenge.id}/${Date.now()}_${i}.jpg`;
                const { error: upErr } = await db.storage.from('activity-photos')
                    .upload(fileName, photoFile, { contentType: 'image/jpeg', upsert: false });
                
                if (upErr) {
                    console.error('Erro upload:', upErr);
                    errorCount++;
                    continue;
                }
                
                const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
                
                const { error: actErr } = await db.from('daily_activities').insert({
                    user_id: user.id,
                    challenge_id: challenge.id,
                    activity_date: getToday(),
                    photo_url: urlData.publicUrl,
                    location: locationData,
                    comment: comment,
                    status: 'valid'
                });
                
                if (actErr) {
                    console.error('Erro insert:', actErr);
                    errorCount++;
                } else {
                    successCount++;
                }
            } catch (err) {
                console.error('Erro geral:', err);
                errorCount++;
            }
        }
        
        localStorage.removeItem('fatfit_register_challenges');
        
        if (successCount > 0) {
            showToast(`Registrado em ${successCount} grupo(s)! 🎉 +${successCount} pontos`, 'success');
        } else {
            showToast('Erro ao registrar atividade', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
        
        setTimeout(() => location.href = 'home.html', 1500);
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
        if (!file || file.size > 5*1024*1024) { showToast('Imagem muito grande (máx 5MB)', 'error'); return; }
        
        const fileName = `avatars/${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await db.storage.from('activity-photos')
            .upload(fileName, file, { contentType: file.type, upsert: true });
        
        if (uploadError) { showToast('Erro ao enviar foto', 'error'); return; }
        
        const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
        await db.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
        document.getElementById('avatarImg').src = urlData.publicUrl;
        showToast('Avatar atualizado!', 'success');
    });
    
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        const pix = document.getElementById('editPixKey').value.trim();
        if (!name) { showToast('Nome obrigatório', 'error'); return; }
        await db.from('profiles').update({ name, pix_key: pix || null }).eq('id', user.id);
        document.getElementById('profileName').textContent = name;
        showToast('Perfil salvo!', 'success');
    });
    
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const curr = document.getElementById('currentPassword').value;
        const newPw = document.getElementById('newPassword').value;
        if (newPw.length < 6) { showToast('Mínimo 6 caracteres', 'error'); return; }
        
        const { error } = await db.auth.signInWithPassword({ email: user.email, password: curr });
        if (error) { showToast('Senha atual incorreta', 'error'); return; }
        
        const { error: updateError } = await db.auth.updateUser({ password: newPw });
        if (updateError) { showToast('Erro ao trocar senha', 'error'); }
        else { showToast('Senha alterada!', 'success'); document.getElementById('changePasswordForm').reset(); }
    });
    
    // Stats
    const { count: challenges } = await db.from('challenge_participants')
        .select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    document.getElementById('totalChallenges').textContent = challenges || 0;
    
    const { data: wins } = await db.from('challenge_winners')
        .select('*, challenges:challenge_id(name, groups:group_id(name))')
        .eq('user_id', user.id).order('declared_at', { ascending: false });
    
    document.getElementById('totalWins').textContent = wins?.length || 0;
    document.getElementById('totalEarnings').textContent = formatCurrency(
        wins?.reduce((s, w) => s + Number(w.prize_share), 0) || 0
    );
    
    const list = document.getElementById('winsList');
    if (!wins?.length) {
        list.innerHTML = '<p class="empty-state"><i class="fas fa-trophy"></i> Nenhuma vitória ainda</p>';
        return;
    }
    
    list.innerHTML = '';
    wins.forEach(w => {
        const card = document.createElement('div');
        card.className = 'card mb-1';
        card.style.borderLeft = '4px solid #FCD34D';
        card.innerHTML = `
            <div class="flex-between">
                <div>
                    <strong>${escapeHtml(w.challenges?.groups?.name || 'Grupo')}</strong>
                    <p class="text-sm">${escapeHtml(w.challenges?.name || 'Desafio')}</p>
                    <p class="text-xs text-muted">${formatDate(w.declared_at)}</p>
                </div>
                <div>
                    <span class="badge badge-warning" style="font-size:1rem;">${formatCurrency(w.prize_share)}</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}