# ---- db.py ----

import sqlite3
from pathlib import Path
# Assuming Flask-Bcrypt is used, bcrypt object would be initialized in app factory
# Example: from flask import current_app # then use current_app.bcrypt
# For standalone testing, you might need a placeholder:
try:
    from flask_bcrypt import generate_password_hash # Example placeholder
except ImportError:
    print("Warning: Flask-Bcrypt not installed. Hashing will fail.")
    # Define a dummy hash function if needed for testing without bcrypt
    def generate_password_hash(pwd): return f"hashed_{pwd}".encode('utf-8')

from flask import current_app, g # Import Flask g and current_app
from typing import Optional, Dict, List, Tuple, Any
from datetime import datetime
import json
import os
import re
import time
import random
import click # For Flask CLI commands
from flask.cli import with_appcontext

# --- Configuration ---
# Best practice: Define DATABASE path in Flask app config.
# Fallback using Path(__file__) for locating the DB relative to this file.
DATABASE = Path(__file__).parent / "carpool.db"
QUIZZES_JSON_PATH = Path(__file__).parent / "quizzes.json"
DB_TIMEOUT = 20.0  # Timeout in seconds for lock waits
MAX_RETRIES = 5   # Maximum number of retries for lock errors
RETRY_BACKOFF = 0.1 # Initial backoff time in seconds

# --- Flask Database Connection Management ---

def get_db():
    """
    Gets or creates a database connection for the current application context.
    Stores the connection in Flask's 'g' object.
    Enables WAL mode for better concurrency.
    """
    if 'db' not in g:
        try:
            db_path_str = current_app.config.get('DATABASE', str(DATABASE))
            # print(f"Creating new DB connection for request to {db_path_str}") # Optional debug
            g.db = sqlite3.connect(
                db_path_str,
                timeout=DB_TIMEOUT,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            g.db.row_factory = sqlite3.Row
            # Enable WAL mode for better concurrency
            g.db.execute("PRAGMA journal_mode=WAL;")
            g.db.execute("PRAGMA foreign_keys = ON;")
        except sqlite3.Error as e:
            print(f"FATAL: Could not connect to database {db_path_str}: {e}")
            raise
    return g.db

def close_db(e=None):
    """
    Closes the database connection at the end of the request.
    Called automatically via app.teardown_appcontext.
    Commits if no exception occurred, otherwise rolls back.
    """
    db = g.pop('db', None)
    if db is not None:
        if e is None:
            try:
                # print("Committing DB transaction.") # Optional debug
                db.commit()
            except sqlite3.Error as commit_e:
                print(f"Error committing transaction: {commit_e}")
                try: db.rollback() # Rollback if commit fails
                except sqlite3.Error as rb_e: print(f"Error rolling back after failed commit: {rb_e}")
        else:
            try:
                # print(f"Rolling back DB transaction due to exception: {e}") # Optional debug
                db.rollback()
            except sqlite3.Error as rollback_e:
                print(f"Error rolling back transaction: {rollback_e}")
        try:
            # print("Closing DB connection.") # Optional debug
            db.close()
        except sqlite3.Error as close_e:
             print(f"Error closing database connection: {close_e}")

def execute_with_retry(conn, query, params=(), max_retries=MAX_RETRIES, initial_backoff=RETRY_BACKOFF):
    """
    Execute a query with retry logic ONLY for 'database is locked' errors.
    """
    backoff = initial_backoff
    retries = 0
    while True:
        try:
            cursor = conn.execute(query, params)
            return cursor
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e) and retries < max_retries:
                retries += 1
                sleep_time = backoff * (1 + random.uniform(0.1, 0.5))
                print(f"Database locked on query: {query[:50]}... Retrying ({retries}/{max_retries}) after {sleep_time:.2f}s...")
                time.sleep(sleep_time)
                backoff *= 2
            else:
                print(f"Database OperationalError (not retrying or retries exhausted): {e} on query: {query}")
                raise
        except sqlite3.Error as e:
            print(f"Database Error (not OperationalError/lock): {e} on query: {query}")
            raise

# --- Database Initialization ---

def init_db():
    """Initializes the database schema, creating tables only if they don't exist."""
    db_path_str = current_app.config.get('DATABASE', str(DATABASE))
    print(f"Ensuring database exists at: {db_path_str}")
    # Ensure the directory exists
    Path(db_path_str).parent.mkdir(parents=True, exist_ok=True)
    db = None
    try:
        # Use a dedicated connection, not from 'g'
        db = sqlite3.connect(db_path_str, timeout=DB_TIMEOUT, detect_types=sqlite3.PARSE_DECLTYPES)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL;")
        db.execute("PRAGMA foreign_keys = ON;")

        print("Ensuring tables exist...")
        db.execute("BEGIN;")

        # Create users table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_data TEXT -- Store as JSON text
            )
        ''')
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")

        # Create queue table if not exists
        db.execute('''
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
            )
        ''')
        db.execute("CREATE INDEX IF NOT EXISTS idx_queue_origin ON queue(origin);")
        db.execute("CREATE INDEX IF NOT EXISTS idx_queue_destination ON queue(destination);")

        # Create carpool table if not exists
        db.execute('''
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (username_passenger) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (email_passenger) REFERENCES users(email) ON DELETE CASCADE,
                FOREIGN KEY (username_driver) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (email_driver) REFERENCES users(email) ON DELETE CASCADE
            )
        ''')

        # Create test table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS test (
                carpool_id TEXT PRIMARY KEY,
                carpool_data TEXT, -- Store as JSON text
                driver_origin TEXT,
                driver_destination TEXT
            )
        ''')

        # Create quizzes table if not exists
        db.execute('''
            CREATE TABLE IF NOT EXISTS quizzes (
                quiz_id TEXT PRIMARY KEY,
                json TEXT NOT NULL, -- Store as JSON text
                return_address TEXT NOT NULL
            )
        ''')

        db.commit()
        print("Database schema ensured successfully.")

        # Optionally update quizzes if the table was just created or needs refreshing
        print("Checking quizzes data...")
        update_quiz_db()

    except sqlite3.Error as e:
        print(f"Error initializing database: {e}")
        if db:
            db.rollback()
        raise
    finally:
        if db:
            db.close()

@click.command('init-db')
@with_appcontext
def init_db_command():
    """Ensure database tables exist and populate quizzes."""
    try:
        init_db()
        click.echo('Ensured database tables exist.')
        click.echo('Quizzes data checked/updated.')
    except Exception as e:
        click.echo(f'Error during database initialization: {e}', err=True)
        import sys
        sys.exit(1)

# --- Application Integration ---

def init_app(app):
    """Register database functions with the Flask app and initialize DB on startup."""
    app.config.setdefault('DATABASE', str(DATABASE))  # Set default if not configured
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    with app.app_context():
        print("Running database initialization on server startup...")
        init_db()  # Automatically initialize database when app starts

# --- User Functions ---

def create_user(username: str, email: str, password: str) -> Optional[int]:
    """Create a new user."""
    # Use app context for bcrypt if configured, else use placeholder
    # bcrypt = getattr(current_app, 'bcrypt', None)
    # if not bcrypt: raise RuntimeError("Bcrypt not initialized on Flask app")
    # password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    password_hash = generate_password_hash(password).decode('utf-8') # Using placeholder

    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'INSERT INTO users (username, email, password_hash, user_data) VALUES (?, ?, ?, ?)',
            (username, email, password_hash, json.dumps({})) # Init user_data
        )
        # Rely on close_db teardown to commit
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        print(f"Integrity error creating user '{username}'/'{email}'. User likely exists.")
        # Rely on close_db teardown to rollback
        return None
    except sqlite3.Error as e:
        print(f"Error creating user {username}: {e}")
        return None # Rely on close_db teardown to rollback

def get_user_by_username(username: str) -> Optional[Dict]:
    """Retrieve a user by username, including password hash for login checks."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, password_hash, created_at, user_data FROM users WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        if user:
            user_dict = dict(user)
            try: # Safely parse JSON
                user_dict['user_data'] = json.loads(user_dict['user_data']) if user_dict.get('user_data') else {}
            except (json.JSONDecodeError, TypeError): user_dict['user_data'] = {}
            return user_dict
        else:
            return None
    except sqlite3.Error as e:
        print(f"Error getting user by username {username}: {e}")
        return None

def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Retrieve user public data by ID."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, created_at, user_data FROM users WHERE id = ?',
            (user_id,)
        )
        user = cursor.fetchone()
        if user:
            user_dict = dict(user)
            try: # Safely parse JSON
                user_dict['user_data'] = json.loads(user_dict['user_data']) if user_dict.get('user_data') else {}
            except (json.JSONDecodeError, TypeError): user_dict['user_data'] = {}
            return user_dict
        else:
            return None
    except sqlite3.Error as e:
        print(f"Error getting user by ID {user_id}: {e}")
        return None

def get_user_by_email(email: str) -> Optional[Dict]:
    """Retrieve user public data by email."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'SELECT id, username, email, created_at, user_data FROM users WHERE email = ?',
            (email,)
        )
        user = cursor.fetchone()
        if user:
            user_dict = dict(user)
            try: # Safely parse JSON
                user_dict['user_data'] = json.loads(user_dict['user_data']) if user_dict.get('user_data') else {}
            except (json.JSONDecodeError, TypeError): user_dict['user_data'] = {}
            return user_dict
        else:
            return None
    except sqlite3.Error as e:
        print(f"Error getting user by email {email}: {e}")
        return None

# --- Queue & Carpool Functions ---

def queue_passenger_or_driver(username: str, occupation_preference: str, personality_preference: str, occupation_current: str, personality_current: str, is_passenger: bool, origin: str, destination: str) -> Optional[int]:
    """Queue a user (passenger or driver)."""
    conn = get_db()
    try:
        cursor_email = execute_with_retry(conn, 'SELECT email FROM users WHERE username = ?', (username,))
        user_row = cursor_email.fetchone()
        if not user_row:
            print(f"Error queuing: User '{username}' not found.")
            return None
        user_email = user_row['email']

        cursor = execute_with_retry(
            conn,
            '''INSERT INTO queue (username, email, occupation_preference, personality_preference,
                                 occupation_current, personality_current, is_passenger,
                                 origin, destination)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (username, user_email, occupation_preference, personality_preference, occupation_current,
             personality_current, is_passenger, origin, destination)
        )
        # Rely on close_db to commit
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        print(f"Integrity error queuing user {username}. Already in queue or FK constraint violated?")
        return None # Rely on close_db to rollback
    except sqlite3.Error as e:
        print(f"Error queuing user {username}: {e}")
        return None # Rely on close_db to rollback

def create_carpool(username_passenger: str, username_driver: str, driver_car_make: str, driver_car_license_plate: str, driver_car_color: str, driver_origin: str, passenger_origin: str, driver_destination: str, passenger_destination: str) -> Optional[int]:
    """Create a carpool entry."""
    conn = get_db()
    try:
        cursor_emails = execute_with_retry(
            conn,
            '''SELECT u1.email AS passenger_email, u2.email AS driver_email
               FROM users u1, users u2
               WHERE u1.username = ? AND u2.username = ?''',
            (username_passenger, username_driver)
        )
        email_row = cursor_emails.fetchone()
        if not email_row:
            print(f"Error creating carpool: Passenger '{username_passenger}' or Driver '{username_driver}' not found.")
            return None
        passenger_email = email_row['passenger_email']
        driver_email = email_row['driver_email']

        cursor = execute_with_retry(
            conn,
            '''INSERT INTO carpool (username_passenger, email_passenger, username_driver, email_driver,
                                   driver_car_make, driver_car_license_plate, driver_car_color,
                                   driver_origin, passenger_origin, driver_destination, passenger_destination)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (username_passenger, passenger_email, username_driver, driver_email, driver_car_make,
             driver_car_license_plate, driver_car_color, driver_origin, passenger_origin,
             driver_destination, passenger_destination)
        )
        # Rely on close_db to commit
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        print(f"Integrity error creating carpool for {username_passenger}/{username_driver}. Duplicate entry or FK constraint?")
        return None # Rely on close_db to rollback
    except sqlite3.Error as e:
        print(f"Error creating carpool for {username_passenger}/{username_driver}: {e}")
        return None # Rely on close_db to rollback

def unqueue_passenger_or_driver_by_user(username: str) -> str:
    """Unqueue a user by username. Returns 'Success', 'Unsuccessful', or 'Error'."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'DELETE FROM queue WHERE username = ?',
            (username,)
        )
        # Rely on close_db to commit
        return "Success" if cursor.rowcount > 0 else "Unsuccessful"
    except sqlite3.Error as e:
        print(f"Error unqueuing user {username}: {e}")
        return "Error" # Rely on close_db to rollback

def delete_carpool_ride(username_passenger: str, username_driver: str) -> str:
    """Delete a carpool ride. Returns 'Success', 'Unsuccessful', or 'Error'."""
    conn = get_db()
    try:
        cursor = execute_with_retry(
            conn,
            'DELETE FROM carpool WHERE username_passenger = ? AND username_driver = ?',
            (username_passenger, username_driver)
        )
        # Rely on close_db to commit
        return "Success" if cursor.rowcount > 0 else "Unsuccessful"
    except sqlite3.Error as e:
        print(f"Error deleting carpool for {username_passenger}/{username_driver}: {e}")
        return "Error" # Rely on close_db to rollback

# --- QUIZ FUNCTIONS (Universal ID Handling) ---

def parse_universal_id(universal_id: str) -> Dict:
    """Parse universal_id in the format:
    "DB_TABLE_NAME[KEY_COLUMN_NAME:VALUE_OF_KEY]@DATA_COLUMN_NAME->KEY_FOR_VALUE_IN_JSON_DICT"
    
    Args:
        universal_id: The universal_id string to parse
        
    Returns:
        Dict: A dictionary containing the parsed components
    """
    if not isinstance(universal_id, str): return None
    try:
        # Parse the table and row identifier section
        table_match = re.match(r'([^[]+)\[([^:]+):([^\]]+)\]@([^->]+)(->(.+))?', universal_id)
        
        if not table_match:
            raise ValueError(f"Invalid universal_id format: {universal_id}")
            
        table_name = table_match.group(1)
        key_column = table_match.group(2)
        key_value = table_match.group(3)
        data_column = table_match.group(4)
        json_key = table_match.group(6)  # This will be None if -> is not present
        
        return {
            'table_name': table_name,
            'key_column': key_column,
            'key_value': key_value,
            'data_column': data_column,
            'json_key': json_key
        }
    except Exception as e:
        print(f"Error parsing universal_id '{universal_id}': {e}")
        return None

def _substitute_context(key_value: str, context: Optional[Dict]) -> str:
    """Substitute <variable> placeholders in key_value using context and Flask g."""
    if context and isinstance(key_value, str) and key_value.startswith('<') and key_value.endswith('>'):
        var_name = key_value[1:-1]
        # Prioritize g, then context dict, fallback to original string
        val_from_g = g.get(var_name)
        if val_from_g is not None:
             return str(val_from_g)
        val_from_context = context.get(var_name)
        print(f"Key value: {var_name}, Found in context: {val_from_context}")
        if val_from_context is not None:
            return str(val_from_context)
        return key_value # Variable not found, return placeholder
    return str(key_value)

def get_data_for_universal_id(universal_id: str, context: Dict) -> Any:
    """Retrieve data for a given universal_id using context."""
    parsed = parse_universal_id(universal_id)
    if not parsed: return ""

    key_value = _substitute_context(parsed['key_value'], context)
    if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
        print(f"Warning: Context variable {parsed['key_value']} not found for UID {universal_id}")
        return ""

    conn = get_db()
    try:
        query = f"SELECT \"{parsed['data_column']}\" FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
        cursor = execute_with_retry(conn, query, (key_value,))
        row = cursor.fetchone()
        if not row: return ""

        column_value = row[parsed['data_column']]

        if parsed['json_key'] and column_value is not None:
            try:
                json_data = {}
                if isinstance(column_value, (dict, list)): json_data = column_value
                elif isinstance(column_value, str) and column_value.strip(): json_data = json.loads(column_value)

                keys = parsed['json_key'].split('.')
                data = json_data
                for key in keys:
                    if isinstance(data, dict): data = data.get(key)
                    else: data = None; break
                return data if data is not None else ""
            except (json.JSONDecodeError, TypeError) as json_e:
                print(f"Error decoding JSON for UID {universal_id} (key: {parsed['json_key']}): {json_e}")
                return ""
        else:
            return column_value if column_value is not None else ""
    except sqlite3.Error as e:
        print(f"Database error retrieving data for UID {universal_id}: {e}")
        return ""

def save_data_for_universal_id(universal_id: str, value: Any, context: Dict) -> bool:
    """Save data for a given universal_id using context."""
    parsed = parse_universal_id(universal_id)
    if not parsed: return False

    key_value = _substitute_context(parsed['key_value'], context)
    if key_value == parsed['key_value'] and parsed['key_value'].startswith('<'):
         print(f"Warning: Context variable {parsed['key_value']} not found for saving UID {universal_id}")
         return False

    conn = get_db()
    try:
        # --- Logic for JSON key update ---
        if parsed['json_key']:
            select_query = f"SELECT \"{parsed['data_column']}\" FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
            cursor = execute_with_retry(conn, select_query, (key_value,))
            row = cursor.fetchone()
            json_data = {}
            row_exists = row is not None
            if row_exists and row[parsed['data_column']] is not None:
                current_data = row[parsed['data_column']]
                if isinstance(current_data, str) and current_data.strip():
                    try: json_data = json.loads(current_data)
                    except (json.JSONDecodeError, TypeError): json_data = {}
                elif isinstance(current_data, dict): json_data = current_data

            keys = parsed['json_key'].split('.')
            target = json_data
            for i, key in enumerate(keys):
                if i == len(keys) - 1: target[key] = value
                else:
                    if key not in target or not isinstance(target[key], dict): target[key] = {}
                    target = target[key]
            updated_json_text = json.dumps(json_data)

            if row_exists:
                update_query = f"UPDATE \"{parsed['table_name']}\" SET \"{parsed['data_column']}\" = ? WHERE \"{parsed['key_column']}\" = ?"
                execute_with_retry(conn, update_query, (updated_json_text, key_value))
            else:
                print(f"Info: Row not found for UID {universal_id} key {key_value}. Inserting.")
                insert_query = f"INSERT INTO \"{parsed['table_name']}\" (\"{parsed['key_column']}\", \"{parsed['data_column']}\") VALUES (?, ?)"
                try: execute_with_retry(conn, insert_query, (key_value, updated_json_text))
                except sqlite3.Error as e: print(f"Error INSERTING new row for UID {universal_id}: {e}"); return False
            # Rely on close_db to commit

        # --- Logic for direct column update ---
        else:
            actual_value = json.dumps(value) if isinstance(value, (dict, list)) else value
            select_query = f"SELECT 1 FROM \"{parsed['table_name']}\" WHERE \"{parsed['key_column']}\" = ?"
            cursor = execute_with_retry(conn, select_query, (key_value,))
            row_exists = cursor.fetchone() is not None

            if row_exists:
                update_query = f"UPDATE \"{parsed['table_name']}\" SET \"{parsed['data_column']}\" = ? WHERE \"{parsed['key_column']}\" = ?"
                execute_with_retry(conn, update_query, (actual_value, key_value))
            else:
                print(f"Info: Row not found for UID {universal_id} key {key_value}. Inserting.")
                insert_query = f"INSERT INTO \"{parsed['table_name']}\" (\"{parsed['key_column']}\", \"{parsed['data_column']}\") VALUES (?, ?)"
                try: execute_with_retry(conn, insert_query, (key_value, actual_value))
                except sqlite3.Error as e: print(f"Error INSERTING new row for UID {universal_id}: {e}"); return False
            # Rely on close_db to commit

        return True
    except sqlite3.Error as e:
        print(f"Database error saving data for UID {universal_id}: {e}")
        return False # Rely on close_db to rollback

def update_quiz_db():
    """Update the quizzes table from quizzes.json file."""
    # Use constant path for quizzes JSON unless configured otherwise
    quiz_file = current_app.config.get('QUIZZES_JSON_PATH', QUIZZES_JSON_PATH)
    if not quiz_file.exists():
        print(f"Warning: Quizzes file not found at {quiz_file}. Cannot update quizzes.")
        return

    try:
        with open(quiz_file, 'r', encoding='utf-8') as f:
            quizzes_from_file = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"Error reading or parsing {quiz_file}: {e}")
        return

    conn = get_db()
    updated_count, inserted_count, deleted_count = 0, 0, 0
    try:
        cursor = execute_with_retry(conn, 'SELECT quiz_id FROM quizzes')
        existing_quiz_ids = {row['quiz_id'] for row in cursor.fetchall()}
        file_quiz_ids = set()

        for quiz_data in quizzes_from_file:
            quiz_id = quiz_data.get('id')
            if not quiz_id: continue
            file_quiz_ids.add(quiz_id)
            quiz_json_text = json.dumps(quiz_data)
            return_address = quiz_data.get('return_address', '/home')

            if quiz_id in existing_quiz_ids:
                execute_with_retry(conn,'UPDATE quizzes SET json = ?, return_address = ? WHERE quiz_id = ?',(quiz_json_text, return_address, quiz_id))
                updated_count += 1
            else:
                execute_with_retry(conn,'INSERT INTO quizzes (quiz_id, json, return_address) VALUES (?, ?, ?)',(quiz_id, quiz_json_text, return_address))
                inserted_count += 1

        ids_to_delete = existing_quiz_ids - file_quiz_ids
        if ids_to_delete:
            placeholders = ', '.join('?' for _ in ids_to_delete)
            execute_with_retry(conn, f"DELETE FROM quizzes WHERE quiz_id IN ({placeholders})", tuple(ids_to_delete))
            deleted_count = len(ids_to_delete)

        # Rely on close_db to commit
        print(f"Quizzes DB update: {inserted_count} inserted, {updated_count} updated, {deleted_count} deleted.")
    except sqlite3.Error as e:
        print(f"Error updating quizzes database: {e}")
        # Rely on close_db to rollback

def get_quiz_by_id(quiz_id: str) -> Optional[Dict]:
    """Retrieve the full quiz data (as dict) for a given quiz ID."""
    conn = get_db()
    try:
        cursor = execute_with_retry(conn, 'SELECT quiz_id, json, return_address FROM quizzes WHERE quiz_id = ?', (quiz_id,))
        quiz = cursor.fetchone()
        return dict(quiz) if quiz else None
    except sqlite3.Error as e:
        print(f"Error getting quiz by ID {quiz_id}: {e}")
        return None

def get_user_data(user_id: int) -> Dict:
    """Retrieve and parse the user_data JSON for a user."""
    conn = get_db()
    try:
        cursor = execute_with_retry(conn, 'SELECT user_data FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        if row and row['user_data']:
            try: return json.loads(row['user_data'])
            except (json.JSONDecodeError, TypeError): return {}
        return {}
    except sqlite3.Error as e:
        print(f"Error getting user_data for user ID {user_id}: {e}")
        return {}


def save_quiz_results(user_id: int, results: Dict, context: Dict) -> Dict:
    """Save quiz results, handling different universal_id formats."""
    if not results: return {'success': True, 'operations': [], 'message': 'No results to save'}

    if 'user' in g: context['user'] = g.user # Example if user object is stored in g

    operations_results = {'success': True, 'operations': [], 'message': ''}
    failed_ids = []

    for universal_id, value in results.items():
        success = save_data_for_universal_id(universal_id, value, context)
        operations_results['operations'].append({
            'universal_id': universal_id, 'success': success,
            'message': 'Saved' if success else 'Failed'
        })
        if not success:
            operations_results['success'] = False
            failed_ids.append(universal_id)

    if not operations_results['success']:
        operations_results['message'] = f'Failed to save results for: {", ".join(failed_ids)}'
    else:
        operations_results['message'] = 'All results saved successfully.'
    # Rely on close_db to commit/rollback

    close_db()
    return operations_results

def get_specific_user_data(user_id: int, universal_ids: List[str]) -> Dict:
    """Retrieve specific data fields using universal IDs."""
    context = {'user_id': user_id}
    if 'user' in g: context['user'] = g.user # Example

    result_data = {}
    for uid in universal_ids:
        if not uid: result_data[uid] = ""
        else: result_data[uid] = get_data_for_universal_id(uid, context)
    return result_data

