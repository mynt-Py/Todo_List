from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import os


load_dotenv()
from datetime import datetime

from supabase import create_client

app = FastAPI(title="Todo List")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client (requires SUPABASE_URL and SUPABASE_KEY environment variables)
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError('Please set SUPABASE_URL and SUPABASE_KEY environment variables')

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

class UserAuth(BaseModel):
    username: str
    password: str


class TodoCreate(BaseModel):
    user_id: int
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "General"
    due_date: Optional[str] = None


@app.post("/register")
def register_user(user: UserAuth):
    res = sb.table('users').insert({
        'username': user.username,
        'password': user.password
    }).execute()
    created = res.data[0]
    return {"message": "User registered successfully", "user_id": created.get('id'), "username": created.get('username')}


@app.post("/login")
def login_user(user: UserAuth):
    res = sb.table('users').select('*').eq('username', user.username).eq('password', user.password).execute()
   
    rows = res.data
    if rows and len(rows) > 0:
        db_user = rows[0]
        return {"message": "Login successful", "user_id": db_user.get('id'), "username": db_user.get('username')}
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/tasks")
def create_task(todo: TodoCreate):
    payload = {
        'user_id': todo.user_id,
        'title': todo.title,
        'description': todo.description,
        'category': todo.category,
        'due_date': todo.due_date,
        'status': 'To Do'
    }
    res = sb.table('tasks').insert(payload).execute()
    created = res.data[0]
    return {"message": "Task created successfully", "task_id": created.get('id')}


@app.get("/tasks/{user_id}")
def get_tasks(user_id: int, status: Optional[str] = None, search: Optional[str] = None):
    query = sb.table('tasks').select('*').eq('user_id', user_id)
    if status:
        query = query.eq('status', status)
    if search:
        query = query.ilike('title', f'%{search}%')
    res = query.execute()
    return res.data


@app.put("/tasks/{task_id}/status")
def update_status(task_id: int, status: str):
    res = sb.table('tasks').update({'status': status}).eq('id', task_id).execute()
    return {"message": "Updated successfully"}


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    res = sb.table('tasks').delete().eq('id', task_id).execute()
    return {"message": "Deleted successfully"}


@app.get("/dashboard/{user_id}")
def get_dashboard(user_id: int):
    res = sb.table('tasks').select('status,due_date').eq('user_id', user_id).execute()
    todos = res.data

    stats = {"total_tasks": len(todos), "todo_tasks": 0, "done_tasks": 0, "overdue_tasks": 0}
    today = datetime.now().date().isoformat()

    for task in todos:
        if task.get('status') == "To Do":
            stats["todo_tasks"] += 1
        elif task.get('status') == "Done":
            stats["done_tasks"] += 1

        due = task.get('due_date')
        if due and due < today and task.get('status') != "Done":
            stats["overdue_tasks"] += 1

    return stats