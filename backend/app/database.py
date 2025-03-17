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
                is_passenger BOOLEAN NOT NULL,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
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
                username_driver TEXT UNIQUE NOT NULL,
                email_driver TEXT UNIQUE NOT NULL,
                driver_car_make TEXT NOT NULL,
                driver_car_license_plate TEXT NOT NULL,
                driver_car_color TEXT NOT NULL,
                driver_origin TEXT NOT NULL,
                passenger_origin TEXT NOT NULL,
                driver_destination TEXT NOT NULL,
                passenger_destination TEXT NOT NULL,
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

def queue_passenger_or_driver(username: str, occupation_preference: str, personality_preference: str, occupation_current: str, personality_current: str, is_passenger: bool, origin: str, destination: str) -> Optional[int]:
    """Queue a user as a passenger to a carpool

    Returns:
        Optional[int]: The ID of the queued user, or None if creation failed
    """
    conn = get_db_connection()
    try: 
        user_dict = get_user_by_username(username)
        user_dict_email = user_dict.get("email")
        cursor = conn.execute(
            'INSERT INTO queue (username, email, '
            'occupation_preference, personality_preference, occupation_current, personality_current, '
            'is_passenger, origin, destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            (username, user_dict_email, occupation_preference, personality_preference, occupation_current, personality_current, is_passenger, origin, destination)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def create_carpool(username_passenger: str, username_driver: str, driver_car_make: str, driver_car_license_plate: str, driver_car_color: str, driver_origin: str, passenger_origin: str,driver_destination: str, passenger_destination: str) -> Optional[int]:
    """Create a carpool with a driver and a passenger
    
    Returns:
        Optional[int]: the ID of the created carpool ride, or None if creation failed"""
    conn = get_db_connection()
    try:
        passenger_dict = get_user_by_username(username_passenger)
        passenger_dict_email = passenger_dict.get("email")
        driver_dict = get_user_by_username(username_driver)
        driver_dict_email = driver_dict.get("email")
        if not passenger_dict or not driver_dict:
            return None
        cursor = conn.execute(
            'INSERT INTO carpool (username_passenger, email_passenger, username_driver, email_driver, '
            'driver_car_make, driver_car_license_plate, driver_car_color, '
            'driver_origin, passenger_origin, driver_destination, passenger_destination) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            (username_passenger, passenger_dict_email, username_driver, driver_dict_email, driver_car_make, driver_car_license_plate, driver_car_color, driver_origin, passenger_origin, driver_destination, passenger_destination)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def unqueue_passenger_or_driver_by_user(username: str) -> str:
    """Unqueue a user by username
    
    Returns: 
        "Success" if username was found, and "Unsuccessful" if username wasn't found
    """
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            'SELECT username, FROM queue WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        if user:
            cursor = conn.execute(
                'DELETE FROM queue WHERE username = ?', 
                (username)
            )
            conn.commit()
            return "Success"
        else:
            return "Unsuccessful"
    finally:
        conn.close() 

def delete_carpool_ride(username_passenger: str, username_driver: str) -> str:
    """Delete a carpool ride

    Returns: 
        "Success" if both usernames were found, and "Unsuccessful" if usernames weren't found
    """

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            'SELECT username_passenger, username_driver, FROM carpool WHERE username_passenger = ? AND username_driver = ?',
            (username_passenger, username_driver)
        )
        ride_row = cursor.fetchone()
        if ride_row:
            cursor = conn.execute(
                'DELETE FROM carpool WHERE username_passenger = ? AND username_driver = ?', 
                (username_passenger, username_driver)
            )
            return "Success"
        else:
            return "Unsuccessful"
    finally:
        conn.close() 

# Initialize the database when the module is imported
init_db() 