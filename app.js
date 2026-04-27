// ============================================
// FATFIT - Aplicação Principal
// ============================================

// Referência ao cliente Supabase
const db = window.db;

// Função para obter o db (caso necessário)
function getDb() {
    return window.db;
}

// Verifica se o db está disponível
if (!db) {
    console.error('ERRO: Supabase não foi inicializado!');
    alert('Erro de conexão. Recarregue a página.');
}

// ============================================
// UTILITÁRIOS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 4000);
}

function formatCurrency(value) {
    return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = dateStr.split('T')[0].split('-');
    return d[2] + '/' + d[1] + '/' + d[0];
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

// ============================================
// AUTENTICAÇÃO
// ============================================

async function checkAuth() {
    try {
        const { data: { session } } = await db.auth.getSession();
        return session;
    } catch (e) {
        console.error('Erro auth:', e);
        return null;
    }
}

async function requireAuth() {
    const session = await checkAuth();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

async function getCurrentUser() {
    try {
        const { data: { user } } = await db.auth.getUser();
        return user;
    } catch (e) {
        return null;
    }
}

// ============================================
// FUNÇÃO GLOBAL showForm
// ============================================
function showForm(formId) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
}

// ============================================
// PÁGINA: index.html
// ============================================
if (document.querySelector('.auth-page')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await checkAuth();
        if (session) {
            window.location.href = 'dashboard.html';
            return;
        }
        setupAuthForms();
    });
}

function setupAuthForms() {
    // Toggle password
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.password-wrapper').querySelector('input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        const { error } = await db.auth.signInWithPassword({ email, password });
        
        if (error) {
            const msg = error.message.includes('Invalid login') ? 'E-mail ou senha incorretos' : error.message;
            showToast(msg, 'error');
        } else {
            showToast('Login realizado!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 500);
        }
    });

    // Cadastro
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        
        if (password.length < 6) {
            showToast('Senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }
        
        const { error } = await db.auth.signUp({
            email,
            password,
            options: { data: { name } }
        });
        
        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Conta criada! Agora faça login.', 'success');
            setTimeout(() => showForm('loginForm'), 2000);
        }
    });

    // Recuperar senha
    document.getElementById('recoverForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoverEmail').value.trim();
        
        const { error } = await db.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html'
        });
        
        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Email de recuperação enviado!', 'success');
            setTimeout(() => showForm('loginForm'), 2000);
        }
    });
}

// ============================================
// PÁGINA: dashboard.html
// ============================================
if (window.location.pathname.includes('dashboard')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const session = await requireAuth();
        if (!session) return;
        setupDashboard(session);
    });
}

async function setupDashboard(session) {
    setupSidebar();
    
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.href = 'index.html';
    });
    
    await loadMyGroups();
    
    document.getElementById('createGroupBtn').addEventListener('click', () => {
        document.getElementById('createGroupModal').classList.add('open');
    });
    
    document.getElementById('createGroupForm').addEventListener('submit', createGroup);
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').classList.remove('open'));
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    });
    
    document.getElementById('joinGroupBtn').addEventListener('click', joinByInviteCode);
    document.getElementById('searchGroupBtn').addEventListener('click', searchGroups);
    document.getElementById('clearSearchBtn').addEventListener('click', () => {
        document.getElementById('searchResultsSection').style.display = 'none';
        document.getElementById('searchGroupInput').value = '';
    });
}

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    
    document.getElementById('menuBtn').addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    });
    
    document.getElementById('closeSidebar').addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
    
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

async function loadMyGroups() {
    const db = getDb();
    const grid = document.getElementById('myGroupsGrid');
    if (!grid) return;
    
    const user = await getCurrentUser();
    if (!user) {
        grid.innerHTML = '<p class="empty-state">Faça login novamente</p>';
        return;
    }
    
    console.log('Carregando grupos para:', user.id);
    
    // PRIMEIRO: Busca os group_ids do usuário
    const { data: memberships, error: memberError } = await db
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', user.id);
    
    if (memberError) {
        console.error('Erro ao buscar membros:', memberError);
        grid.innerHTML = '<p class="empty-state">Erro ao carregar grupos</p>';
        return;
    }
    
    console.log('Membros encontrados:', memberships);
    
    if (!memberships || memberships.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users fa-2x"></i>
                <p>Você não está em nenhum grupo</p>
                <button class="btn btn-primary btn-sm mt-1" id="createGroupBtn2">
                    <i class="fas fa-plus"></i> Criar Grupo
                </button>
            </div>
        `;
        document.getElementById('createGroupBtn2')?.addEventListener('click', () => {
            document.getElementById('createGroupModal').classList.add('open');
        });
        return;
    }
    
    grid.innerHTML = '';
    
    // SEGUNDO: Para cada grupo, busca os detalhes separadamente
    for (const m of memberships) {
        try {
            // Busca detalhes do grupo
            const { data: group, error: groupError } = await db
                .from('groups')
                .select('*')
                .eq('id', m.group_id)
                .single();
            
            if (groupError || !group) {
                console.error('Erro ao buscar grupo:', m.group_id, groupError);
                continue;
            }
            
            // Conta membros
            const { count: memberCount } = await db
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id);
            
            // Busca desafio ativo
            const { data: activeChallenge } = await db
                .from('challenges')
                .select('id, name, status')
                .eq('group_id', group.id)
                .in('status', ['pending', 'active'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            // Cria o card
            const card = document.createElement('div');
            card.className = 'card group-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <div class="flex-between mb-1">
                    <h3>${escapeHtml(group.name)}</h3>
                    ${m.role === 'admin' ? '<span class="badge badge-info">Admin</span>' : '<span class="badge badge-success">Membro</span>'}
                </div>
                <p class="text-sm text-muted mb-1">${escapeHtml(group.description || 'Sem descrição')}</p>
                <div class="group-meta">
                    <span><i class="fas fa-users"></i> ${memberCount || 0}/${group.max_members}</span>
                    <span><i class="fas fa-key"></i> ${group.invite_code}</span>
                    ${activeChallenge ? '<span class="badge badge-warning">Desafio ativo</span>' : '<span class="badge badge-secondary">Sem desafio</span>'}
                </div>
            `;
            
            card.addEventListener('click', () => {
                viewGroup(group, m.role);
            });
            
            grid.appendChild(card);
            
        } catch (err) {
            console.error('Erro ao processar grupo:', err);
        }
    }
    
    console.log('Grupos carregados!');
}
async function createGroup(e) {
    e.preventDefault();
    const db = getDb();
    const user = await getCurrentUser();
    
    if (!user) {
        showToast('Erro: usuário não encontrado', 'error');
        return;
    }
    
    const name = document.getElementById('groupName').value.trim();
    const desc = document.getElementById('groupDescription').value.trim();
    const max = parseInt(document.getElementById('groupMaxMembers').value);
    
    if (!name) { showToast('Nome obrigatório', 'error'); return; }
    if (max < 2) { showToast('Mínimo 2 membros', 'error'); return; }
    
    // Gera código de convite
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    
    try {
        // 1. Cria o grupo
        const { data: group, error: groupError } = await db.from('groups').insert({
            name: name,
            description: desc,
            max_members: max,
            creator_id: user.id,
            invite_code: code
        }).select().single();
        
        if (groupError) {
            console.error('Erro ao criar grupo:', groupError);
            showToast('Erro ao criar grupo: ' + groupError.message, 'error');
            return;
        }
        
        console.log('Grupo criado:', group);
        
        // 2. Adiciona o criador como admin
        const { error: memberError } = await db.from('group_members').insert({
            group_id: group.id,
            user_id: user.id,
            role: 'admin'
        });
        
        if (memberError) {
            console.error('Erro ao adicionar membro:', memberError);
            showToast('Grupo criado, mas erro ao adicionar você como membro. Tente entrar usando o código: ' + code, 'warning');
        } else {
            console.log('Membro adicionado com sucesso');
            showToast('Grupo criado com sucesso! Código: ' + code, 'success');
        }
        
        // 3. Fecha o modal e recarrega
        document.getElementById('createGroupModal').classList.remove('open');
        document.getElementById('createGroupForm').reset();
        await loadMyGroups();
        
    } catch (err) {
        console.error('Erro geral:', err);
        showToast('Erro: ' + err.message, 'error');
    }
}
async function joinByInviteCode() {
    const code = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
    const user = await getCurrentUser();
    
    if (code.length !== 8) { showToast('Código inválido', 'error'); return; }
    
    const { data: group, error } = await db.from('groups').select('*').eq('invite_code', code).single();
    
    if (error || !group) { showToast('Grupo não encontrado', 'error'); return; }
    
    const { data: existing } = await db.from('group_members').select('*').eq('group_id', group.id).eq('user_id', user.id).maybeSingle();
    if (existing) { showToast('Você já está neste grupo!', 'warning'); return; }
    
    const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', group.id);
    if (count >= group.max_members) { showToast('Grupo lotado!', 'error'); return; }
    
    await db.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'member' });
    
    showToast('Entrou no grupo: ' + group.name, 'success');
    document.getElementById('inviteCodeInput').value = '';
    await loadMyGroups();
}

async function searchGroups() {
    const query = document.getElementById('searchGroupInput').value.trim();
    if (!query) return;
    
    const { data: groups } = await db.from('groups').select('*').ilike('name', '%' + query + '%').limit(20);
    
    const section = document.getElementById('searchResultsSection');
    const grid = document.getElementById('searchResultsGrid');
    section.style.display = 'block';
    
    if (!groups || groups.length === 0) {
        grid.innerHTML = '<p class="empty-state">Nenhum grupo encontrado</p>';
        return;
    }
    
    const user = await getCurrentUser();
    grid.innerHTML = '';
    
    for (const g of groups) {
        const { data: mem } = await db.from('group_members').select('*').eq('group_id', g.id).eq('user_id', user.id).maybeSingle();
        const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id);
        
        const card = document.createElement('div');
        card.className = 'card group-card';
        card.innerHTML = `
            <h3>${escapeHtml(g.name)}</h3>
            <p class="text-sm text-muted mb-1">${escapeHtml(g.description || '')}</p>
            <div class="group-meta mb-1"><span><i class="fas fa-users"></i> ${count}/${g.max_members}</span></div>
            ${mem ? '<span class="badge badge-success">Membro</span>' : '<button class="btn btn-primary btn-sm join-btn" data-id="' + g.id + '">Entrar</button>'}
        `;
        grid.appendChild(card);
    }
    
    document.querySelectorAll('.join-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await joinGroupById(btn.dataset.id);
        });
    });
}

async function joinGroupById(id) {
    const user = await getCurrentUser();
    const { data: g } = await db.from('groups').select('*').eq('id', id).single();
    const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', id);
    if (count >= g.max_members) { showToast('Grupo lotado!', 'error'); return; }
    
    await db.from('group_members').insert({ group_id: id, user_id: user.id, role: 'member' });
    showToast('Entrou no grupo: ' + g.name, 'success');
    await loadMyGroups();
}

async function viewGroup(group, userRole) {
    const modal = document.getElementById('viewGroupModal');
    const body = document.getElementById('viewGroupBody');
    document.getElementById('viewGroupName').textContent = group.name;
    modal.classList.add('open');
    body.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';
    
    const user = await getCurrentUser();
    
    const { data: members } = await db.from('group_members')
        .select('id, user_id, role, profiles:user_id(name)')
        .eq('group_id', group.id);
    
    const { data: active } = await db.from('challenges')
        .select('*').eq('group_id', group.id).in('status', ['pending', 'active']).maybeSingle();
    
    const { data: past } = await db.from('challenges')
        .select('*').eq('group_id', group.id).eq('status', 'finished').order('end_date', { ascending: false });
    
    let html = `<div class="mb-2">
        <p><strong>Descrição:</strong> ${escapeHtml(group.description || '-')}</p>
        <p><strong>Código:</strong> <span style="font-family:monospace;font-size:1.2rem;">${group.invite_code}</span></p>
        <p><strong>Membros:</strong> ${members?.length || 0}/${group.max_members}</p>
    </div>`;
    
    html += '<h4 class="mb-1">Membros</h4><div class="members-list mb-2">';
    if (members) {
        for (const m of members) {
            html += `<div class="card flex-between mb-1" style="padding:8px 12px;">
                <div><strong>${escapeHtml(m.profiles?.name || 'Usuário')}</strong> ${m.role === 'admin' ? '<span class="badge badge-info">Admin</span>' : ''}</div>
                ${userRole === 'admin' && m.user_id !== user.id ? '<button class="btn btn-danger btn-sm remove-btn" data-id="' + m.id + '"><i class="fas fa-user-minus"></i></button>' : ''}
            </div>`;
        }
    }
    html += '</div>';
    
    if (active) {
        const { data: participants } = await db.from('challenge_participants')
            .select('*, profiles:user_id(name)').eq('challenge_id', active.id).order('points', { ascending: false });
        const isParticipant = participants?.some(p => p.user_id === user.id);
        
        html += `<h4 class="mb-1">Desafio Atual</h4>
        <div class="challenge-card card mb-2">
            <h3>${escapeHtml(active.name || 'Desafio')}</h3>
            <p>📅 ${formatDate(active.start_date)} → ${formatDate(active.end_date)}</p>
            <p>💰 R$${active.amount_per_person}/pessoa | Total: R$${active.total_prize}</p>
            <p>📝 ${escapeHtml(active.description || '')}</p>
            <span class="badge badge-${active.status === 'active' ? 'success' : 'warning'}">${active.status === 'active' ? 'Em andamento' : 'Aguardando'}</span>
        </div>`;
        
        if (active.status === 'pending' && !isParticipant && getToday() < active.start_date) {
            html += `<button class="btn btn-primary btn-block mb-2 confirm-btn" data-id="${active.id}">Confirmar Participação (R$${active.amount_per_person})</button>`;
        }
        
        if (active.status === 'active' && isParticipant) {
            html += `<a href="activity.html?challenge=${active.id}" class="btn btn-secondary btn-block mb-2"><i class="fas fa-camera"></i> Registrar Atividade</a>`;
        }
        
        if (participants?.length > 0) {
            html += '<h4 class="mb-1">🏆 Ranking</h4><div class="ranking-list mb-2">';
            participants.forEach((p, i) => {
                const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                html += `<div class="ranking-item"><div class="ranking-position ${cls}">${i+1}</div><div class="ranking-info"><div class="ranking-name">${escapeHtml(p.profiles?.name || '')} ${p.user_id === user.id ? '(você)' : ''}</div></div><div><strong>${p.points}</strong> pts</div></div>`;
            });
            html += '</div>';
        }
        
        if (active.status === 'active') {
            const { data: activities } = await db.from('daily_activities')
                .select('*, profiles:user_id(name)').eq('challenge_id', active.id).order('created_at', { ascending: false }).limit(20);
            
            if (activities?.length > 0) {
                html += '<h4 class="mb-1">Atividades Recentes</h4>';
                for (const a of activities) {
                    html += `<div class="card activity-card mb-1">
                        <img src="${a.photo_url}" class="activity-photo" onclick="window.open('${a.photo_url}')" style="cursor:pointer;">
                        <div style="flex:1;"><strong>${escapeHtml(a.profiles?.name || '')}</strong> <span class="text-sm text-muted">📅 ${formatDate(a.activity_date)}</span> ${a.comment ? '<p class="text-sm">'+escapeHtml(a.comment)+'</p>' : ''} ${a.status === 'reported' ? '<span class="badge badge-warning">Denunciado</span>' : ''} ${a.status === 'invalid' ? '<span class="badge badge-danger">Invalidado</span>' : ''}</div>
                        <div>${userRole === 'admin' && a.status === 'reported' ? '<button class="btn btn-success btn-sm approve-btn mb-1" data-id="'+a.id+'">✓</button><button class="btn btn-danger btn-sm reject-btn" data-id="'+a.id+'">✕</button>' : (a.status === 'valid' && a.user_id !== user.id ? '<button class="btn btn-warning btn-sm report-btn" data-id="'+a.id+'">🚩</button>' : '')}</div>
                    </div>`;
                }
            }
        }
    } else if (userRole === 'admin') {
        html += `<h4 class="mb-1">Criar Desafio</h4>
        <form id="createChallengeForm" class="mb-2">
            <div class="input-group"><label>Nome</label><input type="text" id="challengeName" placeholder="Ex: Desafio de Verão"></div>
            <div class="input-group"><label>Data Início *</label><input type="date" id="challengeStartDate" required min="${getToday()}"></div>
            <div class="input-group"><label>Data Fim *</label><input type="date" id="challengeEndDate" required min="${getToday()}"></div>
            <div class="input-group"><label>Valor por Pessoa (R$) *</label><input type="number" id="challengeAmount" required min="0.01" step="0.01"></div>
            <div class="input-group"><label>Descrição</label><textarea id="challengeDescription" rows="2"></textarea></div>
            <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-plus-circle"></i> Criar</button>
        </form>`;
    } else {
        html += '<p class="text-center text-muted">Nenhum desafio ativo</p>';
    }
    
    if (past?.length > 0) {
        html += '<h4 class="mb-1 mt-2">📜 Histórico</h4>';
        for (const c of past) {
            const { data: winners } = await db.from('challenge_winners').select('*, profiles:user_id(name)').eq('challenge_id', c.id);
            html += `<div class="card mb-1" style="border-left:4px solid var(--secondary);"><h4>${escapeHtml(c.name || 'Desafio')}</h4><p class="text-sm">📅 ${formatDate(c.start_date)} → ${formatDate(c.end_date)}</p><p class="text-sm">💰 ${formatCurrency(c.total_prize)}</p>${winners?.length > 0 ? '<p class="text-sm"><strong>🏆</strong> '+winners.map(w => escapeHtml(w.profiles?.name||'')+' ('+formatCurrency(w.prize_share)+')').join(', ')+'</p>' : ''}</div>`;
        }
    }
    
    body.innerHTML = html;
    
    // Event listeners
    document.querySelectorAll('.remove-btn').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Remover membro?')) return;
        await db.from('group_members').delete().eq('id', b.dataset.id);
        showToast('Removido!', 'success');
        viewGroup(group, userRole);
    }));
    
    document.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', async () => {
        await db.from('challenge_participants').insert({ challenge_id: b.dataset.id, user_id: user.id });
        showToast('Confirmado!', 'success');
        viewGroup(group, userRole);
    }));
    
    document.querySelectorAll('.report-btn').forEach(b => b.addEventListener('click', async () => {
        const reason = prompt('Motivo (opcional):');
        if (reason === null) return;
        await db.from('reports').insert({ activity_id: b.dataset.id, reported_by: user.id, reason: reason || '' });
        await db.from('daily_activities').update({ status: 'reported' }).eq('id', b.dataset.id);
        showToast('Denunciado!', 'success');
        viewGroup(group, userRole);
    }));
    
    document.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', async () => {
        await db.from('daily_activities').update({ status: 'valid' }).eq('id', b.dataset.id);
        await db.from('reports').update({ resolved_by: user.id, resolved_at: new Date().toISOString(), resolution: 'approved' }).eq('activity_id', b.dataset.id).is('resolved_by', null);
        showToast('Aprovado!', 'success');
        viewGroup(group, userRole);
    }));
    
    document.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Remover ponto?')) return;
        await db.from('daily_activities').update({ status: 'invalid' }).eq('id', b.dataset.id);
        await db.from('reports').update({ resolved_by: user.id, resolved_at: new Date().toISOString(), resolution: 'removed' }).eq('activity_id', b.dataset.id).is('resolved_by', null);
        showToast('Removido!', 'success');
        viewGroup(group, userRole);
    }));
    
    const challengeForm = document.getElementById('createChallengeForm');
    if (challengeForm) {
        challengeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('challengeName').value.trim() || 'Desafio';
            const start = document.getElementById('challengeStartDate').value;
            const end = document.getElementById('challengeEndDate').value;
            const amount = parseFloat(document.getElementById('challengeAmount').value);
            const desc = document.getElementById('challengeDescription').value.trim();
            
            if (!start || !end || end < start) { showToast('Datas inválidas', 'error'); return; }
            if (!amount || amount <= 0) { showToast('Valor inválido', 'error'); return; }
            
            const { count } = await db.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', group.id);
            
            const { error } = await db.from('challenges').insert({
                group_id: group.id, name, start_date: start, end_date: end,
                amount_per_person: amount, total_prize: amount * (count || 1),
                description: desc, status: 'pending'
            });
            
            if (error) { showToast('Erro: ' + error.message, 'error'); }
            else { showToast('Desafio criado!', 'success'); viewGroup(group, userRole); }
        });
    }
}

// ============================================
// PÁGINA: activity.html
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
    const challengeId = new URLSearchParams(window.location.search).get('challenge');
    
    if (!challengeId) { showToast('Desafio não especificado', 'error'); setTimeout(() => location.href='dashboard.html', 1500); return; }
    
    const { data: challenge } = await db.from('challenges').select('*').eq('id', challengeId).single();
    if (!challenge || challenge.status !== 'active') { showToast('Desafio não ativo', 'error'); setTimeout(() => location.href='dashboard.html', 1500); return; }
    
    const { data: participant } = await db.from('challenge_participants').select('*').eq('challenge_id', challengeId).eq('user_id', user.id).maybeSingle();
    if (!participant) { showToast('Não participante', 'error'); setTimeout(() => location.href='dashboard.html', 1500); return; }
    
    const { data: today } = await db.from('daily_activities').select('*').eq('user_id', user.id).eq('challenge_id', challengeId).eq('activity_date', getToday()).maybeSingle();
    if (today) { showToast('Já registrou hoje!', 'warning'); setTimeout(() => location.href='dashboard.html', 2000); return; }
    
    let photoFile = null;
    let locationData = null;
    
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('photoCanvas');
    const photo = document.getElementById('photoResult');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            await video.play();
        } catch (e) {
            showToast('Erro na câmera', 'error');
        }
    }
    await startCamera();
    
    captureBtn.addEventListener('click', () => {
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
        photo.style.display = 'none';
        retakeBtn.style.display = 'none';
        video.style.display = 'block';
        captureBtn.style.display = 'flex';
        photoFile = null;
        await startCamera();
    });
    
    document.getElementById('getLocationBtn').addEventListener('click', () => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                locationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                document.getElementById('locationStatus').textContent = '✓ Capturada';
                document.getElementById('locationStatus').style.color = 'var(--secondary)';
            },
            () => showToast('Falha na localização', 'warning'),
            { timeout: 10000 }
        );
    });
    
    document.getElementById('skipLocationBtn').addEventListener('click', () => {
        locationData = null;
        document.getElementById('locationStatus').textContent = 'Ignorada';
    });
    
    document.getElementById('activityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!photoFile) { showToast('Tire uma foto!', 'error'); return; }
        
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        
        const fileName = `${user.id}/${challengeId}/${Date.now()}.jpg`;
        const { error: upErr } = await db.storage.from('activity-photos').upload(fileName, photoFile, { contentType: 'image/jpeg' });
        
        if (upErr) { showToast('Erro upload: ' + upErr.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar'; return; }
        
        const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
        
        const { error: actErr } = await db.from('daily_activities').insert({
            user_id: user.id, challenge_id: challengeId, activity_date: getToday(),
            photo_url: urlData.publicUrl, location: locationData,
            comment: document.getElementById('activityComment').value.trim() || null, status: 'valid'
        });
        
        if (actErr) { showToast('Erro: ' + actErr.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar'; }
        else { showToast('Registrado! 🎉', 'success'); setTimeout(() => location.href='dashboard.html', 1500); }
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
    
    document.getElementById('avatarUploadBtn').addEventListener('click', () => document.getElementById('avatarInput').click());
    
    document.getElementById('avatarInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || file.size > 5*1024*1024) { showToast('Imagem muito grande', 'error'); return; }
        
        const fileName = `avatars/${user.id}/${Date.now()}.jpg`;
        await db.storage.from('activity-photos').upload(fileName, file, { contentType: file.type, upsert: true });
        const { data: urlData } = db.storage.from('activity-photos').getPublicUrl(fileName);
        await db.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
        document.getElementById('avatarImg').src = urlData.publicUrl;
        showToast('Avatar atualizado!', 'success');
    });
    
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        const pix = document.getElementById('editPixKey').value.trim();
        if (!name) { showToast('Nome obrigatório', 'error'); return; }
        await db.from('profiles').update({ name, pix_key: pix || null }).eq('id', user.id);
        document.getElementById('profileName').textContent = name;
        showToast('Salvo!', 'success');
    });
    
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
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
    
    // Stats
    const { count: challenges } = await db.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    document.getElementById('totalChallenges').textContent = challenges || 0;
    
    const { data: wins } = await db.from('challenge_winners').select('*, challenges:challenge_id(name, groups:group_id(name))').eq('user_id', user.id).order('declared_at', { ascending: false });
    
    document.getElementById('totalWins').textContent = wins?.length || 0;
    document.getElementById('totalEarnings').textContent = formatCurrency(wins?.reduce((s, w) => s + Number(w.prize_share), 0) || 0);
    
    const list = document.getElementById('winsList');
    if (!wins?.length) { list.innerHTML = '<p class="empty-state"><i class="fas fa-trophy"></i> Nenhuma vitória ainda</p>'; return; }
    
    list.innerHTML = '';
    wins.forEach(w => {
        const card = document.createElement('div');
        card.className = 'card mb-1';
        card.style.borderLeft = '4px solid #FCD34D';
        card.innerHTML = `<div class="flex-between"><div><strong>${escapeHtml(w.challenges?.groups?.name || 'Grupo')}</strong><p class="text-sm">${escapeHtml(w.challenges?.name || 'Desafio')}</p><p class="text-xs text-muted">${formatDate(w.declared_at)}</p></div><div><span class="badge badge-warning" style="font-size:1rem;">${formatCurrency(w.prize_share)}</span></div></div>`;
        list.appendChild(card);
    });
}