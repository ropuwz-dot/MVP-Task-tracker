// State & Data Model
let state = {
    users: [],
    tasks: [],
    taskTypes: [],
    currentUser: null,
    currentView: 'dashboard'
};

// UI Elements Reference
const els = {
    app: document.getElementById('app'),
    viewLogin: document.getElementById('view-login'),
    sidebar: document.getElementById('sidebar'),
    mainContent: document.getElementById('main-content'),
    
    loginForm: document.getElementById('login-form'),
    loginInput: document.getElementById('login-input'),
    passwordInput: document.getElementById('password-input'),
    loginError: document.getElementById('login-error'),
    btnLogout: document.getElementById('btn-logout'),

    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view:not(.login-view)'),
    currentUserName: document.getElementById('current-user-name'),
    currentUserRole: document.getElementById('current-user-role'),
    avatar: document.getElementById('avatar-element'),
    pageTitle: document.getElementById('page-title'),
    pageSubtitle: document.getElementById('page-subtitle'),
    btnCreateTask: document.getElementById('btn-create-task'),
    
    empView: document.getElementById('view-dashboard-employee'),
    empKanban: document.getElementById('emp-kanban'),
    empStatDone: document.getElementById('emp-stat-done'),
    empStatInProgress: document.getElementById('emp-stat-in-progress'),
    empStatCritical: document.getElementById('emp-stat-critical'),
    
    mgrView: document.getElementById('view-dashboard-manager'),
    mgrTeamGrid: document.getElementById('mgr-team-grid'),
    mgrKanban: document.getElementById('mgr-kanban'),
    navTeam: document.getElementById('nav-team'),
    navSettings: document.getElementById('nav-settings'),

    viewSettings: document.getElementById('view-settings'),
    formAddType: document.getElementById('form-add-type'),
    newTypeInput: document.getElementById('new-type-input'),
    typesList: document.getElementById('types-list'),

    formAddUser: document.getElementById('form-add-user'),
    newUserName: document.getElementById('new-user-name'),
    newUserLogin: document.getElementById('new-user-login'),
    newUserPassword: document.getElementById('new-user-password'),
    newUserRole: document.getElementById('new-user-role'),
    userError: document.getElementById('user-error'),
    usersList: document.getElementById('users-list'),

    modal: document.getElementById('task-modal'),
    modalForm: document.getElementById('task-form'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelTask: document.getElementById('btn-cancel-task'),
    
    fId: document.getElementById('task-id'),
    fTitle: document.getElementById('task-title'),
    fStatus: document.getElementById('task-status'),
    fPriority: document.getElementById('task-priority'),
    fType: document.getElementById('task-type'),
    fAssignee: document.getElementById('task-assignee'),
    fDeadline: document.getElementById('task-deadline'),
    fDesc: document.getElementById('task-description'),
    fPlan: document.getElementById('task-plan-time'),
    fFact: document.getElementById('task-fact-time'),
    modalTitle: document.getElementById('modal-title')
};

const priorityDict = {
    'low': { label: 'Низкий', class: 'low' },
    'medium': { label: 'Средний', class: 'medium' },
    'high': { label: 'Высокий', class: 'high' },
    'critical': { label: 'Критичный', class: 'critical' }
};

// --- Initialization ---
async function init() {
    bindEvents();
    const user = await apiGet('/api/me');
    if (user && !user.error) {
        state.currentUser = user;
        showApp();
    } else {
        showLogin();
    }
}

function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);
    els.btnLogout.addEventListener('click', handleLogout);

    els.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view) switchView(view);
        });
    });

    els.btnCreateTask.addEventListener('click', () => openModal());
    els.btnCloseModal.addEventListener('click', closeModal);
    els.btnCancelTask.addEventListener('click', closeModal);
    els.modalForm.addEventListener('submit', handleTaskSave);
    els.formAddType.addEventListener('submit', handleAddType);
    els.formAddUser.addEventListener('submit', handleAddUser);
}

// --- Auth flows ---
async function handleLogin(e) {
    e.preventDefault();
    els.loginError.style.display = 'none';
    const body = { login: els.loginInput.value, password: els.passwordInput.value };
    const res = await apiPost('/api/login', body);
    
    if (res.error) {
        els.loginError.innerText = res.error;
        els.loginError.style.display = 'block';
    } else {
        state.currentUser = res;
        showApp();
    }
}

async function handleLogout() {
    await apiPost('/api/logout', {});
    state.currentUser = null;
    showLogin();
}

function showLogin() {
    els.sidebar.classList.add('hidden');
    els.mainContent.classList.add('hidden');
    els.viewLogin.classList.remove('hidden');
    els.loginInput.value = '';
    els.passwordInput.value = '';
}

async function showApp() {
    els.viewLogin.classList.add('hidden');
    els.sidebar.classList.remove('hidden');
    els.mainContent.classList.remove('hidden');
    
    // Setup Sidebar
    els.currentUserName.innerText = state.currentUser.name.split(' ')[0];
    els.currentUserRole.innerText = state.currentUser.role === 'manager' ? 'Руководитель' : 'Сотрудник';
    els.avatar.innerText = state.currentUser.avatar;

    if (state.currentUser.role === 'manager') {
        els.navTeam.style.display = 'flex';
        els.navSettings.style.display = 'flex';
    } else {
        els.navTeam.style.display = 'none';
        els.navSettings.style.display = 'none';
    }

    await loadData();
    switchView('dashboard', true);
}

// --- Data Fetching ---
async function loadData() {
    const [u, t, tt] = await Promise.all([
        apiGet('/api/users'),
        apiGet('/api/tasks'),
        apiGet('/api/task_types')
    ]);
    state.users = u || [];
    state.tasks = t || [];
    state.taskTypes = tt || [];
}

// --- Navigation ---
function switchView(viewName, forceUpdate = false) {
    if (state.currentView === viewName && !forceUpdate) return;
    state.currentView = viewName;
    
    els.navItems.forEach(i => i.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${viewName}"]`)?.classList.add('active');
    els.views.forEach(v => v.classList.remove('section-active'));

    const user = state.currentUser;

    if (viewName === 'dashboard' || viewName === 'tasks') {
        els.btnCreateTask.style.display = 'inline-flex';
        els.pageTitle.innerText = viewName === 'tasks' ? 'Все Списки' : 'Дашборд';
        els.pageSubtitle.innerText = 'Обзор задач и приоритетов';

        if (user.role === 'manager' && viewName === 'dashboard') {
            els.mgrView.classList.add('section-active');
            renderManagerDashboard();
        } else {
            els.empView.classList.add('section-active');
            renderEmployeeDashboard();
        }
    } else if (viewName === 'team') {
        els.btnCreateTask.style.display = 'none';
        els.pageTitle.innerText = 'Команда';
        els.pageSubtitle.innerText = 'Управление загрузкой и статусом на сегодня';
        els.mgrView.classList.add('section-active');
        renderManagerDashboard();
    } else if (viewName === 'settings') {
        els.btnCreateTask.style.display = 'none';
        els.pageTitle.innerText = 'Настройки';
        els.pageSubtitle.innerText = 'Справочники и глобальные параметры';
        els.viewSettings.classList.add('section-active');
        renderTypesSettings();
        renderUsersSettings();
    }
}

// --- Renders ---
function renderEmployeeDashboard() {
    const myTasks = state.tasks.filter(t => t.assignee_id === state.currentUser.id);
    
    els.empStatDone.innerText = myTasks.filter(t => t.status === 'done').length;
    els.empStatInProgress.innerText = myTasks.filter(t => t.status === 'in-progress').length;
    els.empStatCritical.innerText = myTasks.filter(t => t.priority === 'critical' && t.status !== 'done').length;

    renderKanban(myTasks, els.empKanban);
}

function renderManagerDashboard() {
    els.mgrTeamGrid.innerHTML = '';
    state.users.forEach(u => {
        if (u.role === 'manager') return;
        
        const tasks = state.tasks.filter(t => t.assignee_id === u.id);
        const activeTasks = tasks.filter(t => t.status !== 'done');
        const planTotal = activeTasks.reduce((sum, t) => sum + (parseFloat(t.plan_hours) || 0), 0);
        const isOverloaded = planTotal > 40;
        
        const card = document.createElement('div');
        card.className = 'team-member-card glass-panel';
        card.innerHTML = `
            <div class="avatar">${u.avatar}</div>
            <div class="team-member-info">
                <h4>${u.name.split(' ')[0]}</h4>
                <div class="team-member-stats ${isOverloaded ? 'overloaded' : ''}">
                    Активно: ${activeTasks.length} | Плана: ${planTotal}ч
                </div>
            </div>
        `;
        els.mgrTeamGrid.appendChild(card);
    });

    renderKanban(state.tasks, els.mgrKanban);
}

function renderKanban(tasks, containerEl) {
    const columns = [
        { id: 'open', label: 'Открыта' },
        { id: 'in-progress', label: 'В работе' },
        { id: 'review', label: 'На проверке' },
        { id: 'done', label: 'Готово' }
    ];

    containerEl.innerHTML = '';

    columns.forEach(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        const columnHtml = document.createElement('div');
        columnHtml.className = 'kanban-column';
        columnHtml.innerHTML = `
            <div class="kanban-header">
                <h3>${col.label}</h3>
                <span class="task-count">${colTasks.length}</span>
            </div>
            <div class="kanban-cards"></div>
        `;
        
        const cardsContainer = columnHtml.querySelector('.kanban-cards');
        colTasks.forEach(task => {
            const priority = priorityDict[task.priority];
            const assignee = state.users.find(u => u.id === task.assignee_id);
            const type = state.taskTypes.find(t => t.id === task.type_id);
            
            const card = document.createElement('div');
            card.className = 'task-card';
            card.onclick = () => openModal(task);
            card.innerHTML = `
                <div class="task-labels">
                    <span class="label ${priority.class}">${priority.label}</span>
                    ${type ? `<span class="label type-label">${type.name}</span>` : ''}
                </div>
                <h4>${task.title}</h4>
                <div class="task-meta">
                    <div class="task-assignee">
                        <div class="mini-avatar">${assignee ? assignee.avatar : '?'}</div>
                        <span>План: ${task.plan_hours || 0}ч</span>
                    </div>
                    <span>Факт: ${task.fact_hours || 0}ч</span>
                </div>
            `;
            cardsContainer.appendChild(card);
        });
        containerEl.appendChild(columnHtml);
    });
}

function renderTypesSettings() {
    els.typesList.innerHTML = '';
    state.taskTypes.forEach(t => {
        const item = document.createElement('div');
        item.className = `type-item ${t.is_active ? '' : 'inactive'}`;
        item.innerHTML = `
            <span>${t.name}</span>
            <button class="btn ${t.is_active ? 'btn-danger-outline' : 'btn-secondary'} btn-sm" onclick="toggleType(${t.id}, ${t.is_active})">
                ${t.is_active ? 'Отключить' : 'Включить'}
            </button>
        `;
        els.typesList.appendChild(item);
    });
}

function renderUsersSettings() {
    els.usersList.innerHTML = '';
    state.users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'type-item';
        item.innerHTML = `
            <div>
                <strong>${u.name}</strong> <span style="margin-left: 10px; color: var(--text-muted);">@${u.login}</span>
            </div>
            <span class="label ${u.role === 'manager' ? 'high' : 'medium'}">${u.role === 'manager' ? 'Руководитель' : 'Сотрудник'}</span>
        `;
        els.usersList.appendChild(item);
    });
}

// --- Task & Type Actions ---
async function handleAddType(e) {
    e.preventDefault();
    const name = els.newTypeInput.value.trim();
    if (!name) return;
    
    const res = await apiPost('/api/task_types', { name });
    if (!res.error) {
        els.newTypeInput.value = '';
        await loadData();
        renderTypesSettings();
    }
}

window.toggleType = async (id, isActiveCurrent) => {
    const res = await apiPut(`/api/task_types/${id}/toggle`, { is_active: isActiveCurrent ? 0 : 1 });
    if (!res.error) {
        await loadData();
        renderTypesSettings();
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    els.userError.style.display = 'none';
    
    const body = {
        name: els.newUserName.value.trim(),
        login: els.newUserLogin.value.trim(),
        password: els.newUserPassword.value.trim(),
        role: els.newUserRole.value
    };
    
    const res = await apiPost('/api/users', body);
    if (res.error) {
        els.userError.innerText = res.error;
        els.userError.style.display = 'block';
    } else {
        els.formAddUser.reset();
        els.newUserRole.value = 'employee';
        await loadData();
        renderUsersSettings();
    }
}

function openModal(task = null) {
    els.modal.classList.remove('hidden');
    
    // Fill Dropdowns
    els.fAssignee.innerHTML = '';
    state.users.forEach(u => {
        els.fAssignee.appendChild(new Option(u.name, u.id));
    });

    els.fType.innerHTML = '';
    state.taskTypes.filter(t => t.is_active || (task && task.type_id === t.id)).forEach(t => {
        els.fType.appendChild(new Option(t.name, t.id));
    });

    if (task) {
        els.modalTitle.innerText = 'Редактировать задачу';
        els.fId.value = task.id;
        els.fTitle.value = task.title;
        els.fDesc.value = task.description || '';
        els.fStatus.value = task.status;
        els.fPriority.value = task.priority;
        els.fType.value = task.type_id || '';
        els.fDeadline.value = task.deadline || '';
        els.fPlan.value = task.plan_hours || '';
        els.fFact.value = task.fact_hours || '';
        els.fAssignee.value = task.assignee_id;
    } else {
        els.modalTitle.innerText = 'Новая задача';
        els.modalForm.reset();
        els.fId.value = '';
        els.fAssignee.value = state.currentUser.id;
    }

    if (state.currentUser.role !== 'manager') {
        els.fTitle.disabled = !!task;
        els.fDesc.disabled = !!task;
        els.fPlan.disabled = !!task;
        els.fType.disabled = !!task;
        els.fPriority.disabled = !!task;
        els.fAssignee.disabled = true;
    } else {
        els.fTitle.disabled = false;
        els.fDesc.disabled = false;
        els.fPlan.disabled = false;
        els.fType.disabled = false;
        els.fPriority.disabled = false;
        els.fAssignee.disabled = false;
    }
}

function closeModal() {
    els.modal.classList.add('hidden');
}

async function handleTaskSave(e) {
    e.preventDefault();
    const taskData = {
        title: els.fTitle.value,
        description: els.fDesc.value,
        status: els.fStatus.value,
        priority: els.fPriority.value,
        type_id: parseInt(els.fType.value),
        assignee_id: parseInt(els.fAssignee.value),
        deadline: els.fDeadline.value,
        plan_hours: parseFloat(els.fPlan.value) || 0,
        fact_hours: parseFloat(els.fFact.value) || 0,
    };

    const editId = els.fId.value;
    if (editId) {
        await apiPut(`/api/tasks/${editId}`, taskData);
    } else {
        await apiPost('/api/tasks', taskData);
    }

    await loadData();
    closeModal();
    switchView(state.currentView, true);
}

// --- API Helpers ---
async function apiGet(endpoint) {
    try {
        const r = await fetch(endpoint);
        return r.ok ? await r.json() : { error: await r.text() };
    } catch (e) {
        console.error(e);
        return null;
    }
}
async function apiPost(endpoint, body) {
    try {
        const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const resData = await r.json();
        if (!r.ok) return { error: resData.error || 'Server error' };
        return resData;
    } catch (e) { return { error: 'Network error' }; }
}
async function apiPut(endpoint, body) {
    try {
        const r = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const resData = await r.json();
        if (!r.ok) return { error: resData.error || 'Server error' };
        return resData;
    } catch (e) { return { error: 'Network error' }; }
}

init();
