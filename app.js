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
    if (fab) {
        fab.addEventListener('click', openRegisterModal);
    }
    
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
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h3 style="margin: 0;">📋 ${escapeHtml(currentGroup.name)}</h3>
                ${currentUserRole === 'admin' ? `
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" onclick="openEditGroupModal()" style="padding: 5px 10px;">
                            ✏️ Editar
                        </button>
                    </div>
                ` : ''}
            </div>
            <p class="text-sm text-muted">${escapeHtml(currentGroup.description || 'Sem descrição')}</p>
            <div class="group-code" style="background: #f5f5f5; padding: 8px; border-radius: 5px; font-family: monospace; font-size: 14px; margin: 10px 0;">
                Código: ${currentGroup.invite_code}
            </div>
            <p class="text-sm"><i class="fas fa-users"></i> ${members?.length || 0}/${currentGroup.max_members} membros</p>
            
            ${currentUserRole === 'admin' ? `
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-info" onclick="openManageMembersModal()" style="flex: 1;">
                        👥 Gerenciar Membros
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteGroup()" style="flex: 1;">
                        🗑️ Deletar Grupo
                    </button>
                </div>
            ` : ''}
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
                        `<button class="btn btn-secondary btn-block btn-sm register-activity-btn" data-id="${activeChallenge.id}">📸 Registrar Atividade</button>` : ''}
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
    
// Além disso, adicione também o evento para o botão de confirmar participação
document.querySelectorAll('.confirm-participation-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
        e.preventDefault();
        const challengeId = b.dataset.id;
        await db.from('challenge_participants').insert({ 
            challenge_id: challengeId, 
            user_id: user.id 
        });
        showToast('Participação confirmada!', 'success');
        loadDetalhes(); // Recarregar a página de detalhes
    });
});
    
 document.querySelectorAll('.register-activity-btn').forEach(b => {
    b.addEventListener('click', (e) => {
        e.preventDefault();
        const challengeId = b.dataset.id;
        console.log('Registrando atividade para desafio:', challengeId);
        localStorage.setItem('fatfit_register_challenges', JSON.stringify([challengeId]));
        window.location.href = 'activity.html';
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
                <img src="${p.profiles?.avatar_url || 'https://via.placeholder.com/40'}" 
                     style="width:40px;height:40px;border-radius:50%;object-fit:cover;cursor:pointer;" 
                     onclick="window.openPersonCalendar('${p.user_id}', '${currentGroup.id}', '${escapeHtml(p.profiles?.name || 'Usuário')}')"
                     alt="${escapeHtml(p.profiles?.name || 'Usuário')}"
                     title="Ver atividades de ${escapeHtml(p.profiles?.name || 'Usuário')}">
                <div class="ranking-info" style="cursor:pointer;" onclick="window.openPersonCalendar('${p.user_id}', '${currentGroup.id}', '${escapeHtml(p.profiles?.name || 'Usuário')}')">
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

// Função global para abrir calendário da pessoa
window.openPersonCalendar = function(userId, groupId, personName) {
    console.log('👤 Abrindo calendário de:', personName, userId, groupId);
    window.location.href = `person.html?user=${userId}&group=${groupId}`;
};

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

// Substitua a função createGroup existente por esta versão melhorada:
async function createGroup(e) {
    e.preventDefault();
    
    const user = await getCurrentUser();
    const name = document.getElementById('groupName').value.trim();
    const desc = document.getElementById('groupDescription').value.trim();
    const max = parseInt(document.getElementById('groupMaxMembers').value);
    
    if (!name) { 
        showToast('Por favor, digite um nome para o grupo', 'error');
        // Adiciona animação de erro no campo
        const nameInput = document.getElementById('groupName');
        nameInput.style.borderColor = '#dc3545';
        setTimeout(() => {
            nameInput.style.borderColor = '#e0e0e0';
        }, 2000);
        return; 
    }
    
    // Gerar código de convite único
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Mostrar loading no botão
    const submitBtn = document.querySelector('#createGroupForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando grupo...';
    
    try {
        const { data: group, error } = await db.from('groups').insert({
            name, 
            description: desc || null, 
            max_members: max || 50, 
            creator_id: user.id, 
            invite_code: code
        }).select().single();
        
        if (error) throw error;
        
        await db.from('group_members').insert({ 
            group_id: group.id, 
            user_id: user.id, 
            role: 'admin' 
        });
        
        // Fechar modal e resetar formulário
        document.getElementById('createGroupModal').classList.remove('open');
        document.getElementById('createGroupForm').reset();
        
        // Mostrar mensagem de sucesso com o código
        showToast(`🎉 Grupo "${name}" criado com sucesso! Código: ${code}`, 'success');
        
        // Atualizar sidebar e selecionar o novo grupo
        await loadSidebarGroups(user.id);
        await selectGroup(group, 'admin');
        
    } catch (error) {
        console.error('Erro ao criar grupo:', error);
        showToast('Erro ao criar grupo: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ============================================
// FUNÇÕES DO FAB - REGISTRO EM MÚLTIPLOS DESAFIOS
// ============================================

// ============================================
// FUNÇÃO DO FAB - REGISTRO DE ATIVIDADE
// ============================================

async function openRegisterModal() {
    console.log('openRegisterModal chamado');
    
    const user = await getCurrentUser();
    if (!user) {
        console.log('Usuário não encontrado');
        return;
    }
    
    const { data: memberships, error } = await db.from('group_members')
        .select('group_id, groups:group_id(id, name)')
        .eq('user_id', user.id);
    
    console.log('Memberships:', memberships?.length, 'Erro:', error);
    
    if (error) {
        console.error('Erro ao buscar groups:', error);
        showToast('Erro ao carregar grupos', 'error');
        return;
    }
    
    if (!memberships || memberships.length === 0) {
        console.log('Nenhum grupo encontrado');
        showToast('Você não está em nenhum grupo', 'warning');
        return;
    }
    
    // Se só tem 1 grupo, vai direto para o registro
    if (memberships.length === 1) {
        const groupId = memberships[0].group_id;
        console.log('Apenas 1 grupo, ID:', groupId);
        
        // Busca o desafio mais recente (ativo ou não)
        const { data: challenge, error: challengeError } = await db.from('challenges')
            .select('id, name, status, start_date, end_date')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        console.log('Desafio encontrado:', challenge?.name, 'Erro:', challengeError);
        
        if (challenge) {
            console.log('Redirecionando para activity.html?challenge=' + challenge.id);
            // Força o redirect
            window.location.replace('activity.html?challenge=' + challenge.id);
            return;
        } else {
            console.log('Nenhum desafio encontrado');
            showToast('Este grupo não tem desafios. Crie um desafio primeiro.', 'warning');
            return;
        }
    }
    
    // Múltiplos grupos - mostra modal
    console.log('Múltiplos grupos, abrindo modal');
    const modal = document.getElementById('registerSelectModal');
    const container = document.getElementById('groupsChecklist');
    
    if (!modal || !container) {
        console.error('Modal ou container não encontrados');
        return;
    }
    
    container.innerHTML = '';
    
    for (const m of memberships) {
        const g = m.groups;
        if (!g) continue;
        
        const { data: challenge } = await db.from('challenges')
            .select('id, name, status, start_date, end_date')
            .eq('group_id', g.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        const hasActive = challenge && challenge.status === 'active';
        const today = getToday();
        const inPeriod = challenge && today >= challenge.start_date && today <= challenge.end_date;
        const willScore = hasActive && inPeriod;
        
        const item = document.createElement('div');
        item.className = 'group-checkbox-item' + (challenge ? ' checked' : '');
        item.innerHTML = `
            <div class="checkbox-custom">
                <i class="fas fa-check"></i>
            </div>
            <div class="group-checkbox-info">
                <div class="group-checkbox-name">${escapeHtml(g.name)}</div>
                ${challenge ? 
                    `<div class="group-checkbox-challenge">
                        🎯 ${escapeHtml(challenge.name || 'Desafio')} 
                        ${willScore ? '✅ <span style="color:#065F46;">Pontuando</span>' : 
                          hasActive ? '⏳ <span style="color:#92400E;">Fora do período</span>' : 
                          '📋 <span style="color:#6B7280;">Desafio inativo</span>'}
                    </div>` : 
                    '<div class="group-checkbox-challenge">⚠️ Nenhum desafio criado</div>'}
            </div>
            <span class="group-checkbox-badge ${willScore ? 'active' : 'inactive'}">
                ${willScore ? '+1 pt' : 'Sem ponto'}
            </span>
            <input type="checkbox" value="${g.id}" data-challenge="${challenge?.id || ''}" ${challenge ? 'checked' : 'disabled'} hidden>
        `;
        
        if (challenge) {
            item.addEventListener('click', () => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) { item.classList.add('checked'); }
                else { item.classList.remove('checked'); }
            });
        }
        
        container.appendChild(item);
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
        showToast('Selecione pelo menos um grupo com desafio', 'warning');
        return;
    }
    
    localStorage.setItem('fatfit_register_challenges', JSON.stringify(selectedChallenges));
    document.getElementById('registerSelectModal').classList.remove('open');
    
    const url = selectedChallenges.length === 1 
        ? `activity.html?challenge=${selectedChallenges[0]}`
        : `activity.html?challenges=${selectedChallenges.join(',')}`;
    
    window.location.replace(url);
}

function createRegisterModal() {
    const modalHTML = `
        <div id="registerSelectModal" class="modal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📸 Registrar Atividade</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Selecione os desafios para registrar:</p>
                    <div id="challengesList" style="max-height: 400px; overflow-y: auto;">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('registerSelectModal')">Cancelar</button>
                    <button id="confirmMultiRegisterBtn" class="btn btn-primary">Continuar →</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const closeBtn = document.querySelector('#registerSelectModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal('registerSelectModal');
        });
    }
    
    const modal = document.getElementById('registerSelectModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal('registerSelectModal');
            }
        });
    }
}

// ============================================
// FUNÇÕES DE ADMIN - EDITAR GRUPO
// ============================================

async function openEditGroupModal() {
    if (!currentGroup) {
        showToast('Nenhum grupo selecionado', 'warning');
        return;
    }
    
    if (currentUserRole !== 'admin') {
        showToast('Apenas administradores podem editar o grupo', 'error');
        return;
    }
    
    let modal = document.getElementById('editGroupModal');
    if (!modal) {
        createEditGroupModal();
        modal = document.getElementById('editGroupModal');
    }
    
    document.getElementById('editGroupName').value = currentGroup.name || '';
    document.getElementById('editGroupDescription').value = currentGroup.description || '';
    document.getElementById('editGroupMaxMembers').value = currentGroup.max_members || 50;
    document.getElementById('editGroupInviteCode').value = currentGroup.invite_code || '';
    
    const inviteCodeInput = document.getElementById('editGroupInviteCode');
    if (inviteCodeInput) {
        inviteCodeInput.readOnly = true;
    }
    
    modal.classList.add('open');
}

function createEditGroupModal() {
    const modalHTML = `
        <div id="editGroupModal" class="modal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Editar Grupo</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editGroupForm">
                        <div class="input-group">
                            <label>Nome do Grupo *</label>
                            <input type="text" id="editGroupName" required maxlength="100">
                        </div>
                        
                        <div class="input-group">
                            <label>Descrição</label>
                            <textarea id="editGroupDescription" rows="3" maxlength="500"></textarea>
                        </div>
                        
                        <div class="input-group">
                            <label>Máximo de Membros</label>
                            <input type="number" id="editGroupMaxMembers" min="1" max="500" value="50">
                            <small class="text-muted">Atual: ${currentGroup?.max_members || 50}</small>
                        </div>
                        
                        <div class="input-group">
                            <label>Código de Convite</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="editGroupInviteCode" style="flex: 1; font-family: monospace;" readonly>
                                <button type="button" id="regenerateInviteCodeBtn" class="btn btn-secondary btn-sm">🔄 Gerar Novo</button>
                            </div>
                            <small class="text-muted">Compartilhe este código para novos membros entrarem</small>
                        </div>
                        
                        <div class="modal-footer" style="margin-top: 20px;">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('editGroupModal')">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const closeBtn = document.querySelector('#editGroupModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal('editGroupModal');
        });
    }
    
    const modal = document.getElementById('editGroupModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal('editGroupModal');
            }
        });
    }
    
    const regenerateBtn = document.getElementById('regenerateInviteCodeBtn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', async () => {
            const newCode = generateInviteCode();
            document.getElementById('editGroupInviteCode').value = newCode;
            showToast('Novo código gerado! Não esqueça de salvar as alterações.', 'info');
        });
    }
    
    const editForm = document.getElementById('editGroupForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateGroup();
        });
    }
}

function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function updateGroup() {
    if (!currentGroup) return;
    
    const newName = document.getElementById('editGroupName').value.trim();
    const newDescription = document.getElementById('editGroupDescription').value.trim();
    const newMaxMembers = parseInt(document.getElementById('editGroupMaxMembers').value);
    const newInviteCode = document.getElementById('editGroupInviteCode').value.trim();
    
    if (!newName) {
        showToast('Nome do grupo é obrigatório', 'error');
        return;
    }
    
    if (newMaxMembers < 1 || newMaxMembers > 500) {
        showToast('Número de membros inválido', 'error');
        return;
    }
    
    if (newInviteCode !== currentGroup.invite_code) {
        const { data: existingGroup } = await db.from('groups')
            .select('id')
            .eq('invite_code', newInviteCode)
            .neq('id', currentGroup.id)
            .single();
        
        if (existingGroup) {
            showToast('Este código de convite já está em uso. Gere outro.', 'error');
            return;
        }
    }
    
    const updateData = {
        name: newName,
        description: newDescription || null,
        max_members: newMaxMembers,
        invite_code: newInviteCode
    };
    
    const { error } = await db.from('groups')
        .update(updateData)
        .eq('id', currentGroup.id);
    
    if (error) {
        showToast('Erro ao atualizar grupo: ' + error.message, 'error');
        return;
    }
    
    currentGroup = {
        ...currentGroup,
        ...updateData
    };
    
    document.getElementById('headerGroupName').textContent = newName;
    
    const user = await getCurrentUser();
    await loadSidebarGroups(user.id);
    
    const activeTab = document.querySelector('.tab-content.active')?.id;
    if (activeTab === 'tabDetalhes') {
        await loadDetalhes();
    }
    
    closeModal('editGroupModal');
    showToast('Grupo atualizado com sucesso!', 'success');
}

async function openManageMembersModal() {
    if (!currentGroup) {
        showToast('Nenhum grupo selecionado', 'warning');
        return;
    }
    
    if (currentUserRole !== 'admin') {
        showToast('Apenas administradores podem gerenciar membros', 'error');
        return;
    }
    
    let modal = document.getElementById('manageMembersModal');
    if (!modal) {
        createManageMembersModal();
        modal = document.getElementById('manageMembersModal');
    }
    
    await loadMembersList();
    modal.classList.add('open');
}

function createManageMembersModal() {
    const modalHTML = `
        <div id="manageMembersModal" class="modal">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>👥 Gerenciar Membros</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="membersListContainer">
                        <div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('manageMembersModal')">Fechar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const closeBtn = document.querySelector('#manageMembersModal .modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal('manageMembersModal');
        });
    }
    
    const modal = document.getElementById('manageMembersModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal('manageMembersModal');
            }
        });
    }
}

async function loadMembersList() {
    const container = document.getElementById('membersListContainer');
    if (!container || !currentGroup) return;
    
    const { data: members } = await db.from('group_members')
        .select('*, profiles:user_id(id, name, email, avatar_url)')
        .eq('group_id', currentGroup.id)
        .order('role', { ascending: false });
    
    if (!members || members.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhum membro encontrado</p></div>';
        return;
    }
    
    const currentUser = await getCurrentUser();
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    for (const member of members) {
        const profile = member.profiles;
        const isCurrentUser = profile.id === currentUser.id;
        const isAdmin = member.role === 'admin';
        const canRemove = !isCurrentUser && currentUserRole === 'admin';
        const canPromote = !isAdmin && currentUserRole === 'admin' && !isCurrentUser;
        
        html += `
            <div class="member-management-item" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee;">
                <img src="${profile?.avatar_url || 'https://via.placeholder.com/40'}" 
                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 12px;">
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${escapeHtml(profile?.name || 'Usuário')}</div>
                    <div style="font-size: 12px; color: #666;">${escapeHtml(profile?.email || '')}</div>
                    ${isAdmin ? '<span class="badge badge-info" style="font-size: 11px;">Admin</span>' : '<span class="badge badge-secondary" style="font-size: 11px;">Membro</span>'}
                </div>
                <div style="display: flex; gap: 8px;">
                    ${canPromote ? `
                        <button class="btn btn-sm btn-primary promote-member-btn" data-user-id="${profile.id}" data-user-name="${escapeHtml(profile?.name)}">
                            👑 Promover
                        </button>
                    ` : ''}
                    ${canRemove ? `
                        <button class="btn btn-sm btn-danger remove-member-btn" data-user-id="${profile.id}" data-user-name="${escapeHtml(profile?.name)}">
                            🗑️ Remover
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    document.querySelectorAll('.promote-member-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const userName = btn.dataset.userName;
            await promoteToAdmin(userId, userName);
        });
    });
    
    document.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const userName = btn.dataset.userName;
            await removeMember(userId, userName);
        });
    });
}

async function promoteToAdmin(userId, userName) {
    if (!confirm(`Promover ${userName} para administrador?`)) return;
    
    const { error } = await db.from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', currentGroup.id)
        .eq('user_id', userId);
    
    if (error) {
        showToast('Erro ao promover membro: ' + error.message, 'error');
    } else {
        showToast(`${userName} agora é administrador!`, 'success');
        await loadMembersList();
        await loadDetalhes();
    }
}

async function removeMember(userId, userName) {
    if (!confirm(`Remover ${userName} do grupo?`)) return;
    
    const { data: admins } = await db.from('group_members')
        .select('user_id')
        .eq('group_id', currentGroup.id)
        .eq('role', 'admin');
    
    const isLastAdmin = admins.length === 1 && admins[0].user_id === userId;
    
    if (isLastAdmin) {
        showToast('Não é possível remover o último administrador do grupo', 'error');
        return;
    }
    
    const { error } = await db.from('group_members')
        .delete()
        .eq('group_id', currentGroup.id)
        .eq('user_id', userId);
    
    if (error) {
        showToast('Erro ao remover membro: ' + error.message, 'error');
    } else {
        showToast(`${userName} foi removido do grupo`, 'success');
        await loadMembersList();
        await loadSidebarGroups((await getCurrentUser()).id);
        
        const currentUser = await getCurrentUser();
        if (userId === currentUser.id) {
            currentGroup = null;
            document.getElementById('noGroupState').style.display = 'block';
            document.getElementById('bottomNav').style.display = 'none';
            document.getElementById('fabRegister').style.display = 'none';
            document.getElementById('headerGroupName').textContent = 'FATFIT';
            closeModal('manageMembersModal');
            showToast('Você foi removido do grupo', 'info');
        } else {
            await loadDetalhes();
        }
    }
}

async function deleteGroup() {
    if (!currentGroup) return;
    
    if (currentUserRole !== 'admin') {
        showToast('Apenas administradores podem deletar o grupo', 'error');
        return;
    }
    
    const confirmMessage = `Tem certeza que deseja deletar o grupo "${currentGroup.name}"?\n\nEsta ação é irreversível e todos os dados do grupo serão perdidos!`;
    
    if (!confirm(confirmMessage)) return;
    
    showToast('Deletando grupo...', 'info');
    
    try {
        const { data: challenges } = await db.from('challenges')
            .select('id')
            .eq('group_id', currentGroup.id);
        
        if (challenges && challenges.length > 0) {
            const challengeIds = challenges.map(c => c.id);
            
            await db.from('daily_activities')
                .delete()
                .in('challenge_id', challengeIds);
            
            await db.from('challenge_participants')
                .delete()
                .in('challenge_id', challengeIds);
            
            await db.from('challenge_winners')
                .delete()
                .in('challenge_id', challengeIds);
            
            await db.from('challenges')
                .delete()
                .eq('group_id', currentGroup.id);
        }
        
        await db.from('messages')
            .delete()
            .eq('group_id', currentGroup.id);
        
        await db.from('group_members')
            .delete()
            .eq('group_id', currentGroup.id);
        
        const { error } = await db.from('groups')
            .delete()
            .eq('id', currentGroup.id);
        
        if (error) throw error;
        
        currentGroup = null;
        currentUserRole = null;
        
        document.getElementById('noGroupState').style.display = 'block';
        document.getElementById('bottomNav').style.display = 'none';
        document.getElementById('fabRegister').style.display = 'none';
        document.getElementById('headerGroupName').textContent = 'FATFIT';
        
        const user = await getCurrentUser();
        await loadSidebarGroups(user.id);
        
        showToast('Grupo deletado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao deletar grupo:', error);
        showToast('Erro ao deletar grupo: ' + error.message, 'error');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
}

// ============================================
// PÁGINA: activity.html (REGISTRO FLEXÍVEL)
// ============================================
// ============================================
// PÁGINA: activity.html (REGISTRO FLEXÍVEL)
// ============================================
if (window.location.pathname.includes('activity')) {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('📸 Activity.html carregado');
        
        const session = await requireAuth();
        if (!session) {
            console.log('❌ Sem sessão, voltando');
            return;
        }
        
        console.log('✅ Sessão OK, usuário:', session.user.id);
        await setupActivity(session);
    });
}

async function setupActivity(session) {
    console.log('🚀 setupActivity iniciado');
    
    const user = session.user;
    const params = new URLSearchParams(window.location.search);
    
    let challengeIds = [];
    
    if (params.get('challenges')) {
        challengeIds = params.get('challenges').split(',').filter(Boolean);
        console.log('📋 Múltiplos desafios:', challengeIds);
    } else if (params.get('challenge')) {
        challengeIds = [params.get('challenge')];
        console.log('📋 Desafio único:', challengeIds[0]);
    } else {
        const stored = localStorage.getItem('fatfit_register_challenges');
        if (stored) {
            try { 
                challengeIds = JSON.parse(stored); 
                console.log('📋 Desafios do localStorage:', challengeIds);
            } catch(e) {
                console.error('❌ Erro ao parsear localStorage:', e);
            }
        }
    }
    
    if (challengeIds.length === 0) {
        console.log('❌ Nenhum desafio encontrado');
        showToast('Nenhum desafio selecionado', 'error');
        setTimeout(() => location.replace('home.html'), 1500);
        return;
    }
    
    // Busca TODOS os desafios
    const challenges = [];
    for (const id of challengeIds) {
        console.log('🔍 Buscando desafio:', id);
        const { data: challenge, error } = await db.from('challenges')
            .select('*, groups:group_id(name)').eq('id', id).single();
        
        if (error) {
            console.error('❌ Erro ao buscar desafio:', id, error);
            continue;
        }
        
        if (challenge) {
            console.log('✅ Desafio encontrado:', challenge.name, 'Status:', challenge.status);
            challenges.push(challenge);
        } else {
            console.log('⚠️ Desafio não encontrado:', id);
        }
    }
    
    if (challenges.length === 0) {
        console.log('❌ Nenhum desafio válido');
        showToast('Nenhum desafio encontrado', 'error');
        setTimeout(() => location.replace('home.html'), 1500);
        return;
    }
    
    console.log('✅ Total de desafios válidos:', challenges.length);
    
    // Mostra grupos selecionados com status
    const today = getToday();
    const groupsDiv = document.getElementById('selectedGroups');
    
    if (!groupsDiv) {
        console.error('❌ Elemento selectedGroups não encontrado!');
        showToast('Erro na página', 'error');
        setTimeout(() => location.replace('home.html'), 1000);
        return;
    }
    
    groupsDiv.innerHTML = challenges.map(c => {
        const inPeriod = today >= c.start_date && today <= c.end_date;
        const willScore = c.status === 'active' && inPeriod;
        
        return `
            <span class="badge ${willScore ? 'badge-success' : 'badge-secondary'}" 
                  style="margin:3px;font-size:0.85rem;padding:6px 12px;">
                ${escapeHtml(c.groups?.name || 'Grupo')} - ${escapeHtml(c.name || 'Desafio')}
                ${willScore ? ' (+1 pt)' : ' (sem ponto)'}
            </span>
        `;
    }).join('');
    
    const scoringCount = challenges.filter(c => {
        const inPeriod = today >= c.start_date && today <= c.end_date;
        return c.status === 'active' && inPeriod;
    }).length;
    
    document.getElementById('registerInfo').textContent = 
        `Registrando em ${challenges.length} grupo(s) • ${scoringCount} pontuando`;
    document.getElementById('submitInfo').textContent = 
        scoringCount > 0 ? `Você ganhará +${scoringCount} ponto(s) hoje` : 'Nenhum desafio está em período de pontuação';
    
    // Verifica se já registrou hoje
    const validChallenges = [];
    
    for (const c of challenges) {
        const { data: todayActivity } = await db.from('daily_activities')
            .select('id').eq('user_id', user.id).eq('challenge_id', c.id)
            .eq('activity_date', today).maybeSingle();
        
        if (todayActivity) {
            const inPeriod = today >= c.start_date && today <= c.end_date;
            if (c.status === 'active' && inPeriod) {
                console.log('⚠️ Já registrou hoje no desafio:', c.name);
                continue;
            }
        }
        validChallenges.push(c);
    }
    
    if (validChallenges.length === 0) {
        console.log('⚠️ Já registrou em todos hoje');
        showToast('Já registrou em todos os desafios pontuáveis hoje!', 'warning');
        setTimeout(() => location.replace('home.html'), 2000);
        return;
    }
    
    console.log('✅ Desafios válidos para registro:', validChallenges.length);
    console.log('📸 Iniciando câmera...');
    
    // Continua com o resto da função...
    let photoFile = null;
    let locationData = null;
    
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('photoCanvas');
    const photo = document.getElementById('photoResult');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    
    if (!video || !captureBtn) {
        console.error('❌ Elementos da câmera não encontrados!');
        showToast('Erro ao carregar câmera', 'error');
        setTimeout(() => location.replace('home.html'), 2000);
        return;
    }
    
    async function startCamera() {
        try {
            console.log('🎥 Solicitando acesso à câmera...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            video.srcObject = stream;
            await video.play();
            console.log('✅ Câmera iniciada');
        } catch (e) { 
            console.error('❌ Erro câmera:', e);
            showToast('Erro ao acessar câmera. Verifique as permissões.', 'error'); 
        }
    }
    await startCamera();
    
    captureBtn.addEventListener('click', () => {
        console.log('📸 Foto capturada');
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
    
    retakeBtn.addEventListener('click', async () => {
        console.log('🔄 Refazendo foto');
        photo.style.display = 'none';
        retakeBtn.style.display = 'none';
        video.style.display = 'block';
        captureBtn.style.display = 'flex';
        photoFile = null;
        await startCamera();
    });
    
    document.getElementById('getLocationBtn')?.addEventListener('click', () => {
        if (!navigator.geolocation) { 
            showToast('Geolocalização não suportada', 'warning'); 
            return; 
        }
        console.log('📍 Solicitando localização...');
        navigator.geolocation.getCurrentPosition(
            pos => {
                locationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                document.getElementById('locationStatus').textContent = '✓ Capturada';
                document.getElementById('locationStatus').style.color = 'var(--secondary)';
                console.log('✅ Localização capturada');
            },
            (err) => {
                console.error('❌ Erro localização:', err);
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
        
        console.log('📤 Enviando atividade...');
        
        if (!photoFile) { 
            showToast('Tire uma foto primeiro!', 'error'); 
            return; 
        }
        
        const btn = document.getElementById('submitBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        
        const comment = document.getElementById('activityComment')?.value?.trim() || null;
        let successCount = 0;
        let pointsEarned = 0;
        let errorCount = 0;
        
        for (let i = 0; i < validChallenges.length; i++) {
            const challenge = validChallenges[i];
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Salvando ${i + 1}/${validChallenges.length}...`;
            
            try {
                console.log(`📤 Upload ${i+1}/${validChallenges.length} para desafio:`, challenge.id);
                
                const fileName = `${user.id}/${challenge.id}/${Date.now()}_${i}.jpg`;
                const { error: upErr } = await db.storage.from('activity-photos')
                    .upload(fileName, photoFile, { contentType: 'image/jpeg', upsert: false });
                
                if (upErr) {
                    console.error('❌ Erro upload:', upErr);
                    errorCount++;
                    continue;
                }
                
                const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
                
                const inPeriod = today >= challenge.start_date && today <= challenge.end_date;
                const activityStatus = 'valid';
                
                const { error: actErr } = await db.from('daily_activities').insert({
                    user_id: user.id,
                    challenge_id: challenge.id,
                    activity_date: today,
                    photo_url: urlData.publicUrl,
                    location: locationData,
                    comment: comment,
                    status: activityStatus
                });
                
                if (actErr) {
                    console.error('❌ Erro insert atividade:', actErr);
                    errorCount++;
                } else {
                    console.log('✅ Atividade registrada:', challenge.name);
                    successCount++;
                    if (activityStatus === 'valid' && challenge.status === 'active' && inPeriod) {
                        pointsEarned++;
                    }
                }
            } catch (err) {
                console.error('❌ Erro geral:', err);
                errorCount++;
            }
        }
        
        localStorage.removeItem('fatfit_register_challenges');
        
        if (successCount > 0) {
            const msg = pointsEarned > 0 
                ? `Registrado em ${successCount} grupo(s)! 🎉 +${pointsEarned} pontos` 
                : `Registrado em ${successCount} grupo(s)! (fora do período)`;
            showToast(msg, 'success');
            console.log('✅ Sucesso! Redirecionando...');
        } else {
            showToast('Erro ao registrar atividade', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
        
        setTimeout(() => location.replace('home.html'), 1500);
    });
    
    console.log('✅ setupActivity concluído - aguardando ação do usuário');
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

// Função de debug para verificar o botão de registro
function debugRegisterButton() {
    console.log('🔍 Verificando botões de registro...');
    const btns = document.querySelectorAll('.register-activity-btn');
    console.log(`Encontrados ${btns.length} botões de registro`);
    btns.forEach((btn, i) => {
        console.log(`Botão ${i + 1}:`, {
            id: btn.dataset.id,
            texto: btn.textContent,
            visivel: btn.offsetParent !== null
        });
    });
}

// Função de teste para debug
window.testFAB = function() {
    console.log('=== TESTE DO FAB ===');
    console.log('currentGroup:', currentGroup);
    console.log('currentUserRole:', currentUserRole);
    const fab = document.getElementById('fabRegister');
    console.log('Elemento FAB:', fab);
    if (fab) {
        console.log('FAB está visível:', fab.style.display);
        console.log('FAB classes:', fab.className);
    }
    console.log('openRegisterModal function:', typeof openRegisterModal);
};

// Também adicione uma função para ir direto para registro
window.quickRegister = function() {
    if (!currentGroup) {
        console.log('Sem grupo selecionado');
        return;
    }
    console.log('Indo direto para registro do grupo:', currentGroup.name);
    // Buscar primeiro desafio ativo
    db.from('challenges')
        .select('id')
        .eq('group_id', currentGroup.id)
        .eq('status', 'active')
        .limit(1)
        .then(({ data }) => {
            if (data && data.length > 0) {
                localStorage.setItem('fatfit_register_challenges', JSON.stringify([data[0].id]));
                window.location.href = 'activity.html';
            } else {
                showToast('Nenhum desafio ativo', 'warning');
            }
        });
};

// ============================================
// FUNÇÕES DE CALENDÁRIO
// ============================================

/**
 * Renderiza um calendário mensal
 * @param {string} containerId - ID do elemento container
 * @param {Array} activities - Array de atividades do mês
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @param {object} options - Opções adicionais
 */
function renderCalendar(containerId, activities, month, year, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container não encontrado:', containerId);
        return;
    }
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const today = getToday();
    const todayParts = today.split('-');
    const todayDay = parseInt(todayParts[2]);
    const todayMonth = parseInt(todayParts[1]);
    const todayYear = parseInt(todayParts[0]);
    
    // Agrupa atividades por dia
    const activitiesByDay = {};
    if (activities) {
        for (const a of activities) {
            if (!a.activity_date) continue;
            const day = parseInt(a.activity_date.split('-')[2]);
            if (!activitiesByDay[day]) activitiesByDay[day] = [];
            activitiesByDay[day].push(a);
        }
    }
    
    // Salva o mês/ano atual no container
    container.dataset.month = month;
    container.dataset.year = year;
    container.dataset.activities = JSON.stringify(activitiesByDay);
    container.dataset.containerId = containerId;
    
    let html = `
        <div class="calendar-container">
            <div class="calendar-header">
                <h3 class="calendar-title">${monthNames[month - 1]} ${year}</h3>
                <div class="calendar-nav">
                    <button class="calendar-nav-btn" onclick="window.navigateCalendar('${containerId}', -1)" title="Mês anterior">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="calendar-nav-btn" onclick="window.navigateCalendar('${containerId}', 1)" title="Próximo mês">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            
            <div class="calendar-weekdays">
                ${weekDays.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
            </div>
            
            <div class="calendar-grid">
    `;
    
    // Dias vazios antes do primeiro dia
    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === todayDay && month === todayMonth && year === todayYear;
        const dayActivities = activitiesByDay[day] || [];
        const hasActivity = dayActivities.length > 0;
        
        let dayClass = 'calendar-day';
        if (isToday) dayClass += ' today';
        if (hasActivity) dayClass += ' has-activity';
        
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        html += `<div class="${dayClass}" data-date="${dateStr}" ${hasActivity ? `onclick="window.openDayDetail('${dateStr}', '${containerId}')"` : ''}>`;
        html += '<div class="calendar-day-inner">';
        html += `<span class="calendar-day-number">${day}</span>`;
        
        if (hasActivity) {
            const firstPhoto = dayActivities[0].photo_url;
            html += `<img src="${firstPhoto}" class="calendar-day-photo" alt="Atividade" loading="lazy" onerror="this.style.display='none'">`;
            
            if (dayActivities.length > 1) {
                html += `<span class="calendar-day-badge">+${dayActivities.length - 1}</span>`;
            }
        }
        
        html += '</div></div>';
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    console.log(`📅 Calendário renderizado: ${containerId} - ${monthNames[month - 1]} ${year}`);
}

// Navegação do calendário (função global)
window.navigateCalendar = async function(containerId, direction) {
    console.log(`🔄 Navegando calendário: ${containerId} direção: ${direction}`);
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container não encontrado:', containerId);
        return;
    }
    
    let month = parseInt(container.dataset.month);
    let year = parseInt(container.dataset.year);
    
    if (!month || !year) {
        console.error('Mês/ano não encontrados no container');
        return;
    }
    
    // Calcula novo mês/ano
    month += direction;
    if (month < 1) {
        month = 12;
        year--;
    } else if (month > 12) {
        month = 1;
        year++;
    }
    
    console.log(`📅 Novo período: ${month}/${year}`);
    
    // Atualiza variáveis globais e recarrega
    if (containerId === 'profileCalendar') {
        currentProfileMonth = month;
        currentProfileYear = year;
        await loadProfileCalendar(month, year);
    } else if (containerId === 'personCalendar') {
        currentPersonMonth = month;
        currentPersonYear = year;
        const params = new URLSearchParams(window.location.search);
        await loadPersonCalendar(params.get('user'), params.get('group'), month, year);
    } else if (containerId === 'groupCalendar') {
        currentGroupMonth = month;
        currentGroupYear = year;
        await loadGroupCalendar(month, year);
    }
};

// Abrir detalhes do dia (função global)
window.openDayDetail = function(dateStr, containerId) {
    console.log(`🔍 Abrindo detalhes do dia: ${dateStr}`);
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let activitiesByDay;
    try {
        activitiesByDay = JSON.parse(container.dataset.activities);
    } catch (e) {
        console.error('Erro ao parsear atividades:', e);
        return;
    }
    
    const day = parseInt(dateStr.split('-')[2]);
    const dayActivities = activitiesByDay[day] || [];
    
    if (dayActivities.length === 0) return;
    
    const modal = document.getElementById('dayDetailModal');
    const title = document.getElementById('dayDetailTitle');
    const body = document.getElementById('dayDetailBody');
    
    if (!modal || !title || !body) {
        console.error('Modal de detalhes não encontrado');
        return;
    }
    
    const [year, month, dayNum] = dateStr.split('-');
    title.textContent = `📅 ${dayNum}/${month}/${year}`;
    
    let html = '';
    
    for (const a of dayActivities) {
        html += `
            <div class="day-detail-item">
                <img src="${a.photo_url}" class="day-detail-photo" onclick="window.open('${a.photo_url}')" alt="Foto" onerror="this.style.display='none'">
                <div class="day-detail-info">
                    <div class="day-detail-name">${escapeHtml(a.user_name || 'Usuário')}</div>
                    <div class="day-detail-meta">
                        <span>👥 ${escapeHtml(a.group_name || 'Grupo')}</span>
                        <span>🎯 ${escapeHtml(a.challenge_name || 'Desafio')}</span>
                    </div>
                    ${a.comment ? `<p class="day-detail-comment">💬 ${escapeHtml(a.comment)}</p>` : ''}
                    ${a.location ? '<span class="text-xs text-muted">📍 Localização registrada</span>' : ''}
                </div>
            </div>
        `;
    }
    
    body.innerHTML = html;
    modal.classList.add('open');
};

// Funções auxiliares para navegação
let currentProfileMonth = new Date().getMonth() + 1;
let currentProfileYear = new Date().getFullYear();
let currentPersonMonth = new Date().getMonth() + 1;
let currentPersonYear = new Date().getFullYear();
let currentGroupMonth = new Date().getMonth() + 1;
let currentGroupYear = new Date().getFullYear();

function hasPreviousMonth(month, year) {
    const now = new Date();
    return !(year < 2024 || (year === 2024 && month <= 1));
}

function hasNextMonth(month, year) {
    const now = new Date();
    return !(year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1));
}

async function changeMonth(containerId, currentMonth, currentYear, direction) {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    
    if (newMonth < 1) {
        newMonth = 12;
        newYear--;
    } else if (newMonth > 12) {
        newMonth = 1;
        newYear++;
    }
    
    // Atualiza variáveis globais baseado no container
    if (containerId === 'profileCalendar') {
        currentProfileMonth = newMonth;
        currentProfileYear = newYear;
        await loadProfileCalendar(newMonth, newYear);
    } else if (containerId === 'personCalendar') {
        currentPersonMonth = newMonth;
        currentPersonYear = newYear;
        const params = new URLSearchParams(window.location.search);
        await loadPersonCalendar(params.get('user'), params.get('group'), newMonth, newYear);
    } else if (containerId === 'groupCalendar') {
        currentGroupMonth = newMonth;
        currentGroupYear = newYear;
        await loadGroupCalendar(newMonth, newYear);
    }
}

// ============================================
// ABRIR DETALHES DO DIA (MODAL)
// ============================================
function openDayDetail(dateStr, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let activitiesByDay;
    try {
        activitiesByDay = JSON.parse(container.dataset.activities);
    } catch (e) {
        console.error('Erro ao parsear atividades:', e);
        return;
    }
    
    const day = parseInt(dateStr.split('-')[2]);
    const dayActivities = activitiesByDay[day] || [];
    
    if (dayActivities.length === 0) return;
    
    const modal = document.getElementById('dayDetailModal');
    const title = document.getElementById('dayDetailTitle');
    const body = document.getElementById('dayDetailBody');
    
    const [year, month, dayNum] = dateStr.split('-');
    title.textContent = `📅 ${dayNum}/${month}/${year}`;
    
    let html = '';
    
    for (const a of dayActivities) {
        html += `
            <div class="day-detail-item">
                <img src="${a.photo_url}" class="day-detail-photo" onclick="window.open('${a.photo_url}')" alt="Foto">
                <div class="day-detail-info">
                    <div class="day-detail-name">${escapeHtml(a.user_name || 'Usuário')}</div>
                    <div class="day-detail-meta">
                        <span>👥 ${escapeHtml(a.group_name || 'Grupo')}</span>
                        <span>🎯 ${escapeHtml(a.challenge_name || 'Desafio')}</span>
                    </div>
                    ${a.comment ? `<p class="day-detail-comment">💬 ${escapeHtml(a.comment)}</p>` : ''}
                    ${a.location ? '<span class="text-xs text-muted">📍 Localização registrada</span>' : ''}
                </div>
            </div>
        `;
    }
    
    body.innerHTML = html;
    modal.classList.add('open');
}

// ============================================
// CALENDÁRIO DO PERFIL (todos os grupos)
// ============================================
async function loadProfileCalendar(month, year) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const container = document.getElementById('profileCalendar');
    if (!container) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    if (!month) month = currentProfileMonth;
    if (!year) year = currentProfileYear;
    
    console.log(`📅 Carregando calendário do perfil: ${month}/${year}`);
    
    const { data: activities, error } = await db.rpc('get_calendar_data', {
        p_user_id: user.id,
        p_group_id: null,
        p_month: month,
        p_year: year
    });
    
    if (error) {
        console.error('Erro ao carregar calendário do perfil:', error);
        container.innerHTML = '<p class="empty-state">Erro ao carregar</p>';
        return;
    }
    
    console.log(`📊 Atividades encontradas: ${activities?.length || 0}`);
    renderCalendar('profileCalendar', activities, month, year);
}

// ============================================
// CALENDÁRIO DA PESSOA (grupo específico)
// ============================================
async function loadPersonCalendar(userId, groupId, month, year) {
    const container = document.getElementById('personCalendar');
    if (!container) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    if (!month) month = currentPersonMonth;
    if (!year) year = currentPersonYear;
    
    console.log(`📅 Carregando calendário da pessoa: ${userId} - ${month}/${year}`);
    
    const { data: activities, error } = await db.rpc('get_calendar_data', {
        p_user_id: userId,
        p_group_id: groupId,
        p_month: month,
        p_year: year
    });
    
    if (error) {
        console.error('Erro ao carregar calendário da pessoa:', error);
        container.innerHTML = '<p class="empty-state">Erro ao carregar</p>';
        return;
    }
    
    console.log(`📊 Atividades encontradas: ${activities?.length || 0}`);
    renderCalendar('personCalendar', activities, month, year);
}


// ============================================
// CALENDÁRIO DO GRUPO (todos os membros)
// ============================================
async function loadGroupCalendar(month, year) {
    if (!currentGroup) {
        console.log('Nenhum grupo selecionado para o calendário');
        return;
    }
    
    const container = document.getElementById('groupCalendar');
    if (!container) return;
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    if (!month) month = currentGroupMonth;
    if (!year) year = currentGroupYear;
    
    console.log(`📅 Carregando calendário do grupo: ${currentGroup.name} - ${month}/${year}`);
    
    const { data: activities, error } = await db.rpc('get_calendar_data', {
        p_user_id: null,
        p_group_id: currentGroup.id,
        p_month: month,
        p_year: year
    });
    
    if (error) {
        console.error('Erro ao carregar calendário do grupo:', error);
        container.innerHTML = '<p class="empty-state">Erro ao carregar</p>';
        return;
    }
    
    console.log(`📊 Atividades encontradas: ${activities?.length || 0}`);
    renderCalendar('groupCalendar', activities, month, year);
}

// ============================================
// ATUALIZAÇÕES NAS PÁGINAS EXISTENTES
// ============================================

// Atualiza loadDetalhes para incluir calendário do grupo
const originalLoadDetalhes = loadDetalhes;
loadDetalhes = async function() {
    await originalLoadDetalhes();
    
    // Adiciona seção de calendário após o conteúdo existente
    const container = document.getElementById('detalhesContent');
    if (!container || !currentGroup) return;
    
    // Adiciona o calendário do grupo
    const calendarSection = document.createElement('div');
    calendarSection.innerHTML = `
        <div class="group-detail-card mt-2">
            <h3>📅 Calendário do Grupo</h3>
            <div id="groupCalendar">
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
            </div>
            <div class="calendar-legend">
                <div class="calendar-legend-item">
                    <div class="calendar-legend-dot"></div>
                    <span>Dia com atividade</span>
                </div>
            </div>
        </div>
    `;
    container.appendChild(calendarSection);
    
    // Carrega o calendário
    await loadGroupCalendar(currentGroupMonth, currentGroupYear);
};

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
    
    if (!userId || !groupId) {
        showToast('Parâmetros inválidos', 'error');
        setTimeout(() => history.back(), 1500);
        return;
    }
    
    // Busca perfil da pessoa
    const profile = await getProfile(userId);
    const { data: group } = await db.from('groups').select('name').eq('id', groupId).single();
    
    if (profile) {
        document.getElementById('personName').textContent = profile.name || 'Usuário';
        document.getElementById('personAvatar').src = profile.avatar_url || 'https://via.placeholder.com/80';
        document.getElementById('personGroup').textContent = '👥 ' + (group?.name || 'Grupo');
        document.getElementById('personPageTitle').textContent = profile.name || 'Atividades';
    }
    
    // Busca estatísticas
    const { data: activities } = await db.rpc('get_calendar_data', {
        p_user_id: userId,
        p_group_id: groupId
    });
    
    if (activities) {
        const uniqueDays = new Set(activities.map(a => a.activity_date)).size;
        document.getElementById('personDays').textContent = uniqueDays;
        
        // Calcula maior sequência
        const dates = [...new Set(activities.map(a => a.activity_date))].sort();
        let maxStreak = 0;
        let currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i-1]);
            const curr = new Date(dates[i]);
            const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diffDays === 1) {
                currentStreak++;
            } else {
                maxStreak = Math.max(maxStreak, currentStreak);
                currentStreak = 1;
            }
        }
        maxStreak = Math.max(maxStreak, currentStreak);
        document.getElementById('personStreak').textContent = maxStreak;
    }
    
    // Busca pontos no desafio ativo
    const { data: activeChallenge } = await db.from('challenges')
        .select('id').eq('group_id', groupId).eq('status', 'active').maybeSingle();
    
    if (activeChallenge) {
        const { data: participant } = await db.from('challenge_participants')
            .select('points').eq('challenge_id', activeChallenge.id).eq('user_id', userId).maybeSingle();
        document.getElementById('personPoints').textContent = participant?.points || 0;
    }
    
    // Carrega calendário
    await loadPersonCalendar(userId, groupId);
    
    // Carrega atividades recentes
    const { data: recentActivities } = await db.from('daily_activities')
        .select('*, challenges:challenge_id(name), profiles:user_id(name)')
        .eq('user_id', userId)
        .eq('challenge_id', 
            (await db.from('challenges').select('id').eq('group_id', groupId)).data?.map(c => c.id) || []
        )
        .order('created_at', { ascending: false })
        .limit(20);
    
    const activitiesContainer = document.getElementById('personActivities');
    if (recentActivities && recentActivities.length > 0) {
        activitiesContainer.innerHTML = recentActivities.map(a => `
            <div class="card activity-card mb-1">
                <img src="${a.photo_url}" class="day-detail-photo" onclick="window.open('${a.photo_url}')" style="cursor:pointer;">
                <div class="day-detail-info">
                    <div class="text-sm">📅 ${formatDate(a.activity_date)}</div>
                    <div class="text-xs text-muted">🎯 ${escapeHtml(a.challenges?.name || 'Desafio')}</div>
                    ${a.comment ? `<p class="text-sm mt-1">${escapeHtml(a.comment)}</p>` : ''}
                </div>
                <span class="badge badge-success">+1</span>
            </div>
        `).join('');
    } else {
        activitiesContainer.innerHTML = '<p class="empty-state">Nenhuma atividade ainda</p>';
    }
}

// ============================================
// PÁGINA: profile.html (ATUALIZADA)
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
    
    // Avatar upload
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => {
        document.getElementById('avatarInput').click();
    });
    
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
    
    // Toggle editar perfil
    document.getElementById('openEditProfileBtn')?.addEventListener('click', () => {
        const section = document.getElementById('editProfileSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        document.getElementById('changePasswordSection').style.display = 'none';
    });
    
    // Toggle trocar senha
    document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => {
        const section = document.getElementById('changePasswordSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        document.getElementById('editProfileSection').style.display = 'none';
    });
    
    // Salvar perfil
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        const pix = document.getElementById('editPixKey').value.trim();
        if (!name) { showToast('Nome obrigatório', 'error'); return; }
        await db.from('profiles').update({ name, pix_key: pix || null }).eq('id', user.id);
        document.getElementById('profileName').textContent = name;
        document.getElementById('editProfileSection').style.display = 'none';
        showToast('Perfil salvo!', 'success');
    });
    
    // Trocar senha
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const curr = document.getElementById('currentPassword').value;
        const newPw = document.getElementById('newPassword').value;
        if (newPw.length < 6) { showToast('Mínimo 6 caracteres', 'error'); return; }
        
        const { error } = await db.auth.signInWithPassword({ email: user.email, password: curr });
        if (error) { showToast('Senha atual incorreta', 'error'); return; }
        
        const { error: updateError } = await db.auth.updateUser({ password: newPw });
        if (updateError) { showToast('Erro ao trocar senha', 'error'); }
        else { 
            showToast('Senha alterada!', 'success'); 
            document.getElementById('changePasswordForm').reset();
            document.getElementById('changePasswordSection').style.display = 'none';
        }
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
    
    // Lista de vitórias
    const list = document.getElementById('winsList');
    if (!wins?.length) {
        list.innerHTML = '<p class="empty-state"><i class="fas fa-trophy"></i> Nenhuma vitória ainda</p>';
    } else {
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
    
    // Carrega calendário
    await loadProfileCalendar();
}

// ============================================
// FECHAR MODAL AO CLICAR FORA
// ============================================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('open')) {
        e.target.classList.remove('open');
    }
});


// Expor funções globalmente
window.closeModal = closeModal;
window.openRegisterModal = openRegisterModal;
window.openEditGroupModal = openEditGroupModal;
window.openManageMembersModal = openManageMembersModal;
window.deleteGroup = deleteGroup;
window.debugRegisterButton = debugRegisterButton;