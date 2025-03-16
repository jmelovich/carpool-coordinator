import sqlite3
from pathlib import Path
from app import bcrypt
from typing import Optional, Dict, List
from datetime import datetime

# Database initialization
DB_PATH = Path(__file__).parent / "carpool.db"

def get_db_connection():
    """Create a database connection and return it"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with required tables"""
    conn = get_db_connection()
    try:
        # Create users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        # Create queue table for before the ride
        # the preferences/occupation of each person are temporary
        conn.execute('''
            CREATE TABLE IF NOT EXISTS queue (
                id_queue INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                occupation_preference TEXT NOT NULL,
                personality_preference TEXT NOT NULL,
                occupation_current TEXT NOT NULL,
                personality_current TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        # Create carpool table for while a ride is ongoing
        # the preferences/occupation of each person are temporary
        conn.execute('''
            CREATE TABLE IF NOT EXISTS carpool (
                id_carpool INTEGER PRIMARY KEY AUTOINCREMENT,
                username_passenger TEXT UNIQUE NOT NULL,
                email_passenger TEXT UNIQUE NOT NULL,
                occupation_preference_passenger TEXT NOT NULL,
                personality_preference_passenger TEXT NOT NULL,
                username_driver TEXT UNIQUE NOT NULL,
                email_driver TEXT UNIQUE NOT NULL,
                occupation_preference_driver TEXT NOT NULL,
                personality_preference_driver TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
    finally:
        conn.close()

def create_user(username: str, email: str, password: str) -> Optional[int]:
    """Create a new user with the given credentials
    
    Returns:
        Optional[int]: The ID of the created user, or None if creation failed
    """
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username: str) -> Optional[Dict]:
    """Retrieve a user by their username, including password hash"""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            'SELECT id, username, email, password_hash FROM users WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        conn.close()

def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Retrieve a user by their ID"""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            'SELECT id, username, email, created_at FROM users WHERE id = ?', 
            (user_id,)
        )
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        conn.close()

def get_user_by_email(email: str) -> Optional[Dict]:
    """Retrieve a user by their email"""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            'SELECT id, username, email FROM users WHERE email = ?',
            (email,)
        )
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        conn.close()

# Initialize the database when the module is imported
init_db() 