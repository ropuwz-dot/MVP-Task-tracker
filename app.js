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
    mgrTimeSummaryTbody: document.getElementById('mgr-time-summary-tbody'),
    mgrEmpFilter: document.getElementById('mgr-emp-filter'),
    viewTeam: document.getElementById('view-team'),
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
    modalBreadcrumbs: document.getElementById('modal-breadcrumbs'),
    modalForm: document.getElementById('task-form'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelTask: document.getElementById('btn-cancel-task'),
    
    fId: document.getElementById('task-id'),
    fTitle: document.getElementById('task-title'),
    fStatus: document.getElementById('task-status'),
    fPriority: document.getElementById('task-priority'),
    fType: document.getElementById('task-type'),
    fAssignee: document.getElementById('task-assignee'),
    fStartDate: document.getElementById('task-start-date'),
    fDeadline: document.getElementById('task-deadline'),
    fDesc: document.getElementById('task-description'),
    fPlan: document.getElementById('task-plan-time'),
    fFact: document.getElementById('task-fact-time'),
    modalTitle: document.getElementById('modal-title'),
    
    btnModalBack: document.getElementById('btn-modal-back'),
    subtasksSection: document.getElementById('subtasks-section'),
    subtasksList: document.getElementById('subtasks-list'),
    btnAddSubtaskFull: document.getElementById('btn-add-subtask-full'),
    fParentSelect: document.getElementById('task-parent-select')
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
    if (els.btnAddSubtaskFull) {
        els.btnAddSubtaskFull.addEventListener('click', () => {
             const parentId = els.fId.value;
             if (parentId) openModal(null, parseInt(parentId));
        });
    }
    if (els.mgrEmpFilter) {
        els.mgrEmpFilter.addEventListener('change', renderManagerKanbanOnly);
    }
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
        els.viewTeam.classList.add('section-active');
        renderTeamView();
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
    els.mgrTimeSummaryTbody.innerHTML = '';
    
    // Save current filter value to restore it
    const currentFilter = els.mgrEmpFilter.value;
    els.mgrEmpFilter.innerHTML = '<option value="all">Все сотрудники</option>';

    state.users.forEach(u => {
        if (u.role === 'manager') return;
        
        // Add to filter
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.innerText = u.name;
        els.mgrEmpFilter.appendChild(opt);

        // Compute summary
        const tasks = state.tasks.filter(t => t.assignee_id === u.id);
        const activeTasks = tasks.filter(t => t.status !== 'done');
        const planTotal = tasks.reduce((sum, t) => sum + (parseFloat(t.plan_hours) || 0), 0);
        const factTotal = tasks.reduce((sum, t) => sum + (parseFloat(t.fact_hours) || 0), 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${u.name}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">${activeTasks.length}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">${planTotal}</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: center;">${factTotal}</td>
        `;
        els.mgrTimeSummaryTbody.appendChild(tr);
    });
    
    if (currentFilter && Array.from(els.mgrEmpFilter.options).some(o => o.value === currentFilter)) {
        els.mgrEmpFilter.value = currentFilter;
    }

    renderManagerKanbanOnly();
}

function renderManagerKanbanOnly() {
    const filterId = els.mgrEmpFilter.value;
    let filteredTasks = state.tasks;
    if (filterId !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.assignee_id === parseInt(filterId));
    }
    renderKanban(filteredTasks, els.mgrKanban);
}

function handleDragStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

async function handleDrop(e, newStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    
    const task = state.tasks.find(t => t.id == taskId);
    if (!task || task.status === newStatus) return;
    
    task.status = newStatus;
    switchView(state.currentView, true);
    
    const taskData = {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        type_id: task.type_id,
        assignee_id: task.assignee_id,
        start_date: task.start_date,
        deadline: task.deadline,
        plan_hours: task.plan_hours,
        fact_hours: task.fact_hours,
    };
    
    const res = await apiPut(`/api/tasks/${task.id}`, taskData);
    if (res.error) {
        await loadData();
        switchView(state.currentView, true);
    }
}

function renderTeamView() {
    els.mgrTeamGrid.innerHTML = '';
    state.users.forEach(u => {
        if (u.role === 'manager') return;
        
        const tasks = state.tasks.filter(t => t.assignee_id === u.id);
        const activeTasks = tasks.filter(t => t.status !== 'done');
        const planTotal = activeTasks.reduce((sum, t) => sum + (parseFloat(t.plan_hours) || 0), 0);
        const isOverloaded = planTotal > 40;
        
        const card = document.createElement('div');
        card.className = 'team-member-card glass-panel';
        card.style.cursor = 'pointer';
        card.onclick = () => {
            switchView('dashboard');
            els.mgrEmpFilter.value = u.id;
            renderManagerKanbanOnly();
        };
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
        cardsContainer.ondragover = handleDragOver;
        cardsContainer.ondrop = (e) => handleDrop(e, col.id);

        colTasks.forEach(task => {
            const priority = priorityDict[task.priority];
            const assignee = state.users.find(u => u.id === task.assignee_id);
            const type = state.taskTypes.find(t => t.id === task.type_id);
            
            const subtasks = state.tasks.filter(st => st.parent_task_id === task.id);
            const subtasksCompleted = subtasks.filter(st => st.status === 'done').length;
            const subtasksBadge = subtasks.length > 0 
                ? `<span class="label" style="background: rgba(255,255,255,0.1);"><i class="ri-node-tree"></i> ${subtasksCompleted}/${subtasks.length}</span>` 
                : '';
                
            let parentContextHtml = '';
            if (task.parent_task_id) {
                const path = getTaskPath(task.id);
                if (path.length > 1) {
                    const rootTask = path[0];
                    if (rootTask.id !== task.id) {
                        const pathStr = path.slice(0, path.length - 1).map(p => p.title).join(' / ');
                        parentContextHtml = `<div title="Вложено в: ${pathStr}" onclick="event.stopPropagation(); window.openModalById(${rootTask.id})" style="font-size: 0.8rem; color: var(--primary-color); margin-top: 0.2rem; margin-bottom: 0.4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1"><i class="ri-corner-down-right-line"></i> Корень: ${rootTask.title}</div>`;
                    }
                }
            }

            const card = document.createElement('div');
            card.className = 'task-card';
            card.draggable = true;
            card.ondragstart = (e) => handleDragStart(e, task.id);
            card.onclick = () => openModal(task);
            card.innerHTML = `
                <div class="task-labels">
                    <span class="label ${priority.class}">${priority.label}</span>
                    ${type ? `<span class="label type-label">${type.name}</span>` : ''}
                    ${subtasksBadge}
                </div>
                <h4 style="margin-bottom: 0;">${task.title}</h4>
                ${parentContextHtml}
                <div class="task-meta" style="margin-top: 0.5rem;">
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

function openModal(task = null, forceParentId = null) {
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
    
    if (els.fParentSelect) {
        els.fParentSelect.innerHTML = '<option value="">Нет (Корневая задача)</option>';
        state.tasks.forEach(t => {
            if (!task || t.id !== task.id) {
                els.fParentSelect.appendChild(new Option(t.title, t.id));
            }
        });
    }

    if (task) {
        els.modalTitle.innerText = task.parent_task_id ? 'Редактировать подзадачу' : 'Редактировать задачу';
        els.fId.value = task.id;
        els.fTitle.value = task.title;
        els.fDesc.value = task.description || '';
        els.fStatus.value = task.status;
        if (els.fParentSelect) els.fParentSelect.value = task.parent_task_id || '';
        
        if (task.parent_task_id) {
            els.btnModalBack.classList.add('hidden'); // replaced by breadcrumbs
        } else {
            els.btnModalBack.classList.add('hidden');
        }
        
        renderBreadcrumbs(task.id, false);
        
        if(els.subtasksSection) els.subtasksSection.classList.remove('hidden');
        renderSubtasks(task.id);
        
        els.fPriority.value = task.priority;
        els.fType.value = task.type_id || '';
        els.fStartDate.value = task.start_date || '';
        els.fDeadline.value = task.deadline || '';
        els.fPlan.value = task.plan_hours || '';
        els.fFact.value = task.fact_hours || '';
        els.fAssignee.value = task.assignee_id;
    } else {
        els.modalTitle.innerText = forceParentId ? 'Новая подзадача' : 'Новая задача';
        els.modalForm.reset();
        els.fId.value = '';
        els.fAssignee.value = state.currentUser.id;
        els.fStartDate.value = new Date().toISOString().split('T')[0];
        if (els.fParentSelect) els.fParentSelect.value = forceParentId || '';
        
        if(els.btnModalBack) els.btnModalBack.classList.add('hidden'); // replaced by breadcrumbs
        
        if (forceParentId) {
            renderBreadcrumbs(forceParentId, true);
        } else {
            renderBreadcrumbs(null, false);
        }
        
        if(els.subtasksSection) els.subtasksSection.classList.add('hidden');
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
    const editId = els.fId.value;
    
    // Attempt parse parent ID
    const parentVal = els.fParentSelect ? els.fParentSelect.value : '';
    const newParentId = parentVal ? parseInt(parentVal) : null;

    const taskData = {
        title: els.fTitle.value,
        description: els.fDesc.value,
        status: els.fStatus.value,
        priority: els.fPriority.value,
        type_id: parseInt(els.fType.value),
        assignee_id: parseInt(els.fAssignee.value),
        start_date: els.fStartDate.value,
        deadline: els.fDeadline.value,
        plan_hours: parseFloat(els.fPlan.value) || 0,
        fact_hours: parseFloat(els.fFact.value) || 0,
        parent_task_id: newParentId
    };

    let res;
    if (editId) {
        res = await apiPut(`/api/tasks/${editId}`, taskData);
    } else {
        res = await apiPost('/api/tasks', taskData);
    }
    
    if (res && res.error) {
        alert('Ошибка сохранения: ' + res.error);
        return;
    }

    await loadData();
    closeModal();
    switchView(state.currentView, true);
}

function renderSubtasks(parentId) {
    const subtasks = state.tasks.filter(t => t.parent_task_id === parentId);
    if (!els.subtasksList) return;
    els.subtasksList.innerHTML = '';
    
    if (subtasks.length === 0) {
        els.subtasksList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Нет подзадач</span>';
        return;
    }
    
    subtasks.forEach(st => {
        const el = document.createElement('div');
        el.className = 'glass-panel';
        el.style.padding = '0.75rem';
        el.style.cursor = 'pointer';
        el.style.transition = 'all 0.2s';
        
        el.onclick = () => openModal(st);
        el.onmouseover = () => el.style.background = 'rgba(255,255,255,0.08)';
        el.onmouseout = () => el.style.background = '';
        
        const priority = priorityDict[st.priority];
        const statusMap = {
            'open': 'Открыта',
            'in-progress': 'В работе',
            'review': 'На проверке',
            'done': 'Готово'
        };
        const statusLabel = statusMap[st.status] || st.status;
        const assignee = state.users.find(u => u.id === st.assignee_id);
        
        el.innerHTML = `
            <div style="font-size: 0.95rem; font-weight: 500; ${st.status === 'done' ? 'text-decoration: line-through; opacity: 0.7;' : ''} margin-bottom: 0.5rem;">${st.title}</div>
            <div class="task-labels" style="display: flex; gap: 0.5rem; font-size: 0.75rem; align-items: center;">
                <span class="label ${priority.class}">${priority.label}</span>
                <span class="label" style="background: rgba(255,255,255,0.1); color: #fff;">${statusLabel}</span>
                <div style="margin-left: auto; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem;">
                   <div class="mini-avatar" style="width:18px;height:18px;font-size:0.6rem;">${assignee ? assignee.avatar : '?'}</div>
                   <span>${st.plan_hours || 0}ч</span>
                </div>
            </div>
        `;
        els.subtasksList.appendChild(el);
    });
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

function getTaskPath(taskId) {
    const path = [];
    let current = state.tasks.find(t => t.id === taskId);
    const visited = new Set();
    while (current && !visited.has(current.id)) {
        visited.add(current.id);
        path.unshift(current);
        if (current.parent_task_id) {
            current = state.tasks.find(t => t.id === current.parent_task_id);
        } else {
            current = null;
        }
    }
    return path;
}

window.openModalById = function(id) {
    const t = state.tasks.find(x => x.id === id);
    if (t) openModal(t);
};

function renderBreadcrumbs(taskId, isNewSubtask = false) {
    if (!els.modalBreadcrumbs) return;
    
    let path = [];
    if (taskId) {
        path = getTaskPath(taskId);
    }
    
    if (path.length > (isNewSubtask ? 0 : 1)) {
        els.modalBreadcrumbs.classList.remove('hidden');
        els.modalBreadcrumbs.style.display = 'flex';
        els.modalBreadcrumbs.innerHTML = '';
        
        let displayPath = [...path].reverse();
        if (isNewSubtask) {
            displayPath.unshift({ title: 'Новая подзадача', isFake: true });
        }
        
        displayPath.forEach((t, index) => {
            const isCurrent = (index === 0);
            
            const span = document.createElement('span');
            if (isCurrent) {
                span.style.color = 'var(--text-base)';
                span.style.whiteSpace = 'nowrap';
                span.style.fontWeight = '600';
                span.style.fontSize = '0.95rem';
                span.innerText = t.title;
            } else {
                const a = document.createElement('a');
                a.href = '#';
                a.style.color = 'var(--primary-color)';
                a.style.textDecoration = 'none';
                a.style.whiteSpace = 'nowrap';
                a.innerText = t.title;
                a.onclick = (e) => {
                    e.preventDefault();
                    if (!t.isFake) openModal(t);
                };
                span.appendChild(a);
            }
            els.modalBreadcrumbs.appendChild(span);
            
            if (index < displayPath.length - 1) {
                const sep = document.createElement('span');
                sep.style.color = 'var(--text-muted)';
                sep.innerHTML = '&nbsp;<i class="ri-arrow-left-s-line"></i>&nbsp;';
                els.modalBreadcrumbs.appendChild(sep);
            }
        });
    } else {
        els.modalBreadcrumbs.classList.add('hidden');
        els.modalBreadcrumbs.style.display = 'none';
        els.modalBreadcrumbs.innerHTML = '';
    }
}

init();
