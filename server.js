const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files (index.html, app.js, styles.css)

app.use(session({
    secret: 'secret-key-team-sync-mvp',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Auth check middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

const requireManager = (req, res, next) => {
    if (req.session && req.session.role === 'manager') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden. Manager only.' });
    }
};

// Database Setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database.');
});

db.serialize(async () => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        login TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS task_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        type_id INTEGER,
        assignee_id INTEGER,
        deadline TEXT,
        plan_hours REAL DEFAULT 0,
        fact_hours REAL DEFAULT 0,
        FOREIGN KEY(type_id) REFERENCES task_types(id),
        FOREIGN KEY(assignee_id) REFERENCES users(id)
    )`);

    // Add default users and types if empty
    db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
        if (row.count === 0) {
            const hash1 = await bcrypt.hash('admin', 10);
            const hash2 = await bcrypt.hash('1234', 10);
            db.run(`INSERT INTO users (name, login, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?)`, ['Иван (Руководитель)', 'admin', hash1, 'manager', 'Ив']);
            db.run(`INSERT INTO users (name, login, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?)`, ['Петр (Сотрудник)', 'petr', hash2, 'employee', 'Пе']);
            
            db.run(`INSERT INTO task_types (name) VALUES ('Разработка')`);
            db.run(`INSERT INTO task_types (name) VALUES ('Инцидент')`);
            db.run(`INSERT INTO task_types (name) VALUES ('Доработка')`);
            
            console.log('Default Seed Data Inserted. Logins: admin/admin, petr/1234');
        }
    });
});

// --- API ROUTES --- //

// Auth
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    db.get(`SELECT * FROM users WHERE login = ?`, [login], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
            req.session.userId = user.id;
            req.session.role = user.role;
            res.json({ id: user.id, name: user.name, role: user.role, avatar: user.avatar });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
    db.get(`SELECT id, name, role, avatar FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Unauthorized' });
        res.json(user);
    });
});

// Users
app.get('/api/users', requireAuth, (req, res) => {
    db.all(`SELECT id, name, role, avatar FROM users`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', requireAuth, requireManager, async (req, res) => {
    const { name, login, password, role } = req.body;
    if (!name || !login || !password || !role) return res.status(400).json({ error: 'Все поля обязательны' });
    
    try {
        const hash = await bcrypt.hash(password, 10);
        const avatar = name.substring(0, 2).trim() || '?';
        
        db.run(`INSERT INTO users (name, login, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?)`, 
            [name, login, hash, role, avatar], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ error: 'Этот логин уже занят' });
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, name, login, role, avatar });
        });
    } catch(err) {
         res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Task Types
app.get('/api/task_types', requireAuth, (req, res) => {
    db.all(`SELECT * FROM task_types`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/task_types', requireAuth, requireManager, (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO task_types (name) VALUES (?)`, [name], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, name, is_active: 1 });
    });
});

app.put('/api/task_types/:id/toggle', requireAuth, requireManager, (req, res) => {
    const { is_active } = req.body;
    db.run(`UPDATE task_types SET is_active = ? WHERE id = ?`, [is_active, req.params.id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true });
    });
});

// Tasks
app.get('/api/tasks', requireAuth, (req, res) => {
    db.all(`SELECT * FROM tasks`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/tasks', requireAuth, (req, res) => {
    const { title, description, status, priority, type_id, assignee_id, deadline, plan_hours, fact_hours } = req.body;
    
    // Employee constraints can be enforced on frontend, but safe to trust req body for MVP
    db.run(`INSERT INTO tasks (title, description, status, priority, type_id, assignee_id, deadline, plan_hours, fact_hours) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [title, description, status, priority, type_id, assignee_id, deadline, plan_hours || 0, fact_hours || 0], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const { title, description, status, priority, type_id, assignee_id, deadline, plan_hours, fact_hours } = req.body;
    
    // For MVP, simple blind update. Real world needs role checking here too.
    db.run(`UPDATE tasks SET 
        title=?, description=?, status=?, priority=?, type_id=?, assignee_id=?, deadline=?, plan_hours=?, fact_hours=? 
        WHERE id=?`,
    [title, description, status, priority, type_id, assignee_id, deadline, plan_hours || 0, fact_hours || 0, req.params.id], 
    function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true });
    });
});

// Fallback to index.html for SPA reload
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening
app.listen(PORT, () => {
    console.log(`TeamSync API Server running on port ${PORT}`);
});
