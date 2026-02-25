const API_URL = 'http://localhost:8000/api';
let currentUserId = localStorage.getItem('user_id');
let currentUsername = localStorage.getItem('username');
let currentTodos = [];

if (currentUserId) {
    showApp();
}

async function handleAuth(action) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if(!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password})
        });
        const data = await response.json();

        const authMsgEl = document.getElementById('auth-msg');
        if (response.ok) {
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('username', data.username);

            currentUserId = data.user_id;
            currentUsername = data.username;

            authMsgEl.innerText = '';
            authMsgEl.classList.add('hidden');
            showApp();
        } else {
            authMsgEl.innerText = data.detail || 'Authentication failed';
            authMsgEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error:', error);
        const authMsgEl = document.getElementById('auth-msg');
        authMsgEl.innerText = error.message || 'Network error';
        authMsgEl.classList.remove('hidden');
    }
}

function showApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    document.getElementById('display-username').innerText = currentUsername;
    loadData();
}

function logout() {
    localStorage.clear();
    location.reload();
}

async function loadData() {
    if (!currentUserId) return;

    const dashboardRes = await fetch(`${API_URL}/dashboard/${currentUserId}`);
    const dashboardData = await dashboardRes.json();
    document.getElementById('dash-total').innerText = dashboardData.total_tasks;
    document.getElementById('dash-todo').innerText = dashboardData.todo_tasks;
    document.getElementById('dash-done').innerText = dashboardData.done_tasks;
    document.getElementById('dash-overdue').innerText = dashboardData.overdue_tasks;

    const search = document.getElementById('filter-search').value;
    const status = document.getElementById('filter-status').value;

    const params = new URLSearchParams();
    if (search && search.trim()) params.append('search', search.trim());
    if (status && status.trim()) params.append('status', status.trim());

    const url = `${API_URL}/tasks/${currentUserId}` + (params.toString() ? `?${params.toString()}` : '');
    console.log('Fetching', url);
    const tasksRes = await fetch(url);
    const tasksData = await tasksRes.json();
    currentTodos = tasksData;

    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    tasksData.forEach(task => {
        let statusBadge = task.status === 'Done' ? 'badge-success' : 'badge-danger';
        taskList.innerHTML += `
            <div class="border border p-4 rounded-lg flex justify-between items-start hover:shadow-md transition">
                <div>
                    <h3 class="font-bold text-lg">${task.title}</h3>
                    <p class="text-sm text-muted">${task.description || ''}</p>
                    <div class="mt-2 text-xs flex gap-2 flex-wrap">
                        <span class="badge-info"> Type: ${task.category}</span>
                        ${task.due_date ? `<span class="badge-danger"> Due ${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                </div>
            </div>

            <div class="flex flex-col gap-2 items-end">
                <span class="${statusBadge} text-sm font-bold">${task.status}</span>
                <div class="space-x-1 mt-2">
                    <select onchange="updateStatus(${task.id}, this.value)" class="text-sm border rounded p-1">
                        <option value="" disabled selected>Change Status</option>
                        <option value="To Do">To Do</option>
                        <option value="Done">Done</option>
                    </select>
                    <button onclick=\"deleteTask(${task.id})\" class=\"text-danger px-2 py-1 rounded text-sm p-1 hover:underline\">Delete</button>
                </div>
            </div>
        </div>
    `;                     
    });
}

document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newTask = {
        user_id: currentUserId,
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        due_date: document.getElementById('due_date').value || null
    };

    await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
    });

    document.getElementById('taskForm').reset();
    loadData();
});

async function updateStatus(taskId, newStatus) {
    await fetch(`${API_URL}/tasks/${taskId}/status?status=${newStatus}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    });
    loadData();
}

async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        await fetch(`${API_URL}/tasks/${taskId}/`, {
            method: 'DELETE'
        });
        loadData();
    }
}


async function exportTodosJSON() {
    const dataStr = JSON.stringify(currentTodos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importTodosJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        try {
            const todos = JSON.parse(text);
            if (!Array.isArray(todos)) {
                alert('Invalid JSON format. Expected an array of todos.');
                return;
            }

            for (const todo of todos) {
                if (!todo.title) {
                    alert('Each todo must have a title');
                    return;
                }
                
                const newTodo = {
                    user_id: currentUserId,
                    title: todo.title,
                    description: todo.description || '',
                    category: todo.category || 'General',
                    due_date: todo.due_date || null,
                    status: todo.status || 'To Do'
                };
                
                await fetch(`${API_URL}/todos/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newTodo)
                });
            }
            
            alert(`Successfully imported ${todos.length} todos!`);
            loadData();
        } catch (error) {
            alert('Error parsing JSON: ' + error.message);
        }
    };
    input.click();
}

function showTodosJSON() {
    const jsonStr = JSON.stringify(currentTodos, null, 2);
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 800px;
        max-height: 600px;
        overflow: auto;
        width: 90%;
    `;
    
    const closeModal = () => modal.remove();
    
    content.innerHTML = `
        <h2 style="margin-top: 0;">Todos JSON</h2>
        <pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto;" id="json-display">${escapeHtml(jsonStr)}</pre>
        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;" id="modal-buttons"></div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.style.cssText = 'background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('Copied to clipboard!');
        });
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'background: #e5e7eb; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;';
    closeBtn.onclick = closeModal;
    
    const buttonsDiv = document.getElementById('modal-buttons');
    buttonsDiv.appendChild(copyBtn);
    buttonsDiv.appendChild(closeBtn);
    
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


document.getElementById('filter-status').addEventListener('change', () => loadData());
document.getElementById('filter-search').addEventListener('input', () => loadData());